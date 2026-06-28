# GRIST — Game Docs Wiki — Log

> Append-only. One row per operation. Operations:
> `INIT, SETUP, INGEST, CREATE, UPDATE, MERGE, DEPRECATE, LINT, QUERY, REBUILD-INDEX`.

| Date | Operation | Target | Notes |
|---|---|---|---|
| 2026-06-27 | SETUP | wiki/ | Initialized GRIST — Game Docs Wiki with the lisa-wiki kernel. |
| 2026-06-27 | CREATE | narrative/ | Authored the story bible: pitch, world, factions, characters, story (mystery + structure + endings), themes-and-tone. Added the `narrative` category. |
| 2026-06-27 | CREATE | design/ | Authored the game-design layer: overview, combat (ATB), progression-and-economy (grist-augment), open-world, side-content. Added the `design` category and decision 0002. |
| 2026-06-27 | CREATE | production/ | Authored the production plan: roadmap (phased, slice-based) and the vertical-slice definition ("The Bound in the Marrow"). Added the `production` category and decision 0003. |
| 2026-06-27 | CREATE | production/, design/ | Began full pre-production: GDD master index/plan + decision 0004 (document everything before coding); creative-direction pillar — art-direction, audio-direction, ui-ux-and-controls. |
| 2026-06-27 | CREATE | narrative/, design/ | Pre-production groups B+C: lore-and-history, main-quest beat sheet, character-bios, quest-design, and regions (Vanta tiers + the Reach in both world-states). |
| 2026-06-27 | CREATE | design/, architecture/ | Pre-production groups D+E: combat-spec, economy-spec, bestiary, catalog, and the game technical design. Final roadmap pass; GDD index marked fully complete — clear to build. |
| 2026-06-27 | CREATE | open-questions/, playbooks/, concepts/ | Rounded out pre-production: the open-questions register (the deferred-decisions tracker), the development-workflow playbook (PRD→ticket→build→verify, branch rules, multi-harness), and the glossary. |
| 2026-06-27 | CREATE | production/, architecture/, playbooks/, decisions/ | Build-readiness pass: platform-and-target (web+mobile), technical-requirements (offline-first, local-only saves — no remote connectivity), engineering-spec (schemas + sim contract + scene/state machine + save), vertical-slice-build (content + asset manifest + UAT script), test-plan; decisions 0005 (platform), 0006 (Phase-1 tech), 0007 (local-only/offline). Resolved the Phase-1-blocking open questions; reconciled cloud-save/telemetry mentions. |
