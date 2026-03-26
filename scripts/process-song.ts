import midiLib from '@tonejs/midi'
const { Midi } = midiLib as unknown as typeof import('@tonejs/midi')
import fs from 'fs'
import path from 'path'

const inputPath = process.argv[2]

if (!inputPath) {
  console.error('Usage: pnpm process-song <path-to-midi>')
  process.exit(1)
}

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`)
  process.exit(1)
}

const midi = new Midi(fs.readFileSync(inputPath))

// Derive slug from filename
const slug = path
  .basename(inputPath, path.extname(inputPath))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const outputDir = path.join('src', 'songs', slug)
fs.mkdirSync(outputDir, { recursive: true })

// Copy source file
fs.copyFileSync(inputPath, path.join(outputDir, 'source.mid'))

// Build tempo map for tick→ms conversion
const ticksPerQuarter = midi.header.ppq

interface TempoEvent {
  tick: number
  bpm: number
  microsecondsPerBeat: number
}

const tempoMap: TempoEvent[] = midi.header.tempos.length
  ? midi.header.tempos.map((t) => ({
      tick: t.ticks,
      bpm: Math.round(t.bpm * 100) / 100,
      microsecondsPerBeat: Math.round(60_000_000 / t.bpm),
    }))
  : [{ tick: 0, bpm: 120, microsecondsPerBeat: 500_000 }]

function ticksToMs(tick: number): number {
  let ms = 0
  let lastTick = 0
  let lastMpb = tempoMap[0].microsecondsPerBeat

  for (const event of tempoMap) {
    if (event.tick > tick) break
    ms += ((event.tick - lastTick) / ticksPerQuarter) * (lastMpb / 1000)
    lastTick = event.tick
    lastMpb = event.microsecondsPerBeat
  }
  ms += ((tick - lastTick) / ticksPerQuarter) * (lastMpb / 1000)
  return Math.round(ms)
}

// Hand assignment
type Hand = 'right' | 'left' | 'unknown'

function assignHands(trackCount: number): Hand[] {
  if (trackCount === 2) return ['right', 'left']
  if (trackCount === 1) return ['unknown'] // pitch-split handled per note
  return Array.from({ length: trackCount }, (_, i) =>
    i === 0 ? 'right' : i === 1 ? 'left' : 'unknown',
  )
}

const hands = assignHands(midi.tracks.length)
const usePitchSplit = midi.tracks.length === 1

interface Note {
  midi: number
  name: string
  velocity: number
  startMs: number
  durationMs: number
}

interface Track {
  hand: Hand
  notes: Note[]
}

const tracks: Track[] = midi.tracks.map((track, i) => {
  const notes: Note[] = track.notes.map((note) => ({
    midi: note.midi,
    name: note.name,
    velocity: Math.round(note.velocity * 100) / 100,
    startMs: ticksToMs(note.ticks),
    durationMs:
      ticksToMs(note.ticks + note.durationTicks) - ticksToMs(note.ticks),
  }))
  // For pitch-split single-track files, hand is assigned per-note at render time
  const hand: Hand = usePitchSplit ? 'unknown' : (hands[i] ?? 'unknown')
  return { hand, notes }
})

const lastNote = tracks
  .flatMap((t) => t.notes)
  .reduce((max, n) => Math.max(max, n.startMs + n.durationMs), 0)

const songJson = {
  ticksPerQuarter,
  durationMs: lastNote,
  tempoChanges: tempoMap.map(({ tick, bpm }) => ({ tick, bpm })),
  timeSignature: midi.header.timeSignatures[0]
    ? {
        numerator: midi.header.timeSignatures[0].timeSignature[0],
        denominator: midi.header.timeSignatures[0].timeSignature[1],
      }
    : { numerator: 4, denominator: 4 },
  tracks,
}

// Metadata
const rawTitle = midi.header.name?.replace(/\0/g, '').trim() || null
const title = rawTitle && rawTitle.length > 0 ? rawTitle : null

const keyEvent = midi.header.keySignatures[0]
let keySignature: string | null = null
if (keyEvent) {
  const { key, scale } = keyEvent
  keySignature = `${key} ${scale}`
}

const timeSig = midi.header.timeSignatures[0]
const timeSignature = timeSig
  ? `${timeSig.timeSignature[0]}/${timeSig.timeSignature[1]}`
  : null

const tempo = tempoMap[0]?.bpm ?? null

const handsMap = midi.tracks.length >= 2 ? { right: 0, left: 1 } : null

const metadataJson = {
  title,
  composer: null,
  keySignature,
  timeSignature,
  tempo,
  hands: handsMap,
  source: path.basename(inputPath),
}

fs.writeFileSync(
  path.join(outputDir, 'song.json'),
  JSON.stringify(songJson, null, 2),
)
fs.writeFileSync(
  path.join(outputDir, 'metadata.json'),
  JSON.stringify(metadataJson, null, 2),
)

// Summary
const totalNotes = tracks.reduce((sum, t) => sum + t.notes.length, 0)
const durationSec = (lastNote / 1000).toFixed(1)

console.log(`\nSong: ${slug}`)
console.log(`Tracks: ${midi.tracks.length}`)
console.log(`Total notes: ${totalNotes}`)
console.log(`Duration: ${durationSec}s`)
console.log(`Metadata:`)
console.log(`  title: ${title ?? 'null (not in MIDI)'}`)
console.log(`  composer: null`)
console.log(`  key: ${keySignature ?? 'null (not in MIDI)'}`)
console.log(`  time signature: ${timeSignature ?? 'null (not in MIDI)'}`)
console.log(`  tempo: ${tempo} BPM`)
console.log(
  `  hands: ${handsMap ? JSON.stringify(handsMap) : 'null (single track — pitch split used)'}`,
)
console.log(`\nWritten to ${outputDir}/`)
