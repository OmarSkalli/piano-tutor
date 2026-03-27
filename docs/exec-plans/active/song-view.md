# ExecPlan: Song View

## Purpose / Big Picture

Students who click a song in the library land on a Song View page that shows the full sheet music (treble + bass clef), plays back the song with real piano audio, and synchronizes visual highlighting on both the sheet and an on-screen piano keyboard in real time. Students can follow the melody with their eyes — watching notes light up on the staff and the corresponding keys depress on the keyboard — and toggle note name labels (C, G#, etc.) on or off. Right-hand and left-hand notes are distinguished by color throughout.

Related spec: [../product-specs/song-view.md](../product-specs/song-view.md)

## Progress

- [x] (2026-03-26 18:00Z) Milestone 1: Route, data loading, and page shell
- [x] (2026-03-26 19:00Z) Milestone 2: Audio engine (`useAudioEngine` hook)
- [x] (2026-03-26 19:30Z) Milestone 3: Piano keyboard component (`PianoKeyboard`)
- [x] (2026-03-26 20:00Z) Milestone 4: Sheet music renderer (`SheetMusic`)
- [x] (2026-03-26 20:30Z) Milestone 5: Playback controller — synchronized highlighting
- [x] (2026-03-26 21:00Z) Milestone 6: Polish — note name toggle, hand colors, scroll behavior

## Surprises & Discoveries

- VexFlow 5.0.0 was installed instead of the planned 4.x. API is largely the same for our use case; `Voice.setMode()` takes a `VoiceMode` enum value, and `Annotation.setVerticalJustification()` uses `AnnotationVerticalJustify` enum. Both available in 5.x.
- `getSVGElement()` on a `StaveNote` returns `undefined` before the voice is drawn. Refs must be collected after `voice.draw()`, not when constructing the note.
- `@types/soundfont-player` does not exist on npm; the package ships its own `.d.ts` at `node_modules/soundfont-player/index.d.ts`.

## Decision Log

- **import.meta.glob with eager: true** — Used instead of dynamic `import()` calls per songId. This bundles all songs at build time (fine for current single-song library) and avoids async loading on route entry. If the library grows large, switch to lazy glob with `import: 'default'` and `eager: false`.
- **playbackProgress (0–1) instead of raw px scrollOffset** — `usePlayback` exposes a normalized progress ratio; `SheetMusic` converts to px using its own container dimensions. This avoids `usePlayback` needing to know the DOM layout.
- **activeNoteIds + activeNoteNames split** — `usePlayback` returns two separate structures: `activeNoteIds` (Set of `trackIndex-noteIndex` strings) for SheetMusic and `activeNoteNames` (Map of note name → Hand) for PianoKeyboard. This avoids any reverse-lookup at render time.

## Outcomes & Retrospective

---

## Context and Orientation

### Repository State

```
src/
├── components/
│   └── ui/
│       └── button.tsx          ← Base UI button (CVA variants, shadcn/base-nova)
├── lib/
│   ├── music.ts                ← noteDuration quantization helper
│   └── utils.ts                ← cn() Tailwind merge utility
├── routes/
│   ├── __root.tsx              ← Root layout (bare <Outlet />)
│   └── index.tsx               ← "/" — Song Library (links to /songs/$songId)
├── songs/
│   ├── library.json            ← [{id, title}] — one song today
│   └── 9f55a9893fd4930a86fda33a2c056fda/
│       ├── song.json           ← parsed MIDI: tracks, notes, timing (ms)
│       └── metadata.json       ← title, composer, keySignature, tempo, etc.
├── types.ts                    ← Song, Note, Track, Hand, LibraryEntry
├── main.tsx                    ← React 19 + TanStack Router bootstrap
└── routeTree.gen.ts            ← Auto-generated — do NOT edit
```

Key files:

- `src/types.ts` — All domain types; new types for this feature go here
- `src/songs/{id}/song.json` — Per-song note data: `tracks[].notes[].{name, startMs, durationMs, noteDuration, hand, velocity}`
- `src/songs/{id}/metadata.json` — Human-readable metadata: title, tempo, keySignature, timeSignature
- `src/routes/index.tsx` — Already links to `/songs/$songId`
- `src/components/ui/button.tsx` — Reuse for Play/Pause button

### Technology Stack

- Framework: React 19 + Vite 8
- Routing: TanStack Router v1 (file-based; new routes go in `src/routes/`)
- Styling: Tailwind CSS v4
- UI primitives: `@base-ui/react` + shadcn/ui (base-nova)
- Icons: `lucide-react`
- Language: TypeScript 5.9 (strict)
- Audio: Web Audio API (built-in) + `soundfont-player` (to be installed)
- Sheet music: VexFlow 4.x (to be installed) — industry-standard music notation renderer; outputs SVG

### Dependencies

- `@tanstack/react-router` (v1) — routing; new route = new file in `src/routes/`
- `vexflow` (v4.x) — music notation rendering library; converts note data into SVG staves, clefs, note heads, accidentals, stems, beams. Handles all the hard math of staff layout so we don't have to.
- `soundfont-player` — loads real Salamander Grand Piano mp3 samples from CDN; falls back gracefully if unavailable
- Web Audio API — built-in browser API; used for synth fallback and as the AudioContext host
- `NOTE_FREQUENCIES` lookup table (equal temperament C2–C6, all chromatic + enharmonic aliases) — available for synth fallback path

### Current State

- Song Library (`/`) lists songs and links to `/songs/$songId`
- `/songs/$songId` is a stub (`<h1>{songId}</h1>`) — navigation works but nothing renders
- No audio, no sheet music, no keyboard component exists yet
- `src/types.ts` has `Note`, `Track`, `Song`, `Hand`, `LibraryEntry` — needs `SongMeta` and playback-related types

## Plan of Work

The feature is divided into six milestones, each independently verifiable. Earlier milestones establish the scaffolding and data layer; later ones build the three main UI concerns (audio, keyboard, sheet) and finally wire them together with the playback clock.

### Architectural Principles

- **No god components.** `SongView` is a page-level orchestrator. It owns state and passes props down. It does not render sheet lines or piano keys itself.
- **Types centralized.** All new interfaces live in `src/types.ts`. No inline `type`/`interface` definitions inside component files.
- **Hooks for side-effects.** Audio scheduling is encapsulated in `useAudioEngine`. Playback state (current note index, isPlaying) lives in `usePlayback`. Components only read state and call handlers.
- **One responsibility per component:**
  - `PianoKeyboard` — renders keys, accepts a `highlightedNotes` prop, knows nothing about audio or timing
  - `SheetMusic` — renders staves and notes, accepts a `activeNoteIds` prop, knows nothing about audio
  - `PlaybackControls` — play/pause button + note name toggle
  - `SongView` (route component) — loads data, owns playback state, composes the above

### File layout after completion

```
src/
├── components/
│   ├── ui/
│   │   └── button.tsx          (unchanged)
│   ├── PianoKeyboard/
│   │   ├── index.tsx           ← public export
│   │   ├── PianoKeyboard.tsx   ← component
│   │   ├── constants.ts        ← key layout data (WHITE_NOTES, BLACK_KEYS, ENHARMONIC)
│   │   └── utils.ts            ← normalizeNote(), getKeyPosition()
│   ├── SheetMusic/
│   │   ├── index.tsx           ← public export
│   │   ├── SheetMusic.tsx      ← React wrapper; owns VexFlow renderer + highlight state
│   │   ├── vexflow.ts          ← VexFlow render logic (imperative); isolated from React
│   │   └── utils.ts            ← toVFKey(), toVFDur(), groupMeasures(), noteId()
│   └── PlaybackControls/
│       ├── index.tsx
│       └── PlaybackControls.tsx
├── hooks/
│   ├── useAudioEngine.ts       ← Web Audio / soundfont-player; returns playNote()
│   └── usePlayback.ts          ← scheduling loop; returns {play, pause, activeNotes}
├── lib/
│   ├── audio.ts                ← NOTE_FREQUENCIES table, durationMsFromBeats()
│   ├── music.ts                (unchanged)
│   └── utils.ts                (unchanged)
└── routes/
    └── songs/
        └── $songId.tsx         ← SongView page (replaces stub)
```

### Milestone 1: Route, data loading, and page shell

**Goal**: `/songs/$songId` loads real song data, renders title and a skeleton layout.

**Work**:

- Install `soundfont-player` (needed in M2; install early to avoid mid-milestone dependency issues)
- Add `SongMeta` type to `src/types.ts` (mirrors `metadata.json`)
- Replace stub route with `SongView` component that imports `song.json` and `metadata.json` by `songId`, renders title and placeholder sections for sheet / keyboard / controls

**Result**: Navigating to `/songs/9f55a9893...` shows the song title ("Comptine d'un autre été") with empty sheet and keyboard placeholders.

**Proof**:

```bash
pnpm dev
# Navigate to /songs/9f55a9893fd4930a86fda33a2c056fda
# Expected: title rendered, no 404, no TS errors
pnpm exec tsc --noEmit
```

### Milestone 2: Audio engine (`useAudioEngine`)

**Goal**: A hook that can play any note by name using real piano samples (with synth fallback).

**Work**:

- Create `src/lib/audio.ts` with `NOTE_FREQUENCIES` map and `durationMsFromBeats(bpm, noteDuration)` helper
- Create `src/hooks/useAudioEngine.ts` that:
  - Initializes `AudioContext` lazily on first call (browser autoplay policy)
  - Attempts to load Salamander Grand Piano via `soundfont-player`
  - Falls back to triangle-wave + harmonic overtone synthesis from `NOTE_FREQUENCIES`
  - Exposes `playNote(noteName: string, durationMs: number, velocity?: number): void`
  - Exposes `isReady: boolean` and `samplesLoaded: boolean`

**Result**: The hook is importable; a `<TestButton>` in `SongView` (temporary, removed in M5) can trigger `playNote('C4', 500)` and produce audio.

**Proof**:

```bash
# Click test button in dev — hear piano note
pnpm exec tsc --noEmit
```

### Milestone 3: Piano keyboard component (`PianoKeyboard`)

**Goal**: A visual piano keyboard that highlights specified keys in hand-specific colors.

**Work**:

- Create `src/components/PianoKeyboard/constants.ts`:
  - `WHITE_NOTES`: full C2–C7 range
  - `BLACK_KEYS`: note name + horizontal offset per key
  - `ENHARMONIC`: flat→sharp normalization map
- Create `src/components/PianoKeyboard/utils.ts`:
  - `normalizeNote(name: string): string` — e.g. `"Bb4"` → `"A#4"`
- Create `src/components/PianoKeyboard/PianoKeyboard.tsx`:
  - Props: `highlightedNotes: Array<{ note: string; hand: Hand }>`
  - Renders white keys (absolutely positioned flex row) and black keys (absolutely positioned overlays)
  - Right-hand highlighted keys: accent color A (e.g. blue)
  - Left-hand highlighted keys: accent color B (e.g. amber)
  - Keys not highlighted: default white/black
  - Horizontally scrollable if wider than viewport
- Wire into `SongView` placeholder section

**Result**: Keyboard renders full C2–C7 range. Passing `[{ note: 'C4', hand: 'right' }]` colors that key blue.

**Proof**:

```bash
# Verify visually in dev — all keys render, C4 highlighted via hardcoded prop
pnpm exec tsc --noEmit
```

### Milestone 4: Sheet music renderer (`SheetMusic`)

**Goal**: VexFlow-rendered sheet music for both treble (right hand) and bass (left hand) clef staves, with per-note highlighting and optional note name labels.

**Why VexFlow**: manually positioning note heads on SVG staves requires solving staff-line math, accidental spacing, stem direction, beam grouping, and measure layout. VexFlow handles all of this. It's the standard open-source library for this problem and has TypeScript types. Our job is to wrap it cleanly in React.

**VexFlow core concepts**:

- `Renderer` — creates and owns the SVG element; call `renderer.resize(w, h)` then `renderer.getContext()`
- `Stave` — a single measure's staff lines; positioned by `(x, y, width)`; add clef/time sig on first measure
- `StaveNote` — a single note; constructed with `{ clef, keys: ['c/4'], duration: 'q' }`; accidentals added via `.addAccidental(0, new Accidental('#'))`
- `Annotation` — text modifier attached to a note; used for note name labels (position: bottom)
- `Voice` — container for a measure's notes; use `SOFT` mode to avoid beat-count errors
- `Formatter` — lays out notes within a voice to fit the stave width
- `Beam` — auto-groups eighth notes; use `Beam.generateBeams(notes)`
- Highlighting: after render, traverse `vfNote.getAttribute('el')` (the SVG group) and set `fill`/`stroke` on child `path`/`text` elements

**Work**:

- Install VexFlow: `pnpm add vexflow`
- Create `src/components/SheetMusic/utils.ts`:
  - `toVFKey(noteName: string): string` — `'C4'` → `'c/4'`, `'F#4'` → `'f#/4'`, `'Bb3'` → `'bb/3'`
  - `toVFDur(noteDuration: NoteDuration): string` — maps to VexFlow duration codes (`'q'`, `'8'`, `'h'`, `'w'`, `'hd'`, `'qd'`)
  - `getAccidental(noteName: string): string | null` — returns `'#'`, `'b'`, or `null`
  - `groupMeasures(notes: Note[], beatsPerMeasure: number): Note[][]` — groups note array into measures using `BEAT_MAP`
  - `noteId(trackIndex: number, noteIndex: number): string` — stable composite ID for Map lookup
- Create `src/components/SheetMusic/vexflow.ts` — **pure imperative module, no React**:
  - `renderSheet(container: HTMLElement, song: Song, opts: RenderOpts): NoteRef[]`
    - Creates `Renderer`, sizes SVG to fit all measures at 2 measures per row
    - Renders treble stave (right-hand track) and bass stave (left-hand track) in parallel rows
    - Attaches `Annotation` to each note when `opts.showLabels` is true
    - Returns `NoteRef[]`: `Array<{ id: string; hand: Hand; svgEl: SVGElement }>`
  - `highlightNotes(refs: NoteRef[], activeIds: Set<string>, rightColor: string, leftColor: string, defaultColor: string): void`
    - Walks all refs; for active ones sets fill/stroke to hand color; others to `defaultColor`
  - `recolorAll(container: HTMLElement, color: string)` — sets all `path`/`rect`/`text` to base color after initial render
- Create `src/components/SheetMusic/SheetMusic.tsx`:
  - Props: `song: Song`, `activeNoteIds: Set<string>`, `showLabels: boolean`, `scrollOffset: number`
  - Uses `useRef<HTMLDivElement>` for VexFlow container
  - `useEffect([song, showLabels])`: calls `renderSheet()`, stores returned `noteRefs` in a ref, calls `recolorAll()` for base theming
  - `useEffect([activeNoteIds])`: calls `highlightNotes()` with current refs — this is the hot path during playback, no re-render needed
  - Outer div: `overflow: hidden`; inner div: `transform: translateX(-${scrollOffset}px); transition: transform 0.1s linear`
- Wire into `SongView`

**Result**: Sheet music renders treble and bass staves for the song. Notes are positioned correctly by VexFlow. Hardcoded `activeNoteIds = new Set(['0-0'])` highlights a note in right-hand color. Note name labels appear below each note head.

**Proof**:

```bash
# Visually verify in dev: both staves render, notes visible, C-something highlighted
pnpm exec tsc --noEmit
```

### Milestone 5: Playback controller — synchronized highlighting

**Goal**: Pressing Play starts audio and synchronizes `activeNoteIds` + `highlightedNotes` + scroll in real time.

**Work**:

- Create `src/hooks/usePlayback.ts`:
  - Accepts `song: Song`, `playNote` function from `useAudioEngine`
  - On `play()`: iterates all notes across both tracks, schedules `setTimeout` calls aligned to `note.startMs`
  - Each timeout calls `playNote(note.name, note.durationMs, note.velocity * 127)` and fires an `onNoteActive` callback
  - `onNoteActive` updates `activeNotes: Map<number, Hand>` (keyed by note index or midi+startMs composite ID)
  - On `pause()`: clears all scheduled timeouts, freezes `activeNotes`
  - On completion: resets to idle state, clears `activeNotes`
  - Returns: `{ isPlaying, play, pause, activeNotes, scrollOffset }`
  - `scrollOffset` advances linearly with playback time to keep active notes in view (pinned at ~28% from left)
- Remove temporary test button from M2
- Wire `usePlayback` into `SongView`:
  - Pass `activeNotes` to `PianoKeyboard` as `highlightedNotes`
  - Pass `activeNoteIds` (key set from `activeNotes`) to `SheetMusic`
  - Pass `scrollOffset` to `SheetMusic`
- Render `PlaybackControls` with play/pause toggle and note name toggle

**Result**: Pressing Play plays audio, highlights notes on both sheet and keyboard in hand colors, auto-scrolls the sheet, and clears highlights when each note ends.

**Proof**:

```bash
# Full playback test: press play, observe synchronized highlighting
pnpm exec tsc --noEmit
pnpm lint
```

### Milestone 6: Polish — note name toggle, hand colors, scroll behavior

**Goal**: Confirm all spec requirements are fully met; fix any rough edges.

**Work**:

- Note name toggle: ensure state wires correctly from `PlaybackControls` → `SheetMusic`; default is **on**
- Hand colors: define two named CSS custom properties (`--color-hand-right`, `--color-hand-left`) in `index.css`; use them in both `PianoKeyboard` and `SheetMusic` so colors stay in sync
- Scroll behavior: verify the sheet starts at left edge (clef symbol visible); active note stays at ~28% during playback; no jump on play start
- Playback end: play button resets to idle; all highlights clear
- Responsiveness: keyboard is horizontally scrollable on narrow viewports

**Result**: All acceptance criteria from the spec are met.

**Proof**:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm format --check
# Manual E2E checklist (see Validation section)
```

## Concrete Steps

### Milestone 1: Route, data loading, and page shell

1. Install dependencies (both needed later; install together to keep lockfile clean):

   ```bash
   cd /home/omar/workspace/piano-tutor
   pnpm add soundfont-player vexflow
   pnpm add -D @types/soundfont-player
   ```

   Expected: packages added, no peer-dep warnings. VexFlow ships its own types — no `@types/vexflow` needed.

2. Add `SongMeta` type to `src/types.ts`:

   ```typescript
   export interface SongMeta {
     id: string
     title: string
     composer: string | null
     keySignature: string
     timeSignature: string
     tempo: number
     hands: { right: number; left: number }
     source: string
   }
   ```

3. Create `src/routes/songs/` directory and replace the stub `$songId.tsx`:

   ```typescript
   import { createFileRoute } from '@tanstack/react-router'
   import type { Song, SongMeta } from '@/types'

   export const Route = createFileRoute('/songs/$songId')({
     component: SongView,
   })

   function SongView() {
     const { songId } = Route.useParams()

     // Dynamic JSON imports — Vite resolves these at build time per songId
     // For now, import the one known song; M5 wires dynamic loading
     const song: Song = /* import(`@/songs/${songId}/song.json`) */ {} as Song
     const meta: SongMeta = /* import(`@/songs/${songId}/metadata.json`) */ {} as SongMeta

     return (
       <main className="flex h-screen flex-col overflow-hidden">
         <header className="flex items-center justify-between px-6 py-4">
           <h1 className="text-xl font-semibold">{meta.title ?? songId}</h1>
           {/* PlaybackControls slot — M5 */}
         </header>
         <section className="flex-1 overflow-hidden">
           {/* SheetMusic slot — M4 */}
         </section>
         <section className="shrink-0">
           {/* PianoKeyboard slot — M3 */}
         </section>
       </main>
     )
   }
   ```

   Note: dynamic JSON imports via `import()` work in Vite. The concrete implementation will use `useMemo` with the static import pattern (import all known songs at module level, index by id) or Vite's `import.meta.glob` — decide during implementation and log in Decision Log.

4. Verify no type errors:
   ```bash
   pnpm exec tsc --noEmit
   ```

### Milestone 2: Audio engine (`useAudioEngine`)

1. Create `src/lib/audio.ts` with:
   - `NOTE_FREQUENCIES: Record<string, number>` — full C2–C6 equal-temperament table (all chromatic + enharmonic aliases)
   - `durationMsFromBeats(bpm: number, noteDuration: NoteDuration): number`

2. Create `src/hooks/useAudioEngine.ts`:

   ```typescript
   export interface AudioEngine {
     playNote(noteName: string, durationMs: number, velocity?: number): void
     isReady: boolean
     samplesLoaded: boolean
   }

   export function useAudioEngine(): AudioEngine
   ```

   Implementation details:
   - `AudioContext` created lazily inside `playNote` on first call (satisfies browser autoplay policy)
   - `soundfont-player` loaded once via `Soundfont.instrument(ctx, 'acoustic_grand_piano', { format: 'mp3', soundfont: 'MusyngKite' })`
   - If CDN load fails, set `_sfFailed = true` and use synth fallback
   - Synth: triangle-wave primary oscillator + sine harmonic at 2×freq; ADSR envelope (8ms attack, 120ms decay, sustain, 400ms release)
   - Both paths route through a master `GainNode` at 0.7

3. Add temporary test button in `SongView` (will be removed in M5):

   ```tsx
   <button onClick={() => audioEngine.playNote('C4', 500)}>Test C4</button>
   ```

4. Verify in browser: clicking the button produces audio.

### Milestone 3: Piano keyboard component (`PianoKeyboard`)

1. Create `src/components/PianoKeyboard/constants.ts`:
   - `WHITE_NOTES: string[]` — all white keys C2 through C7 (36 keys)
   - `BLACK_KEYS: Array<{ note: string; offset: number }>` — all sharps C2–C7 with pixel offset from left edge (offset = whiteKeyIndex + 0.65)
   - `ENHARMONIC: Record<string, string>` — flat-to-sharp map

2. Create `src/components/PianoKeyboard/utils.ts`:
   - `normalizeNote(name: string): string`

3. Create `src/components/PianoKeyboard/PianoKeyboard.tsx`:

   ```typescript
   interface HighlightedNote {
     note: string
     hand: Hand
   }

   interface PianoKeyboardProps {
     highlightedNotes?: HighlightedNote[]
   }
   ```

   - Renders a `position: relative` container with white keys as a flex row; black keys absolutely positioned
   - Uses CSS custom properties `var(--color-hand-right)` and `var(--color-hand-left)` for highlight colors
   - Keyboard min-width set to fit all 36 white keys; container is `overflow-x: auto`

4. Create `src/components/PianoKeyboard/index.ts` re-exporting component and types.

5. Add to `SongView` keyboard section with hardcoded `[{ note: 'C4', hand: 'right' }]`.

6. Verify: keyboard renders, C4 is highlighted in right-hand color.
   ```bash
   pnpm exec tsc --noEmit
   ```

### Milestone 4: Sheet music renderer (`SheetMusic`)

1. Install VexFlow:

   ```bash
   pnpm add vexflow
   ```

   Expected: `vexflow` added, TypeScript types included (bundled with the package).

2. Create `src/components/SheetMusic/utils.ts`:

   ```typescript
   // VexFlow key format: 'C4' → 'c/4', 'F#4' → 'f#/4', 'Bb3' → 'bb/3'
   export function toVFKey(noteName: string): string

   // VexFlow duration codes
   // 'whole'→'w', 'half'→'h', 'quarter'→'q', 'eighth'→'8',
   // 'dotted-half'→'hd', 'dotted-quarter'→'qd', fallback→'q'
   export function toVFDur(noteDuration: NoteDuration): string

   // Returns '#', 'b', or null
   export function getAccidental(noteName: string): string | null

   // Splits flat note list into measures based on beat count
   // BEAT_MAP: whole=4, half=2, quarter=1, eighth=0.5, dotted-half=3, dotted-quarter=1.5
   export function groupMeasures(
     notes: Note[],
     beatsPerMeasure?: number,
   ): Note[][]

   // Stable ID for a note: `${trackIndex}-${noteIndex}`
   export function noteId(trackIndex: number, noteIndex: number): string
   ```

3. Create `src/components/SheetMusic/vexflow.ts` (pure imperative, no React imports):

   ```typescript
   import {
     Renderer,
     Stave,
     StaveNote,
     Voice,
     Formatter,
     Beam,
     Accidental,
     Annotation,
   } from 'vexflow'
   import type { Song, Hand } from '@/types'
   import {
     toVFKey,
     toVFDur,
     getAccidental,
     groupMeasures,
     noteId,
   } from './utils'

   export interface NoteRef {
     id: string
     hand: Hand
     svgEl: Element // the SVG <g> element VexFlow rendered for this note
   }

   export interface RenderOpts {
     showLabels: boolean
   }

   // Renders full sheet (treble + bass) into container. Returns NoteRef[] for highlighting.
   export function renderSheet(
     container: HTMLElement,
     song: Song,
     opts: RenderOpts,
   ): NoteRef[]

   // Colors SVG elements for active/inactive notes
   export function highlightNotes(
     refs: NoteRef[],
     activeIds: Set<string>,
     rightColor: string,
     leftColor: string,
     defaultColor: string,
   ): void

   // After initial VexFlow render, recolor all notation paths to a base color
   export function recolorAll(container: HTMLElement, color: string): void
   ```

   Implementation notes for `renderSheet`:
   - Layout: 2 measures per row; treble stave row followed immediately by bass stave row, forming a grand staff pair per row
   - Stave width: `Math.floor((containerWidth - margins) / 2)`
   - First measure only: add clef + time signature (use `stave.addClef('treble').addTimeSignature('4/4')`)
   - Row-start measures (not first): add clef only
   - For each note: create `StaveNote`, add `Accidental` if needed, add `Annotation` (bottom-justified) if `opts.showLabels`
   - Voice mode: `SOFT` (avoids beat-count validation errors with complex rhythms)
   - After formatting and drawing each voice: run `Beam.generateBeams(vfNotes)` and draw beams
   - After all staves drawn: call `recolorAll()` immediately to apply base color
   - Build `NoteRef[]` by calling `vfNote.getAttribute('el')` on each rendered note

4. Create `src/components/SheetMusic/SheetMusic.tsx`:

   ```typescript
   interface SheetMusicProps {
     song: Song
     activeNoteIds: Set<string>
     showLabels: boolean
     scrollOffset: number
   }
   ```

   - `containerRef = useRef<HTMLDivElement>(null)`
   - `noteRefsRef = useRef<NoteRef[]>([])` — stable across renders
   - `useEffect([song, showLabels])`: clear container, call `renderSheet()`, store result in `noteRefsRef`
   - `useEffect([activeNoteIds])`: call `highlightNotes(noteRefsRef.current, activeNoteIds, ...)` — no React re-render, direct DOM mutation; this is intentional for performance
   - Outer `div`: `overflow: hidden`
   - Inner `div` (the VexFlow container): `style={{ transform: \`translateX(-${scrollOffset}px)\`, transition: 'transform 0.1s linear' }}`

5. Create `src/components/SheetMusic/index.ts` re-exporting `SheetMusic` and `SheetMusicProps`.

6. Wire into `SongView`; hardcode `activeNoteIds = new Set(['0-0'])` to verify one note highlights.
   ```bash
   pnpm exec tsc --noEmit
   ```

### Milestone 5: Playback controller — synchronized highlighting

1. Create `src/hooks/usePlayback.ts`:

   ```typescript
   interface PlaybackState {
     isPlaying: boolean
     activeNotes: Map<string, Hand> // noteId → hand
     scrollOffset: number
     play(): void
     pause(): void
   }

   export function usePlayback(
     song: Song,
     audioEngine: AudioEngine,
   ): PlaybackState
   ```

   Implementation:
   - `play()`: record `startWallTime = Date.now()`. For each note across both tracks, schedule:
     ```
     setTimeout(() => {
       audioEngine.playNote(note.name, note.durationMs, note.velocity * 127)
       setActiveNotes(prev => new Map(prev).set(noteId, hand))
       // clear after note duration
       setTimeout(() => setActiveNotes(prev => { prev.delete(noteId); return new Map(prev) }), note.durationMs)
     }, note.startMs)
     ```
   - Store all timeout IDs for cancellation
   - `pause()`: `clearTimeout` all pending, freeze current state
   - `scrollOffset`: computed as `(elapsedMs / totalDurationMs) * (totalSheetWidth - viewportWidth * 0.72)` — keeps active note at ~28% from left
   - On song end: reset `isPlaying = false`, clear `activeNotes`

2. Create `src/components/PlaybackControls/PlaybackControls.tsx`:

   ```typescript
   interface PlaybackControlsProps {
     isPlaying: boolean
     onPlay(): void
     onPause(): void
     showLabels: boolean
     onToggleLabels(): void
   }
   ```

   - Play/pause button (reuse `Button` from `ui/button.tsx`)
   - "Note names" toggle (checkbox or toggle button)

3. Replace test button in `SongView` with `PlaybackControls`.

4. Wire `usePlayback` → `PianoKeyboard` and `SheetMusic`.

5. Full playback test:
   ```bash
   pnpm exec tsc --noEmit
   pnpm lint
   ```

### Milestone 6: Polish

1. Define CSS custom properties in `src/index.css`:

   ```css
   :root {
     --color-hand-right: oklch(0.6 0.2 250); /* blue */
     --color-hand-left: oklch(0.7 0.18 80); /* amber */
   }
   ```

2. Audit scroll: open song, verify clef is visible at left, note stays at 28% during playback.

3. Audit playback end: let song complete, verify button resets, highlights clear.

4. Audit keyboard overflow: shrink browser window, verify horizontal scroll appears.

5. Final quality pass:
   ```bash
   pnpm exec tsc --noEmit
   pnpm lint
   pnpm format --check
   ```

## Validation and Acceptance

### End-to-End Scenario

```bash
pnpm dev
# 1. Open http://localhost:5173
#    Expected: Song Library shows "Comptine d'un autre été"
# 2. Click the song title
#    Expected: /songs/9f55a9893fd4930a86fda33a2c056fda loads; title visible at top
# 3. Observe sheet music
#    Expected: treble and bass clef staves rendered; note labels visible below each note
# 4. Observe keyboard
#    Expected: full piano keyboard (C2–C7) rendered with white and black keys
# 5. Press Play
#    Expected: audio begins playing; notes highlighted on sheet in hand colors;
#              corresponding keys highlighted on keyboard simultaneously
# 6. Observe scroll
#    Expected: sheet scrolls left; active note stays ~28% from left edge
# 7. Toggle "Note names" off
#    Expected: letter labels disappear from sheet; notes still highlight
# 8. Toggle "Note names" back on
#    Expected: labels reappear
# 9. Let song finish
#    Expected: play button resets; all highlights clear
# 10. Press Back
#    Expected: returns to Song Library
```

### Acceptance Criteria

- [ ] Song title is shown at the top of the page
- [ ] Treble and bass clef staves render for the selected song
- [ ] Each note shows its letter name below the staff (default on)
- [ ] Note names are toggleable via a visible control
- [ ] Piano keyboard shows full C2–C7 range (white + black keys)
- [ ] Pressing Play starts audio playback
- [ ] Notes play at correct pitch and approximate rhythm
- [ ] Currently playing notes are highlighted on the sheet in real time
- [ ] Corresponding keys are highlighted on the keyboard simultaneously
- [ ] Right-hand and left-hand notes are visually distinct (different colors)
- [ ] Sheet auto-scrolls during playback, keeping active note in view
- [ ] Playback end resets the play button and clears highlights
- [ ] No TypeScript errors (`pnpm exec tsc --noEmit`)
- [ ] No lint errors (`pnpm lint`)

### Review Checklist Notes

No `docs/REVIEW-CHECKLIST.md` found; applying universal gates:

- TypeScript strict mode must pass (`noEmit`)
- ESLint must pass (`pnpm lint`)
- Prettier must pass (`pnpm format --check`)
- No new `any` types without a justifying comment
- `soundfont-player` CDN dependency: fallback must be tested by throttling network in DevTools

## Idempotence and Recovery

### Safe to Re-run

- All new files are additive; re-creating them is safe
- `soundfont-player` install is idempotent (`pnpm add` is a no-op if already present)
- `routeTree.gen.ts` is auto-regenerated by Vite plugin on each save

### Rollback Procedure

```bash
# Remove all new files
git checkout -- src/routes/songs/\$songId.tsx
git rm -rf src/components/PianoKeyboard src/components/SheetMusic src/components/PlaybackControls
git rm -f src/hooks/useAudioEngine.ts src/hooks/usePlayback.ts src/lib/audio.ts

# Revert types.ts additions
git checkout -- src/types.ts

# Uninstall added package
pnpm remove soundfont-player
```

### Known Risks

- **Soundfont CDN latency**: first play may have a delay until samples load. Mitigation: show `samplesLoaded` state; start loading on component mount, not on first Play press.
- **Browser autoplay policy**: `AudioContext` must be created in response to a user gesture. Mitigation: `useAudioEngine` creates the context lazily inside `playNote()` which is always user-triggered.
- **`setTimeout` drift**: for long songs, accumulated drift may desync audio and highlighting. Mitigation: compute each note's timeout from an absolute `startWallTime` rather than chaining timeouts.
- **VexFlow `getAttribute('el')` API**: the way VexFlow exposes the rendered SVG element for a note has changed across versions. In v4, use `vfNote.getAttribute('el')`. If this returns null, check `vfNote.attrs.el` (v3 pattern) as fallback — log whichever works in the Decision Log.
- **VexFlow re-render on label toggle**: `showNoteNamesBelow` in the reference code re-renders the entire sheet to toggle labels, because VexFlow annotations are baked into the SVG at render time. Our `useEffect([song, showLabels])` dependency handles this correctly — a showLabels change triggers a full re-render of the VexFlow canvas, which is acceptable.
- **Dynamic song import**: Vite's `import.meta.glob` requires static patterns. If pattern is too broad it may bloat the bundle. Log the chosen approach in the Decision Log.

## Artifacts and Notes

## Interfaces and Dependencies

### New Types (`src/types.ts`)

```typescript
export interface SongMeta {
  id: string
  title: string
  composer: string | null
  keySignature: string
  timeSignature: string
  tempo: number
  hands: { right: number; left: number }
  source: string
}
```

### New Hook Interfaces

```typescript
// src/hooks/useAudioEngine.ts
export interface AudioEngine {
  playNote(noteName: string, durationMs: number, velocity?: number): void
  isReady: boolean
  samplesLoaded: boolean
}

// src/hooks/usePlayback.ts
export interface PlaybackState {
  isPlaying: boolean
  activeNotes: Map<string, Hand> // noteId → hand
  scrollOffset: number
  play(): void
  pause(): void
}
```

### New Component Props

```typescript
// src/components/PianoKeyboard/PianoKeyboard.tsx
interface HighlightedNote {
  note: string
  hand: Hand
}
interface PianoKeyboardProps {
  highlightedNotes?: HighlightedNote[]
}

// src/components/SheetMusic/SheetMusic.tsx
interface SheetMusicProps {
  song: Song
  activeNoteIds: Set<string>
  showLabels: boolean
  scrollOffset: number
}

// src/components/PlaybackControls/PlaybackControls.tsx
interface PlaybackControlsProps {
  isPlaying: boolean
  onPlay(): void
  onPause(): void
  showLabels: boolean
  onToggleLabels(): void
}
```

### CSS Custom Properties (added to `src/index.css`)

```css
:root {
  --color-hand-right: oklch(0.6 0.2 250);
  --color-hand-left: oklch(0.7 0.18 80);
}
```

### New Route

| Path             | File                           | Purpose                        |
| ---------------- | ------------------------------ | ------------------------------ |
| `/songs/$songId` | `src/routes/songs/$songId.tsx` | Full Song View (replaces stub) |

### External Dependencies Added

- **`vexflow`** (v4.x) — music notation rendering; handles staff layout, note positioning, accidentals, stems, beams, clefs. TypeScript types bundled.
- **`soundfont-player`** — loads Salamander Grand Piano mp3 samples from MusyngKite CDN; fallback to Web Audio API synth if CDN unavailable

---

**Metadata**

- **Status**: 🚧 Active
- **Owner**: Omar Skalli
- **Created**: 2026-03-26
- **Started**: —
- **Completed**: —
