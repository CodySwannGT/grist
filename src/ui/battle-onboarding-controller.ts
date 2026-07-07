/**
 * BattleOnboardingController — the scene-side orchestrator for the first-battle
 * onboarding beats (#228), kept out of the {@link import("../scenes/Battle").Battle}
 * scene so the scene stays under its line budget and this owns all the beat
 * plumbing in one place. It composes three concerns around the pure
 * {@link import("../logic/battle-onboarding") hint machine}: the **eligibility
 * gate** (are hints allowed here, and has this save already seen them), the
 * **transient view** ({@link BattleHintView}), and the **one-time ledger** (persist
 * "seen" so the beats never replay).
 *
 * Eligibility mirrors the other UAT seams: a real player (the production build with
 * no `?uat=1`) always gets the beats; under the verification surface they are
 * suppressed so existing specs stay green — unless a spec opts in with `?hints=1`,
 * a gated seam exactly like `?encounter=` / `?seed=`. On an eligible, not-yet-seen
 * battle it mounts the hint band, marks the save seen up front (so a mid-fight
 * reload never replays the beats), then feeds a per-frame signal into the machine
 * and paints whatever beat it surfaces. It owns no combat rules and reads no raw
 * input. Free it with {@link dispose} on scene shutdown.
 * @module ui/battle-onboarding-controller
 */
import Phaser from "phaser";
import { saveService } from "../services/save-service";
import { saveAutosave } from "../services/save-autosave";
import {
  advanceOnboarding,
  hasSeenBattleOnboarding,
  markBattleOnboardingSeen,
  newBattleOnboardingState,
  type BattleHintSignal,
  type BattleOnboardingSnapshot,
  type BattleOnboardingState,
} from "../logic/battle-onboarding";
import { isVerificationEnabled } from "../uat/bridge";
import { BattleHintView } from "./battle-hint";

/**
 * Whether the first-battle beats are allowed in this context. A real player (no
 * verification surface) always sees them; under `?uat=1` they are off so existing
 * specs stay green, unless the page opts in with `?hints=1` (a gated seam). Guarded
 * for non-browser (test) contexts where `window` is absent.
 * @returns True when the beats may run.
 */
function onboardingHintsAllowed(): boolean {
  if (!isVerificationEnabled()) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).has("hints");
}

/** Orchestrates the first-battle beats for one battle scene; holds no combat rules. */
export class BattleOnboardingController {
  readonly #scene: Phaser.Scene;
  #view: BattleHintView | null = null;
  #state: BattleOnboardingState = newBattleOnboardingState();
  /** Whether the machine is running this battle (eligible + not yet seen). */
  #active = false;
  /** Cleared on dispose so a slow save-load never mounts the band post-shutdown. */
  #alive = true;

  /**
   * Hold the owning scene; onboarding stays inert until {@link begin} decides it is
   * eligible. Nothing is mounted or read here.
   * @param scene - The owning battle scene.
   */
  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
  }

  /**
   * Begin onboarding when eligible: read the save, and — if the beats are allowed
   * and this save has not seen them — mount the hint band, activate the machine, and
   * persist the "seen" flag up front so a mid-fight reload never replays the beats.
   * A no-op (leaving the machine inert) when hints are gated off or already seen, or
   * when the scene has shut down during the async load. Fully guarded: a storage
   * failure leaves the beats simply unshown, never a crash (`saveService` is total).
   * @returns A promise that resolves once eligibility has been decided.
   */
  async begin(): Promise<void> {
    if (!onboardingHintsAllowed()) {
      return;
    }
    try {
      const save = await saveService.load();
      if (!this.#alive || hasSeenBattleOnboarding(save)) {
        return;
      }
      this.#view = new BattleHintView(this.#scene);
      this.#active = true;
      // Route the seen-flag write through the shared save queue (#245) so it can never
      // interleave with an economy/region write and clobber the credited grist.
      await saveAutosave.mutate(markBattleOnboardingSeen);
    } catch {
      // A storage failure just means no beats this run — never a broken battle.
    }
  }

  /**
   * Advance the machine one frame with the live signal and paint whatever beat it
   * surfaces. A no-op until {@link begin} has activated it.
   * @param signal - The live per-frame onboarding signal.
   * @returns void
   */
  update(signal: BattleHintSignal): void {
    if (!this.#active) {
      return;
    }
    const step = advanceOnboarding(this.#state, signal);
    this.#state = step.state;
    if (step.hint !== null) {
      this.#view?.show(step.hint.text);
    }
  }

  /**
   * The onboarding snapshot the verification bridge surfaces: whether the machine is
   * active, the beat on screen, and the beats shown so far.
   * @returns The onboarding snapshot.
   */
  snapshot(): BattleOnboardingSnapshot {
    return {
      enabled: this.#active,
      active: this.#view?.active() ?? null,
      shown: this.#state.shown,
    };
  }

  /**
   * Tear down: stop mounting a late band and free the hint view. The scene-shutdown
   * counterpart of {@link begin}.
   * @returns void
   */
  dispose(): void {
    this.#alive = false;
    this.#view?.destroy();
    this.#view = null;
    this.#active = false;
  }
}
