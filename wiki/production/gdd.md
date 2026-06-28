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
| **A. Creative direction** | art-direction, audio-direction, ui-ux-and-controls | ✅ done |
| **B. Narrative depth** | lore-and-history, main-quest, character-bios, quest-design | ✅ done |
| **C. World/level depth** | regions (Vanta tiers + the Reach, both states) | ✅ done |
| **D. Systems specs** | combat-spec, economy-spec, bestiary, catalog | ✅ done |
| **E. Tech/production final** | game-tech-design, final roadmap pass | ✅ done |
| **F. Build-readiness** | platform-and-target, technical-requirements, engineering-spec, vertical-slice-build, test-plan; decisions 0005–0007 | ✅ done |

**Pre-production is complete — every group is ✅. Coding (Phase 1 of the
[roadmap](roadmap.md)) may begin.**

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
- [lore-and-history](../narrative/lore-and-history.md) — ✅ the timeline, the
  Choir/pantheon, languages & naming conventions, culture & daily life
- [main-quest](../narrative/main-quest.md) — ✅ the critical-path beat sheet (chapter
  outline, both acts, the Reckoning)
- [character-bios](../narrative/character-bios.md) — ✅ full per-character bios,
  relationships, party banter, side-story beats
- [quest-design](../design/quest-design.md) — ✅ quest structure & flow (main + side),
  the side-story framework

### C. World / level design depth
- [regions](../design/regions.md) — ✅ Vanta's tiers and each region of the Reach,
  detailed in both world-states (Reach ↔ Ashfall), with key locations, encounters,
  and the Bound sites

### D. Systems specs (the numbers & tables layer)
- [combat-spec](../design/combat-spec.md) — ✅ damage/turn formulas, stats, ATB timing,
  element & status tables, the Bound-kit template
- [economy-spec](../design/economy-spec.md) — ✅ level curve, grist values, source/sink
  tuning, the learning loop
- [bestiary](../design/bestiary.md) — ✅ enemy families + the named Bound roster
- [catalog](../design/catalog.md) — ✅ items, equipment, augments, and the ability/spell
  list

### E. Technical & production finalization
- [architecture/game-tech-design](../architecture/game-tech-design.md) — ✅ design→logic
  mapping, data model, save schema, settings, i18n, telemetry, determinism
- Final [roadmap](roadmap.md) pass — ✅ pre-production marked complete; Phase 1
  re-scoped against the full GDD

### F. Build-readiness (make the first slice buildable; foundational specs)
- [platform-and-target](platform-and-target.md) — ✅ web + mobile/tablet, touch-first
- [technical-requirements](../architecture/technical-requirements.md) — ✅ NFRs:
  offline-first, local-only saves, performance, privacy, security
- [engineering-spec](../architecture/engineering-spec.md) — ✅ type definitions, the
  combat-sim contract, the scene/state machine, the save schema
- [vertical-slice-build](vertical-slice-build.md) — ✅ concrete slice content, asset
  manifest, the UAT script
- [test-plan](../playbooks/test-plan.md) — ✅ the testing strategy & gates
- Decisions [0005](../decisions/0005-platform-target.md) /
  [0006](../decisions/0006-phase-1-technical-decisions.md) /
  [0007](../decisions/0007-local-only-offline.md) — ✅ platform, Phase-1 tech,
  local-only/offline

## Definition of "documentation done"

Pre-production is complete — and coding (Phase 1 of the [roadmap](roadmap.md)) may
begin — when every row above is ✅, this index reflects it, and the wiki lints
clean. **As of 2026-06-27, that bar is met: every group is ✅ and the wiki lints
clean. We are clear to build.**
