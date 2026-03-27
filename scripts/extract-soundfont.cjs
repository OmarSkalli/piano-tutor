#!/usr/bin/env node
// Extracts individual MP3 files from a MIDI.js-format soundfont JS file.
// Usage: node scripts/extract-soundfont.js

const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(
  path.join(__dirname, '../public/soundfonts/MusyngKite/acoustic_grand_piano-mp3.js'),
  'utf8',
)

// Extract the JSON object from the MIDI.js wrapper
const begin = src.indexOf('{')
const end = src.lastIndexOf('}')
const raw = src.slice(begin, end + 1)

// The values are like: "data:audio/mp3;base64,XXXX"
const notes = {}
for (const match of raw.matchAll(/"([^"]+)":\s*"data:audio\/mp3;base64,([^"]+)"/g)) {
  notes[match[1]] = match[2]
}

const outDir = path.join(__dirname, '../public/soundfonts/MusyngKite/notes')
fs.mkdirSync(outDir, { recursive: true })

for (const [note, b64] of Object.entries(notes)) {
  const buf = Buffer.from(b64, 'base64')
  const filename = `${note.replace('#', 's')}.mp3`
  fs.writeFileSync(path.join(outDir, filename), buf)
}

console.log(`Extracted ${Object.keys(notes).length} notes to ${outDir}`)
console.log('Notes:', Object.keys(notes).join(', '))
