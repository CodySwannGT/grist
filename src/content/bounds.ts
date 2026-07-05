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
  velithDeepbound: "velith-deepbound",
  sylvath: "sylvath",
  korrholt: "korrholt",
  morrath: "morrath",
  threnos: "threnos",
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
  // The Roots/Deep Bound DATA REFERENCE per #143: Velith, the Deep-bound — the
  // ancient, "near-free" power that remembers the Choir, sited in the buried ruins
  // beneath the corpse (wiki/design/regions.md, bestiary.md). Element `flux` (the
  // wild pooled Weave of the Deep). #143 shipped this as a MINIMAL data-only
  // reference (a zero Wield rate placeholder) so the Roots region could `site` it;
  // #144 tunes the free-vs-wield interaction itself. "Near-free" is the *gentlest*
  // carry of any Bound — its Wield corruption is the LOWEST in the table (half the
  // Marrow Bound's 0.1) — but NOT zero: a power this old is almost, not entirely,
  // beyond the Reckoning's leash, and the franchise's moral fork (bestiary.md:
  // "wielding = accruing corruption") only holds if wielding Velith actually
  // accrues some. A zero Wield rate would make "free" and "wield" indistinguishable,
  // contradicting PRD #43 AC7. Free remains corruption-free (the safe attunement).
  // Combat stat tuning beyond the corruption rate stays deferred (decision 0003).
  "velith-deepbound": {
    id: BoundIds.velithDeepbound,
    name: "Velith, the Deep-bound",
    element: Elements.flux,
    bind: {
      id: BindSpellIds.bindDeep,
      name: "Bind: Deep",
      element: Elements.flux,
      apCost: 0,
      gristCost: 12,
      power: 16,
      target: SpellTargets.all,
    },
    teaches: [SpellIds.spark],
    growthBias: { foc: 2, spd: 1 },
    corruptionRate: 0.05,
    variants: { free: { corruptionRate: 0 }, wield: { corruptionRate: 0.05 } },
  },
  // The Sylvemarch Bound DATA REFERENCE per #129: Sylvath, the Green Wyrm — the
  // great caged wyrm at the heart of the surviving forest, the one Bound of the
  // Sidhe enclave (wiki/design/regions.md — Sylvemarch; wiki/design/bestiary.md —
  // Sylvath, the Green Wyrm). Element `bloom` (the living Weave of the Green
  // Mother's march). Unlike Velith the "near-free" Deep-bound, Sylvath is a MAJOR
  // free-vs-wield decision (a great power caged, not an ancient one almost beyond
  // the leash): its Wield corruption is the HEAVIEST authored Bound to date —
  // strictly above the Marrow Bound's 0.1 — so wielding the Green Wyrm accrues the
  // starkest cost while freeing it stays corruption-free (the safe attunement).
  // This is a MINIMAL, data-only reference so the Sylvemarch region can `site` it
  // via `boundSite`; the free-vs-wield resolution reuses the shipped Bound-site
  // template (#135) + Phase-2 kit (#69) verbatim. Combat stat tuning beyond the
  // corruption rate stays deferred (decision 0003).
  sylvath: {
    id: BoundIds.sylvath,
    name: "Sylvath, the Green Wyrm",
    element: Elements.bloom,
    bind: {
      id: BindSpellIds.bindBloom,
      name: "Bind: Bloom",
      element: Elements.bloom,
      apCost: 0,
      gristCost: 14,
      power: 18,
      target: SpellTargets.all,
    },
    teaches: [SpellIds.spark],
    growthBias: { wrd: 2, foc: 1 },
    corruptionRate: 0.14,
    variants: { free: { corruptionRate: 0 }, wield: { corruptionRate: 0.14 } },
  },
  // The Holtspire Bound DATA REFERENCE per #130: Korrholt, the Anvil-Heart — the
  // one Bound of the Anvil-city, harnessed OPENLY as a city reactor by House
  // Caldecott (wiki/design/regions.md — Holtspire, the Anvil-city; wiki/design/
  // bestiary.md — "Korrholt, the Anvil-Heart … harnessed openly as a city reactor —
  // the atrocity industrialized"). Element `iron` (the frame-and-foundry power of
  // the industrial city-state; Iron is the soft-opposite of Bloom). Where Sylvath
  // caged the atrocity in a great wyrm, Korrholt INDUSTRIALIZES it — the reactor
  // runs in the open, so the free-vs-wield choice is at its STARKEST: freeing it
  // banks the city's reactor (karma+, corruption-free), while wielding it draws on
  // the atrocity as raw power at the HEAVIEST authored cost to date — strictly above
  // Sylvath's — the naked "wield = accrue corruption" fork PRD #43 AC7 hangs on.
  // This is a MINIMAL, data-only reference so the Holtspire region can `site` it via
  // `boundSite`; the free-vs-wield resolution reuses the shipped Bound-site template
  // (#135) + Phase-2 kit (#69) verbatim. Combat stat tuning beyond the corruption
  // rate stays deferred (decision 0003).
  korrholt: {
    id: BoundIds.korrholt,
    name: "Korrholt, the Anvil-Heart",
    element: Elements.iron,
    bind: {
      id: BindSpellIds.bindIron,
      name: "Bind: Iron",
      element: Elements.iron,
      apCost: 0,
      gristCost: 16,
      power: 20,
      target: SpellTargets.all,
    },
    teaches: [SpellIds.spark],
    growthBias: { def: 2, wrd: 1 },
    corruptionRate: 0.16,
    variants: { free: { corruptionRate: 0 }, wield: { corruptionRate: 0.16 } },
  },
  // The Cinderfen Bound DATA REFERENCE per #131: Morrath, the Cinder-bound — the one
  // Bound of the ashlands (wiki/design/regions.md — the Cinderfen, the ashlands;
  // wiki/design/bestiary.md — "Morrath, the Cinder-bound"). Element `ash` (the
  // ash/gloom power of the strip-mined, magic-dead wastes — the Cinderfen is the one
  // region that reads Ash/Gloom, the ash primary distinct from the Wrack's Gloom).
  // Where Korrholt is the atrocity INDUSTRIALIZED (harnessed openly), Morrath is the
  // atrocity DYING — a half-rendered power guttering out amid the dead refineries, a
  // moral gut-punch more than a fight: the free choice is a MERCY (let the dying
  // Bound go — karma+, corruption-free), while wielding it is desecration — draining
  // a dying god for raw power at a heavy cost that still sits below Korrholt's
  // openly-run reactor (Korrholt remains the heaviest authored Bound). This is a
  // MINIMAL, data-only reference so the Cinderfen region can `site` it via
  // `boundSite`; the free-vs-wield resolution reuses the shipped Bound-site template
  // (#135) + Phase-2 kit (#69) verbatim. Combat stat tuning beyond the corruption
  // rate stays deferred (decision 0003).
  morrath: {
    id: BoundIds.morrath,
    name: "Morrath, the Cinder-bound",
    element: Elements.ash,
    bind: {
      id: BindSpellIds.bindAsh,
      name: "Bind: Ash",
      element: Elements.ash,
      apCost: 0,
      gristCost: 15,
      power: 19,
      target: SpellTargets.all,
    },
    teaches: [SpellIds.cinder],
    growthBias: { foc: 2, wrd: 1 },
    corruptionRate: 0.15,
    variants: { free: { corruptionRate: 0 }, wield: { corruptionRate: 0.15 } },
  },
  // The Wrack Bound DATA REFERENCE per #132: Threnos, the Unmade — the one Bound of
  // the Sundering coast (wiki/design/regions.md — the Wrack, the Sundering coast;
  // wiki/design/bestiary.md — "Threnos, the Unmade … entropy-touched; alien;
  // foreshadows the finale"). Element `gloom` — the void-black entropy power of the
  // Sundering's rawest wound; the most ALIEN affinity on the roster and the one that
  // reads as pure un-writing (per wiki/design/combat.md's Gloom + the art-direction's
  // void-black identity). Threnos is the finale foreshadow, so its free-vs-wield fork
  // is the STARKEST authored: freeing it is quieting the wound the oblivion-cult
  // courts (karma+, corruption-free — the mercy that refuses the end), while wielding
  // it draws raw entropy at the HEAVIEST authored cost to date — strictly above
  // Korrholt's openly-run reactor, because carrying the Unmade is carrying a piece of
  // the end itself. It teaches `unmake` (Gloom), its OWN element, not a borrowed one.
  // This is a MINIMAL, data-only reference so the Wrack region can `site` it via
  // `boundSite`; the free-vs-wield resolution reuses the shipped Bound-site template
  // (#135) + Phase-2 kit (#69) verbatim. Combat stat tuning beyond the corruption
  // rate stays deferred (decision 0003).
  threnos: {
    id: BoundIds.threnos,
    name: "Threnos, the Unmade",
    element: Elements.gloom,
    bind: {
      id: BindSpellIds.bindGloom,
      name: "Bind: Gloom",
      element: Elements.gloom,
      apCost: 0,
      gristCost: 18,
      power: 22,
      target: SpellTargets.all,
    },
    teaches: [SpellIds.unmake],
    growthBias: { foc: 2, spd: 1 },
    corruptionRate: 0.18,
    variants: { free: { corruptionRate: 0 }, wield: { corruptionRate: 0.18 } },
  },
};
