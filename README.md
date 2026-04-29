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

Open <http://localhost:5173> after `pnpm dev`. The scene now includes tree felling (hold-E gnaw mechanic with wood chips and stumps), cylinder collision so the beaver can't walk through trunks, a minimap overlay, keybind help panel, and soft-bound player movement on a terrain patch.

## Architecture

Babylon.js + Vite + TypeScript. No React. No Module Federation. The dev-mode GLB loader refuses to load any `.glb` without a sibling `.validation.json` declaring `status: "validated"` — that file is produced by `asset-foundry`'s deterministic Validator.

Read [`CLAUDE.md`](CLAUDE.md) for the project map and key ADRs, then [`decisions/adr/`](decisions/adr/) for the architectural decisions behind the choices.

## Phase 0 status

- [x] Vite + TS + Babylon.js scaffold builds cleanly
- [x] `.glb` loads with a dev-mode validation tripwire (Vitest coverage for all four rejection paths)
- [x] Procedural environment lighting (HDRI substitute until Phase 1)
- [x] One asset (`birch_sapling`) round-trips from foundry → validator → browser
- [x] Tree felling mechanic (hold-E gnaw, wood chips, stump)
- [x] Cylinder colliders on trunks
- [x] Minimap overlay + keybind help panel
- [x] Player soft-bound to terrain patch
- [ ] Committed HDRI replacing the `RoomEnvironment` fallback
- [ ] CI workflow with snap-and-diff step gating PRs

## License

Private, internal. Not for redistribution.
