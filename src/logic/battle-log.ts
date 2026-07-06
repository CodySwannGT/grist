/**
 * Pure battle-log derivation: turns the append-only {@link BattleEvent} trail on
 * a {@link BattleState} into the short, human-readable lines the battle HUD shows
 * (PD-3.8 "battle log"). The sim already records every resolved action — actor,
 * target, and the HP delta it dealt — so the log is a *read-only projection* of
 * that trail: it owns no combat rules, allocates nothing the caller can't bound,
 * and is Phaser-free, so it unit-tests headless and the HUD stays a thin renderer.
 *
 * The event trail addresses combatants by {@link CombatantRef} (side + slot), so
 * a line is composed by resolving each ref back to its **display name** — party
 * members and enemies alike — through the typed `src/content` tables the live
 * combatants were built from (#227). This is a pure name-*resolver* over the
 * {@link BattleState}, not new data: the state already carries each combatant's
 * `ref` content id. Two enemies sharing one id (e.g. a pair of scrappers) are
 * disambiguated with a trailing letter (`"Marrow scrapper A"` / `"…B"`) so the
 * log never reads two identical names. A ref with no live combatant behind it —
 * only reachable from a degenerate/headless state — falls back to the terse
 * side-tagged slot label rather than throwing.
 *
 * Internal `tick` events (the ATB-fill heartbeat) are never surfaced — only the
 * combatant *actions* a player would read as a play-by-play. The most recent
 * actions are returned last, capped to a small visible budget so the render path
 * never walks an unbounded log.
 * @module logic/battle-log
 */
import { ENEMIES, PARTY } from "../content";
import {
  ActionKinds,
  BattleSides,
  combatantAt,
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
 * The content-table display name for a combatant content id (a party-member or
 * enemy id), or null when the id names neither. Typed lookups against the
 * authored {@link PARTY} / {@link ENEMIES} tables — no hardcoded name strings, so
 * a renamed member/enemy flows through automatically.
 * @param contentId - The combatant's `ref` content id.
 * @returns The display name, or null when the id is not a known combatant.
 */
function contentName(contentId: string): string | null {
  const party = (
    PARTY as Record<string, { readonly name: string } | undefined>
  )[contentId];
  const enemy = (
    ENEMIES as Record<string, { readonly name: string } | undefined>
  )[contentId];
  return party?.name ?? enemy?.name ?? null;
}

/**
 * A trailing disambiguator (`" A"`, `" B"`, …) for a combatant that shares its
 * content id with at least one sibling on the same side — so a log with two
 * `"Marrow scrapper"`s reads `"Marrow scrapper A"` / `"…B"` instead of two
 * identical names. The letter is the combatant's 1-based ordinal among same-id
 * siblings, in slot order (stable, deterministic). Unique combatants get the
 * empty string, so a lone enemy stays just its name.
 * @param state - The battle state (source of the side's roster).
 * @param ref - The combatant ref being labeled.
 * @param contentId - That combatant's content id.
 * @returns The `" <letter>"` suffix, or the empty string when unambiguous.
 */
function disambiguator(
  state: BattleState,
  ref: CombatantRef,
  contentId: string
): string {
  const side = ref.side === BattleSides.party ? state.party : state.enemies;
  const shareId = side.filter(combatant => combatant.ref === contentId);
  if (shareId.length < 2) {
    return "";
  }
  const ordinal = side
    .slice(0, ref.index + 1)
    .filter(combatant => combatant.ref === contentId).length;
  const letter =
    ordinal >= 1 && ordinal <= 26
      ? String.fromCharCode(64 + ordinal)
      : String(ordinal);
  return ` ${letter}`;
}

/**
 * The display name for a combatant ref: its content-table name (disambiguated
 * when a same-side sibling shares the id), or the terse side-tagged slot label
 * (`"P1"` / `"E1"`) when no live combatant sits behind the ref — the degenerate
 * fallback that keeps this total for headless/empty states.
 * @param state - The battle state to resolve against.
 * @param ref - The combatant ref, or undefined (a kind with no actor/target).
 * @returns The display name, or the empty string when the ref is absent.
 */
function nameForRef(state: BattleState, ref: CombatantRef | undefined): string {
  if (ref === undefined) {
    return "";
  }
  const combatant = combatantAt(state, ref);
  if (combatant === null) {
    return refLabel(ref);
  }
  const base = contentName(combatant.ref) ?? combatant.ref;
  return `${base}${disambiguator(state, ref, combatant.ref)}`;
}

/**
 * Format one resolved action as a single log line: `"<actor> <Verb> <target>"`,
 * with a trailing `" (<n> dmg)"` clause when the hit dealt damage. Actor and
 * target render as display names resolved through {@link nameForRef}; a `tick`
 * event (or any kind with no display verb) formats to the empty string — callers
 * drop those via {@link battleLogLines}.
 * @param event - The resolved battle event.
 * @param state - The battle state the event's refs resolve against.
 * @returns The log line, or the empty string for a non-action event.
 */
export function formatLogEvent(event: BattleEvent, state: BattleState): string {
  const verb = ACTION_VERB[event.kind];
  if (verb === "" || event.kind === ActionKinds.tick) {
    return "";
  }
  const actor = nameForRef(state, event.actor);
  const target = nameForRef(state, event.target);
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
  // Reverse-scan from the tail, formatting only until the visible budget is full,
  // so the work is bounded by `maxLines` rather than the total log length. The
  // collected lines come out newest-first; reverse once for oldest-first
  // top-down rendering. `reduceRight` keeps the accumulation immutable (no array
  // mutation), and short-circuits formatting once the cap is reached.
  const newestFirst = state.log.reduceRight<readonly string[]>((acc, event) => {
    if (acc.length >= BattleLogTuning.maxLines) {
      return acc;
    }
    const line = formatLogEvent(event, state);
    return line === "" ? acc : [...acc, line];
  }, []);
  return [...newestFirst].reverse();
}
