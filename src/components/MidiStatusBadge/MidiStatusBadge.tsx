import { Button } from '@/components/ui/button'
import type { MidiStatus } from '@/hooks/useMidi'

interface MidiStatusBadgeProps {
  status: MidiStatus
  onClick(): void
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      style={{ backgroundColor: color }}
      className="inline-block h-2 w-2 rounded-full"
      aria-hidden
    />
  )
}

export function MidiStatusBadge({ status, onClick }: MidiStatusBadgeProps) {
  let label: React.ReactNode
  let title: string

  switch (status) {
    case 'idle':
      label = 'MIDI'
      title = 'Click to connect a MIDI keyboard'
      break
    case 'requesting':
      label = 'Connecting…'
      title = 'Requesting MIDI access'
      break
    case 'connected':
      label = (
        <span className="flex items-center gap-1.5">
          <StatusDot color="oklch(0.6 0.2 145)" />
          MIDI: connected
        </span>
      )
      title = 'MIDI keyboard connected — click to toggle view'
      break
    case 'disconnected':
      label = 'MIDI: no device'
      title = 'No MIDI device detected — click to toggle view'
      break
    case 'unsupported':
      label = 'MIDI: unsupported'
      title = 'Web MIDI API not supported in this browser'
      break
    case 'permission-denied':
      label = 'MIDI: blocked'
      title = 'MIDI permission denied — check browser settings'
      break
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      title={title}
      disabled={status === 'requesting' || status === 'unsupported'}
      className="text-xs"
    >
      {label}
    </Button>
  )
}
