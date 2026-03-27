import {
  Accidental,
  Beam,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
  VoiceMode,
} from 'vexflow'
import type { Hand, Note, Song } from '@/types'
import { getAccidental, groupMeasures, noteId, toVFDur, toVFKey } from './utils'

export interface NoteRef {
  id: string
  hand: Hand
  svgEls: Element[]
  /** Row index this note belongs to — used for auto-scroll */
  row: number
  measureIndex: number
}

export interface MeasureBox {
  measureIndex: number
  /** SVG coordinates of the combined grand-staff column (treble top → bass bottom) */
  x: number
  y: number
  width: number
  height: number
}

export interface SheetRefs {
  noteRefs: NoteRef[]
  measureBoxes: MeasureBox[]
}

export interface RenderOpts {
  showLabels: boolean
  hintNoteIds?: Set<string>
  width: number
  /** VexFlow key spec e.g. "G", "Em", "Bb" — converted from metadata before passing in */
  keySignature?: string
}

const MARGIN_H = 48
const MARGIN_TOP = 48
// Labels sit above treble / below bass (TOP/BOTTOM justify), so they don't
// compress the inter-stave gap — GRAND_STAFF_GAP stays fixed regardless.
const GRAND_STAFF_GAP = 44
const SYSTEM_GAP_WITH_LABELS = 56

// Standard rest positions for each clef (per engraving convention)
const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const

export function renderSheet(
  container: HTMLElement,
  song: Song,
  opts: RenderOpts,
): SheetRefs {
  container.innerHTML = ''

  const rightTrack =
    song.tracks.find((t) => t.hand === 'right') ?? song.tracks[0]
  const leftTrack =
    song.tracks.find((t) => t.hand === 'left') ??
    song.tracks[1] ??
    song.tracks[0]
  const rightTrackIndex = song.tracks.indexOf(rightTrack)
  const leftTrackIndex = song.tracks.indexOf(leftTrack)

  // Notes are pre-grouped by measureIndex — no timing math needed here
  const rightMeasures = groupMeasures(rightTrack.notes)
  const leftMeasures = groupMeasures(leftTrack.notes)
  const totalMeasures = Math.max(rightMeasures.length, leftMeasures.length)

  // Build a per-measure time signature lookup from timeSignatureChanges.
  // Each entry maps the first measure of that section → { numerator, denominator }.
  const timeSigChanges = song.timeSignatureChanges ?? [
    {
      tick: 0,
      numerator: song.timeSignature.numerator,
      denominator: song.timeSignature.denominator,
    },
  ]

  // For each section, compute its starting measureIndex using the same formula as process-song.ts
  const tpq = song.ticksPerQuarter
  interface SectionSig {
    measureIndex: number
    numerator: number
    denominator: number
  }
  const sectionSigs: SectionSig[] = []
  for (let i = 0; i < timeSigChanges.length; i++) {
    const { tick, numerator, denominator } = timeSigChanges[i]
    let measureIndex = 0
    if (i > 0) {
      const prev = timeSigChanges[i - 1]
      const prevTpm = Math.round(tpq * prev.numerator * (4 / prev.denominator))
      measureIndex =
        sectionSigs[i - 1].measureIndex +
        Math.round((tick - prev.tick) / prevTpm)
    }
    sectionSigs.push({ measureIndex, numerator, denominator })
  }

  /** Return the time signature in effect for a given measureIndex. */
  function timeSigForMeasure(mi: number): {
    numerator: number
    denominator: number
  } {
    let result = sectionSigs[0]
    for (const s of sectionSigs) {
      if (s.measureIndex > mi) break
      result = s
    }
    return result
  }

  function beamGroupsForMeasure(
    mi: number,
  ): ReturnType<typeof Beam.getDefaultBeamGroups> {
    const { numerator, denominator } = timeSigForMeasure(mi)
    // 2/2 default is 1/2 (groups of 4 eighths) — too coarse for sparse eighth
    // passages. Use 1/4 (quarter-note groups) like 4/4 so pairs of eighths beam.
    if (numerator === 2 && denominator === 2) {
      return Beam.getDefaultBeamGroups('4/4')
    }
    return Beam.getDefaultBeamGroups(`${numerator}/${denominator}`)
  }

  const timeSigStr = `${song.timeSignature.numerator}/${song.timeSignature.denominator}`

  const containerWidth = opts.width || 900
  const usableWidth = containerWidth - MARGIN_H * 2
  const keySig = opts.keySignature

  // Precompute real-note index offsets per measure (rests don't count)
  const rightOffset = rightMeasures.map((_, mi) =>
    rightMeasures
      .slice(0, mi)
      .reduce((s, m) => s + m.filter((n) => !n.isRest).length, 0),
  )
  const leftOffset = leftMeasures.map((_, mi) =>
    leftMeasures
      .slice(0, mi)
      .reduce((s, m) => s + m.filter((n) => !n.isRest).length, 0),
  )

  // Keep row spacing stable whether labels are visible or not so grand staffs
  // do not jump closer together when note names are hidden.
  const trebleStaveH = 40
  const bassStaveH = 40
  const rowHeight =
    trebleStaveH + GRAND_STAFF_GAP + bassStaveH + SYSTEM_GAP_WITH_LABELS

  // ── Pre-pass: measure the minimum width each measure needs ──────────────────
  // We build voices for each measure, ask the Formatter for the minimum note-area
  // width, then add stave modifier overhead to get the total minimum stave width.

  function addStaveModifiers(
    stave: Stave,
    clef: 'treble' | 'bass',
    isFirstMeasure: boolean,
    isRowStart: boolean,
    mi: number,
  ) {
    if (isFirstMeasure) {
      stave.addClef(clef).addTimeSignature(timeSigStr)
      if (keySig) stave.addKeySignature(keySig)
    } else if (isRowStart) {
      stave.addClef(clef)
      if (keySig) stave.addKeySignature(keySig)
    }
    // Show measure number on treble stave only, at the start of each row
    if (clef === 'treble' && (isFirstMeasure || isRowStart)) {
      stave.setMeasure(mi + 1)
    }
  }

  // getNoteStartX() only works after draw(); probe a throwaway stave to get the
  // clef/timesig/keysig overhead width without polluting the real canvas.
  function modifierOverhead(isFirst: boolean, isRowStart: boolean): number {
    const probe = new Stave(0, 0, 1000)
    addStaveModifiers(probe, 'treble', isFirst, isRowStart, 0)
    const tmp = document.createElement('div')
    const tmpR = new Renderer(tmp, Renderer.Backends.SVG)
    tmpR.resize(2000, 200)
    probe.setContext(tmpR.getContext()).draw()
    return probe.getNoteStartX() - probe.getX()
  }

  // Cache: first measure has clef+timesig+keysig, row-start has clef+keysig, rest plain
  const overheadFirst = modifierOverhead(true, true)
  const overheadRowStart = modifierOverhead(false, true)
  const overheadPlain = modifierOverhead(false, false)

  // Minimum note-area width for each measure (using both voices together)
  function measureMinNoteWidth(mi: number): number {
    const rightNotes = (rightMeasures[mi] ?? []).map((note) => {
      const dur = toVFDur(note.noteDuration)
      return note.isRest
        ? new StaveNote({
            clef: 'treble',
            keys: [REST_KEY.treble],
            duration: dur + 'r',
          })
        : new StaveNote({
            clef: 'treble',
            keys: [toVFKey(note.name)],
            duration: dur,
          })
    })
    const leftNotes = (leftMeasures[mi] ?? []).map((note) => {
      const dur = toVFDur(note.noteDuration)
      return note.isRest
        ? new StaveNote({
            clef: 'bass',
            keys: [REST_KEY.bass],
            duration: dur + 'r',
          })
        : new StaveNote({
            clef: 'bass',
            keys: [toVFKey(note.name)],
            duration: dur,
          })
    })
    const { numerator: num, denominator: den } = timeSigForMeasure(mi)
    const voices: Voice[] = []
    if (rightNotes.length > 0) {
      const v = new Voice({ numBeats: num, beatValue: den })
      v.setMode(VoiceMode.SOFT).addTickables(rightNotes)
      voices.push(v)
    }
    if (leftNotes.length > 0) {
      const v = new Voice({ numBeats: num, beatValue: den })
      v.setMode(VoiceMode.SOFT).addTickables(leftNotes)
      voices.push(v)
    }
    if (voices.length === 0) return 60 // empty measure: just needs barlines
    const fmt = new Formatter()
    fmt.joinVoices(voices)
    return fmt.preCalculateMinTotalWidth(voices)
  }

  // Minimum total stave width per measure (note width + modifier overhead)
  // The overhead depends on position, so we compute it per-measure during packing.
  // We precompute note widths independently of position.
  const noteMinWidths: number[] = Array.from(
    { length: totalMeasures },
    (_, mi) => measureMinNoteWidth(mi),
  )

  // Greedy row packing: fit as many measures as possible without exceeding usableWidth,
  // with a minimum of 1 and a comfortable padding factor so notes aren't edge-to-edge.
  const PADDING_FACTOR = 1.2 // multiply min width to give notes breathing room
  const rows: number[][] = [] // rows[row] = [mi, mi, ...]
  let currentRow: number[] = []
  let currentWidth = 0

  for (let mi = 0; mi < totalMeasures; mi++) {
    const isFirst = mi === 0
    const isRowStart = currentRow.length === 0
    const overhead = isFirst
      ? overheadFirst
      : isRowStart
        ? overheadRowStart
        : overheadPlain
    const needed = noteMinWidths[mi] * PADDING_FACTOR + overhead

    if (currentRow.length > 0 && currentWidth + needed > usableWidth) {
      rows.push(currentRow)
      currentRow = []
      currentWidth = 0
    }
    currentRow.push(mi)
    currentWidth += needed
  }
  if (currentRow.length > 0) rows.push(currentRow)

  const numRows = rows.length
  const totalHeight = MARGIN_TOP + numRows * rowHeight + MARGIN_TOP

  const renderer = new Renderer(
    container as HTMLDivElement,
    Renderer.Backends.SVG,
  )
  renderer.resize(containerWidth, totalHeight)
  const ctx = renderer.getContext()

  const pendingRefs: Array<{
    vfNote: StaveNote
    id: string
    hand: Hand
    row: number
    measureIndex: number
  }> = []
  const pendingLabels: Array<{
    vfNote: StaveNote
    label: string
    id: string
  }> = []
  // Per-row stave references, set during the draw loop, used for label Y positioning
  const rowStaves: Array<{ treble: Stave; bass: Stave }> = []
  const measureBoxes: MeasureBox[] = []

  function buildVFNote(
    clef: 'treble' | 'bass',
    note: Note,
    id: string,
    hand: Hand,
    row: number,
    mi: number,
  ): StaveNote {
    const restKey = REST_KEY[clef]
    const dur = toVFDur(note.noteDuration)
    const vfNote = note.isRest
      ? new StaveNote({ clef, keys: [restKey], duration: dur + 'r' })
      : new StaveNote({ clef, keys: [toVFKey(note.name)], duration: dur })

    if (note.isRest && note.noteDuration === 'whole') {
      vfNote.setCenterAlignment(true)
    }

    if (!note.isRest) {
      const acc = getAccidental(note.name)
      if (acc) vfNote.addModifier(new Accidental(acc), 0)
      if (opts.showLabels || opts.hintNoteIds?.has(id)) {
        pendingLabels.push({
          vfNote,
          label: note.name.replace(/\d+$/, ''),
          id,
        })
      }
      pendingRefs.push({ vfNote, id, hand, row, measureIndex: mi })
    }
    return vfNote
  }

  function drawMeasureColumn(
    treble: Stave,
    bass: Stave,
    rightVF: StaveNote[],
    leftVF: StaveNote[],
    mi: number,
  ) {
    const { numerator, denominator } = timeSigForMeasure(mi)
    const beamGroups = beamGroupsForMeasure(mi)
    const voices: Voice[] = []
    const beams: ReturnType<typeof Beam.generateBeams> = []

    let rightVoice: Voice | null = null
    if (rightVF.length > 0) {
      rightVoice = new Voice({ numBeats: numerator, beatValue: denominator })
      rightVoice.setMode(VoiceMode.SOFT)
      rightVoice.addTickables(rightVF)
      voices.push(rightVoice)
    }

    let leftVoice: Voice | null = null
    if (leftVF.length > 0) {
      leftVoice = new Voice({ numBeats: numerator, beatValue: denominator })
      leftVoice.setMode(VoiceMode.SOFT)
      leftVoice.addTickables(leftVF)
      voices.push(leftVoice)
    }

    if (voices.length === 0) return

    // joinVoices aligns rests horizontally across both staves
    const formatWidth = treble.getNoteEndX() - treble.getNoteStartX()
    new Formatter().joinVoices(voices).format(voices, formatWidth)

    // Generate beams AFTER joinVoices — joinVoices resets flag state on the
    // first note of each beam group, so beaming before it leaves a spurious flag.
    if (rightVF.length > 0)
      beams.push(...Beam.generateBeams(rightVF, { groups: beamGroups }))
    if (leftVF.length > 0)
      beams.push(...Beam.generateBeams(leftVF, { groups: beamGroups }))

    if (rightVoice) rightVoice.draw(ctx, treble)
    if (leftVoice) leftVoice.draw(ctx, bass)
    beams.forEach((b) => b.setContext(ctx).draw())
  }

  for (let row = 0; row < numRows; row++) {
    const trebleY = MARGIN_TOP + row * rowHeight
    const bassY = trebleY + trebleStaveH + GRAND_STAFF_GAP

    const rowMeasures = rows[row]

    // Compute the overhead each measure in this row contributes (first measure
    // gets clef+timesig+keysig, row-start gets clef+keysig, rest get nothing).
    const rowOverheads = rowMeasures.map((mi, col) => {
      const isFirstMeasure = mi === 0
      const isRowStart = col === 0
      return isFirstMeasure
        ? overheadFirst
        : isRowStart
          ? overheadRowStart
          : overheadPlain
    })
    const totalOverhead = rowOverheads.reduce((s, o) => s + o, 0)

    // Distribute remaining width proportionally to each measure's min note width.
    const noteWidthBudget = usableWidth - totalOverhead
    const totalNoteMin = rowMeasures.reduce((s, mi) => s + noteMinWidths[mi], 0)
    // If somehow all note widths are 0 (e.g. empty song), split evenly.
    const noteWidthScale = totalNoteMin > 0 ? noteWidthBudget / totalNoteMin : 1

    // Compute per-measure stave widths and x positions
    const staveWidths = rowMeasures.map((mi, col) =>
      Math.floor(noteMinWidths[mi] * noteWidthScale + rowOverheads[col]),
    )
    // Absorb rounding remainder into the last measure so staves fill the row exactly
    const allocated = staveWidths.reduce((s, w) => s + w, 0)
    staveWidths[staveWidths.length - 1] += usableWidth - allocated

    let xCursor = MARGIN_H
    for (let col = 0; col < rowMeasures.length; col++) {
      const mi = rowMeasures[col]
      const isFirstMeasure = mi === 0
      const isRowStart = col === 0
      const staveW = staveWidths[col]
      const x = xCursor
      xCursor += staveW

      const treble = new Stave(x, trebleY, staveW)
      addStaveModifiers(treble, 'treble', isFirstMeasure, isRowStart, mi)
      treble.setContext(ctx).draw()

      const bass = new Stave(x, bassY, staveW)
      addStaveModifiers(bass, 'bass', isFirstMeasure, isRowStart, mi)
      bass.setContext(ctx).draw()

      // Store one stave pair per row for label Y positioning
      if (isRowStart) rowStaves[row] = { treble, bass }

      new StaveConnector(treble, bass)
        .setType(StaveConnector.type.SINGLE_RIGHT)
        .setContext(ctx)
        .draw()
      if (isRowStart) {
        new StaveConnector(treble, bass)
          .setType(StaveConnector.type.BRACE)
          .setContext(ctx)
          .draw()
        new StaveConnector(treble, bass)
          .setType(StaveConnector.type.SINGLE_LEFT)
          .setContext(ctx)
          .draw()
      }

      let rightNoteCount = 0
      const rightVF = (rightMeasures[mi] ?? []).map((note) => {
        const id = noteId(rightTrackIndex, rightOffset[mi] + rightNoteCount)
        if (!note.isRest) rightNoteCount++
        return buildVFNote('treble', note, id, 'right', row, mi)
      })

      let leftNoteCount = 0
      const leftVF = (leftMeasures[mi] ?? []).map((note) => {
        const id = noteId(leftTrackIndex, leftOffset[mi] + leftNoteCount)
        if (!note.isRest) leftNoteCount++
        return buildVFNote('bass', note, id, 'left', row, mi)
      })

      const top = treble.getTopLineTopY()
      const bottom = bass.getBottomLineBottomY()
      measureBoxes.push({
        measureIndex: mi,
        x,
        y: top,
        width: staveW,
        height: bottom - top,
      })

      drawMeasureColumn(treble, bass, rightVF, leftVF, mi)
    }
  }

  // Build noteRefs and a vfNote→NoteRef map in one pass so indices stay in sync.
  const noteRefs: NoteRef[] = []

  for (const { vfNote, id, hand, row, measureIndex } of pendingRefs) {
    const svgEl = vfNote.getSVGElement()
    if (!svgEl) continue
    const svgEls: Element[] = [svgEl]
    const stemEl = vfNote.getStem()?.getSVGElement()
    if (stemEl) svgEls.push(stemEl)
    const ref: NoteRef = { id, hand, svgEls, row, measureIndex }
    noteRefs.push(ref)
  }

  const svgEl = container.querySelector('svg')

  // Draw note name labels positioned on the open side of the note (away from stem)
  // and wire them into noteRefs so they highlight along with the note.
  if (pendingLabels.length > 0 && svgEl) {
    for (const { vfNote, label } of pendingLabels) {
      const x = (vfNote.getNoteHeadBeginX() + vfNote.getNoteHeadEndX()) / 2
      if (!x) continue
      const stave = vfNote.getStave()
      if (!stave) continue
      const stemDir = vfNote.getStemDirection()
      const bounds = vfNote.getNoteHeadBounds()
      const y =
        stemDir >= 0
          ? Math.max(bounds.yBottom + 24, stave.getBottomLineBottomY() + 12)
          : Math.min(bounds.yTop - 12, stave.getTopLineTopY() - 6)

      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text',
      )
      text.setAttribute('x', String(x))
      text.setAttribute('y', String(y))
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('font-size', '10')
      text.setAttribute('font-family', 'Arial, sans-serif')
      text.setAttribute('font-weight', 'normal')
      text.classList.add('vf-note-label')
      text.textContent = label
      svgEl.appendChild(text)
    }
  }

  return { noteRefs, measureBoxes }
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
    ref.svgEls.forEach((el) => {
      if (el.classList.contains('vf-note-label')) {
        // skip — label color is static
      } else {
        colorElement(el, color)
      }
    })
  }
}

/** Returns the {row, measureIndex} of the first active note, or null if none active. */
export function getActiveInfo(
  refs: NoteRef[],
  activeIds: Set<string>,
): { row: number; measureIndex: number } | null {
  for (const ref of refs) {
    if (activeIds.has(ref.id))
      return { row: ref.row, measureIndex: ref.measureIndex }
  }
  return null
}

export function recolorAll(container: HTMLElement, color: string): void {
  container
    .querySelectorAll<SVGElement>('path, rect, text:not(.vf-note-label)')
    .forEach((el) => applyColor(el, color))
}

function applyColor(el: SVGElement, color: string) {
  el.style.fill = color
  if (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none') {
    el.style.stroke = color
  }
}

function colorElement(el: Element, color: string) {
  el.querySelectorAll<SVGElement>('path, rect, text').forEach((t) =>
    applyColor(t, color),
  )
  const tag = el.tagName
  if (tag === 'path' || tag === 'rect' || tag === 'text') {
    applyColor(el as SVGElement, color)
  }
}
