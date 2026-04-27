# ADR-0005: Plain TS classes + event bus; localStorage save state

Date: 2026-04
Status: Accepted
OKR: 2026-Q2 / O1 / KR3 (Phase 4 — building loop)
Commands affected: /scaffold
Repos affected: beaverGame

---

## Context

The game has roughly a dozen top-level state nodes: player, camera, world clock, inventory, dam progress, lodge progress, weather, audio bus, save slot. There is no cross-tab sync requirement, no time-travel debugging requirement, and no UI library that wants a normalized store. Reaching for Redux Toolkit or MobX would be ceremony for ceremony's sake.

## Decision

Game state lives in plain TypeScript classes, owned by their domain (e.g. `Player`, `Dam`, `WorldClock`). Cross-cutting signals go through a small typed event bus (~30 lines). Save state serializes to JSON and persists to `localStorage` for v0; if cross-device save is later required, that's a separate ADR.

## Consequences

### Gains
- Zero state-management dependencies. Build stays small.
- The data flow is the call graph — easy to read and step through.
- Save state is a JSON snapshot of the same classes that own the runtime state. No ORM, no schema evolution layer.

### Costs
- No time-travel debugging out of the box. Mitigation: dev builds log every event-bus message.
- If we later want a HUD that re-renders on state change, we'll need to wire change-listeners by hand. That's still cheaper than Redux+selectors for a UI surface this small.

### Neutral
- Classes vs plain objects is a stylistic choice; classes give us cleaner method-binding for save/load and a place to hang invariants.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Redux Toolkit | Overkill for ~12 state nodes; cluster pattern is for React UIs that need it. |
| MobX | Hidden subscription graph fights deterministic tick. |
| Zustand | Not on the cluster stack; adds a dependency for marginal value. |
| Cloudflare KV save state | Out of scope for v0; needs a session/auth layer first. |
