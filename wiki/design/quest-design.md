---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Quest design

How quests are built and paced in GRIST — the framework, not the full quest list
(individual quests are living content authored per region;
[gdd](../production/gdd.md)). It connects the [main-quest](../narrative/main-quest.md)
beats, the [character bios](../narrative/character-bios.md), and the systems in
[side-content](side-content.md).

## Philosophy

- **Side-content is the game.** In a 40+ hour slow burn, the best writing and most of
  the hours live off the critical path ([overview](overview.md)). Quests are designed
  to *be the reason to wander*, not filler between cutscenes.
- **Found, not pushed.** Most quests are discovered through the world — overheard,
  stumbled into, read in the environment — rather than handed out from a board
  ([open-world](open-world.md)). Markers are optional.
- **Every quest is a small argument.** Each one says something about consumption,
  mourning, or personhood ([themes-and-tone](../narrative/themes-and-tone.md)) — even
  the small ones. No purely mechanical fetch quests.

## Quest types

| Type | Purpose | Pacing |
|---|---|---|
| **Main (chapter) quests** | The critical path ([main-quest](../narrative/main-quest.md)) | Gated by deliberate story beats |
| **Character side-stories** | Deep arcs for each party member ([character-bios](../narrative/character-bios.md)) | Unlock across the world; multi-part |
| **Place stories** | Self-contained tales of a location/region | Discovered in the world |
| **Faction quests** | Standing & access with the Houses / Unrendered / enclaves ([factions](../narrative/factions.md)) | Branching; mutually limiting |
| **Contracts & bounties** | The repeatable economy layer ([progression-and-economy](progression-and-economy.md)) | On-demand; fund builds |
| **The Bound** | Open-world setpiece encounters ([combat](combat.md)) | Optional; per-region |

## Quest anatomy

A standard authored quest:

1. **Hook** — environmental or overheard; rarely a quest-giver barking at you.
2. **Investigation/travel** — moving through a space, learning it (the slow burn).
3. **A complication** — usually a moral one: a render-or-not fork, a faction cost, a
   truth that's unwelcome ([side-content](side-content.md)).
4. **A combat or systems beat** — an encounter, a Bound, a build gate — but not
   mandatory in every quest.
5. **Resolution with a remembered consequence** — standing shifts, a flag is set, the
   world or a character changes. The game *remembers* ([story](../narrative/story.md)).

## The character side-story framework

Each party member has a **multi-part arc** ([character-bios](../narrative/character-bios.md)):

- **Unlocks progressively** as you travel and as relationship/trust grows (banter and
  small beats build toward the larger chapters).
- **Pays off thematically** in a climactic choice tied to that character's wound (Wren
  & rendering, Halcyon & her name, Q & what it's made of).
- **Feeds the ending.** Completing arcs raises party trust and unlocks ending-relevant
  outcomes ([story](../narrative/story.md)); they are the strongest reason to slow down
  and finish people's stories.

## The two-world-state rule

Every region's side-content is authored to **work in both world-states** — Act I
*Reach* and Act II *Ashfall* ([open-world](open-world.md)):

- **Act I quests** establish places and people you'll mourn.
- **Act II reunion quests** ([main-quest](../narrative/main-quest.md)) recover the
  scattered party — each a self-contained story, each missable; who you find shapes the
  finale.
- Some Act I quests have **Ashfall echoes** — the same NPC, the same street, after the
  Reckoning — turning earlier investment into grief.

## Branching & consequence

- **Faction allegiance is mutually limiting** ([factions](../narrative/factions.md)):
  you cannot please everyone; choices close doors and open others.
- **The moral ledger** records render-or-not decisions across all quest types and
  feeds standing, party trust, and ending eligibility
  ([side-content](side-content.md)).
- **No fail-states for wandering.** Going somewhere "too early," skipping a reunion, or
  taking the dark option are *valid choices the game absorbs*, not failures.

## Tuning for the slow burn

- **Critical path needs little grinding** to clear near 40 hours; depth is opt-in
  ([progression-and-economy](progression-and-economy.md)).
- **Density over breadth.** A region has fewer, richer quests rather than a sprawl of
  thin ones — same discipline as the [vertical-slice](../production/vertical-slice.md).
- **Quests are content (living docs).** The framework is fixed here; specific quests are
  written per region as it's built ([gdd](../production/gdd.md)).
