/**
 * Pure battle-FX selection — maps a resolved {@link BattleEvent} (and the
 * Break state transition) to the play-once FX strip + color-language tint the
 * render layer should show. Kept Phaser-free so the whole element→FX mapping is
 * unit-testable headless: the view layer (`ui/battler-stage`) consumes these to
 * spawn the actual sprite, and the Battle scene exposes the last selection to
 * the verification bridge (`__VERIFY__.fx()`), so an e2e can prove an action
 * read by its element without inspecting pixels.
 * @module ui/battle-fx
 */
import { FxAnims } from "../anims";
import { FxColors } from "../consts";
import {
  ActionKinds,
  type BattleEvent,
  type Combatant,
  type ElementId,
} from "../logic/combat";

/**
 * The FX the render layer plays for one moment: the registered animation key,
 * the element it reads as (null for a neutral Strike or the Break burst), and
 * the tint multiplied onto the strip for the combat color language.
 */
export interface FxSelection {
  readonly anim: string;
  readonly element: ElementId | null;
  readonly tint: number;
}

/** The dedicated Break burst — the Pressure→Break visual beat (grist-gold). */
export const BREAK_FX: FxSelection = {
  anim: FxAnims.break,
  element: null,
  tint: FxColors.break,
};

/**
 * The FX for one resolved action event. A Craft carrying an element shows that
 * element's tinted strip (the color language); a Defend puffs smoke; every
 * other kind (Strike / Bind / an element-less Craft) shows the neutral flavor.
 * @param event - The resolved battle event.
 * @returns The FX selection to play over the target.
 */
export function fxForEvent(event: BattleEvent): FxSelection {
  if (event.kind === ActionKinds.defend) {
    return { anim: FxAnims.smoke, element: null, tint: FxColors.neutral };
  }
  if (event.element) {
    return {
      anim: FxAnims[event.element],
      element: event.element,
      tint: FxColors[event.element],
    };
  }
  if (event.kind === ActionKinds.craft) {
    return { anim: FxAnims.spark, element: null, tint: FxColors.neutral };
  }
  return { anim: FxAnims.slash, element: null, tint: FxColors.neutral };
}

/**
 * Whether a combatant just crossed into Broken this frame — the one-shot trigger
 * for the Break beat. True only on the false→true edge of a living combatant, so
 * the render layer fires the burst + hitstop exactly once per Break (Broken is
 * monotonic in the sim, and a downed combatant never triggers it).
 * @param wasBroken - The combatant's Broken state as of the last mirror.
 * @param combatant - The live combatant.
 * @returns True on the frame Broken first flips true while alive.
 */
export function justBroke(wasBroken: boolean, combatant: Combatant): boolean {
  return combatant.hp > 0 && combatant.broken && !wasBroken;
}
