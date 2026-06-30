/**
 * The battle command menu catalog (combat-spec / ui-ux-and-controls): the
 * player commands — **Strike / Craft / Bind / Augment / Item / Defend** — and
 * the pure mapping from a selected command to the {@link BattleAction} the sim
 * reducer accepts. Each party member surfaces only their authored *kit* of these
 * commands ({@link commandOrderFor}), so two controllable members present
 * visibly different menus (#110) through the one unchanged reducer. The HUD
 * renders the active member's kit and the controller turns a confirmed command
 * into an action; both share this one source so the labels, costs, and action
 * shapes can never drift. Phaser-free and total, so it unit-tests headless.
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
import { Commands, type CommandId, type CommandKit } from "../logic/commands";

// The canonical command vocabulary lives in the content-free, Phaser-free
// `logic/commands` module so the content tables can author per-member kits
// without an import cycle into this UI module. Re-export it here so the existing
// `ui/commands` import surface (Commands / CommandId) is unchanged for callers.
// `CommandKit` is consumed from `logic/commands` directly (e.g. `content/party`),
// so it is intentionally not re-exported here.
export { Commands, type CommandId };

/**
 * The full menu order the HUD lays out by default when no member kit narrows it
 * (every command, in canonical order). Per-member menus are derived from a
 * member's {@link CommandKit} via {@link commandOrderFor}.
 */
export const COMMAND_ORDER: readonly CommandId[] = [
  Commands.strike,
  Commands.craft,
  Commands.bind,
  Commands.augment,
  Commands.item,
  Commands.defend,
];

/**
 * The command order to lay out for the active party member: the member's own
 * {@link CommandKit} (e.g. Wren's Strike/Craft/Bind/Defend vs Tobi's
 * Strike/Augment/Item/Defend), filtered to the catalog so an unknown id can
 * never reach the menu. Falls back to the full {@link COMMAND_ORDER} when no kit
 * is supplied (no member ready). Pure and allocation-light — call it on a turn
 * boundary (when the active actor changes), never per frame.
 * @param kit - The active member's command kit, or undefined when none is ready.
 * @returns The command ids to render, in the member's authored order.
 */
export function commandOrderFor(
  kit: CommandKit | undefined
): readonly CommandId[] {
  if (kit === undefined || kit.length === 0) {
    return COMMAND_ORDER;
  }
  return kit.filter(id => id in COMMANDS);
}

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

/**
 * The command table. Craft defaults to Spark, Bind to the Emberwisp summon.
 * Augment is the gadgeteer/support tool slot (Tobi's identity): a free,
 * non-spell action that issues the reducer's already-accepted `augment` kind.
 */
const COMMANDS: Record<CommandId, CommandDef> = {
  strike: { label: "Strike", kind: ActionKinds.strike },
  craft: { label: "Craft", kind: ActionKinds.craft, spellId: SpellIds.spark },
  bind: {
    label: "Bind",
    kind: ActionKinds.bind,
    spellId: BindSpellIds.bindWisp,
  },
  augment: { label: "Augment", kind: ActionKinds.augment },
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
