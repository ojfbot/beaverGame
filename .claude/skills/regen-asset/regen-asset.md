---
name: regen-asset
description: Regenerate one or more assets via the sibling asset-foundry pipeline and sync them into public/assets/. Triggers on "regen", "regenerate asset", "rebuild glb".
---

# /regen-asset — Trigger the foundry pipeline

Delegates to `../asset-foundry`'s LangGraph pipeline (WorldDesigner → AssetSculptor → MaterialArtist → SceneAssembler → Validator). The foundry's `gen-asset` script auto-syncs the validated `.glb` and `.validation.json` into this repo's `public/assets/` directory, so a successful run is end-to-end visible to a running `pnpm dev`.

Arguments: `$ARGUMENTS` — one or more `prop_id`s (snake_case). Default: regenerate everything in the manifest.

## Steps

1. Verify the sibling exists at `../asset-foundry`. If not, surface the contract from `decisions/adr/0007-repo-split-beavergame-asset-foundry.md` and stop.
2. Confirm Blender is reachable. Either `blender` is on PATH, or `BLENDER_BIN` points at the installed binary. macOS default: `/Applications/Blender.app/Contents/MacOS/Blender`. If neither resolves, run `bash ../asset-foundry/scripts/install-blender-mcp.sh` for the diagnostic.
3. For each `prop_id`:
   ```bash
   (cd ../asset-foundry && BLENDER_BIN="..." pnpm gen-asset <prop_id>)
   ```
   Watch for `✓ ... validated (N/M tris)` or `✗ pipeline rejected the asset`. The foundry's Validator writes `<id>_v1.validation.json` next to the `.glb`; the sync into `public/assets/` is part of the foundry script.
4. Run `pnpm validate-assets` here to confirm the consumer-side gate passes for the new artefacts.
5. If `pnpm dev` is running, Vite HMR picks up the new `.glb` automatically — suggest the user refresh or run `/snap`.

## Offline vs LLM path

- `ANTHROPIC_API_KEY` unset → AssetSculptor uses `../asset-foundry/fixtures/<prop_id>.py`. The runtime contract on the bpy script is identical either way.
- Key set → AssetSculptor calls Claude. The script lands in `../asset-foundry/dist/scripts/<id>_v1.py`; if you want to re-run with the same generated script, copy it to `fixtures/` and unset the key.

## When the foundry rejects the asset

Read the rejection reason from the Validator's stdout or from `<id>_v1.validation.json`'s `rejection_reason` field. Common causes:
- Tri budget exceeded → tighten the geometry in the bpy fixture.
- `asset_id` mismatch → the named root in the bpy script doesn't match the manifest entry's `id`.
- Blender version mismatch → either the `.blender-version` pin is wrong or `BLENDER_BIN` points at a different install.

## See also

- `/snap` — verify the regenerated asset looks right in the running game.
- `../asset-foundry/CLAUDE.md` — the pipeline architecture and Blender gotchas.
