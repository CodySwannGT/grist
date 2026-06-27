---
type: architecture
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Game technical design

How the GRIST design maps onto the codebase. It extends the starter foundation in
[architecture/overview](overview.md) with the game-specific data model, save schema,
settings, localization, and telemetry — and shows how the design docs become
deterministic, testable systems. First-pass ([gdd](../production/gdd.md)); firms up
in Phase 1 ([roadmap](../production/roadmap.md)).

## Guiding rule: design → pure logic → thin engine

Every system in the GDD is implemented as **pure logic in `src/logic`** (zero Phaser
imports, deterministic, unit-tested), with scenes/services as thin adapters
([conventions/coding-conventions](../conventions/coding-conventions.md)). This is what
makes a systemic JRPG verifiable ([playbooks/run-and-verify](../playbooks/run-and-verify.md)).

| GDD system | `src/logic` module (first-pass) |
|---|---|
| ATB & damage ([combat-spec](../design/combat-spec.md)) | `logic/combat/` (turn engine, formulas, status, Pressure/Break) |
| Economy & grist ([economy-spec](../design/economy-spec.md)) | `logic/economy/` (wallet, sources/sinks, refining) |
| Progression ([progression-and-economy](../design/progression-and-economy.md)) | `logic/progression/` (levels, shards, augments, learning) |
| Quests & flags ([quest-design](../design/quest-design.md)) | `logic/quests/` (state machine, the moral ledger) |
| World state ([open-world](../design/open-world.md)) | `logic/world/` (regions, the Reach↔Ashfall turn, traversal) |

## Determinism

- **One seeded RNG** ([architecture/overview](overview.md)): no `Math.random`/`Date.now`
  in game logic; battles, drops, and variance are reproducible — required for the
  verification suite and for the "no rush"/fair-feeling design
  ([combat-spec](../design/combat-spec.md)).
- A battle or sim step is a **pure function of (state, input, seed)** → next state, so
  any scenario can be unit-tested and replayed.

## Content as data, not code

Catalogs ([catalog](../design/catalog.md)), the bestiary ([bestiary](../design/bestiary.md)),
the Bound roster, regions, and quests are **typed data tables** consumed by the logic
systems — not hard-coded. Benefits: content grows per region without touching engine
code, everything is **typed-key referenced**
([conventions/coding-conventions](../conventions/coding-conventions.md)), and data is
trivially unit-testable and (later) moddable.

```
content/            # typed data: enemies, bound, items, augments, spells, regions, quests
  ↓ loaded & validated
src/logic/*         # pure systems operate on content + state
  ↓ rendered by
src/scenes,services # thin Phaser adapters (battle scene, field, menus)
```

## Save schema

Extends the starter's versioned `SaveService` (migration chain;
[architecture/overview](overview.md)). The GRIST save records at least:

- party roster, levels/stats, equipped shards (+ learning progress) & augments
- grist wallet, inventory, learned spells
- **world state** (Reach/Ashfall), region/discovery flags, fast-travel points
- **quest state** + the **moral ledger** and **faction standing** (drive endings;
  [story](../narrative/story.md))
- settings & RNG seed lineage

Every shape change **bumps the version and adds a migration** — no silent breakage.

## Settings

Accessibility-first ([ui-ux-and-controls](../design/ui-ux-and-controls.md)): battle
speed / Active-Wait, remappable controls (via the semantic `InputService`),
independent audio mixes ([audio-direction](../design/audio-direction.md)),
text scale, reduced motion, difficulty. Persisted via the settings store.

## Localization (i18n)

All player-facing text is keyed in a typed catalog (the starter's i18n approach;
[architecture/overview](overview.md)) — no inline strings. Naming conventions
([lore-and-history](../narrative/lore-and-history.md)) and the text-forward VO plan
([audio-direction](../design/audio-direction.md)) keep GRIST localization-friendly
from day one.

## Telemetry & error capture

Opt-in, privacy-respecting analytics on the design's key questions (build choices,
render-or-not rates, where players stall, ending distribution) plus in-game error
capture, through the starter's telemetry/Sentry abstraction
([architecture/overview](overview.md)). Tuning the [economy-spec](../design/economy-spec.md)
and [combat-spec](../design/combat-spec.md) will lean on this.

## Performance

The starter's runtime gates apply ([architecture/overview](overview.md),
[conventions/coding-conventions](../conventions/coding-conventions.md)): no allocation/
creation in `update()`, pooled sprites (enemies, projectiles, damage numbers), atlased
art ([art-direction](../design/art-direction.md)), and the boot/leak/determinism/bundle
budgets. An open-world JRPG needs streaming region loads — designed against these
budgets from the start.

## Verification (definition of done) applied

Per [decisions/0001](../decisions/0001-locked-architecture-decisions.md) and
[playbooks/run-and-verify](../playbooks/run-and-verify.md): logic systems are
unit-tested; scenes/flows get `tests/e2e` specs driven through the verification
bridge; nothing ships until an agent has *played* it. The
[vertical-slice](../production/vertical-slice.md) is the first full application of this
to real game systems.

## Open questions

Tracked in [open-questions](../open-questions/): the content-data format (TS modules vs
JSON + schema), region-streaming strategy within the Phaser/Beam pipeline, and how much
of the battle is sim-driven vs scene-driven.
