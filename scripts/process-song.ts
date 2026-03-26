import midiLib from '@tonejs/midi'
const { Midi } = midiLib as unknown as typeof import('@tonejs/midi')
import crypto from 'crypto'
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

const fileBuffer = fs.readFileSync(inputPath)
const midi = new Midi(fileBuffer)

// MD5 checksum of the source file — stable song ID and folder name
const id = crypto.createHash('md5').update(fileBuffer).digest('hex')

const outputDir = path.join('src', 'songs', id)
const isRerun = fs.existsSync(path.join(outputDir, 'metadata.json'))

fs.mkdirSync(outputDir, { recursive: true })
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
  if (trackCount === 1) return ['unknown']
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
  const hand: Hand = usePitchSplit ? 'unknown' : (hands[i] ?? 'unknown')
  return { hand, notes }
})

const lastNote = tracks
  .flatMap((t) => t.notes)
  .reduce((max, n) => Math.max(max, n.startMs + n.durationMs), 0)

const songJson = {
  id,
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

fs.writeFileSync(
  path.join(outputDir, 'song.json'),
  JSON.stringify(songJson, null, 2),
)

// Only write metadata.json on first import — preserve manual edits on re-run
if (!isRerun) {
  const rawTitle = midi.header.name?.replace(/\0/g, '').trim() || null
  const title = rawTitle && rawTitle.length > 0 ? rawTitle : null

  const keyEvent = midi.header.keySignatures[0]
  const keySignature = keyEvent ? `${keyEvent.key} ${keyEvent.scale}` : null

  const timeSig = midi.header.timeSignatures[0]
  const timeSignature = timeSig
    ? `${timeSig.timeSignature[0]}/${timeSig.timeSignature[1]}`
    : null

  const metadataJson = {
    id,
    title,
    composer: null as string | null,
    keySignature,
    timeSignature,
    tempo: tempoMap[0]?.bpm ?? null,
    hands: midi.tracks.length >= 2 ? { right: 0, left: 1 } : null,
    source: path.basename(inputPath),
  }

  fs.writeFileSync(
    path.join(outputDir, 'metadata.json'),
    JSON.stringify(metadataJson, null, 2),
  )
}

// Update library.json
const libraryPath = path.join('src', 'songs', 'library.json')
interface LibraryEntry {
  id: string
  title: string | null
}
const library: LibraryEntry[] = fs.existsSync(libraryPath)
  ? JSON.parse(fs.readFileSync(libraryPath, 'utf8'))
  : []

const metadata = JSON.parse(
  fs.readFileSync(path.join(outputDir, 'metadata.json'), 'utf8'),
)
const entry: LibraryEntry = { id, title: metadata.title }
const existingIndex = library.findIndex((e) => e.id === id)

if (existingIndex >= 0) {
  library[existingIndex] = entry
} else {
  library.push(entry)
}

fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2))

// Summary
const totalNotes = tracks.reduce((sum, t) => sum + t.notes.length, 0)
const durationSec = (lastNote / 1000).toFixed(1)

console.log(`\nID:     ${id}`)
console.log(`Tracks: ${midi.tracks.length}`)
console.log(`Notes:  ${totalNotes}`)
console.log(`Length: ${durationSec}s`)
console.log(`metadata.json: ${isRerun ? 'preserved (re-run)' : 'written'}`)
console.log(`\nWritten to ${outputDir}/`)
console.log(`Library updated: ${libraryPath}`)
