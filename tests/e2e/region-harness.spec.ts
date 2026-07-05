/**
 * Region-harness verification (UAT) suite — the Validation Journey for #137. Boots
 * the rendered Region scene directly via `?scene=region` and drives it through the
 * in-game `window.__VERIFY__` bridge to prove, empirically against the live canvas,
 * the issue's two acceptance scenarios:
 *
 * - [region-e2e-harness-runs] (AC scenario 1) a region authored against the
 *   {@link RegionDef} template boots under `?uat=1`, is playable through the harness
 *   (`__VERIFY__.scene()` reports the Region scene, `regionRun()` reads the booted
 *   session, `act()` drives `advance` / `reckon`), AND the SAME seed + SAME action
 *   sequence reproduces an identical `__VERIFY__.hash()` across a genuine page reload
 *   — the scene-agnostic analogue of the battle state-hash determinism gate.
 * - [region-boot-no-console-errors] (AC scenario 2) a region booted with a fixed
 *   seed renders the 384×216 side-view at integer zoom and emits ZERO console
 *   errors; and a region that THROWS on boot (`?region=broken`) is CAUGHT by the
 *   harness and surfaced as an observable failure (`booted: false`, a non-null
 *   error, the boot-failed phase) — it fails the harness rather than crashing the
 *   page (no unhandled pageerror).
 *
 * The harness is reusable per region: the Region scene boots whatever region the
 * `?region=` query selects through the pure `src/logic/region` harness, so this same
 * spec shape verifies any region. The Phaser-free unit twin
 * (`tests/logic/region-runtime.test.ts`) proves the boot-throw and determinism logic
 * headlessly; this spec proves it on the live, rendered canvas.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 0x51ed;

/** The render-scale snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/** The booted-region-scene snapshot the harness bridge exposes via `regionRun()`. */
interface RegionRun {
  /** The Phaser scene key (`"Region"`) — same as `__VERIFY__.scene()`. */
  readonly scene: string;
  /** The region-scoped harness key the session declares (e.g. `"region:marrow"`). */
  readonly runtimeScene: string;
  readonly regionId: string;
  readonly worldState: string;
  readonly backdrop: string;
  readonly cursor: number;
  readonly cleared: readonly string[];
  readonly phase: string;
  readonly booted: boolean;
  readonly error: string | null;
  readonly hash: string;
}

/**
 * Wait until the running game reports the given scene key — proof the requested
 * scene actually booted (not merely that the bridge installed).
 * @param page - The Playwright page.
 * @param key - The expected scene key.
 */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/**
 * Boot the Region scene directly at a fixed seed with the bridge enabled. The
 * `?scene=region` query is what makes the Preloader start Region instead of Battle;
 * `?region=` selects which region (default `marrow`, `broken` for the throw path)
 * and `?seed=` pins the seeded RNG so the run is reproducible.
 * @param page - The Playwright page.
 * @param region - The `?region=` selector (omitted for the default `marrow`).
 * @param seed - The fixed boot seed (defaults to {@link FIXED_SEED}).
 */
async function bootRegion(
  page: Page,
  region?: string,
  seed: number = FIXED_SEED
): Promise<void> {
  const regionQuery = region ? `&region=${region}` : "";
  await page.goto(`/?scene=region&uat=1&seed=${seed}${regionQuery}`);
  await waitForScene(page, "Region");
}

/**
 * Read the booted region-scene snapshot from the harness bridge.
 * @param page - The Playwright page.
 * @returns The `regionRun()` snapshot, or null outside the Region scene.
 */
async function regionRun(page: Page): Promise<RegionRun | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.regionRun() ?? null) as RegionRun | null
  );
}

/**
 * Drive the harness through a fixed action sequence, sampling the determinism hash
 * after each step. The sampled progression is the determinism evidence — the same
 * seed + same sequence must reproduce it byte-for-byte across a reload.
 * @param page - The Playwright page.
 * @returns The hash sampled at boot and after each driven action.
 */
async function driveAndSampleHashes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const api = window.__VERIFY__!;
    // A fixed, deterministic action script: advance twice, fire the Reckoning,
    // then advance once more against the warped variant.
    const actions = [
      { kind: "advance" },
      { kind: "advance" },
      { kind: "reckon" },
      { kind: "advance" },
    ] as const;
    const hashes = [api.hash() ?? ""];
    for (const action of actions) {
      api.act(action);
      hashes.push(api.hash() ?? "");
    }
    return hashes;
  });
}

test.describe("GRIST — region-harness verification (UAT, #137)", () => {
  test("[region-boot-no-console-errors] boots a region to the 384x216 side-view with zero console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootRegion(page);
    await expect(page.locator("canvas")).toBeVisible();

    // The harness booted the template-authored region cleanly. Assert BOTH scene
    // contracts at their correct level: the Phaser scene key (`"Region"`, the same
    // value `__VERIFY__.scene()` reports) AND the region-scoped harness key the
    // booted session declares (`region:marrow`) — they are distinct, and the snapshot
    // surfaces each so neither contract is asserted against the wrong key.
    const run = await regionRun(page);
    expect(run).not.toBeNull();
    expect(run!.scene).toBe("Region");
    expect(run!.runtimeScene).toBe("region:marrow");
    expect(await page.evaluate(() => window.__VERIFY__!.scene())).toBe(
      "Region"
    );
    expect(run!.regionId).toBe("marrow");
    expect(run!.booted).toBe(true);
    expect(run!.error).toBeNull();
    // The scene renders exactly the backdrop key the run state declares (the shared
    // placeholder until per-region art exists) — never an asset Phaser can't load.
    expect(run!.backdrop).toBe("img-marrow/bg-far");
    expect(run!.hash).toMatch(/^[0-9a-f]{8}$/);
    // `__VERIFY__.hash()` dispatches to the booted region session, matching the
    // snapshot's digest — the determinism gate samples this same entry point.
    expect(await page.evaluate(() => window.__VERIFY__!.hash())).toBe(
      run!.hash
    );

    // The 384×216 side-view rendered at integer zoom (the rendering contract).
    const resolution = (await page.evaluate(() =>
      window.__VERIFY__?.resolution()
    )) as Resolution | null | undefined;
    expect(resolution?.width).toBe(384);
    expect(resolution?.height).toBe(216);
    expect(resolution?.zoom).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(resolution?.zoom)).toBe(true);

    const canvas = await page.evaluate(() => {
      const element = document.querySelector("canvas");
      return element ? { width: element.width, height: element.height } : null;
    });
    expect(canvas).toEqual({ width: 384, height: 216 });

    // The whole point of AC scenario 2's success half: zero console errors.
    expect(errors).toEqual([]);
  });

  test("[region-boot-no-console-errors] a region that throws on boot is caught and fails the harness", async ({
    page,
  }) => {
    // A region throwing on boot must be CAUGHT by the harness, never surfaced as an
    // unhandled exception — so the page must emit no uncaught pageerror.
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    await bootRegion(page, "broken");
    await expect(page.locator("canvas")).toBeVisible();

    // The harness observed the broken region as a FAILURE, not a render: not booted,
    // a non-null caught error, the boot-failed phase. A bad region fails the harness.
    const run = await regionRun(page);
    expect(run).not.toBeNull();
    expect(run!.scene).toBe("Region");
    expect(run!.booted).toBe(false);
    expect(run!.error).not.toBeNull();
    expect(run!.error).toMatch(/incomplete|ashfall/i);
    expect(run!.phase).toBe("boot-failed");

    // The boot threw INSIDE the harness's try/catch — the page never saw an
    // uncaught exception (the harness contained it, AC scenario 2).
    expect(pageErrors).toEqual([]);
  });

  test("[region-e2e-harness-runs] a region is playable through the harness and is deterministic across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    // First play-through: boot at the fixed seed and drive the fixed action script,
    // sampling the determinism hash after each step.
    await bootRegion(page);
    const before = await regionRun(page);
    expect(before!.booted).toBe(true);
    expect(before!.cursor).toBe(0);
    expect(before!.worldState).toBe("reach");

    const firstHashes = await driveAndSampleHashes(page);
    // A real multi-step run drove the harness: the session advanced and the
    // Reckoning warped its variant (cursor moved, world-state flipped to ashfall).
    const firstRun = await regionRun(page);
    expect(firstRun!.cursor).toBeGreaterThan(0);
    expect(firstRun!.worldState).toBe("ashfall");
    expect(firstHashes.every(hash => /^[0-9a-f]{8}$/.test(hash))).toBe(true);
    // The progression moved through more than one distinct hash — not a no-op pass.
    expect(new Set(firstHashes).size).toBeGreaterThan(1);

    // Second play-through: a GENUINE full reload (fresh document, fresh bridge) at
    // the SAME seed driving the SAME action sequence.
    await bootRegion(page);
    const secondHashes = await driveAndSampleHashes(page);

    // The determinism thesis: same seed + same actions ⇒ a byte-identical hash
    // progression across the reload (AC scenario 1).
    expect(secondHashes).toEqual(firstHashes);

    expect(errors).toEqual([]);
  });

  test("[region-e2e-harness-runs] a different seed diverges the harness hash (a real seeded stream)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Same region + same action script, but a different seed.
    await bootRegion(page, undefined, FIXED_SEED);
    const seededHashes = await driveAndSampleHashes(page);

    await bootRegion(page, undefined, FIXED_SEED + 1);
    const divergedHashes = await driveAndSampleHashes(page);

    // A different seed threads a different RNG stream, so the terminal digest
    // diverges — proof the hash folds a real seeded stream, not a constant.
    expect(divergedHashes[divergedHashes.length - 1]).not.toBe(
      seededHashes[seededHashes.length - 1]
    );

    expect(errors).toEqual([]);
  });
});
