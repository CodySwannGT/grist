---
type: decision
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# 0007 — Local-only, offline; no remote connectivity

Locked 2026-06-27 (owner direction). Detailed in
[architecture/technical-requirements](../architecture/technical-requirements.md).

## Decision

GRIST is **offline-first with local-only saves and no required remote
connectivity.** No server, no accounts, no login, no cloud save, no online features.
The game is fully playable offline after install. Save data lives **on-device** behind
the `SaveService` abstraction — recommended **IndexedDB** (or SQLite-in-browser via
OPFS), upgrading the starter's `localStorage` default; with **export/import** of save
files as the user's own backup mechanism.

## Why

- **Owner requirement:** GRIST is a single-player JRPG with no need for connectivity;
  building servers/accounts/sync would be cost and risk for zero player value.
- **Simplicity, privacy, resilience:** no backend to run or secure, no PII, plays on a
  plane. Fits the web+mobile PWA target ([decisions/0005](0005-platform-target.md)).

## Consequences

- **No cloud save** — supersedes the earlier "optional cloud-save later" note in
  [platform-and-target](../production/platform-and-target.md); replaced by local
  export/import.
- **Telemetry/error-reporting is off by default and optional** — supersedes the
  always-on framing in [game-tech-design](../architecture/game-tech-design.md).
- **Storage upgrade:** from `localStorage` to IndexedDB (or SQLite-in-browser) for save
  size/shape; final mechanism is a tracked decision
  ([open-questions/register](../open-questions/register.md)).
- **PWA offline:** service worker caches the app shell + assets for offline play.

## Out of scope (consequences of "no remote")

Multiplayer, leaderboards, cloud save/sync, accounts, server-driven content/live-ops —
none are in scope. Any future online feature would be a deliberate reversal of this
decision.
