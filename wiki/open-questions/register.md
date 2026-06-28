---
type: open-question
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Open questions register

The deferred decisions surfaced across the GDD — questions we intentionally did
**not** answer in pre-production because they're best resolved against a real build
([decisions/0004](../decisions/0004-complete-pre-production-before-build.md)). This is
the single tracker for them; the docs that raise them link here. Resolve, then record
the answer in the relevant doc (and a [decision](../decisions/0001-locked-architecture-decisions.md)
if it's load-bearing).

> Status legend: **open** · **leaning** (a tentative answer) · **resolved** (move the
> answer into the owning doc and mark here).

## Visual & presentation

| # | Question | Owner doc | Decide by | Status |
|---|---|---|---|---|
| V1 | **Battle camera/view** — FFVI-style side-view sprites vs. a 3/4 field view | [combat](../design/combat.md) · [ui-ux-and-controls](../design/ui-ux-and-controls.md) | Phase 1 | open |
| V2 | Final **native resolution** & integer-scale target | [art-direction](../design/art-direction.md) | Phase 1 | open |
| V3 | The exact **desaturation curve** over the campaign (how fast color drains) | [art-direction](../design/art-direction.md) | Phase 3 | open |
| V4 | **Pixel-vs-modern-lighting** balance (how much bloom/lighting over pixels) | [art-direction](../design/art-direction.md) | Phase 1 | open |
| V5 | How **diegetic** to push the menus without hurting readability | [ui-ux-and-controls](../design/ui-ux-and-controls.md) | Phase 2 | open |

## Audio

| # | Question | Owner doc | Decide by | Status |
|---|---|---|---|---|
| A1 | **Voice-acting scope** — minimal/stylized vs. fuller VO | [audio-direction](../design/audio-direction.md) | Phase 3 | leaning: minimal/stylized + sung Song |
| A2 | **Live vs. sampled** orchestration for the final score | [audio-direction](../design/audio-direction.md) | post-prototype | open |
| A3 | **Adaptive-music** approach/middleware within the Phaser/Web Audio stack | [audio-direction](../design/audio-direction.md) | Phase 1–2 | open |
| A4 | How aggressive **audio-desaturation** is (Ashfall empty, not broken) | [audio-direction](../design/audio-direction.md) | Phase 3 | open |

## Systems & content

| # | Question | Owner doc | Decide by | Status |
|---|---|---|---|---|
| S1 | **v1 Bound count** — the rostered six is the planned spine; may merge | [bestiary](../design/bestiary.md) · [regions](../design/regions.md) | Phase 4 scoping | open |
| S2 | How **Sable's unique Bound-bond** expresses mechanically | [bestiary](../design/bestiary.md) · [character-bios](../narrative/character-bios.md) | Phase 2–3 | open |
| S3 | Final **slot counts** (relics, augments) | [catalog](../design/catalog.md) | Phase 1–2 | open |
| S4 | Do **weapons** also teach abilities (FFIX-style) on top of shards? | [catalog](../design/catalog.md) | Phase 2 | open |
| S5 | **Consumable economy** balance vs. the grist sinks | [catalog](../design/catalog.md) · [economy-spec](../design/economy-spec.md) | Phase 2 | open |
| S6 | All combat/economy **constants** (first-pass numbers → tuned values) | [combat-spec](../design/combat-spec.md) · [economy-spec](../design/economy-spec.md) | Phase 1+ | open |

## Technical

| # | Question | Owner doc | Decide by | Status |
|---|---|---|---|---|
| T1 | **Content-data format** — TS modules vs. JSON + schema | [game-tech-design](../architecture/game-tech-design.md) | Phase 1 | open |
| T2 | **Region-streaming** strategy within the Phaser/Beam pipeline | [game-tech-design](../architecture/game-tech-design.md) | Phase 4 | open |
| T3 | How much of the battle is **sim-driven vs. scene-driven** | [game-tech-design](../architecture/game-tech-design.md) · [combat-spec](../design/combat-spec.md) | Phase 1 | open |

## How to use this register

- **When a doc says "tracked in open-questions,"** it points here.
- **When you resolve one:** write the answer into the owner doc, set Status to
  *resolved* here (keep the row for history), and add a
  [decision](../decisions/0001-locked-architecture-decisions.md) if it changes a
  locked pillar.
- **Phase 1** ([roadmap](../production/roadmap.md)) should close V1, V2, V4, T1, T3,
  and start S6 — they block the combat prototype's foundations.
