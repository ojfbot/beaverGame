---
name: snap
description: Take a headless-Chromium screenshot of the running dev server, read it, summarise what the player would see, and surface console errors. The visual iteration loop. Triggers on "snap", "screenshot the game", "what's on screen".
---

# /snap — Visual probe

The fastest feedback loop for tuning the world spawn or any rendering change. Drives a Playwright Chromium against `http://localhost:5173`, screenshots, captures the console, and probes scene state via the `window.__beaver` debug hatch wired in `src/main.ts`.

Arguments: `$ARGUMENTS`

## Preconditions

- The Vite dev server must be running. If `curl -s -o /dev/null http://localhost:5173/` fails, tell the user to run `pnpm dev` (or offer to start it as a background task).
- Playwright + chromium are installed via `pnpm add -D playwright && npx playwright install chromium`. If the install is missing, run those before snapping.

## Steps

1. Run `pnpm tsx scripts/snap.ts`. The script writes `tmp/snap.png`, `tmp/snap.console.txt`, and prints the scene-state probe to stdout.
2. **Read `tmp/snap.png`** with the `Read` tool. Describe what's actually visible: ground / sky band / pond / trees / beaver — and where each sits on screen.
3. Compare to the scene-state probe (camera position, beaver position, child count, vertex-color samples). Common mismatches:
   - Probe shows N children but image has fewer visible → camera framing or fog density.
   - `vertexColorSamples` empty → the glTF has no `COLOR_0` (asset-foundry side bug, see foundry's `_lib.py` `_activate_color`).
   - `cameraPos` and `beaverPos` make sense but model invisible → likely Blender +Y / glTF -Z axis sign flip.
4. If `tmp/snap.console.txt` has a `[pageerror]` or `[error]`, surface it before discussing visuals.
5. Suggest **one** change at a time, edit the file, then re-run `/snap`. Don't batch visual fixes.

## Custom URL or settle time

`SNAP_URL`, `SNAP_OUT`, `SNAP_SETTLE_MS` env vars override the defaults. Useful when the dev server is on a non-standard port or when the world has heavy async loads.

## When NOT to use

- For perceptual regression in CI: that's a different snapshot harness (a future Playwright test). `/snap` is for live iteration only.
- For checking typecheck / tests: use `pnpm typecheck` and `pnpm test` directly — `/snap` only renders the world.

## See also

- `/regen-asset` — when the visual fix lives in the asset, not the client code.
- `scripts/inspect-glb.ts` — when you need to dump a `.glb`'s attributes / materials directly without launching a browser.
