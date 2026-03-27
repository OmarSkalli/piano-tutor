import { createFileRoute, Link } from '@tanstack/react-router'
import { MidiStatusBadge } from '@/components/MidiStatusBadge'
import { useMidiContext } from '@/context/MidiContext'
import library from '../songs/library.json'
import type { LibraryEntry } from '../types'

const songs = [...(library as LibraryEntry[])].sort((a, b) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
)

export const Route = createFileRoute('/')({
  component: SongLibrary,
})

function SongLibrary() {
  const { status, openModal } = useMidiContext()

  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Songs</h1>
        <MidiStatusBadge status={status} onClick={openModal} />
      </div>
      <ul className="divide-y">
        {songs.map((song) => (
          <li key={song.id}>
            <Link
              to="/songs/$songId"
              params={{ songId: song.id }}
              className="block py-3 hover:text-blue-600"
            >
              {song.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
