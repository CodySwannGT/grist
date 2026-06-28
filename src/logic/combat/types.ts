/**
 * Pure, Phaser-free combat primitives: the element/status/target enumerations
 * and the runtime stat/combatant shapes the deterministic sim is built on. These
 * are the typed foundation referenced by the `src/content` data tables and (in
 * later sub-tasks) the ATB `step` reducer. No Phaser, no I/O, no randomness — so
 * the whole tree typechecks under plain `tsc` and is unit-testable headless.
 * @module logic/combat/types
 */

/**
 * The five combat elements. Use the keyed values (e.g. `Elements.flux`) rather
 * than inline string literals so a typo is a compile error and there is one
 * source of truth. Soft opposition pairs: Flux↔Ash, Iron↔Bloom; Gloom is void.
 */
export const Elements = {
  flux: "flux",
  ash: "ash",
  iron: "iron",
  bloom: "bloom",
  gloom: "gloom",
} as const;

/** A combat element id (`"flux" | "ash" | "iron" | "bloom" | "gloom"`). */
export type ElementId = (typeof Elements)[keyof typeof Elements];

/**
 * The first-pass status-effect ids. `rendering` is the DoT that gates loot;
 * `rooted` is the Bound (root) movement lock; `stagger` delays the next ATB turn.
 */
export const Statuses = {
  rendering: "rendering",
  silenced: "silenced",
  hollowed: "hollowed",
  rooted: "rooted",
  stagger: "stagger",
} as const;

/** A status-effect id. */
export type StatusId = (typeof Statuses)[keyof typeof Statuses];

/**
 * Spell/skill targeting modes. `all` is the AoE form (e.g. a Bind summon);
 * `self` covers buffs/heals cast on the actor.
 */
export const SpellTargets = {
  one: "one",
  all: "all",
  self: "self",
} as const;

/** A spell targeting mode (`"one" | "all" | "self"`). */
export type SpellTarget = (typeof SpellTargets)[keyof typeof SpellTargets];

/**
 * The core combat stat block. HP/AP are pools; POW/FOC drive Strike/Craft power;
 * DEF/WRD mitigate; SPD fills the ATB gauge; LCK feeds crit and status land.
 */
export interface Stats {
  readonly hp: number;
  readonly ap: number;
  readonly pow: number;
  readonly foc: number;
  readonly def: number;
  readonly wrd: number;
  readonly spd: number;
  readonly lck: number;
}

/**
 * A status effect riding on a combatant, with its remaining turn count.
 * `power` is the per-tick magnitude for damage-over-time statuses (Rendering):
 * it is captured from the caster's FOC at application time so each tick is a
 * fixed, RNG-free amount. It is absent for non-DoT statuses (silenced, rooted,
 * stagger).
 */
export interface CombatantStatus {
  readonly id: StatusId;
  readonly turns: number;
  readonly power?: number;
}

/**
 * A party member or enemy as it exists inside a battle: the runtime state the
 * pure sim advances. `ref` points back to the content id (party member / enemy)
 * it was built from; `atb` is the 0–100 turn gauge; `broken` is the post-Break
 * vulnerable state; `spent` marks a corpse killed by a Rendering tick, whose
 * loot is forfeit. This is plain data — scenes only render it.
 */
export interface Combatant {
  readonly ref: string;
  readonly stats: Stats;
  readonly hp: number;
  readonly ap: number;
  readonly atb: number;
  readonly statuses: readonly CombatantStatus[];
  readonly pressure: number;
  readonly broken: boolean;
  readonly spent: boolean;
}

/**
 * Which side of a battle a combatant fights on. The party and enemies live in
 * separate arrays on {@link BattleState}; a side id plus an index addresses one.
 */
export const BattleSides = {
  party: "party",
  enemies: "enemies",
} as const;

/** A battle side id (`"party" | "enemies"`). */
export type BattleSide = (typeof BattleSides)[keyof typeof BattleSides];

/**
 * A stable handle to one combatant inside a {@link BattleState}: the side it is
 * on plus its index within that side's array. The reducer addresses actors and
 * targets by ref so state stays plain, serializable data (no object identity).
 */
export interface CombatantRef {
  readonly side: BattleSide;
  readonly index: number;
}

/**
 * The action kinds the battle reducer accepts. `tick` advances every ATB gauge;
 * the rest are a combatant spending its ready turn. Mirrors the engineering-spec
 * `step()` contract. Effect resolution (damage / heal / resource spend) lands in
 * the follow-up combat-rules sub-tasks — this engine owns turn flow + RNG.
 */
export const ActionKinds = {
  tick: "tick",
  strike: "strike",
  craft: "craft",
  bind: "bind",
  augment: "augment",
  item: "item",
  defend: "defend",
} as const;

/** A battle action kind. */
export type ActionKind = (typeof ActionKinds)[keyof typeof ActionKinds];

/**
 * One command applied to the battle via the reducer. `actor` / `target`
 * reference combatants by {@link CombatantRef}; `id` names the spell / item for
 * actions that need it (resolved by later sub-tasks). A `tick` carries none.
 */
export interface BattleAction {
  readonly kind: ActionKind;
  readonly actor?: CombatantRef;
  readonly target?: CombatantRef;
  readonly id?: string;
}

/**
 * The high-level battle phase. `won` / `lost` are the terminal outcomes the
 * `step` reducer flips to via `resolveOutcome` when the last enemy or the last
 * party member falls; a battle in either is resolved and rejects further actions.
 */
export const BattlePhases = {
  select: "select",
  resolve: "resolve",
  won: "won",
  lost: "lost",
} as const;

/** A battle phase id. */
export type BattlePhase = (typeof BattlePhases)[keyof typeof BattlePhases];

/**
 * An append-only record of one resolved action — the observable trail the
 * determinism check (and, later, the verification bridge) reads. `roll` is the
 * seeded variance value the action consumed from the RNG stream, when any;
 * `damage` is the HP delta a resolved hit applied to its target, when any.
 */
export interface BattleEvent {
  readonly tick: number;
  readonly kind: ActionKind;
  readonly actor?: CombatantRef;
  readonly target?: CombatantRef;
  readonly roll?: number;
  readonly damage?: number;
}

/**
 * The whole pure battle state the reducer advances: plain, frozen-safe data that
 * scenes render and feed {@link BattleAction}s. `seed` is the immutable origin
 * seed; `rngState` is the live mulberry32 state threaded through every step, so
 * the same `(state, action, seed)` always yields the same next state — the sim
 * never reads `Math.random` / `Date.now` / `performance.now`.
 */
export interface BattleState {
  readonly party: readonly Combatant[];
  readonly enemies: readonly Combatant[];
  readonly grist: number;
  readonly seed: number;
  readonly rngState: number;
  readonly tick: number;
  readonly phase: BattlePhase;
  readonly log: readonly BattleEvent[];
}
