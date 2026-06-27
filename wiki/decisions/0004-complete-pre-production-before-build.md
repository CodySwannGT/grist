---
type: decision
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# 0004 — Complete pre-production before build

Locked 2026-06-27. The team will **write the full Game Design Document before any
game code is written**, tracked in [production/gdd](../production/gdd.md).

## Decision

Complete the entire pre-production documentation set — creative direction (art,
audio, UI/UX), narrative & world depth, region/level design, systems specs, and
the technical/production finalization — *before* starting Phase 1 of the
[roadmap](../production/roadmap.md). Coding begins only when the
[GDD index](../production/gdd.md) is fully ✅.

## Why

- **A deliberate, owner-chosen way to work.** With an agent doing the writing, the
  cost of thorough, coherent documentation is low and the payoff — a single,
  consistent source of truth before a line of code commits the team to anything —
  is high.
- **Coherence across an ambitious vision.** A 40+ hour open-world JRPG has enormous
  internal dependencies (systems ↔ economy ↔ regions ↔ story). Designing them
  together on paper surfaces contradictions cheaply, before they're expensive code.

## Relationship to decision 0003

This **refines** [0003 — build order & scope](0003-build-order-and-scope.md), it
does not overturn it. We still build in verified, playable slices starting with the
vertical slice. 0003 said detailed content docs could be written per-region during
the build; 0004 chooses instead to author them up front.

The reconciliation — and the guard against the "documentation trap" 0003 warned of:
**the deep content and systems docs are explicitly first-pass plans, not frozen
contracts.** They will be revised as the build teaches us, and the
[GDD index](../production/gdd.md) is a living document. We accept first-pass
imperfection in exchange for an up-front coherent whole.

## Consequences

- Phase 1 (combat prototype) does not start until the GDD index is fully ✅.
- Each doc still cross-links into the existing bible so the whole stays consistent.
- We re-scope the [roadmap](../production/roadmap.md) once, with the full GDD in
  hand, before building.
