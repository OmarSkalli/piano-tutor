import { useEffect, useRef, useState } from 'react'
import type { Song } from '@/types'
import {
  highlightNotes,
  recolorAll,
  renderSheet,
  type NoteRef,
} from './vexflow'

export interface SheetMusicProps {
  song: Song
  activeNoteIds: Set<string>
  showLabels: boolean
  /** Playback progress 0–1; drives horizontal scroll to keep active note at ~28% from left */
  playbackProgress: number
}

export function SheetMusic({
  song,
  activeNoteIds,
  showLabels,
  playbackProgress,
}: SheetMusicProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const noteRefsRef = useRef<NoteRef[]>([])
  const [sheetDimensions, setSheetDimensions] = useState({
    sheetWidth: 0,
    viewportWidth: 0,
  })

  // Re-render sheet when song or label toggle changes; capture dimensions after draw
  useEffect(() => {
    if (!containerRef.current || !outerRef.current) return
    const refs = renderSheet(containerRef.current, song, { showLabels })
    noteRefsRef.current = refs
    recolorAll(containerRef.current, 'currentColor')
    setSheetDimensions({
      sheetWidth: containerRef.current.scrollWidth,
      viewportWidth: outerRef.current.clientWidth,
    })
  }, [song, showLabels])

  // Highlight active notes directly in DOM — no React re-render
  useEffect(() => {
    highlightNotes(
      noteRefsRef.current,
      activeNoteIds,
      'var(--color-hand-right)',
      'var(--color-hand-left)',
      'currentColor',
    )
  }, [activeNoteIds])

  // Active note stays at ~28% from left as sheet scrolls
  const maxScroll = Math.max(
    0,
    sheetDimensions.sheetWidth - sheetDimensions.viewportWidth * 0.72,
  )
  const scrollOffset = playbackProgress * maxScroll

  return (
    <div ref={outerRef} className="h-full overflow-hidden">
      <div
        ref={containerRef}
        style={{
          transform: `translateX(-${scrollOffset}px)`,
          transition: 'transform 0.1s linear',
        }}
      />
    </div>
  )
}
