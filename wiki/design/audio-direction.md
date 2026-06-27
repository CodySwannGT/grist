---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Audio direction

The sound bible for GRIST. Audio carries the elegy as much as the art does — this
is a game about a world quietly running down, and the score should make you *feel*
the silence creeping in. It realizes the leitmotif idea seeded in
[themes-and-tone](../narrative/themes-and-tone.md) and the cosmology of
[world](../narrative/world.md).

## The one-line sound

**A fading hymn under a rain of machines.** Ancient, sacred melody — the memory of
the Choir's song — eroding into industrial hum and static as the Weave dies. Gold
under grey, in sound.

## Pillars

1. **Melody-forward, JRPG-grade.** In the FFVI tradition: strong, memorable themes
   and character/place leitmotifs you hum after playing. The emotional weight rides
   on melody, not just texture.
2. **The Choir leitmotif is the spine.** One core melodic idea — *the Song* — the
   fragment of the murdered gods' music ([story](../narrative/story.md)). It is
   half-remembered, broken into pieces across the score, and only ever heard *whole*
   at the very end. Every other theme is, secretly, a variation or corruption of it.
3. **Fantasy timbre × industrial timbre.** Choirs, strings, harp, and bells (the
   Weave, the old age) bleed into synths, drones, distortion, and machine noise (the
   Craft, the corps). Their blend, and which dominates, tells you where — and
   *when* — you are.
4. **Sound as the desaturation motif.** The audio equivalent of the art's draining
   color ([art-direction](art-direction.md)): as the Weave fades and across the two
   world-states, the orchestral warmth thins, instruments drop out, and static and
   silence grow. **Ashfall sounds emptier than the Reach.**

## The leitmotif system

- **The Song (the Choir's theme)** — the master melody. Stated only in fragments;
  surfaces at set-pieces (the **Sidhe requiem-rite**, [story](../narrative/story.md));
  resolves fully at the ending.
- **Character themes** — each party member ([characters](../narrative/characters.md))
  gets a motif that quotes the Song differently (Sable's is the purest fragment;
  Sallow's is the Song played cold, hollow, and "balanced" to nothing).
- **Faction/place themes** — the Houses, Vanta's tiers, the regions; corporate
  themes are the Song *industrialized* — its melody turned into a jingle, a brand,
  an elevator hum. The horror of that is the point.

## Adaptive / interactive music

- **Layered, state-aware score.** Tracks are built in stems so the mix can thin or
  swell with the dying Weave, the world-state (Reach ↔ Ashfall), and combat
  intensity ([open-world](open-world.md), [combat](combat.md)).
- **Two-state arrangements.** Like the palettes, key themes have a **Reach** arrangement
  (fuller) and an **Ashfall** arrangement (drained) — the same melody, mourned.
- **Combat audio reads the system.** Stingers for **Break**, for spending **grist**
  (a costly, resonant "spend" sound), and for the **Bound** (a vast, sorrowful
  sound on summon — power that hurts to hear) reinforce the readable ATB
  ([combat](combat.md)).

## Sound design (SFX)

- **The fusion in every sound.** Grist-tech should sound like *magic with a power
  supply* — a spell with a transformer's hum, a frame's servos with a chime of old
  enchantment underneath.
- **Signature sounds.** Grist itself (a warm, seductive resonant tone — the sound of
  spending the world); rendering (a sound the game wants you to flinch at); the
  Bound's voices; the rain and machine-hum bed of the Marrow.
- **UI sound** follows the "chrome over rune" language
  ([ui-ux-and-controls](ui-ux-and-controls.md)): corporate-terminal clicks with a
  faint sacred undertone.

## Voice

- **First-pass plan: minimal/stylized VO.** Lean text-forward (JRPG tradition,
  budget-friendly, localization-friendly), with optional stylized vocalizations for
  key moments and the requiem-rite's actual singing. Full VO is a later, scope-
  dependent decision — tracked in [open-questions](../open-questions/).
- **The sung Song.** The one place real vocals are non-negotiable is the Choir's
  melody at the climactic set-pieces — that is the emotional payload of the whole
  score.

## Accessibility

Full, independent volume mixing (music / SFX / voice / ambience); subtitles and
captions for all dialogue and significant SFX; no audio-only critical information
(pair every important cue with a visual, per
[ui-ux-and-controls](ui-ux-and-controls.md)).

## Production approach

Per the [roadmap](../production/roadmap.md): prototype with placeholder/temp audio;
commission final music and SFX once systems and scenes are proven. Establish the
Song and one or two core themes early (even as mockups) so the leitmotif system can
be designed against from the start.

## Open questions

Tracked in [open-questions](../open-questions/): scope of voice acting, live vs.
sampled orchestration for the final score, exact adaptive-music middleware/approach within
the Phaser/Web Audio stack, and how aggressive the audio-desaturation should be so
Ashfall feels empty without feeling broken.
