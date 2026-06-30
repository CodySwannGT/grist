/**
 * The Roots / the Deep region verification (UAT) suite — the live-canvas half of
 * the Validation Journey for #143. Boots the rendered Region scene directly at
 * `?scene=region&region=roots` (and `&world=ashfall`) and drives it through the
 * in-game `window.__VERIFY__` bridge to prove, empirically against the live 384×216
 * canvas, that the Roots region authored against the shipped framework boots in
 * BOTH world-states, renders cleanly, and digests deterministically across a
 * genuine page reload.
 *
 * Mirrors `tests/e2e/region-harness.spec.ts` (the framework's own #137 spec): the
 * harness is reusable per region, so the same spec shape verifies the Roots region
 * with no engine-code edit — the `?region=roots` query routes the pure
 * `src/logic/region` harness through {@link requestedRegion}. The Phaser-free unit
 * twin (`tests/logic/roots-region.test.ts`) proves the both-states data + determinism
 * logic headlessly; this spec proves it on the live, rendered canvas.
 *
 * Evidence markers (the two required test titles):
 * - [EVIDENCE: roots-region-loads-reach] — the success/Reach path.
 * - [EVIDENCE: roots-region-loads-ashfall] — the world-state variant/Ashfall path.
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
  readonly scene: string;
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
 * Boot the Region scene directly at the Roots region with the bridge enabled. The
 * `?scene=region` query starts the Region scene; `?region=roots` selects the Roots
 * region; `?world=ashfall` (optional) boots straight into the Act II variant; and
 * `?seed=` pins the seeded RNG so the run is reproducible.
 * @param page - The Playwright page.
 * @param world - The `?world=` selector (omitted for the default `reach`).
 * @param seed - The fixed boot seed (defaults to {@link FIXED_SEED}).
 */
async function bootRoots(
  page: Page,
  world?: "ashfall",
  seed: number = FIXED_SEED
): Promise<void> {
  const worldQuery = world ? `&world=${world}` : "";
  await page.goto(
    `/?scene=region&uat=1&seed=${seed}&region=roots${worldQuery}`
  );
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

test.describe("GRIST — the Roots / the Deep region verification (UAT, #143)", () => {
  test("[EVIDENCE: roots-region-loads-reach] boots the Roots region to the 384x216 side-view with zero console errors and is deterministic across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootRoots(page);
    await expect(page.locator("canvas")).toBeVisible();

    // The harness booted the Roots region cleanly in its Reach (Act I) world-state.
    const run = await regionRun(page);
    expect(run).not.toBeNull();
    expect(run!.scene).toBe("Region");
    expect(run!.runtimeScene).toBe("region:roots");
    expect(run!.regionId).toBe("roots");
    expect(run!.worldState).toBe("reach");
    expect(run!.booted).toBe(true);
    expect(run!.error).toBeNull();
    expect(run!.backdrop).toBe("region-backdrop");
    expect(run!.hash).toMatch(/^[0-9a-f]{8}$/);
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

    // Drive a real multi-step script, sampling the determinism hash after each step.
    const firstHashes = await driveAndSampleHashes(page);
    const firstRun = await regionRun(page);
    expect(firstRun!.cursor).toBeGreaterThan(0);
    // The fixed script fires the Reckoning, so the run warped to its Ashfall variant.
    expect(firstRun!.worldState).toBe("ashfall");
    expect(firstHashes.every(hash => /^[0-9a-f]{8}$/.test(hash))).toBe(true);
    expect(new Set(firstHashes).size).toBeGreaterThan(1);

    // A GENUINE full reload at the SAME seed + SAME action sequence reproduces a
    // byte-identical hash progression — the determinism thesis on the live canvas.
    await bootRoots(page);
    const secondHashes = await driveAndSampleHashes(page);
    expect(secondHashes).toEqual(firstHashes);

    // The whole point of the success path: zero console errors.
    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: roots-region-loads-ashfall] boots the Roots region directly into its Ashfall world-state, observably different from Reach", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    // Capture the Reach boot snapshot first (same seed) so the Ashfall divergence is
    // a like-for-like comparison.
    await bootRoots(page);
    const reachRun = await regionRun(page);
    expect(reachRun!.booted).toBe(true);
    expect(reachRun!.worldState).toBe("reach");

    // Boot the SAME region + SAME seed directly into the Ashfall (Act II) variant.
    await bootRoots(page, "ashfall");
    await expect(page.locator("canvas")).toBeVisible();

    const ashfallRun = await regionRun(page);
    expect(ashfallRun).not.toBeNull();
    expect(ashfallRun!.scene).toBe("Region");
    expect(ashfallRun!.runtimeScene).toBe("region:roots");
    expect(ashfallRun!.regionId).toBe("roots");
    expect(ashfallRun!.booted).toBe(true);
    expect(ashfallRun!.error).toBeNull();
    expect(ashfallRun!.hash).toMatch(/^[0-9a-f]{8}$/);

    // The Ashfall boot resolves an OBSERVABLY different state than Reach at the same
    // seed: a different world-state AND a different resolved determinism hash (the
    // Ashfall encounter table differs from the Reach table).
    expect(ashfallRun!.worldState).toBe("ashfall");
    expect(ashfallRun!.worldState).not.toBe(reachRun!.worldState);
    expect(ashfallRun!.hash).not.toBe(reachRun!.hash);

    expect(errors).toEqual([]);
  });
});
