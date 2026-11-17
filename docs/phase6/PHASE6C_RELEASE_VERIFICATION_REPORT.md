# DietShift Atlas — Phase 6C Final Release Verification & Decision Report (WP7)

**Report Date:** 2026-11-17  
**Repository:** https://github.com/aminezghi/dietshift-atlas  
**Release Candidate Tag:** `v1.0.0-rc.1` (`v5.2.0-phase5c` analytical baseline · `v6.0.0-phase6a` documentation · `v6.1.0-phase6b` remediation · Phase 6C packaging & verification)  

---

## 1. Release Archive Architecture

Reproducible packaging via [`scripts/build_release_manifest.py`](../../scripts/build_release_manifest.py) enforces strict three-zone separation documented in [`PHASE6C_RELEASE_ARCHIVE_POLICY.md`](PHASE6C_RELEASE_ARCHIVE_POLICY.md):
- **Software Source, Scripts, Tests & Documentation (`134` files, `MIT` License):** Unchanged analytical engines (`src/analytics/*`), components, Python builders/guards, Pytest/Vitest/Playwright QA suites, and Phase 6 documentation (`paper/` manuscripts withheld pending `B-01` sign-off).
- **Track A Open / Attribution Data Assets (`33` files, `9,976,923` bytes):** Verified open or attribution-compatible tables + Pinned Public Domain Natural Earth `v5.1.1` cartography.
- **Track B Excluded Assets (`14` data files, `13,747,912` bytes + `5` unapproved manuscript files):** Quarantined from unrestricted public archives due to copyright, non-commercial ShareAlike, or unverified provenance.

## 2. Track A Included Assets (`33` Data Files)

- **Parquet Tables (`13`):** `agribalyse_31`, `classification_mappings`, `clinical_biomarker_grounding`, `consumer_behavior_pulse` (rows synthesis), `crosswalk_rosetta`, `efsa_foodex2_surveys`, `global_healthy_diet_affordability`, `global_poore_nemecek_lca`, `nsi_subnational_quintiles`, `openfoodfacts_eu`, `school_meals_procurement`, `scrapling_retail_claims`, `statistical_price_forecasts`.
- **Clean JSON Mirrors & Registry (`19`):** `agribalyse_full.json`, `classification_mappings.json`, `clinical_biomarker_grounding.json`, **`consumer_pulse_rows.json` (open slice only)**, `crosswalk_rosetta.json`, `datasets_registry.json`, `econometric_calibration.json`, `efsa_foodex2.json`, `forecast_validation_summary.json`, `global_benchmarks.json`, `live_research_bundle.json`, `nsi_rows_only.json`, `nsi_subnational_quintiles.json`, `off_expanded_rows.json`, `off_full.json`, `provenance_manifest.json`, `school_meals_procurement.json`, `scrapling_retail_claims.json`, `statistical_price_forecasts.json`.
- **Geography (`1`):** [`release/geo/world.naturalearth.110m.compatible.geojson`](../../release/geo/world.naturalearth.110m.compatible.geojson) mapped to `public/data/world.geojson`.

## 3. Track B Excluded Assets (`14` Data Files + `5` Manuscripts)

- **Restricted Parquets (`6`):** `gi_terroir_registry.parquet` (Qualigeo ©), `gs1_immagino_observatory.parquet` (GS1 Italy ©), `pan_eu_retail_scanner.parquet` (GS1 derived), `time_use_cooking_friction.parquet` (IPUMS/MTUS restriction), `cultural_climate_inertia.parquet` (ESS `CC BY-NC-SA 4.0` non-commercial), `social_discourse_velocity.parquet` (YC HN / Google News RSS / publisher ©).
- **Restricted or Mixed-Leakage JSONs (`7`):** `gi_terroir_bundle.json`, `gs1_immagino_bundle.json`, `pan_eu_retail_bundle.json`, `time_use_cooking_friction.json`, `cultural_climate_inertia.json`, **`consumer_behavior_pulse.json`** (embeds `6,845` Qualigeo+GIview rows and `129` HN/RSS items), and **`empirical_microdata_bundle.json`** (embeds `60` MTUS and `11` ESS non-commercial rows).
- **Legacy Cartography (`1`):** `public/data/world.geojson` (unpinned upstream origin).
- **Unapproved Manuscripts (`5`):** `paper/DIETSHIFT_ATLAS_ACADEMIC_PAPER.{md,html,docx}`, `paper/main.tex`, `paper/references.bib`.

## 4. License & Attribution Conditions

Full file-by-file paths, byte sizes, SHA-256 checksums, dataset versions, licenses, and required attribution credits are recorded in [`release/RELEASE_MANIFEST.json`](../../release/RELEASE_MANIFEST.json) and [`release/ATTRIBUTION_AND_DATA_NOTICES.md`](../../release/ATTRIBUTION_AND_DATA_NOTICES.md):
- Code: `MIT` (`LICENSE`). Track A Data: `Public Domain` (US CDC NHANES, Natural Earth `v5.1.1`), `Etalab Open Licence v2.0` (ADEME Agribalyse), `ODbL 1.0 / CC-BY-SA` (Open Food Facts & Open Prices), `CC-BY 4.0` (Eurostat, INE, OWID/Poore & Nemecek, OWID/WB-FAO CoHD, EFSA ref, GCNF), `OGL v3.0` (UK ONS), `CC0` (OpenAlex).

## 5. Geographic Asset Replacement Decision

Per [`PHASE6C_GEOGRAPHIC_ASSET_ASSESSMENT.md`](PHASE6C_GEOGRAPHIC_ASSET_ASSESSMENT.md):
- Staged Public Domain **Natural Earth `v5.1.1` Admin 0 Countries (1:110m)** with a transparent `24`-alias `properties.name` compatibility mapping ([`world.naturalearth.110m.compatible.geojson`](../../release/geo/world.naturalearth.110m.compatible.geojson), `266,815` B, `177` polygons, SHA-256 `ea535fc8eba86b0ee2f19235b68e6bd2cd373ea435b84d7c2b17a928a0d83baf`).
- Achieves **`177/177`** legacy name parity, **`24/25`** `COUNTRY_PROFILES` polygon coverage (`European Union` N/A as before), **`151/151`** CoHD matches, **`0`** geometry errors, and renders without error in Chromium (`I` & `IV`).
- Production `public/data/world.geojson` remains untouched per WP2; Track A releases substitute the verified Natural Earth asset cleanly.

## 6. Country-Profile Provenance Status

Per [`PHASE6C_COUNTRY_PROFILES_EVIDENCE.md`](PHASE6C_COUNTRY_PROFILES_EVIDENCE.md):
- **Verified Framework Definitions Only:** EAT-Lancet normalization (`100%` target frame; Willett et al., 2019) and `NOVA 4` % kcal construct (Monteiro et al., 2019).
- **Manually Compiled with Unverified Upstream Provenance (`300` numeric cells across `25` countries):** Zero per-country baseline citations exist in code or `datasets_registry.json`. Values are preserved verbatim and flagged **`[Author Confirmation Required]`**.

## 7. Reproducibility & Packaging Results

- [`scripts/prepare_natural_earth_geojson.py`](../../scripts/prepare_natural_earth_geojson.py) and [`scripts/build_release_manifest.py --stage-track-a`](../../scripts/build_release_manifest.py) execute deterministically, generating [`release/RELEASE_MANIFEST.json`](../../release/RELEASE_MANIFEST.json) (`134` software/doc files, `33` Track A data files, `14` excluded Track B files, `5` excluded manuscript files) and isolated staging in `dist-release/track-a-1.0.0-rc.1/`.
- [`package.json`](../../package.json), [`package-lock.json`](../../package-lock.json), [`src/version.ts`](../../src/version.ts), [`src/App.tsx`](../../src/App.tsx), [`CITATION.cff`](../../CITATION.cff), and docs consistently resolve **`1.0.0-rc.1`**.

## 8. Isolated Track A Smoke-Test Results (Playwright Chromium over `dist-release/track-a-1.0.0-rc.1/dist`)

Executed live headless Chromium checks across all `13` sections (`I`–`XIII`), fallback handling, exports, and Track B asset removal:
- **Zero uncaught JS `pageerror` exceptions** across all 13 sections.
- **Natural Earth Replacement (`world.geojson`):** Loaded cleanly in Overview (`I`) and Cartography (`IV`) with zero polygon or console map errors.
- **Pure Track A Features Functional (`0` missing-data alerts):** Overview Plates I–IV + OFF CSV export (`dietshift_openfoodfacts_GBR.csv`, `332,552 B`), Section `II` NSI & HICP statistical forecasts + CSV export (`dietshift_forecast_uncertainty_GBR_naive_drift_2030.csv`, `4,848 B`), Section `VI` Researcher Sandbox + blank-preserving CSV template (`dietshift_researcher_survey_template.csv`, `861 B`), Section `VII` Nutrition Trilemma, Section `VIII` Agribalyse & Poore modes, Section `IX` (`Affordability` + `Integrated Comparator`), Section `X` Policy Simulator, and Section `XI` Code Floorplan.
- **Observed Explicit Track B Runtime Dependencies When Track B Is Removed (Must Be Disclosed):**
  1. **Sections `III` (`Consumer Behavior`) & `XII` (`Pan-EU Retail`):** Refuse silent fallback and display explicit `role="alert"` HTTP 404 load error banners (`consumer_behavior_pulse.json`, `gs1_immagino_bundle.json`, `pan_eu_retail_bundle.json`).
  2. **Sections `I` & `IV` (GI Pins overlay) & `VIII` (`GI Terroir` sub-tab):** Surface non-blocking HTTP 404 alert notices for `gi_terroir_bundle.json` while keeping base maps, Agribalyse, and Poore operational.
  3. **Section `V` (`DuckDB Parquet SQL`):** Track A SQL views (`13`) remain present; Track B views (`6`, e.g., `social_discourse_velocity.parquet`) return HTTP 404 when queried.
  4. **Sections `IX` (`Phase 4D Robustness`) & `XIII` (`Empirical Sensitivity`) `Promise.all` Coupling Defect Disclosed:** Because `SensitivityPanel.tsx` and `IntegratedRobustnessPanel.tsx` fetch Track B `gi_terroir_bundle.json` inside `Promise.all(...)` without an isolated `.catch()`, omitting Track B `gi_terroir_bundle.json` causes **Section `XIII` to degrade to `0 Verified Scenarios`** (disabling CSV scenario output) and causes `IntegratedRobustnessPanel` (`Section IX` Robustness tab) to drop Poore items (`global_benchmarks.json`) alongside `giItems`. *(Preserved untouched per Phase 6C engine freeze; must be decoupled in a post-RC patch if shipping Track A–only hosted web builds.)*

## 9. Complete QA Gate Verification (`npm run qa`)

Executed on the workspace after all documentation, packaging, and governance updates (tests prove deterministic code/schema/export parity—**not** external empirical representativeness of stylized tables):
- **`oxlint` (`npm run lint`):** **`0` warnings, `0` errors across `59` files**.
- **`vitest run` (`npm test`):** **`16` test files, `73` tests passed** (`crossEngineParity`, `phase5aIntegrity`, `integratedRobustness`, `sensitivityEngine`, `forecastingEngine`, `criticalComponents`, `appPolicyAndExport`, etc.).
- **`tsc -b && vite build` (`npm run build`):** **`0` TS errors (`2,847` modules)**.
- **`pytest tests/test_empirical_pipeline.py -v`:** **`14/14` passed** (`19` Parquet hashes, `17,627` rows, `17` JSON–Parquet parity checks).
- **`pytest tests/e2e -v`:** **`1/1` Playwright Chromium 13-section E2E + live download parity passed**.
- **Internal Markdown Link Verification:** **`181` relative links verified across `18` Markdown files (`0` broken links)**.

## 10. Remaining External Approvals Required

| Item | Owner | Requirement Before Full Release / Publication |
| :--- | :--- | :--- |
| **`B-01` Manuscripts (`paper/*`)** | **Amine Zouaghi (Author)** | Approve & apply Phase 6B corrections removing retracted `TimesFM`/`89.4%` MAE claims and syncing table/count prose before submission. |
| **`B-02` Track B Dataset Rights** | **Fondazione Qualivita, GS1 Italy, IPUMS/CTUR, ESS ERIC, Maintainer** | Keep Track B excluded from unrestricted public archives unless written permissions (`Qualigeo`, `GS1`, `IPUMS`) are secured, ESS `CC BY-NC-SA 4.0` non-commercial scope is segregated, HN/RSS links are dropped, and `world.geojson` is switched to Natural Earth `v5.1.1`. |
| **`B-05` `COUNTRY_PROFILES` Sources** | **Amine Zouaghi (Author)** | Provide primary intake/environmental/basket citations for the `25` hardcoded baselines in `src/types/research.ts`. |
| **Post-RC Patch (`IX`/`XIII` Coupling)** | **Maintainer** | Decouple `fetchGiTerroirBundle()` error handling inside `SensitivityPanel.tsx` and `IntegratedRobustnessPanel.tsx` if deploying a Track A–only web build without Track B assets. |

---

## 11. Independent Release Verdicts

| Release Track | Verdict | Rationale |
| :--- | :---: | :--- |
| **`READY FOR PUBLIC SOURCE-CODE RELEASE`** | **`PASS` (`v1.0.0-rc.1` Source)** | Source code (`MIT`), build tooling, dependency files, QA suites (`npm run qa` green), version/citation metadata (`1.0.0-rc.1`), and governance docs are consistent and reproducible (`v1.0.0` tag held cleanly until post-RC clearances). |
| **`READY FOR CONTROLLED RESEARCH DISTRIBUTION`** | **`CONDITIONAL PASS`** | Technically verified for academic inspection and reproducible offline benchmarking (`npm run qa` green) under strict conditions: (a) preserve `LIMITATIONS_AND_RESPONSIBLE_USE.md` and `Unverified Provenance` `COUNTRY_PROFILES` labels, (b) do not redistribute Track B tables beyond non-commercial/permitted scope, (c) note Track A web build requires all assets or decoupling of `gi_terroir_bundle.json` for Sections `IX`/`XIII`. |
| **`READY FOR UNRESTRICTED DATA REDISTRIBUTION`** | **`FAIL` (Full Warehouse) / `PASS` (Segregated Track A Only)** | Distributing the full 19-table repository bundle violates Fondazione Qualivita, GS1 Italy, IPUMS MTUS, ESS `CC BY-NC-SA 4.0`, and YC/Google News terms. **Only the segregated `33`-file Track A bundle** in [`release/RELEASE_MANIFEST.json`](../../release/RELEASE_MANIFEST.json) (using Natural Earth `v5.1.1`) is cleared for unrestricted/attribution data redistribution. |
| **`READY FOR JOURNAL SUBMISSION`** | **`FAIL` (Blocked on `B-01` & `B-05`)** | Manuscripts under `paper/` still contain retracted foundation-model/leakage metrics and outdated dataset counts requiring author sign-off, alongside `COUNTRY_PROFILES` primary bibliographic documentation. |
