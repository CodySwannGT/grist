/**
 * Vitest Configuration - Project-Local Customizations
 *
 * Add project-specific Vitest settings here. This file is create-only,
 * meaning Lisa will create it but never overwrite your customizations.
 *
 * Example:
 * ```ts
 * import type { ViteUserConfig } from "vitest/config";
 *
 * const config: ViteUserConfig = {
 *   resolve: {
 *     alias: {
 *       "@/": new URL("./src/", import.meta.url).pathname,
 *     },
 *   },
 * };
 *
 * export default config;
 * ```
 *
 * @see https://vitest.dev/config/
 * @module vitest.config.local
 */
import type { ViteUserConfig } from "vitest/config";

/**
 * Phaser-coupled adapters (scenes, game objects, services, the Phaser.Game
 * bootstrap, the verification bridge, and the Phaser-bound HUD adapters) are not
 * unit-tested — they import Phaser (which cannot load in the headless vitest
 * environment) and are verified instead by the Playwright UAT/verification suite
 * (tests/e2e). Unit coverage is measured on the pure, engine-free core. The HUD's
 * *pure* helpers — `src/ui/commands.ts` and `src/ui/layout.ts` — are Phaser-free
 * and carry their own unit tests, so they stay IN coverage; only the three
 * Phaser-bound `src/ui` adapters are excluded, named individually rather than by
 * a blanket `src/ui/**` glob.
 */
const config: ViteUserConfig = {
  test: {
    coverage: {
      exclude: [
        "src/services/**",
        "src/objects/**",
        "src/game/**",
        "src/ui/battle-hud.ts",
        "src/ui/battle-controller.ts",
        "src/ui/hud-text.ts",
        "src/uat/**",
        "src/main.ts",
        "src/scenes/**",
        "src/types/**",
        "src/vite-env.d.ts",
      ],
    },
  },
};

export default config;
