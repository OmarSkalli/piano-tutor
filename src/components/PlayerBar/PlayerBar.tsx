import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Gauge, Pause, Piano, Play, Scissors } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AppMode = 'playback' | 'practice'
export type ActiveHand = 'left' | 'both' | 'right'
export interface CropRange {
  start: number
  end: number
}

export interface PlayerBarProps {
  title: string
  mode: AppMode
  // Playback props
  isPlaying: boolean
  isPreloading: boolean
  durationMs: number
  tempoRate: number
  /** Snapshot position in ms — used to sync scrubber when paused/seeking */
  positionMs: number
  // Practice props
  activeHand: ActiveHand
  cropRange: CropRange | null
  waitMode: boolean
  totalMeasures: number
  practiceStatus: 'idle' | 'waiting' | 'done'
  // Persistent toggles
  showLabels: boolean
  showPiano: boolean
  // Callbacks
  onModeChange(mode: AppMode): void
  onPlay(): void
  onPause(): void
  onPrepare(): void
  onSeek(ms: number): void
  onSetTempoRate(rate: number): void
  onActiveHandChange(hand: ActiveHand): void
  onCropRangeChange(range: CropRange | null): void
  onWaitModeToggle(): void
  onPracticeStart(): void
  onPracticeReset(): void
  onToggleLabels(): void
  onTogglePiano(): void
  getPositionMs(): number
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Divider() {
  return <div className="mx-2 h-4 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />
}

function activeToggleClass(isActive: boolean) {
  return isActive
    ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/15 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200'
    : ''
}

interface SegmentedOption<T extends string> {
  label: string
  value: T
  title?: string
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange(v: T): void
}) {
  return (
    <div className="flex shrink-0 items-center rounded-md border text-xs">
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          aria-pressed={value === o.value}
          className={cn(
            'px-2.5 py-1 font-medium transition-colors',
            i === 0 && 'rounded-l-md',
            i === options.length - 1 && 'rounded-r-md',
            value === o.value
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const HAND_OPTIONS: SegmentedOption<ActiveHand>[] = [
  { label: 'Left', value: 'left', title: 'Left hand only' },
  { label: 'Both', value: 'both', title: 'Both hands' },
  { label: 'Right', value: 'right', title: 'Right hand only' },
]

const MODE_OPTIONS: SegmentedOption<AppMode>[] = [
  { label: 'Playback', value: 'playback' },
  { label: 'Practice', value: 'practice' },
]

function CropPopover({
  cropRange,
  totalMeasures,
  onChange,
}: {
  cropRange: CropRange | null
  totalMeasures: number
  onChange(range: CropRange | null): void
}) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(cropRange?.start ?? 1)
  const [end, setEnd] = useState(cropRange?.end ?? totalMeasures)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function apply() {
    const s = Math.max(1, Math.min(start, totalMeasures))
    const e = Math.max(s, Math.min(end, totalMeasures))
    onChange(s === 1 && e === totalMeasures ? null : { start: s, end: e })
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setStart(1)
    setEnd(totalMeasures)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        variant="outline"
        size="icon"
        className={cn('h-7 w-7', activeToggleClass(cropRange !== null))}
        onClick={() => {
          if (!open) {
            setStart(cropRange?.start ?? 1)
            setEnd(cropRange?.end ?? totalMeasures)
          }
          setOpen((v) => !v)
        }}
        title="Set practice range"
        aria-label="Set practice range"
      >
        <Scissors className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="bg-background absolute top-9 right-0 z-50 w-64 rounded-lg border p-4 shadow-lg">
          <p className="mb-3 text-xs font-medium">Practice range</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="space-y-1.5">
              <span className="text-muted-foreground block">From</span>
              <input
                type="number"
                min={1}
                max={totalMeasures}
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
                className="w-full rounded border px-2 py-1 text-center tabular-nums"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-muted-foreground block">To</span>
              <input
                type="number"
                min={1}
                max={totalMeasures}
                value={end}
                onChange={(e) => setEnd(Number(e.target.value))}
                className="w-full rounded border px-2 py-1 text-center tabular-nums"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-1.5">
            <Button size="sm" className="h-6 flex-1 text-xs" onClick={apply}>
              Apply
            </Button>
            {cropRange !== null && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 flex-1 text-xs"
                onClick={clear}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function PlayerBar({
  title,
  mode,
  isPlaying,
  isPreloading,
  durationMs,
  tempoRate,
  positionMs,
  activeHand,
  cropRange,
  waitMode,
  totalMeasures,
  practiceStatus,
  showLabels,
  showPiano,
  onModeChange,
  onPlay,
  onPause,
  onPrepare,
  onSeek,
  onSetTempoRate,
  onActiveHandChange,
  onCropRangeChange,
  onWaitModeToggle,
  onPracticeStart,
  onPracticeReset,
  onToggleLabels,
  onTogglePiano,
  getPositionMs,
}: PlayerBarProps) {
  const scrubberRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (isPlaying || isDraggingRef.current) return
    if (scrubberRef.current) scrubberRef.current.value = String(positionMs)
    if (timeRef.current)
      timeRef.current.textContent = `${fmt(positionMs)} / ${fmt(durationMs)}`
  }, [positionMs, isPlaying, durationMs])

  useEffect(() => {
    if (!isPlaying) return
    let raf: number
    function tick() {
      const pos = getPositionMs()
      if (scrubberRef.current && !isDraggingRef.current)
        scrubberRef.current.value = String(pos)
      if (timeRef.current && !isDraggingRef.current)
        timeRef.current.textContent = `${fmt(pos)} / ${fmt(durationMs)}`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, getPositionMs, durationMs])

  return (
    <div className="shrink-0 border-b border-gray-200 px-4 py-2 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <Link to="/" aria-label="Back to library">
          <ChevronLeft className="h-4 w-4 shrink-0 text-gray-500 dark:text-zinc-400" />
        </Link>
        <h1 className="min-w-0 truncate text-sm font-semibold">{title}</h1>
        <SegmentedControl
          options={MODE_OPTIONS}
          value={mode}
          onChange={onModeChange}
        />

        <div className="flex-1" />

        <Divider />

        {mode === 'playback' ? (
          <>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={isPreloading}
                onMouseDown={isPlaying ? undefined : onPrepare}
                onTouchStart={isPlaying ? undefined : onPrepare}
                onClick={isPlaying ? onPause : onPlay}
                aria-label={
                  isPlaying ? 'Pause' : isPreloading ? 'Loading…' : 'Play'
                }
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : isPreloading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
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

            <Divider />

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

            <Divider />

            <SegmentedControl
              options={HAND_OPTIONS}
              value={activeHand}
              onChange={onActiveHandChange}
            />
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className={cn('h-7 text-xs', activeToggleClass(waitMode))}
              onClick={onWaitModeToggle}
              title="Wait for correct note before advancing"
            >
              Wait
            </Button>

            {waitMode && (
              <>
                <Divider />
                {practiceStatus === 'idle' || practiceStatus === 'done' ? (
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onPracticeStart}
                  >
                    {practiceStatus === 'done' ? 'Restart' : 'Start'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onPracticeReset}
                  >
                    Reset
                  </Button>
                )}
              </>
            )}

            <Divider />

            <SegmentedControl
              options={HAND_OPTIONS}
              value={activeHand}
              onChange={onActiveHandChange}
            />
          </>
        )}

        <Divider />

        <CropPopover
          cropRange={cropRange}
          totalMeasures={totalMeasures}
          onChange={onCropRangeChange}
        />

        <Divider />

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-7 w-7 text-xs font-bold',
              activeToggleClass(showLabels),
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
            className={cn('h-7 w-7', activeToggleClass(showPiano))}
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
