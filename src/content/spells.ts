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

/** Canonical ids for the castable (menu-selectable) spells in {@link SPELLS}. */
export const SpellIds = {
  spark: "spark",
  cinder: "cinder",
  render: "render",
} as const;

/** A castable spell id (the literal-union of every {@link SPELLS} key). */
export type SpellId = (typeof SpellIds)[keyof typeof SpellIds];

/**
 * Canonical ids for the grist-costed Bind summon actions. Binds live inline on
 * their shard (`BoundDef.bind`) rather than in {@link SPELLS}, so their ids carry
 * a dedicated typed source.
 */
export const BindSpellIds = {
  bindWisp: "bind-wisp",
  bindMarrow: "bind-marrow",
} as const;

/** A Bind action id. */
export type BindSpellId = (typeof BindSpellIds)[keyof typeof BindSpellIds];

/** Any defined spell id — a castable spell or a Bind action. */
export type AnySpellId = SpellId | BindSpellId;

/**
 * A spell/skill definition. `apCost` spends the Anima pool; `gristCost` (when
 * present) spends the shared grist wallet — only the strongest actions (Bind,
 * top-tier Render, revive) cost grist. `status`, when present, is applied on hit.
 * `id` is a defined spell id (castable or Bind), never an arbitrary string.
 */
export interface SpellDef {
  readonly id: AnySpellId;
  readonly name: string;
  readonly element: ElementId;
  readonly apCost: number;
  readonly gristCost?: number;
  readonly power: number;
  readonly target: SpellTarget;
  readonly status?: StatusId;
}

/**
 * The castable (menu-selectable) spell table. Bind actions are authored on their
 * shard in `content/bounds`, not here. The mapped type binds each entry's `id`
 * to its table key, so the key and the `id` can never drift.
 */
export const SPELLS: {
  readonly [K in SpellId]: SpellDef & { readonly id: K };
} = {
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
};
