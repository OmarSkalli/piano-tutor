import { useCallback, useEffect, useMemo, useState } from 'react'
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
const SONG_PREFERENCES_STORAGE_KEY = 'piano-tutor:song-prefs:v1'

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

interface SongViewPreferences {
  activeHand: ActiveHand
  cropRange: CropRange | null
  showLabels: boolean
  showPiano: boolean
}

const DEFAULT_SONG_VIEW_PREFERENCES: SongViewPreferences = {
  activeHand: 'both',
  cropRange: null,
  showLabels: true,
  showPiano: true,
}

function getTotalMeasures(song: Song): number {
  const allNotes = song.tracks.flatMap((track) => track.notes)
  if (allNotes.length === 0) return 1
  return allNotes.reduce((max, note) => Math.max(max, note.measureIndex), 0) + 1
}

function isActiveHand(value: unknown): value is ActiveHand {
  return value === 'left' || value === 'both' || value === 'right'
}

function sanitizeCropRange(
  value: unknown,
  totalMeasures: number,
): CropRange | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('start' in value) ||
    !('end' in value)
  ) {
    return null
  }

  const start = Number(value.start)
  const end = Number(value.end)
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end < start ||
    end > totalMeasures
  ) {
    return null
  }

  return { start, end }
}

function readSongPreferencesMap(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(SONG_PREFERENCES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function readSongViewPreferences(
  songId: string,
  totalMeasures: number,
): SongViewPreferences {
  const stored = readSongPreferencesMap()[songId]
  if (!stored || typeof stored !== 'object') {
    return DEFAULT_SONG_VIEW_PREFERENCES
  }
  const record = stored as Record<string, unknown>

  return {
    activeHand: isActiveHand(record.activeHand)
      ? record.activeHand
      : DEFAULT_SONG_VIEW_PREFERENCES.activeHand,
    cropRange: sanitizeCropRange(record.cropRange, totalMeasures),
    showLabels:
      typeof record.showLabels === 'boolean'
        ? record.showLabels
        : DEFAULT_SONG_VIEW_PREFERENCES.showLabels,
    showPiano:
      typeof record.showPiano === 'boolean'
        ? record.showPiano
        : DEFAULT_SONG_VIEW_PREFERENCES.showPiano,
  }
}

function writeSongViewPreferences(
  songId: string,
  preferences: SongViewPreferences,
): void {
  if (typeof window === 'undefined') return

  try {
    const next = readSongPreferencesMap()
    next[songId] = preferences
    window.localStorage.setItem(
      SONG_PREFERENCES_STORAGE_KEY,
      JSON.stringify(next),
    )
  } catch {
    // Ignore storage failures and fall back to in-memory state.
  }
}

export const Route = createFileRoute('/songs/$songId')({
  component: SongViewRoute,
})

function SongViewRoute() {
  const { songId } = Route.useParams()
  return <SongView key={songId} songId={songId} />
}

function SongView({ songId }: { songId: string }) {
  const data = getSongData(songId)
  const audioEngine = useAudioEngine()
  const midi = useMidiContext()
  const { status: midiStatus, openModal } = midi
  const song = data?.song ?? EMPTY_SONG
  const [initialPreferences] = useState(() =>
    readSongViewPreferences(songId, getTotalMeasures(song)),
  )

  // Persistent UI toggles
  const [showLabels, setShowLabels] = useState(initialPreferences.showLabels)
  const [showPiano, setShowPiano] = useState(initialPreferences.showPiano)
  const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null)

  // Mode
  const [mode, setMode] = useState<AppMode>('playback')

  // Practice controls
  const [activeHand, setActiveHand] = useState<ActiveHand>(
    initialPreferences.activeHand,
  )
  const [cropRange, setCropRange] = useState<CropRange | null>(
    initialPreferences.cropRange,
  )

  // Total measure count (1-based, for the crop UI)
  const totalMeasures = useMemo(() => getTotalMeasures(song), [song])

  useEffect(() => {
    if (!data) return
    writeSongViewPreferences(songId, {
      activeHand,
      cropRange,
      showLabels,
      showPiano,
    })
  }, [songId, data, activeHand, cropRange, showLabels, showPiano])

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
  const isPracticeMode = mode === 'practice'

  const activeNoteIds = isPracticeMode
    ? practice.activeNoteIds
    : playback.activeNoteIds
  const activeNoteNames = isPracticeMode
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

  const handlePianoKeyPress = useCallback(
    async (note: string) => {
      await audioEngine.prepare()
      audioEngine.playNote(note, 1200, 96)
    },
    [audioEngine],
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

  const currentMeasureForSheet = isPracticeMode
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
        totalMeasures={totalMeasures}
        practiceStatus={practice.status}
        showLabels={showLabels}
        showPiano={showPiano}
        midiStatus={midiStatus}
        onModeChange={handleModeChange}
        onPlay={playback.play}
        onPause={playback.pause}
        onPrepare={audioEngine.prepare}
        onSeek={playback.seek}
        onSetTempoRate={playback.setTempoRate}
        onActiveHandChange={handleActiveHandChange}
        onCropRangeChange={handleCropRangeChange}
        onPracticeStart={practice.start}
        onPracticeReset={practice.reset}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onTogglePiano={() => setShowPiano((v) => !v)}
        onMidiClick={openModal}
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
          <PianoKeyboard
            highlightedNotes={highlightedNotes}
            onNotePress={handlePianoKeyPress}
          />
        </div>
      )}
    </main>
  )
}
