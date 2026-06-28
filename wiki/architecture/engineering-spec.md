---
type: architecture
created: 2026-06-27
updated: 2026-06-27
related: []
sources: []
---

# Engineering spec

The buildable technical detail under [game-tech-design](game-tech-design.md): the
data model (type definitions), the scene/state machine, the content-table schemas,
and the save schema. First-pass and illustrative — types firm up in Phase 1
([roadmap](../production/roadmap.md)) — but concrete enough to start coding the
[vertical-slice-build](../production/vertical-slice-build.md). Reflects the
[Phase-1 decisions](../decisions/0006-phase-1-technical-decisions.md):
sim-authoritative, TS-module content, side-view battles.

## Module layout

```
src/
  logic/            # PURE, deterministic, unit-tested — no Phaser
    combat/         # ATB engine, damage, status, pressure/break
    economy/        # grist wallet, sources/sinks, refining
    progression/    # levels, shards, augments, spell learning
    quests/         # quest state machine, the moral ledger
    world/          # region/world-state model, traversal
    rng.ts          # seeded RNG (mulberry32)
  content/          # TS data tables (typed): enemies, bound, spells, augments, items, regions, encounters
  scenes/           # thin Phaser adapters: Boot, Preloader, Title, Field, Battle, Menu/Growth
  services/         # events, input (touch/kb/pad), sound, save, settings, i18n
  ui/               # battle HUD, menus (render of logic state)
```

## Core types (first-pass)

Runtime state (in `src/logic`):

```ts
type ElementId = "flux" | "ash" | "iron" | "bloom" | "gloom";
type StatusId  = "rendering" | "silenced" | "hollowed" | "rooted" | "stagger" | /* … */;

interface Stats { hp: number; ap: number; pow: number; foc: number;
                  def: number; wrd: number; spd: number; lck: number }

interface Character {
  id: string; level: number; xp: number; baseStats: Stats;
  equippedShards: ShardInstance[];      // grants growth bias + teaches spells
  learnedSpells: string[];              // permanent
  augments: AugmentInstance[];          // slotted chrome
  signatureKit: string[];               // hand-authored, non-shard
}

interface Combatant {                   // a Character (or enemy) in battle
  ref: string; stats: Stats; hp: number; ap: number;
  atb: number;                          // 0..100
  statuses: { id: StatusId; turns: number }[];
  pressure: number; broken: boolean;
}

interface BattleState {                 // the sim's whole state — pure
  party: Combatant[]; enemies: Combatant[];
  grist: number;                        // shared wallet, spendable in-battle
  rngSeed: number; tick: number;
  phase: "select" | "resolve" | "won" | "lost";
  log: BattleEvent[];
}
```

Content tables (in `src/content`, the TS-module format from
[0006](../decisions/0006-phase-1-technical-decisions.md)):

```ts
interface SpellDef   { id: string; name: string; element: ElementId;
                       apCost: number; gristCost?: number; power: number;
                       target: "one" | "all" | "self"; status?: StatusId }
interface BoundDef   { id: string; name: string; element: ElementId;
                       bind: SpellDef; teaches: string[]; growthBias: Partial<Stats>;
                       corruptionRate: number }
interface AugmentDef { id: string; slot: "stat" | "defensive" | "utility" | "active";
                       passives?: Partial<Stats>; active?: SpellDef; gristCost: number }
interface EnemyDef   { id: string; name: string; stats: Stats;
                       elements: Partial<Record<ElementId, number>>;   // weak/resist mults
                       ai: string; lootGrist: number }
interface EncounterDef { id: string; enemies: string[]; backdrop: string }
```

All content is **typed-key referenced** (no raw strings;
[conventions/coding-conventions](../conventions/coding-conventions.md)).

## The combat sim contract

The battle is a **pure reducer** — the single most important contract for verification
([decisions/0001](../decisions/0001-locked-architecture-decisions.md)):

```ts
function startBattle(party, encounter, seed): BattleState
function step(state: BattleState, action: BattleAction): BattleState   // pure, deterministic
```

`action` = `{ kind: "strike"|"craft"|"bind"|"augment"|"item"|"defend"|"tick", actor, target?, id? }`.
Same (state, action, seed) → same next state, always. The Battle scene only renders
`BattleState` and sends `BattleAction`s ([combat-spec](../design/combat-spec.md)).

## Scene / state machine

```
Boot → Preloader → Title
                     │
                     ▼
                   Field (world) ──launch(encounter)──▶ Battle ──result──▶ Field
                     │  ▲                                   │
                     │  └──────────── Menu / Growth ◀───────┘
                     ▼
              worldState: "reach" | "ashfall"   (flips at the Reckoning)
```

- **Field** owns exploration, NPCs, encounter triggers; reads `worldState`.
- **Battle** is launched with an `EncounterDef` + party + seed; returns a result
  (win/lose, grist/loot, shard acquired, free-vs-wield choice).
- **Menu/Growth** edits Character state (equip shards, slot augments, spend grist) and
  is pausable from Field and post-battle.
- The **world-state flag** swaps region variants (Reach↔Ashfall;
  [open-world](../design/open-world.md)).

## Save schema (versioned)

**Local-only, offline** ([decisions/0007](../decisions/0007-local-only-offline.md),
[technical-requirements](technical-requirements.md)): on-device storage via
`SaveService` over **IndexedDB** (or SQLite-in-browser via OPFS) — upgrading the
starter's `localStorage` default — with multiple slots, autosave, and **save
export/import** as the user's backup (no cloud). The shape:

```ts
interface SaveDataV1 {
  version: 1;
  party: Character[]; activePartyIds: string[];
  grist: number; inventory: { id: string; qty: number }[];
  world: { state: "reach" | "ashfall"; region: string;
           discovered: string[]; fastTravel: string[] };
  quests: Record<string, QuestState>;
  moralLedger: { renderCount: number; choices: LedgerEntry[] };
  factions: Record<string, number>;     // standing
  rngLineage: number[]; settings: Settings;
}
```

Every shape change **bumps `version` and adds a migration** — no silent breakage.

## Input (touch-first)

Per the platform target ([platform-and-target](../production/platform-and-target.md)),
the semantic `InputService` maps **touch, keyboard, and gamepad** to the same actions
(move, confirm, cancel, menu, map, cycle-target, battle-speed). Battle is fully
playable by tap; the field supports tap-to-move / virtual stick. No raw key/touch
handling in game logic ([ui-ux-and-controls](../design/ui-ux-and-controls.md)).

## Performance (web + mobile budgets)

Per [platform-and-target](../production/platform-and-target.md): no allocation/creation
in `update()`, pooled sprites (enemies, damage numbers, projectiles), atlased art,
lazy region loads, restrained lighting, and the enforced boot/leak/determinism/bundle
gates ([conventions/coding-conventions](../conventions/coding-conventions.md)).

## Open questions

Region-streaming specifics (T2) and exact content schemas evolve with the build
([open-questions/register](../open-questions/register.md)).
