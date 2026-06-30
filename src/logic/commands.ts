/**
 * The canonical battle-command vocabulary — the player-facing command ids and
 * the per-member command kit shape — defined Phaser-free and content-free so
 * both the content tables (`src/content/party.ts`) and the UI command catalog
 * (`src/ui/commands.ts`) can import it without an import cycle. The UI layer
 * (`ui/commands`) layers the menu labels, costs, and reducer-action wiring on
 * top of these ids; the content layer authors each member's kit as a list of
 * them. No Phaser, no I/O — so the whole vocabulary typechecks under plain `tsc`
 * and is unit-testable headless.
 * @module logic/commands
 */

/**
 * Canonical battle-command ids, in the default menu order. Reference the keyed
 * values rather than inline strings so a typo is a compile error and the order
 * has one source. `augment` is the gadgeteer/support tool slot — a member whose
 * identity is augment-driven (Tobi) surfaces it in place of a caster slot.
 */
export const Commands = {
  strike: "strike",
  craft: "craft",
  bind: "bind",
  augment: "augment",
  item: "item",
  defend: "defend",
} as const;

/**
 * A command id (the literal-union of every {@link Commands} value:
 * `"strike" | "craft" | "bind" | "augment" | "item" | "defend"`).
 */
export type CommandId = (typeof Commands)[keyof typeof Commands];

/**
 * A party member's command kit: the ordered list of commands their battle menu
 * presents. Two members with different kits surface visibly different menus
 * through the same reducer — the data behind "visibly different command kits".
 * Authored per-member in `src/content/party.ts`; consumed by the HUD/controller.
 */
export type CommandKit = readonly CommandId[];

/**
 * Whether a command kit is well-formed: non-empty, every id a defined
 * {@link CommandId}, and no duplicates (a menu never lists the same command
 * twice). Pure and total — the content/UI gates assert it on each member's kit.
 * @param kit - The candidate command kit.
 * @returns True when the kit is non-empty, all-defined, and duplicate-free.
 */
export function isValidKit(kit: CommandKit): boolean {
  if (kit.length === 0) {
    return false;
  }
  const defined = new Set<string>(Object.values(Commands));
  const allDefined = kit.every(id => defined.has(id));
  // A duplicate collapses the Set, so a deduped size below the kit length proves
  // a repeated command without mutating any collection in the loop.
  const noDuplicates = new Set<CommandId>(kit).size === kit.length;
  return allDefined && noDuplicates;
}

/**
 * Whether two command kits are visibly different — they present a different set
 * of commands (not merely a re-ordering). This is the empirical predicate behind
 * the AC "two controllable members with visibly different command kits": Wren's
 * tempo kit and Tobi's gadgeteer/support kit must differ as *sets*, so the player
 * sees genuinely different options, not the same menu shuffled.
 * @param a - The first member's kit.
 * @param b - The second member's kit.
 * @returns True when the two kits differ in their command set.
 */
export function kitsDiffer(a: CommandKit, b: CommandKit): boolean {
  const setA = new Set<CommandId>(a);
  const setB = new Set<CommandId>(b);
  if (setA.size !== setB.size) {
    return true;
  }
  for (const id of setA) {
    if (!setB.has(id)) {
      return true;
    }
  }
  return false;
}
