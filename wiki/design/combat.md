---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Combat

GRIST uses an **ATB (Active Time Battle)** system in the direct lineage of *Final
Fantasy VI*: party of four, individual turn gauges, deliberate and readable.
Combat is solved by builds, resources, and planning rather than reflexes (see the
pacing philosophy in [overview](overview.md)). Character growth that feeds combat
is in [progression-and-economy](progression-and-economy.md).

## The ATB core

- **Party of 4 active**, drawn from your roster; the rest are reserve (and gain
  reduced growth). You can finish the game with whoever you have
  ([characters](../narrative/characters.md)).
- Each combatant fills an **ATB gauge** in real time (modified by Speed). When it
  fills, they act; the world keeps moving, so hesitation has a cost.
- **Battle Speed / Wait modes** are player-configurable (Active ↔ Wait), so the
  game flexes from tense to fully methodical — core to the "slow, readable"
  identity and to accessibility.

## The action menu

On a ready turn:

| Action | What it does |
|---|---|
| **Strike** | Basic weapon attack; weapon type sets range/element/follow-ups |
| **Craft** | Cast a learned spell (the "magic" verb — "the Craft," see [world](../narrative/world.md)). Costs **Anima (AP)**. |
| **Bind** | Channel an equipped **Bound** (summon). Powerful, build-defining, and costs **grist** — your actual currency. |
| **Augment** | Trigger a character's slotted chrome **active** abilities (overdrives, tools, gadgets) |
| **Item** | Consumables; refined-grist restoratives |
| **Defend / Shift** | Guard, or swap an active member with a reserve (costs a turn) |

### Two resources, one of them is money

This is the combat expression of the core theme:

- **Anima (AP)** — the ordinary spell resource (the MP analog). Regenerates,
  cheap, refillable. Most Craft spells run on it.
- **Grist** — your literal currency and the world's fuel. The strongest options —
  **Bind** (summons), top-tier **Render** spells, and emergency revives — *cost
  grist out of your wallet.* Winning hard fights the easy way **spends the
  resource you need to grow.** Every boss becomes a question: do I burn grist to
  win faster, or grind it out clean? The game's whole thesis, in a turn.

## Elements, status & the "stagger" layer

- **Elements** map to the cosmology: *Flux* (raw Weave), *Ash* (entropy/decay),
  *Iron* (the Craft/industry), *Bloom* (life/anima), *Gloom* (void/silence). Weak/
  resist tables drive build choices.
- **Status** leans into the fiction: *Rendering* (a DoT that, if it kills, denies
  loot — you've "spent" the enemy), *Silenced* (cut off from the Weave → no
  Craft), *Hollowed* (drained, reduced grist gain), *Bound* (rooted).
- **Pressure → Break.** Exploiting weaknesses builds *Pressure*; a Broken enemy is
  open to massive damage and to **Severance** (a finisher). Readable, methodical,
  rewards system knowledge over speed.

## The Bound (summons / espers)

The great old powers the Houses caged as reactors ([factions](../narrative/factions.md))
are GRIST's espers — and they carry the game's moral weight:

- You acquire a **Bound shard** by confronting a caged old power in the world
  (open-world setpieces; see [open-world](open-world.md)). You can **free** it
  (story/karma reward, a weaker partnership) or **wield** it (a stronger shard, a
  darker mark on you).
- An equipped shard does double duty: in combat you **Bind** to summon it (a grist-
  costed, screen-clearing channel), and over time it **teaches** the character its
  spells — the esper-style learning system in
  [progression-and-economy](progression-and-economy.md).
- **Overdraw.** Lean on a Bound too hard and it *frays* — diminishing returns and
  a creeping corruption mechanic that the story notices. The most powerful crutch
  is a slow poison.

## Frames (magitek armor)

Corporate exo-armor ([world](../narrative/world.md)) appears in combat as **piloted
states**: scripted set-pieces, certain boss phases, and unlockable party frames
that swap a character's whole action set for a heavy, grist-hungry kit. Frames hit
like a truck and drink grist — power you rent, never own.

## Enemy & boss design

- **Trash** teaches one idea each (an element, a status, a Pressure route) so the
  systems stay legible.
- **Bosses** are puzzles of build + resource management, often with a Break-gated
  phase and a "do you spend grist?" temptation. Signature bosses are the **Bound**
  themselves and the agents of **Mr. Sallow** ([characters](../narrative/characters.md)).
- **The Reckoning changes the fight.** After the midpoint world-turn, Ashfall
  enemies are warped, grist is scarcer, and the Weave is guttering — so Anima-
  reliant strategies strain and the grist temptation sharpens. The same systems,
  mourned ([story](../narrative/story.md)).

## Accessibility & feel

Configurable battle speed and full Wait mode, clear telegraphs, no twitch
requirements, and damage/turn-order readouts that make the methodical play legible. The
combat should feel like *chess with a clock you control* — which is exactly the
tempo of a slow-burn JRPG.
