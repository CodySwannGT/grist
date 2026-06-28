---
type: playbook
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Test & QA plan

The concrete testing strategy for GRIST — what's tested how, the gates, and coverage
targets. It operationalizes the verification-is-UAT definition of done
([run-and-verify](run-and-verify.md), [decisions/0001](../decisions/0001-locked-architecture-decisions.md))
for real game systems. Built on the starter's enforced gates
([conventions/coding-conventions](../conventions/coding-conventions.md)).

## The testing pyramid

| Layer | Scope | Where |
|---|---|---|
| **Unit** (most) | Pure logic: combat formulas, ATB ordering, status, economy, spell-learning, save migration | `tests/logic` on `src/logic` |
| **Integration** | Content tables load & validate; sim + content together (a real encounter resolves) | `tests/logic` / `tests/integration` |
| **E2E / UAT** (fewest, highest value) | A real build played to acceptance criteria via the verification bridge | `tests/e2e` (Playwright) |

Because the sim is **pure and deterministic** ([engineering-spec](../architecture/engineering-spec.md),
[decisions/0006](../decisions/0006-phase-1-technical-decisions.md)), almost all of the
combat/economy/progression logic is unit-testable without the engine — the project's
biggest QA advantage.

## What unit tests must cover

- **Damage/heal formula** edge cases (mitigation, element mult, crit, Break ×, absorb).
- **ATB ordering** is deterministic for a given seed + SPD set; haste/slow/stop.
- **Status** application/duration/expiry; Rendering-kill denies loot; Silence blocks
  Craft; Hollowed reduces grist gain ([combat-spec](../design/combat-spec.md)).
- **Pressure → Break → Severance** thresholds.
- **Economy:** grist sources/sinks, refining ratios, clean-vs-render yield difference
  ([economy-spec](../design/economy-spec.md)).
- **Progression:** level curve, shard growth bias, spell-learning points, learning
  acceleration; learned spells persist.
- **Save migration:** every version bump round-trips and migrates
  ([engineering-spec](../architecture/engineering-spec.md)).

## What E2E / UAT must cover

- The current build's **acceptance criteria**, played start to finish. For the first
  slice that's the **UAT script** in
  [vertical-slice-build](../production/vertical-slice-build.md) (steps 1–9), driven
  through the `window.__VERIFY__` bridge (seed → state → inject input) and via real
  **touch + keyboard** ([platform-and-target](../production/platform-and-target.md)).
- Evidence (screenshots/recording) committed per the verification gate.

## Runtime gates (CI)

From the starter, applied to the game and tuned to the **web+mobile budgets**
([platform-and-target](../production/platform-and-target.md)):

- **Boot smoke** — boots to title, no console errors.
- **Determinism gate** — a seeded sim run hashes to a stable value (guards the pure-sim
  contract).
- **Performance budget** — frame-time/alloc budget under a representative scene;
  mobile-class target.
- **Leak gate** — scene restart loop shows no growth (Field↔Battle↔Menu).
- **Bundle-size budget** — initial download stays small (critical for web/mobile).
- **Lint / typecheck / format / dead-code** — enforced.

## Coverage targets (first-pass)

- `src/logic`: **high** line+branch coverage (it's pure and critical) — start at the
  starter's threshold and raise.
- Scenes/services: covered by E2E + smoke, not line-coverage-chased.
- Every `feat`/`fix` ships with the test that proves it (verification gate).

## Accessibility & device QA

- Verify the accessibility commitments ([ui-ux-and-controls](../design/ui-ux-and-controls.md)):
  battle speed/Wait, remap, captions, no color/audio-only info, reduced motion.
- **Device matrix** (manual + automated where possible): a mid-range Android + recent
  iOS Safari + desktop Chromium/Firefox/Safari, landscape; touch and keyboard paths.

## Per-phase focus

| Phase | Test focus |
|---|---|
| 1 — combat prototype | Combat unit tests + an e2e "play a battle to victory"; determinism gate |
| 2 — vertical slice | The full slice UAT script (steps 1–9); economy/learning/save tests |
| 3 — demo | The "first hour" played e2e; device matrix; perf/bundle under real content |
| 4+ — production | Per-region acceptance + regression; the gates hold as content scales |

## Process

Verification is part of every ticket, not a separate phase
([development-workflow](development-workflow.md)). Tests live beside the code; the
sim's determinism makes them fast and reliable.
