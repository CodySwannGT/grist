---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Regions & level design

The places of GRIST: Vanta's vertical tiers (the central hub) and the regions of
the Reach, each authored to read in **both world-states** — Act I *Reach* and Act II
*Ashfall* ([open-world](open-world.md)). This is a **first-pass map**
([gdd](../production/gdd.md)); locations and encounters firm up as regions are built.
Setting in [world](../narrative/world.md); look in
[art-direction](art-direction.md).

## How to read a region card

Each card lists the region's **identity**, **key locations**, **who/what's there**,
its **Bound** (the caged old power that anchors it;
[combat](combat.md)), and how it **transforms in Ashfall**
([main-quest](../narrative/main-quest.md)).

---

## Vanta — the vertical hub

The megacity grown into Aurel's corpse ([world](../narrative/world.md)). Its tiers
are zones; **descent is the basic gesture** — light and lies above, truth and the
dead below. Persistently explorable; the spine of the open world.

### The Crown
- **Identity:** corporate spires on the god's skull; gold light, clean air, the
  Houses ([factions](../narrative/factions.md)). Order and cold.
- **Key locations:** the Concord Hall; House Mourne's refinery-spire (atop the
  corpse); the Founding plaza (the holiday set-piece;
  [lore-and-history](../narrative/lore-and-history.md)).
- **Bound:** none caged here — the Crown *consumes*, it doesn't hold.
- **Ashfall:** half-collapsed, gold gone grey; the Houses bunkered or fled.

### The Tiers
- **Identity:** the working city — markets, Craft-shops, the most lived-in space; the
  hub's services and vendors.
- **Key locations:** Tobi's workshop (crafting/refining hub;
  [progression-and-economy](progression-and-economy.md)); the grand market; Quill
  media-halls.
- **Ashfall:** shuttered, scavenger-run, a few stubborn lights.

### The Marrow
- **Identity:** the undercity *inside* the hollow corpse — neon, rain, ancient bone;
  the underclass, the rendering-houses. The signature cyberpunk-fantasy look and the
  **vertical-slice** setting ([vertical-slice](../production/vertical-slice.md)).
- **Key locations:** the runner-warrens (Wren's world); a rendering-house (the horror
  made visible); the cage where the first **Bound** is found.
- **Bound:** the first, weakened Bound — the tutorial of the free-vs-wield choice.
- **Ashfall:** partly rendered to ash by the Reckoning; the wound where the Second
  Sundering began.

### The Roots / the Deep
- **Identity:** buried pre-Sundering ruins beneath the corpse; pooled wild Weave; old
  things linger. The fantasy heart under the city.
- **Key locations:** the drowned old kingdom; the **Sidhe requiem-hall** (the
  Ch.4 set-piece; [main-quest](../narrative/main-quest.md)).
- **Bound:** an ancient, near-free power that remembers the Choir.
- **Ashfall:** the Weave here guttering but not dead — a last bright place.

---

## The Reach — the overworld

Hand-authored regions radiating from Vanta, reached by skiff then airship
([open-world](open-world.md)).

### Sylvemarch — the surviving forest *(the Green Mother's march)*
- **Identity:** a living Deep place; old forest where the Weave still breathes; the
  Sidhe remnant; the brightest palette in the game ([art-direction](art-direction.md)).
- **Key locations:** the Sidhe enclave (Maren's people;
  [character-bios](../narrative/character-bios.md)); a Weave-spring; overgrown
  pre-Sundering ruins.
- **Bound:** a great caged **wyrm**, the region's anchor and a major free-vs-wield
  decision.
- **Ashfall:** the forest greying and dying fast — the most painful transformation,
  by design.

### The Cinderfen — the ashlands
- **Identity:** strip-mined wastes; magic-dead; dead refineries and haunted negative
  space ([art-direction](art-direction.md)). What the Reach becomes everywhere if the
  machine keeps eating.
- **Key locations:** abandoned grist-mines; an Ashfast enclave (Brother Asch's order;
  [factions](../narrative/factions.md)); the bones of a felled Bound.
- **Bound:** a dying, half-rendered power — a moral gut-punch more than a fight.
- **Ashfall:** barely changes — it was already ruin; now the rest of the world looks
  like it.

### Holtspire — the Anvil-city *(House Caldecott)*
- **Identity:** a rival industrial city-state; foundries, frames, smoke; Caldecott's
  domain and its resentment of Mourne ([factions](../narrative/factions.md)).
- **Key locations:** the great foundry; the frame-yards (Halcyon's old life;
  [character-bios](../narrative/character-bios.md)); a black-market ripper row.
- **Bound:** a power harnessed *openly* as a city reactor — the atrocity
  industrialized.
- **Ashfall:** the foundries cold and silent; Caldecott a warlord remnant.

### The Wrack — the Sundering coast
- **Identity:** where the Sundering's wound is rawest; a broken tidal coast under
  Threne's shadow ([lore-and-history](../narrative/lore-and-history.md)); a cult that
  courts oblivion — Sallow's unwitting congregation.
- **Key locations:** the Sundering-scar; the oblivion-cult's hold; a sunken
  Choir-shrine.
- **Bound:** the most alien, entropy-touched power; foreshadows the finale.
- **Ashfall:** the sea pulling back; the scar widening — the edge of the end.

### The Binding-grounds *(woven across the wilds)*
Not one place but the remote sites where the Bound are caged
([combat](combat.md)) — the open world's signature destinations and optional
superbosses. Each is a small dungeon + boss + moral event; freeing or wielding each
is a lasting choice ([side-content](side-content.md)).

---

## Level-design principles

- **Verticality and descent** as the spatial language, especially in Vanta
  ([art-direction](art-direction.md)).
- **Environmental storytelling first.** The truth of the world is *found* in places,
  not narrated ([quest-design](quest-design.md)).
- **Density over breadth.** Fewer, richer regions; each with a clear identity, a
  Bound, an enclave or city, and authored side-stories
  ([quest-design](quest-design.md)).
- **Author both states together.** Every region ships a Reach version and an Ashfall
  version; Act I makes you love a place so Act II can make you mourn it
  ([main-quest](../narrative/main-quest.md)).
- **Soft gating.** Traversal and knowledge gate the map, not invisible walls or timers
  ([open-world](open-world.md)).
