import { useCallback, useRef, useState } from 'react'
import type { AudioEngine } from './useAudioEngine'
import type { Hand, Song } from '@/types'
import { noteId } from '@/components/SheetMusic/utils'

export interface PlaybackState {
  isPlaying: boolean
  tempoRate: number
  /** Snapshot position in ms — updates on pause/seek for scrubber sync; use getPositionMs() for live 60fps reads */
  positionMs: number
  /** noteId → Hand, for SheetMusic highlighting */
  activeNoteIds: Set<string>
  /** note name → Hand, for PianoKeyboard highlighting */
  activeNoteNames: Map<string, Hand>
  play(): void
  pause(): void
  seek(ms: number): void
  setTempoRate(rate: number): void
  /** Returns the live playhead position in ms — read from rAF, not React state */
  getPositionMs(): number
}

export function usePlayback(
  song: Song,
  audioEngine: AudioEngine,
): PlaybackState {
  const [isPlaying, setIsPlaying] = useState(false)
  const [tempoRate, setTempoRateState] = useState(1)
  const [positionMs, setPositionMs] = useState(0)
  const [activeNoteIds, setActiveNoteIds] = useState<Set<string>>(new Set())
  const [activeNoteNames, setActiveNoteNames] = useState<Map<string, Hand>>(
    new Map(),
  )

  // Refs for values used inside timeouts/rAF (avoid stale closures)
  const isPlayingRef = useRef(false)
  const positionMsRef = useRef(0)
  const playStartRef = useRef(0) // Date.now() at start of current segment
  const tempoRateRef = useRef(1)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const rafRef = useRef(0)

  const getPositionMs = useCallback((): number => {
    if (!isPlayingRef.current) return positionMsRef.current
    const elapsed = (Date.now() - playStartRef.current) * tempoRateRef.current
    return Math.min(elapsed, song.durationMs)
  }, [song.durationMs])

  const clearAll = useCallback(() => {
    for (const t of timeoutsRef.current) clearTimeout(t)
    timeoutsRef.current = []
    cancelAnimationFrame(rafRef.current)
  }, [])

  const scheduleFrom = useCallback(
    (fromMs: number, rate: number) => {
      clearAll()
      setActiveNoteIds(new Set())
      setActiveNoteNames(new Map())

      // Anchor: playStartRef marks the wall-clock time corresponding to fromMs.
      // getPositionMs() computes: (Date.now() - playStartRef) * rate
      // At t=0: (playStartRef - playStartRef) * rate = 0 + fromMs ... need offset.
      // We store playStartRef such that elapsed * rate + fromMs would be wrong.
      // Correct: elapsed * rate = currentMs - fromMs, so currentMs = elapsed * rate + fromMs
      // But getPositionMs returns (Date.now() - playStartRef) * rate
      // So playStartRef = Date.now() - fromMs / rate
      playStartRef.current = Date.now() - fromMs / rate
      isPlayingRef.current = true
      setIsPlaying(true)

      audioEngine.prepare()

      for (let ti = 0; ti < song.tracks.length; ti++) {
        const track = song.tracks[ti]
        const hand = track.hand

        let realNoteIndex = 0
        for (let ni = 0; ni < track.notes.length; ni++) {
          const note = track.notes[ni]
          if (note.isRest) {
            continue
          }

          const id = noteId(ti, realNoteIndex++)

          // Skip notes that have already passed (but count their index above)
          if (note.startMs < fromMs) continue

          const noteName = note.name
          const delay = (note.startMs - fromMs) / rate

          const onT = setTimeout(
            () => {
              audioEngine.playNote(
                noteName,
                note.durationMs / rate,
                Math.round((note.velocity ?? 0.8) * 127),
              )
              setActiveNoteIds((prev) => new Set([...prev, id]))
              setActiveNoteNames((prev) => new Map(prev).set(noteName, hand))

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
              }, highlightDuration / rate)

              timeoutsRef.current.push(offT)
            },
            Math.max(0, delay),
          )

          timeoutsRef.current.push(onT)
        }
      }

      // Song-end reset
      const endT = setTimeout(
        () => {
          cancelAnimationFrame(rafRef.current)
          isPlayingRef.current = false
          positionMsRef.current = 0
          setIsPlaying(false)
          setPositionMs(0)
          setActiveNoteIds(new Set())
          setActiveNoteNames(new Map())
          timeoutsRef.current = []
        },
        (song.durationMs - fromMs) / rate,
      )
      timeoutsRef.current.push(endT)

      // rAF loop to keep positionMsRef current (read by getPositionMs)
      function tick() {
        if (!isPlayingRef.current) return
        positionMsRef.current =
          (Date.now() - playStartRef.current) * tempoRateRef.current
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [song, audioEngine, clearAll],
  )

  const play = useCallback(() => {
    if (isPlayingRef.current) return
    scheduleFrom(positionMsRef.current, tempoRateRef.current)
  }, [scheduleFrom])

  const pause = useCallback(() => {
    const pos = getPositionMs()
    positionMsRef.current = pos
    clearAll()
    isPlayingRef.current = false
    setIsPlaying(false)
    setPositionMs(pos)
  }, [clearAll, getPositionMs])

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, song.durationMs))
      positionMsRef.current = clamped
      setPositionMs(clamped)
      if (isPlayingRef.current) {
        scheduleFrom(clamped, tempoRateRef.current)
      }
    },
    [song.durationMs, scheduleFrom],
  )

  const setTempoRate = useCallback(
    (rate: number) => {
      const clamped = Math.max(0.25, Math.min(2, rate))
      tempoRateRef.current = clamped
      setTempoRateState(clamped)
      if (isPlayingRef.current) {
        positionMsRef.current = getPositionMs()
        scheduleFrom(positionMsRef.current, clamped)
      }
    },
    [getPositionMs, scheduleFrom],
  )

  return {
    isPlaying,
    tempoRate,
    positionMs,
    activeNoteIds,
    activeNoteNames,
    play,
    pause,
    seek,
    setTempoRate,
    getPositionMs,
  }
}
