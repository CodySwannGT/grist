/**
 * The battle-speed / Wait model — a pure, Phaser-free description of the
 * accessibility speed lever (combat-spec "Active / Wait modes",
 * ui-ux-and-controls "Speed control on-screen"). The player cycles through three
 * settings mid-fight: **Wait** freezes the ATB fill outright (the methodical /
 * full-Wait accessibility default), **Normal** fills at {@link BattleTiming.atbTickMs}
 * per tick, and **Fast** fills at the shorter {@link BattleTiming.fastTickMs} (the
 * same gauge change over less wall-clock — a faster observed cadence). The
 * effective per-tick interval is the single number the runner reads to convert
 * elapsed real time into ATB ticks; everything here is a total function of its
 * input so it unit-tests headless.
 * @module game/speed
 */
import { BattleTiming } from "../consts";

/**
 * The three battle-speed settings. Cycled in this declared order by the toggle
 * (Wait → Normal → Fast → Wait). Reference the keyed values rather than inline
 * strings so a typo is a compile error.
 */
export const BattleSpeeds = {
  wait: "wait",
  normal: "normal",
  fast: "fast",
} as const;

/** A battle-speed setting id (`"wait" | "normal" | "fast"`). */
export type BattleSpeed = (typeof BattleSpeeds)[keyof typeof BattleSpeeds];

/** The default speed a battle opens in: Normal (gauges fill, pause when ready). */
export const DEFAULT_SPEED: BattleSpeed = BattleSpeeds.normal;

/** The order the speed toggle steps through, wrapping back to the first. */
const SPEED_CYCLE: readonly BattleSpeed[] = [
  BattleSpeeds.wait,
  BattleSpeeds.normal,
  BattleSpeeds.fast,
];

/** Human-readable labels for the HUD speed widget, keyed by speed id. */
const SPEED_LABELS: Record<BattleSpeed, string> = {
  wait: "WAIT",
  normal: "NORMAL",
  fast: "FAST",
};

/** Per-tick real-time interval (ms) for each speed; `null` means fill is frozen. */
const SPEED_TICK_MS: Record<BattleSpeed, number | null> = {
  wait: null,
  normal: BattleTiming.atbTickMs,
  fast: BattleTiming.fastTickMs,
};

/**
 * The effective per-tick interval (ms) for a speed, or `null` when the gauge is
 * frozen (Wait). The runner divides elapsed real time by this to decide how many
 * ATB ticks to apply, so a smaller interval is a visibly faster cadence.
 * @param speed - The current battle speed.
 * @returns The tick interval in ms, or null when fill is paused.
 */
export function speedTickMs(speed: BattleSpeed): number | null {
  return SPEED_TICK_MS[speed];
}

/**
 * The next speed in the toggle cycle (Wait → Normal → Fast → Wait), so a single
 * control reaches every setting mid-fight.
 * @param speed - The current battle speed.
 * @returns The speed the toggle advances to.
 */
export function nextSpeed(speed: BattleSpeed): BattleSpeed {
  const index = SPEED_CYCLE.indexOf(speed);
  return SPEED_CYCLE[(index + 1) % SPEED_CYCLE.length] ?? DEFAULT_SPEED;
}

/**
 * The HUD label for a speed setting (e.g. `"WAIT"`, `"NORMAL"`, `"FAST"`).
 * @param speed - The speed to label.
 * @returns The display label.
 */
export function speedLabel(speed: BattleSpeed): string {
  return SPEED_LABELS[speed];
}
