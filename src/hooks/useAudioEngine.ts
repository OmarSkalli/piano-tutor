import { useRef } from 'react'
import Soundfont from 'soundfont-player'

export interface AudioEngine {
  /** Call on first user gesture. Returns a promise that resolves when piano samples are ready. */
  prepare(): Promise<void>
  playNote(noteName: string, durationMs: number, velocity?: number): void
}

export function useAudioEngine(): AudioEngine {
  const ctxRef = useRef<AudioContext | null>(null)
  const playerRef = useRef<Soundfont.Player | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const preparePromiseRef = useRef<Promise<void> | null>(null)

  function prepare(): Promise<void> {
    if (preparePromiseRef.current) return preparePromiseRef.current

    const ctx = new AudioContext()
    ctxRef.current = ctx
    const gain = ctx.createGain()
    gain.gain.value = 0.7
    gain.connect(ctx.destination)
    masterGainRef.current = gain

    const promise = Soundfont.instrument(ctx, 'acoustic_grand_piano', {
      format: 'mp3',
      soundfont: 'MusyngKite',
      nameToUrl: () => '/soundfonts/MusyngKite/acoustic_grand_piano-mp3.js',
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

  return { prepare, playNote }
}
