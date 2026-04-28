# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Three.js client for **Cozy Beaver** — a cozy 3D beaver simulator. Vanilla TypeScript + Vite + Three.js. The game loads validated `.glb` artifacts produced by the sibling repo [`asset-foundry/`](../asset-foundry). No runtime AI ships in the client (see `decisions/adr/0006-standalone-not-frame-subapp.md`).

**First read for new sessions:** `domain-knowledge/frame-os-context.md` for the cluster context, then this repo's `decisions/adr/`.

## Architecture (the big picture)

The client is a **single-canvas, no-React, vanilla Three.js scene** with a thin module split:

- `src/main.ts` — 22-line bootstrap: instantiates `SceneBootstrap`, kicks off `composeWorld`, then `spawnPlayer`, hands the player's `update` to the bootstrap as the per-frame tick. Exposes `window.__beaver` for the Playwright snap script.
- `src/scene/bootstrap.ts` — renderer/camera/RAF lifecycle. Pattern adapted from `landing/src/components/Hero/shader.ts:84–187` (start/resize/destroy with explicit RAF cancellation). The renderer ships with **`THREE.NoToneMapping`** intentionally — ACES washes our unlit vertex-colour palette to near-white.
- `src/scene/world.ts` — `composeWorld(scene)` loads ground/sky/pond/saplings in parallel, scatters trees deterministically, applies a forward-bias filter so the spawn view is populated. Uses a custom mulberry32 PRNG with a fixed seed so the layout is reproducible.
- `src/scene/player.ts` — `spawnPlayer(scene)` returns a handles object whose `update(dt, camera)` does WASD movement + 3rd-person follow camera with soft lag. Beaver model from glTF faces **-Z** (Blender +Y forward → glTF -Z), so `forward` and `cameraOffset` use negative Z signs accordingly.
- `src/scene/load-glb.ts` — `GLTFLoader` wrapper. **In dev mode, refuses to load any `.glb` without a sibling `<asset>.validation.json` declaring `status: "validated"`.** This is the contract with asset-foundry.
- `src/scene/materials.ts` — `enforceVertexColorMaterials(group, opts?)` walks the loaded glTF and swaps any `MeshStandardMaterial` with a COLOR_0 attribute to `MeshBasicMaterial({vertexColors: true, side: DoubleSide})`. Belt-and-braces against glTFs that didn't ship as KHR_materials_unlit.
- `src/scene/lighting.ts` — `applyHdriEnvironment(scene, hdrPath)`. Sniffs Content-Type because Vite's SPA fallback returns `200 text/html` for missing assets, which would otherwise feed HTML into RGBELoader. Currently a no-op (no committed HDRI); fine because all materials are unlit.
- `src/scene/types.ts` — TypeScript shape mirroring the `<asset>.validation.json` schema produced by `asset-foundry/src/validator/`.

## Contract with asset-foundry

Every `.glb` under `public/assets/` must have a sibling `<asset>.validation.json` with `status: "validated"`. To regenerate any asset:

```bash
cd ../asset-foundry
BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender" pnpm gen-asset <prop_id>
# auto-syncs into ../beaverGame/public/assets/
```

Manifest of asset IDs lives in `../asset-foundry/manifest/world.yaml` (Zod-validated by `manifest/schema.ts`).

## Dev commands

```bash
pnpm install                       # one-time
pnpm dev                           # vite at http://localhost:5173
pnpm typecheck                     # tsc --noEmit (no emit — see "Build gotchas")
pnpm test                          # vitest run
pnpm build                         # vite build
pnpm validate-assets               # consumer-side: every public/assets/*.glb has a passing sibling manifest

pnpm tsx scripts/snap.ts           # headless Chromium screenshot to tmp/snap.png + scene state probe
pnpm tsx scripts/inspect-glb.ts <path>   # diagnostic: per-mesh attrs, materials, KHR_unlit, vertex-color sample, tri count vs declared budget. `--help` for usage.
```

The snap script is the iteration loop while changing visuals: edit code → save → `pnpm tsx scripts/snap.ts` → read `tmp/snap.png`. Vite HMR is on for the live browser.

## Build gotchas

- **`tsconfig.json` has `"noEmit": true`** and `pnpm build` runs `vite build` only (no `tsc -b`). Reason: an earlier `tsc -b` left `.js` shadow files in `src/` (e.g. `src/scene/bootstrap.js`). Vite's resolver picks `.js` next to `.ts` first, which silently froze the runtime on stale class definitions and produced confusing "method is not a function" errors. **Never re-enable emit in this tsconfig** — typecheck stays via `tsc --noEmit`.
- **`THREE.WebGLRenderer.toneMapping = THREE.NoToneMapping`** in `bootstrap.ts`. Switching to ACES will wash the entire palette unless you also switch to lit (PBR) materials and a real HDRI.
- **Vite's SPA fallback returns 200/text/html for missing public assets**. Any code that tries to load `/assets/foo.<ext>` should sniff Content-Type before parsing the body. See `src/scene/lighting.ts` for the pattern.

## Player + camera coordinate system

Blender models authored with `+Y` as forward export to glTF with `-Z` as forward. The follow camera and WASD direction code use negative-Z signs accordingly. If you import a model that was authored facing a different axis, you'll see the camera framing the model's back instead of its head, or W moving "backward" — flip the relevant signs in `src/scene/player.ts`.

## Key ADRs (this repo)

| ADR | Subject |
|----|--------|
| [0001](decisions/adr/0001-threejs-vanilla-not-r3f.md) | Three.js vanilla over React Three Fiber |
| [0002](decisions/adr/0002-webgl2-defer-webgpu.md) | WebGL2 ship, WebGPU later |
| [0003](decisions/adr/0003-typescript-everywhere.md) | TS everywhere; Python only as build artifact |
| [0004](decisions/adr/0004-gltf-binary-unlit-vertex-colors.md) | glTF `.glb` + KHR_materials_unlit + vertex colours |
| [0005](decisions/adr/0005-plain-state-localstorage.md) | Plain TS classes + event bus + localStorage |
| [0006](decisions/adr/0006-standalone-not-frame-subapp.md) | Standalone repo (not a Frame sub-app for v0) |
| [0007](decisions/adr/0007-repo-split-beavergame-asset-foundry.md) | Repo split with asset-foundry |

Cluster-wide ADRs are accessible at `decisions/core/adr/` (symlink — read-only by convention).

## Available skills

The full ojfbot skill tree is symlinked into `.claude/skills/` via `core/scripts/install-agents.sh`. Useful here: `/scaffold`, `/adr`, `/validate`, `/hardening`, `/deploy`, `/sweep`. Run `/init` to refresh this file or `/recon` for a structured codebase tour.

## Current state

See [`.github/planning/MODE_A_CURRENT_STATE.md`](.github/planning/MODE_A_CURRENT_STATE.md) for what's actually shipped (Mode A vertical slice + UI overlays + collision). Read this before adding a new system — it documents the tick order, the cross-system contracts, and the ADR/PR provenance per piece.

## Punch list (active)

- **BG-001** Commit a Poly Haven HDRI under `public/assets/hdri/`. Currently `applyHdriEnvironment` is a no-op because no HDRI is committed; getting one in keeps the lighting code path exercised before we add lit materials.
- **BG-003** CI snap-and-diff visual regression on top of the existing `typecheck + test + build` workflow.
- **BG-004** Vitest coverage for `load-glb.ts`'s dev-mode validation tripwire (cross-repo seam, currently zero tests).
- **BG-005** Replace the deterministic mulberry32 scatter with Poisson-disk sampling for evener tree spread.
- **BG-015** Audit `enforceVertexColorMaterials`: foundry exports as `MeshStandardMaterial` (not `KHR_materials_unlit`); the runtime patch is doing real work, not belt-and-braces. Cross-repo with asset-foundry.
- **birch_log fixture** — replace the inline procedural log mesh in `src/scene/log.ts` with a foundry-generated asset (round-trips the asset contract one more time).

## Closed since the last reconcile

- ✅ **BG-002** Bound the WASD controller — soft pull-back instead of hard wall, tested in `src/scene/bounds.test.ts` (PR [#20](https://github.com/ojfbot/beaverGame/pull/20))
- ✅ **BG-008** Terrain heightfield — multi-octave value noise, slope-aware tree scatter, vertex-coloured grass→creek→highland gradient (sandbox-loop M-α, PR [#2](https://github.com/ojfbot/beaverGame/pull/2))
- ✅ **BG-007** Water shader spike — height-clipped fragment shader with depth-fade tint, decision recorded as Option B for AF-009 (sandbox-loop M-δ + M-ε)
- ✅ **BG-012/013/014** Felling / hauling / damming basic loop (sandbox-loop M-β/γ/δ, PR [#23](https://github.com/ojfbot/beaverGame/pull/23) added held-E gnaw, wood chips, stump after fall, plus collision)
- ✅ **BG-017** `inspect-glb.ts` polish (PR [#20](https://github.com/ojfbot/beaverGame/pull/20))
- ✅ **UI overlays** Minimap + keybind help panel (PR [#21](https://github.com/ojfbot/beaverGame/pull/21))
- ✅ **Trunk collision** Cylinder colliders, swap to stump on fall (PR [#23](https://github.com/ojfbot/beaverGame/pull/23))
