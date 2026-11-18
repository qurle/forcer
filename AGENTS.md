# AGENTS.md

Context for coding agents working on this repo. See `readme.md` for what the plugin does from a user's point of view.

## Project

Forcer is a Figma plugin that binds variables to layer fields regardless of variable scopes. The design system team uses it to apply kit-only variables (scopes set to empty, hidden from other designers) to components in the kit file before publishing.

## Stack and layout

- Vite + Svelte 5 UI, inlined into one HTML file with `vite-plugin-singlefile`
- TypeScript main thread, built separately (`vite.config.code.ts`)
- `src/code/`: main thread
  - `main.ts`: entry, message routing
  - `selection.ts`: reads the selection, structure signatures (fill/stroke/effect/grid counts must match)
  - `fields.ts`: field registry (Size, Auto layout, Corner radius, Fill, Stroke, Effects, More)
  - `apply.ts`: binding/detaching, per-node errors, single undo step
  - `catalog.ts`: local and team-library collections, lazy variable import
  - `storage.ts`: clientStorage cache
- `src/shared/types.ts`: typed message protocol between main thread and UI
- `src/ui/`: Svelte app and components

## Commands

- `npm install`
- `npm run check`: tsc + svelte-check
- `npm run build`: outputs `dist/code/code.js` and `dist/ui/index.html`
- `npm run dev`: watch both

Install in Figma desktop: Plugins → Development → Import plugin from manifest → `manifest.json`.

## Testing

Main-thread logic can be tested without installing the plugin, through the Figma MCP `use_figma` tool on the kit file (fileKey `HXrxAb4Mai5tZ6ihtltpxd`): bundle `src/code` modules with esbuild into an IIFE that exposes functions on `globalThis`, paste it into `use_figma`, and run it on scratch frames that the script removes in a `finally` block.

`figma.commitUndo` and `clientStorage` don't work in the `use_figma` environment. Both are wrapped to fail safe and must be checked in Figma desktop.

## Status and open items

- Not yet tested as an installed plugin in Figma desktop: undo grouping, clientStorage cache, gradient stop binding.
- Effects are listed in reverse array order (like fills). Might need flipping if Figma's panel shows them the other way.
- The Lego Tokens "Constants" collection returns 0 variables via the teamLibrary API. Probably primitives hidden from publishing. Unconfirmed.
- `manifest.json` id is still the template placeholder. Needs a real id from Figma before publishing.

## Skills

Project skills live in `.claude/skills/<name>/SKILL.md` and load automatically at session start.

- `impecable`, `better-ui`: stubs. Paste the real skill content into their `SKILL.md` (plus any referenced files in the same folder).
- `unslop`: already available through the claude.ai account as `anthropic-skills:unslop`. No copy needed here.
