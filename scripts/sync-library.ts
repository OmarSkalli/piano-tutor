import fs from 'fs'
import path from 'path'

const songsDir = path.join('src', 'songs')
const libraryPath = path.join(songsDir, 'library.json')

const entries = fs
  .readdirSync(songsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const metadataPath = path.join(songsDir, d.name, 'metadata.json')
    if (!fs.existsSync(metadataPath)) return null
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
    return { id: metadata.id as string, title: metadata.title as string | null }
  })
  .filter((e) => e !== null)

fs.writeFileSync(libraryPath, JSON.stringify(entries, null, 2))
console.log(`Library updated: ${entries.length} song(s)`)
