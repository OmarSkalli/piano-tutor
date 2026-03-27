import type { Hand } from '@/types'
import { BLACK_KEYS, WHITE_NOTES } from './constants'
import { normalizeNote } from './utils'

export interface HighlightedNote {
  note: string
  hand: Hand
}

export interface PianoKeyboardProps {
  highlightedNotes?: HighlightedNote[]
}

// Canonical key proportions (white key = 1 unit wide, 5 units tall)
const WHITE_KEY_ASPECT = 5
const BLACK_KEY_WIDTH_RATIO = 0.6 // relative to white key width
const BLACK_KEY_HEIGHT_RATIO = 0.62 // relative to white key height
const NUM_WHITE_KEYS = WHITE_NOTES.length

export function PianoKeyboard({ highlightedNotes = [] }: PianoKeyboardProps) {
  const highlightMap = new Map<string, Hand>()
  for (const { note, hand } of highlightedNotes) {
    highlightMap.set(normalizeNote(note), hand)
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
              return (
                <div
                  key={note}
                  style={{
                    position: 'absolute',
                    left: `${i * whiteKeyWidthPct}%`,
                    width: `calc(${whiteKeyWidthPct}% - 1px)`,
                    height: '100%',
                    backgroundColor: hand
                      ? hand === 'right'
                        ? 'var(--color-hand-right)'
                        : 'var(--color-hand-left)'
                      : 'white',
                    border: '1px solid #ccc',
                    borderRadius: '0 0 4px 4px',
                    boxSizing: 'border-box',
                  }}
                />
              )
            })}

            {/* Black keys */}
            {BLACK_KEYS.map(({ note, offset }) => {
              const hand = highlightMap.get(note)
              return (
                <div
                  key={note}
                  style={{
                    position: 'absolute',
                    left: `${offset * whiteKeyWidthPct}%`,
                    width: `${blackKeyWidthPct}%`,
                    height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
                    backgroundColor: hand
                      ? hand === 'right'
                        ? 'var(--color-hand-right)'
                        : 'var(--color-hand-left)'
                      : '#222',
                    borderRadius: '0 0 3px 3px',
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
