# beaverGame — Issue & Tracking Plan v0.1

Companion to `asset-foundry/.github/planning/HANDOFF.md`. Derived from a chat-claude planning session on 2026-04-27 against `beaverGame/CLAUDE.md`.

## Layout

```
.github/
  labels.yml                            # 30 labels (types, phases, areas, cross-cutting)
  milestones.yml                        # M1–M4
  planning/
    HANDOFF.md                          # this file
    MODE_B_WATERSHED_v0.1.md            # planning doc for the watershed mode
    issues/
      BG-001.md … BG-017.md             # one file per issue, with frontmatter
scripts/
  seed-github.sh                        # idempotent: applies labels, milestones, issues
```

## How to use this document

Each `.github/planning/issues/BG-*.md` stands alone. The seed script in `scripts/seed-github.sh` reads them, the labels file, and the milestones file, and idempotently applies them via `gh` CLI. Re-running the seeder is safe (skips by title).

## Proposed labels

**Type** (pick one): `type:adr`, `type:feat`, `type:fix`, `type:infra`, `type:test`, `type:docs`, `type:spike`

**Phase** (pick one):

- `phase:0` — first asset in browser (closed)
- `phase:1` — client hardening, CI, controller bounds
- `phase:2` — Mode A playable (camera, locomotion, water, terrain)
- `phase:3` — Mode A building loop (felling, hauling, damming, lodge)
- `phase:4` — Mode B (Watershed) — water sim, suburb, twilight cycle, NPCs
- `phase:5` — polish, deploy, ship

**Area** (multi-select): `area:render`, `area:scene-bootstrap`, `area:loader`, `area:player`, `area:camera`, `area:lighting`, `area:materials`, `area:game-loop`, `area:water-sim`, `area:npc`, `area:audio`, `area:ui`, `area:state`, `area:ci`, `area:docs`

**Cross-cutting:** `blocks-cross-repo`, `decision-pending`

## Proposed milestones

- **M1 · Phase 0 close-out** — punch list complete, snap loop in CI
- **M2 · Mode A core** — camera ADR resolved, controller bounded, water shader, terrain
- **M3 · Mode A playable** — building loop, day/night cycle, save state
- **M4 · Mode B Watershed** — water sim spike, suburb assets, twilight cycle, NPC fixtures

## Issue inventory

| ID | Title | Labels (head) | Milestone |
|----|-------|---------------|-----------|
| BG-001 | Commit Poly Haven HDRI under public/assets/hdri/ | type:feat phase:1 area:lighting | M1 |
| BG-002 | Bound WASD controller to the ground patch | type:fix phase:1 area:player | M1 |
| BG-003 | CI workflow: typecheck + test + build + snap | type:infra phase:1 area:ci | M1 |
| BG-004 | Vitest coverage for load-glb.ts validation tripwire | type:test phase:1 area:loader | M1 |
| BG-005 | Replace mulberry32 scatter with Poisson-disk sampling | type:feat phase:1 area:scene-bootstrap | M1 |
| BG-006 | ADR-0008 · Camera perspective and rig | type:adr phase:2 area:camera | M2 |
| BG-007 | Water shader spike | type:spike phase:2 area:water-sim decision-pending | M2 |
| BG-008 | Terrain height field | type:feat phase:2 area:scene-bootstrap | M2 |
| BG-009 | Player rig: walk + swim states | type:feat phase:2 area:player | M2 |
| BG-010 | ADR-0009 · Save state schema and persistence cadence | type:adr phase:2 area:state | M2 |
| BG-011 | Day/night cycle + color-graded time-of-day | type:feat phase:2 area:lighting area:render | M2 |
| BG-012 | Felling tree mechanic | type:feat phase:3 area:player area:game-loop | M3 |
| BG-013 | Hauling logs + path-of-least-resistance navigation | type:feat phase:3 area:player area:game-loop | M3 |
| BG-014 | Dam construction mechanic | type:feat phase:3 area:game-loop area:water-sim | M3 |
| BG-015 | Verify enforceVertexColorMaterials is no-op for foundry assets | type:fix phase:1 area:materials blocks-cross-repo | M1 |
| BG-016 | ADR-0010 · Twilight window structure and time advancement | type:adr phase:4 area:game-loop | M4 |
| BG-017 | scripts/inspect-glb.ts documentation and CLI polish | type:docs phase:1 area:docs | M1 |

## Recommended filing order

1. **BG-002** — fast win, charm wears off fast
2. **BG-003** — CI before surface area grows
3. **BG-004** — protect the cross-repo seam
4. **BG-001** — small, future-proofs the lighting code path
5. **BG-005** — visible improvement, deterministic
6. **BG-015** — coordinate with foundry-side cleanup
7. **BG-017** — paper cut, do it on a slow afternoon
8. **BG-006** — camera ADR; spike to decide
9. **BG-007** — water shader spike (the hinge); time-box hard
10. BG-008 → BG-014 — Mode A playable, sequential
11. BG-010, BG-016 — save state and twilight ADRs, written before they're needed

## Cross-repo dependencies

- **BG-007 ↔ asset-foundry/AF-009** wet-state strategy. Whichever lands first informs the other.
- **BG-012 ↔ asset-foundry/AF-008** affordances on the prop schema. Required for fellable detection.
- **BG-015 ↔ asset-foundry-side** unlit-on-export guarantee. Audit + fix on the foundry side, then drop the runtime patch.

## Open questions for the operator

1. Do the cross-repo deps (BG-007, BG-012, BG-015) want a single GitHub Project spanning both repos, or stay per-repo with reference links?
2. Should BG-006 (camera ADR) bump from M2 to M1? It blocks every Mode A asset budget call.
3. Is the BG-007 water-shader spike's one-week timebox right, or do you want more / less?
4. ADR-0008 / 0009 / 0010 numbering assumes 0001-0007 are filed locally — confirm.
5. Among the punch list, prioritize correctness work (CI, tests, controller bounds) or visible-improvement work (HDRI, Poisson) first?
