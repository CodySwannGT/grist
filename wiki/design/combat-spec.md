---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Combat spec (numbers & tables)

The mechanical layer under [combat](combat.md): stats, formulas, ATB timing,
element/status tables, and the Bound-kit template. **All numbers here are first-pass
targets** to be tuned against the Phase 1 prototype ([gdd](../production/gdd.md));
the *shapes* (what depends on what) matter more than the constants. These rules live
in `src/logic` as deterministic, unit-tested code
([architecture/game-tech-design](../architecture/game-tech-design.md)).

## Core stats

| Stat | Drives |
|---|---|
| **HP** | Health |
| **AP** (Anima) | Spell resource for Craft ([progression-and-economy](progression-and-economy.md)) |
| **POW** | Physical (Strike) power |
| **FOC** | Craft (spell) power |
| **DEF** | Physical mitigation |
| **WRD** (Ward) | Craft mitigation |
| **SPD** | ATB fill rate; turn order |
| **LCK** | Crit chance, status land/resist |

Stats come from level (curve in [economy-spec](economy-spec.md)), equipped **shard**
growth-bias, gear, and **augment** slots
([progression-and-economy](progression-and-economy.md)).

## ATB timing

- Each combatant has a gauge 0→100. Fill per tick: `gain = SPD × k` (k tuned so an
  average SPD acts ~every few seconds). At 100, they may act; acting resets to 0.
- **Active / Wait modes** (player option, [ui-ux-and-controls](ui-ux-and-controls.md)):
  in Wait, the gauge pauses while menus/targeting are open — the methodical default.
- Haste/Slow scale `k`; **Stop** freezes the gauge; **Stagger/Break** can delay the
  next turn.

## Damage formula (first-pass)

```
base       = attackerStat × skillPower          // attackerStat = POW or FOC
mitigated  = base × (100 / (100 + defStat))     // defStat = DEF or WRD
final      = mitigated
             × elementMod      // 0 (immune) / 0.5 / 1 / 1.5 (weak) / -1 (absorb→heal)
             × critMod         // ×1.5 on crit (chance from LCK)
             × variance        // 0.95–1.05 (seeded RNG; deterministic)
             × pressureMod     // ×1 normal, ×2+ vs a Broken target
```

Healing and DoT reuse the shape (FOC-based, no DEF mitigation). All randomness is
**seeded** so battles are reproducible for verification
([conventions/coding-conventions](../conventions/coding-conventions.md)).

## The two resources in numbers

- **AP** — most Craft spells cost small AP; regenerates slowly per turn + via items.
- **Grist** — the wallet ([progression-and-economy](progression-and-economy.md)). Only
  the strongest actions spend it: **Bind** (summon), top-tier **Render** spells, and
  **revive**. First-pass: a Bind costs enough grist that using it in every fight
  visibly slows your build — the intended "spend the world to win?" tension.

## Elements

`Flux · Ash · Iron · Bloom · Gloom` ([combat](combat.md),
[art-direction](art-direction.md) for colors). Each enemy/character has a
weak/normal/resist/immune/absorb value per element. Soft opposition pairs (for
build intuition): **Flux↔Ash**, **Iron↔Bloom**, **Gloom** stands alone (void).

## Status effects

| Status | Effect |
|---|---|
| **Rendering** | DoT; if it lands the killing blow, the enemy is "spent" → reduced/zero loot |
| **Silenced** | Cannot Craft (cut off from the Weave) |
| **Hollowed** | Reduced grist gain from the fight |
| **Bound (root)** | Cannot move/swap; can still act |
| **Stagger** | Next ATB turn delayed |
| Standard set | Poison-as-Rendering variants, Sleep, Slow, Haste, buffs/debuffs to the core stats |

## Pressure → Break → Severance

- Hitting a weakness, landing status, or using a foe's specific opener adds
  **Pressure**.
- At threshold the enemy is **Broken**: `pressureMod` jumps (≥×2), defenses drop, and
  a **Severance** finisher becomes available.
- Readable, methodical, knowledge-rewarding — the core skill expression of the ATB
  ([combat](combat.md)).

## The Bound-kit template

Each Bound ([bestiary](bestiary.md), [regions](regions.md)) is authored to this
template so the summon/learn/moral systems stay consistent:

| Field | Meaning |
|---|---|
| **Element / domain** | Its affinity and flavor ([lore-and-history](../narrative/lore-and-history.md)) |
| **Bind effect** | The grist-costed summon action (damage/effect, cooldown) |
| **Spell list** | Spells it *teaches* over time to the equipping character |
| **Growth bias** | Stat-growth weighting while equipped |
| **Free vs Wield** | Free = weaker shard, no corruption, karma+; Wield = stronger shard, **corruption** accrues |
| **Overdraw** | Diminishing returns + corruption if leaned on too hard ([combat](combat.md)) |

First-pass example — *the Marrow Bound* (the vertical-slice teacher,
[vertical-slice](../production/vertical-slice.md)): low-tier, **Ash** domain; Bind =
a modest AoE; teaches an entry Ash spell + a Rendering-status spell; small growth
bias to FOC; clear free/wield demo. Other named Bound are rostered in
[bestiary](bestiary.md).

## Difficulty & tuning targets

- **Solved by builds and resources, not reflexes** ([overview](overview.md)).
- **Main path beatable near 40h without grinding**; depth is opt-in
  ([economy-spec](economy-spec.md)).
- **Scalable difficulty** + the Active/Wait lever for accessibility
  ([ui-ux-and-controls](ui-ux-and-controls.md)).
