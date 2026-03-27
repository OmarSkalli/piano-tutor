import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { noteId } from '@/components/SheetMusic/utils'
import type { Hand, Song } from '@/types'

export interface PracticeState {
  status: 'idle' | 'waiting' | 'done'
  activeNoteIds: Set<string>
  activeNoteNames: Map<string, Hand>
  hintNoteIds: Set<string>
  currentMeasure: number | null
  start(): void
  reset(): void
}

interface Chord {
  notes: Array<{ id: string; name: string; hand: Hand }>
  measureIndex: number
}

function sameIds(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) {
    if (!b.has(id)) return false
  }
  return true
}

function buildChords(song: Song): Chord[] {
  const entries: Array<{
    startMs: number
    name: string
    hand: Hand
    id: string
    measureIndex: number
  }> = []

  for (let ti = 0; ti < song.tracks.length; ti++) {
    const track = song.tracks[ti]
    let realNoteIndex = 0
    for (const note of track.notes) {
      if (note.isRest) continue
      entries.push({
        startMs: note.startMs,
        name: note.name,
        hand: track.hand,
        id: noteId(ti, realNoteIndex++),
        measureIndex: note.measureIndex,
      })
    }
  }

  entries.sort((a, b) => a.startMs - b.startMs)

  const byStartMs = new Map<number, typeof entries>()
  for (const e of entries) {
    const bucket = byStartMs.get(e.startMs) ?? []
    bucket.push(e)
    byStartMs.set(e.startMs, bucket)
  }

  return Array.from(byStartMs.values()).map((group) => ({
    notes: group.map((e) => ({ id: e.id, name: e.name, hand: e.hand })),
    measureIndex: group[0].measureIndex,
  }))
}

export function usePractice(
  song: Song,
  activeNotes: Set<string>,
): PracticeState {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'done'>('idle')
  const [activeNoteIds, setActiveNoteIds] = useState<Set<string>>(new Set())
  const [activeNoteNames, setActiveNoteNames] = useState<Map<string, Hand>>(
    new Map(),
  )
  const [hintNoteIds, setHintNoteIds] = useState<Set<string>>(new Set())
  const [currentMeasure, setCurrentMeasure] = useState<number | null>(null)

  const chords = useMemo(() => buildChords(song), [song])
  const chordIndexRef = useRef(0)
  const statusRef = useRef<'idle' | 'waiting' | 'done'>('idle')
  const advanceQueuedRef = useRef(false)
  const resetQueuedRef = useRef(false)

  const highlightChord = useCallback(
    (index: number) => {
      const chord = chords[index]
      if (!chord) return
      const chordNoteIds = new Set(chord.notes.map((n) => n.id))
      setActiveNoteIds(chordNoteIds)
      setActiveNoteNames(new Map(chord.notes.map((n) => [n.name, n.hand])))
      setHintNoteIds((prev) => (prev.size === 0 ? prev : new Set()))
      setCurrentMeasure(chord.measureIndex)
    },
    [chords],
  )

  const advance = useCallback(() => {
    const next = chordIndexRef.current + 1
    if (next >= chords.length) {
      chordIndexRef.current = chords.length
      statusRef.current = 'done'
      setStatus('done')
      setActiveNoteIds(new Set())
      setActiveNoteNames(new Map())
      setHintNoteIds(new Set())
      setCurrentMeasure(null)
    } else {
      chordIndexRef.current = next
      highlightChord(next)
    }
  }, [chords.length, highlightChord])

  // Advance when all notes in the current chord are pressed
  useEffect(() => {
    if (statusRef.current !== 'waiting') return
    const chord = chords[chordIndexRef.current]
    if (!chord) return
    const expectedNotes = new Set(chord.notes.map((n) => n.name))
    const hasWrongNote =
      activeNotes.size > 0 &&
      Array.from(activeNotes).some((note) => !expectedNotes.has(note))
    if (hasWrongNote) {
      const chordNoteIds = new Set(chord.notes.map((n) => n.id))
      setHintNoteIds((prev) =>
        sameIds(prev, chordNoteIds) ? prev : chordNoteIds,
      )
    }
    const allPressed = chord.notes.every((n) => activeNotes.has(n.name))
    if (!allPressed || advanceQueuedRef.current) return
    advanceQueuedRef.current = true
    queueMicrotask(() => {
      advanceQueuedRef.current = false
      if (statusRef.current === 'waiting') advance()
    })
  }, [activeNotes, chords, advance])

  const start = useCallback(() => {
    if (chords.length === 0) return
    chordIndexRef.current = 0
    statusRef.current = 'waiting'
    setStatus('waiting')
    highlightChord(0)
  }, [chords, highlightChord])

  const reset = useCallback(() => {
    chordIndexRef.current = 0
    statusRef.current = 'idle'
    setStatus('idle')
    setActiveNoteIds(new Set())
    setActiveNoteNames(new Map())
    setHintNoteIds(new Set())
    setCurrentMeasure(null)
  }, [])

  // Reset when song changes (e.g. hand filter or crop range changes)
  useEffect(() => {
    if (resetQueuedRef.current) return
    resetQueuedRef.current = true
    queueMicrotask(() => {
      resetQueuedRef.current = false
      reset()
    })
  }, [song, reset])

  return {
    status,
    activeNoteIds,
    activeNoteNames,
    hintNoteIds,
    currentMeasure,
    start,
    reset,
  }
}
