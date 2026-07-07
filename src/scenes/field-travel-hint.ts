/**
 * The Field travel-signpost orchestration (#261) — the adapter-level glue that decides
 * whether the intro Field's once-per-save "how to reach the World Map" hint should show
 * and, when it should, claims it (marks it seen) so it never replays. Pulled out of
 * {@link import("./Field").Field} so the scene stays under its line budget and a thin
 * renderer: the *rules* (the persisted seen-flag) live in the pure
 * {@link import("../logic/field-onboarding") field-onboarding} module this composes;
 * this only reads the hint gate and threads the save round-trip.
 * @module scenes/field-travel-hint
 */
import {
  FIELD_TRAVEL_ONBOARDING_HINT,
  hasSeenFieldTravelOnboarding,
  markFieldTravelOnboardingSeen,
} from "../logic/field-onboarding";
import { saveService } from "../services/save-service";
import { saveAutosave } from "../services/save-autosave";
import { isVerificationEnabled } from "../uat/bridge";
import { type FieldHud } from "./field-hud";

/**
 * Whether the first-landing travel hint may show: a real player always sees it; under
 * `?uat=1` it is opt-in via `?hints=1` so bridge-driven specs stay quiet — the same gate
 * the World Map / first-battle onboarding use (#228/#241).
 * @returns True when the hint may show.
 */
function travelHintAllowed(): boolean {
  if (!isVerificationEnabled()) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).has("hints");
}

/**
 * Claim the once-per-save travel signpost for this Field landing (#261): returns the
 * hint copy to surface when the gate allows it AND this save has not seen it yet — and,
 * in that case, folds the seen-flag through the shared save queue (#245, so it can never
 * clobber a concurrent economy write) so the beat never replays. The `stillEligible`
 * guard is re-checked *after* the save load (which the caller fires and forgets during
 * `Field.create`): if the player has already acted or left the scene during that I/O gap,
 * the claim bails without marking the flag seen, so the beat is never "spent" unshown.
 * Returns null when the hint is gated off, already seen, or no longer eligible.
 * @param stillEligible - Re-checked post-load; false once first input / scene-exit lands.
 * @returns The hint copy to show, or null.
 */
async function claimFieldTravelHint(
  stillEligible: () => boolean
): Promise<string | null> {
  if (!travelHintAllowed()) {
    return null;
  }
  const save = await saveService.load();
  if (!stillEligible() || hasSeenFieldTravelOnboarding(save)) {
    return null;
  }
  await saveAutosave.mutate(markFieldTravelOnboardingSeen);
  return FIELD_TRAVEL_ONBOARDING_HINT;
}

/**
 * Show the once-per-save travel signpost on the Field HUD when it is due (#261) — the
 * scene's create fires this and forgets it. Claims the hint (gate + save round-trip) and,
 * when one is returned AND the landing is still eligible (the player has not acted or left
 * the scene during the save I/O), paints it on the HUD; a no-op otherwise. The HUD itself
 * also latches dismissed on first input, so a late resolve can never re-raise the banner.
 * @param hud - The Field HUD to surface the banner on.
 * @param stillEligible - True while the player has not yet acted and the scene is live.
 * @returns A promise that resolves once the hint has been claimed (and shown, if any).
 */
export async function showFieldTravelHintIfDue(
  hud: FieldHud,
  stillEligible: () => boolean
): Promise<void> {
  const hint = await claimFieldTravelHint(stillEligible);
  if (hint !== null && stillEligible()) {
    hud.showOnboarding(hint);
  }
}
