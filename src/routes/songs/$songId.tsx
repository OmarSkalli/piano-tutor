import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { PianoKeyboard } from '@/components/PianoKeyboard'
import {
  PlayerBar,
  type ActiveHand,
  type AppMode,
  type CropRange,
} from '@/components/PlayerBar'
import { SheetMusic } from '@/components/SheetMusic'
import { useMidiContext } from '@/context/MidiContext'
import { useAudioEngine } from '@/hooks/useAudioEngine'
import { usePlayback } from '@/hooks/usePlayback'
import { usePractice } from '@/hooks/usePractice'
import type { Song, SongMeta } from '@/types'

const SONGS_DIR = '../../songs'

const songDataMap = import.meta.glob<Song>('../../songs/*/song.json', {
  eager: true,
  import: 'default',
})
const metaDataMap = import.meta.glob<SongMeta>('../../songs/*/metadata.json', {
  eager: true,
  import: 'default',
})

function getSongData(songId: string): { song: Song; meta: SongMeta } | null {
  const song = songDataMap[`${SONGS_DIR}/${songId}/song.json`]
  const meta = metaDataMap[`${SONGS_DIR}/${songId}/metadata.json`]
  if (!song || !meta) return null
  return { song, meta }
}

// Stable empty song used when the route param is invalid (rules of hooks: no conditional calls)
const EMPTY_SONG: Song = {
  id: '',
  ticksPerQuarter: 480,
  durationMs: 0,
  tempoChanges: [],
  timeSignature: { numerator: 4, denominator: 4 },
  tracks: [],
}

export const Route = createFileRoute('/songs/$songId')({
  component: SongView,
})

function SongView() {
  const { songId } = Route.useParams()
  const data = getSongData(songId)
  const audioEngine = useAudioEngine()
  const midi = useMidiContext()

  // Persistent UI toggles
  const [showLabels, setShowLabels] = useState(true)
  const [showPiano, setShowPiano] = useState(true)
  const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null)

  // Mode
  const [mode, setMode] = useState<AppMode>('playback')

  // Practice controls
  const [activeHand, setActiveHand] = useState<ActiveHand>('both')
  const [cropRange, setCropRange] = useState<CropRange | null>(null)
  const [waitMode, setWaitMode] = useState(false)

  const song = data?.song ?? EMPTY_SONG

  // Total measure count (1-based, for the crop UI)
  const totalMeasures = useMemo(() => {
    const allNotes = song.tracks.flatMap((t) => t.notes)
    if (allNotes.length === 0) return 1
    return allNotes.reduce((max, n) => Math.max(max, n.measureIndex), 0) + 1
  }, [song])

  const croppedSong = useMemo((): Song => {
    if (cropRange === null) return song
    // Convert 1-based UI measure numbers to 0-based measureIndex
    const startIdx = cropRange.start - 1
    const endIdx = cropRange.end - 1
    const rangeStartMs = song.tracks.reduce((min, track) => {
      const firstNoteInRange = track.notes.find(
        (note) =>
          !note.isRest &&
          note.measureIndex >= startIdx &&
          note.measureIndex <= endIdx,
      )
      return firstNoteInRange ? Math.min(min, firstNoteInRange.startMs) : min
    }, Infinity)
    const tracks = song.tracks.map((track) => ({
      ...track,
      notes: track.notes
        .filter(
          (note) =>
            note.measureIndex >= startIdx && note.measureIndex <= endIdx,
        )
        .map((note) => ({
          ...note,
          startMs: Number.isFinite(rangeStartMs)
            ? Math.max(0, note.startMs - rangeStartMs)
            : note.startMs,
          measureIndex: note.measureIndex - startIdx,
        })),
    }))
    const allNotes = tracks.flatMap((t) => t.notes).filter((n) => !n.isRest)
    const lastEndMs = allNotes.reduce(
      (max, n) => Math.max(max, n.startMs + n.durationMs),
      0,
    )
    return { ...song, tracks, durationMs: lastEndMs || song.durationMs }
  }, [song, cropRange])

  const filteredSong = useMemo((): Song => {
    if (activeHand === 'both') return croppedSong
    return {
      ...croppedSong,
      tracks: croppedSong.tracks.map((track) => ({
        ...track,
        notes: track.hand !== activeHand ? [] : track.notes,
      })),
    }
  }, [croppedSong, activeHand])

  const sheetSong = croppedSong

  const playback = usePlayback(filteredSong, audioEngine)
  const practice = usePractice(filteredSong, midi)

  const isWaitActive = mode === 'practice' && waitMode

  const activeNoteIds = isWaitActive
    ? practice.activeNoteIds
    : playback.activeNoteIds
  const activeNoteNames = isWaitActive
    ? practice.activeNoteNames
    : playback.activeNoteNames
  const highlightedNotes = useMemo(
    () =>
      Array.from(activeNoteNames.entries()).map(([note, hand]) => ({
        note,
        hand,
      })),
    [activeNoteNames],
  )

  if (!data) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Song not found: {songId}</p>
      </main>
    )
  }

  const { meta } = data

  function handleMeasureClick(measureIndex: number) {
    setSelectedMeasure(measureIndex)
    const startMs = filteredSong.tracks
      .flatMap((t) => t.notes)
      .filter((n) => !n.isRest && n.measureIndex === measureIndex)
      .reduce((min, n) => Math.min(min, n.startMs), Infinity)
    if (isFinite(startMs)) playback.seek(startMs)
  }

  function handleModeChange(m: AppMode) {
    if (playback.isPlaying) playback.pause()
    practice.reset()
    setMode(m)
  }

  function handleActiveHandChange(hand: ActiveHand) {
    setSelectedMeasure(null)
    practice.reset()
    setActiveHand(hand)
  }

  function handleCropRangeChange(range: CropRange | null) {
    setSelectedMeasure(null)
    practice.reset()
    setCropRange(range)
  }

  const currentMeasureForSheet = isWaitActive
    ? practice.currentMeasure
    : playback.isPlaying
      ? null
      : selectedMeasure

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <PlayerBar
        title={meta.title}
        mode={mode}
        isPlaying={playback.isPlaying}
        isPreloading={audioEngine.isPreloading}
        durationMs={filteredSong.durationMs}
        tempoRate={playback.tempoRate}
        positionMs={playback.positionMs}
        activeHand={activeHand}
        cropRange={cropRange}
        waitMode={waitMode}
        totalMeasures={totalMeasures}
        practiceStatus={practice.status}
        showLabels={showLabels}
        showPiano={showPiano}
        onModeChange={handleModeChange}
        onPlay={playback.play}
        onPause={playback.pause}
        onPrepare={audioEngine.prepare}
        onSeek={playback.seek}
        onSetTempoRate={playback.setTempoRate}
        onActiveHandChange={handleActiveHandChange}
        onCropRangeChange={handleCropRangeChange}
        onWaitModeToggle={() => {
          practice.reset()
          setWaitMode((v) => !v)
        }}
        onPracticeStart={practice.start}
        onPracticeReset={practice.reset}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onTogglePiano={() => setShowPiano((v) => !v)}
        getPositionMs={playback.getPositionMs}
      />
      <div className="flex-1 overflow-hidden">
        <SheetMusic
          song={sheetSong}
          activeNoteIds={activeNoteIds}
          showLabels={showLabels}
          keySignature={meta.keySignature}
          onMeasureClick={handleMeasureClick}
          selectedMeasure={currentMeasureForSheet}
        />
      </div>
      {showPiano && (
        <div className="shrink-0">
          <PianoKeyboard highlightedNotes={highlightedNotes} />
        </div>
      )}
    </main>
  )
}
