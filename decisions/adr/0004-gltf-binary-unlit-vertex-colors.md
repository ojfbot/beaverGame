# ADR-0004: glTF 2.0 binary with KHR_materials_unlit and vertex colors

Date: 2026-04
Status: Accepted
OKR: 2026-Q2 / O1 / KR1 (Phase 0 spike)
Commands affected: /scaffold, /validate
Repos affected: beaverGame, asset-foundry

---

## Context

The art direction is low-poly Firewatch-adjacent: flat-shaded geometry, painterly silhouettes, hand-tuned palettes. Most hero props look better unlit — they fight a dynamic lighting solution and lose silhouette clarity. Vertex colors compress better than textures, version cleanly in git diffs, and remove a whole class of UV-layout decisions from the asset pipeline.

## Decision

All shipped assets are glTF 2.0 binary (`.glb`).
- Hero stylized props (trees, rocks, dam sticks, lodge sticks) use `KHR_materials_unlit`.
- Surfaces that need light response (water, beaver fur once introduced) use standard PBR.
- Color information lives in **vertex colors** wherever possible. Textures only when the asset genuinely needs spatial detail.

## Consequences

### Gains
- Tiny bundles. A Phase-0 sapling at 600 tris with vertex colors is ~10KB.
- Clean diffs: vertex color changes show up as small numerical deltas in the validator's thumbnail snapshot.
- One asset format end-to-end. No FBX, no OBJ, no engine-specific binaries.
- `KHR_materials_unlit` removes lighting setup as a per-asset decision.

### Costs
- Vertex colors can't express ramps or noise patterns; some assets that need those will need textures or vertex-attribute hacks.
- Mixing unlit and PBR materials in the same scene requires care so unlit props don't read flat against lit water.

### Neutral
- glTF 2.0 is the de-facto Three.js exchange format; GLTFLoader handles both extensions natively.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| FBX | Bigger; Three.js loader is less mature; weaker tooling around vertex colors. |
| USD | Still maturing in browsers; tooling story not solved for our pipeline. |
| Per-asset albedo textures | Bigger bundles, dirtier diffs, more pipeline ceremony. |
| All PBR (no unlit) | Loses the deliberately stylized look; lighting-tuning becomes per-asset overhead. |
