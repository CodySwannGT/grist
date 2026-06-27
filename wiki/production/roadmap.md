---
type: production
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Production roadmap

How GRIST actually gets built — the scope philosophy, the phased plan, and how we
work. This is the plan that keeps a hugely ambitious vision from becoming a game
that never ships. The first build target is detailed in
[vertical-slice](vertical-slice.md); the build-order rationale is locked in
[decisions/0003-build-order-and-scope](../decisions/0003-build-order-and-scope.md).

## Scope reality (read this first)

The full vision — a 40+ hour open-world JRPG with FFVI-grade art
([pitch](../narrative/pitch.md)) — is one of the **largest** things to make in
games. The original *Final Fantasy VI* was built by a large, experienced Square
team. That is not a reason to shrink the vision; it is the reason to **build it in
slices**. The vision is the north star. The plan is to reach it one provably-done,
playable increment at a time — never a two-year march in the dark.

Two failure modes we are explicitly avoiding:

- **The documentation trap** — planning every enemy, region, and line of dialogue
  up front. Detailed content docs are *living docs*; they grow alongside the build,
  not before it.
- **The boil-the-ocean trap** — trying to build the open world before the core
  loop is fun. We prove the loop small, then scale it.

## How we work

- **Agent-built, governed by Lisa.** Every Phaser 4 best practice is enforced by
  lint, types, git hooks, and CI ([architecture/overview](../architecture/overview.md)).
- **Verification IS the definition of done.** Nothing is "done" until an agent has
  *played the build* and confirmed it against acceptance criteria, with committed
  evidence and an automated `tests/e2e` spec ([playbooks/run-and-verify](../playbooks/run-and-verify.md)).
  Every phase below ends with a verification gate.
- **Pure-logic first.** Game rules (combat math, the economy, progression) live in
  `src/logic` with zero engine imports, so they are deterministic and unit-tested
  before any art exists ([conventions/coding-conventions](../conventions/coding-conventions.md)).
- **Placeholder art → pipeline art.** Build with programmatic placeholders; swap in
  real FFVI-grade assets through the asset pipeline once the systems are proven.
  Mechanics never wait on art.

## The phased plan

Each phase is a **playable, verified increment**. Do not start the next until the
current one is provably done.

### Phase 0 — Foundations ✅ (done)

The engine + governance (the Phaser 4 starter), and the full design bible
([narrative](../narrative/pitch.md), [design](../design/overview.md)). The game
currently runs the starter's placeholder slice.

### Phase 1 — Combat prototype

One hard-coded ATB battle, no exploration, no real art. Party vs enemies; turn
gauges; the action menu (Strike / Craft / Bind / Item / Defend); the **two-resource
model** (Anima + spending real grist); damage, status, win/lose
([combat](../design/combat.md)). **Goal: prove the combat *feels* good.** All combat
rules in `src/logic`, unit-tested and deterministic; thin Phaser battle scene; one
e2e spec that plays a battle to victory.

### Phase 2 — The vertical slice 🎯 (the first "this is GRIST" build)

Wrap the proven combat in a tiny playable area with the core loop end-to-end: a
small slice of the Marrow, a few encounters, **one caged Bound** (summon + learn +
the free-vs-wield choice), and a minimal grist economy + growth screen. Detailed in
[vertical-slice](vertical-slice.md). **Goal: 10–15 minutes that capture the whole
thesis.** This is the milestone everything else is measured against.

### Phase 3 — Playable demo ("the first hour")

Expand the slice into a real opening: Wren's intro and the Sable hook
([story](../narrative/story.md)), a proper piece of the Marrow, several encounters,
a second party member, the first character side-story, real UI. **Goal: a
shippable demo** that proves the experience, not just the loop.

### Phase 4+ — Production

With pipelines proven, build out **Act I region by region**, then the **Reckoning**
world-turn, then **Act II — Ashfall** ([open-world](../design/open-world.md)).
Content scales because the systems and the asset pipeline are already real. The
living content docs (bestiary, the Bound roster, per-region docs, the script) are
filled in here, per region, as each is built.

## Milestone gates

| Phase | "Done" means |
|---|---|
| 1 — Combat prototype | An agent plays a full ATB battle to victory; combat logic unit-tested + an e2e spec; the two-resource tension is real |
| 2 — Vertical slice | An agent plays the slice end-to-end: explore → fight → face the Bound → grow with grist; e2e covers the core loop |
| 3 — Playable demo | An agent plays "the first hour" start to finish; the opening lands emotionally; demo-quality polish |
| 4+ — Production | Each region ships verified; the world-turn works; Act II reads as the elegy it's meant to be |

## Risk & scope management

- **When in doubt, cut scope, not quality.** A smaller slice that's polished beats
  a bigger one that's rough.
- **Protect the core loop.** If something doesn't serve explore → fight → grow →
  advance, it waits.
- **Track unknowns** in [open-questions](../open-questions/) — combat tuning, the
  art pipeline for FFVI-grade assets, the real size of the grind loops.
- **Re-scope at every gate.** After each phase, the plan for the next is rewritten
  with what the build just taught us. This doc is meant to change.
