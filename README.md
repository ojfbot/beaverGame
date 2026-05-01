# beaverGame

Babylon.js client for **Cozy Beaver** — a cozy 3D beaver simulator. Loads validated low-poly `.glb` artifacts produced by the sibling repo [`asset-foundry`](../asset-foundry).

## Quickstart (5 commands)

```bash
pnpm install
pnpm test
pnpm dev
# in another terminal, regenerate assets:
(cd ../asset-foundry && BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender" pnpm gen-asset birch_sapling)
pnpm build
```

Open <http://localhost:5173> after `pnpm dev`. The Three.js vertical slice featured procedural heightfield terrain, tree felling, log hauling with land/water speed modifiers, dam building with rising water, and terrain-clipped water rendering. These behaviours serve as test oracles for the ongoing Babylon.js migration.

## Architecture

Babylon.js + Vite + TypeScript. No React. No Module Federation. The dev-mode asset loader refuses to load any `.glb` without a sibling `.validation.json` declaring `status: "validated"` — that file is produced by `asset-foundry`'s deterministic Validator.

Read [`CLAUDE.md`](CLAUDE.md) for the project map and key ADRs, then [`decisions/adr/`](decisions/adr/) for the architectural decisions behind the choices.

## Phase 0 status (closed)

- [x] Vite + TS + Babylon.js scaffold builds cleanly
- [x] `.glb` loads with a dev-mode validation tripwire
- [x] Procedural environment lighting (HDRI substitute until Phase 1)
- [x] One asset (`birch_sapling`) round-trips from foundry → validator → browser
- [ ] Committed HDRI replacing the `RoomEnvironment` fallback
- [x] CI workflow (typecheck + test + build) gating PRs

## Vertical-slice milestones

- [x] M-α · Procedural heightfield terrain
- [x] M-β · Approach + hold E to fell tree, spawn log
- [x] M-γ · Pickup, carry, drop with land/water speed modifiers
- [x] M-δ · Build dam, water rises behind it
- [x] M-ε · Terrain-clipped water + tuned palette

## License

Private, internal. Not for redistribution.
