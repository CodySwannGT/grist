---
type: decision
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# 0003 — Build order & scope strategy

How GRIST is built, locked 2026-06-27. Detailed in
[production/roadmap](../production/roadmap.md) and
[production/vertical-slice](../production/vertical-slice.md).

## Decisions

1. **Build in playable, verified slices — not a long march.** Development proceeds
   through increments that are each provably done (Phase 1 combat prototype →
   Phase 2 vertical slice → Phase 3 playable demo → Phase 4+ production). Each phase
   ends with the verification-is-UAT gate; the next does not start until the current
   is done.
2. **The first build target is the vertical slice "The Bound in the Marrow"** — the
   smallest build that captures the whole thesis (explore → ATB fight → face a Bound
   → grow with grist). The full open world is **not** the first thing built.
3. **Detailed content docs are living docs.** The bestiary, the Bound roster,
   per-region docs, ability/item catalogs, and the script are written *per region as
   it is built*, not up front.
4. **Mechanics lead, art follows.** Build on deterministic `src/logic` rules with
   programmatic placeholder art; swap in FFVI-grade assets through the pipeline once
   systems are proven. No mechanic waits on art.

## Why

- **Scope honesty.** A 40+ hour open-world JRPG with FFVI-grade art is among the
  largest projects in games ([roadmap](../production/roadmap.md)). Slicing is the
  only way a small/first-time effort reaches a vision that big without stalling.
- **Avoid the two classic failure modes** — the *documentation trap* (planning
  everything before building) and the *boil-the-ocean trap* (building the world
  before the core loop is fun).
- **Fits the project's spine.** Lisa's verification-is-UAT gate and the pure-logic
  architecture are designed for exactly this: small, deterministic, provably-done
  increments ([architecture/overview](../architecture/overview.md)).

## Alternatives considered

- **Document everything first, then build** — rejected (the documentation trap;
  detailed plans rot before they're used).
- **Build the open world / "the game" directly** — rejected (no proven core loop;
  highest-risk path to a stalled project).
- **Prototype with no governance/tests, "just make it fun" first** — rejected; the
  verification gate and pure-logic discipline are cheap now and save the project
  later.

## Re-scoping

This decision and the roadmap are deliberately **living**: after each phase gate,
the plan for the next phase is rewritten with what the build just taught us.
