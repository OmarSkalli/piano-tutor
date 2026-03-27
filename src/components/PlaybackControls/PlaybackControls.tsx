import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface PlaybackControlsProps {
  isPlaying: boolean
  onPlay(): void
  onPause(): void
  /** Called on mousedown to start loading audio samples before play fires */
  onPrepare(): void
  showLabels: boolean
  onToggleLabels(): void
}

export function PlaybackControls({
  isPlaying,
  onPlay,
  onPause,
  onPrepare,
  showLabels,
  onToggleLabels,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onMouseDown={isPlaying ? undefined : onPrepare}
        onClick={isPlaying ? onPause : onPlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause /> : <Play />}
      </Button>
      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
        <input type="checkbox" checked={showLabels} onChange={onToggleLabels} />
        Note names
      </label>
    </div>
  )
}
