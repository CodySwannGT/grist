/**
 * Unit suite for the pure first-battle onboarding logic (`src/logic/battle-onboarding`,
 * #228): the hint state machine that surfaces short contextual beats at the right
 * moments and the one-time "seen" ledger that keeps them from replaying. Data
 * in/data out, asserted headless with no Phaser.
 *
 * - [EVIDENCE: onboarding-beats-fire-in-order] — the beats surface one at a time in
 *   priority order as their triggers become true, each exactly once.
 * - [EVIDENCE: onboarding-resource-beat-contextual] — the AP-vs-Grist beat fires only
 *   when a resource-spending command (Craft / Bind) is highlighted.
 * - [EVIDENCE: onboarding-seen-once-per-save] — the "seen" flag reads false on a fresh
 *   save, marks true through the scene-flag ledger, and never replays after.
 * - [EVIDENCE: onboarding-copy-quotes-real-bindings] — the copy quotes the real
 *   bindings (Shift toggles speed) and the AP/Grist split.
 */
import { describe, expect, it } from "vitest";
import { freshSave } from "../../src/logic/save";
import type { CurrentSave } from "../../src/logic/save";
import {
  BATTLE_HINT_TEXT,
  BATTLE_ONBOARDING_FLAG,
  BattleHintIds,
  advanceOnboarding,
  hasSeenBattleOnboarding,
  markBattleOnboardingSeen,
  newBattleOnboardingState,
  onboardingComplete,
  type BattleHintSignal,
  type BattleOnboardingState,
} from "../../src/logic/battle-onboarding";

/** A signal with nothing triggered (the fight just opened, menu closed). */
const IDLE: BattleHintSignal = {
  menuOpen: false,
  highlightedCommand: null,
  telegraphPresent: false,
};

/**
 * Drive the machine through a sequence of signals, collecting every beat fired.
 * @param signals - The per-frame signals to feed the machine, in order.
 * @returns The final machine state and the ids of every beat that fired.
 */
function run(signals: readonly BattleHintSignal[]): {
  state: BattleOnboardingState;
  fired: readonly string[];
} {
  let state = newBattleOnboardingState();
  const fired: string[] = [];
  for (const signal of signals) {
    const step = advanceOnboarding(state, signal);
    state = step.state;
    if (step.hint !== null) {
      fired.push(step.hint.id);
    }
  }
  return { state, fired };
}

describe("first-battle hint machine (#228)", () => {
  it("[EVIDENCE: onboarding-beats-fire-in-order] surfaces the speed beat first, on the opening frame", () => {
    const step = advanceOnboarding(newBattleOnboardingState(), IDLE);
    expect(step.hint?.id).toBe(BattleHintIds.speed);
    expect(step.hint?.text).toBe(BATTLE_HINT_TEXT.speed);
    // Only one beat per frame — the machine never stampedes.
    expect(step.state.shown).toEqual([BattleHintIds.speed]);
  });

  it("[EVIDENCE: onboarding-beats-fire-in-order] fires the controls beat when the menu first opens", () => {
    const menuOpen: BattleHintSignal = { ...IDLE, menuOpen: true };
    // Frame 1 spends the speed beat; frame 2 (menu now open) surfaces controls.
    const { fired } = run([IDLE, menuOpen]);
    expect(fired).toEqual([BattleHintIds.speed, BattleHintIds.controls]);
  });

  it("[EVIDENCE: onboarding-beats-fire-in-order] fires the telegraph beat on the first enemy wind-up and never repeats a beat", () => {
    const telegraph: BattleHintSignal = { ...IDLE, telegraphPresent: true };
    const { fired } = run([IDLE, telegraph, telegraph, telegraph]);
    // speed (frame 1), telegraph (frame 2), then nothing more — each fires once.
    expect(fired).toEqual([BattleHintIds.speed, BattleHintIds.telegraph]);
  });

  it("[EVIDENCE: onboarding-resource-beat-contextual] fires the AP-vs-Grist beat only when Craft or Bind is highlighted", () => {
    const onStrike: BattleHintSignal = {
      menuOpen: true,
      highlightedCommand: "strike",
      telegraphPresent: false,
    };
    const onCraft: BattleHintSignal = {
      ...onStrike,
      highlightedCommand: "craft",
    };
    // Highlighting Strike never surfaces the resource beat...
    const strikeOnly = run([onStrike, onStrike]);
    expect(strikeOnly.fired).not.toContain(BattleHintIds.resources);
    // ...but highlighting Craft does (after the speed + controls beats spend first).
    const { fired } = run([onStrike, onStrike, onCraft]);
    expect(fired).toContain(BattleHintIds.resources);
  });

  it("[EVIDENCE: onboarding-resource-beat-contextual] the Bind highlight also surfaces the resource beat", () => {
    const onBind: BattleHintSignal = {
      menuOpen: true,
      highlightedCommand: "bind",
      telegraphPresent: false,
    };
    const { fired } = run([onBind, onBind, onBind]);
    expect(fired).toContain(BattleHintIds.resources);
  });

  it("[EVIDENCE: onboarding-beats-fire-in-order] reports complete once every beat has shown", () => {
    const full: BattleHintSignal = {
      menuOpen: true,
      highlightedCommand: "craft",
      telegraphPresent: true,
    };
    const { state } = run([full, full, full, full, full]);
    expect(onboardingComplete(state)).toBe(true);
    // A further step surfaces nothing — the machine is spent.
    expect(advanceOnboarding(state, full).hint).toBeNull();
  });
});

describe("first-battle onboarding-seen ledger (#228)", () => {
  it("[EVIDENCE: onboarding-seen-once-per-save] a fresh save has not seen the beats", () => {
    expect(hasSeenBattleOnboarding(freshSave())).toBe(false);
  });

  it("[EVIDENCE: onboarding-seen-once-per-save] marking seen folds the flag into the scene-flag ledger and reads back true", () => {
    const marked = markBattleOnboardingSeen(freshSave());
    expect(hasSeenBattleOnboarding(marked)).toBe(true);
    expect(marked.scene?.flags?.[BATTLE_ONBOARDING_FLAG]).toBe(true);
  });

  it("[EVIDENCE: onboarding-seen-once-per-save] marking seen preserves an existing narrative cursor and its other flags", () => {
    const withScene: CurrentSave = {
      ...freshSave(),
      scene: {
        sceneId: "opening",
        nodeId: "ambush",
        flags: { "sable-revealed": true },
      },
    };
    const marked = markBattleOnboardingSeen(withScene);
    expect(marked.scene?.sceneId).toBe("opening");
    expect(marked.scene?.nodeId).toBe("ambush");
    // The prior flag survives; the new one is merged over, not replacing it.
    expect(marked.scene?.flags?.["sable-revealed"]).toBe(true);
    expect(marked.scene?.flags?.[BATTLE_ONBOARDING_FLAG]).toBe(true);
  });

  it("[EVIDENCE: onboarding-seen-once-per-save] the fold round-trips through JSON (persists across a reload)", () => {
    const marked = markBattleOnboardingSeen(freshSave());
    const roundTripped = JSON.parse(JSON.stringify(marked)) as CurrentSave;
    expect(hasSeenBattleOnboarding(roundTripped)).toBe(true);
  });

  it("[EVIDENCE: onboarding-seen-once-per-save] marking seen never mutates the input save", () => {
    const before = freshSave();
    markBattleOnboardingSeen(before);
    expect(before.scene).toBeNull();
  });
});

describe("first-battle hint copy (#228)", () => {
  it("[EVIDENCE: onboarding-copy-quotes-real-bindings] the speed beat quotes the real Shift binding, not Tab", () => {
    expect(BATTLE_HINT_TEXT.speed).toContain("Shift");
    expect(BATTLE_HINT_TEXT.speed).not.toContain("Tab");
  });

  it("[EVIDENCE: onboarding-copy-quotes-real-bindings] the resource beat names both AP and Grist", () => {
    expect(BATTLE_HINT_TEXT.resources).toContain("AP");
    expect(BATTLE_HINT_TEXT.resources).toContain("Grist");
  });

  it("[EVIDENCE: onboarding-copy-quotes-real-bindings] the controls beat names the navigate + confirm + cancel keys", () => {
    expect(BATTLE_HINT_TEXT.controls).toContain("Enter");
    expect(BATTLE_HINT_TEXT.controls).toContain("Esc");
  });
});
