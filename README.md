# beaverGame

Three.js client for **Cozy Beaver** — a cozy 3D beaver simulator. Loads validated low-poly `.glb` artifacts produced by the sibling repo [`asset-foundry`](../asset-foundry).

## Quickstart (5 commands)

```bash
pnpm install
pnpm test
pnpm dev
# in another terminal, regenerate assets:
(cd ../asset-foundry && BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender" pnpm gen-asset birch_sapling)
pnpm build
```

Open <http://localhost:5173> after `pnpm dev`. The Phase 0 spike shows a stylized birch sapling rotating slowly in a procedurally lit scene.

## Architecture

Vanilla Three.js + Vite + TypeScript. No React. No Module Federation. The dev-mode `GLTFLoader` wrapper refuses to load any `.glb` without a sibling `.validation.json` declaring `status: "validated"` — that file is produced by `asset-foundry`'s deterministic Validator.

Read [`CLAUDE.md`](CLAUDE.md) for the project map and key ADRs, then [`decisions/adr/`](decisions/adr/) for the architectural decisions behind the choices.

## Phase 0 status

- [x] Vite + TS + Three.js scaffold builds cleanly
- [x] `.glb` loads via `GLTFLoader` with a dev-mode validation tripwire
- [x] Procedural environment lighting (HDRI substitute until Phase 1)
- [x] One asset (`birch_sapling`) round-trips from foundry → validator → browser
- [ ] Committed HDRI replacing the `RoomEnvironment` fallback
- [ ] CI workflow (typecheck + test + build) gating PRs

## License

Private, internal. Not for redistribution.
