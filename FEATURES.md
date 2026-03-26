# Features

Shipped features in Piano Tutor.

## Developer Tooling

**Song Import Pipeline**

- Spec: [docs/product-specs/song-import-pipeline](docs/product-specs/song-import-pipeline.md)
- Execution: [docs/exec-plans/completed/song-import-pipeline](docs/exec-plans/completed/song-import-pipeline.md)
- Status: ✅ Production
- Shipped: 2026-03-26

Run `pnpm process-song <path-to-midi>` to parse a MIDI file and write structured JSON to `src/songs/<slug>/`.

---

Owner: Omar Skalli
Last updated: 2026-03-26
