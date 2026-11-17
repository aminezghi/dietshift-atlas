# DietShift Atlas — Researcher & Policy Analyst User Guide (WP5)

**Software Baseline:** `v5.2.0-phase5c`  
**Audience:** Food systems researchers, nutritional epidemiologists, LCA analysts, policy economists, and civic data users.

---

## 1. Interface Architecture & Global Controls

DietShift Atlas executes 100% locally in your web browser with zero server tracking. The main view pairs a **sticky Left Control Deck** with **13 tabbed observatories (`I`–`XIII`)**, accessible via the navigation bar or URL hash deep-links (e.g., `#module=inflation&country=GBR&plant=35&upf=25`).

### 1.1 Header Utilities
- **Data Catalog (`DataCatalogModal`):** Opens an accessible modal (`Esc` / focus-trapped) listing every dataset's live record count, column schemas, null percentages, license string, source URLs, SHA-256 hash, and data-quality notices directly from `datasets_registry.json`.
- **Dataset CSV Export (`Export` dropdown in Overview / Masthead):** Downloads normalized CSV files (`openfoodfacts`, `agribalyse`, current country simulation CSV, `time_use`, `biomarkers`, `school_meals`, `cultural_inertia`).
- **Cite (BibTeX) & Theme Toggle:** Copies a BibTeX citation snippet *(note: hardcoded `version = {4.0.0}` in `src/App.tsx:1099` is flagged for update in Phase 6A readiness review)* and toggles between paper-tinted light mode and dark mode.

### 1.2 Left Control Deck
1. **Jurisdiction Selection (`25` editions) & Reference Comparison:** Selects primary focal country (`EU27_2020`, EU Member States, `GBR`, or global benchmarks such as `USA`, `JPN`, `BRA`, `CAN`, `AUS`). **Important:** Sub-panels without native country rows automatically disclose fallback reference mappings (e.g., **`[EU27_2020 FALLBACK]`** for UK HICP inflation, or **`[IT]`** in sub-panels limited to European countries).
2. **Assortment & NOVA Filter (`openfoodfacts_eu.parquet`, `3,197` records):**
   - Free-text search box (`Filter food, brand, or LCA item...`), curated food-category dropdown (`11` categories), and `NOVA 1–4` buttons.
   - **`Include Unknown NOVA (NULL)` checkbox (`data-testid="toggle-missing-nova"`):** Keeps barcoded products lacking NOVA classification visible by default and displays exact matched/excluded `NULL` record counts whenever unchecked.

---

## 2. Walkthrough of the 13 Interactive Sections (`I`–`XIII`)

| Tab | Section Title | Primary Purpose & Key Interactive Controls |
| :---: | :--- | :--- |
| **I** | **Almanac overview & plate** | Displays the EAT-Lancet comparative dietary scorecard (`COUNTRY_PROFILES`, `Manually Compiled`), Plate II (`Open Food Facts` macro-nutrients vs NOVA), Plate III (`Eurostat HICP` inflation with explicit `[EU27_2020 FALLBACK]` caption/chart title when active), and Plate IV (`Agribalyse 3.1` [`Model Output`] vs `Poore & Nemecek` [`Estimated`] switch). Every chart has an accessible **View Data Table** toggle (`ThemedEChart`). |
| **II** | **NSI & statistical forecasts** | Inspects regional income-quintile equity (`Q1–Q5`, `nsi_subnational_quintiles`) paired with the **Statistical Price Forecasting Lab** (`35` HICP series across `7` jurisdictions). Select horizon end year (`2026–2030`), toggle among `5` statistical/naive models, inspect expanding-origin CV folds (`2019–2024` -> `15` folds/series), and compare `empirical_single_minmax`, `empirical_suite_pct_p10_p90`, and `heuristic_spread` bands (`h=4..5` explicitly marked `Unavailable`). Export `dietshift_forecast_uncertainty.csv`. |
| **III** | **Consumer behavior & infodemiology** | Visualizes the intention-to-plate behavioral decay cascade (`consumer_behavior_pulse`), time-use culinary poverty (`time_use_cooking_friction`), CDC NHANES biomarker quintiles (`clinical_biomarker_grounding`, strictly single-unit plots separating measured `Total-C`, `Non-HDL-C`, `hs-CRP`, `SBP` from derived columns), statutory school meals (`school_meals_procurement`), ESS/TISP cultural inertia, and HN/RSS discourse velocity. |
| **IV** | **Full cartography** | Interactive ECharts geographic maps combining `world.geojson`, EU food systems layers, and Geographical Indication (`gi_terroir_registry`) points. Discloses proxy status on GI environmental attributes. |
| **V** | **DuckDB Parquet SQL** | Live in-browser analytical SQL engine (`@duckdb/duckdb-wasm`). Loads **12 curated preset analytical queries** across all `19` registered views (`17,627` rows) or runs arbitrary `SELECT` SQL directly over local ZSTD `.parquet` files with millisecond execution timing. |
| **VI** | **Researcher survey ledger** | Interactive dietary recall workspace (`ResearcherSandbox.tsx`). Download blank-preserving `dietshift_researcher_survey_template.csv`, upload participant recall CSVs, or append ADEME Agribalyse 3.1.1 items. Native **`AWARE m³ world-eq/d`** and **`PEF Pt/d`** units are preserved alongside explicit missing-field counters (`kcalMissing`, `proteinMissing`, `costMissing`, `novaMissing`). |
| **VII** | **Retail product trilemma** | Powered by `nutritionEngine.ts` (`NutritionComparisonPanel`) and `classificationEngine.ts`. Switch comparison bases (**`Per 100 g`**, **`Per 100 kcal`** [`3,097/3,197` eligible; nutrient-specific denominators], **`Per Serving`** [`Unavailable — 0% computable`]), audit zero vs `NULL` profiles, and inspect/export filtered product CSVs (`dietshift_openfoodfacts_<country>.csv`). |
| **VIII** | **Agribalyse 3.1 (2,451)** | Powered by `environmentEngine.ts` (`EnvironmentComparisonPanel`). Switch segregated streams (`Agribalyse 3.1.1`, `Poore & Nemecek 2018`, `GI Terroir` default **`FOOD`-only `3,037`** filter with optional opt-in to view `3,808` excluded wine/spirit/craft items), compare unweighted means vs medians `[min, max]`, and view explicit cross-unit incompatibility blocks. |
| **IX** | **Affordability & integrated comparator** | Two coordinated sub-views: (a) **`AffordabilityAndIntegratedPanel`** segregating **`EUR/kg` (`1,036`)** vs **`EUR/L` (`187`)** Open Prices SKUs, Eurostat HICP (`2015=100`), PPP PLI (`EU27=100`), World Bank CoHD (`ICP PPP USD/day`), `classification_mappings` concordance audit (`ClassificationInspector`), and un-pooled single-dimension category ranking; (b) **`IntegratedRobustnessPanel` (Phase 4D)** displaying all `12` robustness scenarios, **`13×8` Evidence Coverage Matrix**, separated National/Macro context table, Agribalyse weighting grain ledger (`2,451/2,161/3,114/60/55/83/11`), nutrient-specific `per_100kcal` denominators, and `Export Robustness CSV` / `Export JSON Dossier`. |
| **X** | **Policy intervention model** | Interactive heuristic policy sliders (`Plant-rich dietary shift %`, `UPF reduction %`, `Carbon price €/tCO₂eq`, `Food waste cut %`). Displays **`Simulated` / `Analyst-Defined`** linear sensitivity deltas over `COUNTRY_PROFILES` alongside Eurostat HBS `Q1/Q5` tax exposure ratio, explicitly reporting `Uncertainty Interval: Unavailable` and `Nominal EUR (No PPP)` in UI and CSV exports. |
| **XI** | **Code floorplan & architecture** | Visual system map linking ingestion scripts, Parquet schemas, pure TypeScript engines, and frontend views alongside embedded blueprint views. |
| **XII** | **Pan-EU Retail Scanner & Claims** | Inspects GS1 Italy *Osservatorio Immagino* transcribed summary cohorts (`61` rows) and harmonized Pan-EU scanner benchmarks (`88` rows, `Estimated`), clearly separating real Italian report benchmarks from modeled EU country estimates. |
| **XIII** | **Empirical sensitivity** | Powered by `sensitivityEngine.ts v4.3.1-phase4c` (`SensitivityPanel`). Inspect all **`19` valid one-at-a-time sensitivity scenarios** across `6` dimensions alongside Spearman rank comparisons (`n`, ties, small-sample `<10` warnings), view the **`env_gi_unfiltered_alcohol_leak` diagnostic stress test** strictly isolated below the main matrix, and export CSV/JSON sensitivity dossiers. |

---

## 3. Reading Badges, Units, Missingness & Fallback Notices Correctly

### 3.1 Provenance & `DataNatureBadge` Colors
Always read the badge displayed next to a chart title or table header before interpreting numbers:
- **`Observed`:** Raw reported barcode values (`openfoodfacts_eu`), actual EU receipt unit prices (`scrapling_retail_claims`), official Eurostat HICP/PPP, World Bank CoHD. Preserves `NULL`s cleanly.
- **`Model Output`:** Cradle-to-consumer French LCA inventories (`agribalyse_31`), regional NUTS-2 SVD quintile disaggregations (`nsi_subnational_quintiles`), or derived `per_100kcal` nutrition density ratios.
- **`Estimated`:** Global meta-analysis (`global_poore_nemecek_lca`), keyword GI class proxies (`gi_terroir_registry`), stylized surveys/benchmarks (`efsa_foodex2_surveys`, `time_use_cooking_friction`, `consumer_behavior_pulse`, `pan_eu_retail_scanner`), or mixed empirical/proxy biomakers (`clinical_biomarker_grounding`).
- **`Forecast`:** Expanding-origin historical CV (`2015–2025`) and forward projections (`2026–2030`) with strict separation of `OBSERVED_HISTORY`, `HISTORICAL_BACKTEST`, and `FUTURE_PROJECTION`.
- **`Manually Compiled` / `Simulated`:** Curated classification bridges (`161` rules), static policy legal tables (`school_meals_procurement`), manual country profiles (`COUNTRY_PROFILES`), interactive Policy Simulator heuristics, and Sandbox baskets.

### 3.2 Critical Unit & Denominator Rules
- **Water scarcity (`Eau_m3` / `waterM3PerKg`):** Measured in **AWARE `m³ world eq / kg`** (deprivation-weighted cubic meters), **never** raw physical liters of consumed water.
- **Land footprint (`Sol_Pt` / `landPtPerKg`):** Measured in dimensionless/normalized **PEF 3.1 soil-quality `Pt / kg`**, **never** `m²`. Physical land area (`m²/kg`) exists only inside Poore & Nemecek 2018 (`farm-to-retail`) and GI keyword proxies.
- **Denominators (`n`) & Missingness (`NULL`):** An observed nutrient zero (`0 g`) is included in averages; missing nutrients (`NULL`) are excluded individually so denominators differ across nutrients (`protein` vs `fiber` vs `sugars`). In Section VII, `per_serving` shows `0` computable because `serving_quantity_g` is `100%` missing (`NULL`) in the current OFF Search snapshot.

---

## 4. Valid vs. Invalid Conclusions (Practical Decision Guide)

| Intended Claim / Conclusion | Permitted? | Scientific Reason & Required Qualification |
| :--- | :---: | :--- |
| *"Across the 3,197 captured Open Food Facts items, unweighted mean protein per 100 kcal shifts ordering vs per 100 g when excluding 100 non-positive/missing energy rows."* | **YES** | Verified category arithmetic with explicit `3,097` eligible pool and per-nutrient denominators. |
| *"EU retail receipt unit prices (EUR/kg vs EUR/L) show wide dispersion across the 1,223 unit-priced Open Prices EU records, heavily concentrated in France (1,076) and Germany (100)."* | **YES** | Accurate descriptive summary preserving mass/volume separation and geographic skew. |
| *"Within ADEME Agribalyse 3.1.1 categories, unweighted LCI-record means and equal-subgroup (`1/k`) means yield different CO₂eq estimates when shared COICOP codes link 55 active subgroups to 83 pairs."* | **YES** | Directly measured in Phase 4D (`rob_env_agb_lci_count_vs_equal_subgroup`). |
| *"High-fiber foods in Germany sell for €X/kg less than low-fiber foods across all 11 food categories."* | **NO** | Open Prices EU contains **0 exact OFF barcode overlaps in Germany** and only **2 `EUR/kg` overlaps in France**; category-level affordability ranking is statistically unsupported. |
| *"UK food HICP rose by X% based on national UK HICP data shown in Overview Plate III."* | **NO** *(unless verified as ONS MM23 series)* | When Overview shows **`[EU27_2020 FALLBACK]`**, the chart is displaying EU-27 aggregate inflation because country-level Eurostat HICP series was unavailable for the active view. |
| *"Setting Carbon Tax = €100/t in Section X proves with 95% confidence that national diet CO₂eq falls by Y%."* | **NO** | Section X applies uncalibrated linear analyst slopes over manually compiled `COUNTRY_PROFILES`; policy uncertainty CIs and causal elasticities are explicitly unavailable. |
| *"Random Walk with Drift forecasts for 2029–2030 have validated 80% empirical prediction intervals."* | **NO** | `h=4..5` (`2029–2030`) have zero historical CV folds (`n=0`, intervals `Unavailable`); only `h=1..3` carry historical residual intervals (`n=4..6` single series, `210..140` suite %-normalized). |
| *"PDO/PGI cheeses in `gi_terroir_registry` have lower measured life-cycle CO₂ than conventional dairy."* | **NO** | GI registry environmental numbers are secondary keyword class proxies (`isClassProxy: true`), not product-measured LCAs. |
