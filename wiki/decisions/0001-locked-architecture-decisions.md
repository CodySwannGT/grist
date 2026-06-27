---
type: decision
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# 0001 — Locked architecture decisions

The opinionated, locked choices for this starter. Most are lint-enforced; do not
disable a rule — fix the code.

## Decisions

1. **OOP scenes + a mandatory pure-logic core.** Game rules live in `src/logic`
   with zero Phaser imports (enforced). ECS (bitECS/Miniplex) is an opt-in, not
   the default — a starter stays genre-neutral.
2. **Canvas-only, framework-agnostic UI** (Vite + TS). A React/Vue EventBus
   bridge is a documented upgrade path, not the default.
3. **Arcade physics by default; Matter opt-in.** Matter is heavier and doesn't
   interop with Arcade. (Gameplay collision here is computed in the pure sim for
   determinism/testability, not by the engine.)
4. **Determinism.** No `Math.random` / `Date.now` / `performance.now` in game
   code — seeded `Rng` + the scene delta — so replays and the UAT suite reproduce.
5. **State & events.** Global state via a typed registry wrapper; cross-cutting
   events via a single `EventsCenter` (never `game.events`); every external
   `.on()` has a matching `.off()` on scene shutdown.
6. **Performance.** No allocation/creation in `update()`; pool transient objects;
   atlas everything; `BitmapText`/`SpriteGPULayer` for churn/mass.
7. **Verification IS UAT.** Nothing is "done" until an agent has played the
   running game against the acceptance criteria, with committed evidence and a
   `tests/e2e` spec that re-runs in CI. See
   [playbooks/run-and-verify](../playbooks/run-and-verify.md).
8. **Strict TypeScript** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   …) and **bundler module resolution** (Vite app, not a Node library).

## Why

A best-practices starter must be testable, deterministic, and impossible to
regress silently. The pure-logic boundary + determinism + UAT gate deliver that;
the rest are the idiomatic choices for a Phaser 4 + Vite game.
