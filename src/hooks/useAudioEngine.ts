import { useEffect, useRef, useState } from 'react'
import Soundfont from 'soundfont-player'

const SOUNDFONT_URL = '/soundfonts/MusyngKite/acoustic_grand_piano-mp3.js'

export interface AudioEngine {
  /** Call on first user gesture to unlock the AudioContext. */
  prepare(): Promise<void>
  playNote(noteName: string, durationMs: number, velocity?: number): void
  /** True while audio samples are being decoded on mount. */
  isPreloading: boolean
}

export function useAudioEngine(): AudioEngine {
  const ctxRef = useRef<AudioContext | null>(null)
  const playerRef = useRef<Soundfont.Player | null>(null)
  const resumedRef = useRef(false)
  const warmupPromiseRef = useRef<Promise<void> | null>(null)
  const [isPreloading, setIsPreloading] = useState(true)

  // Create AudioContext and decode all samples on mount — no gesture needed for
  // this part. Only ctx.resume() requires a gesture, which happens in prepare().
  useEffect(() => {
    const ctx = new AudioContext()
    ctxRef.current = ctx
    console.log('[audio] warmup: created AudioContext, state:', ctx.state)

    warmupPromiseRef.current = Soundfont.instrument(
      ctx,
      'acoustic_grand_piano',
      {
        format: 'mp3',
        soundfont: 'MusyngKite',
        nameToUrl: () => SOUNDFONT_URL,
      },
    )
      .then((player) => {
        console.log('[audio] warmup done — ctx state:', ctx.state)
        playerRef.current = player
      })
      .catch((e) => {
        console.error('[audio] warmup error', e)
        warmupPromiseRef.current = null
      })
      .finally(() => setIsPreloading(false))

    return () => {
      playerRef.current?.stop()
      ctx.close()
      ctxRef.current = null
      playerRef.current = null
      warmupPromiseRef.current = null
      resumedRef.current = false
    }
  }, [])

  // Called on first user gesture — resumes the AudioContext (required by browsers)
  // and waits for sample decoding to finish if still in progress.
  async function prepare(): Promise<void> {
    const ctx = ctxRef.current
    if (!ctx) return

    if (!resumedRef.current) {
      console.log(
        '[audio] prepare: resuming AudioContext (state:',
        ctx.state,
        ')',
      )
      await ctx.resume()
      resumedRef.current = true
      console.log('[audio] prepare: resumed — state:', ctx.state)
    }

    if (warmupPromiseRef.current) {
      console.log('[audio] prepare: waiting for warmup to finish')
      await warmupPromiseRef.current
      console.log('[audio] prepare: warmup done')
    }
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

  return { prepare, playNote, isPreloading }
}
