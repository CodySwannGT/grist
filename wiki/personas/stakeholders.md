---
title: Stakeholders — publisher, market, and production constraints
category: personas
updated: 2026-07-01
status: scaffold
---

# Stakeholders

The business and production reality the `publisher`, `marketing-strategist`,
`producer`, and `monetization-designer` subagents critique against. Without
this, those subagents reason from the vision alone and flag the gap.

> **Scaffold:** placeholder constraints for GRIST. Replace with your real model,
> budget, and market.

## Business model

- **Model:** Premium, one-time purchase. Offline / local-first, no IAP, no
  telemetry by default.
- **Implication:** The `monetization-designer` subagent **does not apply** — leave
  it off. The `product-analyst` subagent is off unless you add opt-in telemetry.

## Scope, budget, timeline

- **Team:** Small (1–3). Treat every feature as an opportunity cost against the
  vertical slice.
- **Target:** Ship a vertical slice that proves the core collection loop is fun
  before expanding content.
- **Hard constraints:** Local-first (no backend); must run in a browser and as a
  PWA; deterministic so runs are reproducible.
- **Producer's bar:** Every work item names its smallest shippable slice and a
  verifiable definition of done.

## Market & positioning

- **The hook (one line):** *"A cozy, deterministic collect-a-thon you can finish a
  run of on your commute."*  ← rewrite this for your game; if you can't, that's
  the `publisher`/`marketing` headline finding.
- **Primary audience:** "Mara, the deck commuter" (see
  [target-players](target-players.md)); secondary: "Dev, the completionist."
- **Storefront(s):** TBD — define before the `marketing-strategist` can judge
  discoverability and capsule appeal.
- **Comparables:** _list 2–3 games players will compare this to, and how you
  differ._

## Ethical lines

- No dark patterns, no FOMO pressure, no pay-to-win (n/a under premium). The
  non-player-hostile bar is a hard constraint, not a preference.
