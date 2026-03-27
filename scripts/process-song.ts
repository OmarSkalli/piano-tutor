import midiLib from '@tonejs/midi'
const { Midi } = midiLib as unknown as typeof import('@tonejs/midi')
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { Hand, Note, NoteDuration, Track } from '../src/types'

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

const timeSignature = midi.header.timeSignatures[0]
  ? {
      numerator: midi.header.timeSignatures[0].timeSignature[0],
      denominator: midi.header.timeSignatures[0].timeSignature[1],
    }
  : { numerator: 4, denominator: 4 }

const ticksPerMeasure = ticksPerQuarter * timeSignature.numerator

// Snap a tick to the nearest subdivision (32nd note = ticksPerQuarter/8)
const SNAP = ticksPerQuarter / 8
function snap(tick: number): number {
  return Math.round(tick / SNAP) * SNAP
}

// Ordered largest→smallest for greedy rest decomposition
const REST_DURATIONS: { name: NoteDuration; ticks: number }[] = [
  { name: 'whole', ticks: ticksPerQuarter * 4 },
  { name: 'half', ticks: ticksPerQuarter * 2 },
  { name: 'quarter', ticks: ticksPerQuarter },
  { name: 'eighth', ticks: ticksPerQuarter / 2 },
  { name: 'sixteenth', ticks: ticksPerQuarter / 4 },
  { name: 'thirty-second', ticks: ticksPerQuarter / 8 },
]

function ticksToNoteDuration(ticks: number): NoteDuration {
  return REST_DURATIONS.reduce((best, d) =>
    Math.abs(d.ticks - ticks) < Math.abs(best.ticks - ticks) ? d : best,
  ).name
}

/** Decompose a tick gap into the fewest rests using greedy largest-first. */
function fillRests(startTick: number, gapTicks: number): Note[] {
  const rests: Note[] = []
  let remaining = gapTicks
  let cursor = startTick

  for (const { name, ticks } of REST_DURATIONS) {
    while (remaining >= ticks - SNAP / 2) {
      const startMs = ticksToMs(cursor)
      const measureIndex = Math.floor(cursor / ticksPerMeasure)
      const beatInMeasure = (cursor % ticksPerMeasure) / ticksPerQuarter
      rests.push({
        name: 'rest',
        startMs,
        durationMs: ticksToMs(cursor + ticks) - startMs,
        noteDuration: name,
        measureIndex,
        beatInMeasure,
        isRest: true,
      })
      cursor += ticks
      remaining -= ticks
    }
  }
  return rests
}

function assignHands(trackCount: number): Hand[] {
  if (trackCount === 2) return ['right', 'left']
  if (trackCount === 1) return ['unknown']
  return Array.from({ length: trackCount }, (_, i) =>
    i === 0 ? 'right' : i === 1 ? 'left' : 'unknown',
  )
}

const hands = assignHands(midi.tracks.length)
const usePitchSplit = midi.tracks.length === 1

const tracks: Track[] = midi.tracks.map((track, i) => {
  const hand: Hand = usePitchSplit ? 'unknown' : (hands[i] ?? 'unknown')

  // Sort notes by start tick (MIDI tracks are usually sorted, but be safe)
  const midiNotes = [...track.notes].sort((a, b) => a.ticks - b.ticks)

  const notes: Note[] = []

  // We detect rests from gaps between consecutive note *start* ticks, not
  // start+duration, because MIDI note durations often slightly underrun/overrun
  // the grid. The rhythmic intent is encoded in the start positions.
  let cursor = 0 // tracks the next expected note start in ticks

  for (const midiNote of midiNotes) {
    const startTick = snap(midiNote.ticks)
    const durationTicks = snap(midiNote.durationTicks) || SNAP

    // Fill gap between cursor and this note with rests
    if (startTick > cursor + SNAP / 2) {
      notes.push(...fillRests(cursor, startTick - cursor))
    }

    const measureIndex = Math.floor(startTick / ticksPerMeasure)
    const beatInMeasure = (startTick % ticksPerMeasure) / ticksPerQuarter
    const startMs = ticksToMs(startTick)
    notes.push({
      midi: midiNote.midi,
      name: midiNote.name,
      velocity: Math.round(midiNote.velocity * 100) / 100,
      startMs,
      durationMs: ticksToMs(startTick + durationTicks) - startMs,
      noteDuration: ticksToNoteDuration(durationTicks),
      measureIndex,
      beatInMeasure,
      isRest: false,
    })

    // Advance cursor using the quantized (notated) duration, not the raw MIDI
    // duration — the raw duration is legato/performance timing and overshoots
    const notatedTicks = REST_DURATIONS.find(
      (d) => d.name === ticksToNoteDuration(durationTicks),
    )!.ticks
    cursor = startTick + notatedTicks
  }

  // Fill remainder of the final measure so it sums to beatsPerMeasure
  const endOfMeasure = Math.ceil(cursor / ticksPerMeasure) * ticksPerMeasure
  if (endOfMeasure > cursor + SNAP / 2) {
    notes.push(...fillRests(cursor, endOfMeasure - cursor))
  }

  return { hand, notes }
})

const lastNote = tracks
  .flatMap((t) => t.notes)
  .filter((n) => !n.isRest)
  .reduce((max, n) => Math.max(max, n.startMs + n.durationMs), 0)

const songJson = {
  id,
  ticksPerQuarter,
  durationMs: lastNote,
  tempoChanges: tempoMap.map(({ tick, bpm }) => ({ tick, bpm })),
  timeSignature,
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
  const timeSignatureStr = timeSig
    ? `${timeSig.timeSignature[0]}/${timeSig.timeSignature[1]}`
    : null

  const metadataJson = {
    id,
    title,
    composer: null as string | null,
    keySignature,
    timeSignature: timeSignatureStr,
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
const realNotes = tracks.flatMap((t) => t.notes).filter((n) => !n.isRest)
const restNotes = tracks.flatMap((t) => t.notes).filter((n) => n.isRest)
const durationSec = (lastNote / 1000).toFixed(1)

console.log(`\nID:     ${id}`)
console.log(`Tracks: ${midi.tracks.length}`)
console.log(`Notes:  ${realNotes.length} real + ${restNotes.length} rests`)
console.log(`Length: ${durationSec}s`)
console.log(`metadata.json: ${isRerun ? 'preserved (re-run)' : 'written'}`)
console.log(`\nWritten to ${outputDir}/`)
console.log(`Library updated: ${libraryPath}`)
