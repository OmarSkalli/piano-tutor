import { useCallback, useEffect, useRef, useState } from 'react'

export type MidiStatus =
  | 'idle'
  | 'requesting'
  | 'connected'
  | 'disconnected'
  | 'unsupported'
  | 'permission-denied'

export interface MidiState {
  status: MidiStatus
  activeNotes: Set<string>
  requestAccess(): void
}

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

// Virtual/software ports that are always present on Linux (ALSA) even with no
// hardware connected. Matching by name is the only reliable way to exclude them.
const VIRTUAL_PORT_PATTERNS = [/midi through/i, /through port/i]

function isRealDevice(input: MIDIInput): boolean {
  if (input.state !== 'connected') return false
  return !VIRTUAL_PORT_PATTERNS.some((re) => re.test(input.name))
}

function midiToNoteName(n: number): string {
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`
}

export function useMidi(): MidiState {
  const [status, setStatus] = useState<MidiStatus>('idle')
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set())
  const accessRef = useRef<MIDIAccess | null>(null)

  const handleMessage = useCallback((event: MIDIMessageEvent) => {
    const [statusByte, noteNum, velocity] = Array.from(event.data)
    const cmd = statusByte & 0xf0
    const noteName = midiToNoteName(noteNum)

    if (cmd === 0x90 && velocity > 0) {
      setActiveNotes((prev) => {
        const next = new Set(prev)
        next.add(noteName)
        return next
      })
    } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      setActiveNotes((prev) => {
        const next = new Set(prev)
        next.delete(noteName)
        return next
      })
    }
  }, [])

  const attachPorts = useCallback(
    (access: MIDIAccess) => {
      for (const input of access.inputs.values()) {
        input.onmidimessage = isRealDevice(input) ? handleMessage : null
      }
      const hasDevice = Array.from(access.inputs.values()).some(isRealDevice)
      setStatus(hasDevice ? 'connected' : 'disconnected')
    },
    [handleMessage],
  )

  const requestAccess = useCallback(() => {
    if (!navigator.requestMIDIAccess) {
      setStatus('unsupported')
      return
    }
    setStatus('requesting')
    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        accessRef.current = access
        attachPorts(access)

        access.onstatechange = (event: MIDIConnectionEvent) => {
          if (event.port.type === 'input') {
            // Small delay so device is fully ready
            setTimeout(() => {
              if (accessRef.current) attachPorts(accessRef.current)
            }, 250)
          }
        }
      })
      .catch((err: Error) => {
        setStatus(
          err.name === 'SecurityError' ? 'permission-denied' : 'unsupported',
        )
      })
  }, [attachPorts])

  useEffect(() => {
    return () => {
      if (accessRef.current) {
        for (const input of accessRef.current.inputs.values()) {
          input.onmidimessage = null
        }
        accessRef.current.onstatechange = null
        accessRef.current = null
      }
    }
  }, [])

  return { status, activeNotes, requestAccess }
}
