/**
 * Print the combat-balance sweep tables (issue #266) for the PR body: every
 * mandated policy against every encounter tier, reporting win rate, mean turns,
 * KO incidence, and party HP remaining. Run with `bun run scripts/balance-sweep.ts`.
 * Pure evidence — the same aggregates the `balance.test.ts` bands assert.
 */
import {
  POLICIES,
  SLICE_PARTY,
  seeds,
  sweep,
} from "../tests/logic/balance/harness";
import { ENCOUNTERS, type EncounterId } from "../src/content";
import { type WorldState } from "../src/logic/world";

interface Row {
  readonly tier: string;
  readonly encounter: EncounterId;
  readonly world: WorldState;
}

const PLAN: readonly Row[] = [
  { tier: "Tutorial", encounter: "tutorial-ambush", world: "reach" },
  { tier: "Act I early", encounter: "warren-street", world: "reach" },
  { tier: "Act I mid", encounter: "the-drip", world: "reach" },
  { tier: "Act I mid", encounter: "deep-audit", world: "reach" },
  { tier: "Ashfall", encounter: "the-drip", world: "ashfall" },
  { tier: "Ashfall", encounter: "deep-audit", world: "ashfall" },
  { tier: "Ashfall boss", encounter: "the-cage", world: "ashfall" },
  { tier: "Finale-adj", encounter: "halcyon-chase", world: "reach" },
];

const BATCH = seeds(60);

function pct(x: number): string {
  return (x * 100).toFixed(0) + "%";
}

console.log(
  `Batch = ${BATCH.length} seeds/policy. Metrics: win | turns | KO | HP-left\n`
);
console.log("| Tier | Encounter | World | Policy | Win | Turns | KO | HP |");
console.log("|---|---|---|---|---|---|---|---|");
for (const row of PLAN) {
  const enc = ENCOUNTERS[row.encounter];
  for (const [name, policy] of Object.entries(POLICIES)) {
    const s = sweep(SLICE_PARTY, enc, row.world, policy, BATCH);
    console.log(
      `| ${row.tier} | ${row.encounter} | ${row.world} | ${name} | ${pct(
        s.winRate
      )} | ${s.meanTurns.toFixed(1)} | ${pct(s.koRate)} | ${pct(
        s.avgHpRemaining
      )} |`
    );
  }
}
