/**
 * Out-of-order region-identity regression guard (UAT) — the manifest for #274.
 *
 * #274 (a duplicate manifestation of #273's root cause, fixed by PR #277) reported that
 * clearing regions OUT OF SEQUENTIAL ORDER mislabelled the run: the region-complete
 * banner and the world-map "◄ here" marker named a DIFFERENT region than the one played
 * (usually the first-listed, "The Marrow …"), and a premature "Region cleared (2/2)"
 * banner fired after a single encounter. The cause was Act II reunion story-nodes routing
 * into their already-cleared anchor region (#241 → fixed in #277), which showed that
 * region's stale summary and drifted "here". This spec locks the corrected behavior so no
 * #274-style desync can slip back:
 *
 * - [EVIDENCE: region-labels-out-of-order] travelling to a NON-sequential available
 *   region and clearing it keeps the run's identity on the region actually played (its
 *   `regionRun().regionId`), and the cursor advances one encounter at a time — never a
 *   premature completion — in BOTH the Act I reach and the Act II ashfall map. And an Act
 *   II reunion node opens its OWN Reunion surface, never a region travel.
 *
 * The live region identity (`regionRun().regionId`) is exactly the value the region-name
 * banner renders and the value `setCurrentRegion` records for the "◄ here" marker — both
 * are read from the one `regionId` the travel dispatches — so proving the identity proves
 * the labels.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const KEY_DWELL = 150;

/** Wait until the running game reports the given scene key. */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/** Wait until the `__VERIFY__` bridge is installed with the travel + battle entry points. */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.__VERIFY__?.worldMapSurface === "function" &&
            typeof window.__VERIFY__?.autoWin === "function" &&
            typeof window.__VERIFY__?.regionRun === "function"
        ),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/** Focus the game canvas so real keyboard events reach Phaser. */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/** Press a key, then dwell so the next keystroke lands in its own Phaser tick. */
async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(KEY_DWELL);
}

/** The live booted region run's identity + cursor + phase, or null outside a region. */
async function region(
  page: Page
): Promise<{ regionId: string; cursor: number; phase: string } | null> {
  return page.evaluate(() => {
    const r = window.__VERIFY__?.regionRun();
    return r
      ? { regionId: r.regionId, cursor: r.cursor, phase: r.phase }
      : null;
  });
}

/** Win the region encounter under the cursor through a REAL battle, back to Region. */
async function winRegionEncounter(page: Page): Promise<void> {
  await press(page, "Enter");
  await waitForScene(page, "Battle");
  await page.evaluate(() => window.__VERIFY__?.autoWin());
  await waitForScene(page, "Region");
  await focusCanvas(page);
}

/** Step the world-map cursor down `n` rows from the top (the cursor resets to 0 on entry). */
async function cursorDown(page: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await press(page, "ArrowDown");
  }
}

/** The persisted world-map surface (re-adopted from the save first). */
async function readSurface(page: Page): Promise<{
  regions: readonly { id: string; status: string }[];
  reunions: readonly { id: string }[];
}> {
  return page.evaluate(async () => {
    await window.__VERIFY__!.loadSave();
    const s = window.__VERIFY__!.worldMapSurface().surface;
    return {
      regions: s.regions.map(r => ({ id: r.id, status: r.status })),
      reunions: s.reunions.map(r => ({ id: r.id })),
    };
  });
}

test.describe("GRIST — out-of-order region identity (UAT, #274)", () => {
  test("[EVIDENCE: region-labels-out-of-order] Act I: clearing a non-sequential region keeps its own identity, no premature completion", async ({
    page,
  }) => {
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave());
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);

    // Two regions are available from the start: marrow (row 0) and upper-vanta (row 2).
    // Travel to upper-vanta FIRST — the non-sequential clear that #274 mislabelled.
    const before = await readSurface(page);
    expect(before.regions.find(r => r.id === "marrow")?.status).toBe(
      "available"
    );
    expect(before.regions.find(r => r.id === "upper-vanta")?.status).toBe(
      "available"
    );

    await cursorDown(page, 2); // marrow(0) -> roots(1) -> upper-vanta(2)
    await press(page, "Enter");
    await waitForScene(page, "Region");
    await focusCanvas(page);

    // Identity is the region actually travelled to — NOT the first-listed "marrow".
    expect((await region(page))?.regionId).toBe("upper-vanta");
    expect((await region(page))?.cursor).toBe(0);

    // The cursor advances ONE encounter at a time — no premature "cleared (2/2)".
    await winRegionEncounter(page);
    const afterOne = await region(page);
    expect(afterOne?.regionId).toBe("upper-vanta");
    expect(afterOne?.cursor).toBe(1);
    expect(afterOne?.phase).not.toBe("complete");

    await winRegionEncounter(page);
    const afterTwo = await region(page);
    expect(afterTwo?.cursor).toBe(2);
    expect(afterTwo?.phase).toBe("complete");

    // Back to the map, then clear ANOTHER non-sequential region (sylvemarch, now unlocked
    // by upper-vanta) — it boots at its OWN cursor 0, not a stale premature completion.
    await press(page, "Escape");
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);
    const after = await readSurface(page);
    expect(after.regions.find(r => r.id === "sylvemarch")?.status).toBe(
      "available"
    );

    await cursorDown(page, 3); // marrow(0) -> roots(1) -> upper-vanta(2) -> sylvemarch(3)
    await press(page, "Enter");
    await waitForScene(page, "Region");
    await focusCanvas(page);
    const sylve = await region(page);
    expect(sylve?.regionId).toBe("sylvemarch");
    expect(sylve?.cursor).toBe(0);
    expect(sylve?.phase).not.toBe("complete");
  });

  test("[EVIDENCE: region-labels-out-of-order] Act II ashfall: a non-sequential clear keeps its identity, and a reunion node opens its own surface", async ({
    page,
  }) => {
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave());
    // Turn the world to ashfall via the persisted save (the whole map re-opens, nonlinear).
    await page.evaluate(async () => {
      const fresh = await window.__VERIFY__!.loadSave();
      await window.__VERIFY__!.save({ ...fresh, worldState: "ashfall" });
    });
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);

    const surface = await readSurface(page);
    expect(surface.regions.every(r => r.status !== "locked")).toBe(true);
    expect(surface.reunions.length).toBeGreaterThan(0);

    // Clear cinderfen (row 5) out of order — its banner named "Marrow Ashfall" in #274.
    await cursorDown(page, 5);
    await press(page, "Enter");
    await waitForScene(page, "Region");
    await focusCanvas(page);
    expect((await region(page))?.regionId).toBe("cinderfen");
    expect((await region(page))?.cursor).toBe(0);

    await winRegionEncounter(page);
    const afterOne = await region(page);
    expect(afterOne?.regionId).toBe("cinderfen");
    expect(afterOne?.cursor).toBe(1);
    expect(afterOne?.phase).not.toBe("complete");

    // A reunion story-node (rows after the 7 regions) opens its OWN Reunion surface,
    // never a travel into its already-cleared anchor region (the #274/#273 root cause).
    await press(page, "Escape");
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);
    await cursorDown(page, 7); // 7 region rows (0..6), then the first reunion (row 7)
    await press(page, "Enter");
    await waitForScene(page, "Reunion");
  });
});
