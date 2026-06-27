---
type: production
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# The vertical slice — "The Bound in the Marrow"

The **first thing we build that actually feels like GRIST**: ~10–15 minutes that
capture the whole thesis in miniature. It sits at Phase 2 of the
[roadmap](roadmap.md) (Phase 1 builds the combat underneath it first).

A vertical slice proves the **core loop end-to-end** — explore → fight → grow →
advance ([design/overview](../design/overview.md)) — at the smallest scale that
still has the game's soul. Everything here maps to an existing design doc; nothing
new is being invented, only sliced thin.

## The fantasy this slice delivers

> You're Wren, deep in the Marrow. Something old is caged down here. You fight your
> way to it through a couple of methodical ATB skirmishes, spending grist you can't
> really spare. At the cage you face a **Bound** — and you can burn the last of
> your grist to overpower it, or grind it down the hard way. Then the choice:
> **free it** (weaker, cleaner, it remembers) or **wield it** (stronger, darker, it
> costs you). Either way you walk out changed — a new spell half-learned, the grist
> ledger lighter, and the dawning understanding of what this whole city runs on.

That paragraph is the entire pitch ([pitch](../narrative/pitch.md)) made playable.

## What's IN the slice

### 1. A tiny explorable area
One short, linear-ish slab of the Marrow ([world](../narrative/world.md)): a street
and a descent to the cage. Walk, examine a few props (environmental lore), trigger
encounters. Placeholder art is fine.

### 2. ATB combat (the Phase 1 core, in context)
The full readable loop from [combat](../design/combat.md), minimal but real:
- Party of **2** (Wren + one ally); 2–3 enemy types.
- Turn gauges; action menu: **Strike / Craft / Bind / Item / Defend**; configurable
  battle speed / Wait mode.
- The **two resources**: ordinary spells cost **Anima**; the strong play costs real
  **grist** (your wallet). At least one fight where spending grist is tempting.
- One element + one status (e.g. *Ash* + *Rendering*) and the Pressure→Break beat,
  so the system reads as more than trading hits.

### 3. One Bound (the heart of the slice)
A single caged old power as the set-piece encounter
([combat](../design/combat.md), [open-world](../design/open-world.md)):
- A boss fight with a Break-gated phase and the "spend grist to win faster?"
  tension live.
- On resolution, the **free vs wield** choice, with a real, visible consequence
  (a karma/standing flag + which version of the shard you get).
- The shard then demonstrates **progression**: equip it and begin **learning one
  spell** ([progression-and-economy](../design/progression-and-economy.md)).

### 4. A minimal grist economy + growth screen
- Earn **grist** from the fights; see it as the one unified resource
  (currency + fuel).
- Spend it once: either **install one chrome augment** or **accelerate learning the
  shard's spell** — proving "growth is spent grist."
- One simple menu to do it. Numbers can be rough; the *loop* must be real.

### 5. One moral beat
The free-vs-wield choice is the slice's version of the recurring **render-or-not**
economy ([side-content](../design/side-content.md)) — power vs. cost, and the game
remembers.

## What's explicitly OUT (do not build yet)

Cutting these is the point — they come in Phases 3–4 of the [roadmap](roadmap.md):

- ❌ The open world, the airship, fast-travel, multiple regions
- ❌ The full party, recruitment, party-swap depth
- ❌ The main-quest plot, cutscene system, dialogue trees (a few lines of barks is
  enough)
- ❌ Final art, music, and the desaturation motif (placeholders only)
- ❌ The full bestiary, ability list, item catalog, multiple Bound
- ❌ The world-turn / Ashfall, faction reputation, endings
- ❌ Save-slot UI polish (the save *service* exists; no fancy menu needed)

If a task isn't required to make the paragraph above playable, it waits.

## Acceptance criteria (definition of done)

Per the project's verification-is-UAT gate
([playbooks/run-and-verify](../playbooks/run-and-verify.md)), the slice is done when
**an agent has played it start to finish** and confirmed, with committed evidence
and automated `tests/e2e` specs:

1. The player can move through the Marrow area and trigger encounters.
2. An ATB battle can be fought and won using the full action menu, with battle
   speed / Wait configurable.
3. Spending **grist** in combat (a Bind or a Render) works and visibly draws down
   the same grist used for growth — the two-resource tension is observable.
4. The **Bound** boss can be beaten; the **free vs wield** choice is offered and
   produces a different, persistent result.
5. The earned shard can be equipped and **begins teaching a spell**; spending grist
   in the growth screen advances a build.
6. The whole loop (explore → fight → face the Bound → grow) is reachable in one
   sitting, ~10–15 minutes.
7. All game rules (combat, economy, learning) live in `src/logic`, are
   deterministic, and are unit-tested
   ([conventions/coding-conventions](../conventions/coding-conventions.md)).

## How it maps to the design docs

| Slice element | Design source |
|---|---|
| ATB battle, two resources, Break | [combat](../design/combat.md) |
| The Bound: summon + learn + free/wield | [combat](../design/combat.md), [progression-and-economy](../design/progression-and-economy.md) |
| Grist as one resource; spend-to-grow | [progression-and-economy](../design/progression-and-economy.md) |
| The Marrow area, descent | [open-world](../design/open-world.md), [world](../narrative/world.md) |
| Free-vs-wield as the moral economy | [side-content](../design/side-content.md) |
| Wren as POV | [characters](../narrative/characters.md) |

## After the slice

Re-scope Phase 3 ([roadmap](roadmap.md)) using what the slice taught us, then grow
it into "the first hour." The slice's combat, economy, and Bound systems become the
reusable spine the rest of the game is built on.
