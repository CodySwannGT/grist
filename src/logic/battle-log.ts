/**
 * Pure battle-log derivation: turns the append-only {@link BattleEvent} trail on
 * a {@link BattleState} into the short, human-readable lines the battle HUD shows
 * (PD-3.8 "battle log"). The sim already records every resolved action — actor,
 * target, and the HP delta it dealt — so the log is a *read-only projection* of
 * that trail: it owns no combat rules, allocates nothing the caller can't bound,
 * and is Phaser-free, so it unit-tests headless and the HUD stays a thin renderer.
 *
 * Internal `tick` events (the ATB-fill heartbeat) are never surfaced — only the
 * combatant *actions* a player would read as a play-by-play. The most recent
 * actions are returned last, capped to a small visible budget so the render path
 * never walks an unbounded log.
 * @module logic/battle-log
 */
import {
  ActionKinds,
  BattleSides,
  type ActionKind,
  type BattleEvent,
  type BattleSide,
  type BattleState,
  type CombatantRef,
} from "./combat";

/** Battle-log render tuning. `maxLines` caps the visible (and walked) lines. */
export const BattleLogTuning = {
  /** The most-recent action lines the HUD shows (and the formatter ever walks). */
  maxLines: 4,
} as const;

/** The display verb for each acting kind (the internal `tick` is never shown). */
const ACTION_VERB: Record<ActionKind, string> = {
  tick: "",
  strike: "Strike",
  craft: "Craft",
  bind: "Bind",
  augment: "Augment",
  item: "Item",
  defend: "Defend",
};

/**
 * A short, content-free label for a combatant ref — its side plus 1-based slot
 * (`"P1"` party, `"E1"` enemy). The log reads from the event trail alone (which
 * carries refs, not names), so this stays pure and total without the live
 * combatant arrays; the on-screen HUD pairs it with the richer name row.
 * @param ref - The combatant ref, or undefined (a kind with no actor/target).
 * @returns The slot label, or the empty string when absent.
 */
function refLabel(ref: CombatantRef | undefined): string {
  if (ref === undefined) {
    return "";
  }
  const side: BattleSide = ref.side;
  const tag = side === BattleSides.party ? "P" : "E";
  return `${tag}${ref.index + 1}`;
}

/**
 * Format one resolved action as a single log line: `"<actor> <Verb> <target>"`,
 * with a trailing `" (<n> dmg)"` clause when the hit dealt damage. A `tick` event
 * (or any kind with no display verb) formats to the empty string — callers drop
 * those via {@link battleLogLines}.
 * @param event - The resolved battle event.
 * @returns The log line, or the empty string for a non-action event.
 */
export function formatLogEvent(event: BattleEvent): string {
  const verb = ACTION_VERB[event.kind];
  if (verb === "" || event.kind === ActionKinds.tick) {
    return "";
  }
  const actor = refLabel(event.actor);
  const target = refLabel(event.target);
  const head = actor === "" ? verb : `${actor} ${verb}`;
  const aimed = target === "" ? head : `${head} ${target}`;
  return event.damage !== undefined && event.damage > 0
    ? `${aimed} (${event.damage} dmg)`
    : aimed;
}

/**
 * The visible battle-log lines for the live state: the most-recent *action*
 * events (internal ticks dropped), oldest-to-newest, capped at
 * {@link BattleLogTuning.maxLines}. Pure and bounded — it walks at most the
 * capped tail, never the whole log — so the per-frame HUD render stays cheap.
 * @param state - The live battle state.
 * @returns The log lines to draw, oldest first, newest last.
 */
export function battleLogLines(state: BattleState): readonly string[] {
  // Format every event to its line, drop the non-action (empty) ones, then keep
  // only the most-recent `maxLines` — oldest-first for top-down rendering. The log
  // is itself bounded by the engine, so the walk stays cheap; `slice` caps what
  // the HUD ever draws so the render never grows unboundedly.
  const lines = state.log.map(formatLogEvent).filter(line => line !== "");
  return lines.slice(Math.max(0, lines.length - BattleLogTuning.maxLines));
}
