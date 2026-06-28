---
type: production
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Vertical slice — build spec ("The Bound in the Marrow")

The **build-ready** detail for the first slice: concrete content (with first-pass
numbers), the asset manifest, and the step-by-step UAT script. This makes
[vertical-slice](vertical-slice.md) (scope + acceptance criteria) something a
developer can start coding against. Numbers are **first-pass**, tuned in Phase 1
([open-questions/register](../open-questions/register.md)). Implements the
[combat-spec](../design/combat-spec.md) on the
[engineering-spec](../architecture/engineering-spec.md) per the
[Phase-1 decisions](../decisions/0006-phase-1-technical-decisions.md).

## Party

| Char | Lv | HP | AP | POW | FOC | DEF | WRD | SPD | LCK | Kit |
|---|---|---|---|---|---|---|---|---|---|---|
| **Wren** | 3 | 120 | 20 | 18 | 10 | 10 | 8 | 14 | 8 | Strike (blades); signature *Flurry*; starts with the **Emberwisp** shard |
| **Tobi** | 3 | 140 | 24 | 12 | 14 | 12 | 10 | 9 | 6 | Strike (tools); augment active *Stun-Dart* (Iron, Stagger) |

**Emberwisp shard** (Wren's starter — demonstrates both resources from room A):
teaches **Spark** (Flux, AP 4, power 12, one target); **Bind: Wisp** (grist 8, small
Flux AoE). Growth bias: +SPD.

## Enemies

| Enemy | HP | Weak | Teaches | Loot grist |
|---|---|---|---|---|
| **Marrow scrapper** | 40 | — | basic ATB tempo | 6 |
| **Render-construct** (Vesper) | 70 | Flux | the **Rendering** status; why you Break ([combat-spec](../design/combat-spec.md)) | 10 |
| **The Ashling** (Bound boss) | 220 | Flux (phase 1) | Pressure→Break; the "spend grist?" tension | 20 + shard |

**The Ashling** (the slice's Bound; [bestiary](../design/bestiary.md)): element **Ash**;
a Break-gated boss. Reward shard **teaches Cinder** (Ash, AP 5, power 16) **and Render**
(Ash, AP 6, applies Rendering); growth bias +FOC. **Free** → weaker shard, no
corruption, karma+; **Wield** → stronger shard, corruption accrues
([progression-and-economy](../design/progression-and-economy.md)).

## Map — the Marrow descent (3 rooms)

| Room | Content |
|---|---|
| **A · Warren Street** | Tutorial movement (tap-to-move / stick); a prop — a *rendering notice* (first lore beat); trigger: 1 scrapper |
| **B · The Drip** (flooded tunnel) | Trigger: scrapper + render-construct (teaches Rendering + Break); a salvage cache (+12 grist); Tobi banter |
| **C · The Cage** | The **Ashling** boss; then the **free-vs-wield** choice; a workshop **bench** (growth screen) and the exit |

## Economy in the slice

- Earnable grist: ~**48** (6 + 10 + 12 cache + 20 boss). Starting grist: **10**.
- Spending opportunities (the bench in room C):
  - **Augment "Runner's Reflex"** (+2 SPD) — **25 grist**, or
  - **Accelerate learning Cinder** — **20 grist**.
- The boss tempts a **Bind: Wisp** (8 grist) to win faster — directly trading
  growth-grist for a combat edge (the thesis in one fight;
  [combat](../design/combat.md)).

## Systems demonstrated (coverage map)

| System | Where |
|---|---|
| ATB + action menu | all encounters |
| Craft (AP spell) | Spark, from room A |
| Bind (grist summon) — two-resource tension | Emberwisp Bind in the boss fight |
| Status + Pressure→Break | render-construct & the Ashling |
| Bound acquire + free/wield + learning | the Ashling reward |
| Grist economy + spend-to-grow | the bench |
| Save/determinism | seeded run; save after the slice |

## Asset manifest (slice — placeholder-first)

Built with programmatic placeholders, swapped for FFVI-grade art via the pipeline
([art-direction](../design/art-direction.md), [roadmap](roadmap.md)). Side-view battles,
384×216 ([decisions/0006](../decisions/0006-phase-1-technical-decisions.md)).

- **Sprites:** Wren, Tobi (field + side-view battle, idle/move/attack/hurt); Marrow
  scrapper, Render-construct, the Ashling (battle, with Break state); Sable-coffin prop.
- **Tiles/backdrops:** Marrow tileset (street, flooded tunnel, the cage chamber); 1
  battle backdrop (Marrow).
- **UI:** battle HUD (party HP/AP/ATB, grist pool, target/Break, command menu), the
  growth/bench screen, touch controls (move + confirm/cancel + battle-speed).
- **SFX:** strike, Spark, Rendering, Bind, Break/Severance, the **grist-spend** sound,
  UI ticks, the Ashling's voice.
- **Music:** Marrow ambient stem; battle theme; the Ashling's sorrowful cue (a first
  fragment of the Song; [audio-direction](../design/audio-direction.md)).

## UAT script (definition of done)

An agent drives this via the verification bridge (seed → state → inject input) and via
real touch/keyboard, capturing evidence ([playbooks/run-and-verify](../playbooks/run-and-verify.md),
[test-plan](../playbooks/test-plan.md)). Maps 1:1 to the
[vertical-slice](vertical-slice.md) acceptance criteria.

1. **Boot** to the slice with a fixed seed; no console errors; canvas renders at
   384×216 scaled.
2. **Room A:** move Wren via touch + keyboard; examine the rendering notice (lore
   shows); trigger the scrapper fight.
3. **Combat basics:** win the fight using **Strike** and **Spark** (AP drops); ATB
   gauges and turn order read correctly; battle-speed/Wait toggles.
4. **Room B:** win the scrapper+construct fight; land/observe **Rendering**; build
   **Pressure** to **Break** the construct and land a finisher; collect the salvage
   cache (grist increases).
5. **Boss:** reach the Cage; fight the **Ashling**; use **Bind: Wisp** and confirm it
   **spends grist from the same pool** used for growth (the two-resource tension);
   Break-gate the boss; win.
6. **Choice:** the **free-vs-wield** prompt appears; choosing yields a different,
   persistent shard + karma flag (verify state differs per choice).
7. **Grow:** at the bench, **equip the Ashling shard** and confirm it **begins
   teaching Cinder**; **spend grist** (augment *or* learning-accelerate) and confirm
   the wallet draws down and the build changes.
8. **Persist:** save; reload; confirm party, grist, learned/learning, shard choice,
   and flags survive (versioned `SaveData`;
   [engineering-spec](../architecture/engineering-spec.md)).
9. **Whole loop** (explore → fight → Bound → grow) completes in one ~10–15 min sitting.

Automated coverage: combat/economy/learning **unit tests** (deterministic) + an **e2e
spec** driving steps 1–9 through the bridge ([test-plan](../playbooks/test-plan.md)).
