/**
 * Pure victory/defeat summary model — the terminal beat a *standalone* battle
 * shows when it resolves (sub-task #225). A field-launched battle hands its
 * {@link BattleResult} back to the Field and never shows this; a standalone boot
 * (the `?scene=battle` cold entry) has nowhere to return to, so it presents this
 * summary and, on a deliberate advance, routes to the Title front door instead of
 * dead-ending on a frozen resolved battle.
 *
 * A total function of the already-extracted {@link BattleResult}: the outcome
 * title, a grim-warm flavor line (themes-and-tone: elegiac neon-noir), the cheap
 * facts worth surfacing (grist earned, a recovered Bound shard), and the
 * press-Enter affordance. Zero Phaser, no I/O — the thin {@link
 * import("../ui/battle-summary").BattleSummaryView} renders it, and this model is
 * unit-tested headless.
 * @module logic/battle-summary
 */
import { BattleOutcomes, type BattleResult } from "./battle-result";

/**
 * The rendered terminal-summary model: everything the view needs to paint the
 * win/lose beat, derived purely from the {@link BattleResult}. `stats` is the
 * (possibly empty) list of cheap outcome facts, one per line.
 */
export interface BattleSummaryModel {
  /** The win/lose outcome this summary reports. */
  readonly outcome: BattleResult["outcome"];
  /** Whether the party won (drives the view's color + copy). */
  readonly won: boolean;
  /** The banner title — `"VICTORY"` on a win, `"DEFEAT"` on a loss. */
  readonly title: string;
  /** A short grim-warm flavor line under the title. */
  readonly flavor: string;
  /** Cheap outcome facts, one per rendered line (empty on a loss). */
  readonly stats: readonly string[];
  /** The deliberate-advance affordance shown at the bottom. */
  readonly prompt: string;
}

/** Banner titles for each outcome. */
const VICTORY_TITLE = "VICTORY";
const DEFEAT_TITLE = "DEFEAT";
/**
 * Grim-warm flavor lines (themes-and-tone): the dark yields "for now" on a win;
 * the Marrow takes you on a loss. Minimal by design — the tone doc asks the game
 * to trust stillness over spectacle.
 */
const VICTORY_FLAVOR = "The dark yields — for now.";
const DEFEAT_FLAVOR = "The Marrow takes you.";
/** The deliberate-advance affordance (keyboard + touch, mirroring the Title hint). */
const ADVANCE_PROMPT = "Press Enter · tap to continue";

/**
 * Build the terminal victory/defeat summary from a resolved battle's result. On a
 * win it surfaces the grist earned and, when the encounter dropped one, that a
 * Bound shard was recovered; on a loss it surfaces nothing (the run yielded
 * nothing) and leans on the defeat flavor. Pure — a total function of `result`.
 * @param result - The consumed {@link BattleResult} of the resolved battle.
 * @returns The rendered summary model.
 */
export function battleSummary(result: BattleResult): BattleSummaryModel {
  const won = result.outcome === BattleOutcomes.win;
  // A loss yields nothing to surface; a win shows the grist earned and, when the
  // encounter dropped one, that a Bound shard was recovered.
  const stats: readonly string[] = won
    ? [
        `Grist earned   ${result.gristGained}`,
        ...(result.shard !== null ? ["Bound shard recovered"] : []),
      ]
    : [];
  return {
    outcome: result.outcome,
    won,
    title: won ? VICTORY_TITLE : DEFEAT_TITLE,
    flavor: won ? VICTORY_FLAVOR : DEFEAT_FLAVOR,
    stats,
    prompt: ADVANCE_PROMPT,
  };
}
