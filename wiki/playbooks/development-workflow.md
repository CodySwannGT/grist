---
type: playbook
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Development workflow

How work actually flows on GRIST, end to end: from a product idea to verified,
shipped code. It ties together the Lisa governance, the GitHub PRD/ticket setup, the
branch rules, and the multi-harness configuration. For *running and verifying* a build
see [run-and-verify](run-and-verify.md); for *what* to build see the
[roadmap](../production/roadmap.md).

## The pipeline

```
 PRD (GitHub Issue, prd-ready)
    │  /lisa:intake  — scans prd-ready PRDs, breaks them into tickets
    ▼
 Tickets (GitHub Issues: epics / stories / sub-tasks, status:ready)
    │  /lisa:implement — an agent claims a ticket (status:in-progress)
    ▼
 Branch + code  (feature branch; never commit to main directly)
    │  build against the GDD; rules in src/logic; tests
    ▼
 VERIFY = UAT   — an agent plays the build vs. acceptance criteria + e2e specs
    │  evidence committed; status moves toward done
    ▼
 PR → review → merge → status:on-dev / on-stg / done
```

## Source of truth

- **The wiki is the design source of truth** ([gdd](../production/gdd.md)). PRDs and
  tickets describe *work*; the wiki describes *the game*. Keep them in sync — a PRD
  cites the wiki sections it implements.
- **PRDs and tickets live in GitHub** for this repo
  (`CodySwannGT/grist`), configured in `.lisa.config.json`
  (`tracker: github`, `source: github`).

## PRDs (GitHub Issues)

- A PRD is a GitHub Issue describing a slice of product value (e.g. *the Phase 1
  combat prototype*, *the vertical slice*). It should reference the relevant GDD docs
  and the acceptance criteria.
- **Label lifecycle:** `prd-draft` → `prd-ready` → `prd-in-review` → (`prd-blocked` |
  `prd-ticketed`) → `prd-shipped` → `prd-verified`. Drop a finished PRD to
  **`prd-ready`** to enter the queue.
- `/lisa:intake` (no args) scans this repo for `prd-ready` PRDs and creates tickets.

## Tickets (GitHub Issues)

- Lisa writes **epics / stories / sub-tasks** as Issues off the `status:*` labels.
- **Label lifecycle:** `status:ready` → `status:in-progress` → `status:blocked` /
  `human-needed` → `status:on-dev` → `status:on-stg` → `status:done`.
- A ticket carries acceptance criteria; "done" is gated by verification (below).

## Branching & PRs (important)

- **`main` is protected by a commit hook — never commit to it directly.** Always
  branch, then open a PR. (Lisa's hooks also block `--no-verify` and hook-skipping;
  don't bypass them.)
- Conventional-commit messages (commitlint enforces). Co-authorship trailer required.
- Merge via PR. *Note:* the template's secret-gated CI jobs aren't wired in this repo
  yet, so PRs currently merge without those external checks — see Follow-ups.

## Verification IS the definition of done

Per [decisions/0001](../decisions/0001-locked-architecture-decisions.md) and
[run-and-verify](run-and-verify.md): nothing is "done" until an agent has **played the
build** against the acceptance criteria, with committed evidence and an automated
`tests/e2e` spec. Game rules live in deterministic `src/logic` and are unit-tested
([conventions/coding-conventions](../conventions/coding-conventions.md),
[game-tech-design](../architecture/game-tech-design.md)). This gate applies to every
ticket.

## Multi-harness

The project supports **all harnesses** (`harness: fleet` —
claude, codex, cursor, agy, copilot, opencode). Per-harness instruction/config files
are generated and kept in sync:

- Shared guidance lives in `AGENTS.md`; each harness has its own generated dir
  (`.claude`, `.cursor`, `.codex`, `.opencode`, `.github/copilot-instructions.md`,
  `.agents`).
- After changing rules/MCP/skills, **re-sync** with `lisa cross-pollinate . --write`
  (mechanical) and `/lisa:cross-pollinate` (the skill, for rule/MCP *translation*).
  The sync state is tracked in `.lisa/cross-pollination.lock.json`.
- **Don't hand-edit generated per-harness files** — edit the source (usually the
  Claude/`AGENTS.md` side) and re-pollinate.

## A typical task, start to finish

1. Write/refresh a **PRD** Issue citing the GDD; label it `prd-ready`.
2. `/lisa:intake` → tickets (`status:ready`).
3. `/lisa:implement` → claim a ticket (`status:in-progress`); branch.
4. Build against the GDD; logic in `src/logic`; unit tests; UI/scene adapters.
5. **Verify**: play it, capture evidence, add the `tests/e2e` spec.
6. PR → review → merge; advance the ticket label.
7. Update the wiki if the design changed; close open-questions you resolved
   ([open-questions/register](../open-questions/register.md)).

## Follow-ups (project setup)

- **CI secrets & branch protection.** The template ships security-scan CI needing org
  secrets (Sonar, Snyk, GitGuardian, …) not yet configured here; wire them and enable
  GitHub branch protection on `main` so PRs are gated by required checks.
- **Finish cross-pollination.** A few rule/MCP items still need the
  `/lisa:cross-pollinate` skill for full harness parity.
