import { useRef, useState } from 'react'
import Soundfont from 'soundfont-player'
import { NOTE_FREQUENCIES } from '@/lib/audio'

export interface AudioEngine {
  playNote(noteName: string, durationMs: number, velocity?: number): void
  isReady: boolean
  samplesLoaded: boolean
}

export function useAudioEngine(): AudioEngine {
  const ctxRef = useRef<AudioContext | null>(null)
  const playerRef = useRef<Soundfont.Player | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const sfFailedRef = useRef(false)
  const [samplesLoaded, setSamplesLoaded] = useState(false)
  const [isReady, setIsReady] = useState(false)

  function getContext(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
      const gain = ctxRef.current.createGain()
      gain.gain.value = 0.7
      gain.connect(ctxRef.current.destination)
      masterGainRef.current = gain
      setIsReady(true)

      if (!sfFailedRef.current) {
        Soundfont.instrument(ctxRef.current, 'acoustic_grand_piano', {
          format: 'mp3',
          soundfont: 'MusyngKite',
        })
          .then((player) => {
            playerRef.current = player
            setSamplesLoaded(true)
          })
          .catch(() => {
            sfFailedRef.current = true
          })
      }
    }
    return ctxRef.current
  }

  function playSynth(
    ctx: AudioContext,
    freq: number,
    durationMs: number,
    velocity: number,
  ) {
    const master = masterGainRef.current!
    const gain = ctx.createGain()
    gain.connect(master)

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    osc.connect(gain)

    // Harmonic overtone at 2× frequency
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 2
    const gain2 = ctx.createGain()
    gain2.gain.value = 0.15
    osc2.connect(gain2)
    gain2.connect(master)

    const now = ctx.currentTime
    const peak = velocity / 127
    const release = 0.4
    const durationSec = durationMs / 1000

    // ADSR envelope
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(peak, now + 0.008)
    gain.gain.linearRampToValueAtTime(peak * 0.7, now + 0.008 + 0.12)
    gain.gain.setValueAtTime(peak * 0.7, now + durationSec)
    gain.gain.linearRampToValueAtTime(0, now + durationSec + release)

    osc.start(now)
    osc.stop(now + durationSec + release)
    osc2.start(now)
    osc2.stop(now + durationSec + release)
  }

  function playNote(noteName: string, durationMs: number, velocity = 80) {
    const ctx = getContext()

    if (playerRef.current && samplesLoaded) {
      playerRef.current.play(noteName, ctx.currentTime, {
        gain: velocity / 127,
        duration: durationMs / 1000,
      })
      return
    }

    const freq = NOTE_FREQUENCIES[noteName]
    if (freq) {
      playSynth(ctx, freq, durationMs, velocity)
    }
  }

  return { playNote, isReady, samplesLoaded }
}
