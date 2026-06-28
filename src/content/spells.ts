/**
 * Castable spell definitions (the Craft layer) as a typed TS-module table. Keys
 * are the canonical spell ids; reference them through {@link SpellIds} so shards,
 * party kits, and the sim can only point at defined spells. Numbers are first-pass
 * targets from the vertical-slice-build, tuned in Phase 1. Pure data — no Phaser.
 * @module content/spells
 */
import {
  Elements,
  SpellTargets,
  Statuses,
  type ElementId,
  type SpellTarget,
  type StatusId,
} from "../logic/combat";

/**
 * A spell/skill definition. `apCost` spends the Anima pool; `gristCost` (when
 * present) spends the shared grist wallet — only the strongest actions (Bind,
 * top-tier Render, revive) cost grist. `status`, when present, is applied on hit.
 */
export interface SpellDef {
  readonly id: string;
  readonly name: string;
  readonly element: ElementId;
  readonly apCost: number;
  readonly gristCost?: number;
  readonly power: number;
  readonly target: SpellTarget;
  readonly status?: StatusId;
}

/**
 * Canonical spell ids. Includes the two Bind (grist-summon) actions even though
 * those live inline on their shard rather than in {@link SPELLS}, so every spell
 * id has a single typed source.
 */
export const SpellIds = {
  spark: "spark",
  cinder: "cinder",
  render: "render",
  bindWisp: "bind-wisp",
  bindMarrow: "bind-marrow",
} as const;

/** A spell id (the literal-union of every defined spell key). */
export type SpellId = (typeof SpellIds)[keyof typeof SpellIds];

/**
 * The castable (menu-selectable) spell table. Bind actions are authored on their
 * shard in `content/bounds`, not here. Keys are {@link SpellId}s.
 */
export const SPELLS = {
  spark: {
    id: SpellIds.spark,
    name: "Spark",
    element: Elements.flux,
    apCost: 4,
    power: 12,
    target: SpellTargets.one,
  },
  cinder: {
    id: SpellIds.cinder,
    name: "Cinder",
    element: Elements.ash,
    apCost: 5,
    power: 16,
    target: SpellTargets.one,
  },
  render: {
    id: SpellIds.render,
    name: "Render",
    element: Elements.ash,
    apCost: 6,
    power: 8,
    target: SpellTargets.one,
    status: Statuses.rendering,
  },
} as const satisfies Record<string, SpellDef>;

/** A castable spell id (a key present in {@link SPELLS}). */
export type CastableSpellId = keyof typeof SPELLS;
