/**
 * Verification-only standalone-boot seams for the Battle scene: the `?encounter=`
 * and `?world=` query readers a UAT uses to boot a specific fight without a Field
 * launch. Both are gated behind {@link isVerificationEnabled} (a production user
 * with no `?uat=1` can never reach them) and guarded for non-browser (test)
 * contexts. Extracted from `scenes/Battle.ts` so the scene stays under its line
 * budget and the two seams live in one readable place.
 * @module scenes/battle-boot-seams
 */
import { ENCOUNTERS, type EncounterDef, type EncounterId } from "../content";
import { type WorldState } from "../logic/world";
import { isVerificationEnabled } from "../uat/bridge";

/**
 * The `?<key>=` query value, or null off a verification boot / non-browser context.
 * @param key - The query-string key to read.
 * @returns The raw query value, or null when the seam does not apply.
 */
function verifyQuery(key: string): string | null {
  if (!isVerificationEnabled() || typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * The encounter named by the `?encounter=<id>` query, or null when absent/unknown
 * or the verification surface is disabled. Lets a UAT boot a specific encounter —
 * e.g. a tanky one to demonstrate a survivable Rendering/Break (#115) — standalone.
 * @returns The selected encounter, or null when the seam does not apply.
 */
export function urlEncounter(): EncounterDef | null {
  const raw = verifyQuery("encounter");
  return raw === null ? null : (ENCOUNTERS[raw as EncounterId] ?? null);
}

/**
 * The world-state named by the `?world=ashfall` query, or null when absent/disabled.
 * The balance counterpart of {@link urlEncounter} (#266): a gated UAT seam to boot a
 * standalone fight against the warped #141 Ashfall variants (feel the bite, force a
 * real KO/defeat) without playing the whole run to the Reckoning.
 * @returns `"ashfall"` when the seam requests it, otherwise null.
 */
export function urlWorldState(): WorldState | null {
  return verifyQuery("world") === "ashfall" ? "ashfall" : null;
}
