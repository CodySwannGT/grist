/**
 * Combatant lookup against a {@link BattleState}. Split out from the engine so
 * both the engine and the effect resolver can address combatants by ref without
 * an import cycle. Pure, total, and Phaser-free.
 * @module logic/combat/select
 */
import {
  BattleSides,
  type BattleState,
  type Combatant,
  type CombatantRef,
} from "./types";

/**
 * The combatant a ref points at, or null when the index is out of range.
 * @param state - The battle state.
 * @param ref - The combatant ref.
 * @returns The combatant, or null.
 */
export function combatantAt(
  state: BattleState,
  ref: CombatantRef
): Combatant | null {
  const side = ref.side === BattleSides.party ? state.party : state.enemies;
  return side[ref.index] ?? null;
}
