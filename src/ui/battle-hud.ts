/**
 * The battle HUD (ui-ux-and-controls "Battle UI"): the player-facing combat
 * surface drawn over the side-view scene. It renders, from the live
 * {@link BattleState} and the {@link BattleController}'s selection, the shared
 * grist wallet, the battle-speed widget, each party member's HP / AP / filling
 * ATB gauge with a ready cue, the current target with its Pressure → Break state,
 * and the Strike / Craft / Bind / Item / Defend command menu (costs shown,
 * unaffordable commands greyed). It owns no combat rules and reads no raw input:
 * its interactive widgets feed the semantic {@link InputService}, and its render
 * is steady-state allocation-free (pooled objects, {@link GuardedText}). Free with
 * {@link destroy} on scene shutdown.
 * @module ui/battle-hud
 */
import Phaser from "phaser";
import { HUD_DEPTH } from "../consts";
import { type PartyMemberDef } from "../content";
import { speedLabel } from "../game/speed";
import {
  AtbTuning,
  BattleSides,
  type BattleState,
  type Combatant,
} from "../logic/combat";
import { type InputService } from "../services/input";
import { type BattleController } from "./battle-controller";
import {
  COMMAND_ORDER,
  commandAffordable,
  commandCostLabel,
  commandLabel,
  type CommandId,
} from "./commands";
import { commandRect, HudColors, HudLayout, unitCenter } from "./layout";
import { GuardedText, makeText, nameForRef } from "./hud-text";

/** Vertical offset of a party row's second line (AP + ATB gauge). */
const ROW_LINE2_DY = 9;
/** X offsets within a party row, from the panel's left margin. */
const ROW_HP_DX = 34;
const ROW_BAR_DX = 62;
const ROW_READY_DX = 128;

/** The pooled objects mirroring one party member's HUD row. */
interface PartyRow {
  readonly name: GuardedText;
  readonly hp: GuardedText;
  readonly ap: GuardedText;
  readonly atbFill: Phaser.GameObjects.Rectangle;
  readonly ready: GuardedText;
}

/** The pooled objects for one command button (its highlight box + label). */
interface CommandButton {
  readonly id: CommandId;
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: GuardedText;
}

/** Renders the battle HUD from sim + controller state; holds no rules. */
export class BattleHud {
  readonly #scene: Phaser.Scene;
  readonly #input: InputService;
  readonly #objects: Phaser.GameObjects.GameObject[] = [];
  readonly #grist: GuardedText;
  readonly #speed: GuardedText;
  readonly #targetLabel: GuardedText;
  readonly #marker: Phaser.GameObjects.Triangle;
  readonly #rows: readonly PartyRow[];
  readonly #buttons: readonly CommandButton[];

  /**
   * Build every HUD widget once and wire the interactive ones to the InputService.
   * @param scene - The owning battle scene.
   * @param input - The semantic input service the widgets feed.
   * @param party - The fielded party (sets the row count + static names).
   */
  constructor(
    scene: Phaser.Scene,
    input: InputService,
    party: readonly PartyMemberDef[]
  ) {
    this.#scene = scene;
    this.#input = input;
    this.#grist = this.#label(HudLayout.marginX, HudLayout.gristY);
    this.#speed = this.#buildSpeed();
    this.#targetLabel = this.#label(
      HudLayout.targetCenterX,
      HudLayout.targetY,
      0.5
    );
    this.#marker = this.#buildMarker();
    this.#rows = party.map((_member, index) => this.#buildRow(index));
    this.#buttons = COMMAND_ORDER.map(id => this.#buildButton(id));
  }

  /**
   * Register a HUD object: lift it above the combatant views and track it for
   * teardown.
   * @param object - The freshly added game object.
   * @returns The same object, for chaining.
   */
  #track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(
      HUD_DEPTH
    );
    this.#objects.push(object);
    return object;
  }

  /**
   * Create a tracked HUD label at a logical position.
   * @param x - Logical x.
   * @param y - Logical y.
   * @param originX - Horizontal origin (default left).
   * @param originY - Vertical origin (default top).
   * @returns The guarded label.
   */
  #label(x: number, y: number, originX = 0, originY = 0): GuardedText {
    const guarded = makeText(this.#scene, x, y, originX, originY);
    this.#track(guarded.object);
    return guarded;
  }

  /**
   * Build the top-right battle-speed widget; tapping it toggles speed.
   * @returns The guarded speed label.
   */
  #buildSpeed(): GuardedText {
    const guarded = this.#label(HudLayout.speedRightX, HudLayout.speedY, 1);
    guarded.object
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.#input.tapToggleSpeed());
    return guarded;
  }

  /**
   * Build the downward target caret (repositioned over the targeted enemy).
   * @returns The marker triangle.
   */
  #buildMarker(): Phaser.GameObjects.Triangle {
    const marker = this.#scene.add
      .triangle(0, 0, 0, 0, 8, 0, 4, 6, HudColors.marker)
      .setVisible(false);
    return this.#track(marker);
  }

  /**
   * Build one party member's row (name, HP, AP, ATB gauge, ready cue).
   * @param index - The member's index in the party.
   * @returns The pooled row.
   */
  #buildRow(index: number): PartyRow {
    const top = HudLayout.partyTopY + index * HudLayout.partyRowH;
    const line2 = top + ROW_LINE2_DY;
    const barLeft = HudLayout.marginX + ROW_BAR_DX;
    this.#track(
      this.#scene.add
        .rectangle(
          barLeft,
          line2 + 1,
          HudLayout.partyBarW,
          HudLayout.partyBarH,
          HudColors.atbBg
        )
        .setOrigin(0, 0.5)
    );
    const atbFill = this.#track(
      this.#scene.add
        .rectangle(
          barLeft,
          line2 + 1,
          HudLayout.partyBarW,
          HudLayout.partyBarH,
          HudColors.atbFill
        )
        .setOrigin(0, 0.5)
    );
    return {
      name: this.#label(HudLayout.marginX, top),
      hp: this.#label(HudLayout.marginX + ROW_HP_DX, top),
      ap: this.#label(HudLayout.marginX, line2),
      atbFill,
      ready: this.#label(HudLayout.marginX + ROW_READY_DX, line2),
    };
  }

  /**
   * Build one command button: a toggled highlight box (visual only), an
   * always-present interactive {@link Phaser.GameObjects.Zone} for hit-testing
   * (a hidden Rectangle is skipped by Phaser's `willRender` input check, so the
   * tap target is a Zone, which is always hit-tested), and the cost-bearing label.
   * @param id - The command id.
   * @returns The pooled button.
   */
  #buildButton(id: CommandId): CommandButton {
    const rect = commandRect(COMMAND_ORDER.indexOf(id));
    const box = this.#track(
      this.#scene.add
        .rectangle(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          HudColors.highlightFill
        )
        .setOrigin(0, 0)
        .setVisible(false)
    );
    const zone = this.#track(
      this.#scene.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
    );
    // A Zone has no texture frame, so its hit area must be given explicitly — the
    // config-object form alone does not auto-size it.
    zone.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, rect.width, rect.height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.#input.tapCommand(id));
    const label = this.#label(
      rect.x + HudLayout.menuPadX,
      rect.y + rect.height / 2,
      0,
      0.5
    );
    return { id, box, label };
  }

  /**
   * Repaint the HUD from the live state + the controller's selection. Steady-state
   * allocation-free: only guarded text, bar scale, tint, and visibility change.
   * @param state - The live battle state.
   * @param controller - The menu/target/speed controller.
   * @returns void
   */
  render(state: BattleState, controller: BattleController): void {
    const actor = controller.activeActor(state);
    const target = controller.targetEnemy(state);
    const actorAp = actor === null ? 0 : (state.party[actor]?.ap ?? 0);
    this.#grist.set(`GRIST ${state.grist}`, HudColors.grist);
    this.#speed.set(`SPD ${speedLabel(controller.speed)}`, HudColors.grist);
    this.#renderTarget(state, target);
    this.#renderParty(state, actor);
    this.#renderMenu(state, controller.highlight, actor !== null, actorAp);
  }

  /**
   * Render the target caret + label (name and Pressure → Break state).
   * @param state - The battle state.
   * @param target - The resolved target enemy index.
   * @returns void
   */
  #renderTarget(state: BattleState, target: number): void {
    const enemy = state.enemies[target];
    if (!enemy || enemy.hp <= 0) {
      this.#marker.setVisible(false);
      this.#targetLabel.set("", HudColors.dim);
      return;
    }
    const tag = enemy.broken ? " BREAK" : ` P${enemy.pressure}`;
    this.#targetLabel.set(
      `> ${nameForRef(enemy.ref)}${tag}`,
      enemy.broken ? HudColors.breakTag : HudColors.text
    );
    const center = unitCenter(BattleSides.enemies, target);
    this.#marker
      .setPosition(center.x, center.y - HudLayout.markerYOffset)
      .setVisible(true);
  }

  /**
   * Render every party row, flagging the row whose turn it is.
   * @param state - The battle state.
   * @param actor - The ready party index, or null.
   * @returns void
   */
  #renderParty(state: BattleState, actor: number | null): void {
    this.#rows.forEach((row, index) => {
      const member = state.party[index];
      if (member) {
        this.#renderRow(row, member, index === actor);
      }
    });
  }

  /**
   * Render one party row's HP / AP / ATB gauge + ready cue.
   * @param row - The pooled row.
   * @param member - The live combatant.
   * @param active - Whether this member is the ready actor.
   * @returns void
   */
  #renderRow(row: PartyRow, member: Combatant, active: boolean): void {
    const ready = member.hp > 0 && member.atb >= AtbTuning.ready;
    row.name.set(
      nameForRef(member.ref),
      active ? HudColors.highlightText : HudColors.text
    );
    row.hp.set(`HP${member.hp}/${member.stats.hp}`, HudColors.text);
    row.ap.set(`AP${member.ap}/${member.stats.ap}`, HudColors.text);
    row.atbFill.scaleX = Phaser.Math.Clamp(member.atb / AtbTuning.ready, 0, 1);
    row.ready.set(ready ? "READY" : "", HudColors.ready);
  }

  /**
   * Render the command menu: highlight the selection, grey unaffordable commands,
   * and dim the whole menu when no actor is ready.
   * @param state - The battle state.
   * @param highlight - The highlighted command index.
   * @param menuOpen - Whether a party actor is ready.
   * @param actorAp - The ready actor's AP (0 when none).
   * @returns void
   */
  #renderMenu(
    state: BattleState,
    highlight: number,
    menuOpen: boolean,
    actorAp: number
  ): void {
    this.#buttons.forEach((button, index) => {
      const affordable =
        menuOpen && commandAffordable(button.id, actorAp, state.grist);
      const highlighted = menuOpen && index === highlight;
      button.box.setVisible(highlighted);
      button.label.set(
        `${commandLabel(button.id)}${commandCostLabel(button.id)}`,
        this.#menuColor(highlighted, affordable)
      );
    });
  }

  /**
   * The label color for a command cell: gold when highlighted, light when
   * affordable, dim when not.
   * @param highlighted - Whether this is the selected cell.
   * @param affordable - Whether the command can be paid.
   * @returns The CSS color.
   */
  #menuColor(highlighted: boolean, affordable: boolean): string {
    if (highlighted) {
      return HudColors.highlightText;
    }
    return affordable ? HudColors.text : HudColors.dim;
  }

  /**
   * Destroy every HUD object (removing its input listeners with it).
   * @returns void
   */
  destroy(): void {
    this.#objects.forEach(object => object.destroy());
    this.#objects.length = 0;
  }
}
