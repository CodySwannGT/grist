---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Economy & progression spec (numbers)

The mechanical layer under
[progression-and-economy](progression-and-economy.md): the level curve, grist
values, and source/sink tuning. **All numbers are first-pass targets**
([gdd](../production/gdd.md)) — the *ratios and curves* are the design; the constants
get tuned against the Phase 1 prototype. These rules live in deterministic
`src/logic` ([architecture/game-tech-design](../architecture/game-tech-design.md)).

## Design intent (the dials)

- **Grist is one resource** — currency + crafting + progression + world-fuel
  ([progression-and-economy](progression-and-economy.md)). No separate gold.
- **Scarcity is felt but not punishing.** You should *always* want more grist and
  *always* have a meaningful choice for the grist you have.
- **Main path ≈ 40h with light grinding; depth is opt-in** ([overview](overview.md)).
- **The shortcut (rendering) pays best and costs most** — a power dial wired to the
  moral ledger ([side-content](side-content.md)).

## Level curve

- **XP per level** rises super-linearly (first-pass: `xpToNext = base × level^1.5`),
  tuned so the **critical path** lands the party at an appropriate band per chapter
  ([main-quest](../narrative/main-quest.md)) without forced grinding.
- **Soft level bands per region** ([regions](regions.md)) *suggest* power, rarely wall
  — going in "too early" is a viable, dangerous choice ([open-world](open-world.md)).
- Levels grant HP/AP and base-stat gains, **biased by the equipped shard's growth**
  ([combat-spec](combat-spec.md)).

## Grist: sources (first-pass relative yields)

| Source | Yield | Notes |
|---|---|---|
| Trash encounter | low | the steady trickle |
| Elite / mini-boss | medium | spikes |
| Contract / bounty | medium–high | the reliable income ([side-content](side-content.md)) |
| Exploration cache / salvage | low–high | rewards curiosity ([open-world](open-world.md)) |
| Refining (convert raw → grist) | conversion | a crafting step, not free grist |
| **Rendering (moral shortcut)** | **highest** | + moral-ledger cost, faction shifts |

Clean kills yield more usable grist than **Rendering**-status kills (which "spend" the
enemy) — a small, constant nudge away from the shortcut
([combat-spec](combat-spec.md)).

## Grist: sinks

| Sink | Role |
|---|---|
| **Augments** (craft / install / upgrade) | the chrome build ([progression-and-economy](progression-and-economy.md)) |
| **Learning acceleration** | speed a shard's spell learning |
| **Shard refinement** | raise a Bound shard's grade |
| **Gear & frame upkeep** | weapons, chrome, frames ([combat](combat.md)) |
| **Combat spend** | Bind / Render / revive ([combat-spec](combat-spec.md)) |
| **Services** | fast-travel, safehouses, bribes ([open-world](open-world.md)) |

The deliberate tension: **the grist you'd spend to win a hard fight is the same grist
you'd spend to grow** — every wallet decision is thematic.

## Spell learning (the shard loop)

- Equipped shards teach spells as the character earns **AP/learning-points** in battle
  (first-pass: a spell needs N learning-points; earned per encounter).
- **Learning acceleration** (a grist sink) shortens it; higher-grade **wielded** shards
  teach faster but accrue **corruption** ([combat-spec](combat-spec.md)).
- Learned spells are **permanent** — shards are how the player authors a kit
  ([progression-and-economy](progression-and-economy.md)).

## Crafting & refining ratios

- **Refine:** raw ichor/anima/salvage → grist at a purity ratio (first-pass < 1:1, so
  refining is a step with loss, not a printer).
- **Fabricate:** augments/gear = grist + a discovered schematic
  ([catalog](catalog.md)). Recipes are *found*, not grind-unlocked
  ([quest-design](quest-design.md)).

## The grind, quantified

- The **accumulative loop** (earn → refine → invest → climb) is the satisfaction the
  name promises ([overview](overview.md)).
- **Opt-in depth:** full shard mastery, complete augment builds, freeing every Bound,
  and completionist side-content comfortably push **well past 40h**; none of it is
  required to finish.
- **Anti-tedium:** no hard money-walls on the critical path; fast-travel and density
  keep depth from becoming a chore ([quest-design](quest-design.md)).

## The moral ledger (economic hook)

Every **render-or-not** decision is recorded and feeds faction standing, party trust,
and **ending eligibility** ([story](../narrative/story.md),
[side-content](side-content.md)). The economy never blocks the shortcut; it prices it
in consequences. Your build is a ledger of what you were willing to spend.

## Two-world-state economy

After the Reckoning, **Ashfall** tightens the economy ([open-world](open-world.md)):
grist is scarcer and Anima-reliant play strains (the Weave is guttering), sharpening
the grist temptation — the same systems, mourned
([main-quest](../narrative/main-quest.md)).
