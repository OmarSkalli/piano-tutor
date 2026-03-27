import type { Note, NoteDuration } from '@/types'

// 'C4' → 'c/4', 'F#4' → 'f#/4', 'Bb3' → 'bb/3'
export function toVFKey(noteName: string): string {
  const match = noteName.match(/^([A-Ga-g][#b]?)(\d+)$/)
  if (!match) return 'c/4'
  const [, pitch, octave] = match
  return `${pitch.toLowerCase()}/${octave}`
}

// Maps NoteDuration to VexFlow duration codes
export function toVFDur(noteDuration: NoteDuration): string {
  switch (noteDuration) {
    case 'whole':
      return 'w'
    case 'half':
      return 'h'
    case 'quarter':
      return 'q'
    case 'eighth':
      return '8'
    case 'sixteenth':
      return '16'
    case 'thirty-second':
      return '32'
    default:
      return 'q'
  }
}

// Returns '#', 'b', or null based on the note name
export function getAccidental(noteName: string): string | null {
  if (noteName.includes('#')) return '#'
  if (noteName.includes('b') && /[A-G]b/.test(noteName)) return 'b'
  return null
}

const BEAT_MAP: Record<NoteDuration, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
  'thirty-second': 0.125,
}

// Groups notes into measures based on cumulative beat count
export function groupMeasures(notes: Note[], beatsPerMeasure = 4): Note[][] {
  const measures: Note[][] = []
  let current: Note[] = []
  let beats = 0

  for (const note of notes) {
    const noteBeat = BEAT_MAP[note.noteDuration] ?? 1
    if (beats > 0 && beats + noteBeat > beatsPerMeasure + 0.001) {
      measures.push(current)
      current = []
      beats = 0
    }
    current.push(note)
    beats += noteBeat
  }

  if (current.length > 0) measures.push(current)
  return measures
}

export function noteId(trackIndex: number, noteIndex: number): string {
  return `${trackIndex}-${noteIndex}`
}
