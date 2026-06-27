---
type: production
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# GDD — master plan & documentation index

GRIST is being **fully documented before any game code is written** (a deliberate
choice; see
[decisions/0004-complete-pre-production-before-build](../decisions/0004-complete-pre-production-before-build.md)).
This page is the master index of the Game Design Document: what's written, what's
left, and the order we write it in. It is a living checklist — keep it current.

> The deepest content and systems docs (regions, bestiary, exact numbers) are
> **first-pass plans** that will be revised as the build teaches us. Documenting
> them up front is for a complete, coherent vision — not a frozen contract.

## Status at a glance

| Group | Docs | State |
|---|---|---|
| Vision | pitch, themes-and-tone | ✅ done |
| Narrative (core) | world, factions, characters, story | ✅ done |
| Design (systems) | overview, combat, progression-and-economy, open-world, side-content | ✅ done |
| Production | roadmap, vertical-slice, this GDD index | ✅ done |
| Technical (foundation) | architecture/overview, conventions | ✅ done |
| **A. Creative direction** | art-direction, audio-direction, ui-ux-and-controls | 🚧 in progress |
| **B. Narrative depth** | lore-and-history, main-quest, character-bios, quest-design | ⬜ to do |
| **C. World/level depth** | regions (Vanta tiers + the Reach, both states) | ⬜ to do |
| **D. Systems specs** | combat-spec, economy-spec, bestiary, catalog | ⬜ to do |
| **E. Tech/production final** | game-tech-design, final roadmap pass | ⬜ to do |

## The writing order (and why)

### ✅ Done — vision, story, systems, production plan
[pitch](../narrative/pitch.md) · [world](../narrative/world.md) ·
[factions](../narrative/factions.md) · [characters](../narrative/characters.md) ·
[story](../narrative/story.md) · [themes-and-tone](../narrative/themes-and-tone.md) ·
[design/overview](../design/overview.md) · [combat](../design/combat.md) ·
[progression-and-economy](../design/progression-and-economy.md) ·
[open-world](../design/open-world.md) · [side-content](../design/side-content.md) ·
[roadmap](roadmap.md) · [vertical-slice](vertical-slice.md)

### A. Creative-direction pillar (gates all content production)
The look, sound, and feel — locked before content so everything downstream has a
target.
- [art-direction](../design/art-direction.md) — ✅ the FFVI-grade pixel bible
- [audio-direction](../design/audio-direction.md) — ✅ score, the Choir leitmotif, SFX
- [ui-ux-and-controls](../design/ui-ux-and-controls.md) — ✅ menus, HUD, battle UI, input

### B. Narrative & world depth (the content backbone)
- `narrative/lore-and-history.md` — ⬜ the timeline, the Choir/pantheon, languages &
  naming conventions, culture & daily life
- `narrative/main-quest.md` — ⬜ the critical-path beat sheet (chapter outline, both
  acts, the Reckoning)
- `narrative/character-bios.md` — ⬜ full per-character bios, relationships, party
  banter, side-story beats
- `design/quest-design.md` — ⬜ quest structure & flow (main + side), the side-story
  framework

### C. World / level design depth
- `design/regions.md` — ⬜ Vanta's tiers and each region of the Reach, detailed in
  both world-states (Reach ↔ Ashfall), with key locations, encounters, and the
  Bound sites

### D. Systems specs (the numbers & tables layer)
- `design/combat-spec.md` — ⬜ damage/turn formulas, stat curves, element & status
  tables, the Bound kits
- `design/economy-spec.md` — ⬜ level curves, grist values, source/sink tuning
- `design/bestiary.md` — ⬜ enemy roster + the full Bound roster
- `design/catalog.md` — ⬜ items, equipment, augments, and the ability/spell list

### E. Technical & production finalization
- `architecture/game-tech-design.md` — ⬜ game data model, save schema, settings,
  localization/i18n plan, telemetry (extends [architecture/overview](../architecture/overview.md))
- Final [roadmap](roadmap.md) pass — ⬜ re-scope Phase 1+ with the full GDD in hand

## Definition of "documentation done"

Pre-production is complete — and coding (Phase 1 of the [roadmap](roadmap.md)) may
begin — when every row above is ✅, this index reflects it, and the wiki lints
clean. Then, and only then, we build.
