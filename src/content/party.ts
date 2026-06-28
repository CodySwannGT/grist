/**
 * The Phase-1 party (Wren + Tobi) as a typed TS-module table. Levels and base
 * stats are authoritative from the vertical-slice-build. A member's `shard`
 * reference resolves to a defined {@link BoundId}. Pure data — no Phaser.
 * @module content/party
 */
import { type Stats } from "../logic/combat";
import { BoundIds, type BoundId } from "./bounds";

/**
 * A playable party member. `baseStats` is the level-3 starting block; `shard` is
 * the equipped Bound (optional — Tobi starts shard-less); `signatureKit` lists
 * the hand-authored, non-shard actions (e.g. Wren's Flurry, Tobi's Stun-Dart).
 */
export interface PartyMemberDef {
  readonly id: PartyMemberId;
  readonly name: string;
  readonly level: number;
  readonly baseStats: Stats;
  readonly shard?: BoundId;
  readonly signatureKit: readonly string[];
}

/** Canonical party-member ids. */
export const PartyMemberIds = {
  wren: "wren",
  tobi: "tobi",
} as const;

/** A party-member id (the literal-union of every defined party key). */
export type PartyMemberId =
  (typeof PartyMemberIds)[keyof typeof PartyMemberIds];

/**
 * The Phase-1 party. The mapped type binds each entry's `id` to its table key,
 * so the key and the `id` can never drift. Wren starts with the Emberwisp shard
 * (demonstrates AP + grist from room A); Tobi brings the Iron/Stagger Stun-Dart
 * augment active.
 */
export const PARTY: {
  readonly [K in PartyMemberId]: PartyMemberDef & { readonly id: K };
} = {
  wren: {
    id: PartyMemberIds.wren,
    name: "Wren",
    level: 3,
    baseStats: {
      hp: 120,
      ap: 20,
      pow: 18,
      foc: 10,
      def: 10,
      wrd: 8,
      spd: 14,
      lck: 8,
    },
    shard: BoundIds.emberwisp,
    signatureKit: ["Flurry"],
  },
  tobi: {
    id: PartyMemberIds.tobi,
    name: "Tobi",
    level: 3,
    baseStats: {
      hp: 140,
      ap: 24,
      pow: 12,
      foc: 14,
      def: 12,
      wrd: 10,
      spd: 9,
      lck: 6,
    },
    signatureKit: ["Stun-Dart"],
  },
};
