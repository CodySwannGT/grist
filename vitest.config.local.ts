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
 * Phaser-coupled adapters (scenes, game objects, services, the HUD/UI layer, the
 * Phaser.Game bootstrap, and the verification bridge) are not unit-tested — they
 * import Phaser (which cannot load in the headless vitest environment) and are
 * verified instead by the Playwright UAT/verification suite (tests/e2e). Unit
 * coverage is measured on the pure, engine-free core in src/logic and the typed
 * constant/content modules. This mirrors the upstream config, which already
 * excludes scenes; the pure UI helpers (commands, the key→intent map, the speed
 * model) still carry their own unit tests in tests/logic — they simply live in
 * Phaser-adapter directories, exactly like the already-excluded services layer.
 */
const config: ViteUserConfig = {
  test: {
    coverage: {
      exclude: [
        "src/services/**",
        "src/objects/**",
        "src/game/**",
        "src/ui/**",
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
