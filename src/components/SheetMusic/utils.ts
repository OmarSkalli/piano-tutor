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

/**
 * Groups pre-processed notes (including rests) into measures by their
 * measureIndex field. Returns a sparse-safe array indexed from 0.
 */
export function groupMeasures(notes: Note[]): Note[][] {
  if (notes.length === 0) return []
  const maxMeasure = notes.reduce((m, n) => Math.max(m, n.measureIndex), 0)
  const measures: Note[][] = Array.from({ length: maxMeasure + 1 }, () => [])
  for (const note of notes) {
    measures[note.measureIndex].push(note)
  }
  return measures
}

export function noteId(trackIndex: number, noteIndex: number): string {
  return `${trackIndex}-${noteIndex}`
}
