# GRIST

A slow, grindy **cyberpunk-fantasy JRPG** — chrome and ash, where megacorp
silicon is grafted onto high fantasy. Targeting 16-bit, FFVI-grade pixel art.

Built on an opinionated, **agent-maintained** Phaser 4 + TypeScript + Vite
foundation, governed by [Lisa](https://github.com/CodySwannGT/lisa). Every best
practice is enforced by lint rules, type checks, git hooks, and CI — and nothing
is "done" until an agent has actually **played the game** and confirmed it
(verification = UAT).

> **Status:** early scaffold. The currently playable build is the starter's
> placeholder vertical slice (slide to catch falling items) — it exercises every
> enforced pattern (pure deterministic sim, pooled sprites, semantic input,
> save/persistence, audio, scene flow, the verification bridge) and will be
> replaced by the JRPG. See the [wiki](./wiki/start-here.md) for the game design.

## Quick start

```bash
bun install
bun run dev        # http://localhost:5173  (arrows / A,D / tap to move; Space to start)
```

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` / `build` / `preview` | Vite dev server / production build / preview the build |
| `bun run test` | Vitest unit tests (the pure logic core) |
| `bun run test:cov` | Unit tests with coverage thresholds |
| `bun run test:e2e` | **Playwright verification (UAT)** — builds, serves, and plays the game |
| `bun run typecheck` | `tsc --noEmit` (strict) |
| `bun run lint` / `lint:fix` | oxlint + ESLint (incl. the Phaser rules) |
| `bun run format` | Prettier |
| `bun run knip:check` | Dead-code detection |
| `bun run size` | Bundle-size budget |

## Documentation

The canonical documentation is the **Lisa wiki** in [`wiki/`](./wiki/start-here.md).
This README is a thin pointer.

- [**Start here**](./wiki/start-here.md) — orientation and the wiki map
- [Architecture overview](./wiki/architecture/overview.md) — pure-logic core, thin scenes, services, the verification bridge
- [Coding conventions](./wiki/conventions/coding-conventions.md) — the enforced rules and the judgment calls
- [Locked architecture decisions](./wiki/decisions/0001-locked-architecture-decisions.md) — the opinions and why
- [Run and verify](./wiki/playbooks/run-and-verify.md) — running the game and the verification = UAT loop
