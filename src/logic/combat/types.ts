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

/** A status effect riding on a combatant, with its remaining turn count. */
export interface CombatantStatus {
  readonly id: StatusId;
  readonly turns: number;
}

/**
 * A party member or enemy as it exists inside a battle: the runtime state the
 * pure sim advances. `ref` points back to the content id (party member / enemy)
 * it was built from; `atb` is the 0–100 turn gauge; `broken` is the post-Break
 * vulnerable state. This is plain data — scenes only render it.
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
}
