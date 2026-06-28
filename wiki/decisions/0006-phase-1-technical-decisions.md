---
type: decision
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# 0006 — Phase-1 technical decisions

Locked 2026-06-27. Resolves the open questions that blocked starting the build
([open-questions/register](../open-questions/register.md)), informed by the
web+mobile platform target ([decisions/0005](0005-platform-target.md)). These feed
the [engineering-spec](../architecture/engineering-spec.md) and the
[vertical-slice-build](../production/vertical-slice-build.md).

## Decisions

| # | Question | Decision |
|---|---|---|
| **V1** | Battle camera/view | **Side-view sprite battles (FFVI-style).** Faithful to the FFVI bar, simplest to author/animate, and the most readable on touch/mobile. |
| **V2** | Native resolution | **384×216 base**, integer-scaled, landscape-first; responsive letterbox for other ratios ([platform-and-target](../production/platform-and-target.md)). |
| **V4** | Lighting balance | **Pixels are authoritative; lighting is restrained.** Lightweight additive glow/bloom over hand-authored pixels — no heavy dynamic lighting (mobile-GPU budget). |
| **T1** | Content-data format | **TypeScript modules with typed schemas.** Compile-time safety, typed content keys, tree-shakeable, no runtime parse — fits strict TS and the web bundle budget. |
| **T3** | Sim vs. scene | **Sim-authoritative.** Battle/economy/progression are pure deterministic logic in `src/logic`; scenes are pure renderer/input adapters. |
| **(touch)** | Touch support | **In scope, first-class** (per [0005](0005-platform-target.md)). |

## Why

- **V1 side-view** keeps art and animation tractable for a small team and reads
  cleanly on small touch screens ([combat](../design/combat.md),
  [ui-ux-and-controls](../design/ui-ux-and-controls.md)).
- **V2/V4** are driven by the mobile/web performance and load budgets
  ([platform-and-target](../production/platform-and-target.md),
  [art-direction](../design/art-direction.md)).
- **T1 TS modules** match the project's strict-TS, typed-key conventions
  ([conventions/coding-conventions](../conventions/coding-conventions.md)) and avoid
  runtime parsing/validation cost.
- **T3 sim-authoritative** is the project's core architecture
  ([architecture/overview](../architecture/overview.md)) — it's what makes the game
  deterministic and verifiable ([decisions/0001](0001-locked-architecture-decisions.md)).

## Still deferred (not Phase-1 blocking)

V3 (desaturation curve), A1–A4 (audio), S1–S6 (content counts/numbers), T2
(region-streaming) remain open ([open-questions/register](../open-questions/register.md));
they don't block the combat prototype or the slice.
