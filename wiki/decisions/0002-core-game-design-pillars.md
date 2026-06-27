---
type: decision
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# 0002 — Core game-design pillars

The two foundational game-design decisions for GRIST, locked 2026-06-27. They
anchor the design docs in [design/overview](../design/overview.md),
[combat](../design/combat.md), and
[progression-and-economy](../design/progression-and-economy.md).

## Decisions

1. **Combat = ATB turn-based** (Final Fantasy VI lineage). Party of four,
   individual turn gauges, configurable battle speed / full Wait mode. Combat is
   solved by builds, resources, and planning — not reflexes.
2. **Progression = grist-augment builds.** Characters grow via two intertwined,
   freeform systems while keeping a signature identity: **Bound shards** (FFVI
   esper-style learned magic + stat-growth bias) and **chrome augments** (slotted
   cyberpunk passives/actives). Growth is paid in **grist** — the same substance
   that is the currency, the crafting material, and the world's fuel.

## Why

- **On-theme over on-trend.** The pitch's comps span turn-based (FFVI) and action
  (FFXVI, Cyberpunk 2077). ATB was chosen because the game's identity is *slow,
  methodical, deliberate* ([pitch](../narrative/pitch.md)); a readable turn system
  expresses that where twitch action would fight it.
- **The system must be the theme.** Grist-augment progression makes growth
  *literally* the act of spending refined souls/god-essence — complicity and power
  are the same action ([progression-and-economy](../design/progression-and-economy.md)).
  This is the strongest available link between mechanics and the premise
  ([world](../narrative/world.md)).
- **Build freedom without losing the ensemble.** The esper-shard + augment combo
  gives deep customization (the "grindy" depth the brief asks for) while
  hand-authored signature kits preserve the FFVI fixed-character identity
  ([characters](../narrative/characters.md)).

## Alternatives considered

- **Action-RPG combat** (FFXVI / Cyberpunk lean) — flashier and on-trend, but
  hard to reconcile with a "slow, methodical" identity; rejected.
- **Tactical grid** (FFT) — deep and on-theme for slowness, but too large a
  departure from the ensemble-JRPG pitch; rejected.
- **Job/class system** (FF5) — maximum flexibility, but dilutes the
  distinct-people ensemble; rejected in favor of signature-but-customizable kits.
- **Fixed character kits** (FFVII Remake) — strongest identity, least sandbox;
  rejected for not delivering the freeform "grindy" build depth.
