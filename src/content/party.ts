/**
 * The Phase-1 party (Wren + Tobi) as a typed TS-module table. Levels and base
 * stats are authoritative from the vertical-slice-build. A member's `shard`
 * reference resolves to a defined {@link BoundId}. Pure data — no Phaser.
 * @module content/party
 */
import { Commands, type CommandKit } from "../logic/commands";
import { type Stats } from "../logic/combat/types";
import { BoundIds, type BoundId } from "./bounds";

/**
 * A playable party member. `baseStats` is the level-3 starting block; `shard` is
 * the equipped Bound (optional — Tobi starts shard-less); `signatureKit` lists
 * the hand-authored, non-shard actions (e.g. Wren's Flurry, Tobi's Stun-Dart);
 * `kit` is the ordered battle-command menu the member surfaces — the data behind
 * "visibly different command kits" (#110): Wren reads as the caster/tempo unit
 * (Strike + Craft + Bind), Tobi as the gadgeteer/support unit (Strike + Augment
 * + Item + Defend), so the two members present genuinely different menus through
 * the one unchanged ATB reducer.
 */
export interface PartyMemberDef {
  readonly id: PartyMemberId;
  readonly name: string;
  readonly level: number;
  readonly baseStats: Stats;
  readonly shard?: BoundId;
  readonly signatureKit: readonly string[];
  readonly kit: CommandKit;
}

/** Canonical party-member ids. */
export const PartyMemberIds = {
  wren: "wren",
  tobi: "tobi",
  halcyon: "halcyon",
  // The Act II secondary roster (#140) — the scattered companions the player
  // reassembles through the open, nonlinear reunion quests
  // (`wiki/narrative/main-quest.md` Ch.7, `wiki/narrative/characters.md`).
  quietus: "quietus",
  asch: "asch",
  cal: "cal",
  shrike: "shrike",
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
    // Tempo/caster kit: Wren wields a Bound (Emberwisp), so her menu carries the
    // full caster loadout — Craft (cast) + Bind (summon) — alongside the
    // Strike / Item / Defend baseline. Her menu is the established protagonist
    // menu; Tobi's gadgeteer kit (below) is the differentiator (#110).
    kit: [
      Commands.strike,
      Commands.craft,
      Commands.bind,
      Commands.item,
      Commands.defend,
    ],
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
    // Gadgeteer/support kit: Tobi is shard-less and no caster — his identity is
    // augment-driven tools + items, NOT Craft/Bind. The Augment + Item slots in
    // place of Wren's Craft/Bind are what make the two menus *visibly different*
    // (#110), routed through the same unchanged reducer (augment/item spend a
    // turn the engine already accepts).
    kit: [Commands.strike, Commands.augment, Commands.item, Commands.defend],
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
    // Frame/anvil kit: Halcyon's heavy frame actives ride the Augment slot, with
    // the Strike/Defend baseline — a third distinct menu (no Craft, no Bind).
    kit: [Commands.strike, Commands.augment, Commands.defend],
  },
  // Quietus ("Q") — the ghost in the machine, the consciousness assembled from the
  // rendered dead who "wields the stored power of the souls it's made of"
  // (`wiki/narrative/characters.md`; the tragic esper / the summon that is also a
  // soul). Numbers are authored here (the wiki gives identity only, a living doc,
  // decision 0003); Q reads as the ESPER-CASTER: the party's highest FOC + WRD and
  // the biggest AP pool (it channels the anima it is made of), with the lowest DEF
  // (incorporeal — projected through screens and drones), no starting shard (its
  // power is the souls, not a Bound), and a hand-authored "Soul-Chorus" signature.
  quietus: {
    id: PartyMemberIds.quietus,
    name: "Quietus",
    level: 3,
    baseStats: {
      hp: 130,
      ap: 30,
      pow: 10,
      foc: 22,
      def: 8,
      wrd: 18,
      spd: 12,
      lck: 9,
    },
    signatureKit: ["Soul-Chorus"],
    // Esper/caster kit: Q surfaces the full caster loadout — Craft (cast) + Bind
    // (summon the stored souls) — with the Strike/Defend baseline; no augment/item
    // (its tools are the anima it wields, not gadgets).
    kit: [Commands.strike, Commands.craft, Commands.bind, Commands.defend],
  },
  // Brother Asch — the bare-handed monk of an Ashfast enclave that has "renounced
  // grist entirely … proof a life without the fuel is possible"
  // (`wiki/narrative/characters.md`; the Sabin). Authored as the MARTIAL striker:
  // high POW + SPD + HP but the LOWEST AP of the roster (he renounced grist, so he
  // funds no grist-fueled actives), low FOC/WRD (no caster), no starting shard, and
  // a hand-authored "Ashfast-Kata" signature.
  asch: {
    id: PartyMemberIds.asch,
    name: "Brother Asch",
    level: 3,
    baseStats: {
      hp: 150,
      ap: 8,
      pow: 20,
      foc: 6,
      def: 14,
      wrd: 9,
      spd: 16,
      lck: 7,
    },
    signatureKit: ["Ashfast-Kata"],
    // Monk kit: bare hands, no grist tools — Strike + Item + Defend only (no Craft,
    // no Bind, no Augment), the data behind "a life without the fuel".
    kit: [Commands.strike, Commands.item, Commands.defend],
  },
  // Calliope "Cal" Quill — the gambler, pilot, and House Quill's disowned heir who
  // "bets on the long odds of saving the world" (`wiki/narrative/characters.md`; the
  // Setzer). Authored as the LUCK unit: the party's highest LCK, high SPD, and an
  // otherwise balanced block, no starting shard, and a hand-authored "Long-Odds"
  // signature (the gambler's wild-draw active).
  cal: {
    id: PartyMemberIds.cal,
    name: "Calliope Quill",
    level: 3,
    baseStats: {
      hp: 118,
      ap: 18,
      pow: 15,
      foc: 12,
      def: 9,
      wrd: 8,
      spd: 15,
      lck: 16,
    },
    signatureKit: ["Long-Odds"],
    // Gambler kit: Craft (her wild-draw gambles) + Item, with the Strike/Defend
    // baseline — a distinct menu from the monk and the assassin.
    kit: [Commands.strike, Commands.craft, Commands.item, Commands.defend],
  },
  // The Shrike — "an assassin who works for whoever pays, traveling with a single
  // loyal hound; loyalties hidden until they aren't … a blade the party never quite
  // trusts" (`wiki/narrative/characters.md`; the Shadow). Authored as the GLASS
  // striker: the party's highest SPD, high POW + LCK, but the lowest HP + DEF/WRD
  // (evasive, not durable), no starting shard, and a hand-authored "Killstroke"
  // signature.
  shrike: {
    id: PartyMemberIds.shrike,
    name: "The Shrike",
    level: 3,
    baseStats: {
      hp: 110,
      ap: 16,
      pow: 19,
      foc: 9,
      def: 7,
      wrd: 7,
      spd: 18,
      lck: 14,
    },
    signatureKit: ["Killstroke"],
    // Assassin kit: Augment (the blade's tools) + the Strike/Defend baseline — no
    // caster slots; a fourth distinct menu.
    kit: [Commands.strike, Commands.augment, Commands.defend],
  },
};
