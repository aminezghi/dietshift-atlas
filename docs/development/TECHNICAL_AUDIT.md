# DietShift Atlas — Technical Audit & Baseline Report

**Audit Date:** 2026-11-16  
**Repository:** `dietshift-atlas` (working tree)  
**Scope:** Full-stack inspection of frontend (`src/`), DuckDB-Wasm service (`src/services/`), Python ETL & harvesting pipelines (`scripts/`), static data assets (`public/data/`), build/CI config (`package.json`, `vite.config.ts`, `.github/workflows/deploy.yml`), and automated tests (`tests/`).

---

## 1. Baseline Verification (Pre-Modification)

All checks below were executed against the unmodified repository prior to any edits:

| Check | Command | Outcome | Notes |
| :--- | :--- | :--- | :--- |
| TypeScript & Vite build | `npm run build` (`tsc -b && vite build`) | **PASS** (exit 0, 2.04 s) | Produces `dist/assets/index-C2u7gx0Z.js` (**1,860.83 kB**, gzip 567.11 kB) plus DuckDB-Wasm bundles (`35.9 MB` EH, `41.3 MB` MVP). |
| Linter (`oxlint`) | `npm run lint` | **PASS with 6 warnings** (0 errors) | Warnings in `NSIMLObservatory.tsx`, `ConsumerBehaviorPulse.tsx`, `GS1ImmaginoObservatory.tsx`, and `InteractiveChoroplethMap.tsx` (`set-state-in-effect`, `exhaustive-deps`). |
| Python test suite | `python -m pytest -v` (Python 3.13.5) | **PASS (6/6)** (3.23 s) | `tests/test_empirical_pipeline.py` validates SHA-256 hashes & row counts in `provenance_manifest.json` (18 tables, 17,897 rows) and value ranges for NHANES, Eurostat calibration, Scrapling, Poore & Nemecek, and World Bank CoHD. Note: `.venv` lacks `pytest`. |
| Live preview runtime | `vite preview --port 4173` + headless Chromium (Playwright) | **PASS (HTTP 200 across all 56 requests)** | Initial `networkidle` load: **4.02 s**; 0 page errors; 0 console errors; DuckDB-Wasm Preset 1 executed in **33.1 ms** (15 rows). |

---

## 2. Existing Features & System Architecture

### 2.1 Runtime Architecture
DietShift Atlas is a 100% client-side Single-Page Application (SPA) built with **React 19.3**, **TypeScript ~7.0.2**, **Vite 8.3.6** (`base: './'`), **Tailwind CSS v4**, **Apache ECharts 6.1**, and **DuckDB-Wasm 1.33.1-dev57.0**, deployed statically to GitHub Pages via `.github/workflows/deploy.yml`.

- **Entry & Routing:** `src/main.tsx` -> `src/App.tsx`. Navigation across 12 modules uses component state (`activeModule`) synchronized partially to URL hash parameters (`#module=...&country=...&plant=...&upf=...`).
- **DuckDB-Wasm Layer (`src/services/duckdbEngine.ts`):** Lazy-initialized singleton worker that registers all 18 Parquet files from `public/data/parquet/` via HTTP URLs and creates 18 SQL views (`agribalyse`, `openfoodfacts`, `efsa_foodex2`, `crosswalk_rosetta`, `nsi_subnational_quintiles`, `ml_timesfm_forecasts`, `consumer_behavior_pulse`, `social_discourse_velocity`, `gi_terroir_registry`, `gs1_immagino_observatory`, `scrapling_retail_claims`, `pan_eu_retail_scanner`, `time_use_cooking_friction`, `clinical_biomarker_grounding`, `school_meals_procurement`, `cultural_climate_inertia`, `global_poore_nemecek_lca`, `global_healthy_diet_affordability`).
- **Theming (`src/utils/chartTheme.ts`, `src/components/ThemedEChart.tsx`, `src/index.css`):** Implements "Hallmark Almanac" light palette and "Evening Obsidian" dark mode (`data-theme="dark"`).

### 2.2 Existing Modules (12 Tabs in `src/App.tsx`)
1. **I. Almanac overview & plate (`overview`):** 5-KPI national ledger + `InteractiveChoroplethMap` (compact) + EAT-Lancet radar + Open Food Facts trilemma scatter + Agribalyse / Poore & Nemecek bar chart + Q1 vs. Q5 distributional equity summary + static Sobol variance bars.
2. **II. NSI & TimesFM 2.0 lab (`nsi_ml` -> `NSIMLObservatory.tsx`):** Time-series forecast chart (2015–2030), PCA + K-means silhouette clustering across 150 subnational/quintile cohorts, NSI quintile bar/line chart, and Rosetta crosswalk table.
3. **III. Consumer behavior & infodemiology (`consumer_pulse` -> `ConsumerBehaviorPulse.tsx`):** 5-stage intention-to-plate cascade, digital attention vs. legume retail shift, Wikimedia language pageviews, social discourse velocity table, 6,845-row GI terroir table, plus nested `EmpiricalSocialMicrodataPlate.tsx` (MTUS time use, NHANES clinical biomarkers, GCNF school meals, ESS/TISP cultural inertia).
4. **IV. Full cartography (`map` -> `InteractiveChoroplethMap.tsx`):** World/Europe choropleth across 10 metrics, 6,845 GI spatial pins (defaulting to 3,037 `FOOD` GIs), selected-GI dossier banner, and 25-row national profile matrix.
5. **V. DuckDB Parquet SQL (`duckdb` -> `DuckDBParquetWorkbench.tsx`):** 11 preset SQL cards, live SQL editor, auto-bar-chart plot, and 100-row result table.
6. **VI. Researcher survey ledger (`sandbox` -> `ResearcherSandbox.tsx`):** Interactive daily food basket editor with CSV upload/template download, cohort presets, Agribalyse search/append, and EAT-Lancet radar.
7. **VII. Retail product trilemma (`trilemma`):** Nutri-Score vs. Eco-Score scatter colored by NOVA + 100-row filtered Open Food Facts table.
8. **VIII. Agribalyse 3.1 (`lca`):** Food-group average CO₂ & water chart + 150-row Agribalyse ledger.
9. **IX. Price & literature (`inflation`):** Eurostat HICP food price indices (2015–2025) + OpenAlex publication velocity stacked bar chart (2010–2025).
10. **X. Policy intervention model (`simulator`):** EAT-Lancet radar + baseline-vs-simulated table driven by 4 sidebar sliders.
11. **XI. Code floorplan & architecture (`floorplan`):** Embedded `iframe` toggling `architecture_blueprint.html` and `floorplan.html`.
12. **XII. Pan-EU Retail Scanner & Claims (`gs1_immagino` -> `GS1ImmaginoObservatory.tsx`):** 7 sub-tabs covering Metaproduct, Push vs. Pull quadrant, 6 Universal Phenomena, Cross-Border Parity, E-Commerce Over-Indexing, DuckDB-powered "Agentic AI Grocery Planner", and D4Vinci Scrapling product stream.

---

## 3. Critical Bugs Found

1. **Agribalyse CSV Export Outputs Empty Columns (`src/App.tsx:818-837`):**
   - `handleExportDataset()` for `exportDatasetKey === 'agribalyse'` reads `a["Groupe_d'aliment"]`, `a.Changement_climatique`, `a['Épuisement_des_ressources_eau']`, and `a.Utilisation_du_sol`.
   - However, `fullAgribalyse` is loaded from `public/data/agribalyse_full.json`, whose keys (written by `scripts/build_parquet_and_geojson.py:46-61`) are `Groupe_aliment`, `Changement_climatique_kg_CO2eq`, `Eau_m3`, and `Sol_Pt`. All four numeric/group columns export as `undefined`.
2. **Broken "Agentic AI Grocery Planner" & Missing Retail Prices (`src/components/GS1ImmaginoObservatory.tsx:640-718, 1458-1513` + `scripts/harvest_raw_prices_scrapling.py:108-115`):**
   - `scrapling_retail_claims.parquet` has **0.0 for all 7 nutritional columns** (`energy_kcal`, `proteins_g`, `sugars_g`, `saturated_fats_g`, `carbohydrates_g`, `fiber_g`, `salt_g`) on **1,355 / 1,355 rows** because the Open Prices API payload lacked nutriments and `harvest_raw_prices_scrapling.py` hardcoded `0.0`.
   - Yet Tab VI (`runAgenticPlanner`) runs `WHERE proteins_g >= 5.0 OR sugars_g <= 8.0 ORDER BY proteins_g DESC` against `scrapling_retail_claims`, returning arbitrary rows with `Kcal: 0`, `Prot: 0g`, `Sugars: 0g`, and `Mean Protein Density: 0 g / 100g` (verified live in Playwright).
   - Meanwhile, the genuine `price_eur`, `price_per`, `retailer`, `country_code`, `city`, and `observed_date` fields harvested in `scrapling_retail_claims.parquet` are omitted from the `ScraplingProduct` TypeScript interface and Tab VII table.
   - Duplicate React key bug in Tab VII (`GS1ImmaginoObservatory.tsx:1480`): uses `key={p.barcode}`, but `scrapling_retail_claims` has 1,355 rows with only 1,343 distinct barcodes (same barcode across multiple retailers/countries).
3. **Broken & Mismatched Crosswalk References (`scripts/build_nsi_and_ml_parquet.py:224-465`):**
   - Querying `crosswalk_rosetta.parquet LEFT JOIN agribalyse_31.parquet ON agb_code = Code_AGB` reveals **2 missing codes** (`26005`, `20047`) and **13 mismatched labels/values**:
     - `20004` labeled `"Bread, wholemeal, commercial"` joins to `"Swiss chard, raw"` (`0.581` vs `0.95`).
     - `20001` labeled `"French baguette, refined wheat"` joins to `"Asparagus, boiled/cooked in water"` (`2.86` vs `1.35`).
     - `25525` labeled `"Plant-based soy/pea burger patty"` joins to `"Topping sauce for pizza"` (`0.94` vs `2.45`).
     - `13005` labeled `"Apples, oranges & seasonal fruit mix"` joins to `"Banana, pulp, raw"`.
     - `15001` labeled `"Walnuts, almonds & hazelnuts, shelled"` joins to `"Peanut"` (`4.18` vs `1.65`).
     - `25010` labeled `"Pre-packaged lasagna, pizza & ready meals"` joins to `"Salt-cured pork belly with lentils"` (`1.66` vs `4.80`).
4. **Target Leakage & Misrepresented Model in Forecasting (`scripts/build_nsi_and_ml_parquet.py:764-926`):**
   - `ml_timesfm_forecasts.parquet` is presented in the UI as **Google TimesFM 2.0 (zero-shot foundation model)** with BigQuery `AI.FORECAST` / PyTorch code snippets.
   - In reality, `timesfm` is neither in `requirements.txt` nor executed in `build_nsi_and_ml_parquet.py`.
   - Worse, during the `VALIDATION (2023-2025)` holdout window (`lines 883-886`), `timesfm_p50` is computed as `0.76 * actual_v + 0.24 * one_step_context` — **leaking 76% of the ground-truth held-out target `actual_v`** into the prediction, making `timesfm_val_mae` and `timesfm_val_rmse` artificially beat multi-step ETS and Ridge baselines. And the 2026–2030 horizon is a linear slope blend (`0.48 * recent_slope + 0.52 * long_slope`), not a foundation model.
5. **Choropleth Stale-Closure Race Condition (`src/components/InteractiveChoroplethMap.tsx:600`):**
   - `mapOption` `useMemo` references `cohdRecords` and `cohdByGeoName`, but omits both from its dependency array (`[geoLoaded, metric, focusView, selectedCountry, METRIC_META, giCountryStats, showGiPins, filteredGiPins, compact]`).
6. **Subpath Asset & Favicon Resolution Bugs (`index.html:5-7`, `src/utils/assetPath.ts:5-15`):**
   - `index.html` uses root-absolute `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`, which 404 on GitHub Pages subpaths (`/dietshift-atlas/`).
   - `getBasePath()` in `assetPath.ts` assumes single-segment subpaths (`/${segments[0]}/`), breaking multi-segment nested deployments.
7. **Silent Fallbacks & Missing CSS Tokens (`src/App.tsx`, `src/components/ResearcherSandbox.tsx`):**
   - `App.tsx` (lines 1556, 1586) and `ResearcherSandbox.tsx` (line 538) reference undefined CSS custom properties `--color-parchment`, `--color-parchment-deep`, `--color-primary`, `--color-paper-card`, and `--color-rule-strong`.
   - `App.tsx` line 509 silently falls back to `EU27_2020` in the Eurostat HICP chart when any of the 14 countries absent from `bundle.eurostat` (e.g., `GBR`, `PT`, `GR`, `USA`, `JPN`) is selected, without updating the chart title (`[{currentProfile.code}]`) — **mislabeling EU-27 HICP data as UK/Portugal/USA data**.
   - `App.tsx:883` and `ResearcherSandbox.tsx:293` create object URLs for CSV downloads without calling `URL.revokeObjectURL(url)`.

---

## 4. Data Integrity & Provenance Audit

Across all **18 Parquet tables (17,897 rows, 881,965 bytes)** and **23 JSON files (20,615,554 bytes)**:

### 4.1 Real Empirical Datasets (Verified External Sources)
- **`agribalyse_31.parquet` (2,451 rows):** ADEME Agribalyse 3.1.1 API (`Code_AGB` unique across all 2,451 rows; 1 row with `Changement_climatique_kg_CO2eq = 0`).
- **`openfoodfacts_eu.parquet` (3,740 rows):** Open Food Facts Search-a-licious API. **Data issue:** `build_consumer_pulse_and_scale_off.py:120-126` silently imputes missing nutriments with constants (`6.5g` protein, `210 kcal`, `2.2g` fiber, `0.65g` salt, `4.5g` sugar, `2.1g` sat fat; 46 rows have this exact default tuple) and defaults missing Eco-Score to `'C' / 52.0` (602 rows). Also, **2,859 / 3,740 rows have `NULL` `primary_country`** due to schema drift between `build_parquet_and_geojson.py` (`primary_country`) and `build_consumer_pulse_and_scale_off.py` (`countries`).
- **`scrapling_retail_claims.parquet` (1,355 rows):** Real Open Prices API (`prices.openfoodfacts.org`) receipts across EU countries with real EUR prices, retailers, cities, and dates, but all 7 nutrient columns are hardcoded `0.0` and missing `nutriscore`/`ecoscore`/`nova_group` silently default to `'C'` / `'C'` / `3`.
- **`gi_terroir_registry.parquet` (6,845 rows):** Real EUIPO GIview + Qualigeo/Qualivita registry entries (`3,037 FOOD`, `3,198 WINE`, `499 SPIRIT`, `111 CRAFT_AND_INDUSTRIAL`), but per-GI `co2_kg_per_kg`, `water_L_per_kg`, `land_m2_per_kg`, `nova_group`, `nutriscore_typical`, and `price_premium_pct` are rule-based class averages assigned by keyword matching in `classify_gi_full()`, not product-level LCA.
- **`global_poore_nemecek_lca.parquet` (45 rows):** Real Poore & Nemecek (*Science* 2018) supply-chain LCA via OWID Grapher CSVs.
- **`global_healthy_diet_affordability.parquet` (1,399 rows):** Real World Bank & FAO *Food Prices for Nutrition* (2017–2024) via OWID Grapher CSVs.
- **`clinical_biomarker_grounding.parquet` (5 rows):** Weighted (`WTDRD1`) adult microdata (`n=4,262`) from CDC NHANES 2021–2023 `.XPT` files (`DEMO_L`, `DR1TOT_L`, `TCHOL_L`, `HDL_L`, `HSCRP_L`, `BPXO_L`). **Caveat:** `ldl_cholesterol_mg_dl` (`0.82 * non_hdl`), `triglycerides_mg_dl` (`0.72 * non_hdl`), `fasting_glucose_mg_dl` (`96.0`), `hba1c_pct` (`5.5`), and `bmi_mean` (`28.4`) are proxy/constant placeholders in `build_deep_empirical_pipeline.py:181-194`.
- **`social_discourse_velocity.parquet` (129 rows):** Real HN Algolia / RSS posts, though `engagement_velocity` is a custom formula (`points + num_comments * 1.8`).
- **`econometric_calibration.json` (12 jurisdictions):** Real Eurostat HBS (`hbs_str_t223`), EHIS (`hlth_ehis_fv3i`), HICP (`prc_hicp_aind`), and PPP (`prc_ppp_ind`), though `empirical_own_price_elasticity` is derived from a heuristic Engel share formula (`-0.42 - min(0.35, share_ratio / 80.0)`), not an estimated demand system.

### 4.2 Stylized / Synthetic / Manually Compiled Datasets (Not Yet Distinguished in UI)
- **`COUNTRY_PROFILES` (`src/types/research.ts:105-631`):** 25 national profiles with hardcoded `dailyCarbonKg`, `dailyWaterLiters`, `dailyLandM2`, `dailyBasketCostEur`, `sayDoGapScore`, `plantProteinSharePct`, and `eatLancetIndex` — no source citation, year, or uncertainty bounds.
- **`efsa_foodex2_surveys.parquet` (1,080 rows):** Generated by multiplying 15 template FoodEx2 rows by 24 hardcoded country multipliers and 3 age multipliers (`scripts/build_parquet_and_geojson.py:134-217`), rather than raw EFSA microdata.
- **`nsi_subnational_quintiles.parquet` (150 rows):** National quintile food budget shares and BMI≥30/fruit-veg anchors come from INE/Eurostat APIs, but subnational NUTS-2 rows, `nova4_energy_share_pct`, `diet_adherence_score`, `daily_carbon_kg`, and hardcoded `pca1`/`pca2` weights (`0.48*z[1]...`) are synthetic extrapolations.
- **`ml_timesfm_forecasts.parquet` (448 rows):** 3 of 4 indicators (`NOVA 4`, `Plant-Protein`, `Carbon`) are synthetic interpolations modulated by HICP; TimesFM was not executed (see Bug #4).
- **`time_use_cooking_friction.parquet` (60 rows), `school_meals_procurement.parquet` (7 rows), `cultural_climate_inertia.parquet` (11 rows), `consumer_behavior_pulse.parquet` (8 rows):** Built from hardcoded country anchor tables and quintile multipliers.
- **`gs1_immagino_observatory.parquet` (61 rows) & `pan_eu_retail_scanner.parquet` (88 rows):** Curated GS1 Italy report metrics + stylized multi-country extrapolations.
- **Hardcoded Sensitivity & Simulation Constants (`src/App.tsx:263-323, 1575-1580`):** Policy simulation sliders apply fixed linear coefficients (`0.42`, `0.24`, `0.48`, etc.), and Overview "Global Sensitivity Analysis (Sobol / OAT Ranking)" renders static hardcoded `[38, 27, 21, 14]` percentages unrelated to user inputs or selected country.

---

## 5. Performance, Technical Debt & UX Audit

1. **Massive Redundant Data Payloads on Initial Load:**
   - `public/data/` stores **19.7 MB of JSON** duplicating **861 KB of Parquet** (23× overhead).
   - On startup, Overview eagerly fetches `live_research_bundle.json` (2.24 MB) + `agribalyse_full.json` (1.18 MB) + `gi_terroir_bundle.json` (6.39 MB) + `world.geojson` (275 KB) + `global_benchmarks.json` (102 KB **fetched twice**, once in `App.tsx` and once in `InteractiveChoroplethMap.tsx`) + `index.js` (1.86 MB) = **~12.2 MB before DuckDB-Wasm is even initialized**.
   - Single unsplit `index.js` bundle (1.86 MB; `chunkSizeWarningLimit: 2000` in `vite.config.ts` masks bundle bloat instead of code-splitting lazy routes/components and ECharts).
2. **Monolithic `src/App.tsx` (2,231 lines):**
   - Mixes global state, simulation engine, 5 ECharts options, CSV exporters, 6 inline module views, header, sidebar, and colophon footer in one file.
3. **Inconsistent Numbering, Metadata, and Design Systems:**
   - Version/table counts disagree across the UI: Masthead says `v3.5`, BibTeX says `v3.4.1` and `16 DuckDB-Wasm Parquet tables (15,147 rows)`, Section XI says `11 In-Memory Parquet Tables` and `9 ZSTD Parquet tables`, DuckDB workbench says `six ZSTD-compressed Parquet files` and shows 9 of 18 table pills.
   - Nav Roman numerals (`I`–`XII`) do not match internal section headings (`DuckDBParquetWorkbench` says `Section IV` on Tab `V`; `ResearcherSandbox` says `Section V` on Tab `VI`; `Trilemma` says `Section VI` on Tab `VII`; `Agribalyse` says `Section VII` on Tab `VIII`; `Policy Simulator` says `Section IX` on Tab `X`; DuckDB preset queries repeat number `9.`).
   - `GS1ImmaginoObservatory.tsx` uses legacy Tailwind hardcoded colors/rounded cards (`#eaedf2`, `bg-white`, `rounded-xl`) rather than Almanac CSS variables, requiring 25+ `!important` overrides in `src/index.css:57-85`, and does not synchronize its `selectedCountry` with `App.tsx`.
4. **Analytical & Visualization Gaps:**
   - `agribalyseGroupOption` (`App.tsx:686-700`) and `timeUseChartOption` / `biomarkerChartOption` (`EmpiricalSocialMicrodataPlate.tsx:141-214`) plot metrics with **incompatible units/scales** on a single numeric axis (e.g., `kg CO2eq/kg` alongside `m³/kg`, `min/day` alongside `%`, `mg/dL` alongside `% risk delta`).
   - `ResearcherSandbox.tsx` (`appendAgribalyseItem`, lines 223–225) hardcodes placeholder `kcalPer100g: 165`, `proteinPer100g: 9.0`, `costEurPerKg: 5.5` for every Agribalyse item appended instead of looking up nutrition or flagging missing nutrition/price as `null`/unknown.
   - No unit switcher (per 100g vs per 100 kcal vs per serving) in nutrition views (`Trilemma` / `OFF`).
   - No dedicated classification mapping inspection/search/export workspace (Rosetta crosswalk only shows 15 rows in a sub-tab of Section II, without `mapping_type`, `confidence`, `explanation`, `source_reference`, `mapping_version`, or unmatched items).
   - No dataset catalog / data quality / provenance status panel exposing update cadence, license, freshness, missingness, or data-tier badges (`Observed`, `Estimated`, `Model Output`, `Forecast`, `Simulated`).
   - Minimal automated testing: 0 TypeScript/React unit, SQL, or E2E tests (only 6 Python assertions in `tests/test_empirical_pipeline.py`).

---

## 6. Prioritized Implementation Roadmap

| Priority | Phase | Scope & Key Deliverables |
| :--- | :--- | :--- |
| **P0 (Critical)** | **Phase 2: Foundation** | Fix critical bugs (Agribalyse CSV export keys, `InteractiveChoroplethMap` hook deps, `index.html`/`assetPath.ts` subpath URLs, `COUNTRY_PROFILES` / HICP fallback mislabeling, CSS undefined tokens, `URL.revokeObjectURL`, duplicate React keys). Introduce central **Dataset Registry & Metadata Layer** (`datasets_registry.json` + validation script separating `raw`, `processed`, `harmonized`, `analytical`, `forecast` tiers, provenance, update classification, and automated quality/null/duplicate/reference checks) and surface a **Data Catalog & Quality** view in the app. |
| **P0–P1** | **Phase 3: Data & Harmonisation** | Fix `openfoodfacts_eu` (`primary_country` & explicit `NULL` instead of silent default nutrition/ecoscore imputation) and enrich `scrapling_retail_claims` with real OFF nutrition where barcode matches (while keeping unmatched nutrients `NULL` rather than `0.0`, and exposing real `price_eur`, `retailer`, `observed_date`). Build a real, validated **Classification Mapping Engine** (`FoodEx2 × Agribalyse × Open Food Facts × COICOP`) with `mapping_type` (`exact`, `partial`, `broader`, `narrower`, `ambiguous`, `unmatched`), `confidence`, `explanation`, `source_reference`, `mapping_version`, plus an interactive **Mapping Inspector & Exporter**. |
| **P1** | **Phase 3: Analytical Engine** | Extract traceable TypeScript analytical modules (`src/analytics/`): Nutrition (per 100 g / per 100 kcal / per serving where reliable, explicit missing-data handling), Environment (unit-consistent LCA comparison, separate dual axes or metric selector), Affordability (clearly separating SKU prices from national HICP/PPP/CoHD indicators, inflation & PPP normalization), and **Integrated Cross-Category Comparator** with downloadable results and drill-down provenance. |
| **P1** | **Phase 4: Advanced Analytics (`v4.1–v4.4.0` CLOSED)** | **COMPLETED & APPROVED (Phases 4A–4D):** Replaced leaked forecasting with causal expanding-origin CV + empirical residual intervals + 7-jurisdiction coverage (`v4.2.0`); added reusable Section XIII Sensitivity Lab with `20` typed scenarios + `SMALL_RANK_CORRELATION_THRESHOLD` + isolated GI diagnostic (`v4.3.1`); added Phase 4D Integrated Robustness Engine (`v4.4.0`), `12` robustness scenarios, Agribalyse denominator-grain guard (`2,451 / 2,161 / 3,114 / 60 / 55 / 83 / 11`), dimension-specific Spearman & `n>=6` Jaccard stability, `13×8` Evidence Coverage Matrix, and separated Macro Context Panel (`prohibited_macro_context_only`). Remaining limitations preserved: unweighted LCI/nutrition means, `0/3,197` per-serving OFF availability, `0–2` EUR/kg retail barcode overlap (`FR`-concentrated), and shared COICOP bridging (`CP0114`/`CP0117`/`CP0119`). |
| **P0–P1** | **Phase 5: System-Wide Scientific & Technical Validation (PROPOSED)** | Comprehensive cross-module audit & remediation ([PHASE5_SYSTEM_VALIDATION_AUDIT.md](../../PHASE5_SYSTEM_VALIDATION_AUDIT.md)): eliminate unit conflation (`pt -> m²`, `m³ world-eq -> L`) and silent placeholder imputation in `ResearcherSandbox.tsx` & `App.tsx` simulator; align `datasets_registry.json` nature tags (`Poore & Nemecek` -> `Estimated`, `NHANES` proxy fields disclosed); separate dual-unit ECharts axes in `EmpiricalSocialMicrodataPlate.tsx`; purge stale `Google TimesFM 2.0` / `3,740` OFF / `9 tables` strings in `App.tsx`, `README.md`, and static HTML; replace duplicate multi-MB JSON fetches with lazy DuckDB-Wasm Parquet queries + Vite chunking (`App.tsx` modularization) & expand component/E2E tests. |
| **P1–P2** | **Phase 6: Final QA, Docs & Release Verification** | Complete cross-engine Parquet/UI/export parity regression suite, WCAG AA accessibility fixes, and final publication documentation alignment. |
