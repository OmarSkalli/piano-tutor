import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { PianoKeyboard } from '@/components/PianoKeyboard'
import { PlayerBar } from '@/components/PlayerBar'
import { SheetMusic } from '@/components/SheetMusic'
import { useAudioEngine } from '@/hooks/useAudioEngine'
import { usePlayback } from '@/hooks/usePlayback'
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
  const [showLabels, setShowLabels] = useState(true)
  const [showPiano, setShowPiano] = useState(true)
  const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null)
  const {
    isPlaying,
    tempoRate,
    positionMs,
    activeNoteIds,
    activeNoteNames,
    play,
    pause,
    seek,
    setTempoRate,
    getPositionMs,
  } = usePlayback(data?.song ?? EMPTY_SONG, audioEngine)

  if (!data) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Song not found: {songId}</p>
      </main>
    )
  }

  const { song, meta } = data
  const highlightedNotes = Array.from(activeNoteNames.entries()).map(
    ([note, hand]) => ({
      note,
      hand,
    }),
  )

  function handleMeasureClick(measureIndex: number) {
    setSelectedMeasure(measureIndex)
    const startMs = song.tracks
      .flatMap((t) => t.notes)
      .filter((n) => !n.isRest && n.measureIndex === measureIndex)
      .reduce((min, n) => Math.min(min, n.startMs), Infinity)
    if (isFinite(startMs)) seek(startMs)
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <PlayerBar
        title={meta.title}
        isPlaying={isPlaying}
        isPreloading={audioEngine.isPreloading}
        durationMs={song.durationMs}
        tempoRate={tempoRate}
        positionMs={positionMs}
        showLabels={showLabels}
        showPiano={showPiano}
        onPlay={play}
        onPause={pause}
        onPrepare={audioEngine.prepare}
        onSeek={seek}
        onSetTempoRate={setTempoRate}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onTogglePiano={() => setShowPiano((v) => !v)}
        getPositionMs={getPositionMs}
      />
      <div className="flex-1 overflow-hidden">
        <SheetMusic
          song={song}
          activeNoteIds={activeNoteIds}
          showLabels={showLabels}
          keySignature={meta.keySignature}
          onMeasureClick={handleMeasureClick}
          selectedMeasure={isPlaying ? null : selectedMeasure}
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
