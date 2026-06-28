---
type: architecture
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Technical requirements (NFRs)

The non-functional / technical constraints GRIST must satisfy — the rules the
engineering works within, distinct from *how* systems are built
([engineering-spec](engineering-spec.md)) and *what* the game is
([design](../design/overview.md)). Driven by the web+mobile target
([platform-and-target](../production/platform-and-target.md)).

## Connectivity — offline-first, no remote dependency

**GRIST requires no network connectivity to play.** This is a hard constraint
([decisions/0007](../decisions/0007-local-only-offline.md)):

- **No server, no accounts, no login, no online features.** The game is fully
  playable offline, first launch onward (after the initial download/install).
- **No required remote calls** in the core loop. Any network use (e.g. an optional
  update check) must be non-essential and degrade silently when offline.
- As a **PWA**, it installs and runs offline (service worker caches the app shell and
  assets).

## Persistence — local saves only

- **All save data lives on-device.** No cloud save, no remote sync
  ([decisions/0007](../decisions/0007-local-only-offline.md)).
- **Storage mechanism: IndexedDB** (via the tiny `idb` wrapper) behind the
  `SaveService` abstraction — decided in
  [decisions/0008](../decisions/0008-local-persistence-indexeddb.md) (SQLite-in-browser
  rejected: bundle weight + OPFS/iOS risk + no need for runtime SQL). This upgrades the
  starter's `localStorage` default. Settings may stay in `localStorage` for fast
  synchronous boot reads; saves use IndexedDB.
- **Don't get evicted.** Request `navigator.storage.persist()` at boot so saves survive
  storage pressure (eviction = a lost playthrough with no cloud backup); handle a denied
  request gracefully.
- **Requirements regardless of mechanism:** multiple save slots + autosave; **versioned
  schema with migrations** ([engineering-spec](engineering-spec.md)); graceful handling
  of missing/corrupt saves; and — since there's no cloud backup — **manual
  export/import of a save file** so players can back up and move saves themselves.

## Performance (web + mobile budgets)

- **60 fps target, 30 fps floor** on a mid-range mobile device.
- Per-frame **no allocation/creation in `update()`**, pooled objects (sprites, damage
  numbers, projectiles), atlased art
  ([conventions/coding-conventions](../conventions/coding-conventions.md)).
- **Memory ceiling** suited to mobile; **streamed region loads** (no whole-world in
  memory; [open-world](../design/open-world.md)).
- **Restrained lighting** ([decisions/0006](../decisions/0006-phase-1-technical-decisions.md)).
- Gates enforced in CI ([test-plan](../playbooks/test-plan.md)).

## Footprint / load

- **Small initial download**, lazy-loaded regions/assets; enforced **bundle-size
  budget** — critical on web/mobile networks
  ([platform-and-target](../production/platform-and-target.md)).

## Runtime & compatibility

- **WebGL2** (Phaser 4 Beam renderer); evergreen Chromium/Safari/Firefox; recent iOS
  Safari & Android Chrome; **landscape-first**; touch + keyboard + gamepad
  ([ui-ux-and-controls](../design/ui-ux-and-controls.md)).

## Privacy & telemetry

- **Offline-first means privacy by default.** No accounts, no PII, no tracking.
- **Telemetry/error-reporting is OFF by default and optional** (opt-in only), and must
  never be required for play — superseding the earlier always-on framing in
  [game-tech-design](game-tech-design.md). Prefer local logs; any opt-in upload is
  non-essential and offline-tolerant.

## Security

- **Minimal attack surface** — no server, no client secrets, no remote auth.
- **Save integrity:** validate on load; never crash on a bad/old save (migrate or fail
  safe).

## Determinism, i18n, accessibility (cross-refs)

- **Deterministic sim** (seeded RNG, pure logic) — required for verification
  ([engineering-spec](engineering-spec.md), [decisions/0001](../decisions/0001-locked-architecture-decisions.md)).
- **Localization-ready** (keyed text catalog) and **accessibility-first**
  ([ui-ux-and-controls](../design/ui-ux-and-controls.md)) — already specified; reaffirmed
  as requirements here.

## Dependencies

Keep third-party dependencies minimal (bundle budget + offline + security). Anything
added must justify its size and must not introduce a runtime network dependency.
