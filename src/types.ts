export type NoteDuration =
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | 'sixteenth'
  | 'thirty-second'

export interface Note {
  midi: number
  name: string
  velocity: number
  startMs: number
  durationMs: number
  noteDuration: NoteDuration
}

export type Hand = 'right' | 'left' | 'unknown'

export interface Track {
  hand: Hand
  notes: Note[]
}

export interface Song {
  id: string
  ticksPerQuarter: number
  durationMs: number
  tempoChanges: { tick: number; bpm: number }[]
  timeSignature: { numerator: number; denominator: number }
  tracks: Track[]
}

export interface LibraryEntry {
  id: string
  title: string
}

export interface SongMeta {
  id: string
  title: string
  composer: string | null
  keySignature: string
  timeSignature: string
  tempo: number
  hands: { right: number; left: number }
  source: string
}
