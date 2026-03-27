import type { NoteDuration } from '../types'

const NOTE_DURATIONS: { name: NoteDuration; beats: number }[] = [
  { name: 'whole', beats: 4 },
  { name: 'half', beats: 2 },
  { name: 'quarter', beats: 1 },
  { name: 'eighth', beats: 0.5 },
  { name: 'sixteenth', beats: 0.25 },
  { name: 'thirty-second', beats: 0.125 },
]

export function quantizeNoteDuration(
  durationTicks: number,
  ticksPerQuarter: number,
): NoteDuration {
  const beats = durationTicks / ticksPerQuarter
  return NOTE_DURATIONS.reduce((best, d) =>
    Math.abs(d.beats - beats) < Math.abs(best.beats - beats) ? d : best,
  ).name
}
