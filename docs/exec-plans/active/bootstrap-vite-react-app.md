# ExecPlan: Bootstrap Vite + React App

## Purpose / Big Picture

Set up the full development environment for Piano Tutor from scratch: Vite + React + TypeScript + Tailwind CSS + shadcn/ui with pnpm, and a Husky pre-commit hook running ESLint and Prettier to enforce code quality on every commit.

Related spec: N/A (foundational scaffolding)

## Progress

- [ ] Milestone 1: Vite + React + TypeScript scaffold
- [ ] Milestone 2: Tailwind CSS
- [ ] Milestone 3: shadcn/ui
- [ ] Milestone 4: ESLint + Prettier
- [ ] Milestone 5: Husky pre-commit
- [ ] Milestone 6: Verify and clean up

## Surprises & Discoveries

## Decision Log

## Outcomes & Retrospective

---

## Context and Orientation

### Repository State

```
piano-tutor/
├── AGENTS.md
├── VISION.md
├── docs/
│   ├── product-specs/
│   │   └── index.md
│   └── exec-plans/
│       ├── active/
│       ├── completed/
│       └── tech-debt.md
└── Little Maestro App.html   (design inspiration only)
```

No application code, no package.json, no tooling — completely fresh.

Key files to be created:

- `package.json` — scripts, lint-staged config, dependencies
- `vite.config.ts` — Vite config with Tailwind plugin
- `src/main.tsx` — app entry point
- `src/App.tsx` — minimal placeholder component
- `src/index.css` — Tailwind import
- `components.json` — shadcn/ui config
- `src/lib/utils.ts` — shadcn/ui utility (cn helper)
- `eslint.config.js` — ESLint flat config
- `.prettierrc` — Prettier config
- `.husky/pre-commit` — pre-commit hook
- `.gitignore`

### Technology Stack

- **Framework**: Vite 6 + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Component library**: shadcn/ui
- **Package manager**: pnpm
- **Linter**: ESLint (flat config, bundled with Vite react-ts template)
- **Formatter**: Prettier + `prettier-plugin-tailwindcss`
- **Git hooks**: Husky + lint-staged

### Current State

Repo is initialized with git and documentation only. No JavaScript/TypeScript project exists yet. All tooling must be created from scratch.

## Plan of Work

### Milestone 1: Vite + React + TypeScript scaffold

**Goal**: Create the base Vite project with React and TypeScript.

**Work**: Run `pnpm create vite` with the `react-ts` template. Then strip Vite's boilerplate from `src/` — keep `main.tsx` and replace `App.tsx` with a minimal `<h1>Piano Tutor</h1>` placeholder. Remove `App.css`, clear `index.css`, remove assets.

**Result**: A working Vite dev server with a blank React app.

**Proof**: `pnpm dev` starts without errors; browser shows "Piano Tutor".

### Milestone 2: Tailwind CSS

**Goal**: Integrate Tailwind CSS v4 via the Vite plugin.

**Work**: Install `tailwindcss` and `@tailwindcss/vite`. Add the plugin to `vite.config.ts`. Add `@import "tailwindcss"` to `src/index.css`. No `tailwind.config.js` needed with v4.

**Result**: Tailwind utility classes work in components.

**Proof**: Add a Tailwind class to `App.tsx` (e.g. `className="text-purple-500"`), `pnpm dev` shows it styled.

### Milestone 3: shadcn/ui

**Goal**: Initialize shadcn/ui for the component library.

**Work**: Run `pnpx shadcn@latest init` — select style=default, base color=neutral, CSS variables=yes. This creates `components.json`, `src/lib/utils.ts` (cn helper), and sets up `@/*` path alias in `tsconfig.json` and `vite.config.ts`.

**Result**: shadcn/ui ready to add components via `pnpx shadcn add <component>`.

**Proof**: `components.json` exists; `pnpm build` succeeds with path aliases resolved.

### Milestone 4: ESLint + Prettier

**Goal**: Add Prettier for formatting and configure it alongside the existing ESLint setup.

**Work**: The Vite react-ts template already includes ESLint with `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`. Add:

- `prettier` — formatter
- `eslint-config-prettier` — disables ESLint rules that conflict with Prettier
- `prettier-plugin-tailwindcss` — auto-sorts Tailwind classes on format

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Extend `eslint.config.js` with `eslint-config-prettier` (must be last).

Add scripts to `package.json`:

```json
"lint": "eslint .",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

**Result**: `pnpm lint` and `pnpm format` both work.

**Proof**: Run both commands; no errors.

### Milestone 5: Husky pre-commit

**Goal**: Run lint-staged on every commit to enforce linting and formatting.

**Work**: Install `husky` and `lint-staged`. Initialize Husky with `pnpm exec husky init`. Update `.husky/pre-commit` to run `pnpm exec lint-staged`.

Add `lint-staged` config to `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

**Result**: Every `git commit` triggers lint + format on staged files.

**Proof**: Stage a file with a formatting issue, run `git commit` — Husky auto-fixes and commit proceeds.

### Milestone 6: Verify and clean up

**Goal**: Confirm the full stack works end-to-end.

**Work**: Add a proper `.gitignore` (node_modules, dist, .env\*, etc.). Run final verification commands.

**Result**: Clean, working project ready for development.

**Proof**: All verification commands pass (see Validation section).

## Concrete Steps

### Milestone 1: Vite + React + TypeScript scaffold

1. Scaffold the project:

   ```bash
   cd /home/omar/workspace/piano-tutor
   pnpm create vite@latest . -- --template react-ts
   ```

   Expected: files generated, prompt to proceed (say yes to overwrite if asked)

2. Install dependencies:

   ```bash
   pnpm install
   ```

   Expected: `node_modules/` created

3. Clean boilerplate — replace `src/App.tsx` with minimal placeholder, remove `src/App.css`, clear `src/index.css`, remove `src/assets/`:

   ```bash
   rm -rf src/assets src/App.css
   ```

4. Write minimal `src/App.tsx`:

   ```tsx
   export default function App() {
     return <h1>Piano Tutor</h1>
   }
   ```

5. Clear `src/index.css` (will be replaced in Milestone 2).

### Milestone 2: Tailwind CSS

1. Install Tailwind and Vite plugin:

   ```bash
   pnpm add -D tailwindcss @tailwindcss/vite
   ```

2. Update `vite.config.ts` to add the plugin:

   ```ts
   import tailwindcss from '@tailwindcss/vite'
   // add to plugins array: tailwindcss()
   ```

3. Replace `src/index.css` content:

   ```css
   @import 'tailwindcss';
   ```

4. Verify:
   ```bash
   pnpm dev
   ```

### Milestone 3: shadcn/ui

1. Run shadcn init:

   ```bash
   pnpx shadcn@latest init
   ```

   Select: style=default, base color=neutral, CSS variables=yes

2. Verify build:
   ```bash
   pnpm build
   ```
   Expected: `dist/` created, no TypeScript errors

### Milestone 4: ESLint + Prettier

1. Install:

   ```bash
   pnpm add -D prettier eslint-config-prettier prettier-plugin-tailwindcss
   ```

2. Create `.prettierrc`:

   ```json
   {
     "semi": false,
     "singleQuote": true,
     "plugins": ["prettier-plugin-tailwindcss"]
   }
   ```

3. Update `eslint.config.js` to extend with `eslint-config-prettier` (add last).

4. Add scripts to `package.json` (`lint`, `format`, `format:check`).

5. Verify:
   ```bash
   pnpm lint
   pnpm format:check
   ```

### Milestone 5: Husky pre-commit

1. Install:

   ```bash
   pnpm add -D husky lint-staged
   pnpm exec husky init
   ```

2. Update `.husky/pre-commit`:

   ```sh
   pnpm exec lint-staged
   ```

3. Add `lint-staged` config to `package.json`.

4. Test:
   ```bash
   git add src/App.tsx
   git commit -m "test: verify husky hook"
   ```
   Expected: lint-staged runs, commit succeeds

### Milestone 6: Verify and clean up

1. Add `.gitignore` with standard entries (node_modules, dist, .env*, *.local).

2. Final checks:
   ```bash
   pnpm lint
   pnpm format:check
   pnpm build
   ```

## Validation and Acceptance

```bash
pnpm lint          # ESLint: no errors
pnpm format:check  # Prettier: no diffs
pnpm build         # TypeScript compiles, dist/ produced
pnpm dev           # Dev server starts at localhost:5173
```

Manual: stage a `.tsx` file and run `git commit` — Husky runs lint-staged without error.

### Acceptance Criteria

- [ ] `pnpm dev` starts the dev server and shows the app
- [ ] `pnpm build` produces a clean `dist/` with no TypeScript errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm format:check` passes
- [ ] Tailwind classes render correctly in the browser
- [ ] `pnpx shadcn add button` works (can add a component)
- [ ] `git commit` triggers Husky pre-commit hook

## Idempotence and Recovery

If something goes wrong mid-setup:

```bash
# Reset to docs-only state
git checkout main
git clean -fd          # remove untracked files (node_modules, dist, etc.)
```

Then re-run from the relevant milestone.

## Artifacts and Notes

## Interfaces and Dependencies

### New Dev Dependencies

- `vite` — build tool and dev server
- `react`, `react-dom` — UI framework
- `typescript` — type checking
- `tailwindcss`, `@tailwindcss/vite` — styling
- `shadcn/ui` (via CLI) — component library
- `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` — linting (from template)
- `prettier`, `eslint-config-prettier`, `prettier-plugin-tailwindcss` — formatting
- `husky`, `lint-staged` — git hooks

---

**Metadata**

- **Status**: 🚧 Active
- **Owner**: Omar Skalli
- **Created**: 2026-03-26
- **Started**: —
- **Completed**: —
