/**
 * First-battle onboarding — the pure, Phaser-free hint state machine and the
 * one-time "seen" ledger (#228). The first fight a new player reaches is the
 * de-facto tutorial, but it teaches nothing: no controls legend, no gloss on
 * `Strike` / `Craft 4AP` / `Bind 8G`, no hint that the speed widget toggles. This
 * module supplies the *rules* for a handful of short, contextual hint beats that
 * surface at the right moments (the fight opening, the first command menu, the
 * first time a resource-spending command is highlighted, the first enemy
 * telegraph) — and a persisted flag so the beats show **once per save** and never
 * again.
 *
 * Two pure concerns, both unit-tested headless:
 *
 * - **The hint machine.** {@link advanceOnboarding} is a total function of the
 *   current {@link BattleOnboardingState} (which beats have shown) and a live
 *   {@link BattleHintSignal} snapshot; it returns the next state and at most one
 *   hint to surface this frame, in a fixed priority order, each beat firing exactly
 *   once. The thin {@link import("../ui/battle-hint").BattleHintView} paints it.
 * - **The "seen" ledger.** {@link hasSeenBattleOnboarding} /
 *   {@link markBattleOnboardingSeen} read and fold a single boolean into the
 *   existing {@link SaveDataV3} `scene.flags` ledger (no save-version bump — the
 *   flag record is open, the way the Reckoning and reunion beats write their own
 *   flags), so the beats never replay after a save/reload.
 *
 * The copy quotes the **real** key bindings (`services/input-map`): the arrows
 * navigate, Enter confirms, Esc cancels, and **Shift** — not Tab — cycles battle
 * speed. Grim-warm, terse (the HUD is 384×216): seasoning, not a tutorial mode.
 * @module logic/battle-onboarding
 */
import type { CurrentSave } from "./save";

/** The stable ids of the first-battle hint beats (the only place they live). */
export const BattleHintIds = {
  /** The fight opens: how to change the "SPD NORMAL" speed widget. */
  speed: "speed",
  /** The command menu first opens: how to navigate and confirm. */
  controls: "controls",
  /** A resource-spending command (Craft / Bind) is first highlighted: AP vs Grist. */
  resources: "resources",
  /** An enemy first telegraphs its wind-up: what the `!` warning means. */
  telegraph: "telegraph",
} as const;

/** One first-battle hint id. */
export type BattleHintId = (typeof BattleHintIds)[keyof typeof BattleHintIds];

/**
 * The copy for each hint beat, keyed by id — the closest analog to the #115
 * {@link import("./audio").CUE_CAPTIONS} catalog: an id enum plus a `Record` of
 * text. Grim-warm and terse, and it quotes the real bindings (Shift toggles speed,
 * the arrows/Enter/Esc scheme) so a beat can never drift from what the keys do.
 */
export const BATTLE_HINT_TEXT: Record<BattleHintId, string> = {
  speed: "Shift shifts the pace — Wait, Normal, Fast",
  controls: "Arrows choose · Enter commits · Esc cancels",
  resources: "Craft burns AP · Bind spends Grist (G)",
  telegraph: "!  it winds up — Defend, or strike first",
} as const;

/**
 * The command ids whose highlight surfaces the AP-vs-Grist resource beat — the
 * two commands that actually spend a resource the player must reason about
 * (Craft burns AP, Bind spends Grist). Matched by the plain command-id string so
 * this pure module takes no import edge on the UI command catalog.
 */
const RESOURCE_COMMAND_IDS: ReadonlySet<string> = new Set(["craft", "bind"]);

/**
 * The live per-frame snapshot the hint machine reads: whether a party actor's
 * command menu is open, which command id (if any) is highlighted, and whether an
 * enemy is currently telegraphing a wind-up. Every field is a plain primitive the
 * Battle scene lifts from the HUD/controller, so the machine stays Phaser-free.
 */
export interface BattleHintSignal {
  /** Whether a ready actor's command menu is open. */
  readonly menuOpen: boolean;
  /** The highlighted command id while the menu is open, else null. */
  readonly highlightedCommand: string | null;
  /** Whether a living enemy is charged past its telegraph threshold. */
  readonly telegraphPresent: boolean;
}

/** One surfaced hint beat: its id and the copy the view flashes. */
interface BattleHint {
  readonly id: BattleHintId;
  readonly text: string;
}

/** The live progress of the hint machine: the beats already shown this battle. */
export interface BattleOnboardingState {
  /** The hint beats surfaced so far, in the order they fired. */
  readonly shown: readonly BattleHintId[];
}

/**
 * The onboarding snapshot the verification bridge surfaces (#228): whether the
 * hint machine is running this battle, the beat currently on screen, and the beats
 * shown so far. Lets an e2e prove the beats surface on a fresh opted-in run and —
 * reading `enabled: false` — that a plain bridge-driven battle shows none.
 */
export interface BattleOnboardingSnapshot {
  /** Whether the hint machine is active this battle (eligible + not yet seen). */
  readonly enabled: boolean;
  /** The hint copy currently on screen, or null when none is showing. */
  readonly active: string | null;
  /** The ids of the beats surfaced so far, in the order they fired. */
  readonly shown: readonly string[];
}

/** The result of one {@link advanceOnboarding} step: the next state + a beat, if any. */
interface BattleOnboardingStep {
  /** The next machine state (a beat appended when one fired). */
  readonly state: BattleOnboardingState;
  /** The beat to surface this frame, or null when none fired. */
  readonly hint: BattleHint | null;
}

/**
 * The fixed priority order the beats fire in — the natural sequence of a first
 * fight: the speed widget (the moment the fight opens), the command controls (the
 * first time the menu opens), the AP-vs-Grist gloss (the first time a spending
 * command is highlighted), and the telegraph (the first enemy wind-up).
 */
const HINT_ORDER: readonly BattleHintId[] = [
  BattleHintIds.speed,
  BattleHintIds.controls,
  BattleHintIds.resources,
  BattleHintIds.telegraph,
];

/**
 * Whether a beat's trigger condition is met for the current signal. The speed
 * beat fires as soon as the fight is underway (the machine's first step); the rest
 * wait for their contextual moment.
 * @param id - The hint beat to test.
 * @param signal - The live per-frame signal.
 * @returns True when the beat may fire now.
 */
function triggered(id: BattleHintId, signal: BattleHintSignal): boolean {
  switch (id) {
    case BattleHintIds.speed:
      return true;
    case BattleHintIds.controls:
      return signal.menuOpen;
    case BattleHintIds.resources:
      return (
        signal.menuOpen &&
        signal.highlightedCommand !== null &&
        RESOURCE_COMMAND_IDS.has(signal.highlightedCommand)
      );
    case BattleHintIds.telegraph:
      return signal.telegraphPresent;
  }
}

/**
 * The initial machine state: no beat has shown yet.
 * @returns A fresh onboarding state.
 */
export function newBattleOnboardingState(): BattleOnboardingState {
  return { shown: [] };
}

/**
 * Advance the hint machine one frame: surface the highest-priority beat that has
 * not yet shown and whose trigger is met, at most one per call so the beats never
 * stampede. A beat, once shown, is recorded and never fires again. Pure and total —
 * the same `(state, signal)` always yields the same step.
 * @param state - The current machine state (never mutated).
 * @param signal - The live per-frame signal.
 * @returns The next state and the beat to surface, or null when none fired.
 */
export function advanceOnboarding(
  state: BattleOnboardingState,
  signal: BattleHintSignal
): BattleOnboardingStep {
  const next = HINT_ORDER.find(
    id => !state.shown.includes(id) && triggered(id, signal)
  );
  if (next === undefined) {
    return { state, hint: null };
  }
  return {
    state: { shown: [...state.shown, next] },
    hint: { id: next, text: BATTLE_HINT_TEXT[next] },
  };
}

/**
 * Whether every beat has now shown — the machine has nothing left to surface.
 * @param state - The current machine state.
 * @returns True once all beats have fired.
 */
export function onboardingComplete(state: BattleOnboardingState): boolean {
  return state.shown.length === HINT_ORDER.length;
}

/**
 * The `scene.flags` key the one-time "seen" ledger writes. A plain boolean flag in
 * the existing {@link SaveDataV3} ledger — no dedicated save field, no version bump.
 */
export const BATTLE_ONBOARDING_FLAG = "battleOnboardingSeen";

/**
 * Whether this save has already shown the first-battle beats. Reads the single
 * boolean from the `scene.flags` ledger; a fresh save (null scene, or the flag
 * absent) has not seen them.
 * @param save - The save to read.
 * @returns True when the beats have already been shown for this save.
 */
export function hasSeenBattleOnboarding(save: CurrentSave): boolean {
  return save.scene?.flags?.[BATTLE_ONBOARDING_FLAG] === true;
}

/**
 * Fold the "seen" flag into a save, returning the next save with the beats marked
 * shown. Merges over the existing `scene.flags` (never replacing them) and
 * preserves the narrative cursor when one exists — mirroring how
 * {@link import("./save/scene-progress").foldSceneProgress} folds a beat's flags.
 * A save that has not yet entered a scene (`scene` is null) gains a minimal,
 * cursor-less scene carrying only this flag. Mutates nothing.
 * @param save - The save to fold into (never mutated).
 * @returns The next save with the first-battle beats marked seen.
 */
export function markBattleOnboardingSeen(save: CurrentSave): CurrentSave {
  const scene = save.scene;
  return {
    ...save,
    scene: {
      sceneId: scene?.sceneId ?? "",
      nodeId: scene?.nodeId ?? "",
      flags: { ...scene?.flags, [BATTLE_ONBOARDING_FLAG]: true },
    },
  };
}
