/**
 * Public surface of the game content: the typed spell, enemy, Bound, party, and
 * encounter tables (the combat foundation) plus the vertical-slice content —
 * the bench sinks, the economy earn table, and the 3-room Marrow map (#79).
 * Downstream code (the sim, the Battle scene, the Field scene) imports from
 * here. Re-export only — all data lives in the per-domain modules. Pure data —
 * no Phaser.
 * @module content
 */
export {
  SPELLS,
  SpellIds,
  BindSpellIds,
  type SpellDef,
  type SpellId,
  type BindSpellId,
  type AnySpellId,
} from "./spells";
export { ENEMIES, EnemyIds, type EnemyDef, type EnemyId } from "./enemies";
export {
  BOUNDS,
  BoundIds,
  type BoundDef,
  type BoundId,
  type BoundVariant,
  type BoundVariants,
} from "./bounds";
export {
  PARTY,
  PartyMemberIds,
  type PartyMemberDef,
  type PartyMemberId,
} from "./party";
export {
  ENCOUNTERS,
  EncounterIds,
  Backdrops,
  type EncounterDef,
  type EncounterId,
  type BackdropId,
} from "./encounters";
export {
  BENCH_SINKS,
  BenchSinkIds,
  type BenchSinkDef,
  type BenchSinkId,
} from "./bench";
export {
  SLICE_ECONOMY,
  SLICE_EARN,
  SliceEarnSourceIds,
  type SliceEarnSource,
  type SliceEarnSourceId,
} from "./economy";
export {
  MARROW_MAP,
  MarrowRoomIds,
  type MapProp,
  type MarrowRoomDef,
  type MarrowRoomId,
} from "./map";
