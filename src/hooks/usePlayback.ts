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
  /** Playback progress 0–1; SheetMusic converts to px scroll offset */
  playbackProgress: number
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
  const [playbackProgress, setPlaybackProgress] = useState(0)

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const rafRef = useRef<number | null>(null)
  const startWallTimeRef = useRef<number>(0)

  const clearAll = useCallback(() => {
    for (const t of timeoutsRef.current) clearTimeout(t)
    timeoutsRef.current = []
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    if (isPlaying) return
    setIsPlaying(true)
    setActiveNoteIds(new Set())
    setActiveNoteNames(new Map())
    setPlaybackProgress(0)

    const startWall = Date.now()
    startWallTimeRef.current = startWall

    for (let ti = 0; ti < song.tracks.length; ti++) {
      const track = song.tracks[ti]
      const hand = track.hand

      for (let ni = 0; ni < track.notes.length; ni++) {
        const note = track.notes[ni]
        const id = noteId(ti, ni)
        const noteName = note.name

        const onT = setTimeout(() => {
          audioEngine.playNote(
            noteName,
            note.durationMs,
            Math.round(note.velocity * 127),
          )
          setActiveNoteIds((prev) => new Set([...prev, id]))
          setActiveNoteNames((prev) => new Map(prev).set(noteName, hand))

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
          }, note.durationMs)

          timeoutsRef.current.push(offT)
        }, note.startMs)

        timeoutsRef.current.push(onT)
      }
    }

    // Song-end reset
    const endT = setTimeout(() => {
      clearAll()
      setIsPlaying(false)
      setActiveNoteIds(new Set())
      setActiveNoteNames(new Map())
      setPlaybackProgress(0)
    }, song.durationMs)
    timeoutsRef.current.push(endT)

    // Progress via rAF — SheetMusic converts to px scroll offset
    const totalDuration = song.durationMs
    function tick() {
      const elapsed = Date.now() - startWallTimeRef.current
      if (elapsed >= totalDuration) return
      setPlaybackProgress(Math.min(elapsed / totalDuration, 1))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [isPlaying, song, audioEngine, clearAll])

  const pause = useCallback(() => {
    clearAll()
    setIsPlaying(false)
  }, [clearAll])

  return {
    isPlaying,
    activeNoteIds,
    activeNoteNames,
    playbackProgress,
    play,
    pause,
  }
}
