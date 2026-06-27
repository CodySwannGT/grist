---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Game design — overview

This is the game-design source-of-truth for GRIST. It builds on the narrative
bible ([pitch](../narrative/pitch.md), [world](../narrative/world.md),
[story](../narrative/story.md)) and the two locked design pillars recorded in
[decisions/0002-core-game-design-pillars](../decisions/0002-core-game-design-pillars.md):
**ATB turn-based combat** and **grist-augment character building**.

Detailed systems live in [combat](combat.md),
[progression-and-economy](progression-and-economy.md), [open-world](open-world.md),
and [side-content](side-content.md).

## Design pillars

1. **The system is the theme.** GRIST's premise is that the world, its people,
   and its gods are all fuel to be consumed (see [world](../narrative/world.md)).
   The mechanics must *enact* that, not just decorate it: **grist is the unified
   currency, the crafting material, the progression fuel, and the literal world-
   fuel — all the same substance.** Every time the player grows stronger, they
   spend the stuff the world is dying for. Progression and complicity are the same
   action.
2. **Slow burn, no rush, by design.** Deliberate pacing is the product, not a
   compromise. Soft gates over hard timers; few ticking clocks in the fiction;
   the world rewards wandering and patience. Combat is methodical and readable;
   progression is accumulative. The target is the player who *wants to stay
   longer*.
3. **Ensemble, not a chosen one.** A deep cast of distinct people (see
   [characters](../narrative/characters.md)). Builds are customizable, but each
   character keeps a signature identity. Party composition is an expressive
   choice, and — in the FFVI tradition — you can reach the ending with whoever you
   have.
4. **One world, mourned twice.** The open map physically transforms at the
   midpoint (Act I *The Reach* → the *Reckoning* → Act II *Ashfall*; see
   [open-world](open-world.md)). Design every region to read in both states.
5. **Mature, mournful, but warm.** The grind has weight (you're consuming souls),
   but the party is a refuge. Humor and heart keep the elegy bearable.

## The core loop

```
   EXPLORE the open world (Vanta's tiers + the Reach)
        │   find contracts, ruins, the Bound, side-stories, salvage
        ▼
   ENGAGE in ATB combat
        │   earn grist + anima + salvage; spend grist to win big
        ▼
   GROW  — equip Bound shards to learn magic, slot chrome augments,
        │   refine grist, craft gear  (all paid in grist)
        ▼
   ADVANCE the slow-burn mystery at its own deliberate pace
        └───────────────────────────────► back to EXPLORE
```

The loop is gated by **deliberate story beats**, not urgency. Side-content (see
[side-content](side-content.md)) is woven through every layer and is where most of
the game's hours and best writing live.

## Session shape

A "good hour" of GRIST: descend a tier or cross a region, fight a few methodical
ATB encounters, free or confront one of the Bound, advance a character's side-
story, and return to a ripperdoc to spend the grist you earned (and weigh whether
to render for more). One mystery layer peels open every several hours, never
faster.

## Difficulty & pacing philosophy

- **Readable, not reflexive.** ATB rewards planning and resource management over
  execution. Hard fights are solved by builds and preparation, not twitch.
- **The grind is opt-in depth, not a wall.** The main path is tuned to be
  beatable near 40 hours without heavy grinding; the *systems* reward players who
  choose to go deep (the Bound, augment builds, refining). "Grindy" is an
  invitation, not a tax.
- **Moral friction as a difficulty axis.** The fastest grist comes from
  rendering (see [progression-and-economy](progression-and-economy.md)) — power at
  a cost the story remembers. The game lets you take the shortcut and makes you
  live with it.

## How design maps to the story

| Story element | System expression |
|---|---|
| Grist = refined souls/god-essence | Unified currency + progression fuel + crafting mat |
| The Bound (caged old powers) | Esper-style summons **and** the source of learnable magic |
| Rendering people into fuel | Optional high-yield grist source with reputation/ending consequences |
| The Sundering / dying Weave | World desaturation motif; magic scarcity; Ashfall world-state |
| The two-world turn | The open map transforms at the midpoint |
| Ensemble, no chosen one | Customizable-but-signature builds; finish with any party |
