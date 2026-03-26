# Technical Debt

Known technical debt and areas for improvement.

## High Priority

## Medium Priority

## Low Priority / Future

**Slug generation drops accented characters**

- Impact: Song directories get mangled names (e.g. `comptine-d-un-autre-t-easy-version` instead of `comptine-dun-autre-ete`)
- Context: `toLowerCase()` doesn't strip diacritics; quick fix was acceptable for initial import
- Proposed fix: Add `slugify` package with unicode normalization
- Related: [completed/song-import-pipeline](completed/song-import-pipeline.md)
- Date logged: 2026-03-26

**`process-song` silently overwrites existing output**

- Impact: Re-running the script clobbers manual edits to `metadata.json` (e.g. corrected title/composer)
- Context: No overwrite guard was added to keep the initial implementation simple
- Proposed fix: Check for existing `source.mid` and error unless `--overwrite` flag is passed
- Related: [completed/song-import-pipeline](completed/song-import-pipeline.md)
- Date logged: 2026-03-26

**Songs with non-zero start time need handling in Study/Practice Mode**

- Impact: First note in some MIDI files doesn't start at 0ms — the leading empty region could cause off-by-offset rendering
- Context: Valid MIDI behavior; not addressed in import pipeline
- Proposed fix: Study/Practice Mode should offset or trim the timeline so playback starts at the first note
- Related: [completed/song-import-pipeline](completed/song-import-pipeline.md)
- Date logged: 2026-03-26

---

## Process

When completing an execution plan:

1. Identify any shortcuts or compromises made
2. Document them here with context
3. Link to the completed exec plan
4. Estimate priority based on impact

Technical debt is not inherently bad - it's often the right trade-off. This document ensures we're conscious about our debt and can address it strategically.
