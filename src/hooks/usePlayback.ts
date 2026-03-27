import { useCallback, useRef, useState } from 'react'
import type { AudioEngine } from './useAudioEngine'
import type { Hand, Song } from '@/types'
import { noteId } from '@/components/SheetMusic/utils'

export interface PlaybackState {
  isPlaying: boolean
  /** noteId → Hand, for SheetMusic highlighting */
  activeNoteIds: Set<string>
  /** note name → Hand, for PianoKeyboard highlighting */
  activeNoteNames: Map<string, Hand>
  play(): void
  pause(): void
}

export function usePlayback(
  song: Song,
  audioEngine: AudioEngine,
): PlaybackState {
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeNoteIds, setActiveNoteIds] = useState<Set<string>>(new Set())
  const [activeNoteNames, setActiveNoteNames] = useState<Map<string, Hand>>(
    new Map(),
  )

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAll = useCallback(() => {
    for (const t of timeoutsRef.current) clearTimeout(t)
    timeoutsRef.current = []
  }, [])

  const play = useCallback(() => {
    if (isPlaying) return
    setIsPlaying(true)
    setActiveNoteIds(new Set())
    setActiveNoteNames(new Map())

    // Start the song clock now (anchored to the user gesture), then kick off
    // sample loading. Notes fire at their note.startMs offsets from playStart.
    // playNote silently no-ops if samples aren't ready yet — but prepare() is
    // fast on subsequent plays since the promise is cached.
    const playStart = Date.now()
    audioEngine.prepare()

    for (let ti = 0; ti < song.tracks.length; ti++) {
      const track = song.tracks[ti]
      const hand = track.hand

      let realNoteIndex = 0
      for (let ni = 0; ni < track.notes.length; ni++) {
        const note = track.notes[ni]
        if (note.isRest) continue

        const id = noteId(ti, realNoteIndex++)
        const noteName = note.name
        const delay = note.startMs - (Date.now() - playStart)

        const onT = setTimeout(
          () => {
            audioEngine.playNote(
              noteName,
              note.durationMs,
              Math.round((note.velocity ?? 0.8) * 127),
            )
            setActiveNoteIds((prev) => new Set([...prev, id]))
            setActiveNoteNames((prev) => new Map(prev).set(noteName, hand))

            // Use the gap to the next note's startMs as the highlight duration
            // so staccato notes don't flash off immediately.
            const nextNote = track.notes.slice(ni + 1).find((n) => !n.isRest)
            const highlightDuration = nextNote
              ? nextNote.startMs - note.startMs
              : note.durationMs
            const offT = setTimeout(() => {
              setActiveNoteIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
              })
              setActiveNoteNames((prev) => {
                const next = new Map(prev)
                next.delete(noteName)
                return next
              })
            }, highlightDuration)

            timeoutsRef.current.push(offT)
          },
          Math.max(0, delay),
        )

        timeoutsRef.current.push(onT)
      }
    }

    // Song-end reset
    const endT = setTimeout(() => {
      clearAll()
      setIsPlaying(false)
      setActiveNoteIds(new Set())
      setActiveNoteNames(new Map())
    }, song.durationMs)
    timeoutsRef.current.push(endT)
  }, [isPlaying, song, audioEngine, clearAll])

  const pause = useCallback(() => {
    clearAll()
    setIsPlaying(false)
  }, [clearAll])

  return { isPlaying, activeNoteIds, activeNoteNames, play, pause }
}
