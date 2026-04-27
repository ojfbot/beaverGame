# ADR-0001: Three.js vanilla over React Three Fiber

Date: 2026-04
Status: Accepted
OKR: 2026-Q2 / O1 / KR1 (Phase 0 spike)
Commands affected: /scaffold, /scaffold-app
Repos affected: beaverGame

---

## Context

The game loop wants a deterministic update tick: gather input → step simulation → render. React Three Fiber inserts a React reconciler between simulation state and the renderer, which is excellent for UI-heavy 3D and rapid scene composition but is not what we want for a sim tick that needs to be predictable, profilable, and easy to step in a debugger. v0 has no in-game UI layer; the only HTML chrome is a full-viewport canvas.

## Decision

Use vanilla Three.js with our own RAF loop. No React, no R3F. Reuse the lifecycle pattern from `landing/src/components/Hero/shader.ts` (start/resize/setup/destroy) for the renderer bootstrap.

## Consequences

### Gains
- Deterministic update tick, no hidden reconciliation between sim and frame.
- Smaller bundle: no React, no @react-three/fiber, no @react-three/drei.
- Profiling and debugging the loop is straightforward — the call stack is short.

### Costs
- Hand-rolled scene composition. No JSX-style declarative scene graphs.
- If we later want an in-game UI (HUD, dialogs), we'll add either a React island or a vanilla overlay.

### Neutral
- Three.js TypeScript types are first-class either way; this is purely a wrapper choice.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| React Three Fiber | Reconciler indirection between sim and renderer; no v0 UI to justify it. |
| Babylon.js | Ecosystem mismatch with the rest of the cluster (cv-builder, landing both use Three.js). |
| Pixi.js | 2D renderer; wrong target. |
