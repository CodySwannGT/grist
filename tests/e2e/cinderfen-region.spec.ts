/**
 * The Cinderfen region verification (UAT) suite — the live-canvas half of the
 * Validation Journey for #131. Boots the rendered Region scene directly at
 * `?scene=region&region=cinderfen` (and `&world=ashfall`) and drives it through the
 * in-game `window.__VERIFY__` bridge to prove, empirically against the live 384×216
 * canvas, that the Cinderfen — the ashlands: strip-mined, magic-dead wastes of
 * abandoned grist-mines and dead refineries — authored against the shipped framework
 * boots in BOTH world-states, renders cleanly, and digests deterministically across a
 * genuine page reload.
 *
 * Mirrors `tests/e2e/holtspire-region.spec.ts` (itself a mirror of the framework's
 * #137 `region-harness.spec.ts`): the harness is reusable per region, so the same spec
 * shape verifies the Cinderfen with no engine-code edit — the `?region=cinderfen`
 * query routes the pure `src/logic/region` harness through `requestedRegion`. The
 * Phaser-free unit twin (`tests/logic/cinderfen-region.test.ts`) proves the
 * both-states data + determinism logic headlessly; this spec proves it on the live,
 * rendered canvas. The Morrath Bound-site free-vs-wield is verified separately in
 * `tests/e2e/morrath-bound-site.spec.ts`.
 *
 * The Cinderfen is the region that BARELY changes across the Reckoning — already ruin
 * in the Reach, and in the Ashfall the rest of the world just looks like it — so its
 * observable Reach→Ashfall divergence is NOT the tone (ashen in both by design) but
 * the ENCOUNTER TABLE, which is exactly what makes the resolved determinism hash
 * differ between the two boots below.
 *
 * Evidence marker (the required test title):
 * - [EVIDENCE: cinderfen-plays-both-states] — the region boots and reads in both the
 *   Reach (Act I) and Ashfall (Act II) world-states.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 0xc1de;

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
 * Boot the Region scene directly at the Cinderfen region with the bridge enabled.
 * The `?scene=region` query starts the Region scene; `?region=cinderfen` selects the
 * Cinderfen; `?world=ashfall` (optional) boots straight into the Act II variant; and
 * `?seed=` pins the seeded RNG so the run is reproducible.
 * @param page - The Playwright page.
 * @param world - The `?world=` selector (omitted for the default `reach`).
 * @param seed - The fixed boot seed (defaults to {@link FIXED_SEED}).
 */
async function bootCinderfen(
  page: Page,
  world?: "ashfall",
  seed: number = FIXED_SEED
): Promise<void> {
  const worldQuery = world ? `&world=${world}` : "";
  await page.goto(
    `/?scene=region&uat=1&seed=${seed}&region=cinderfen${worldQuery}`
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

test.describe("GRIST — the Cinderfen region verification (UAT, #131)", () => {
  test("[EVIDENCE: cinderfen-plays-both-states] boots the Cinderfen to the 384x216 side-view with zero console errors and is deterministic across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootCinderfen(page);
    await expect(page.locator("canvas")).toBeVisible();

    // The harness booted the Cinderfen cleanly in its Reach (Act I) world-state.
    const run = await regionRun(page);
    expect(run).not.toBeNull();
    expect(run!.scene).toBe("Region");
    expect(run!.runtimeScene).toBe("region:cinderfen");
    expect(run!.regionId).toBe("cinderfen");
    expect(run!.worldState).toBe("reach");
    expect(run!.booted).toBe(true);
    expect(run!.error).toBeNull();
    // Every region currently resolves the shared Marrow parallax set's far layer —
    // The per-region backdrop pass (#200) gives the Cinderfen its OWN distinct
    // parallax set (an ashen-fen palette variant of the CC0 Warped City layers);
    // the scene renders exactly this key, an asset the loader can resolve.
    expect(run!.backdrop).toBe("img-cinderfen/bg-far");
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
    await bootCinderfen(page);
    const secondHashes = await driveAndSampleHashes(page);
    expect(secondHashes).toEqual(firstHashes);

    // The whole point of the success path: zero console errors.
    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: cinderfen-plays-both-states] boots the Cinderfen directly into its Ashfall world-state, observably different from Reach", async ({
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
    await bootCinderfen(page);
    const reachRun = await regionRun(page);
    expect(reachRun!.booted).toBe(true);
    expect(reachRun!.worldState).toBe("reach");

    // Boot the SAME region + SAME seed directly into the Ashfall (Act II) variant.
    await bootCinderfen(page, "ashfall");
    await expect(page.locator("canvas")).toBeVisible();

    const ashfallRun = await regionRun(page);
    expect(ashfallRun).not.toBeNull();
    expect(ashfallRun!.scene).toBe("Region");
    expect(ashfallRun!.runtimeScene).toBe("region:cinderfen");
    expect(ashfallRun!.regionId).toBe("cinderfen");
    expect(ashfallRun!.booted).toBe(true);
    expect(ashfallRun!.error).toBeNull();
    expect(ashfallRun!.hash).toMatch(/^[0-9a-f]{8}$/);

    // The Ashfall boot resolves an OBSERVABLY different state than Reach at the same
    // seed: a different world-state AND a different resolved determinism hash (the
    // Cinderfen's Ashfall cinder-wastes encounter table differs from the Reach
    // strip-mines table, even though the region reads ashen in both by design).
    expect(ashfallRun!.worldState).toBe("ashfall");
    expect(ashfallRun!.worldState).not.toBe(reachRun!.worldState);
    expect(ashfallRun!.hash).not.toBe(reachRun!.hash);

    expect(errors).toEqual([]);
  });
});
