import { useEffect, useRef, useState } from 'react'
import Soundfont from 'soundfont-player'

const SOUNDFONT_URL = '/soundfonts/MusyngKite/acoustic_grand_piano-mp3.js'

export interface AudioEngine {
  /** Call on first user gesture. Returns a promise that resolves when piano samples are ready. */
  prepare(): Promise<void>
  playNote(noteName: string, durationMs: number, velocity?: number): void
  /** True while the soundfont file is being fetched into cache on mount. */
  isPreloading: boolean
}

export function useAudioEngine(): AudioEngine {
  const ctxRef = useRef<AudioContext | null>(null)
  const playerRef = useRef<Soundfont.Player | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const preparePromiseRef = useRef<Promise<void> | null>(null)
  const [isPreloading, setIsPreloading] = useState(true)

  // Fetch the soundfont into the browser HTTP cache on mount so prepare() is fast
  useEffect(() => {
    fetch(SOUNDFONT_URL).finally(() => setIsPreloading(false))
  }, [])

  function prepare(): Promise<void> {
    if (preparePromiseRef.current) return preparePromiseRef.current

    const ctx = new AudioContext()
    ctxRef.current = ctx
    const gain = ctx.createGain()
    gain.gain.value = 0.7
    gain.connect(ctx.destination)
    masterGainRef.current = gain

    // iOS creates AudioContext in 'suspended' state. Call resume() synchronously
    // here (within the user gesture) to unlock it — the promise resolving async
    // is fine, but the *call* must happen in the gesture handler stack.
    if (ctx.state === 'suspended') ctx.resume()

    const promise = Soundfont.instrument(ctx, 'acoustic_grand_piano', {
      format: 'mp3',
      soundfont: 'MusyngKite',
      nameToUrl: () => SOUNDFONT_URL,
    }).then((player) => {
      playerRef.current = player
    })

    preparePromiseRef.current = promise
    return promise
  }

  function playNote(noteName: string, durationMs: number, velocity = 80) {
    const ctx = ctxRef.current
    const player = playerRef.current
    if (!ctx || !player) return

    player.play(noteName, ctx.currentTime, {
      gain: velocity / 127,
      duration: durationMs / 1000,
    })
  }

  useEffect(() => {
    return () => {
      playerRef.current?.stop()
      ctxRef.current?.close()
      ctxRef.current = null
      playerRef.current = null
      preparePromiseRef.current = null
    }
  }, [])

  return { prepare, playNote, isPreloading }
}
