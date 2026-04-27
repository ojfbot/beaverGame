# Skills — beaverGame

This repo is **not a Frame app** (see `decisions/adr/0006-standalone-not-frame-subapp.md`). The full ojfbot core skill tree gets symlinked in by `core/scripts/install-agents.sh`, but a chunk of those skills assumes Frame conventions (Module Federation, Carbon, frame-agent gateway, Vercel Frame deploy). This file is the source of truth for which skills apply, which don't, and which we override.

## Layout

```
.claude/skills/
  <name>/         → symlink from core ........... install-agents.sh manages
  <local-name>/   real directory ................ committed; documented below
```

`install-agents.sh` skips paths that already exist as real files/dirs, so a local override at `.claude/skills/<name>/` survives reinstalls (you'll see a `warn: real file exists` line in the installer output).

## Apply directly (use as-is)

Generic across repos — the symlinked core version works.

`/adr` `/plan-feature` `/spec-review` `/scaffold` `/validate` `/test-expand` `/sweep` `/techdebt` `/doc-refactor` `/lint-audit` `/investigate` `/handoff` `/observe` `/orchestrate` `/push-all` `/pr-review` `/recon` `/roadmap` `/summarize` `/init` `/screenshot-audit` `/agent-debug` `/skill-create` `/skill-loader` `/diagram-intake` `/council-review` `/workbench`

## Apply with awareness

These work but were authored against Frame patterns; their suggestions sometimes don't fit a vanilla Three.js client. Read their output critically.

| Skill | Note |
|---|---|
| `/scaffold-app` | Authored for Frame Module-Federation sub-apps. Use `/scaffold` for game-side modules. |
| `/setup-ci-cd` | Defaults to Frame's Vercel deploy pipeline. We're standalone (Cloudflare Pages or Vercel-static). |
| `/deploy` | Same caveat — pre-flight checks assume Frame conventions. |
| `/hardening` | The web-app checks (CSP, MF singletons, API-key boundary) apply; the gateway/agent checks don't. |

## Don't apply (Frame- or domain-specific)

These are still symlinked in for completeness, but invoking them in this repo is a no-op or confusing. Don't suggest them in `/init` or session-start hints.

`/scaffold-frame-app` (explicit Frame OS scaffold) · `/frame-dev` (frame-agent dev helpers) · `/frame-standup` (Frame standup format) · `/extension-audit` (Chrome MV3) · `/resume-audit` (cv-builder) · `/rag-audit` (RAG systems) · `/gastown` (Gas Town dashboard) · `/daily-logger` (the log-writer pipeline)

## Local skills (game-dev specific)

Real directories under `.claude/skills/`, committed to this repo.

| Skill | What it does |
|---|---|
| [`/snap`](skills/snap/snap.md) | Run `scripts/snap.ts`, read `tmp/snap.png`, summarise visual state and console output. The visual iteration loop. |
| [`/regen-asset`](skills/regen-asset/regen-asset.md) | Trigger asset-foundry's `gen-asset` for a given `prop_id`, sync the artefacts into `public/assets/`. |

Add a new local skill by creating `.claude/skills/<name>/<name>.md` with frontmatter + instructions, then list it here and add the path to `.gitignore`'s allow list.

## Local-only configs

| File | Status | Use |
|---|---|---|
| `.claude/settings.json` | gitignored (managed by `install-agents.sh`) | Hook config merged from core |
| `.claude/settings.local.json` | gitignored | Per-developer Claude Code prefs |
| `.claude/CLAUDE.local.md` | gitignored | Personal scratch notes for this repo |
| `.claude/standup.md` | committed | Repo standup template (see core's `/frame-standup` even though we don't use Frame standup) |

## When to override a core skill

If a symlinked core skill consistently produces Frame-shaped suggestions that don't fit:

1. Copy the core skill into a real local dir: `cp -RL ../core/.claude/skills/<name> .claude/skills/<name>` (note `-L` to dereference the symlink first).
2. Edit the orchestration prompt to game-tune.
3. Add the override to the table above and to `.gitignore`'s allow list.
4. Document the divergence in a comment at the top of the override file.
