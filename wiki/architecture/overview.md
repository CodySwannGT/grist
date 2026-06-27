---
type: architecture
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Architecture Overview

## Overview

GRIST separates **pure game logic** from the **Phaser engine
adapter**. All game rules live in `src/logic/**` as plain TypeScript with zero
Phaser imports (lint-enforced); scenes/objects/services are thin orchestrators
that render that state and feed it input. This is what makes the game
deterministic and unit-testable.

## Components

- **`src/logic/`** — the pure simulation. `GameSim` (mutable, pooled items, no
  per-frame allocation) and `Rng` (seeded mulberry32, no `Math.random`). Unit
  tested in `tests/logic/`.
- **`src/scenes/`** — thin Phaser adapters: `Boot → Preloader → MainMenu → Game
  → GameOver`. The `Game` scene reads an input intent, advances the sim, and
  renders pooled sprites; it creates nothing in `update()`.
- **`src/services/`** — cross-cutting adapters: the `EventsCenter` bus (never
  `game.events`), `InputService` (semantic actions), `SoundService` (Web Audio
  with first-gesture unlock), `SaveService` (versioned `localStorage` +
  migration).
- **`src/uat/bridge.ts`** — the verification (UAT) bridge exposed on
  `window.__VERIFY__` (enabled with `?uat=1`): seed the RNG, read state, inject
  input. Drives the Playwright verification suite.
- **`src/consts.ts` / `src/assets.ts`** — typed scene/event/asset keys and
  tunables. No raw string keys anywhere.

## Data flow

```
input → InputService.moveIntent()  ─┐
verification bridge.intentOverride ─┤→ Game.update(): GameSim.advance(dt, intent)
                                     │     → mutate pooled state (no allocation)
                                     └→ Game.#render(): sync pooled sprites to state
                                        Game.#react(): emit events / sfx / scene change
```

The dependency direction is one-way: `main → scenes → objects/services →
logic/consts`. `src/logic` never imports Phaser.

## Constraints & decisions

See [decisions/0001-locked-architecture-decisions](../decisions/0001-locked-architecture-decisions.md)
for the locked choices (OOP + pure-logic core, canvas-only, Arcade default,
determinism, verification = UAT) and [conventions/coding-conventions](../conventions/coding-conventions.md)
for the enforced rules.
