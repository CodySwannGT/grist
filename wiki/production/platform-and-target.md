---
type: production
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Platform & target

What we are building GRIST *for*. This drives real engineering decisions across the
[engineering-spec](../architecture/game-tech-design.md), UI
([ui-ux-and-controls](../design/ui-ux-and-controls.md)), art
([art-direction](../design/art-direction.md)), and performance budgets. Locked in
[decisions/0005-platform-target](../decisions/0005-platform-target.md).

## Target platforms

**Primary: web browser and mobile/tablet.** GRIST ships as a Phaser 4 web game that
runs in-browser on desktop and mobile, and as installable mobile/tablet builds
(PWA-first; native wrappers, e.g. Capacitor, if a store presence is wanted). Desktop
Steam/console are **not** v1 targets (possible later ports;
[open-questions/register](../open-questions/register.md)).

## What that implies (the constraints we design to)

- **Touch is a first-class input, not an afterthought.** The UI and controls are
  **touch-first with full keyboard/gamepad parity** (an update to
  [ui-ux-and-controls](../design/ui-ux-and-controls.md)). The methodical ATB
  ([combat](../design/combat.md)) is a good fit for touch — no twitch.
- **Performance and load size are hard constraints.** Mobile GPUs and mobile/web
  networks set tight budgets: small initial download, streamed regions, restrained
  lighting ([art-direction](../design/art-direction.md)), and the starter's bundle/perf
  gates enforced ([conventions/coding-conventions](../conventions/coding-conventions.md)).
- **Orientation: landscape-first.** The battle HUD and field assume landscape;
  portrait gets a graceful prompt/letterbox. (Portrait-playable is a stretch goal, not
  a v1 promise.)
- **Session design must suit mobile.** Save-anywhere, fast resume, and chapter/beat
  pacing that tolerates short sessions ([overview](../design/overview.md)) — important
  for a 40+hr game played in mobile bursts.
- **Saves: local-only, offline.** No cloud save, no accounts, no required network —
  GRIST is offline-first ([decisions/0007](../decisions/0007-local-only-offline.md),
  [technical-requirements](../architecture/technical-requirements.md)). On-device
  persistence via the `SaveService` (**IndexedDB**;
  [decisions/0008](../decisions/0008-local-persistence-indexeddb.md)), with save
  **export/import** as the user's own backup.

## Minimum spec (first-pass)

| Axis | Target |
|---|---|
| Browsers | Evergreen Chromium/Safari/Firefox; WebGL2 (Beam renderer) |
| Mobile OS | Recent iOS Safari & Android Chrome (last ~3 years of devices) |
| Resolution | 16-bit base **384×216**, integer-scaled; responsive to common 16:9/19.5:9 |
| Frame-rate | 60 fps target on mid-range mobile; 30 fps floor |
| Input | Touch (primary), keyboard, gamepad |
| Initial download | Keep small (lazy-load regions/assets); enforce the bundle budget |

## Distribution

- **Web:** hosted PWA (installable), the primary channel and the demo channel.
- **Mobile stores:** optional native wrappers for App Store / Play if/when a store
  presence is desired (a later decision; cert/store work is out of v1 scope).

## Out of scope for v1

Desktop Steam release, console ports, and full offline native apps — all possible
*later* ports, none a v1 commitment ([roadmap](roadmap.md)).
