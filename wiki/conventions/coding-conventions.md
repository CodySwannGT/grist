---
type: playbook
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Coding conventions

Most are lint-enforced (you'll get an error); the rest are judgment calls. For
any Phaser API question, read the official Phaser skills at
`node_modules/phaser/skills/<topic>/SKILL.md`.

## Architecture (enforced)

- All game rules in `src/logic/**`, zero `phaser` imports (`no-restricted-imports`).
- One scene class per file; flow Boot → Preloader → MainMenu → Game → GameOver.
- Typed keys only — import scene/event/asset keys from `consts.ts` / `assets.ts`.

## Determinism (enforced)

- No `Math.random()` / `Date.now()` / `performance.now()` in game code. Use the
  seeded `Rng` and the scene delta.

## Performance (enforced)

- No object/tween/timer creation in `update()` and no per-frame allocation
  (`phaser/no-create-in-update`, `phaser/no-allocation-in-update`). The
  zero-allocation indexed `for (let i = …)` is allowed in hot paths.
- Pool transient objects; never `new`/`destroy` per spawn.

## State, events, lifecycle (enforced)

- Global state via the registry; events via the single `EventsCenter` (never
  `game.events`); persist only through `SaveService` (no raw `localStorage`
  outside `src/services/**`).
- Persistent external listeners must be cleaned up on shutdown
  (`require-shutdown-cleanup`); prefer `once` for one-shots.

## Assets

- Placeholder art is generated programmatically in the Preloader (zero binary
  assets). When adding real art, run it through the asset pipeline
  (`free-tex-packer-core` / `audiosprite` / BMFont) and regenerate `assets.ts` —
  see the `phaser-asset-pipeline` skill.

## Verification (definition of done)

- Verification **is** UAT — see [playbooks/run-and-verify](../playbooks/run-and-verify.md).
  Pure rules are unit-tested in `tests/logic`; scenes/services are verified
  end-to-end in `tests/e2e` by an agent playing the game.

## Judgment calls (not enforced)

- Pooling strategy, when to reach for `SpriteGPULayer`, game feel/juice, art
  direction, and whether a change is genuinely `verification-exempt` (logged,
  never silent).
