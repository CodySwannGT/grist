/**
 * Bound (shard) definitions as a typed TS-module table, authored to the
 * combat-spec Bound-kit template: element/domain, the grist-costed Bind summon,
 * the spells it teaches, its growth bias, and its wield corruption rate. `teaches`
 * and the inline Bind reference only defined spell ids. Pure data — no Phaser.
 * @module content/bounds
 */
import {
  Elements,
  SpellTargets,
  type ElementId,
  type Stats,
} from "../logic/combat/types";
import { BindSpellIds, SpellIds, type SpellDef, type SpellId } from "./spells";

/**
 * The two ways a shard can be carried (#79). A **Free** shard is the safe,
 * accrual-free attunement Wren starts with; a **Wield** shard trades raw power
 * for per-use corruption. Each variant carries its own corruption rate so the
 * bench/equip layer can offer both modes for the same shard.
 */
export interface BoundVariant {
  /** The per-use corruption accrued in this mode (0 for a Free attunement). */
  readonly corruptionRate: number;
}

/** A shard's free/wield variant pair. */
export interface BoundVariants {
  readonly free: BoundVariant;
  readonly wield: BoundVariant;
}

/**
 * A Bound/shard definition. `bind` is the grist-costed AoE summon action;
 * `teaches` lists the castable spells the shard grants over time; `growthBias`
 * weights stat growth while equipped; `corruptionRate` is the per-use corruption
 * accrued in Wield mode (0 for a Free starter shard) — retained as the headline
 * (Wield) rate. `variants` exposes the explicit Free vs. Wield corruption pair
 * (#79); for a Free-only starter both variants are 0.
 */
export interface BoundDef {
  readonly id: BoundId;
  readonly name: string;
  readonly element: ElementId;
  readonly bind: SpellDef;
  readonly teaches: readonly SpellId[];
  readonly growthBias: Partial<Stats>;
  readonly corruptionRate: number;
  readonly variants: BoundVariants;
}

/** Canonical Bound ids. */
export const BoundIds = {
  emberwisp: "emberwisp",
  marrowBound: "marrow-bound",
} as const;

/** A Bound id (the literal-union of every defined shard key). */
export type BoundId = (typeof BoundIds)[keyof typeof BoundIds];

/**
 * The slice shard table. The mapped type binds each entry's `id` to its table
 * key, so the key and the `id` can never drift. Emberwisp is Wren's Free starter
 * (no corruption); the Marrow Bound is the Ashling's reward shard.
 */
export const BOUNDS: {
  readonly [K in BoundId]: BoundDef & { readonly id: K };
} = {
  emberwisp: {
    id: BoundIds.emberwisp,
    name: "Emberwisp",
    element: Elements.flux,
    bind: {
      id: BindSpellIds.bindWisp,
      name: "Bind: Wisp",
      element: Elements.flux,
      apCost: 0,
      gristCost: 8,
      power: 10,
      target: SpellTargets.all,
    },
    teaches: [SpellIds.spark],
    growthBias: { spd: 2 },
    corruptionRate: 0,
    variants: { free: { corruptionRate: 0 }, wield: { corruptionRate: 0 } },
  },
  "marrow-bound": {
    id: BoundIds.marrowBound,
    name: "The Marrow Bound",
    element: Elements.ash,
    bind: {
      id: BindSpellIds.bindMarrow,
      name: "Bind: Marrow",
      element: Elements.ash,
      apCost: 0,
      gristCost: 10,
      power: 14,
      target: SpellTargets.all,
    },
    teaches: [SpellIds.cinder, SpellIds.render],
    growthBias: { foc: 2 },
    corruptionRate: 0.1,
    variants: { free: { corruptionRate: 0 }, wield: { corruptionRate: 0.1 } },
  },
};
