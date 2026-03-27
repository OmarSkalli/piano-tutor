import { useEffect, useRef, useState } from 'react'
import type { Hand } from '@/types'
import { BLACK_KEYS, WHITE_NOTES } from './constants'
import { normalizeNote } from './utils'

export interface HighlightedNote {
  note: string
  hand: Hand
}

export interface PianoKeyboardProps {
  highlightedNotes?: HighlightedNote[]
  onNotePress?(note: string): void
}

// Canonical key proportions (white key = 1 unit wide, 5 units tall)
const WHITE_KEY_ASPECT = 5
const BLACK_KEY_WIDTH_RATIO = 0.6 // relative to white key width
const BLACK_KEY_HEIGHT_RATIO = 0.62 // relative to white key height
const NUM_WHITE_KEYS = WHITE_NOTES.length
const PRESSED_HIGHLIGHT_MS = 180

export function PianoKeyboard({
  highlightedNotes = [],
  onNotePress,
}: PianoKeyboardProps) {
  const highlightMap = new Map<string, Hand>()
  for (const { note, hand } of highlightedNotes) {
    highlightMap.set(normalizeNote(note), hand)
  }
  const [pressedNotes, setPressedNotes] = useState<Set<string>>(new Set())
  const pressedTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  useEffect(() => {
    const pressedTimeouts = pressedTimeoutsRef.current
    return () => {
      for (const timeout of pressedTimeouts.values()) {
        clearTimeout(timeout)
      }
      pressedTimeouts.clear()
    }
  }, [])

  function flashPressedNote(note: string) {
    setPressedNotes((prev) => new Set(prev).add(note))

    const existingTimeout = pressedTimeoutsRef.current.get(note)
    if (existingTimeout) clearTimeout(existingTimeout)

    const timeout = setTimeout(() => {
      pressedTimeoutsRef.current.delete(note)
      setPressedNotes((prev) => {
        const next = new Set(prev)
        next.delete(note)
        return next
      })
    }, PRESSED_HIGHLIGHT_MS)

    pressedTimeoutsRef.current.set(note, timeout)
  }

  function handleNotePress(note: string) {
    flashPressedNote(note)
    onNotePress?.(note)
  }

  // Scale: fill available width, maintaining proportions
  // Use percentage-based widths so it's always correct
  const whiteKeyWidthPct = 100 / NUM_WHITE_KEYS
  const blackKeyWidthPct = whiteKeyWidthPct * BLACK_KEY_WIDTH_RATIO

  // Height is derived from aspect ratio: height = width / NUM_WHITE_KEYS * WHITE_KEY_ASPECT
  // We express this as a padding-top trick on the container
  const heightAsPct = (WHITE_KEY_ASPECT / NUM_WHITE_KEYS) * 100

  return (
    <div className="bg-background border-t px-6 py-4">
      {/* max-w caps the keyboard on wide screens; mx-auto centers it */}
      <div className="mx-auto w-full max-w-4xl">
        <div
          style={{
            position: 'relative',
            width: '100%',
            paddingTop: `${heightAsPct}%`,
          }}
          className="select-none"
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* White keys */}
            {WHITE_NOTES.map((note, i) => {
              const hand = highlightMap.get(note)
              const isPressed = pressedNotes.has(note)
              const backgroundColor = hand
                ? hand === 'right'
                  ? 'var(--color-hand-right)'
                  : 'var(--color-hand-left)'
                : isPressed
                  ? 'rgb(224 231 255)'
                  : 'white'
              return (
                <div
                  key={note}
                  onPointerDown={() => handleNotePress(note)}
                  style={{
                    position: 'absolute',
                    left: `${i * whiteKeyWidthPct}%`,
                    width: `calc(${whiteKeyWidthPct}% - 1px)`,
                    height: '100%',
                    backgroundColor,
                    border: '1px solid #ccc',
                    borderRadius: '0 0 4px 4px',
                    boxSizing: 'border-box',
                    cursor: onNotePress ? 'pointer' : 'default',
                  }}
                />
              )
            })}

            {/* Black keys */}
            {BLACK_KEYS.map(({ note, offset }) => {
              const hand = highlightMap.get(note)
              const isPressed = pressedNotes.has(note)
              const backgroundColor = hand
                ? hand === 'right'
                  ? 'var(--color-hand-right)'
                  : 'var(--color-hand-left)'
                : isPressed
                  ? 'rgb(99 102 241)'
                  : '#222'
              return (
                <div
                  key={note}
                  onPointerDown={() => handleNotePress(note)}
                  style={{
                    position: 'absolute',
                    left: `${offset * whiteKeyWidthPct}%`,
                    width: `${blackKeyWidthPct}%`,
                    height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
                    backgroundColor,
                    borderRadius: '0 0 3px 3px',
                    cursor: onNotePress ? 'pointer' : 'default',
                    zIndex: 1,
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
