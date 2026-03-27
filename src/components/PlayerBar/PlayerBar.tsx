import { useEffect, useRef } from 'react'
import { Gauge, Pause, Piano, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PlayerBarProps {
  title: string
  isPlaying: boolean
  durationMs: number
  tempoRate: number
  showLabels: boolean
  showPiano: boolean
  /** Snapshot position in ms — used to sync scrubber when paused/seeking */
  positionMs: number
  onPlay(): void
  onPause(): void
  onPrepare(): void
  onSeek(ms: number): void
  onSetTempoRate(rate: number): void
  onToggleLabels(): void
  onTogglePiano(): void
  getPositionMs(): number
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function PlayerBar({
  title,
  isPlaying,
  durationMs,
  tempoRate,
  showLabels,
  showPiano,
  positionMs,
  onPlay,
  onPause,
  onPrepare,
  onSeek,
  onSetTempoRate,
  onToggleLabels,
  onTogglePiano,
  getPositionMs,
}: PlayerBarProps) {
  const scrubberRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const isDraggingRef = useRef(false)

  // Sync scrubber when paused or seeking externally (e.g. measure click)
  useEffect(() => {
    if (isPlaying || isDraggingRef.current) return
    if (scrubberRef.current) scrubberRef.current.value = String(positionMs)
    if (timeRef.current)
      timeRef.current.textContent = `${fmt(positionMs)} / ${fmt(durationMs)}`
  }, [positionMs, isPlaying, durationMs])

  // Imperatively update scrubber and time display at 60fps while playing,
  // without causing React re-renders.
  useEffect(() => {
    if (!isPlaying) return
    let raf: number
    function tick() {
      const pos = getPositionMs()
      if (scrubberRef.current && !isDraggingRef.current) {
        scrubberRef.current.value = String(pos)
      }
      if (timeRef.current && !isDraggingRef.current) {
        timeRef.current.textContent = `${fmt(pos)} / ${fmt(durationMs)}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, getPositionMs, durationMs])

  return (
    <div className="shrink-0 border-b border-gray-200 px-4 py-2 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        {/* Title */}
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </h1>

        <div className="mx-2 h-4 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />

        {/* Playback: play/pause, time, scrubber */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onMouseDown={isPlaying ? undefined : onPrepare}
            onTouchStart={isPlaying ? undefined : onPrepare}
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
          <span
            ref={timeRef}
            className="shrink-0 font-mono text-xs text-gray-600 tabular-nums dark:text-zinc-400"
          >
            {fmt(0)} / {fmt(durationMs)}
          </span>
          <input
            ref={scrubberRef}
            type="range"
            min={0}
            max={durationMs}
            step={100}
            defaultValue={0}
            className="h-1.5 w-24 cursor-pointer accent-indigo-500"
            onMouseDown={() => {
              isDraggingRef.current = true
            }}
            onTouchStart={() => {
              isDraggingRef.current = true
            }}
            onChange={(e) => {
              if (timeRef.current) {
                const pos = Number(e.target.value)
                timeRef.current.textContent = `${fmt(pos)} / ${fmt(durationMs)}`
              }
            }}
            onMouseUp={(e) => {
              isDraggingRef.current = false
              const ms = Number((e.target as HTMLInputElement).value)
              onSeek(ms)
              if (timeRef.current)
                timeRef.current.textContent = `${fmt(ms)} / ${fmt(durationMs)}`
            }}
            onTouchEnd={(e) => {
              isDraggingRef.current = false
              const ms = Number((e.target as HTMLInputElement).value)
              onSeek(ms)
              if (timeRef.current)
                timeRef.current.textContent = `${fmt(ms)} / ${fmt(durationMs)}`
            }}
          />
        </div>

        <div className="mx-2 h-4 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />

        {/* Tempo */}
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400">
          <Gauge className="h-3.5 w-3.5 shrink-0" />
          <input
            type="range"
            min={25}
            max={200}
            step={5}
            value={Math.round(tempoRate * 100)}
            onChange={(e) => onSetTempoRate(Number(e.target.value) / 100)}
            className="w-16 cursor-pointer accent-indigo-500"
          />
          <span className="w-9 tabular-nums">
            {Math.round(tempoRate * 100)}%
          </span>
        </div>

        <div className="mx-2 h-4 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />

        {/* Toggle buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-7 w-7 text-xs font-bold',
              showLabels && 'bg-accent',
            )}
            onClick={onToggleLabels}
            aria-label={showLabels ? 'Hide note names' : 'Show note names'}
            title="Toggle note names"
          >
            A
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn('h-7 w-7', showPiano && 'bg-accent')}
            onClick={onTogglePiano}
            aria-label={showPiano ? 'Hide piano' : 'Show piano'}
            title="Toggle piano"
          >
            <Piano className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
