# DietShift Atlas — Release Notes v1.0.0

**Release Tag:** `v1.0.0`  
**Release Name:** DietShift Atlas v1.0.0 — MIT Source Code + Track A Open Data  
**Analytical Baseline:** `v5.2.0-phase5c`  
**Resilience Baseline:** `v6.3.0-phase6d`  
**Release Date:** 2026-11-17  
**Distribution Model:** Dual-Track (MIT Code + 33 Track A Open Assets)  
**Live Application:** [https://aminezghi.github.io/dietshift-atlas/](https://aminezghi.github.io/dietshift-atlas/)  
**Repository:** [https://github.com/aminezghi/dietshift-atlas](https://github.com/aminezghi/dietshift-atlas)  

---

## 1. Release Summary

DietShift Atlas v1.0.0 is the first formal general public release of the DietShift Atlas food systems computational platform. It enables researchers, policy analysts, and consumers to model dietary shifts across nutritional epidemiology, life-cycle environmental impacts, and economic affordability in a 100% privacy-preserving, client-side WebAssembly environment.

This release represents the culmination of Phases 1 through 6, incorporating the Phase 5C automated QA gate, Phase 6A–6B scientific governance and manuscript retractions, Phase 6C archive segregation, and Phase 6D Track A resilience.

---

## 2. What Is Included in v1.0.0

### 2.1 Permissive MIT Software & Client Architecture
- Complete TypeScript source code for the 13 interactive observatories and workbenches.
- 6 pure analytical calculation engines (`src/analytics/`):
  - `nutritionEngine.ts` (`v3.1.0-phase3b`)
  - `environmentEngine.ts` (`v3.2.0-phase3c`)
  - `affordabilityEngine.ts` (`v3.3.0-phase3d`)
  - `classificationEngine.ts` (`v3.0.0-phase3a` & `v3.4.0-phase3d`)
  - `forecastingEngine.ts` (`v4.2.0-phase4b`, causal expanding-origin ETS)
  - `sensitivityEngine.ts` (`v4.3.1-phase4c`, 20 OAT scenarios)
  - `integratedRobustness.ts` (`v4.4.0-phase4d`, 12 compounded stress-test scenarios)
- Client-side DuckDB-Wasm (`^1.33.1-dev57.0`) SQL engine running in a dedicated Web Worker.
- Resilient single-flight data provider (`dataProvider.ts`) and resource disclosure framework (`ResourceDisclosureBanner.tsx`).
- Standardized CSV/JSON export subsystem (`exportDownload.ts`) with ISO timestamps and metric units.

### 2.2 Track A — 33 Open & Attribution-Compatible Data Assets
All 33 datasets carry verified open redistribution licenses (CC-BY-4.0, French Open Licence 2.0, ODbL 1.0, or Public Domain):
- **13 Columnar Parquet Tables:**
  1. `agribalyse_31.parquet` (ADEME / INRAE, French Open Licence 2.0)
  2. `global_poore_nemecek_lca.parquet` (Poore & Nemecek 2018, Science Open Research Synthesis)
  3. `openfoodfacts_eu.parquet` (Open Food Facts Database ODbL 1.0)
  4. `efsa_foodex2_surveys.parquet` (EFSA Open Data / CC-BY-4.0)
  5. `global_healthy_diet_affordability.parquet` (World Bank & FAO CoHD 2024, CC-BY-4.0)
  6. `scrapling_retail_claims.parquet` (Open Prices EU shelf receipts, ODbL 1.0)
  7. `nsi_subnational_quintiles.parquet` (Eurostat regional micro-aggregates, CC-BY-4.0)
  8. `classification_mappings.parquet` (Multi-Taxonomy Concordance, 161 rules, MIT/CC-BY-4.0)
  9. `statistical_price_forecasts.parquet` (Eurostat HICP expanding ETS models, CC-BY-4.0)
  10. `clinical_biomarker_grounding.parquet` (CDC NHANES WTDRD1 microdata, Public Domain)
  11. `crosswalk_rosetta.parquet` (Taxonomic ontology crosswalk, CC-BY-4.0)
  12. `pan_eu_retail_scanner.parquet` (Synthetic pan-EU benchmark aggregates, CC-BY-4.0)
  13. `school_meals_procurement.parquet` (Public procurement standards, Open Government Licence)
- **19 Pre-compiled JSON Analytical Bundles:**
  `agribalyse_full.json`, `clinical_biomarker_grounding.json`, `crosswalk_rosetta.json`, `efsa_foodex2.json`, `global_benchmarks.json`, `live_research_bundle.json`, `nsi_rows_only.json`, `nsi_subnational_quintiles.json`, `off_expanded_rows.json`, `off_full.json`, `provenance_manifest.json`, `school_meals_procurement.json`, `scrapling_retail_claims.json`, `statistical_price_forecasts.json`, `forecast_validation_summary.json`, `classification_mappings.json`, `consumer_pulse_rows.json`, `econometric_calibration.json`, `datasets_registry.json`.
- **1 Cartographic Geometry:**
  `world.geojson` (Natural Earth v5.1.1 1:110m Admin 0 Countries, Public Domain).

---

## 3. What Is Excluded from v1.0.0

To maintain absolute legal and copyright hygiene:
1. **14 Track B Restricted / Commercial Datasets:**
   - `gi_terroir_registry.parquet` & `gi_terroir_bundle.json` (Qualigeo copyright)
   - `time_use_cooking_friction.parquet` & `.json` (IPUMS / MTUS redistribution restrictions)
   - `cultural_climate_inertia.parquet` & `.json` (ESS ERIC CC BY-NC-SA 4.0 commercial incompatibility)
   - `scanner_derived_retail_sample.parquet` & `.json` (Commercial proprietary)
   - `eu_subnational_hicp_quintiles.parquet` & `.json` (Restricted micro-aggregates)
   - `consumer_behavior_pulse.json`, `empirical_microdata_plate.json`, `food_security_nowcast.json`, `retail_scanner_aggregates.json`
2. **Academic Manuscripts (`paper/`):**
   - `DIETSHIFT_ATLAS_ACADEMIC_PAPER.md`, `.html`, `.docx`, `main.tex`, `references.bib` are draft preprints reserved for independent journal peer review and are excluded from the public release archive.

When running under Track A, sections dependent on Track B assets display prominent, actionable `ResourceDisclosureBanner` notices explaining what is missing and why, with zero runtime crashes.

---

## 4. Evidence Classification Framework

Every metric rendered in the application carries a visual `DataNatureBadge`:
- **Empirical Microdata:** Direct survey or receipt observations (EFSA FoodEx2, Open Prices EU, CDC NHANES).
- **Institutional Registry:** Official administrative and statutory datasets (Eurostat HICP, World Bank CoHD).
- **Manually Compiled:** Expert analyst reference diets lacking micro-level variance (25 `COUNTRY_PROFILES`).
- **Model Output / Estimated:** Life-cycle assessments, proxy crosswalks, and statistical time-series forecasts (Agribalyse 3.1.1, Poore & Nemecek 2018, ETS forecasts).

---

## 5. The 13 Analytical Observatories & Capabilities

- **Section I (Overview):** 25 baseline dietary profiles, Eurostat HICP and PPP indices with `[EU27_2020 FALLBACK]` disclosure.
- **Section II (Researcher Sandbox):** 2,451 Agribalyse items with native units ($\text{kg CO}_2\text{eq}$, AWARE $\text{m}^3\text{ world-eq}$, PEF $\text{Pt}$), blank-preserving CSV upload, and ledger presets.
- **Section III (Nutrition Comparison):** Dual-denominator switching (`per_100g` vs `per_100kcal`), Nutri-Score, NOVA groups, and NULL NOVA visibility toggle.
- **Section IV (Environmental Comparison):** Poore & Nemecek 2018 meta-analysis covering 45 commodities across 5 supply chain tiers.
- **Section V (DuckDB-Wasm Workbench):** In-browser SQL console over 19 registered Parquet views with timing and CSV export.
- **Section VI (Affordability & Food Security):** World Bank & FAO CoHD 2024 diet costs across 170+ economies and regional income quintiles.
- **Section VII (Empirical Sensitivity):** 20 deterministic parameter variation scenarios (19 active + 1 GI isolated disclosure).
- **Section VIII (Integrated Robustness):** 12 multidimensional compounded stress-test scenarios and compass quadrant classification.
- **Section IX (Consumer Behavior Pulse):** Social velocity tracking food transition topics (Track A banner active).
- **Section X (Empirical Social Microdata):** Preparation time friction and cultural inertia (Track A banner active).
- **Section XI (GS1 Italy Immagino):** Packaging claim prevalence and front-of-pack declarations.
- **Section XII (Pan-EU Retail Scanner):** Crowdsourced shelf receipts from Open Prices EU and retail price distributions.
- **Section XIII (Cross-Taxonomy Concordance):** 161 concordance rules bridging FoodEx2, Agribalyse, OFF, and COICOP 2018.

---

## 6. How to Reproduce Locally

The application runs 100% locally with Node.js:
```bash
git clone https://github.com/aminezghi/dietshift-atlas.git
cd dietshift-atlas
npm ci
npm run lint    # Oxlint (0 errors)
npm test        # Vitest (87 passed tests)
npm run build   # Vite production build
npm run preview # Preview at http://localhost:4173
```

To run the complete 5-stage automated quality gate (Oxlint + Vitest + Build + Pytest Parquet + Playwright Chromium E2E):
```bash
pip install -r requirements-dev.txt
python -m playwright install chromium --with-deps
npm run qa
```

---

## 7. Known Limitations

Consult [`docs/LIMITATIONS_AND_RESPONSIBLE_USE.md`](docs/LIMITATIONS_AND_RESPONSIBLE_USE.md) for full scientific limitations:
1. **No Universal Composite Scores:** Carbon, water, land, and nutritional quality are strictly isolated; no arbitrary weighted single score is computed.
2. **AWARE Water Deprivation Metric:** Expressed in $\text{m}^3\text{ world-eq}$, measuring relative water stress, not physical water consumption.
3. **PEF 3.1 Land Use Score:** Expressed in points ($\text{Pt}$), reflecting soil degradation, not physical square metres.
4. **HICP Macroeconomic Fallback:** In the absence of country-specific series, `EU27_2020` aggregate is applied and visibly disclosed.
5. **No Medical Diagnostics:** Intended for macro-level population systems modeling, not individualized clinical dietary advice.

---

## 8. Checksums & Verification

All files in this release are cataloged in `RELEASE_SHA256_MANIFEST.json` and `release/RELEASE_MANIFEST.json`.
