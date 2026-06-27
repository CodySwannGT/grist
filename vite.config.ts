import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Vite config for the Phaser 4 starter.
 * - `base: "./"` so the build works under any host path (override for GH Pages).
 * - `manualChunks` splits the large `phaser` vendor chunk so game-code redeploys
 *   don't bust the engine cache.
 * - PWA precaches the app shell and game assets for offline play.
 */
export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,png,jpg,svg,webp,woff2,json,mp3,m4a,ogg,fnt}",
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: "es2022",
    // The Phaser engine is a large vendor chunk by design (split out below);
    // raise the warning ceiling so the expected size isn't flagged.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Function form (not the object form) — Vite 8's rolldown bundler
        // requires manualChunks to be a function. Splits the large `phaser`
        // engine into its own cached chunk so game-code redeploys don't bust it.
        manualChunks: (id: string) =>
          id.includes("node_modules/phaser") ? "phaser" : undefined,
      },
    },
  },
});
