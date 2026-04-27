# ADR-0007: Repo split — beaverGame ↔ asset-foundry

Date: 2026-04
Status: Accepted
OKR: 2026-Q2 / O2 / KR2 (assistant-centric architecture)
Commands affected: /scaffold-app, /deploy
Repos affected: beaverGame, asset-foundry

---

## Context

The asset pipeline is described in the project's planning document as "the part that's actually novel." It runs at build time, depends on Blender + Python + LangGraph + the Anthropic SDK, and produces validated `.glb` artifacts. The game client runs at runtime, depends on Vite + Three.js, and consumes `.glb` artifacts. The two systems share nothing structural except the manifest contract that defines what assets exist. Mixing them in a single repo would muddle CI scope, deploy targets, dependency surface, and the README story — and would make the pipeline harder to reuse for any future game project.

## Decision

Two sibling repos under `/Users/yuri/ojfbot/`:
- **beaverGame/** — Three.js client. Consumes validated `.glb` files committed under `public/assets/`.
- **asset-foundry/** — World manifest, LangGraph orchestrator, Blender MCP bridge, deterministic Validator. Produces `.glb` outputs in `dist/`.

The contract between them is the validated `.glb` artifact plus its sibling validation JSON. For v0 the artifacts are copied (or symlinked) into `beaverGame/public/assets/` after the foundry produces them. There is no pnpm workspace coupling: each repo has its own lockfile, its own CI, its own deploy.

## Consequences

### Gains
- Independent CI: the foundry's CI can install Blender and run pipeline smoke tests; the game's CI is a fast typecheck + Vitest + headless build.
- Clean dependency surface. The game has no Anthropic SDK in `node_modules`. No path to leak a key.
- The foundry is reusable for future games — generic by construction, not by retrofit.
- Each repo's CLAUDE.md and README tell one story.

### Costs
- Two repos to maintain. Two `install-agents.sh` invocations on bootstrap. Small.
- One extra step to sync artifacts: `cp asset-foundry/dist/*.glb beaverGame/public/assets/`. Wrap in a tiny script when the friction shows up.

### Neutral
- Either repo can later be promoted to a pnpm workspace member if shared TS types become valuable. Promote on pain, not speculation.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Single repo (game + pipeline) | Muddles CI scope and dependency surface; pipeline can't be reused without a fork. |
| pnpm workspace from day one | Workspace ceremony (root package.json, shared tsconfig.base.json, lockfile coupling) before any pain has been felt. |
| Pipeline as a private npm package consumed by the game | Pipeline outputs are binary `.glb` files, not code. Wrong abstraction. |
