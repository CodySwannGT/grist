---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Side-content & meta-systems

In a 40+ hour slow-burn game, **the side-content is the game** as much as the
critical path — it's where the mourning, the texture, and the best character
writing live ([overview](overview.md)). This page covers side-stories, faction
reputation, the recurring moral economy, and the systems that carry the player
across the two world-states.

## Side-stories (the heart)

- **Character side-stories.** Each party member ([characters](../narrative/characters.md))
  has a multi-part personal arc unlocked through the world — Wren's rendered
  sister, Halcyon's cursed name, Maren's passing age, Q's reckoning with what it's
  made of. These are the emotional core and are designed to be *the reason to
  wander*, not optional filler.
- **Place side-stories.** Most landmarks, the ruined city-states, and the Deep
  carry self-contained stories that deepen the lore of the Sundering and the dying
  Weave ([world](../narrative/world.md)) — found, not pushed.
- **Set-pieces.** The signature spectacle scenes in the FFVI-opera tradition —
  chief among them the **Sidhe requiem-rite** ([story](../narrative/story.md)),
  where a mystery layer breaks open inside the music.

## Faction reputation

Standing with the powers ([factions](../narrative/factions.md)) is tracked and
consequential:

- **The Concord & its Houses** (Mourne, Caldecott, Vesper, Quill) — contracts,
  access, and gear; cozying up grants power and stains you.
- **The Unrendered** — the resistance; aid them for different rewards and a
  different read on the ending.
- **The Ashfast enclaves** — the grist-renouncers; favor here is spiritual and
  mechanical (paths that don't require rendering).

Reputation opens contracts, vendors, safehouses, and dialogue, and it **feeds the
ending eligibility** ([story](../narrative/story.md)). You cannot max everyone —
allegiance is an expressive, lasting choice.

## The recurring moral economy

The **render-or-not** decision ([progression-and-economy](progression-and-economy.md))
recurs as concrete, situated choices all game: a contract that pays double if you
render the mark; a Bound you can free or wield; a dying region you can strip for
grist or leave whole. The game **never blocks the shortcut and always remembers
it** — these choices accumulate into faction standing, party trust, available
endings, and the simple record of what you were willing to spend.

## Contracts & bounties

The repeatable layer that funds the build: courier runs, hunts (including the
optional **Bound** superbosses; see [open-world](open-world.md)), salvage jobs,
and House/Unrendered/enclave contracts. Tuned so the **main path needs little
grinding**, while the systems richly reward players who *want* to grind
([overview](overview.md)).

## Act II: reunion quests

After the Reckoning, the scattered party is recovered through **optional reunion
quests** across Ashfall ([open-world](open-world.md)) — each a self-contained
story, FFVI-style, and each missable. Who you find (and who you become to find
them) shapes the finale and which endings are reachable. You can march on the end
with an incomplete party.

## Meta-systems

- **Save & persistence.** Versioned saves with the project's migration discipline
  ([architecture/overview](../architecture/overview.md)); the run records your
  faction standing and moral ledger so the ending can read them.
- **Codex / the Ledger.** An in-world archive that fills as you learn — lore on the
  Choir, the Bound, the Houses, and the truth of the Sundering — doubling as the
  player's map of the slow-burn mystery.
- **Accessibility.** Configurable battle speed / full Wait mode
  ([combat](combat.md)), readable telegraphs, scalable difficulty, and the
  reduced-motion/pause-on-blur baseline the starter already enforces. The
  slow-burn tempo makes GRIST naturally accessible — lean into it.
- **New Game+ / replay.** Build freedom ([progression-and-economy](progression-and-economy.md)),
  branching faction paths, and multiple endings make a second run a genuinely
  different game — carry build mastery forward, chase a different ending.
