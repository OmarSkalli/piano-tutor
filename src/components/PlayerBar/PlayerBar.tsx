import { useEffect, useRef } from 'react'
import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface PlayerBarProps {
  isPlaying: boolean
  durationMs: number
  tempoRate: number
  showLabels: boolean
  /** Snapshot position in ms — used to sync scrubber when paused/seeking */
  positionMs: number
  onPlay(): void
  onPause(): void
  onPrepare(): void
  onSeek(ms: number): void
  onSetTempoRate(rate: number): void
  onToggleLabels(): void
  getPositionMs(): number
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function PlayerBar({
  isPlaying,
  durationMs,
  tempoRate,
  showLabels,
  positionMs,
  onPlay,
  onPause,
  onPrepare,
  onSeek,
  onSetTempoRate,
  onToggleLabels,
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
    <div className="shrink-0 border-b border-gray-200 px-6 py-3 dark:border-zinc-700">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          onMouseDown={isPlaying ? undefined : onPrepare}
          onClick={isPlaying ? onPause : onPlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>

        <span
          ref={timeRef}
          className="shrink-0 font-mono text-sm text-gray-600 tabular-nums dark:text-zinc-400"
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
          className="h-1.5 flex-1 cursor-pointer accent-indigo-500"
          onMouseDown={() => {
            isDraggingRef.current = true
          }}
          onTouchStart={() => {
            isDraggingRef.current = true
          }}
          onChange={(e) => {
            // Update time display while dragging without seeking
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

        <label className="flex shrink-0 items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
          <span>Speed</span>
          <input
            type="range"
            min={25}
            max={200}
            step={5}
            value={Math.round(tempoRate * 100)}
            onChange={(e) => onSetTempoRate(Number(e.target.value) / 100)}
            className="w-24 cursor-pointer accent-indigo-500"
          />
          <span className="w-10 tabular-nums">
            {Math.round(tempoRate * 100)}%
          </span>
        </label>

        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={onToggleLabels}
          />
          Note names
        </label>
      </div>
    </div>
  )
}
