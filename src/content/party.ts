/**
 * The Phase-1 party (Wren + Tobi) as a typed TS-module table. Levels and base
 * stats are authoritative from the vertical-slice-build. A member's `shard`
 * reference resolves to a defined {@link BoundId}. Pure data — no Phaser.
 * @module content/party
 */
import { type Stats } from "../logic/combat/types";
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
  halcyon: "halcyon",
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
  // Halcyon Mourne, the fallen knight — the FRAME SPECIALIST who defects in the
  // Roots / the Deep "after the requiem reveals the truth" (#146;
  // `wiki/narrative/main-quest.md` Ch.4). Design intent (numbers authored here, the
  // wiki gives identity only): the wiki paints her as "high POW, grist-linked, frame
  // synergy" (`wiki/design/catalog.md`), "heavy grist-hungry power, defense, the
  // party's anvil" (`wiki/narrative/characters.md` / `character-bios.md`), with a
  // hand-authored "frame affinity / frame actives" signature
  // (`wiki/design/progression-and-economy.md`). So her block reads as the ANVIL: the
  // HIGHEST hp + def + pow of the level-3 party and the LOWEST spd (the heavy frame
  // unit), grist-hungry (a healthy ap pool to fund frame actives), low foc (she is no
  // caster) and low lck (cold, grief-locked, not a lucky striker). She is pinned to
  // level 3 to read at the current party tier (matching Wren + Tobi), and — like Tobi
  // — defects shard-less (no starting `shard`); her identity rides her signature
  // frame active, not a Bound. The signature `Frame-Lance` is the frame-lance / heavy
  // arms active her class wields (`wiki/design/catalog.md`).
  halcyon: {
    id: PartyMemberIds.halcyon,
    name: "Halcyon",
    level: 3,
    baseStats: {
      hp: 160,
      ap: 22,
      pow: 22,
      foc: 8,
      def: 16,
      wrd: 11,
      spd: 7,
      lck: 5,
    },
    signatureKit: ["Frame-Lance"],
  },
};
