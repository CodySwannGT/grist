# Phaser 4 Starter — Exhaustive Research & Build Plan

> Status: **Research only — no implementation.** This document is the grounding
> brief for building `phaser-starter` as an opinionated, agent-maintained Phaser 4
> template, codified as a Lisa project type and enforced across every quality layer.
>
> Date: 2026-06-27 · Author: research pass (Claude)

---

## 0. Executive summary

The goal is a bullet-proof, extremely opinionated **Phaser 4 + TypeScript + Vite**
starter that (a) becomes a GitHub template repo (`CodySwannGT/phaserstarter`, peer of
`railsstarter`, `nestjsstarter`, `expostarter`, …), and (b) is codified as a Lisa
**project type** so every best practice is enforced by lint rules, agent hooks, git
hooks, and CI/CD — with agents doing 100% of the work.

**Most important finding: a large fraction of this already exists in Lisa and is
technically correct.** The `phaser` project type is already wired into detection,
the type hierarchy, config factories (ESLint/Vitest/tsconfig/oxlint), and a
`lisa-phaser` Claude plugin with 8 skills, a rules file, and a SessionStart hook.
The independent web research confirms the existing artifacts are accurate (renderer
rewrite, RenderNodes, Filter system, removed v3 idioms, GPU layers, ESM/tree-shaking).

What remains is: (1) the **actual starter repo content** (the game scaffold), (2)
**`setup-project --type phaser` registration**, and (3) **deepening enforcement** —
today only Phaser-3-idiom bans + `Math.random` are lint-enforced; most of the
best-practice catalog lives in prose (skills/rules) and is not yet machine-checked.

**One version correction to act on:** Lisa pins `phaser@^4.1.0`, but npm `latest`
is **`4.2.0`** (published 2026-06-19). Bump the pin to `^4.2.0`.

---

## 1. Current-state audit — what already exists in Lisa for Phaser

Everything below is present in `/Users/cody/workspace/lisa` today.

### 1.1 Project-type registration (DONE)
- **Type union + hierarchy + order** — `src/core/config.ts`
  - `ProjectType` includes `"phaser"`.
  - `PROJECT_TYPE_HIERARCHY.phaser = "typescript"` (Phaser inherits the TS type).
  - `PROJECT_TYPE_ORDER` lists `phaser` after `typescript`/`npm-package`/`harper-fabric`.
- **Detector** — `src/detection/detectors/phaser.ts`: matches when `phaser` is in
  `dependencies` or `devDependencies`. Registered in `src/detection/index.ts`.
- **Template tree** — `/Users/cody/workspace/lisa/phaser/` with all strategy folders
  (see §6 for the strategy semantics):
  - `copy-overwrite/`: `eslint.config.ts`, `tsconfig.json`, `tsconfig.eslint.json`,
    `vitest.config.ts`, `knip.json`, `.github/workflows/ci.yml`
  - `copy-contents/`: `.gitignore`, `.prettierignore` (guardrail-block merge)
  - `merge/`: `.claude/settings.json` (enables `lisa-phaser@lisa` + plugin set),
    `.oxlintrc.json`
  - `package-lisa/package.lisa.json`: forces Vitest/lint scripts + the dev toolchain,
    defaults `phaser@^4.1.0` + `vite@^6.3.1` + dev/build/preview scripts, removes
    the old `knip` script.
  - `deletions.json`: removes `jest.config.local.ts` (Phaser uses Vitest).
- **Test** — `tests/unit/config/phaser-template.test.ts` exists.

### 1.2 Config factories (DONE, published via `@codyswann/lisa`)
- **ESLint** — `src/configs/eslint/phaser.ts` → `getPhaserConfig()`. Extends the TS
  config and adds `no-restricted-syntax` bans for removed v3 idioms
  (`setPipeline`/`setPostPipeline`/`resetPipeline`, `setTintFill`, `preFX`/`postFX`,
  `Geom.Point`, `Phaser.Struct`, `BitmapMask`) **and** `Math.random()` (determinism).
  Bans apply to `src/**`; relaxed in `tests/**`.
- **Vitest** — `src/configs/vitest/phaser.ts` → `getPhaserVitestConfig()`. `node`
  environment, `passWithNoTests`, coverage over `src/**` but **excludes**
  `src/scenes/**`, `src/entities/**`, `src/main.ts`, `src/types/**` (these are
  verified by Playwright smoke, not units).
- **tsconfig** — `tsconfig/phaser.json`: extends `tsconfig/typescript.json`, `lib`
  = ES2022 + DOM + DOM.Iterable, `types: ["node","vitest"]`, includes `src/**` and
  `tests/**`, excludes `public/assets`.
- **oxlint** — `oxlint/phaser.json`: extends `oxlint/typescript.json`, ignores
  `public/assets/**`, `.vite/**`, `dist`, `coverage`.

### 1.3 `lisa-phaser` Claude plugin (DONE — prose layer)
`plugins/src/phaser/`:
- `.claude-plugin/plugin.json` — `lisa-phaser`, depends on `lisa-typescript`,
  `SessionStart` + `SubagentStart` hooks run `hooks/inject-rules.sh`.
- `hooks/inject-rules.sh` — injects every `rules/*.md` into the session wrapped in
  `<lisa-phaser-rule>` tags.
- `rules/phaser.md` — the load-bearing rule set: Phaser-4-only idiom bans,
  architecture (one scene/file, pure logic in `src/logic/`, typed asset keys),
  determinism, performance (no allocs in `update()`, pooling, GPU layers),
  verification (`typecheck && test && build` + browser/Playwright check).
- 8 skills (on-demand deep docs): `phaser-scenes`, `phaser-project-structure`,
  `phaser-v3-migration`, `phaser-gameobjects`, `phaser-physics`, `phaser-assets`,
  `phaser-rendering`, `phaser-testing`.

### 1.4 What this means
The **scaffolding and knowledge layer is largely built and accurate.** The project is
not greenfield — it is ~60% of the way there on the *governance* side. The gaps are
the *artifact* (the actual game starter) and the *depth of enforcement*.

---

## 2. Gap analysis — what is NOT done yet

| # | Gap | Today | Needed |
|---|-----|-------|--------|
| G1 | **Starter repo content** | `phaser-starter/` is empty (only `.claude`) | Full scaffold: `index.html`, `src/main.ts`, `src/game/`, Boot/Preloader/Menu/Game scenes, Vite config(s), example pooled entity, typed asset registry, a passing unit test + a Playwright smoke test |
| G2 | **`setup-project --type phaser`** | `phaser` absent from `SETUP_TYPES`/`STARTERS` in `src/cli/starters.ts` | Add `phaser` entry + create `CodySwannGT/phaserstarter` GitHub template repo. (Detection-based `lisa apply` already works.) |
| G3 | **Version pin** | `phaser@^4.1.0`, `vite@^6.3.1` | Bump to `phaser@^4.2.0` (npm latest 2026-06-19); confirm Vite major |
| G4 | **Deep lint enforcement** | Only v3-idiom bans + `Math.random` | Enforce the rest of the catalog (§5): no-alloc-in-`update`, no Phaser imports in `src/logic`, listener cleanup, typed keys, no `debug:true` in prod, etc. Most need a custom ESLint plugin and/or ast-grep. |
| G5 | **ast-grep Phaser rules** | none (`ast-grep/rules/` has no phaser dir) | Structural rules for patterns awkward in ESLint selectors |
| G6 | **Custom `eslint-plugin-phaser`** | none (uses `no-restricted-syntax`) | A real plugin for stateful rules (e.g. "every `.on()` in a scene needs an `.off()` in `shutdown`", "no `this.add.*` inside `update`") |
| G7 | **Testing harness in the template** | factory excludes scenes; no example tests | `vitest-canvas-mock` setup, example pure-logic unit test, Playwright `toHaveScreenshot` smoke + visual-regression baseline |
| G8 | **tsconfig strictness for games** | inherits TS base | Verify/add `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` (high value for grid/subclass-heavy game code) — see §5 |
| G9 | **Asset pipeline tooling** | prose only | Decide + wire atlas packing (free-tex-packer-core), audiosprite, BMFont, and the typed-key codegen step |
| G10 | **CI specialization** | generic `quality.yml` | Add game-appropriate jobs (Playwright visual regression, bundle-size budget, Lighthouse/PWA), `skip_jobs` for N/A (Maestro mobile) |

---

## 3. Phaser 4 — the framework (grounding facts)

### 3.1 Release timeline (verified via npm `npm view phaser time`)
| Milestone | Version | Date |
|---|---|---|
| First beta | `4.0.0-beta.1` | 2024-11-14 |
| First RC | `4.0.0-rc.1` | 2025-04-01 |
| **Stable GA** | **`4.0.0`** | **2026-04-10** |
| Feature release "Salusa" | `4.1.0` | 2026-04-30 |
| **Current latest** | **`4.2.0`** | **2026-06-19** |

> "Released June 2025" = the RC period. Stable GA was **April 2026**. Phaser 3
> (3.90, 2025-05) is still maintained in parallel. **Pin `phaser@^4.2.0`.**

### 3.2 What changed v3 → v4
- **New WebGL renderer ("Beam")**, rewritten in-house. Same high-level public API
  (Sprites/Text/Tilemaps/Scenes/Tweens), so most v3 code/conventions carry forward.
- **RenderNodes replace Pipelines.** Each node does one thing; configured via
  `render.renderNodes`. Custom WebGL is now a RenderNode, not a pipeline.
- **Unified Filter system** replaces separate FX + Masks; works on any GameObject or
  Camera. `BitmapMask` → `Mask` filter.
- **Indexed drawing**: 4 vertices/quad instead of 6 (~33% less vertex data).
- **GPU GameObjects**: `SpriteGPULayer` (≈1M sprites ~1 draw call), `TilemapGPULayer`
  (whole layer at fixed cost).
- **Lighting**: `sprite.setLighting(true)` replaces `setPipeline('Light2D')`.
- **ESM-first / scoped, tree-shakeable build.** A compat bundle keeps `Phaser.*`
  global so `import Phaser from 'phaser'` still works. Bundled TypeScript types
  (no `@types/phaser`); ships ESM + CJS via `exports` map.
- **Removed**: `Geom.Point` (→ `Vector2`), `Phaser.Struct.Set/Map` (→ native),
  `setTintFill` (→ `setTint`+`setTintMode`), `Mesh`/`Plane`, `Camera3D`, bundled
  Spine, legacy polyfills. `Math.TAU` corrected to `PI*2`. `roundPixels` now
  defaults to **`false`** (was `true`). Canvas renderer deprecated.
- **PCT (Phaser Compact Texture)** atlas format, much smaller than JSON atlases.
- Phaser 4 **uses bitECS internally** (optional for users; OOP still fully supported).
- The Phaser repo ships official **AI "skills"** (`skills/v3-to-v4-migration/`).

### 3.3 Official tooling & starters
- **Scaffolder**: `npm create @phaserjs/game@latest [dir]` (pkg
  `@phaserjs/create-game`, v1.3.2). Interactive: bundler/framework → JS/TS.
- **Recommended base for this project**: `phaserjs/template-vite-ts` (framework-
  agnostic Vite + strict TS, already on Phaser 4). Two-tier entry:
  `src/main.ts` (DOM bootstrap) → `src/game/main.ts` (config + `new Phaser.Game`)
  → `src/game/scenes/`. Per-env Vite configs in `vite/config.dev.mjs` /
  `vite/config.prod.mjs`.
- Framework variants exist (React/Vue/Angular/Next/Solid/Svelte/Remix) with an
  `EventBus` singleton bridging UI ↔ Phaser — relevant only if we want HTML UI.
- Resources: docs `https://docs.phaser.io`, examples `https://phaser.io/examples`,
  engine `https://github.com/phaserjs/phaser`, news/release notes
  `https://phaser.io/news`, Discord `https://discord.gg/phaser`.

### 3.4 Core architecture (for rule authors)
- **Game config** → `new Phaser.Game(config)`: `type` (`AUTO`/`WEBGL`/`CANVAS`),
  `width`/`height`, `parent`, `scale`, `scene[]`, `physics` (`arcade`|`matter`),
  render flags (`roundPixels` now default `false`, `pixelArt`, `antialias`, `fps`).
- **Scene lifecycle**: `init(data) → preload() → create(data) → update(t, dt)`;
  states INIT→RUNNING→PAUSED/SLEEPING→SHUTDOWN→DESTROYED. **Scenes are reused on
  restart** → reset per-run state in `init()`, free listeners/timers/tweens on
  `SHUTDOWN`.
- **Scene manager**: `start` (shutdown+start), `launch` (parallel overlay),
  `switch` (sleep caller, wake target), `sleep`/`wake`, `run`, `restart`. Calls are
  queued to the next manager tick (not synchronous).
- **Physics**: Arcade (AABB, fast — the sensible default) vs Matter (full rigid
  body). They cannot interact. `debug` must be off in production.

---

## 4. The harness — enforcement layers available in Lisa

The whole point: turn each best practice into something a machine checks. Lisa offers
**seven enforcement layers**, fastest/cheapest first:

1. **tsconfig** — compiler-enforced invariants (strictness flags). Free, total.
2. **oxlint** — Rust-speed lint on staged files + CI (`oxlint/phaser.json`).
3. **ESLint** (`eslint.config.ts` → `getPhaserConfig`) — typed rules, custom
   `no-restricted-syntax`/`no-restricted-imports`, and a future
   `eslint-plugin-phaser` for stateful rules. Slow rules split into
   `eslint.slow.config.ts` (pre-push/CI only).
4. **ast-grep** (`sgconfig.yml` + `ast-grep/rules/*.yml`) — structural pattern rules
   for things clumsy in ESLint selectors. Runs in `lint-staged` + CI.
5. **Agent rules + skills** (`plugins/src/phaser/`) — injected into every AI session
   via `inject-rules.sh` (SessionStart/SubagentStart). The "soft" layer for things
   not statically checkable; deep skills loaded on demand.
6. **Git hooks** (`.husky/`, `.lintstagedrc.json`) — pre-commit (branch guard,
   gitleaks, typecheck, lint-staged: eslint+ast-grep+prettier), pre-push (audit,
   slow lint, knip dead-code, `test:cov`), commit-msg (commitlint + AI co-author).
   `--no-verify` is blocked by an agent hook.
7. **CI/CD** (`.github/workflows/ci.yml` → reusable `quality.yml`) — lint, typecheck,
   coverage thresholds, knip, ast-grep, format, build, security (audit/GitGuardian/
   Snyk/Sonar/ZAP), Playwright, FOSSA. Per-type via `skip_jobs`.

Plus **thresholds that ratchet** (never loosen): `eslint.thresholds.json`
(cognitiveComplexity/maxLines/maxLinesPerFunction), `vitest.thresholds.json`
(coverage), `knip.json` (dead code).

---

## 5. The catalog — every Phaser 4 best practice mapped to an enforcement layer

This is the core deliverable: a comprehensive, opinionated rule catalog. Each row is
a best practice, the failure it prevents, and **where it should be enforced**. Legend
for layer: `TS`=tsconfig, `OX`=oxlint, `ES`=ESLint built-in/typed, `ESC`=custom
ESLint rule or `no-restricted-*`, `AG`=ast-grep, `AGENT`=agent rule/skill,
`HOOK`=git hook, `CI`=CI job. ✅ = already enforced in Lisa today.

### 5.1 Phaser-4-only / banned v3 idioms
| Best practice | Prevents | Layer |
|---|---|---|
| No `setPipeline`/`setPostPipeline`/`resetPipeline` ✅ | dead v3 API | ESC (`no-restricted-syntax`) |
| No `setTintFill`/`tintFill` ✅ | removed API | ESC |
| No `preFX`/`postFX` ✅ | removed FX system | ESC |
| No `Phaser.Geom.Point` ✅ | removed → `Vector2` | ESC |
| No `Phaser.Struct.Set/Map` ✅ | removed → native | ESC |
| No `BitmapMask` ✅ | removed → `Mask` filter | ESC |
| No `setPipeline('Light2D')` → `setLighting(true)` | removed | ESC (add) + AGENT |
| No raw WebGL (use `Extern`) | renderer coupling | AG + AGENT |
| No `Mesh`/`Plane`/`Camera3D`/`Math.TAU`-as-PI/2 | removed/changed | ESC (add) |
| Canvas renderer only as explicit documented fallback | perf/feature loss | AGENT |

### 5.2 Determinism
| Best practice | Prevents | Layer |
|---|---|---|
| No `Math.random()` in game code ✅ | non-reproducible replays/tests | ESC |
| Use seeded `Phaser.Math.RND` with explicit seed | flaky tests/replays | AGENT + AG |
| No `Date.now()`/`performance.now()` in sim logic | non-determinism | ESC (`no-restricted-*`) |
| Don't switch Arcade to variable step to mask bugs | physics instability | AGENT |

### 5.3 Architecture & decoupling (highest-value, mostly NOT enforced yet)
| Best practice | Prevents | Layer |
|---|---|---|
| **No `phaser` import in `src/logic/**`** (pure, testable logic) | untestable coupling | **ESC** (`no-restricted-imports` scoped to `src/logic`) — *build this* |
| One scene class per file under `src/scenes/` | god files | ESC (custom) / AG |
| Enforced dependency direction (`main→scenes→objects/services→types/utils`) | cycles | ES (`import/no-cycle`) + ESC `no-restricted-imports` |
| Asset/scene/event keys are typed constants — no string literals to `load.*`/`add.*`/`scene.start`/`play()` | typo runtime crashes | **ESC/AG** — *build this* + codegen `src/assets.ts` |
| Global state only via typed wrapper over `registry`; no module-level mutable `let` in `scenes/**` | hidden globals | ESC (`no-restricted-syntax`) |
| Dedicated `EventsCenter` bus; never reuse `game.events` | clobbering internals | ESC (`no-restricted-syntax` on `game.events.on`) |
| Type all inter-scene data payloads | malformed handoffs | TS (interfaces) + AGENT |

### 5.4 Lifecycle hygiene (silent-leak prevention — agents can't *feel* leaks)
| Best practice | Prevents | Layer |
|---|---|---|
| Every external `.on()` (`this.input`/`scale`/`time`/`window`/custom bus) has a matching `.off()` in `shutdown`/`destroy` | memory leaks across restarts | **ESC custom plugin** — *build this* (stateful) |
| Re-init all per-run state in `init()` (not only `create()`) | stale state on restart | AGENT + AG (heuristic) |
| `this.textures.remove(key)` for scene-local textures on shutdown | GPU memory leak | AGENT + AG |
| Destroy `persist:true` tweens/emitters explicitly | leaks | ESC/AG |
| Prefer `once()` for one-shot listeners | leaks | ES/AG (advisory) |

### 5.5 Performance
| Best practice | Prevents | Layer |
|---|---|---|
| **No allocations in `update()`** (no `new`, array/object literals, `.map/.filter`, closures) | GC stutter / frame drops | **ESC custom plugin** — *build this* (scope to `update`/per-frame) |
| No `this.add.*`/`tweens.add`/`time.addEvent`/`new Phaser.*` inside `update()` | per-frame churn | **ESC/AG** — *build this* |
| Pool transient objects via `Group` (`get`/`killAndHide`), never `new`/`destroy` per spawn | GC pressure | AGENT + AG (heuristic) |
| Atlas everything in prod (`load.atlas`/`multiatlas`, PCT); no loose images | draw-call flushes | AGENT + build-step lint |
| `BitmapText` for high-churn text (scores/timers); reserve `Text` for static | texture re-upload | AGENT + AG (advisory) |
| `SpriteGPULayer`/`TilemapGPULayer` for mass rendering | draw-call explosion | AGENT |
| `debug:false` in physics config for production builds | perf + visual leak | **ESC** (`no-restricted-syntax` on `debug: true`) — *build this* |
| Cap devicePixelRatio (~2); fixed logical resolution + `Scale.FIT` | mobile perf | AGENT |
| `setVisible(false)` over `alpha:0` for hidden objects | overdraw | AGENT |

### 5.6 TypeScript strictness (compiler layer — cheapest enforcement)
| Best practice | Prevents | Layer |
|---|---|---|
| `strict: true` | broad classes of bugs | TS ✅ (inherited — verify) |
| **`noUncheckedIndexedAccess`** (tile grids, sprite arrays) | undefined index crashes | TS — *verify/add* |
| **`noImplicitOverride`** (subclassing `Scene`/`Sprite`, overriding `update`/`preload`) | accidental non-override | TS — *verify/add* |
| `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature` | config-shape bugs | TS — *verify/add* |
| `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch` | dead/buggy code | TS |
| typed-linting: `no-explicit-any` + unsafe-any family | `any` erosion | ES (typed) |
| `no-floating-promises`/`no-misused-promises` (async passed to `input.on`/`addEvent`) | dropped errors | ES (typed) |
| `switch-exhaustiveness-check` (game-state unions) | unhandled states | ES (typed) |
| `no-magic-numbers` (`ignore:[0,1,-1]`, `ignoreEnums`, `enforceConst`) | tunable sprawl | ES |
| `naming-convention` (PascalCase types/classes, UPPER_CASE consts) | inconsistency | ES |

### 5.7 Testing (see §7)
| Best practice | Prevents | Layer |
|---|---|---|
| Pure logic unit-tested with Vitest (`src/logic`) | regressions | CI + HOOK (`test:cov`) ✅ |
| Scenes/entities verified by Playwright smoke, not units (excluded from coverage) ✅ | brittle tests | Vitest factory ✅ |
| `vitest-canvas-mock` for any code touching canvas | jsdom canvas crash | template setup — *build* |
| Visual regression via Playwright `toHaveScreenshot` (seed RNG, freeze frame) | rendering regressions | CI — *build* |
| Coverage thresholds ratchet up only | rot | thresholds ✅ |

### 5.8 Build & deploy
| Best practice | Prevents | Layer |
|---|---|---|
| `manualChunks: { phaser: ['phaser'] }` vendor split | cache busting on redeploy | Vite config — *build* |
| Terser 2-pass, strip license banners/comments | bundle bloat | Vite config — *build* |
| ESM + `moduleResolution: bundler` for tree-shaking | dead weight | TS ✅ (verify) |
| Bundle-size budget gate | silent bloat | CI — *build* |
| `public/assets/**` excluded from lint/format/knip/coverage ✅ | noise | already ✅ |
| Correct `base` for host (Pages `/<repo>/` vs root) | broken deploy | AGENT + CI |
| `vite-plugin-pwa` with extended `globPatterns` (png/json/mp3/webp) + raised file-size cap | broken offline | template (optional) |

---

## 6. Lisa project-type mechanics (how the `phaser` type assembles)

When `lisa apply` runs on a project where the Phaser detector matches, it expands to
`[typescript, phaser]` (parent then child) and applies each strategy folder:

| Folder | Strategy | Source impl | Use for |
|---|---|---|---|
| `copy-overwrite/` | replace always (backup+prompt if host edited) | `src/strategies/copy-overwrite.ts` | enforced configs (eslint/tsconfig/vitest/knip/ci) |
| `create-only/` | write once, host owns after | `src/strategies/create-only.ts` | thresholds, `*.local.ts`, project-owned workflows |
| `copy-contents/` | guardrail-block merge (`# BEGIN/END: AI GUARDRAILS PHASER`) or append | `src/strategies/copy-contents.ts` | `.gitignore`, `.prettierignore` |
| `merge/` | deep JSON merge, **project wins** | `src/strategies/merge.ts` | `.claude/settings.json`, `.oxlintrc.json` |
| `package-lisa/package.lisa.json` | `force`/`defaults`/`merge`/`remove` against `package.json`, **Lisa wins on force** | `src/strategies/package-lisa.ts` | scripts, deps, engines, security pins |
| `deletions.json` | delete retired paths | — | remove `jest.config.local.ts` etc. |

Inheritance chain for `package-lisa`: `all/ → typescript/ → phaser/` (child overrides
parent). Config factories ship from `@codyswann/lisa` so the thin wrapper files in
`copy-overwrite/` just call `getPhaserConfig` / `getPhaserVitestConfig` / extend
`@codyswann/lisa/tsconfig/phaser`.

**To finish registration as a first-class setup type** (`lisa setup-project --type
phaser my-game`): add `"phaser"` to `SETUP_TYPES` and a `STARTERS.phaser` entry
(`{ owner:"CodySwannGT", repo:"phaserstarter", template:true }`) in
`src/cli/starters.ts`, then publish the `phaserstarter` GitHub template repo whose
contents are the scaffold from §8. (Detection-based `lisa apply` already works
without this; setup-type is the greenfield convenience.)

**To author new structural rules:**
- New ESLint plugin: create `eslint-plugin-phaser/` (mirror
  `eslint-plugin-component-structure/`: `index.js` exporting `rules`, one file per
  rule in `rules/`), register it in `src/configs/eslint/phaser.ts` via the
  `createRequire`/`fileURLToPath` pattern.
- New ast-grep rule: add `ast-grep/rules/phaser/<id>.yml` (id/language/severity/
  message/rule pattern + `files` glob), tests in `ast-grep/rule-tests/phaser/`.

---

## 7. Testing strategy (recommended)

The hard truth: **you cannot unit-test rendered output.** Split the pyramid:

1. **Pure logic (the bulk)** — `src/logic/**` has zero `phaser` imports; test with
   Vitest in `node` env. Fast, deterministic, high coverage. *Enforce the no-import
   boundary with ESLint.*
2. **Scene/entity wiring** — excluded from unit coverage (already done in the Vitest
   factory). If needed, use `@geckos.io/phaser-on-nodejs` or jsdom+`vitest-canvas-mock`
   sparingly for integration.
3. **Rendered output / input / collisions** — Playwright. A **boot smoke test**
   (game boots, canvas present, no console errors) is mandatory; **visual regression**
   via `toHaveScreenshot()` is the opinionated add (seed RNG, freeze to a known
   frame, snapshot small stable regions to control flake).

This matches the existing `phaser-testing` skill and Vitest exclusions — the gap is
shipping the actual `vitest-canvas-mock` setup + example tests + Playwright config in
the template (G7).

---

## 8. Recommended starter scaffold (the artifact to build later — G1)

Opinionated, based on `template-vite-ts` + the decoupling rules above:

```
index.html
public/assets/                 # runtime assets (atlases, audiosprites, bmfonts)
vite/config.dev.mjs            # dev (no minify, sourcemaps)
vite/config.prod.mjs           # terser 2-pass, manualChunks:{phaser}
src/
  main.ts                      # DOM bootstrap → new Phaser.Game(config)
  game/
    config.ts                  # resolution, scale, physics, render flags
    scenes/                    # Boot, Preloader, MainMenu, Game, GameOver (1/file)
    objects/                   # Player.ts, Enemy.ts (pooled) — 1 class/file
    ui/                        # HUD, buttons
    services/                  # typed registry/event-bus/save wrappers
  logic/                       # PURE TS — no phaser import (the testable core)
  consts/                      # SceneKeys, EventNames, tunables
  assets.ts                    # GENERATED typed asset keys (codegen from filesystem)
  types/
tests/
  *.test.ts                    # Vitest pure-logic units
  e2e/                         # Playwright boot smoke + visual regression
```

Decisions to lock before building (see §9).

---

## 9. Locked decisions

Decided 2026-06-27:

1. **Architecture: OOP scenes (thin adapter) + mandatory pure-logic core. NOT ECS by
   default.** The real, universal win is the decoupling boundary — all game rules in
   `src/logic/**` with zero `phaser` imports (lint-enforced via `no-restricted-imports`);
   scenes/entities are thin orchestrators. ECS (bitECS/Miniplex) is documented as an
   opt-in skill, not the baseline, because a starter must stay genre-neutral.
2. **UI: canvas-only, framework-agnostic** (`template-vite-ts` base). The React/Vue
   `EventBus` bridge is documented as the upgrade path for games with heavy HTML UI,
   not baked into the baseline.
3. **Enforcement: build the custom `eslint-plugin-phaser` now** — required for the
   stateful rules in §5.4/§5.5 (no-alloc-in-`update`, `on`/`off` pairing on shutdown,
   no `this.add.*` in `update`) that `no-restricted-syntax` cannot express.
4. **Physics: Arcade default; Matter opt-in.** Matter's downsides (≈5–10× slower,
   bigger bundle, larger API surface, can't interop with Arcade) make it a tax most
   genres shouldn't pay. One-line config swap documented in the `phaser-physics` skill.

Also decided (no longer deferred):

5. **Asset pipeline: baked in.** `assets/src` (raw) → build step (free-tex-packer-core
   atlases + audiosprite + BMFont) → `public/assets`. **Typed-key codegen** emits
   `src/assets.ts` so a missing/renamed key is a compile error. Wired into
   `npm run build` and gated in CI.
6. **PWA: on by default.** `vite-plugin-pwa`, `registerType:'autoUpdate'`,
   `globPatterns` extended to game assets (png/json/mp3/webp), raised file-size cap,
   immutable hashed assets (no stale-cache footgun).
7. **Version pins: `phaser@^4.2.0`, Vite 6, TypeScript 6** (matches Lisa's TS toolchain).

---

## 11. Deferral audit & runtime-verification harness

The §5 catalog leaned on *static* enforcement and *prose*. Several best practices
**cannot be proven statically** and were silently downgraded to "advisory / agent
rule." For a bullet-proof template those must be backed by **automated runtime
gates**, not hope. This section closes that gap. Nothing here is deferred.

### 11.1 Runtime verification gates (CI jobs + committed tests)
| Gate | Proves | How |
|---|---|---|
| **Boot smoke** | the build actually renders | Playwright: launch `dist/`, assert canvas present, scene reaches `create`, zero console errors/warnings |
| **Allocation / perf budget** | "no allocations in `update()`" + frame budget | run headless N frames, sample `performance.memory`/GC and frame time; fail on growth or budget regression vs a committed baseline |
| **Leak gate** | listener/texture/tween cleanup on shutdown | start→stop a scene N× (e.g. 100); assert `textures` count, active tween count, and EventEmitter listener counts return to baseline |
| **Determinism gate** | seeded RNG → reproducible sim | run the pure-logic core twice with the same seed; assert identical state hash; also a fixed-input replay over the sim |
| **Visual regression** | rendering didn't change unexpectedly | Playwright `toHaveScreenshot` under **deterministic rendering** (software GL / SwiftShader in CI, `pixelArt`/`antialias` fixed, frozen frame, dynamic regions masked) |
| **Bundle-size budget** | no silent bloat | size-limit / rollup-plugin-visualizer gate on `dist/`; separate budgets for the `phaser` vendor chunk vs game code |

These run in CI (extending `quality.yml` via the project workflow) **and** are
runnable locally via `npm run` scripts so agents self-verify before pushing. Each maps
back to a §5 row that was previously "advisory."

### 11.2 Gameplay cross-cutting concerns (scaffold + rule + skill)
| Concern | Opinion | Enforcement |
|---|---|---|
| **Mobile audio unlock** | a single `SoundService` that resumes the audio context on first user gesture; no `sound.play` before unlock | `ESC`/`AG` ban on direct `this.sound.play` outside the service + AGENT |
| **Input abstraction** | unified `InputService` mapping keyboard/gamepad/touch to semantic actions; scenes read actions, never raw keys | `ESC` ban on raw `this.input.keyboard.addKey`/`createCursorKeys` outside the service + AGENT |
| **Save / persistence** | typed `SaveService` over `localStorage` with a **schema version + migration chain**; never raw `localStorage` access | `ESC` (`no-restricted-globals`/`no-restricted-properties` on `localStorage`) + a migration unit test gate |
| **Accessibility** | honor `prefers-reduced-motion` (skip/shorten tweens), pause on blur/visibilitychange, keyboard-navigable menus | AGENT + a Playwright a11y smoke (reduced-motion path boots) |
| **In-game error capture** | a global game error handler wiring `Phaser.Game` errors + `window.onerror`/`unhandledrejection` to the observability sink (Sentry plugin already enabled) | scaffold + AGENT; CI asserts the handler is registered |

### 11.3 Asset licensing & placeholders
The template ships **programmatic placeholder art** (drawn with `Graphics`/generated
textures) and/or **CC0 assets** with provenance recorded in `assets/CREDITS.md` and an
SPDX/license check in CI — zero licensing risk for an OSS template. The example game
(see decision in §9-followup) must still exercise the real atlas/audiosprite/bmfont
pipeline so the asset gates have something to bite on. *(Exact choice: see open Q.)*

### 11.4 Meta / build-infra completeness (in scope, not deferred)
- **`eslint-plugin-phaser`** ships with its own unit tests (RuleTester) + CI, mirrored
  on `eslint-plugin-component-structure/`; published via `@codyswann/lisa`.
- **ast-grep** Phaser rules each get fixtures under `ast-grep/rule-tests/phaser/`.
- **Skills ↔ rules reconciliation:** every machine-enforced rule has a matching skill/
  rule passage; the 8 existing skills are updated to the locked §9 decisions. A CI
  check (or `plugin-parity-drift`-style script) flags drift between enforced rules and
  prose.
- **Setup-type registration:** add `phaser` to `SETUP_TYPES`/`STARTERS`
  (`src/cli/starters.ts`) + create `CodySwannGT/phaserstarter` template repo.
- **Starter lifecycle:** participates in `.versionrc`/release + `lisa-update-projects`
  batch updates (inherited from the typescript type; confirm the workspace config).
- **Docs:** `README.md` (quickstart + opinions) and `CONVENTIONS.md` (the un-lintable
  rules in human form) ship in the template.

### 11.4b Final scope lock (decided 2026-06-27)
- **Example game = a minimal vertical slice** (`Boot→Preloader→MainMenu→Game→GameOver`,
  pooled entities, Arcade physics, score + `SaveService`, `InputService`,
  `SoundService`) whose explicit job is to give every lint rule and every §11.1 runtime
  gate something to bite on. A blank template cannot prove the harness works.
- **Assets = programmatic placeholders + one tiny CC0 atlas/audiosprite** (e.g. Kenney)
  so the real packing pipeline + asset gates are exercised. `assets/CREDITS.md` records
  provenance; CI runs an SPDX/license check.
- **Additional v1 cross-cutting layers (added to §11.2):**
  - **Typed i18n / string catalog** — no hardcoded user-facing strings; typed key
    catalog + locale switch. Enforced: `ESC` ban on string literals in UI/`add.text`,
    routed through the catalog.
  - **Deep accessibility** — keyboard-navigable menus + focus management, colorblind-safe
    palette guidance, a screen-reader live region for key events (on top of the
    `prefers-reduced-motion` + pause-on-blur already locked).
  - **Telemetry/analytics abstraction** — a typed, vendor-neutral analytics service
    interface, off by default and wired for opt-in; the upstream `template-vite-ts`
    anonymous ping is stripped.
  - **Excluded from v1:** multiplayer/netcode (large, genre-specific — over-scoped for a
    baseline).

### 11.5 Honest residue — things that stay prose-only by nature
Not everything can be a gate, and pretending otherwise is its own half-bake. These
remain agent-rule + skill + code review, *explicitly labeled as such*: "is this the
right pooling strategy for this genre," "should this be a `SpriteGPULayer`," art
direction, game-feel/juice, level design. The honesty rule: if it can be a gate it is
one; if it can't, it's documented as a judgment call, never disguised as enforced.

---

## 10. Suggested roadmap (research → build, when greenlit)

1. **Lock §9 decisions.**
2. Bump pins (`phaser@^4.2.0`); finish `setup-project` registration + create
   `phaserstarter` template repo (G2/G3).
3. Build the scaffold (§8) into `phaser-starter/` and the template repo (G1) — boot
   chain, one pooled entity, pure-logic module + its unit test, Playwright smoke.
4. Deepen enforcement: `eslint-plugin-phaser` (no-alloc-in-`update`, on/off pairing,
   no-add-in-`update`), `no-restricted-imports` logic boundary, typed-key rule,
   `debug:true` ban, ast-grep rules; add tsconfig strict flags (G4/G5/G6/G8).
5. Asset pipeline + typed-key codegen (G9).
6. CI specialization: Playwright visual regression, bundle-size budget, Lighthouse;
   `skip_jobs` for N/A (G10).
7. Keep `lisa-phaser` skills/rules in sync with each enforced rule (every machine
   rule should have a matching prose explanation for agents).

---

## Appendix: key source paths

**Lisa (existing):** `src/core/config.ts`, `src/detection/detectors/phaser.ts`,
`src/cli/starters.ts`, `src/configs/eslint/phaser.ts`, `src/configs/vitest/phaser.ts`,
`tsconfig/phaser.json`, `oxlint/phaser.json`, `phaser/` (template tree),
`plugins/src/phaser/` (plugin + 8 skills + rules + hook),
`src/strategies/*.ts` (strategy impls), `.husky/`, `.lintstagedrc.json`,
`.github/workflows/quality.yml`, `eslint-plugin-component-structure/` (rule-authoring
reference), `ast-grep/rules/` + `sgconfig.yml`.

**Phaser 4 (external):** `https://docs.phaser.io`,
`https://github.com/phaserjs/phaser` (incl. `changelog/v4/4.0/MIGRATION-GUIDE.md`,
`skills/v3-to-v4-migration/`), `https://github.com/phaserjs/template-vite-ts`,
`https://github.com/phaserjs/create-game`,
`https://phaser.io/news/2026/05/phaser-3-vs-phaser-4`,
`https://phaser.io/tutorials/phaser-4-rendering-concepts`. (Full source list in the
research transcript.)
