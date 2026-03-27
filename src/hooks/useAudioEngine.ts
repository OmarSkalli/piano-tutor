import { useEffect, useRef, useState } from 'react'

const NOTES_URL = '/soundfonts/MusyngKite/notes'

// All available notes in the soundfont
const SOUNDFONT_NOTES = [
  'A0',
  'Bb0',
  'B0',
  'C1',
  'Db1',
  'D1',
  'Eb1',
  'E1',
  'F1',
  'Gb1',
  'G1',
  'Ab1',
  'A1',
  'Bb1',
  'B1',
  'C2',
  'Db2',
  'D2',
  'Eb2',
  'E2',
  'F2',
  'Gb2',
  'G2',
  'Ab2',
  'A2',
  'Bb2',
  'B2',
  'C3',
  'Db3',
  'D3',
  'Eb3',
  'E3',
  'F3',
  'Gb3',
  'G3',
  'Ab3',
  'A3',
  'Bb3',
  'B3',
  'C4',
  'Db4',
  'D4',
  'Eb4',
  'E4',
  'F4',
  'Gb4',
  'G4',
  'Ab4',
  'A4',
  'Bb4',
  'B4',
  'C5',
  'Db5',
  'D5',
  'Eb5',
  'E5',
  'F5',
  'Gb5',
  'G5',
  'Ab5',
  'A5',
  'Bb5',
  'B5',
  'C6',
  'Db6',
  'D6',
  'Eb6',
  'E6',
  'F6',
  'Gb6',
  'G6',
  'Ab6',
  'A6',
  'Bb6',
  'B6',
  'C7',
  'Db7',
  'D7',
  'Eb7',
  'E7',
  'F7',
  'Gb7',
  'G7',
  'Ab7',
  'A7',
  'Bb7',
  'B7',
  'C8',
]

// Map note name to nearest available soundfont note (handles enharmonics like C# → Db)
const ENHARMONICS: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
}
function resolveNote(name: string): string {
  const match = name.match(/^([A-G])(#|b)?(\d)$/)
  if (!match) return name
  const [, letter, acc, oct] = match
  const pc = acc ? letter + acc : letter
  const resolved = ENHARMONICS[pc] ?? pc
  return resolved + oct
}

export interface AudioEngine {
  prepare(): Promise<void>
  playNote(noteName: string, durationMs: number, velocity?: number): void
  isPreloading: boolean
}

export function useAudioEngine(): AudioEngine {
  const ctxRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const resumedRef = useRef(false)
  const warmupPromiseRef = useRef<Promise<void> | null>(null)
  const [isPreloading, setIsPreloading] = useState(true)

  useEffect(() => {
    const ctx = new AudioContext()
    ctxRef.current = ctx
    console.log('[audio] warmup: decoding', SOUNDFONT_NOTES.length, 'notes')

    warmupPromiseRef.current = Promise.all(
      SOUNDFONT_NOTES.map(async (note) => {
        const filename = note.replace('#', 's') + '.mp3'
        const res = await fetch(`${NOTES_URL}/${filename}`)
        const arrayBuf = await res.arrayBuffer()
        const audioBuf = await ctx.decodeAudioData(arrayBuf)
        buffersRef.current.set(note, audioBuf)
      }),
    )
      .then(() => {
        console.log(
          '[audio] warmup done —',
          buffersRef.current.size,
          'buffers ready',
        )
      })
      .catch((e) => {
        console.error('[audio] warmup error', e)
        warmupPromiseRef.current = null
      })
      .finally(() => setIsPreloading(false))

    return () => {
      ctx.close()
      ctxRef.current = null
      buffersRef.current = new Map()
      warmupPromiseRef.current = null
      resumedRef.current = false
    }
  }, [])

  async function prepare(): Promise<void> {
    const ctx = ctxRef.current
    if (!ctx) return

    if (!resumedRef.current) {
      console.log('[audio] prepare: resuming (state:', ctx.state, ')')
      await ctx.resume()
      resumedRef.current = true
      console.log('[audio] prepare: resumed — state:', ctx.state)
    }

    if (warmupPromiseRef.current) {
      console.log('[audio] prepare: waiting for decode to finish')
      await warmupPromiseRef.current
    }
  }

  function playNote(noteName: string, durationMs: number, velocity = 80) {
    const ctx = ctxRef.current
    if (!ctx) return

    const resolved = resolveNote(noteName)
    const buffer = buffersRef.current.get(resolved)
    console.log(
      '[audio] playNote',
      noteName,
      '→',
      resolved,
      'ctx:',
      ctx.state,
      'buf:',
      !!buffer,
    )
    if (!buffer) return

    const gain = ctx.createGain()
    gain.gain.value = (velocity / 127) * 0.7
    gain.connect(ctx.destination)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(gain)
    source.start(ctx.currentTime)
    source.stop(ctx.currentTime + durationMs / 1000)
  }

  return { prepare, playNote, isPreloading }
}
