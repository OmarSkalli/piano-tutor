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

const WHITE_KEY_WIDTH = 32
const WHITE_KEY_HEIGHT = 120
const BLACK_KEY_WIDTH = 20
const BLACK_KEY_HEIGHT = 74

export function PianoKeyboard({ highlightedNotes = [] }: PianoKeyboardProps) {
  const highlightMap = new Map<string, Hand>()
  for (const { note, hand } of highlightedNotes) {
    highlightMap.set(normalizeNote(note), hand)
  }

  const totalWidth = WHITE_NOTES.length * WHITE_KEY_WIDTH

  return (
    <div className="overflow-x-auto py-3">
      <div
        style={{
          position: 'relative',
          width: totalWidth,
          height: WHITE_KEY_HEIGHT,
        }}
        className="select-none"
      >
        {/* White keys */}
        {WHITE_NOTES.map((note, i) => {
          const hand = highlightMap.get(note)
          return (
            <div
              key={note}
              style={{
                position: 'absolute',
                left: i * WHITE_KEY_WIDTH,
                width: WHITE_KEY_WIDTH - 1,
                height: WHITE_KEY_HEIGHT,
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
                left: offset * WHITE_KEY_WIDTH,
                width: BLACK_KEY_WIDTH,
                height: BLACK_KEY_HEIGHT,
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
  )
}
