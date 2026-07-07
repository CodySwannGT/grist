/**
 * Unit coverage for the unified **save-autosave choke point** (#245): the single serial
 * queue every read-modify-write against the persisted {@link CurrentSave} now runs through
 * (`src/services/save-autosave`), and the two run-store write-throughs that ride it
 * (`persistRunEconomy` + `persistRegionProgress`).
 *
 * The bug this locks down: a region battle win credits grist AND advances the region
 * cursor in the SAME beat, firing an economy write and a region-progress write back to
 * back. Before the unification each owned its own chain, so the region write — a full
 * `load → fold → save` that preserves grist verbatim from *its* load — could load the
 * pre-win balance *before* the economy write committed the credited balance, then land
 * last and write the stale grist back over it. The map kept the region clear while the
 * Grist rolled back (exactly the 34→14 the QA pass filed). Routing both through one queue
 * makes that lost-update impossible: the region write always folds into the freshest save
 * the economy write already committed.
 *
 * The `saveService` I/O is mocked with an in-memory store whose `load`/`save` each yield a
 * macrotask, so an UN-serialized pair WOULD interleave and clobber — the mock's delay is
 * the adversary the serial queue must beat. Exercised headless under vitest, no DOM / no
 * IndexedDB, mirroring the `run-economy` fold twin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { freshSave, type CurrentSave } from "../../src/logic/save";
import { regionProgressFromFlags } from "../../src/logic/world-map";
import { newRunState, type RunState } from "../../src/logic/run-state";

/**
 * A shared in-memory save store standing in for the IndexedDB-backed `saveService`. Both
 * `load` and `save` await a macrotask so that two un-serialized read-modify-write cycles
 * would each read the same base and race — the exact interleave the serial queue prevents.
 * Hoisted so the `vi.mock` factory (itself hoisted above the imports) can bind to it.
 */
const io = vi.hoisted(() => {
  const tick = (): Promise<void> =>
    new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  let store: unknown = null;
  let failNextSave = false;
  return {
    set: (save: unknown): void => {
      store = structuredClone(save);
    },
    get: (): unknown => store,
    failNextSave: (): void => {
      failNextSave = true;
    },
    load: vi.fn(async () => {
      await tick();
      return structuredClone(store);
    }),
    save: vi.fn(async (save: unknown) => {
      await tick();
      if (failNextSave) {
        failNextSave = false;
        throw new Error("simulated storage failure");
      }
      store = structuredClone(save);
    }),
  };
});

vi.mock("../../src/services/save-service", () => ({
  saveService: { load: io.load, save: io.save },
}));

// Imported AFTER the mock is registered so the queue binds to the mocked saveService.
const { persistRunEconomy, persistRegionProgress } =
  await import("../../src/services/run-store");
const { saveAutosave } = await import("../../src/services/save-autosave");

/**
 * A save carrying a pre-win Grist balance and no region progress yet.
 * @param grist - The persisted Grist balance to seed.
 * @returns A fresh current-version save with the given Grist.
 */
function saveWithGrist(grist: number): CurrentSave {
  return { ...freshSave(), grist };
}

/**
 * A live run whose wallet holds the given (credited) Grist balance.
 * @param grist - The wallet Grist balance the run carries.
 * @returns A run state with the given wallet Grist.
 */
function runWithGrist(grist: number): RunState {
  return { ...newRunState(), wallet: { grist } };
}

beforeEach(() => {
  io.load.mockClear();
  io.save.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("save-autosave — unified write-through queue (#245)", () => {
  it("a region-progress write does not clobber a concurrent economy credit", async () => {
    // The pre-win save: Grist 14 (the QA baseline), no region cleared yet.
    io.set(saveWithGrist(14));

    // A region battle win, replayed as its two same-beat writes: the economy credit
    // (Grist → 34) and the region-cursor advance (Upper Vanta / marrow cleared) — fired
    // back to back WITHOUT awaiting between them, exactly as `resumeRegionPlay` does.
    const credit = persistRunEconomy(runWithGrist(34));
    const advance = persistRegionProgress({
      regionId: "marrow",
      cleared: 2,
      total: 2,
    });
    await Promise.all([credit, advance]);

    const final = io.get() as CurrentSave;
    // The credited Grist survived — NOT rolled back to the pre-win 14.
    expect(final.grist).toBe(34);
    // ...and the region progress persisted alongside it (internally consistent save).
    const progress = regionProgressFromFlags(final.scene?.flags ?? {});
    expect(progress["marrow"]?.cleared).toBe(2);
  });

  it("serializes writes in call order so the last one folds into the newest save", async () => {
    io.set(saveWithGrist(0));

    // Three economy credits in flight at once; last-enqueued wins (the run is
    // authoritative for the whole wallet, so last-write-wins is correct).
    await Promise.all([
      persistRunEconomy(runWithGrist(10)),
      persistRunEconomy(runWithGrist(20)),
      persistRunEconomy(runWithGrist(30)),
    ]);

    expect((io.get() as CurrentSave).grist).toBe(30);
  });

  it("is total: a storage failure never wedges the queue behind it", async () => {
    io.set(saveWithGrist(5));
    io.failNextSave();

    // The failing write is swallowed; the next write still lands.
    await saveAutosave.mutate(save => ({ ...save, grist: 99 }));
    await saveAutosave.mutate(save => ({ ...save, grist: 42 }));

    expect((io.get() as CurrentSave).grist).toBe(42);
  });
});
