# Decisions — beaverGame

Architectural and product decisions for the Cozy Beaver game client. Repo-local; cluster-wide decisions live under `decisions/core/`.

```
decisions/
  adr/     Architecture Decision Records for the game client
  okr/     Objectives and Key Results (when populated)
  core/    Symlink → core/decisions (cluster-wide ADRs, read-only)
```

---

## ADR index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [0001](adr/0001-threejs-vanilla-not-r3f.md) | Three.js vanilla over React Three Fiber | Accepted | 2026-04 |
| [0002](adr/0002-webgl2-defer-webgpu.md) | Ship WebGL2; defer WebGPU behind a feature flag | Accepted | 2026-04 |
| [0003](adr/0003-typescript-everywhere.md) | TypeScript everywhere; Python only as a build artifact | Accepted | 2026-04 |
| [0004](adr/0004-gltf-binary-unlit-vertex-colors.md) | glTF 2.0 binary with KHR_materials_unlit and vertex colors | Accepted | 2026-04 |
| [0005](adr/0005-plain-state-localstorage.md) | Plain TS classes + event bus; localStorage save state | Accepted | 2026-04 |
| [0006](adr/0006-standalone-not-frame-subapp.md) | Standalone repo; not a Frame sub-app for v0 | Accepted | 2026-04 |
| [0007](adr/0007-repo-split-beavergame-asset-foundry.md) | Repo split — beaverGame ↔ asset-foundry | Accepted | 2026-04 |

---

## How to write an ADR

Use `/adr new "<title>"`. Fill in Context, Decision, Consequences (Gains / Costs / Neutral), and Alternatives. When accepted, run `/adr publish` to refresh this index.
