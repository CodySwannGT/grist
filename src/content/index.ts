/**
 * Public surface of the Phase-1 combat content: the typed spell, enemy, Bound,
 * party, and encounter tables plus their id maps and schema types. Downstream
 * code (the sim, the Battle scene) imports the foundation from here. Re-export
 * only — all data lives in the per-domain modules. Pure data — no Phaser.
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
export { BOUNDS, BoundIds, type BoundDef, type BoundId } from "./bounds";
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
