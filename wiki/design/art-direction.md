---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Art direction

The visual bible for GRIST. The bar, stated up front: **expressive 16-bit pixel
art at least equal to the original *Final Fantasy VI*** — its *grandeur*, not
merely its resolution — elevated with modern lighting, parallax, and a signature
color motif. This page locks the look so every future asset has a target. It
realizes the aesthetic notes in [themes-and-tone](../narrative/themes-and-tone.md)
and the world of [world](../narrative/world.md).

## The one-line look

**Chrome grafted onto rune; gold and ash; neon over old bone.** Every frame should
read as cyberpunk *and* high fantasy at once — a circuit that is also a sigil, a
server-vault that is also a reliquary. If a single screenshot can't say both, it's
wrong.

## Pillars

1. **FFVI-grade craft.** Hand-authored pixel art with rich palettes, expressive
   sprite animation, and painterly, layered backgrounds. Detail in service of
   readability and mood, never noise.
2. **The dying Weave, shown not told.** A continuous **desaturation motif**: the
   world is slowly losing its color as it runs down ([story](../narrative/story.md)).
   This is the project's signature visual idea and it must be designed in from the
   first tile, not bolted on.
3. **Vertical and descending.** Wealth and light live at the top of Vanta; truth
   and the dead at the bottom. Composition favors verticality and downward motion
   ([open-world](open-world.md)).
4. **Mournful, but warm.** Elegiac and rain-soaked, with pools of warm light
   (Tobi's workshop, a safehouse, a fire) that make the melancholy bearable.

## Technical baseline

These are **first-pass targets** to be confirmed in Phase 1
([gdd](../production/gdd.md)); lock them early because they constrain every asset.

| Spec | Target | Notes |
|---|---|---|
| Native resolution | 16-bit-era base (e.g. 384×216) scaled to 1080p/4K | Integer scaling; crisp pixels |
| Tile grid | 16×16 base tiles | Sub-tile detail via overlays |
| Character sprites | ~16×24 field; larger battle sprites (FFVI battle-scale) | Distinct silhouettes per character |
| Color | Curated palettes per region/biome; limited per-scene | The desaturation motif rides on top |
| Animation | Hand-keyed; idle + signature motion for each character | Readability of battle states is mandatory |
| Lighting | Modern 2D lighting/bloom over pixel art | The "neon over bone" glow; restrained |
| Parallax | Multi-layer backgrounds | The grandeur of FFVI's painterly depth |

> **Rule:** modern lighting/parallax *enhance* the pixel art; they never replace
> hand-authored pixels with filtered HD. The pixels are the craft.

## The color & lighting language

- **Two-state palettes.** Every region is authored with a **Reach** palette
  (Act I — vivid but rain-dimmed) and an **Ashfall** palette (Act II — drained,
  grey-gold, ash; see [open-world](open-world.md)). The same place, mourned.
- **Saturation as a meter.** Color saturation tracks the Weave: brightest in the
  surviving Deep places, near-grey in the strip-mined ashlands, and dropping
  globally across the game. Grist-light (refined essence) glows an unnatural,
  seductive gold against the grey.
- **Neon vs. rune.** Cyberpunk neon (cold cyans/magentas, corporate signage) plays
  against warm fantasy gold/amber (the Weave, old magic, lamplight). Their clash is
  the palette's core tension.
- **Elemental color coding** matches combat ([combat](combat.md)): *Flux* (cyan-
  white), *Ash* (grey-violet), *Iron* (steel-orange), *Bloom* (warm green-gold),
  *Gloom* (void-black). Players should read an element by its color.

## Environment design by tier & region

Visual identity for each space ([world](../narrative/world.md),
[open-world](open-world.md)):

- **The Crown** — clean glass spires, gold corporate light, impossible height; the
  pixel art at its most ordered and cold.
- **The Tiers** — dense working city; signage, market clutter, Craft-shop glow;
  the most "lived-in" art.
- **The Marrow** — neon, rain, and ancient *bone* (the god's hollow body as
  architecture); the signature cyberpunk-fantasy look and the vertical-slice
  setting ([vertical-slice](../production/vertical-slice.md)).
- **The Deep / old forests** — luminous, overgrown, the last bright Weave; the
  fantasy heart of the palette.
- **Ashlands** — strip-mined greys, dead machinery, haunted negative space.

## Character & creature visual design

- **Silhouette first.** Each party member ([characters](../narrative/characters.md))
  reads instantly in silhouette and carries the fusion in their design (Halcyon's
  frame-knight chrome over heraldry; Maren's fading-luminous Sidhe; Q expressed
  through screens/drones; Sable glowing faintly with grist-gold).
- **The Bound** — the caged old powers ([combat](combat.md)) are the art showcase:
  awe-and-pity creatures, beautiful and wronged, designed to make freeing them feel
  like mercy and wielding them feel like a crime.
- **Frames & augments** — chrome reads as corporate, mass-produced, and slightly
  obscene grafted onto living things; the cyberpunk body-horror note, kept tasteful.

## UI art

The interface art is specified with the interaction design in
[ui-ux-and-controls](ui-ux-and-controls.md); visually it follows the same "chrome
over rune" language — corporate-terminal frames etched with old sigils, grist-gold
as the highlight color.

## Production approach (per the roadmap)

- **Placeholder → pipeline.** Build on programmatic placeholders; swap in final
  art through the asset pipeline once systems are proven
  ([roadmap](../production/roadmap.md)). The art bar applies to *shipped* art, not
  prototype art.
- **Pipeline.** Atlas-packed sprites, tilesets, and BMFont text via the starter's
  asset pipeline, with typed asset keys
  ([conventions/coding-conventions](../conventions/coding-conventions.md)).
- **Consistency over volume.** A smaller set of cohesive, FFVI-grade assets beats a
  large rough set — same discipline as the [vertical-slice](../production/vertical-slice.md).

## Open questions

Tracked in [open-questions](../open-questions/): final native resolution, the exact
desaturation curve over the campaign, whether battle uses FFVI-style side-view
sprites or a 3/4 field view, and the pixel-vs-modern-lighting balance — all to be
confirmed against the Phase 1 prototype.
