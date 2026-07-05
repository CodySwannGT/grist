/**
 * Battler stage views — builds and mirrors the pooled per-combatant render
 * objects (battler sprite + floating HP/ATB bars) for the side-view battle,
 * and plays the one-shot event juice for newly logged sim events. Extracted
 * from the Battle scene so the scene stays a thin per-frame mirror under its
 * line budget; everything here is presentation only and allocates solely on
 * discrete events, never on the steady-state frame.
 * @module ui/battler-stage
 */
import Phaser from "phaser";
import { FxAnims } from "../anims";
import { AtlasKeys } from "../assets";
import { BattleColors, BattleLayout } from "../consts";
import {
  ActionKinds,
  AtbTuning,
  BattleSides,
  type BattleEvent,
  type BattleSide,
  type Combatant,
} from "../logic/combat";
import {
  BATTLER_KIND,
  BattlerDirs,
  BattlerKinds,
  battlerAttackFrame,
  battlerDeadFrame,
  battlerIdleFrame,
  battlerWalkAnim,
  type BattlerDir,
  type BattlerRef,
} from "./battler-view";
import {
  attackLunge,
  damagePopup,
  hitFlash,
  JuiceTuning,
  screenShake,
} from "./juice";
import { unitCenter } from "./layout";

/** Integer battler display scale (16px art → 32px on the 384×216 stage). */
const UNIT_SCALE = 2;
/** Sprite alpha while the combatant is alive. */
const ALIVE_ALPHA = 1;
/** Sprite alpha once the combatant is downed (doubles as the state marker). */
const DOWNED_ALPHA = 0.4;
/** How long an attacker holds its attack pose before returning to idle (ms). */
const ATTACK_POSE_MS = 260;
/** Damage at or above this triggers the camera shake (heavy-hit weight). */
const SHAKE_DAMAGE_THRESHOLD = 10;
/** Damage popup colors per victim side. */
const POPUP_ENEMY_HIT = "#ffd166";
const POPUP_PARTY_HIT = "#ff8f8f";

/** The pooled render objects mirroring one combatant. */
export interface UnitView {
  readonly unit: Phaser.GameObjects.Sprite;
  readonly hpFill: Phaser.GameObjects.Rectangle;
  readonly atbFill: Phaser.GameObjects.Rectangle;
  readonly artRef: BattlerRef;
  readonly facing: BattlerDir;
}

/** Both sides' pooled views, index-aligned to the sim's combatant arrays. */
export interface StageViews {
  readonly party: readonly UnitView[];
  readonly enemies: readonly UnitView[];
}

/**
 * Create the pooled objects for one combatant: its battler sprite (idle pose,
 * facing its foes; monsters play their hover cycle) and a floating HP + ATB
 * bar pair.
 * @param scene - The owning scene.
 * @param side - The combatant's side.
 * @param index - The combatant's index within its side.
 * @param artRef - The combatant's cast battler ref.
 * @returns The pooled view for the combatant.
 */
export function buildUnitView(
  scene: Phaser.Scene,
  side: BattleSide,
  index: number,
  artRef: BattlerRef
): UnitView {
  const { x, y } = unitCenter(side, index);
  const facing =
    side === BattleSides.party ? BattlerDirs.left : BattlerDirs.right;
  const unit = scene.add
    .sprite(x, y, AtlasKeys.battlers, battlerIdleFrame(artRef, facing))
    .setScale(UNIT_SCALE);
  const hpBarY =
    y -
    BattleLayout.unitHeight / 2 -
    BattleLayout.barGap -
    BattleLayout.hpBarHeight / 2;
  const atbBarY =
    hpBarY -
    BattleLayout.hpBarHeight / 2 -
    BattleLayout.barGap -
    BattleLayout.atbBarHeight / 2;
  const hpFill = addBarPair(
    scene,
    x,
    hpBarY,
    BattleLayout.hpBarHeight,
    BattleColors.hpBarBg,
    BattleColors.hpBarFill
  );
  const atbFill = addBarPair(
    scene,
    x,
    atbBarY,
    BattleLayout.atbBarHeight,
    BattleColors.atbBarBg,
    BattleColors.atbBarFill
  );
  if (BATTLER_KIND[artRef] === BattlerKinds.monster) {
    // A monster's idle IS its slow walk cycle — reads as a hover/bob.
    unit.play(battlerWalkAnim(artRef, facing));
  }
  return { unit, hpFill, atbFill, artRef, facing };
}

/**
 * Add one floating bar (background track + left-anchored fill) and return the
 * fill, whose `scaleX` the per-frame sync drives.
 * @param scene - The owning scene.
 * @param x - The bar's center X.
 * @param y - The bar's center Y.
 * @param height - The bar's height (px).
 * @param bgColor - The track color.
 * @param fillColor - The fill color.
 * @returns The fill rectangle.
 */
function addBarPair(
  scene: Phaser.Scene,
  x: number,
  y: number,
  height: number,
  bgColor: number,
  fillColor: number
): Phaser.GameObjects.Rectangle {
  const track = scene.add.rectangle(
    x,
    y,
    BattleLayout.barWidth,
    height,
    bgColor
  );
  // The fill sits one depth above its track so the pair never interleaves
  // with sprites that share the default depth.
  return scene.add
    .rectangle(
      x - BattleLayout.barWidth / 2,
      y,
      BattleLayout.barWidth,
      height,
      fillColor
    )
    .setOrigin(0, 0.5)
    .setDepth(track.depth + 1);
}

/**
 * Mirror one combatant onto its view: HP/ATB bar fill, plus the downed/alive
 * pose transition. The sprite's alpha doubles as the applied-visual marker so
 * the transition work (frame swap, tint, anim stop) runs exactly once per
 * state change — steady-state frames only write two scale scalars.
 * @param view - The combatant's pooled view.
 * @param combatant - The live combatant.
 * @returns void
 */
export function syncUnitView(view: UnitView, combatant: Combatant): void {
  const alive = combatant.hp > 0;
  view.hpFill.setScale(
    Phaser.Math.Clamp(combatant.hp / combatant.stats.hp, 0, 1),
    1
  );
  view.atbFill.setScale(
    Phaser.Math.Clamp(combatant.atb / AtbTuning.ready, 0, 1),
    1
  );
  if (!alive && view.unit.alpha === ALIVE_ALPHA) {
    view.unit.stop();
    view.unit
      .setFrame(battlerDeadFrame(view.artRef, view.facing))
      .setTint(BattleColors.downedTint)
      .setAlpha(DOWNED_ALPHA);
  } else if (alive && view.unit.alpha !== ALIVE_ALPHA) {
    view.unit
      .setFrame(battlerIdleFrame(view.artRef, view.facing))
      .clearTint()
      .setAlpha(ALIVE_ALPHA);
    if (BATTLER_KIND[view.artRef] === BattlerKinds.monster) {
      view.unit.play(battlerWalkAnim(view.artRef, view.facing));
    }
  }
}

/**
 * The juice for one resolved action event: actor beat + target beat.
 * @param scene - The owning scene.
 * @param views - Both sides' pooled views.
 * @param event - The newly logged battle event.
 * @returns void
 */
export function playEventJuice(
  scene: Phaser.Scene,
  views: StageViews,
  event: BattleEvent
): void {
  const actor = event.actor
    ? viewAt(views, event.actor.side, event.actor.index)
    : null;
  if (actor) {
    playActorJuice(scene, actor, event.actor?.side === BattleSides.party);
  }
  const target = event.target
    ? viewAt(views, event.target.side, event.target.index)
    : null;
  if (target) {
    playTargetJuice(scene, target, event);
  }
}

/**
 * The attacker's beat: a lunge toward the foe, and (for chars, which have
 * dedicated pose art) a held attack pose that reverts to idle.
 * @param scene - The owning scene.
 * @param actor - The attacker's view.
 * @param isParty - Whether the attacker fights on the party side.
 * @returns void
 */
function playActorJuice(
  scene: Phaser.Scene,
  actor: UnitView,
  isParty: boolean
): void {
  attackLunge(scene, actor.unit, (isParty ? -1 : 1) * JuiceTuning.lungePx);
  if (BATTLER_KIND[actor.artRef] === BattlerKinds.char) {
    actor.unit.setFrame(battlerAttackFrame(actor.artRef, actor.facing));
    scene.time.delayedCall(ATTACK_POSE_MS, () => {
      if (actor.unit.alpha === ALIVE_ALPHA) {
        actor.unit.setFrame(battlerIdleFrame(actor.artRef, actor.facing));
      }
    });
  }
}

/**
 * The target's beat: the FX strip for the action flavor, and on real damage a
 * hit-flash, a damage popup, and (heavy hits) a camera shake.
 * @param scene - The owning scene.
 * @param target - The target's view.
 * @param event - The logged event (kind + damage + victim side).
 * @returns void
 */
function playTargetJuice(
  scene: Phaser.Scene,
  target: UnitView,
  event: BattleEvent
): void {
  const damage = event.damage ?? 0;
  const popupY = target.unit.y - (target.unit.displayHeight / 2 + 2);
  const popupColor =
    event.target?.side === BattleSides.party
      ? POPUP_PARTY_HIT
      : POPUP_ENEMY_HIT;
  playFx(scene, event.kind, target.unit);
  if (damage <= 0) {
    return;
  }
  hitFlash(scene, target.unit);
  damagePopup(scene, target.unit.x, popupY, String(damage), popupColor);
  if (damage >= SHAKE_DAMAGE_THRESHOLD) {
    screenShake(scene);
  }
}

/**
 * Spawn a play-once FX strip over a unit and free it when it finishes.
 * @param scene - The owning scene.
 * @param kind - The action kind selecting the FX flavor.
 * @param over - The sprite the FX plays over.
 * @returns void
 */
function playFx(
  scene: Phaser.Scene,
  kind: BattleEvent["kind"],
  over: Phaser.GameObjects.Sprite
): void {
  const anim =
    kind === ActionKinds.craft
      ? FxAnims.spark
      : kind === ActionKinds.defend
        ? FxAnims.smoke
        : FxAnims.slash;
  const fx = scene.add
    .sprite(over.x, over.y, AtlasKeys.fx)
    .setDepth(over.depth + 1);
  fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  fx.play(anim);
}

/**
 * Look up the pooled view for a combatant ref, if it exists.
 * @param views - Both sides' pooled views.
 * @param side - The combatant's side.
 * @param index - The combatant's index within its side.
 * @returns The view, or null when the index is out of range.
 */
function viewAt(
  views: StageViews,
  side: BattleSide,
  index: number
): UnitView | null {
  const list = side === BattleSides.party ? views.party : views.enemies;
  return list[index] ?? null;
}
