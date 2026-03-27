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
    console.log('[audio] preload fetch start')
    fetch(SOUNDFONT_URL)
      .then((r) => console.log('[audio] preload fetch done', r.status))
      .catch((e) => console.error('[audio] preload fetch error', e))
      .finally(() => setIsPreloading(false))
  }, [])

  function prepare(): Promise<void> {
    if (preparePromiseRef.current) {
      console.log('[audio] prepare: already in progress / done')
      return preparePromiseRef.current
    }

    console.log('[audio] prepare: creating AudioContext')
    const ctx = new AudioContext()
    ctxRef.current = ctx
    console.log('[audio] AudioContext state:', ctx.state)
    const gain = ctx.createGain()
    gain.gain.value = 0.7
    gain.connect(ctx.destination)
    masterGainRef.current = gain

    // iOS creates AudioContext in 'suspended' state. We must call resume()
    // synchronously within the gesture (done here), but we also need to await
    // it before playing notes — so chain it into the prepare promise.
    console.log('[audio] resuming AudioContext (state:', ctx.state, ')')
    const resumePromise = ctx.resume().then(() => {
      console.log('[audio] AudioContext resumed — state:', ctx.state)
    })

    console.log('[audio] loading soundfont instrument')
    const promise = Promise.all([
      resumePromise,
      Soundfont.instrument(ctx, 'acoustic_grand_piano', {
        format: 'mp3',
        soundfont: 'MusyngKite',
        nameToUrl: () => SOUNDFONT_URL,
      }),
    ])
      .then(([, player]) => {
        console.log('[audio] ready — ctx state:', ctx.state)
        playerRef.current = player
      })
      .catch((e) => {
        console.error('[audio] prepare error', e)
        // Reset so the user can retry
        preparePromiseRef.current = null
        ctxRef.current = null
        playerRef.current = null
        throw e
      })

    preparePromiseRef.current = promise
    return promise
  }

  function playNote(noteName: string, durationMs: number, velocity = 80) {
    const ctx = ctxRef.current
    const player = playerRef.current
    console.log(
      '[audio] playNote',
      noteName,
      'ctx:',
      ctx?.state,
      'player:',
      !!player,
    )
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
