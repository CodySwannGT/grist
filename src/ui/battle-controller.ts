/**
 * The battle HUD controller — the bridge between semantic input intents and the
 * sim. It subscribes to {@link BattleEvents.Input} (published by the
 * {@link import("../services/input").InputService}) and owns the player-facing
 * interaction state: which command is highlighted, which enemy is targeted, and
 * the current battle speed. A confirmed, affordable command for the ready party
 * actor is published as a {@link BattleEvents.ActionRequested} the runner threads
 * through the reducer; a speed toggle is pushed to the runner. It holds no combat
 * rules and renders nothing — the HUD reads its accessors, the verification
 * bridge reads its {@link model}. Free the bus listener with {@link dispose}.
 * @module ui/battle-controller
 */
import { BattleEvents } from "../consts";
import { BattleRunner } from "../game/battle-runner";
import {
  DEFAULT_SPEED,
  nextSpeed,
  speedLabel,
  speedTickMs,
  type BattleSpeed,
} from "../game/speed";
import { AtbTuning, BattleSides, type BattleState } from "../logic/combat";
import { type InputDevice, type InputIntent } from "../services/input-map";
import { eventsCenter } from "../services/events";
import {
  buildAction,
  commandAffordable,
  commandCost,
  commandLabel,
  COMMAND_ORDER,
  type CommandId,
} from "./commands";
import { commandRect, type Rect } from "./layout";

/** A command row as the verification bridge sees it. */
export interface HudCommandModel {
  readonly id: CommandId;
  readonly label: string;
  readonly highlighted: boolean;
  readonly affordable: boolean;
  readonly apCost: number;
  readonly gristCost: number;
  readonly rect: Rect;
}

/** An enemy's HUD-relevant state (Pressure → Break + whether it is targeted). */
export interface HudEnemyModel {
  readonly index: number;
  readonly broken: boolean;
  readonly pressure: number;
  readonly targeted: boolean;
}

/** The last semantic intent observed, proving which device drove the menu. */
export interface HudInputModel {
  readonly kind: string;
  readonly device: InputDevice;
}

/** The last battle action selected through the menu (the AC3 observable). */
export interface HudActionModel {
  readonly command: CommandId;
  readonly device: InputDevice;
}

/** One party member's HUD row — exactly what the HUD draws for it. */
export interface HudPartyModel {
  readonly ref: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly ap: number;
  readonly maxAp: number;
  readonly atb: number;
  readonly ready: boolean;
  readonly active: boolean;
}

/** The whole HUD view-model the verification bridge exposes under `?uat=1`. */
export interface HudModel {
  readonly speed: BattleSpeed;
  readonly speedLabel: string;
  readonly tickMs: number | null;
  readonly activeActor: number | null;
  readonly targetEnemy: number;
  readonly menuOpen: boolean;
  readonly grist: number;
  readonly party: readonly HudPartyModel[];
  readonly commands: readonly HudCommandModel[];
  readonly enemies: readonly HudEnemyModel[];
  readonly lastInput: HudInputModel | null;
  readonly lastAction: HudActionModel | null;
}

/**
 * Whether an enemy combatant is still a valid target (in range and alive).
 * @param state - The battle state.
 * @param index - The candidate enemy index.
 * @returns True when the enemy exists and has HP remaining.
 */
function enemyAlive(state: BattleState, index: number): boolean {
  const enemy = state.enemies[index];
  return enemy !== undefined && enemy.hp > 0;
}

/**
 * The index of the party member whose turn it is — the first living member whose
 * ATB gauge has filled — or null when none is ready (the menu is then closed).
 * @param state - The battle state.
 * @returns The ready party index, or null.
 */
function firstReadyParty(state: BattleState): number | null {
  const index = state.party.findIndex(
    member => member.hp > 0 && member.atb >= AtbTuning.ready
  );
  return index < 0 ? null : index;
}

/**
 * Resolve a stored target to a live enemy: the stored index when it is still
 * alive, otherwise the first living enemy, otherwise 0 (the marker never rests on
 * a corpse).
 * @param state - The battle state.
 * @param stored - The currently stored target index.
 * @returns A resolved, preferably-living enemy index.
 */
function resolveTarget(state: BattleState, stored: number): number {
  if (enemyAlive(state, stored)) {
    return stored;
  }
  const firstLiving = state.enemies.findIndex(enemy => enemy.hp > 0);
  return firstLiving < 0 ? 0 : firstLiving;
}

/**
 * The next living enemy from `from` in direction `delta`, wrapping; falls back to
 * `from` when no other enemy is alive.
 * @param state - The battle state.
 * @param from - The current target index.
 * @param delta - The cycle direction (-1 previous, +1 next).
 * @returns The next living enemy index.
 */
function nextLivingEnemy(
  state: BattleState,
  from: number,
  delta: number
): number {
  const count = state.enemies.length;
  if (count === 0) {
    return from;
  }
  const found = Array.from({ length: count }, (_unused, step) => {
    const offset = delta * (step + 1);
    return (((from + offset) % count) + count) % count;
  }).find(index => enemyAlive(state, index));
  return found ?? from;
}

/** Owns the player's menu/target/speed selection and turns it into sim actions. */
export class BattleController {
  readonly #runner: BattleRunner;
  #highlight = 0;
  #target = 0;
  #speed: BattleSpeed = DEFAULT_SPEED;
  #lastInput: HudInputModel | null = null;
  #lastAction: HudActionModel | null = null;

  /**
   * Subscribe to the semantic input bus.
   * @param runner - The battle runner whose state to read and speed to drive.
   */
  constructor(runner: BattleRunner) {
    this.#runner = runner;
    eventsCenter.on(BattleEvents.Input, this.#onInput);
  }

  /**
   * The current battle speed (mirrors the runner).
   * @returns The active speed setting.
   */
  get speed(): BattleSpeed {
    return this.#speed;
  }

  /**
   * The highlighted command's menu index.
   * @returns The highlighted index.
   */
  get highlight(): number {
    return this.#highlight;
  }

  /**
   * The last battle action selected through the menu, or null.
   * @returns The last action, or null.
   */
  get lastAction(): HudActionModel | null {
    return this.#lastAction;
  }

  /**
   * The party index whose turn it is (menu open), or null.
   * @param state - The battle state.
   * @returns The ready party index, or null.
   */
  activeActor(state: BattleState): number | null {
    return firstReadyParty(state);
  }

  /**
   * The resolved (living) target enemy index for the current selection.
   * @param state - The battle state.
   * @returns The targeted enemy index.
   */
  targetEnemy(state: BattleState): number {
    return resolveTarget(state, this.#target);
  }

  /**
   * Handle one device-tagged semantic intent: record it, then route by kind.
   * A stable arrow field so it can be unsubscribed by reference in {@link dispose}.
   * @param intent - The semantic intent.
   * @param device - The originating device.
   * @returns void
   */
  readonly #onInput = (intent: InputIntent, device: InputDevice): void => {
    this.#lastInput = { kind: intent.kind, device };
    switch (intent.kind) {
      case "navigate":
        this.#navigate(intent.delta);
        break;
      case "target":
        this.#cycleTarget(intent.delta);
        break;
      case "confirm":
        this.#confirm(COMMAND_ORDER[this.#highlight], device);
        break;
      case "cancel":
        this.#highlight = 0;
        break;
      case "toggle-speed":
        this.#toggleSpeed();
        break;
      case "select-command":
        this.#selectCommand(intent.command, device);
        break;
      case "select-target":
        this.#selectTarget(intent.index);
        break;
    }
  };

  /**
   * Move the menu highlight by `delta`, wrapping within the command list.
   * @param delta - The navigation step (-1 up, +1 down).
   * @returns void
   */
  #navigate(delta: number): void {
    const count = COMMAND_ORDER.length;
    this.#highlight = (this.#highlight + delta + count) % count;
  }

  /**
   * Cycle the target to the next living enemy in the given direction.
   * @param delta - The cycle direction (-1 previous, +1 next).
   * @returns void
   */
  #cycleTarget(delta: number): void {
    this.#target = nextLivingEnemy(this.#runner.state(), this.#target, delta);
  }

  /**
   * Point the target at a tapped enemy when it is a living, in-range target.
   * @param index - The tapped enemy index.
   * @returns void
   */
  #selectTarget(index: number): void {
    if (enemyAlive(this.#runner.state(), index)) {
      this.#target = index;
    }
  }

  /**
   * Highlight then confirm a tapped command (the touch path). The id arrives as a
   * plain string from the device layer, so it is validated against the catalog
   * here; an unknown id is ignored.
   * @param command - The tapped command id (validated against the catalog).
   * @param device - The originating device.
   * @returns void
   */
  #selectCommand(command: string, device: InputDevice): void {
    const index = COMMAND_ORDER.findIndex(id => id === command);
    const resolved = COMMAND_ORDER[index];
    if (resolved === undefined) {
      return;
    }
    this.#highlight = index;
    this.#confirm(resolved, device);
  }

  /**
   * Confirm a command for the ready party actor: when the actor exists and can
   * pay, publish the action onto the bus and record it as the last action. A
   * closed menu (no ready actor) or an unaffordable command is a no-op.
   * @param command - The command to issue (undefined is ignored).
   * @param device - The device that confirmed it.
   * @returns void
   */
  #confirm(command: CommandId | undefined, device: InputDevice): void {
    const state = this.#runner.state();
    const actor = firstReadyParty(state);
    const member = actor === null ? undefined : state.party[actor];
    if (command === undefined || actor === null || member === undefined) {
      return;
    }
    if (!commandAffordable(command, member.ap, state.grist)) {
      return;
    }
    const target = resolveTarget(state, this.#target);
    eventsCenter.emit(
      BattleEvents.ActionRequested,
      buildAction(
        command,
        { side: BattleSides.party, index: actor },
        { side: BattleSides.enemies, index: target }
      )
    );
    this.#lastAction = { command, device };
  }

  /**
   * Advance the battle speed one step in the toggle cycle and push it to the
   * runner so the change takes effect mid-fight.
   * @returns void
   */
  #toggleSpeed(): void {
    this.#speed = nextSpeed(this.#speed);
    this.#runner.setSpeed(this.#speed);
  }

  /**
   * Reset all controller-owned selection state to its battle-open defaults — the
   * highlight, target, speed, and the last input/action. Called when the
   * verification bridge reseeds the battle so `model()` reflects the fresh fight
   * rather than carrying the prior run's selection forward.
   * @returns void
   */
  reset(): void {
    this.#highlight = 0;
    this.#target = 0;
    this.#speed = DEFAULT_SPEED;
    this.#lastInput = null;
    this.#lastAction = null;
    this.#runner.setSpeed(this.#speed);
  }

  /**
   * Build the full HUD view-model for the verification bridge. Allocates — called
   * on demand under `?uat=1`, never from the per-frame render path.
   * @returns The HUD view-model.
   */
  model(): HudModel {
    const state = this.#runner.state();
    const actor = firstReadyParty(state);
    const member = actor === null ? undefined : state.party[actor];
    const grist = state.grist;
    const target = resolveTarget(state, this.#target);
    return {
      speed: this.#speed,
      speedLabel: speedLabel(this.#speed),
      tickMs: speedTickMs(this.#speed),
      activeActor: actor,
      targetEnemy: target,
      menuOpen: actor !== null,
      grist,
      party: state.party.map((seat, index) => ({
        ref: seat.ref,
        hp: seat.hp,
        maxHp: seat.stats.hp,
        ap: seat.ap,
        maxAp: seat.stats.ap,
        atb: seat.atb,
        ready: seat.hp > 0 && seat.atb >= AtbTuning.ready,
        active: index === actor,
      })),
      commands: COMMAND_ORDER.map((id, index) =>
        this.#commandModel(id, index, member?.ap ?? 0, grist)
      ),
      enemies: state.enemies.map((enemy, index) => ({
        index,
        broken: enemy.broken,
        pressure: enemy.pressure,
        targeted: index === target,
      })),
      lastInput: this.#lastInput,
      lastAction: this.#lastAction,
    };
  }

  /**
   * Build one command's bridge model: label, highlight, affordability, cost, rect.
   * @param id - The command id.
   * @param index - The command's menu index.
   * @param actorAp - The ready actor's AP (0 when none).
   * @param grist - The shared grist pool.
   * @returns The command model.
   */
  #commandModel(
    id: CommandId,
    index: number,
    actorAp: number,
    grist: number
  ): HudCommandModel {
    const cost = commandCost(id);
    return {
      id,
      label: commandLabel(id),
      highlighted: index === this.#highlight,
      affordable: commandAffordable(id, actorAp, grist),
      apCost: cost.ap,
      gristCost: cost.grist,
      rect: commandRect(index),
    };
  }

  /**
   * Unsubscribe from the input bus. Call from the owning scene's shutdown.
   * @returns void
   */
  dispose(): void {
    eventsCenter.off(BattleEvents.Input, this.#onInput);
  }
}
