---
type: decision
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# 0005 — Platform target: web + mobile/tablet

Locked 2026-06-27. Detailed in
[production/platform-and-target](../production/platform-and-target.md).

## Decision

GRIST targets **web browsers and mobile/tablet** as primary platforms (PWA-first;
optional native wrappers for stores). **Touch is a first-class input** alongside
keyboard and gamepad. Desktop Steam and console are **not** v1 targets — possible
later ports only.

## Why

- **Reach and frictionless distribution** — web/PWA needs no install or store
  approval and doubles as the demo channel; mobile broadens the audience.
- **Fits the stack** — the project is already a Phaser 4 web game
  ([architecture/overview](../architecture/overview.md)); web/mobile is its native
  home.
- **Fits the design** — the methodical, no-twitch ATB ([combat](../design/combat.md))
  and slow-burn pacing ([overview](../design/overview.md)) suit touch and bursty mobile
  sessions.

## Consequences

- **Touch-first UI** with keyboard/gamepad parity — updates
  [ui-ux-and-controls](../design/ui-ux-and-controls.md); resolves the touch-support open
  question.
- **Hard performance & load budgets** (mobile GPU, mobile/web networks): streamed
  regions, restrained lighting ([art-direction](../design/art-direction.md)), enforced
  bundle/perf gates.
- **Landscape-first**, save-anywhere, fast-resume session design.
- Steam/console deferred; cloud-save and store wrappers are later decisions
  ([open-questions/register](../open-questions/register.md)).
