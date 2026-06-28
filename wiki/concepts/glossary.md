---
type: reference
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Glossary

The canonical vocabulary of GRIST — world, systems, and project terms — so naming
stays consistent across all writing and code. When in doubt, use the term as defined
here. Deep detail lives in [world](../narrative/world.md),
[lore-and-history](../narrative/lore-and-history.md), and the
[design](../design/overview.md) docs.

## The world & cosmology

- **Aurd** — the world. The central supercontinent of play is the **Mourning Reach**
  ("the Reach").
- **The Choir** — the old gods, who *sang* the world into being. Five voices:
  **Aurel** (Dawnfather/World-Soul, the keystone), **Morra** (death/memory), **Korr**
  (earth/making), **Sylvae** (life/the wild), **Threne** (entropy/endings).
- **The Weave** — the living magic of the world, the Choir's song made real; now
  fraying and fading.
- **Aurel** — the slain keystone-god whose corpse-mountain underlies Vanta; not fully
  dead, *dreaming its way into death* over nine centuries.
- **The Sundering / the Silencing** — the murder of the Choir (≈AS 0) to industrialize
  the dead into fuel; publicly remembered as an impersonal cataclysm.
- **AS / BS** — years After / Before Silence (the Sundering). The present ≈ **AS 920**.
- **The Reckoning** — the **Second Sundering**, the midpoint catastrophe Mr. Sallow
  triggers; turns the world from the Reach into Ashfall.

## Grist & the Craft

- **Grist** — refined essence; the unified currency, fuel, crafting material, and
  remaining magic. *Grist for the mill* — the world, its people, and its gods are all
  raw material. (The game; the thesis.)
- **Ichor** — raw divine essence seeping from Aurel's corpse.
- **Anima** — raw soul-residue rendered from living things; also the in-combat spell
  resource (**AP**).
- **Black grist** — grist rendered from *people*; the open secret.
- **Rendering** — turning a being into grist; also a combat **status** (a DoT that, on
  a kill, "spends" the target). The recurring moral choice.
- **The Craft** — the industrialized remnants of the Weave; the modern "magic"
  (in-combat verb: cast a learned spell).

## Peoples & powers

- **The Sidhe ("the Withered")** — the old enchanted folk; fading underclass who
  remember the Choir.
- **The Forgekin ("Delvers")** — the dwarven-descended; engineers and ripperdocs.
- **The Bound** — great old powers caged as reactors; the game's summons *and* the
  source of learnable magic (see **shards**).
- **Frames** — grist-powered exo-armor; the corporate magitek-knights.
- **Augments** — chrome-and-anima body modifications; slotted character upgrades.

## Places

- **Vanta** — the vertical megacity grown into Aurel's corpse; the central hub. Tiers,
  top to bottom: **the Crown**, **the Tiers**, **the Marrow** (undercity), **the
  Roots / the Deep**.
- **The Reach** — the overworld in Act I (World of Balance).
- **Ashfall** — the same world after the Reckoning (World of Ruin): magic-dead,
  drained, haunted.
- **Reach regions** — **Sylvemarch** (surviving forest), **the Cinderfen** (ashlands),
  **Holtspire** (Caldecott's Anvil-city), **the Wrack** (Sundering coast), **the
  Binding-grounds** (where the Bound are caged).

## Factions

- **The Concord** — the ruling cartel of Great Houses.
- **The Houses** — **Mourne** (refining/the Throne; Sallow's House), **Caldecott**
  (industry/frames), **Vesper** (biotech/rendering), **Quill** (media/finance/
  surveillance).
- **The Unrendered** — the fractured resistance.
- **The Ashfast** — communities that have renounced grist.

## People

- **Wren** (courier/POV), **Sable** (the source; Aurel's heir), **Halcyon Mourne**
  (fallen frame-knight), **Tobi Vesk** (artificer), **Maren** (the last Sidhe who
  remembers), **Quietus / "Q"** (the ghost in the machine). Antagonist: **Mr. Sallow,
  the Renderer**. Full bios: [character-bios](../narrative/character-bios.md).

## Systems

- **ATB** — Active Time Battle; the combat model ([combat](../design/combat.md)).
- **Shard (Bound shard)** — the esper-equivalent; equip to summon (**Bind**), learn
  spells, and bias growth. **Free vs. wield** — the acquisition choice (clean/weaker
  vs. strong/corrupting).
- **The two resources** — **Anima (AP)** for ordinary spells; **grist** (your wallet)
  for the strongest actions. ([combat-spec](../design/combat-spec.md))
- **Pressure → Break → Severance** — the weakness/stagger/finisher loop.
- **Elements** — Flux, Ash, Iron, Bloom, Gloom.
- **The moral ledger** — the recorded history of render-or-not choices; feeds faction
  standing and ending eligibility ([side-content](../design/side-content.md)).
- **The Song** — the Choir's leitmotif; fragmented across the score, heard whole only
  at the end ([audio-direction](../design/audio-direction.md)).

## Project terms

- **Lisa** — the AI-governance toolchain ([architecture/overview](../architecture/overview.md)).
- **Verification = UAT** — the definition of done: an agent plays the build vs.
  acceptance criteria ([playbooks/run-and-verify](../playbooks/run-and-verify.md)).
- **Harness / fleet** — an AI coding agent (claude, codex, cursor, agy, copilot,
  opencode); `fleet` = all of them.
- **The vertical slice** — "The Bound in the Marrow," the first build target
  ([production/vertical-slice](../production/vertical-slice.md)).
