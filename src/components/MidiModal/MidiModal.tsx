import { useEffect, useRef } from 'react'
import { PianoKeyboard } from '@/components/PianoKeyboard'
import { useMidiContext } from '@/context/MidiContext'
import type { Hand } from '@/types'

const INFO_MESSAGES = {
  idle: 'Initializing…',
  requesting: 'Requesting MIDI access…',
  disconnected: 'Connect a MIDI keyboard and it will appear here.',
  unsupported:
    'Web MIDI API is not supported in this browser. Try Chrome or Edge.',
  'permission-denied':
    'MIDI permission was denied. Check your browser settings and reload the page.',
  connected: '',
}

export function MidiModal() {
  const { status, activeNotes, isModalOpen, closeModal } = useMidiContext()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isModalOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isModalOpen])

  // Close on backdrop click
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) closeModal()
  }

  const highlightedNotes =
    status === 'connected'
      ? Array.from(activeNotes).map((note) => ({
          note,
          hand: 'unknown' as Hand,
        }))
      : []

  return (
    <dialog
      ref={dialogRef}
      onClose={closeModal}
      onClick={handleDialogClick}
      className="bg-background m-auto w-full max-w-3xl rounded-xl border p-0 shadow-xl backdrop:bg-black/40 open:flex open:flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-medium">MIDI Keyboard</span>
        <button
          onClick={closeModal}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="py-4">
        {status === 'connected' ? (
          <PianoKeyboard highlightedNotes={highlightedNotes} />
        ) : (
          <p className="text-muted-foreground px-6 py-2 text-sm">
            {INFO_MESSAGES[status]}
          </p>
        )}
      </div>
    </dialog>
  )
}
