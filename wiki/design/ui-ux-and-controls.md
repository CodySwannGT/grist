---
type: design
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# UI/UX & controls

How the player reads and drives GRIST: the interface, the menus, the battle HUD,
and the input scheme. The interface is where a slow, systemic JRPG lives or dies —
it must make deep systems **readable and calm**, never busy. Visual language is
shared with [art-direction](art-direction.md); audio cues with
[audio-direction](audio-direction.md).

## Principles

1. **Readable over flashy.** GRIST is methodical ([overview](overview.md)); the UI
   should make state obvious at a glance and reward planning. Clarity is the feature.
2. **Diegetic where it helps, clean where it counts.** Lean into the "chrome over
   rune" look — a corporate-terminal frame etched with old sigils — but never let
   theme cost legibility. Grist-gold is the highlight color throughout.
3. **One resource, always visible.** Because grist is currency *and* fuel *and*
   growth ([progression-and-economy](progression-and-economy.md)), the grist count
   is persistent and emphasized — the player should always feel the wallet.
4. **Accessible by default.** The slow tempo makes GRIST naturally accessible; lean
   in (see Accessibility below).

## Screen map

```
Field/Explore ──▶ Pause/Main Menu ──▶ Party · Builds · Items · Ledger(codex)
     │                                  · Map · Factions · System/Settings
     ▼
  Battle (ATB) ──▶ command menu · target select · battle log
     │
     ▼
  Growth screen (ripperdoc/workshop): shards · augments · refine · craft
```

## Field / exploration HUD

Minimal and quiet: a context prompt for interactables, a persistent **grist**
readout, and an optional compass/objective marker that can be turned off (the world
rewards looking, not following arrows — [open-world](open-world.md)). The mini-map
is summonable, not always-on, to keep the screen contemplative.

## Battle UI (ATB)

The battle HUD must make the readable ATB ([combat](combat.md)) legible at a glance:

- **Party row** — HP, **Anima (AP)**, and a filling **ATB gauge** per member;
  a clear "ready" state.
- **Two-resource clarity** — AP shown per-character; **grist** shown as the shared
  pool, with any grist-costed action (Bind, Render) explicitly flagging its grist
  price *before* you commit. The "spend the world to win?" choice must be obvious.
- **Pressure / Break** — a visible Pressure meter on enemies and an unmistakable
  Break state (the opening for Severance).
- **Command menu** — Strike / Craft / Bind / Augment / Item / Defend
  ([combat](combat.md)), with learned spells grouped and costs shown.
- **Battle log & telegraphs** — clear turn-order preview and enemy intent
  telegraphs, so methodical play is informed, not guessed.
- **Speed control on-screen** — battle speed / Wait mode toggle reachable mid-fight.

## Menus

- **Party** — status, equipped shards/augments, learned spells, stats.
- **Builds (Growth)** — the heart of progression
  ([progression-and-economy](progression-and-economy.md)): equip **Bound shards**
  (see learning progress), slot **chrome augments**, and (at a workshop) **refine**
  grist and **craft**. Every cost is in grist; the wallet is always in view.
- **Items** — consumables and key items.
- **Ledger (codex)** — the in-world archive of lore, the Bound, the Houses, and the
  unfolding mystery ([side-content](side-content.md)); doubles as the player's map of
  the slow-burn plot.
- **Map** — Vanta's tiers and the Reach; discovered safehouses for fast-travel.
- **Factions** — standing with the Concord Houses, the Unrendered, and the Ashfast
  enclaves, and your **moral ledger** (the record of rendering choices;
  [side-content](side-content.md)).
- **System/Settings** — accessibility, audio mix, controls, saves.

## Controls

Designed **touch-first, with full keyboard and gamepad parity** — GRIST targets
web + mobile/tablet ([decisions/0005](../decisions/0005-platform-target.md),
[platform-and-target](../production/platform-and-target.md)). The methodical, no-twitch
ATB suits touch well. Battle is fully playable by tap; the field uses tap-to-move /
virtual stick (scheme TBD — T5 in [open-questions/register](../open-questions/register.md)).

| Context | Touch | Gamepad | Keyboard (default) |
|---|---|---|---|
| Move | Tap-to-move / virtual stick | Left stick / D-pad | WASD / arrows |
| Confirm / Interact | Tap target | A | Enter / E |
| Cancel / Back | Back button / swipe | B | Esc / Q |
| Menu | On-screen button | Start | Tab / Esc |
| Map | On-screen button | Select | M |
| Cycle target / page | Tap / swipe | Bumpers | Q / E |
| Battle speed toggle | On-screen toggle | Trigger | Shift |

All bindings are **remappable**; input is routed through the starter's semantic
`InputService` (actions, not raw keys —
[conventions/coding-conventions](../conventions/coding-conventions.md)), so adding
schemes/devices is clean.

## Accessibility

A first-class commitment, much of it already enforced by the starter:

- **Configurable battle speed / full Wait mode** ([combat](combat.md)) — the single
  biggest accessibility lever in an ATB game.
- **Remappable controls**, hold-vs-toggle options, no twitch requirements.
- **Full subtitles/captions**, independent volume mixing, and **no information
  conveyed by color or audio alone** (pair with shape/text;
  [art-direction](art-direction.md), [audio-direction](audio-direction.md)).
- **Reduced-motion and pause-on-blur** baselines (already enforced;
  [architecture/overview](../architecture/overview.md)), scalable text, and a
  scalable difficulty curve ([overview](overview.md)).

## Production approach

Per the [roadmap](../production/roadmap.md): build functional, unstyled UI for the
[vertical-slice](../production/vertical-slice.md) (the battle HUD and growth screen
are *required* there), then dress it in the final art language once flows are
proven. Information architecture first; skin second.

## Open questions

Tracked in [open-questions/register](../open-questions/register.md): the **touch control
scheme** (tap-to-move vs. virtual stick; battle touch UX — T5) and how diegetic to push
the menus without hurting readability (V5). Battle view is resolved to **side-view**
and touch is **in scope** ([0006](../decisions/0006-phase-1-technical-decisions.md),
[0005](../decisions/0005-platform-target.md)).
