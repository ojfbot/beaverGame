# Mode A — Current State

What the running game actually does today, on `main`. Companion to [`MODE_B_WATERSHED_v0.1.md`](MODE_B_WATERSHED_v0.1.md) (planning) and to the issue plan in [`HANDOFF.md`](HANDOFF.md).

This file is the orientation surface for new sessions. Update it whenever a substantive system lands or changes shape. Don't let it rot.

---

## What ships

### World

- **Procedural heightfield terrain** — multi-octave value noise, seeded for repeatability. 96×96 grid over a 40u square patch. A meandering creek bed runs W→E, carved by reducing height along a sine-modulated centre-line. Vertex colours grade by height: creek-bed slate-green → grass → highland dirt. `MeshLambertMaterial`, flat-shaded, with a `HemisphereLight` + `DirectionalLight` for the painterly read.
- **Sky dome** — kept from Phase 0 foundry asset; provides the gold-to-pale gradient horizon ring.
- **Tree scatter** — 32 birch saplings (foundry asset `birch_sapling_v1.glb`), positioned via the same seeded RNG as terrain. Slope rejection above ~26°, low-elevation rejection (creek bed). Random scale (0.85–1.4×) and yaw per instance.
- **Player** — beaver placeholder (foundry asset `beaver_basic_v1.glb`), spawns at `(0, terrain.heightAt(0,4), 4)`.

### Player + camera

- **WASD / arrows** move; **Shift** sprints (1.8×). Beaver yaw=0 faces -Z (Blender +Y → glTF -Z conversion). Head bob while walking, no bob standing still.
- **3rd-person follow camera** with soft lag — sits at `(0, 2.4, +4.5)` relative to the beaver's facing, lerped toward target with damping factors `4.5` (position) / `6` (look-at).
- **Soft-bound to the patch edge** — pure function `applySoftBound` in `src/scene/bounds.ts`. Hard clamp at 0.6u from the edge, gentle quadratic pull-back inside a 1.5u soft margin so the boundary feels cozy rather than wall-like. (BG-002, PR #20)
- **Cylinder collision against trees + stumps** — registry in `src/scene/collision.ts`; player resolves out tangentially after movement, before terrain bound. Trees register a 0.18×scale collider; on fell, the trunk collider is removed and a smaller stump collider is added at the base. (PR #23)

### Felling → hauling → damming loop (the Mode A verbs)

Tick order in `src/main.ts`: `felling.update → hauling.update → damming.update → player.update → ui.update`.

- **Held E to fell** — within 1.6u of a tree, holding E accumulates gnaw progress over 2.6s. Trunk darkens via vertex-colour modulation. Wood-chip particles emit every 0.18s during gnaw plus a triumphant burst at fall-start (`src/scene/particles.ts`, 96-mesh pool). Tree falls 90° around base over 1s in the direction *away* from the player. On fall: spawn 1 log along the fall direction, spawn a stump at the base, hide the fallen-tree group, swap collider trunk→stump.
- **E to pickup / drop** (edge-trigger) — within 1.2u of a grounded log, E picks it up. Log follows hip-height behind the beaver with sinusoidal bob. E again drops at the player's feet. Speed multiplier 0.7× while carrying on land, 1.4× while in water (sample `damming.waterLevel` against player Y). Multiplicative.
- **Drop log at dam site** — precomputed dam site at the eastern creek outflow (`terrain.damSite`). Marker = pair of stakes + faint contribution ring. Drop a carried log within 1.4u → status flips to `placed`, log snaps to the dam, water target rises by 0.35u per log. Water level lerps toward target.
- **Water plane** — custom `ShaderMaterial`, fragment-shader samples a `DataTexture` of the heightmap and `discard`s where ground is above water level (so the flood is contained by topography). Depth-fade between shallow `#bce0d8` and deep `#5a8aa0`, sinusoidal Y ripple, `transparent: true`.

### UI overlays (DOM, over canvas)

- **Minimap** top-right (180×180 Canvas2D) — terrain heightmap baked once at init; per frame composites a water polygon (samples heightAt vs waterLevel), tree dots (green standing / brown fallen), log dots (gold placed / amber carried / brown ground), dam-site ring + stack, player triangle pointing along facing.
- **Controls panel** bottom-left (HTML) — five rows: WASD / ↑↓←→ / Shift / E / ?. Each key chip highlights orange while held (uses `event.code`, layout-independent). `?` toggles the panel. Blur clears stale held-state.

Both panels are `pointer-events: none` so input still routes to the canvas.

### Renderer

- `THREE.WebGLRenderer` with `outputColorSpace = SRGBColorSpace` and **`toneMapping = NoToneMapping`** (ACES washes the unlit vertex-colour palette to near-white).
- Pixel-ratio capped at 2, antialias on, no shadow casting (deferred polish).
- Scene background `#d8e4d2`, fog `FogExp2(#d8e4d2, 0.020)`.

### Tests + CI

- **16 unit tests** across `bootstrap.test.ts`, `bounds.test.ts`, `collision.test.ts` (and the foundry's `manifest/schema.test.ts` which runs on the foundry side).
- **CI** runs `pnpm typecheck && pnpm test && pnpm build && pnpm validate-assets` on every PR.
- **Playwright snap script** at `scripts/snap.ts` drives the live dev server, takes a screenshot, probes scene state via the `__beaver` debug hatch (dev-only). Used for visual iteration; not yet wired to a CI baseline diff.

## Tick contract

Each tick (per frame):

1. `felling.update(dt, player)` — claims `interactHeld` for gnaw progress; consumes nothing from `interactQueued`.
2. `hauling.update(dt, player, felling.logs)` — claims `interactQueued` (edge-trigger) for pickup/drop; writes `speedMultiplier` based on carry + water state.
3. `damming.update(dt, player, hauling, felling.logs)` — checks for grounded logs near the dam site; promotes them to `placed`; lerps water level.
4. `player.speedMultiplier = hauling.speedMultiplier`.
5. `player.update(dt, camera)` — applies movement with `speedMultiplier`, resolves against colliders, soft-bounds to terrain edge, samples terrain height, updates camera.
6. `ui.update()` — minimap repaint.

## Hard-won gotchas (don't let these drift)

- **Stale `.js` shadow files.** An earlier `tsc -b` left `.js` files in `src/` that Vite preferred over `.ts`, freezing the runtime on stale class definitions. tsconfig is now `noEmit: true`; `pnpm build` runs `vite build` only.
- **`THREE.NoToneMapping`** is intentional. ACES washes the unlit palette to near-white.
- **Vite SPA fallback returns 200/text/html** for missing public assets. Code that loads `/assets/foo.<ext>` should sniff `Content-Type` before parsing. `src/scene/lighting.ts` is the canonical example.
- **Blender +Y forward → glTF -Z forward.** Camera offset uses positive Z (camera behind beaver in world +Z). WASD `forward()` uses `(-sin(yaw), 0, -cos(yaw))`.
- **`__beaver` debug hatch is DEV-only** (gated by `import.meta.env.DEV`). Production bundle has no scenario rigs.

## Cross-repo contract with asset-foundry

Every `.glb` under `public/assets/` must have a sibling `<asset>.validation.json` with `status: "validated"`. The dev-mode loader in `src/scene/load-glb.ts` refuses to load otherwise. Generated by foundry's deterministic Validator; foundry auto-syncs new artefacts into `public/assets/` on `pnpm gen-asset`.

The foundry recently moved to a **multi-target architecture** (ADR-0006 / ADR-0007 in foundry repo): each consuming game owns its own `asset-foundry/` subdirectory with `world.yaml`, `palettes.yaml`, and per-target `fixtures/`. beaverGame is the canonical sibling target. Once that lands fully, beaverGame will gain `asset-foundry/` at the repo root.

## What's NOT here yet (gaps to flag for new sessions)

- No save/load — world resets on reload.
- No NPCs, no day/night cycle, no audio cues.
- No real fluid sim — water is `baseLevel + 0.35 × log_count` linear.
- No `birch_log` foundry fixture — log mesh is procedural inline.
- No HDRI committed — `applyHdriEnvironment` is a no-op until BG-001 lands.
- The fallen-tree group is hidden after fall (so the scene reads cleanly as stump+log); the original lying-trunk is invisible.
