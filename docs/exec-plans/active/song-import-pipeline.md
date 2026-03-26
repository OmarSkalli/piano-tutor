# ExecPlan: Song Import Pipeline

## Purpose / Big Picture

Enables importing any MIDI file into the app via a single CLI command. Running `pnpm process-song <path-to-midi>` will parse the file, extract note data and metadata, assign hands, and write structured JSON into `src/songs/<slug>/` — making the song immediately available for Study Mode and Practice Mode to consume.

Related spec: [../product-specs/song-import-pipeline](../product-specs/song-import-pipeline.md)

## Progress

- [x] (2026-03-26 00:00Z) Milestone 1: Install dependencies and scaffold the script
- [ ] Milestone 2: Implement MIDI parsing and JSON output
- [ ] Milestone 3: Validate against the sample MIDI file

## Surprises & Discoveries

_Empty — filled during execution._

## Decision Log

_Empty — filled during execution._

## Outcomes & Retrospective

_Filled at completion._

---

## Context and Orientation

### Repository State

```
.
├── docs/
│   ├── exec-plans/active/    ← this file
│   └── product-specs/
├── src/
│   ├── App.tsx
│   ├── components/ui/
│   ├── lib/utils.ts
│   ├── main.tsx
│   └── midi/
│       └── Comptine_d'un_autre_été_Easy_Version.mid   ← sample file
├── package.json
└── vite.config.ts
```

Key files:

- `src/midi/` — staging area for raw `.mid` files before processing
- `package.json` — scripts go here; uses `pnpm`
- `tsconfig.node.json` — TypeScript config for Node-side scripts

### Technology Stack

- Framework: Vite + React 19
- Language: TypeScript 5.9
- Runtime (script): Node.js via `tsx`
- Package manager: `pnpm`
- Linting/formatting: ESLint + Prettier + lint-staged via Husky

### Dependencies

- `@tonejs/midi` — MIDI parser; produces structured JS objects from `.mid` files. Chosen because it's also the planned playback dependency, keeping the stack unified.
- `tsx` — runs TypeScript directly in Node without a build step

### Current State

- No song data exists in the app yet
- `src/songs/` does not exist
- No script infrastructure exists
- A sample `.mid` file is available at `src/midi/Comptine_d'un_autre_été_Easy_Version.mid` for testing

---

## Plan of Work

### Milestone 1: Install dependencies and scaffold the script

Install `@tonejs/midi` and `tsx`. Create `scripts/process-song.ts` as an empty entry point. Add a `process-song` script to `package.json`. Create the `src/songs/` directory with a `.gitkeep`.

**Result**: `pnpm process-song` runs without error (even if it does nothing yet).

### Milestone 2: Implement MIDI parsing and JSON output

Implement the full script logic:

1. Read the input path from `process.argv[2]`; error if missing or file not found
2. Parse the `.mid` file with `@tonejs/midi`
3. Derive a song slug from the filename (lowercase, hyphens, strip extension)
4. Create `src/songs/<slug>/`
5. Copy the original `.mid` to `src/songs/<slug>/source.mid`
6. Build and write `song.json` — tracks with per-note data (midi number, name, velocity, startMs, durationMs)
7. Build and write `metadata.json` — title, composer (from MIDI meta if available, else `null`), key signature, time signature, tempo, hand assignment
8. Hand assignment logic: 2 tracks → track 0 = right, track 1 = left; 1 track → pitch split at middle C (60); otherwise warn and assign by index
9. Print a summary to stdout: song slug, track count, total notes, duration, which metadata fields were populated vs. null

**Result**: Running the script on the sample file produces a complete `src/songs/comptine-dun-autre-ete-easy-version/` directory.

### Milestone 3: Validate against the sample MIDI file

Run the script on the provided sample file. Inspect the output JSON for correctness. Verify the file structure matches the spec.

**Result**: All acceptance criteria in the spec are met; output is human-readable and correct.

---

## Concrete Steps

### Milestone 1: Install dependencies and scaffold

1. Install dependencies:

   ```bash
   cd /home/omar/workspace/piano-tutor
   pnpm add @tonejs/midi
   pnpm add -D tsx
   ```

   Expected: packages added, `pnpm-lock.yaml` updated.

2. Create `src/songs/` with a placeholder:

   ```bash
   mkdir -p src/songs
   touch src/songs/.gitkeep
   ```

3. Create `scripts/process-song.ts` with a minimal stub:

   ```typescript
   // scripts/process-song.ts
   console.log('process-song: not yet implemented')
   ```

4. Add script to `package.json`:

   ```json
   "process-song": "tsx scripts/process-song.ts"
   ```

5. Verify it runs:
   ```bash
   pnpm process-song
   ```
   Expected: prints `process-song: not yet implemented`

### Milestone 2: Implement the script

Replace `scripts/process-song.ts` with the full implementation. See Interfaces section for the exact JSON schemas.

Key implementation notes:

- Use `new Midi(fs.readFileSync(inputPath))` to parse
- `midi.tracks[i].notes` gives `{ midi, name, velocity, ticks, durationTicks }` per note
- Use `midi.header.tempos` to build the tempo map and convert ticks → ms
- `midi.header.keySignatures` gives key info
- `midi.header.timeSignatures` gives time sig
- Slug: `path.basename(input, '.mid').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`
- Copy source file with `fs.copyFileSync`
- Write JSON with `JSON.stringify(data, null, 2)`

### Milestone 3: Validate

```bash
pnpm process-song "src/midi/Comptine_d'un_autre_été_Easy_Version.mid"
```

Expected output (approximate):

```
Song: comptine-dun-autre-ete-easy-version
Tracks: 2
Total notes: ~XXX
Duration: ~XXXs
Metadata:
  title: null (not in MIDI)
  composer: null (not in MIDI)
  key: <value>
  time signature: <value>
  tempo: <value> BPM
  hands: { right: 0, left: 1 }

Written to src/songs/comptine-dun-autre-ete-easy-version/
```

Then verify files:

```bash
ls src/songs/comptine-dun-autre-ete-easy-version/
# Expected: metadata.json  song.json  source.mid

cat src/songs/comptine-dun-autre-ete-easy-version/metadata.json
cat src/songs/comptine-dun-autre-ete-easy-version/song.json | head -60
```

---

## Validation and Acceptance

### Acceptance Criteria

- [ ] `pnpm process-song <path>` runs without error on the sample file
- [ ] `src/songs/<slug>/source.mid` is a copy of the original file
- [ ] `song.json` contains at least one track with notes; each note has `midi`, `name`, `velocity`, `startMs`, `durationMs`
- [ ] `metadata.json` contains `title`, `composer`, `keySignature`, `timeSignature`, `tempo`, `hands`
- [ ] Fields missing from the MIDI are `null`, not omitted
- [ ] Script prints a human-readable summary on success
- [ ] Script exits with a non-zero code and clear error message if no path is given or file not found
- [ ] `pnpm lint` passes
- [ ] Husky pre-commit passes

---

## Idempotence and Recovery

### Safe to Re-run

Re-running the script will overwrite the output directory. This is acceptable for now — the sample file won't change, and `metadata.json` edits are not yet a workflow concern.

### Rollback

```bash
rm -rf src/songs/comptine-dun-autre-ete-easy-version/
git checkout package.json pnpm-lock.yaml
pnpm install
```

### Known Risks

- **Non-ASCII filename**: The sample file has accented characters. Slug generation must handle them (strip/transliterate to ASCII). Use a replace-all on non-`[a-z0-9]` chars after `.toLowerCase()`.
- **Single-track MIDI**: If the file has one track, hand split falls back to pitch at middle C — result may be musically wrong but won't crash.

---

## Artifacts and Notes

_Filled during execution._

---

## Interfaces and Dependencies

### New Files

- `scripts/process-song.ts` — CLI entry point
- `src/songs/<slug>/source.mid` — original MIDI file
- `src/songs/<slug>/song.json` — parsed note data
- `src/songs/<slug>/metadata.json` — song metadata

### `song.json` Schema

```typescript
interface SongJson {
  ticksPerQuarter: number
  durationMs: number
  tempoChanges: Array<{ tick: number; bpm: number }>
  timeSignature: { numerator: number; denominator: number }
  tracks: Array<{
    hand: 'right' | 'left' | 'unknown'
    notes: Array<{
      midi: number // 0–127
      name: string // e.g. "C4"
      velocity: number // 0–1
      startMs: number
      durationMs: number
    }>
  }>
}
```

### `metadata.json` Schema

```typescript
interface MetadataJson {
  title: string | null
  composer: string | null
  keySignature: string | null // e.g. "C minor"
  timeSignature: string | null // e.g. "3/4"
  tempo: number | null // BPM (first tempo event)
  hands: { right: number; left: number } | null
  source: string // original filename
}
```

### New `package.json` Script

```json
"process-song": "tsx scripts/process-song.ts"
```

### Added Dependencies

- `@tonejs/midi` (runtime) — MIDI parsing
- `tsx` (devDependency) — TypeScript script runner

---

**Metadata**

- **Status**: 🚧 Active
- **Owner**: Omar Skalli
- **Created**: 2026-03-26
- **Started**: —
- **Completed**: —
