---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Bestiary & the Bound roster

The enemy framework and the named **Bound**. This is a **first-pass roster**
([gdd](../production/gdd.md)) — specific stat blocks are authored per region as it's
built ([regions](regions.md)); the families, roles, and the Bound list are the design.
Combat math is in [combat-spec](combat-spec.md); the world in
[world](../narrative/world.md).

## Enemy design principles

- **Each trash type teaches one idea** — an element, a status, a Pressure route — so
  the ATB stays legible ([combat-spec](combat-spec.md)).
- **The fiction is in the fight.** Enemies *are* the world's argument: corporate
  security, the rendered, warped wildlife — what consumption produces
  ([themes-and-tone](../narrative/themes-and-tone.md)).
- **Bosses are puzzles** of build + resources, usually Break-gated, often with the "do
  you spend grist?" temptation ([combat](combat.md)).

## Enemy families (non-Bound)

| Family | Where | Teaches / role |
|---|---|---|
| **Marrow gangs & scavengers** | the Marrow, Tiers ([regions](regions.md)) | basics; tempo; the tutorial enemies |
| **House enforcers** (human) | everywhere the Concord reaches | status, formations |
| **Frames** (piloted armor) | Caldecott/Mourne forces | heavy, grist-hungry; mini-boss tier ([combat](combat.md)) |
| **Vesper constructs** | rendering-houses, Holtspire | anima/render mechanics; body-horror |
| **Quill security drones** | the Crown, server-vaults | ranged, electronic (Iron); status |
| **Rendered husks** | the Marrow, Ashfall | tragic "made-of-grist" foes; the moral sting |
| **Ashland horrors** | the Cinderfen, wilds | warped wildlife; raw elements |
| **The Auditors** | Sallow's agents | elite escalation toward the finale |

## Ashfall variants

After the Reckoning ([main-quest](../narrative/main-quest.md)), enemies are
**warped** versions of their Reach selves — drained palettes
([art-direction](../design/art-direction.md)), new entropy (Gloom) attacks, and a
harsher economy ([economy-spec](economy-spec.md)). The same bestiary, mourned.

## The Bound roster (first-pass)

The caged old powers — summons, the magic-learning source, and the open world's
signature moral encounters ([combat](combat.md),
[progression-and-economy](progression-and-economy.md)). Each follows the Bound-kit
template ([combat-spec](combat-spec.md)) with a **free vs wield** choice. Names use
Old-Aurric flavor ([lore-and-history](../narrative/lore-and-history.md)).

| Bound | Region | Element / domain | Role |
|---|---|---|---|
| **the Ashling** | the Marrow | Ash | low-tier; the vertical-slice teacher ([vertical-slice](../production/vertical-slice.md)); demos free/wield |
| **Velith, the Deep-bound** | the Roots/Deep | Flux | ancient, near-free; remembers the Choir; an early "mercy" path |
| **Sylvath, the Green Wyrm** | Sylvemarch | Bloom | a great wyrm; a major free-vs-wield decision |
| **Korrholt, the Anvil-Heart** | Holtspire | Iron | harnessed *openly* as a city reactor — the atrocity industrialized |
| **Morrath, the Cinder-bound** | the Cinderfen | Ash/Gloom | dying, half-rendered; a gut-punch more than a fight |
| **Threnos, the Unmade** | the Wrack | Gloom | entropy-touched; alien; foreshadows the finale ([story](../narrative/story.md)) |

> Freeing a Bound = a weaker shard, no corruption, karma+ and lore; wielding = a
> stronger shard with accruing corruption ([combat-spec](combat-spec.md)). Sable's
> bond to the Bound is unique ([character-bios](../narrative/character-bios.md)).

## Boss roster (spine)

- **The Bound** themselves — each region's set-piece/optional superboss.
- **Frame duels** — Halcyon (Act I antagonist phase), Caldecott champions.
- **Mr. Sallow** — recurring, escalating from "a man with a frame" to a being
  *unmaking* the battlefield; his theme is the Choir's Song played cold
  ([audio-direction](../design/audio-direction.md),
  [character-bios](../narrative/character-bios.md)). The finale at Aurel's heart
  ([main-quest](../narrative/main-quest.md)).

## Open questions

Tracked in [open-questions](../open-questions/): exact Bound count for v1 (this roster
is the planned spine; some may merge), and how Sable's unique Bound-bond expresses
mechanically.
