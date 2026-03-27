# Song View

A dedicated page for a single song that renders the musical sheet, plays back the audio, and synchronizes highlighted notes across both the sheet and an on-screen piano keyboard — helping students follow along and learn by watching.

## Problem

Once a student selects a song from the library, they have nowhere to go. There is no way to see the musical content of a song, hear it, or understand the mapping between sheet music notation and physical piano keys.

## Solution

A Song View page that displays the full sheet music for a song (treble and bass clef), plays back the audio, and synchronizes visual highlighting across the sheet and a piano keyboard in real time as the song plays.

## Requirements

### Must Have (P0)

- Display the song title at the top of the page
- Render the full sheet music for both hands (treble + bass clef staves)
- Display the note name (e.g. "C", "G#") below each note on the sheet
- Show a play button that starts playback
- Play audio for each note at the correct timing
- Highlight the currently playing note(s) on the sheet in real time
- Highlight the corresponding key(s) on the on-screen piano keyboard in real time
- Render an on-screen piano keyboard (white and black keys) below the sheet music
- Piano keyboard displays the full standard range (C2–C7) by default
- Sheet music auto-scrolls horizontally during playback to keep the active note in view
- Note names are toggleable (on/off) via a visible control; default is **on**
- Left-hand and right-hand notes highlight in different colors (both on sheet and keyboard)

### Should Have (P1)

- Pause and resume playback
- Visual indication that playback has ended (e.g. play button resets)

### Nice to Have (P2)

- Tempo control (slow down for practice)
- Loop section (repeat a selected range)
- Individual hand playback (left hand only / right hand only)

## User Stories

**As a** student
**I want** to see the sheet music for a song
**So that** I can read the notes before attempting to play

**Acceptance Criteria:**

- [ ] Both treble and bass clef staves are rendered for the selected song
- [ ] Each note shows its letter name (e.g. C, D#) below the staff
- [ ] The song title is visible at the top

---

**As a** student
**I want** to press play and hear the song
**So that** I can understand how it sounds and follow the timing

**Acceptance Criteria:**

- [ ] Pressing play begins audio playback from the start
- [ ] Notes play at the correct pitch and rhythm
- [ ] Playback can be paused and resumed

---

**As a** student
**I want** to see the notes highlighted as the song plays
**So that** I can follow along on both the sheet and the keyboard

**Acceptance Criteria:**

- [ ] The current note(s) on the sheet are highlighted during playback
- [ ] The corresponding key(s) on the on-screen keyboard are highlighted simultaneously
- [ ] Highlighting advances in sync with the audio

## Layout

```
┌─────────────────────────────────────────┐
│  Song Title                    ▶ Play   │
├─────────────────────────────────────────┤
│                                         │
│   Sheet Music (treble + bass clef)      │
│   Note names displayed below each note  │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│   Piano Keyboard (white + black keys)   │
│                                         │
└─────────────────────────────────────────┘
```

- Top bar: song title (left) + play/pause button (right)
- Upper section: sheet music with note labels
- Lower section: piano keyboard

## Design Considerations

### Sheet Music Rendering

- Notes must be positioned on the correct staff line/space for their pitch and octave
- Accidentals (sharps, flats) must be displayed correctly
- Note duration affects horizontal spacing (quarter note vs. eighth note)
- Both staves (treble + bass) should be visible simultaneously

### Piano Keyboard

- Default range: C2–C7 (full standard range). A future iteration may narrow this to only the octaves required by a given song.
- White keys and black keys rendered with correct proportions and layout
- Highlighted keys should be visually distinct (e.g. color fill)

### Synchronization

- Sheet highlighting and keyboard highlighting must fire from the same playback clock
- Highlight should clear when the note ends, not linger

### Sheet Music Scrolling

- The sheet is wider than the viewport for most songs; it scrolls horizontally during playback
- Initial position mirrors standard sheet music: first measure begins near the left edge after the clef and key signature
- The currently playing note stays within a fixed horizontal position (e.g. 25–30% from the left edge) as the sheet advances beneath it during playback
- Scrolling is driven by the playback clock, not user interaction

### Audio Engine

- Primary: real piano samples via `soundfont-player` (Salamander Grand Piano / MusyngKite CDN)
- Fallback: Web Audio API synthesis (triangle-wave with harmonic overtone envelope) if the CDN is unavailable
- Both paths share the same `playNote(noteName, durationMs, velocity)` interface
- Master gain control for volume
- Notes are scheduled via `setTimeout` offsets from a shared start timestamp; the same timestamps drive the highlight callbacks
- A `NOTE_FREQUENCIES` lookup table (equal temperament, C2–C6, all chromatic notes + enharmonic aliases) is available for the synth fallback path

### Technical Constraints

- Song data comes from `library.json` and per-song note files in `src/songs/`
- Each note has pitch, octave, beat position (`t`), and duration fields
- Note names use scientific pitch notation: `"C4"`, `"G#3"`, `"Bb4"`

### Dependencies

- Song Library spec — navigation entry point into Song View
- Song data format (defined by Song Import Pipeline spec)

### Out of Scope

- Recording or microphone input
- Grading or scoring the student's performance
- MIDI device input
- Editing sheet music

## Open Questions

- [ ] Exact color values for left-hand vs. right-hand highlight (to be decided during design)

## Related Documents

- Song Library: [song-library.md](song-library.md)
- Song Import Pipeline: [song-import-pipeline.md](song-import-pipeline.md)

---

**Status**: 📋 Planned
**Owner**: Omar Skalli
**Created**: 2026-03-26
**Updated**: 2026-03-26
