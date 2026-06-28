/**
 * The battle command menu catalog (combat-spec / ui-ux-and-controls): the five
 * player commands — **Strike / Craft / Bind / Item / Defend** — and the pure
 * mapping from a selected command to the {@link BattleAction} the sim reducer
 * accepts. The HUD renders this catalog and the controller turns a confirmed
 * command into an action; both share this one source so the labels, costs, and
 * action shapes can never drift. Phaser-free and total, so it unit-tests headless.
 * @module ui/commands
 */
import { BindSpellIds, SpellIds, type AnySpellId } from "../content";
import {
  ActionKinds,
  actionCost,
  canAfford,
  type ActionCost,
  type ActionKind,
  type BattleAction,
  type CombatantRef,
} from "../logic/combat";

/**
 * Canonical command ids, in menu order. Reference the keyed values rather than
 * inline strings so a typo is a compile error and the order is one source.
 */
export const Commands = {
  strike: "strike",
  craft: "craft",
  bind: "bind",
  item: "item",
  defend: "defend",
} as const;

/** A command id (`"strike" | "craft" | "bind" | "item" | "defend"`). */
export type CommandId = (typeof Commands)[keyof typeof Commands];

/** The menu order the HUD lays out and the keyboard navigates through. */
export const COMMAND_ORDER: readonly CommandId[] = [
  Commands.strike,
  Commands.craft,
  Commands.bind,
  Commands.item,
  Commands.defend,
];

/**
 * A command's static definition: its menu label, the reducer {@link ActionKind}
 * it issues, and the spell/Bind id it carries (Craft → a castable spell, Bind →
 * a grist-costed summon; the rest carry none).
 */
interface CommandDef {
  readonly label: string;
  readonly kind: ActionKind;
  readonly spellId?: AnySpellId;
}

/** The command table. Craft defaults to Spark, Bind to the Emberwisp summon. */
const COMMANDS: Record<CommandId, CommandDef> = {
  strike: { label: "Strike", kind: ActionKinds.strike },
  craft: { label: "Craft", kind: ActionKinds.craft, spellId: SpellIds.spark },
  bind: {
    label: "Bind",
    kind: ActionKinds.bind,
    spellId: BindSpellIds.bindWisp,
  },
  item: { label: "Item", kind: ActionKinds.item },
  defend: { label: "Defend", kind: ActionKinds.defend },
};

/**
 * The menu label for a command (e.g. `"Strike"`).
 * @param command - The command id.
 * @returns The display label.
 */
export function commandLabel(command: CommandId): string {
  return COMMANDS[command].label;
}

/**
 * The resource cost of a command, priced through the sim's own
 * {@link actionCost} on a cost-only action shape (kind + spell id) so the HUD's
 * displayed price always matches what the reducer will actually debit.
 * @param command - The command id.
 * @returns The AP + grist the command spends.
 */
export function commandCost(command: CommandId): ActionCost {
  const def = COMMANDS[command];
  return actionCost({
    kind: def.kind,
    ...(def.spellId ? { id: def.spellId } : {}),
  });
}

/**
 * Whether a command can be paid given the actor's AP and the shared grist pool —
 * the same {@link canAfford} gate the reducer applies, so the HUD greys out
 * exactly the commands the sim would reject.
 * @param command - The command id.
 * @param actorAp - The acting combatant's current AP.
 * @param grist - The shared party grist pool.
 * @returns True when the command is affordable.
 */
export function commandAffordable(
  command: CommandId,
  actorAp: number,
  grist: number
): boolean {
  return canAfford(actorAp, grist, commandCost(command));
}

/**
 * The short cost suffix the HUD appends to a command label so the price is
 * visible before the player commits ("the spend the world to win? choice must be
 * obvious"): the AP cost for Craft, the grist cost for Bind, empty for free kinds.
 * @param command - The command id.
 * @returns The cost suffix (e.g. `" 4AP"`, `" 8G"`, or `""`).
 */
export function commandCostLabel(command: CommandId): string {
  const cost = commandCost(command);
  if (cost.grist > 0) {
    return ` ${cost.grist}G`;
  }
  if (cost.ap > 0) {
    return ` ${cost.ap}AP`;
  }
  return "";
}

/**
 * Build the {@link BattleAction} a confirmed command issues against an actor and
 * target. Craft/Bind carry their spell id; every kind targets the selected
 * enemy (the reducer ignores the target for non-damaging kinds).
 * @param command - The confirmed command id.
 * @param actor - The acting party member's ref.
 * @param target - The selected enemy's ref.
 * @returns The action to thread through the sim.
 */
export function buildAction(
  command: CommandId,
  actor: CombatantRef,
  target: CombatantRef
): BattleAction {
  const def = COMMANDS[command];
  return {
    kind: def.kind,
    actor,
    target,
    ...(def.spellId ? { id: def.spellId } : {}),
  };
}
