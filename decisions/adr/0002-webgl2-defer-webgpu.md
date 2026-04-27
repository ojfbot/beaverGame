# ADR-0002: Ship WebGL2; defer WebGPU behind a feature flag

Date: 2026-04
Status: Accepted
OKR: 2026-Q2 / O1 / KR2 (broad device coverage at Phase 5)
Commands affected: /deploy, /hardening
Repos affected: beaverGame

---

## Context

Three.js's `WebGPURenderer` is viable on Chrome and recent Safari, but coverage on consumer laptops (Firefox stable, older integrated GPUs, certain Linux configurations) is still uneven. The Phase 0 spike target is "loads in <8s on a mid-tier laptop" — we want the broadest safe substrate.

## Decision

Render via `WebGLRenderer` (WebGL2) for v0 through Phase 5. Add `WebGPURenderer` later as a feature-flagged code path once the prototype is stable and the WebGPU surface area has matured for our target users.

## Consequences

### Gains
- Works on every laptop the prototype targets.
- One renderer to test, profile, and snapshot in visual regression CI.
- Custom shaders ship as GLSL — well-understood toolchain.

### Costs
- We leave compute-shader perf and modern API ergonomics on the table.
- A future WebGPU port will require revisiting any custom GLSL shaders.

### Neutral
- HDRI loading, GLTFLoader, PMREMGenerator are renderer-agnostic.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| WebGPU only | Coverage gaps on non-Chromium browsers and older GPUs. |
| Feature-detect both at runtime | Doubles the test matrix; not justified for a single-pond Phase 3 scene. |
| WebGL1 | Fewer shader features; not worth supporting given WebGL2 ubiquity. |
