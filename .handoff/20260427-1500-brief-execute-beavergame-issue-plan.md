---
id: 20260427-1500-brief-execute-beavergame-issue-plan
type: brief
title: "Execute the beaverGame GitHub issue plan"
actor: chat-claude
to: code-claude
session_id: 2026-04-27T15:00:00Z
refs:
  - file:.github/planning/HANDOFF.md
  - file:scripts/seed-github.sh
  - file:CLAUDE.md
hook: github-issue-seed
status: live
created_at: 2026-04-27T15:00:00Z
labels:
  project: cozy-beaver
  repo: beaverGame
  phase: 1
---

## Context

The `beaverGame` repo is the Three.js client for Cozy Beaver — vanilla TS + Vite, single-canvas, no React. Phase 0 spike is done: it loads validated `.glb` artifacts from the sibling `asset-foundry` repo and renders the player + scene composition. CLAUDE.md documents hard-won runtime traps (NoToneMapping, the `noEmit: true` story, the SPA-fallback Content-Type sniff, the Blender +Y → glTF -Z axis convention) and a punch list of remaining Phase 0 close-out work.

A planning session in chat-claude produced a structured GitHub issue plan: 17 issues sequenced and ready to file, plus labels and milestones. The plan lives at `.github/planning/HANDOFF.md` with issue drafts under `.github/planning/issues/BG-*.md` and a `scripts/seed-github.sh` for one-shot creation.

Several of these issues cross-reference `asset-foundry` issues (BG-007 ↔ AF-009 wet-state, BG-012 ↔ AF-008 affordances, BG-015 ↔ foundry-side unlit guarantee). If you're running this brief after the sibling brief in `asset-foundry`, the AF-* issue numbers are now known and can be substituted into BG cross-references.

## Goal

Execute the seed script — file all 17 issues with their labels and milestones via `gh` CLI. Verify each issue lands with the right metadata. After filing, update cross-repo references in BG issue bodies from `asset-foundry#AF-NNN` placeholders to actual GitHub issue numbers (`asset-foundry#42`).

## Acceptance criteria

- [ ] `gh label list` shows all 29 labels from `.github/labels.yml`
- [ ] `gh api repos/:owner/:repo/milestones` shows all 4 milestones from `.github/milestones.yml`
- [ ] `gh issue list --limit 30` shows all 17 BG-* issues
- [ ] Each issue has its declared labels and milestone applied
- [ ] BG-007 (water shader spike) has the `decision-pending` and `blocks-cross-repo` labels
- [ ] Cross-repo references in issue bodies link to live `asset-foundry` issue numbers (or note explicitly that the foundry side hasn't been seeded yet)
- [ ] CLAUDE.md "Punch list" remains consistent with what's now in issue form

## References

- file:.github/planning/HANDOFF.md
- file:.github/planning/issues/
- file:.github/labels.yml
- file:.github/milestones.yml
- file:scripts/seed-github.sh
- file:CLAUDE.md
- bead:(this brief)
- github:ojfbot/asset-foundry (sibling repo)

## Flag back

- If `gh` is not authenticated for `ojfbot`, stop. Don't authenticate as someone else.
- If `asset-foundry` issues haven't been filed yet, file the BG issues anyway with `asset-foundry#AF-NNN` placeholders left in. Note in the report which issues need their cross-references updated later.
- BG-006 (camera ADR) is currently in M2; chat-claude flagged in the planning doc that it might want to be M1. Do NOT bump the milestone in this session — surface the question in your report instead.
- BG-007 (water shader spike) is the highest-risk issue in the project. If anything in its body looks unclear, write a `decision` bead asking for clarification before filing.

## Constraints

- Do not modify ADR numbering. The plan assumes ADRs 0001-0007 exist; if they're at different numbers, surface and stop.
- The seeder is idempotent (skips by title); re-running is safe.
- Cross-repo URI format in `refs` is `github:ojfbot/asset-foundry#NN` — match this exactly so the bead schema stays consistent.

## After execution

Write a `report` bead responding to this brief. Include:

- Issue numbers assigned for each BG-*
- Updated cross-references to `asset-foundry` issues (if the sibling brief was executed first)
- Anything that drifted between the plan and reality
- The current state of the BG-006 (camera ADR milestone) question — still in M2, or did the operator decide otherwise
