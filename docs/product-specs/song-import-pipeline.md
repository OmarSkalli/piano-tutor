# Song Import Pipeline

A CLI script that processes a MIDI file and outputs a structured JSON representation of the song into the app's source tree, making it available for Study Mode and Practice Mode without any runtime file handling in the browser.

## Problem Statement

### Current State

There is no way to get a song into the app. MIDI files exist externally but the app has no mechanism to ingest, parse, or store them.

### Pain Points

- No song data means Study Mode and Practice Mode can't be built yet
- Parsing MIDI at runtime in the browser adds complexity and latency
- MIDI metadata is sparse and inconsistent — needs a normalization step
- Hand assignment (left vs. right) is not standardized across MIDI files

### Desired Outcome

Run one command with a MIDI file path, and the song is immediately available in the app as clean, pre-parsed JSON.

## Target Users

**Primary**: The developer (Omar) importing songs for personal use

- Has a MIDI file on disk and wants to study/practice it in the app
- Wants to add songs to the library without touching app code

## User Stories

### Core Functionality

**As a** developer
**I want** to run `pnpm process-song <path-to-midi>`
**So that** the song becomes available in the app without any manual JSON editing

**Acceptance Criteria:**

- [ ] Script copies the `.mid` file to `src/songs/<song-slug>/source.mid`
- [ ] Script parses the MIDI file and writes output to `src/songs/<song-slug>/`
- [ ] Output includes a `song.json` with all note data, tracks, and timing info
- [ ] Output includes a `metadata.json` with title, composer, key signature, time signature, tempo
- [ ] Song slug is derived from the filename (e.g. `moonlight-sonata.mid` → `moonlight-sonata/`)
- [ ] Script prints a summary of what was extracted (track count, note count, duration, metadata found)

### Hand Assignment

**As a** developer
**I want** tracks/channels to be mapped to left and right hand
**So that** the app can visualize and evaluate each hand independently

**Acceptance Criteria:**

- [ ] If the MIDI has 2 tracks, assign track 1 = right hand, track 2 = left hand by default
- [ ] If the MIDI uses channel conventions, use those as a fallback
- [ ] If neither applies, fall back to pitch split at middle C (C4)
- [ ] Hand assignment is stored in `metadata.json` and can be manually overridden by editing the file

### Metadata Normalization

**As a** developer
**I want** missing metadata to be surfaced clearly
**So that** I can fill it in manually after the import

**Acceptance Criteria:**

- [ ] Script reads title, composer from MIDI meta messages if present
- [ ] Fields that couldn't be extracted are set to `null` and listed in the script's output
- [ ] `metadata.json` is human-editable for manual corrections

## Requirements

### Must Have (P0)

- CLI script runnable via `pnpm process-song <path>`
- Parses MIDI into a clean note-event model (pitch, velocity, start time, duration, hand)
- Outputs `src/songs/<slug>/song.json` and `src/songs/<slug>/metadata.json`
- Handles multi-track and single-track MIDI files
- Written in TypeScript, runs via `tsx` (consistent with the existing stack)

### Should Have (P1)

- Derives tempo map (handles tempo change events mid-song)
- Converts MIDI ticks to milliseconds and beats for easier rendering
- Warns if the MIDI file has more than 2 tracks (ambiguous hand assignment)

### Nice to Have (P2)

- `--title` and `--composer` flags to pre-populate metadata from the command line
- `--hands` flag to manually specify track-to-hand mapping (e.g. `--hands 1:right,2:left`)

## Success Metrics

- **Import time**: Running the script on a typical piano MIDI file takes under 2 seconds
- **Usability**: A new song can be imported and rendered in the app within a single command
- **Coverage**: All songs in the initial library were imported via this script with no manual JSON editing of note data

## Design Considerations

### Output Schema

`song.json`:

```json
{
  "tracks": [
    {
      "hand": "right",
      "notes": [
        {
          "midi": 60,
          "name": "C4",
          "velocity": 80,
          "startTick": 0,
          "durationTicks": 480,
          "startMs": 0,
          "durationMs": 500
        }
      ]
    }
  ],
  "tempoChanges": [{ "tick": 0, "bpm": 120 }],
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "durationMs": 240000,
  "ticksPerQuarter": 480
}
```

`metadata.json`:

```json
{
  "title": "Moonlight Sonata",
  "composer": null,
  "keySignature": "C# minor",
  "hands": { "right": 0, "left": 1 },
  "source": "moonlight-sonata.mid"
}
```

### Technical Constraints

- Must run in Node.js (not the browser)
- Use `@tonejs/midi` for MIDI parsing — already the planned dependency for playback
- No database — output is static JSON files committed alongside source code

### Dependencies

- `@tonejs/midi` — MIDI parsing
- `tsx` — TypeScript execution in Node

### Out of Scope

- Browser-based file upload
- Audio file formats (MP3, WAV, MusicXML)
- Fetching MIDI files from URLs
- A song library management UI

## Open Questions

- [ ] Should `song.json` and `metadata.json` be merged into one file?
- [ ] How should songs be registered with the app — auto-discovered, or manually imported in a songs index file?
- [ ] Should the script overwrite an existing song directory, or prompt/error? (presence of `source.mid` can serve as the guard)

## Related Documents

- Vision: [../VISION.md](../../VISION.md)

---

**Status**: 📋 Planned
**Owner**: Omar Skalli
**Created**: 2026-03-26
**Updated**: 2026-03-26
