# DietShift Atlas — Phase 6D: Track A Resilience & Final Research Release Validation

**Report Date:** 2026-11-17  
**Repository:** https://github.com/aminezghi/dietshift-atlas  
**Release Candidate:** `1.0.0-rc.1` (`v5.2.0-phase5c` analytical baseline · `v6.3.0-phase6d` resilience & disclosures)

---

## 1. Mission & Methodological Guarantees Preserved

Phase 6D eliminates unnecessary runtime coupling between Track B redistribution-restricted assets (`14` files) and independently available Track A open/attribution analytical functionality (`33` files), without modifying analytical formulas, Phase 4C/4D scenario logic, `COUNTRY_PROFILES` numeric baselines, or production datasets under `public/data/`.

Preserved invariants verified across all automated tests:
- Zero synthetic or zero-filled fallback data for missing GI, GS1, MTUS Time-Use, ESS Cultural Inertia, or HN/RSS feeds.
- Zero weakened Phase 5C parity or UI assertions (`crossEngineParity.test.ts`, `criticalComponents.test.tsx`, `appPolicyAndExport.test.tsx`).
- Exact full-dataset parity on all non-GI scenarios (`19` executed Track A sensitivity scenarios in Section XIII; `12` Phase 4D scenarios and all `45` Poore & Nemecek LCA commodities in Section IX).

---

## 2. Root Causes Remediated (`WP1`–`WP4`)

### WP1 & WP2 — Section XIII (`SensitivityPanel.tsx`)
- **Prior Defect:** Atomic `Promise.all([classification_mappings, scrapling_retail_claims, global_benchmarks, fetchGiTerroirBundle()])` caused a single HTTP 404 on restricted `gi_terroir_bundle.json` to abort loading of independent open sources (`mappings = []`), producing `"Section XIII ... (0 Verified Scenarios)"` and silent no-op clicks on `Export CSV` / `JSON Dossier`.
- **Fix:** Switched to `Promise.allSettled` so `classification_mappings.json`, `scrapling_retail_claims.json`, and `global_benchmarks.json` load independently when GI fails.
- **Explicit Accounting & Export Guardrails:** Section XIII now runs all `19` independent scenarios (`19 valid + 0 diagnostic` when GI is absent), surfaces an explicit omitted-scenario accounting pill (`Excluded / unavailable: 1` naming `env_gi_unfiltered_alcohol_leak`), includes `availabilitySummary` in exported JSON dossiers, and visibly sets `disabled` + `aria-disabled` with an explicit status message whenever `0` scenarios are computable.

### WP1 & WP3 — Section IX (`IntegratedRobustnessPanel.tsx` & `integratedRobustness.ts`)
- **Prior Defect:** Atomic `Promise.all([global_benchmarks, fetchGiTerroirBundle()])` discarded all `45` Poore & Nemecek LCA commodities when `gi_terroir_bundle.json` returned HTTP 404 in Track A, while `integratedRobustness.ts` reported generic per-category mismatch messages on `environment_gi_proxy` when the entire GI registry was absent.
- **Fix:** Decoupled `global_benchmarks.json` (`poore_nemecek_lca`) from `fetchGiTerroirBundle()` via `Promise.allSettled`. In Track A builds, Poore & Nemecek (`Estimated`) evidence cells, Agribalyse (`Model Output`), OFF (`Observed`), Open Prices (`Observed`), and all `12` Phase 4D robustness scenarios remain fully preserved. `environment_gi_proxy` cells distinguish `giItems.length === 0` cleanly (`EvidenceNature: 'Missing'`, `"GI Terroir dataset unavailable or excluded in this distribution; cell kept Missing without fabricated fallback."`), while leaving full-data messages untouched when `giItems.length > 0`.

### WP4 — Standardized Missing & Restricted Data Disclosures (`resourceAvailability.ts` & `ResourceDisclosureBanner.tsx`)
Added [`src/utils/resourceAvailability.ts`](../../src/utils/resourceAvailability.ts) and [`src/components/ResourceDisclosureBanner.tsx`](../../src/components/ResourceDisclosureBanner.tsx), backed by structured `DataFetchError` metadata in [`src/services/dataProvider.ts`](../../src/services/dataProvider.ts):
1. **Excluded from Track A distribution (`excluded_from_distribution`):** Non-alarming ochre status disclosure naming the dataset domain, Track B restriction reason, affected fields kept absent, and open analyses remaining available.
2. **Temporary network / server error (`network_or_server_error`):** Distinct `role="alert"` error naming the resource, HTTP status code, and actionable Retry trigger (`Retry` / `Retry Load`).
3. **Invalid or unreadable JSON (`invalid_or_unreadable`):** Explicitly rejects malformed JSON without cached fallback substitution.
4. **Missing required input (`missing_required_input`) & DuckDB Track B exclusions (`classifyDuckDBSqlError`).**

Component coverage:
- **Overview & Cartography (`InteractiveChoroplethMap.tsx`):** Natural Earth cartography and World Bank CoHD remain interactive; GI pins button disables clearly as `Food GI Pins Unavailable` when omitted, and raw `HTTP 404` strings are replaced with `ResourceDisclosureBanner`.
- **Consumer Behavior & Plate III-F (`ConsumerBehaviorPulse.tsx` & `EmpiricalSocialMicrodataPlate.tsx`):**
  - Moved `<EmpiricalSocialMicrodataPlate />` out of the `pulseData.gi_terroir_records` conditional so Plate III-F is never hidden by missing GI records.
  - When `consumer_behavior_pulse.json` is excluded (`404` Track A), falls back strictly to Track A open `consumer_pulse_rows.json` (`8` country cascades) while keeping Track B HN/RSS discourse and GI tables omitted with explicit notices.
  - When `empirical_microdata_bundle.json` is excluded (`404` Track A), loads standalone open `clinical_biomarker_grounding.json` (CDC NHANES) and `school_meals_procurement.json` (GCNF) cleanly and defaults to live `NHANES` biomarkers while surfacing Track B exclusions on the `MTUS Time-Use` and `ESS Cultural Inertia` tabs.
- **DuckDB Parquet Workbench (`duckdbEngine.ts` & `DuckDBParquetWorkbench.tsx`):** Creates each of the `19` views individually rather than failing transactionally on omitted Track B Parquets, probes only registered views without overwriting omitted Track B counts with hardcoded full counts (`excluded` instead of `6,845`), badges Track B preset cards (`Track B Excluded`), and translates Track B SQL errors cleanly.
- **Environmental Engine (`EnvironmentComparisonPanel.tsx`):** Surfaces GI Track B exclusion or HTTP 500 error banners cleanly in both Source Explorer (`gi_terroir_proxy`) and Compatibility & Boundary Guard modes while leaving Agribalyse and Poore intact.
- **Retail Observatory (`GS1ImmaginoObservatory.tsx`) & Header Exports (`App.tsx`):** Switches default tab to open `Open Prices EU & Open Food Facts` retail feed when GS1/Pan-EU Track B bundles return 404, replaces raw 404 errors with permission notices, and formats Track B CSV export selection cleanly in `App.tsx`.

---

## 3. Automated Verification Coverage (`WP5`–`WP7`)

| Check Layer | Suite / Script | Scope & Verified Result |
| :--- | :--- | :--- |
| Type Check & Build | `npm run build` (`tsc -b && vite build`) | Clean production build (`0` TS or bundler errors) |
| Static Analysis | `npm run lint` (`oxlint`) | Executed via unified `npm run qa` |
| Track A Unit & UI Suite | [`src/utils/resourceAvailability.test.ts`](../../src/utils/resourceAvailability.test.ts), [`src/components/trackAResilience.test.tsx`](../../src/components/trackAResilience.test.tsx) | Verifies 5-category error classification, DuckDB SQL classification, `19` non-GI scenario parity, Section XIII export disablement at 0 scenarios, HTTP 500 vs 404 Track B distinction, Section IX Poore & GI Missing matrix cells, Section III/VIII/XII open fallbacks |
| Full Parity & Component Suite | `npm test` (`vitest run`) | All `18` test files, `87` tests passing (`0` weakened Phase 5C assertions) |
| Track A Isolated Chromium E2E | [`tests/e2e/test_track_a_archive_e2e.py`](../../tests/e2e/test_track_a_archive_e2e.py) | Serves strictly staged Track A archive (`33` open assets, `0` Track B files); verifies all `13` sections (`I`–`XIII`), DuckDB 13-table live queries & Track B SQL notice, Poore (`45`), Section XIII `19` scenarios + CSV/JSON downloads, zero `pageerror` |
| Unified 5-Stage QA Gate | `npm run qa` (`python scripts/run_qa_gate.py`) | Re-verified post-final edit across Lint, Vitest, Build, Pytest data/provenance checks, Full E2E + Track A E2E |
| Release Archive & Manifest | [`scripts/build_release_manifest.py`](../../scripts/build_release_manifest.py) | Regenerated [`release/RELEASE_MANIFEST.json`](../../release/RELEASE_MANIFEST.json) & `dist-release/track-a-1.0.0-rc.1/` cleanly (`1.0.0-rc.1`, `33` Track A, `14` Track B, `5` excluded manuscripts) |
