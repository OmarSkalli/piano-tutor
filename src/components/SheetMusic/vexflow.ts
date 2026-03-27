import {
  Accidental,
  Annotation,
  AnnotationVerticalJustify,
  Beam,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
  VoiceMode,
} from 'vexflow'
import type { Hand, Song } from '@/types'
import { getAccidental, groupMeasures, noteId, toVFDur, toVFKey } from './utils'

export interface NoteRef {
  id: string
  hand: Hand
  svgEl: Element
}

export interface RenderOpts {
  showLabels: boolean
}

const MEASURES_PER_ROW = 2
const STAVE_HEIGHT = 100
const ROW_GAP = 20
// Vertical space between treble and bass staves in the same grand staff row
const GRAND_STAFF_GAP = 60
const MARGIN_LEFT = 10
const MARGIN_TOP = 20

export function renderSheet(
  container: HTMLElement,
  song: Song,
  opts: RenderOpts,
): NoteRef[] {
  container.innerHTML = ''

  const rightTrack =
    song.tracks.find((t) => t.hand === 'right') ?? song.tracks[0]
  const leftTrack =
    song.tracks.find((t) => t.hand === 'left') ??
    song.tracks[1] ??
    song.tracks[0]
  const rightTrackIndex = song.tracks.indexOf(rightTrack)
  const leftTrackIndex = song.tracks.indexOf(leftTrack)

  const beatsPerMeasure = song.timeSignature.numerator
  const rightMeasures = groupMeasures(rightTrack.notes, beatsPerMeasure)
  const leftMeasures = groupMeasures(leftTrack.notes, beatsPerMeasure)
  const totalMeasures = Math.max(rightMeasures.length, leftMeasures.length)
  const numRows = Math.ceil(totalMeasures / MEASURES_PER_ROW)

  const containerWidth = container.clientWidth || 900
  const staveWidth = Math.floor(
    (containerWidth - MARGIN_LEFT * 2) / MEASURES_PER_ROW,
  )
  const rowHeight = STAVE_HEIGHT + GRAND_STAFF_GAP + STAVE_HEIGHT + ROW_GAP
  const totalHeight = MARGIN_TOP + numRows * rowHeight

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(containerWidth, totalHeight)
  const ctx = renderer.getContext()

  // Accumulate note objects with their IDs for post-draw ref collection
  const pendingRefs: Array<{ vfNote: StaveNote; id: string; hand: Hand }> = []

  // Precompute note index offsets per measure
  const rightOffset = rightMeasures.map((_, mi) =>
    rightMeasures.slice(0, mi).reduce((s, m) => s + m.length, 0),
  )
  const leftOffset = leftMeasures.map((_, mi) =>
    leftMeasures.slice(0, mi).reduce((s, m) => s + m.length, 0),
  )

  function buildVFNote(
    clef: 'treble' | 'bass',
    noteName: string,
    noteDuration: import('@/types').NoteDuration,
    id: string,
    hand: Hand,
  ): StaveNote {
    const vfNote = new StaveNote({
      clef,
      keys: [toVFKey(noteName)],
      duration: toVFDur(noteDuration),
    })
    const acc = getAccidental(noteName)
    if (acc) vfNote.addModifier(new Accidental(acc), 0)
    if (opts.showLabels) {
      const label = noteName.replace(/\d+$/, '')
      const ann = new Annotation(label)
      ann.setVerticalJustification(AnnotationVerticalJustify.BOTTOM)
      vfNote.addModifier(ann, 0)
    }
    pendingRefs.push({ vfNote, id, hand })
    return vfNote
  }

  function drawMeasure(stave: Stave, vfNotes: StaveNote[], staveWidth: number) {
    if (vfNotes.length === 0) return
    const voice = new Voice({ numBeats: beatsPerMeasure, beatValue: 4 })
    voice.setMode(VoiceMode.SOFT)
    voice.addTickables(vfNotes)
    new Formatter().joinVoices([voice]).format([voice], staveWidth - 40)
    voice.draw(ctx, stave)
    Beam.generateBeams(vfNotes).forEach((b) => b.setContext(ctx).draw())
  }

  for (let row = 0; row < numRows; row++) {
    const y = MARGIN_TOP + row * rowHeight
    const bassY = y + STAVE_HEIGHT + GRAND_STAFF_GAP

    for (let col = 0; col < MEASURES_PER_ROW; col++) {
      const mi = row * MEASURES_PER_ROW + col
      if (mi >= totalMeasures) break

      const x = MARGIN_LEFT + col * staveWidth
      const isFirst = mi === 0
      const isRowStart = col === 0 && !isFirst

      const treble = new Stave(x, y, staveWidth)
      if (isFirst)
        treble
          .addClef('treble')
          .addTimeSignature(
            `${song.timeSignature.numerator}/${song.timeSignature.denominator}`,
          )
      else if (isRowStart) treble.addClef('treble')
      treble.setContext(ctx).draw()

      const bass = new Stave(x, bassY, staveWidth)
      if (isFirst)
        bass
          .addClef('bass')
          .addTimeSignature(
            `${song.timeSignature.numerator}/${song.timeSignature.denominator}`,
          )
      else if (isRowStart) bass.addClef('bass')
      bass.setContext(ctx).draw()

      const rightVF = (rightMeasures[mi] ?? []).map((note, ni) =>
        buildVFNote(
          'treble',
          note.name,
          note.noteDuration,
          noteId(rightTrackIndex, rightOffset[mi] + ni),
          'right',
        ),
      )
      const leftVF = (leftMeasures[mi] ?? []).map((note, ni) =>
        buildVFNote(
          'bass',
          note.name,
          note.noteDuration,
          noteId(leftTrackIndex, leftOffset[mi] + ni),
          'left',
        ),
      )

      drawMeasure(treble, rightVF, staveWidth)
      drawMeasure(bass, leftVF, staveWidth)
    }
  }

  // Collect SVG elements after all notes are drawn
  const noteRefs: NoteRef[] = []
  for (const { vfNote, id, hand } of pendingRefs) {
    const svgEl = vfNote.getSVGElement()
    if (svgEl) noteRefs.push({ id, hand, svgEl })
  }

  return noteRefs
}

export function highlightNotes(
  refs: NoteRef[],
  activeIds: Set<string>,
  rightColor: string,
  leftColor: string,
  defaultColor: string,
): void {
  for (const ref of refs) {
    const color = activeIds.has(ref.id)
      ? ref.hand === 'right'
        ? rightColor
        : leftColor
      : defaultColor
    colorElement(ref.svgEl, color)
  }
}

export function recolorAll(container: HTMLElement, color: string): void {
  container.querySelectorAll<SVGElement>('path, rect, text').forEach((el) => {
    el.style.fill = color
    el.style.stroke = color
  })
}

function colorElement(el: Element, color: string) {
  el.querySelectorAll<SVGElement>('path, rect, text').forEach((t) => {
    t.style.fill = color
    t.style.stroke = color
  })
  if (el.tagName === 'path' || el.tagName === 'rect' || el.tagName === 'text') {
    ;(el as SVGElement).style.fill = color
    ;(el as SVGElement).style.stroke = color
  }
}
