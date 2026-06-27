/**
 * Typed constants for the game: scene keys, cross-cutting event names, and
 * gameplay tunables. Never inline these as magic strings/numbers in game code —
 * import from here so a rename is a single edit and a typo is a compile error.
 * @module consts
 */

/**
 * Scene registry keys. The boot flow is Boot → Preloader → MainMenu → Game →
 * GameOver.
 */
export const SceneKeys = {
  Boot: "Boot",
  Preloader: "Preloader",
  MainMenu: "MainMenu",
  Game: "Game",
  GameOver: "GameOver",
} as const;

/**
 * Cross-cutting event names emitted on the EventsCenter bus (never on
 * `game.events`). UI/HUD subscribe to these; the Game scene publishes them.
 */
export const GameEvents = {
  ScoreChanged: "score-changed",
  LifeLost: "life-lost",
  GameOver: "game-over",
} as const;

/**
 * Keys for cross-scene state stored in the global Phaser registry (survives
 * scene transitions). Use these typed keys, never inline strings.
 */
export const RegistryKeys = {
  LastScore: "lastScore",
  HighScore: "highScore",
} as const;

/**
 * Gameplay tunables. Single source of truth for sim + render dimensions and
 * difficulty. The pure sim reads these; scenes render against them.
 */
export const Tunables = {
  width: 800,
  height: 600,
  playerY: 540,
  playerHalfWidth: 36,
  playerSpeed: 460,
  itemFallSpeed: 230,
  itemRadius: 16,
  spawnInterval: 0.85,
  catchRadius: 52,
  startingLives: 3,
  maxItems: 24,
} as const;
