---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Catalog — items, equipment, augments & abilities

The content catalogs: weapons, augments, consumables, key items, and the spell/ability
list. This is the **framework + first-pass examples** ([gdd](../production/gdd.md));
the full lists are living content authored as regions and the economy are built
([economy-spec](economy-spec.md), [regions](regions.md)). Systems references:
[combat-spec](combat-spec.md), [progression-and-economy](progression-and-economy.md).

## Weapons

Each character has a weapon class fitting their identity
([character-bios](../narrative/character-bios.md)); weapons set Strike range/element
and can carry passive procs.

| Class | Wielder(s) | Flavor |
|---|---|---|
| Runner's blades / sidearm | Wren | fast, tempo, off-element procs |
| Frame-lance / heavy arms | Halcyon | high POW, grist-linked, frame synergy |
| Artificer's tools | Tobi | gadget-weapons; status/utility |
| Weave-focus | Maren, Sable | FOC-scaling; Craft amplifiers |
| Drone array | Quietus | ranged Iron; multi-hit |

Upgraded via grist + schematics ([economy-spec](economy-spec.md)).

## Equipment & frames

- **Armor/chrome plating** — DEF/WRD + resist lines.
- **Relics/trinkets** — the FFVI-relic slot: rule-bending passives (extra ATB,
  auto-status, element shift).
- **Frames** — heavy grist-hungry exo-states for eligible characters
  ([combat](combat.md)); swap a character's whole kit for a phase.

## Augments (chrome)

Slotted cyberpunk modifications ([progression-and-economy](progression-and-economy.md));
crafted/upgraded with grist; limited slots force trade-offs.

| Type | Examples (first-pass) |
|---|---|
| **Passive — stat** | +POW/FOC/SPD lines; HP/AP boosts |
| **Passive — defensive** | element resist; status immunity; auto-revive (grist-costed) |
| **Passive — utility** | bonus grist gain; faster spell learning; extra relic slot |
| **Active** (the *Augment* verb) | overdrives, deployable tools, gadget strikes, emergency heals |

## Consumables

Grist-refined restoratives and tactical items: HP/AP restore, status cures, a
**grist-flask** (emergency combat grist), throwables (element/status). No power-creep
healing; items support the methodical play, they don't trivialize it.

## Key items

Plot/traversal items: the skiff and **airship** keys ([open-world](open-world.md)),
**Bound shards** (the esper-equivalent; [bestiary](bestiary.md)), schematics, codex
fragments (the Ledger; [side-content](side-content.md)), faction tokens.

## Abilities & spells (the Craft)

Spells are **learned from Bound shards** ([combat-spec](combat-spec.md)) and grouped
by element ([combat](combat.md)). First-pass families:

| Element | Sample spells |
|---|---|
| **Flux** | Weave-bolt; Surge (AoE); Mend (heal — Flux/Bloom) |
| **Ash** | Cinder; **Render** (the Rendering DoT; [combat-spec](combat-spec.md)); Wither (DEF down) |
| **Iron** | Spike; Lockdown (Silence/Bound); Overclock (Haste) |
| **Bloom** | Greater Mend; Regen; Ward (WRD up) |
| **Gloom** | Hollow (Hollowed status); Null (dispel); Unmake (high-tier, grist-costed) |

Plus character **signature abilities** (non-shard, hand-authored): Wren's mobility
skills, Halcyon's frame actives, Sable's source-powers, Q's borrowed-soul abilities
([character-bios](../narrative/character-bios.md)).

## Data & authoring

All catalog entries are **data**, not code — typed content tables consumed by the
`src/logic` systems, with typed asset/content keys
([architecture/game-tech-design](../architecture/game-tech-design.md),
[conventions/coding-conventions](../conventions/coding-conventions.md)). This keeps
content moddable, testable, and easy to grow per region without touching engine code.

## Open questions

Tracked in [open-questions](../open-questions/): final slot counts (relics, augments),
whether weapons learn abilities (FFIX-style) in addition to shards, and consumable
economy balance against the grist sinks.
