# ADR-0006: Standalone repo; not a Frame sub-app for v0

Date: 2026-04
Status: Accepted
OKR: 2026-Q2 / O1 / KR1 (Phase 0 spike)
Commands affected: /scaffold-app, /scaffold-frame-app, /deploy
Repos affected: beaverGame

---

## Context

Frame is the cluster's AI-native application compositor: a Vite Module Federation host that loads sub-apps as React remotes, sharing Redux Toolkit and Carbon Design System singletons. Every existing Frame sub-app (cv-builder, blogengine, gastown-pilot, etc.) exposes a React component as its remote entry. The beaverGame client is vanilla TypeScript + Three.js with no UI chrome — a full-viewport canvas. Wrapping it in React purely to satisfy Module Federation would add a reconciler, two singletons, and a deploy-coupling tax for zero v0 benefit.

## Decision

beaverGame is a standalone repo deployed independently (Cloudflare Pages or Vercel). It still uses ojfbot tooling — skills, ADRs, hooks installed via `core/scripts/install-agents.sh` — but skips Module Federation, React, Carbon, and Redux. If we later want frame-agent to talk to the running game (e.g., procedural critter chatter, in-shell coaching), we'll add a thin React wrapper that mounts the Three.js scene and exposes the Module Federation remote at that point.

## Consequences

### Gains
- No React, no Carbon, no Redux in the bundle. Phase 0 load budget (<8s on a mid-tier laptop) stays achievable.
- Independent CI and deploy. The game can ship without coordinating a Frame shell release.
- The asset pipeline (`asset-foundry`) is also outside Frame, so the cluster boundary is clean.

### Costs
- We lose Frame's single-API-key LLM gateway. Players don't need it for v0 anyway (no runtime AI per asset-foundry/ADR-0001).
- If someone wants the game embedded inside a Frame dashboard later, we'll need a wrapper-shim repo.

### Neutral
- Domain-knowledge files (`domain-knowledge/frame-os-context.md`) are still symlinked here as reference reading, not as a runtime coupling.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Frame sub-app from day one | Pay the React-wrapper tax with no Phase 0 benefit; complicates deploy. |
| Standalone now, sibling shim later | Acceptable but invents work that may never be needed. Add the shim if and when an embedding ask actually arrives. |
| Monorepo with Frame shell | Couples the game release cycle to the Frame shell release cycle. |
