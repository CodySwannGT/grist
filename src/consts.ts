/**
 * Typed constants for the game: scene keys, the cross-cutting battle event name,
 * and the side-view battle layout / timing tunables. Never inline these as magic
 * strings/numbers in game code — import from here so a rename is a single edit and
 * a typo is a compile error.
 * @module consts
 */

/**
 * Scene registry keys. The boot flow is Boot → Preloader → Battle: the game boots
 * straight into the side-view battle (decision 0006, V1/V2). Title/menu and the
 * terminal win/lose screens arrive in later sub-tasks.
 */
export const SceneKeys = {
  Boot: "Boot",
  Preloader: "Preloader",
  Battle: "Battle",
} as const;

/**
 * Cross-cutting battle event names emitted on the EventsCenter bus (never on
 * `game.events`). The scene/controller publishes a player/verification-driven
 * {@link import("./logic/combat").BattleAction} as `ActionRequested`; the battle
 * adapter (sim owner) subscribes and threads it through the pure reducer. The
 * semantic {@link import("./services/input").InputService} publishes device-tagged
 * UI intents as `Input`; the HUD controller subscribes and drives the menu. Raw
 * keys/pointers never leave the InputService — only these named intents do.
 */
export const BattleEvents = {
  ActionRequested: "battle-action-requested",
  Input: "battle-input",
} as const;

/** Render depth of the battle HUD, above the pooled combatant views (depth 0). */
export const HUD_DEPTH = 100;

/**
 * The native (internal) render resolution. Locked to 384×216, integer-scaled and
 * landscape-first per decision 0006 (V2). The scene renders against these logical
 * units; the ScaleManager scales the canvas to the viewport by an integer factor.
 */
export const GameView = {
  width: 384,
  height: 216,
} as const;

/**
 * Side-view battle layout (FFVI-style): enemies anchored left, party right, each
 * side a vertically-stacked, slightly depth-staggered column. All units are
 * logical (384×216) pixels. Tuned first-pass; the *shape* (two facing columns over
 * a ground line) is the contract, not the constants.
 */
export const BattleLayout = {
  /** Y of the ground/horizon line dividing the backdrop. */
  groundY: 150,
  /** Center X of the enemy column (left). */
  enemyAnchorX: 100,
  /** Center X of the party column (right). */
  partyAnchorX: 284,
  /** Center Y of the first (front) combatant row. */
  firstRowY: 96,
  /** Vertical distance between stacked combatants on a side. */
  rowGap: 44,
  /** Per-row horizontal stagger toward screen center (depth cue). */
  rowStaggerX: 14,
  /** Placeholder unit body width. */
  unitWidth: 26,
  /** Placeholder unit body height. */
  unitHeight: 38,
  /** HP / ATB bar width. */
  barWidth: 44,
  /** HP bar height. */
  hpBarHeight: 5,
  /** ATB bar height. */
  atbBarHeight: 3,
  /** Gap between the unit's feet and the first bar, and between bars. */
  barGap: 3,
} as const;

/** Battle placeholder-art and chrome colors (programmatic art only — no assets). */
export const BattleColors = {
  backdropSky: 0x141821,
  backdropGround: 0x222a39,
  groundLine: 0x39455c,
  partyTint: 0x6fd08c,
  enemyTint: 0xd0706f,
  downedTint: 0x4a4f5a,
  hpBarBg: 0x2a2030,
  hpBarFill: 0x57c969,
  atbBarBg: 0x1d2738,
  atbBarFill: 0x4cc2e0,
  title: "#ffd166",
} as const;

/**
 * Battle timing. `atbTickMs` is the Normal-speed real-time step at which the
 * adapter applies one ATB `tick` to the sim while a side is filling its gauges;
 * `fastTickMs` is the shorter Fast-speed step (the same number of ticks over less
 * wall-clock — a faster observable cadence). Ticking pauses the moment a combatant
 * is ready to act, and the full-Wait speed pauses it outright (combat-spec).
 */
export const BattleTiming = {
  atbTickMs: 100,
  fastTickMs: 50,
} as const;
