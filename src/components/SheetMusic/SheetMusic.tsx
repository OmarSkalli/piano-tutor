import { useCallback, useEffect, useRef } from 'react'
import type { Song } from '@/types'
import {
  getActiveInfo,
  highlightNotes,
  recolorAll,
  renderSheet,
  type MeasureBox,
  type NoteRef,
} from './vexflow'

export interface SheetMusicProps {
  song: Song
  activeNoteIds: Set<string>
  showLabels: boolean
  /** Raw key signature string from metadata e.g. "G major", "E minor" */
  keySignature?: string | null
  onMeasureClick?: (measureIndex: number) => void
  /** Measure to highlight when not playing (e.g. after a seek while paused) */
  selectedMeasure?: number | null
}

/** Convert "G major" → "G", "E minor" → "Em", "F# minor" → "F#m", etc. */
function toVFKeySpec(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/^([A-G][#b]?)\s*(major|minor)$/i)
  if (!m) return undefined
  const root = m[1]
  const isMinor = m[2].toLowerCase() === 'minor'
  return isMinor ? `${root}m` : root
}

export function SheetMusic({
  song,
  activeNoteIds,
  showLabels,
  keySignature,
  onMeasureClick,
  selectedMeasure,
}: SheetMusicProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const noteRefsRef = useRef<NoteRef[]>([])
  const measureBoxesRef = useRef<MeasureBox[]>([])
  // First measureBox per row — used for scroll targeting
  const rowBoxesRef = useRef<Map<number, MeasureBox>>(new Map())
  const highlightRectRef = useRef<SVGRectElement | null>(null)
  const lastScrolledRowRef = useRef(-1)

  const renderSheetCallback = useCallback(() => {
    if (!pageRef.current) return
    lastScrolledRowRef.current = -1

    const { noteRefs, measureBoxes } = renderSheet(pageRef.current, song, {
      showLabels,
      width: pageRef.current.clientWidth,
      keySignature: toVFKeySpec(keySignature),
    })
    noteRefsRef.current = noteRefs
    measureBoxesRef.current = measureBoxes

    // Index the first measureBox for each row for O(1) scroll targeting
    const rowBoxes = new Map<number, MeasureBox>()
    for (const ref of noteRefs) {
      if (!rowBoxes.has(ref.row)) {
        const box = measureBoxes.find(
          (b) => b.measureIndex === ref.measureIndex,
        )
        if (box) rowBoxes.set(ref.row, box)
      }
    }
    rowBoxesRef.current = rowBoxes

    recolorAll(pageRef.current, 'currentColor')

    // Create a persistent highlight rect in the SVG (inserted behind all notation)
    const svg = pageRef.current.querySelector('svg')
    highlightRectRef.current = null
    if (svg) {
      const rect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect',
      )
      rect.setAttribute('rx', '4')
      rect.style.fill = 'var(--color-measure-highlight, rgba(99,102,241,0.08))'
      rect.style.stroke = 'none'
      rect.style.display = 'none'
      rect.style.pointerEvents = 'none'
      svg.insertBefore(rect, svg.firstChild)
      highlightRectRef.current = rect
    }
  }, [song, showLabels, keySignature])

  // Re-render sheet when song or label toggle changes
  useEffect(() => {
    renderSheetCallback()
  }, [renderSheetCallback])

  // Re-render on container resize (orientation change, browser resize).
  // Observe the outer scrollable div — its width changes on resize but not
  // when the inner SVG height changes, avoiding a render feedback loop.
  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    let lastWidth = outer.clientWidth
    const observer = new ResizeObserver(() => {
      if (outer.clientWidth !== lastWidth) {
        lastWidth = outer.clientWidth
        renderSheetCallback()
      }
    })
    observer.observe(outer)
    return () => observer.disconnect()
  }, [renderSheetCallback])

  // Measure click/tap → seek
  useEffect(() => {
    const page = pageRef.current
    if (!page || !onMeasureClick) return

    function hitTest(clientX: number, clientY: number) {
      const svg = page!.querySelector('svg') as SVGSVGElement | null
      if (!svg) return
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const svgPt = pt.matrixTransform(ctm.inverse())
      const box = measureBoxesRef.current.find(
        (b) =>
          svgPt.x >= b.x &&
          svgPt.x <= b.x + b.width &&
          svgPt.y >= b.y &&
          svgPt.y <= b.y + b.height,
      )
      if (box) onMeasureClick!(box.measureIndex)
    }

    function handleClick(e: MouseEvent) {
      hitTest(e.clientX, e.clientY)
    }

    function handleTouchEnd(e: TouchEvent) {
      const touch = e.changedTouches[0]
      if (touch) hitTest(touch.clientX, touch.clientY)
    }

    page.addEventListener('click', handleClick)
    page.addEventListener('touchend', handleTouchEnd)
    return () => {
      page.removeEventListener('click', handleClick)
      page.removeEventListener('touchend', handleTouchEnd)
    }
  }, [song, showLabels, onMeasureClick])

  // Highlight active notes and update measure highlight rect
  useEffect(() => {
    const refs = noteRefsRef.current
    highlightNotes(
      refs,
      activeNoteIds,
      'var(--color-hand-right)',
      'var(--color-hand-left)',
      'currentColor',
    )

    const info = getActiveInfo(refs, activeNoteIds)
    const rect = highlightRectRef.current

    // Use active playback position, or fall back to selectedMeasure when paused
    const measureIndex = info?.measureIndex ?? selectedMeasure ?? null

    if (measureIndex === null || !rect) {
      if (rect) rect.style.display = 'none'
      return
    }

    const box = measureBoxesRef.current.find(
      (b) => b.measureIndex === measureIndex,
    )
    if (box) {
      rect.setAttribute('x', String(box.x))
      rect.setAttribute('y', String(box.y))
      rect.setAttribute('width', String(box.width))
      rect.setAttribute('height', String(box.height))
      rect.style.display = 'block'
    }

    const row =
      info?.row ??
      noteRefsRef.current.find((r) => r.measureIndex === measureIndex)?.row
    if (row !== undefined && row !== lastScrolledRowRef.current) {
      lastScrolledRowRef.current = row
      const outer = outerRef.current
      const page = pageRef.current
      const rowBox = rowBoxesRef.current.get(row)
      if (outer && page && rowBox) {
        // rowBox.y is in SVG/page space; scroll so the active row lands at ~60%
        // down the viewport, keeping the previous row visible above it.
        const pageTop =
          page.getBoundingClientRect().top +
          outer.scrollTop -
          outer.getBoundingClientRect().top
        const targetScrollY = pageTop + rowBox.y - outer.clientHeight * 0.4
        outer.scrollTo({ top: targetScrollY, behavior: 'smooth' })
      }
    }
  }, [activeNoteIds, selectedMeasure])

  return (
    <div
      ref={outerRef}
      className="h-full overflow-y-auto bg-gray-100 dark:bg-zinc-800"
    >
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div
          ref={pageRef}
          className={`rounded-sm bg-white shadow-md ring-1 ring-black/5 dark:bg-zinc-50${onMeasureClick ? 'cursor-pointer' : ''}`}
        />
      </div>
    </div>
  )
}
