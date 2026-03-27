import { createFileRoute, Link } from '@tanstack/react-router'
import library from '../songs/library.json'
import type { LibraryEntry } from '../types'

const songs = [...(library as LibraryEntry[])].sort((a, b) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
)

export const Route = createFileRoute('/')({
  component: SongLibrary,
})

function SongLibrary() {
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-2xl font-semibold">Songs</h1>
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
