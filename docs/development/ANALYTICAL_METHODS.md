# DietShift Atlas — Analytical Engine Methods

## 1. Nutrition Analytical Engine (Phase 3B · `src/analytics/nutritionEngine.ts`)

Version: `3.1.0-phase3b`

### Supported Comparison Bases & Gates
1. **`per_100g` (`Observed`):** Retains original observed nutrient mass (`g/100g`) and energy (`kcal/100g`) values without rescaling. Genuine observed zero values (`0`) remain numeric `0`; absent values remain `NULL` and are never imputed as zero.
2. **`per_100kcal` (`Model Output` / derived density):** Computed strictly as `(nutrient_100g / energy_kcal_100g) * 100`. Records with `energy_kcal_100g === NULL` (`missing_energy`) or `energy_kcal_100g <= 0` (`non_positive_energy`) are excluded cleanly from calculations and denominators rather than fabricating non-zero energy.
3. **`per_serving` (`Model Output` / derived serving):** Uses observed `serving_quantity_g > 0` (`observed_mass_grams`), or parses explicit serving strings (`g`, `kg`, `mg`, plus `ml`/`cl`/`l` under documented `1.0 g/ml` aqueous density assumption). Missing (`missing_serving_quantity`) or unparseable/non-positive labels (`invalid_serving_quantity`) exclude the product without assuming a default serving size.
   - **Current Snapshot Availability:** Open Food Facts Search-a-licious API hits in `openfoodfacts_eu.parquet` (`3,197` rows) and Open Prices barcode nutrition lookups in `scrapling_retail_claims.parquet` (`1,355` rows) lack serving sizes in the Search index; `per_serving` therefore excludes all records transparently (`Unavailable pending v2 product serving enrichment`).

### Aggregation Weighting & Missingness
- **Aggregation Weighting:** Category-level summaries (`aggregateNutritionByCategory`) compute **unweighted arithmetic product means and medians** across valid non-null barcodes in each category (`n = validDenominator`), not market-share or sales-weighted averages. Every cell displays its explicit denominator `n`.
- **Profile Completeness:** Classifies across `8` tracked nutrients as `complete` (`8/8`), `partial` (`1–7/8`), or `missing` (`0/8`). Observed zeros count as valid measurements.

### Retained Phase 3B Follow-Up Backlog
1. Direct Open Food Facts `/api/v2/product/{barcode}` serving-size enrichment (preserving original labels, units, source IDs, retrieval dates; no invented defaults).
2. Extend retail nutrition harvesting (`harvest_raw_prices_scrapling.py`) to capture total `fat_100g` distinct from `saturated_fats_g`.
3. Refactor `ResearcherSandbox.tsx` custom basket calculations onto `nutritionEngine.ts` adapters.
4. Keep unavailable per-serving basis states clearly communicated across UI panels.

---

## 2. Environmental Analytical Engine (Phase 3C · `src/analytics/environmentEngine.ts`)

Version: `3.2.0-phase3c`

### Source Taxonomies, System Boundaries & Data Nature
1. **ADEME Agribalyse 3.1.1 (`agribalyse_31.parquet`, `2,451` items · `Model Output`):**
   - **Provenance vs. Nature:** Original records come from ADEME/INRAE Agribalyse 3.1.1, while impact metrics are cradle-to-consumer LCA **model outputs**—not physical product measurements.
   - **Geography:** France / European retail supply mix.
   - **System Boundary:** Cradle-to-consumer gate (agriculture, processing, packaging, transport, retail, domestic preparation).
   - **Functional Unit:** `1 kg` of food product (edible/prepared retail state).
   - **Indicators:** Climate change (`kg CO₂eq/kg`), Water scarcity AWARE (`m³ world eq/kg`), Land use EF soil quality (`Pt/kg`), Acidification (`mol H+ eq/kg`), Terrestrial eutrophication (`mol N eq/kg`), and published ADEME PEF 3.1 Single Score (`mPt/kg`).
2. **Poore & Nemecek (Science 2018) via OWID (`global_poore_nemecek_lca.parquet`, `45` commodities · `Estimated`):**
   - **Geography:** Global production-weighted meta-analysis across `38,700` commercial farms in `119` countries (must **not** be presented as nation-specific LCI).
   - **System Boundary:** Farm-to-retail gate (`stage_land_use` through `stage_losses`).
   - **Functional Units Natively Supported:** `per kg` (`ghg_kg_co2eq_per_kg`, `land_use_m2_per_kg`, `freshwater_withdrawals_l_per_kg`, `scarcity_water_l_per_kg`, `eutrophying_g_po4_per_kg`), `per 100g protein` (`ghg_kg_per_100g_protein`, `32/45` non-null), `per 1000 kcal` (`ghg_kg_per_1000kcal`, `38/45` non-null).
3. **EUIPO GIview & Qualigeo Geographical Indications (`gi_terroir_registry.parquet`, `6,845` items · `Estimated` Class Proxies):**
   - Product identities and protection schemes are official EUIPO/Qualigeo records, while `co2_kg_per_kg`, `water_L_per_kg`, and `land_m2_per_kg` are **rule-based keyword class proxies** (`classify_gi_full -> eu_class`). Flagged explicitly (`isClassProxy: true`) and blocked from direct equivalence comparisons with measured/modeled LCI.
   - **Food-Sector Eligibility Filter (`filterFoodEligibleEnvironmentRecords`):** By default excludes `WINE` (`3,198`), `SPIRIT` (`499`), and `CRAFT_AND_INDUSTRIAL` (`111`) rows from food environmental summaries unless explicitly requested, reporting excluded counts transparently.

### Compatibility, Weighting & Composite Rules
- **`checkEnvironmentCompatibility` / `compareEnvironmentRecords`:** Blocks numeric differencing and cross-source pooling whenever functional units (`per kg` vs `per 100g protein` vs `per 1000 kcal`), impact definitions (`AWARE m³ world eq/kg` vs unweighted `L/kg`, `EF Pt/kg` vs `m²/kg`), proxy status, or system boundaries (`cradle-to-consumer` FR vs `farm-to-retail` global) differ; displays original values separately alongside missing requirements (e.g., LANCA characterization factors or regionalized AWARE multipliers). Identical units alone never imply scientific comparability.
- **Composite Prohibition (`attemptCompositeScore`):** Disallows summing climate, water, and land metrics into an ad-hoc index unless explicit normalized weighting factors sum to `1.0` under a documented weighting scheme.
- **Unweighted Summary Distinction (`aggregateEnvironmentByCategory`):** Category tables explicitly distinguish:
  1. **Unweighted category means** (simple arithmetic average over valid LCI items within each group),
  2. **Medians and `[min, max]` ranges** (robust spread across catalog items), and
  3. **Market-share-weighted consumption estimates** (currently *not* computed because retail volume weights are absent; unweighted LCI means must not be read as actual dietary intake or retail sales shares).

---

## 3. Affordability Analytical Engine (Phase 3D · `src/analytics/affordabilityEngine.ts`)

Version: `3.3.0-phase3d`

Explicitly segregates four incompatible economic data types (`checkAffordabilityLayerCompatibility`):
1. **Observed Retail SKU Prices (`scrapling_retail_claims.parquet`, `1,355` SKUs · `Observed`):** Real shelf receipt EUR prices with barcode, retailer, country, and `observed_date`. Computes **`EUR / kg`** (`1,036` mass SKUs) and **`EUR / L`** (`187` liquid SKUs) strictly from observed `product_quantity` & `product_quantity_unit` (`evaluateRetailUnitPrice`), excluding `132` rows missing package quantity (`missing_package_quantity`) and preventing mass-vs-volume conflation (`incompatible_mass_vs_volume`).
2. **HICP Price Indices (`prc_hicp_aind` / `ONS MM23`, `2015 = 100` · `Observed`):** Computes temporal index-point delta, cumulative `% change`, and annualized CAGR while refusing to interpret an HICP index as an absolute retail price (`isAbsolutePrice: false`).
3. **PPP Food Price-Level Index (`prc_ppp_ind`, `PLI_EU27_2020`, `A01`, reference year `2024` · `Observed`):** Country-level purchasing-power price comparison (`EU27_2020 = 100`, distinct from FX conversion). Explicitly refuses scaling single retail SKUs via aggregate macro PLI (`refuseSkuPppConversion`).
4. **Cost of a Healthy Diet (`global_healthy_diet_affordability.parquet`, World Bank & FAO · `Observed`):** Measures daily national least-cost healthy diet thresholds (`ICP PPP USD / person / day`) and headcount unaffordability (`%` / millions, preserving `NULL`s), never equating macro diet thresholds with single SKU prices.

---

## 4. Integrated Category Comparator (Phase 3D · `src/analytics/integratedComparator.ts`)

Version: `3.4.0-phase3d`

- Joins Open Food Facts (`Observed`, `per 100g`), ADEME Agribalyse 3.1.1 (`Model Output`, `per 1 kg` French mix), Eurostat HICP/PPP & World Bank CoHD (`Observed` macro context), and exact Open Prices barcode matches through the versioned **`classification_mappings`** concordance.
- Surfacing of mapping uncertainty: preserves **`directly_supported`**, **`approximate_or_hierarchical`**, **`ambiguous_split`**, and **`unsupported_unmatched`** (e.g., COICOP `CP0115` Oils & fats, `CP012` Non-alcoholic beverages).
- **Composite Prohibition (`attemptUnifiedFoodScore`):** Explicitly refuses collapsing Nutrition, Environment, and Affordability into a single arbitrary score; supports transparent ranking within ONE compatible dimension at a time (`rankCategoriesWithinDimension`).

### Preserved Phase 3D Limitations
1. Open Prices EU (`1,355` SKUs) is concentrated in France (`1,178`) and Germany (`115`); not a representative EU retail shelf sample.
2. Only `4` exact barcodes overlap between the current Open Food Facts Search catalog sample and Open Prices EU.
3. Integrated comparison is predominantly category-level across COICOP/FoodEx2/Agribalyse bridges, not a complete SKU-level 3D comparison.
4. Ambiguous (`ambiguous_split`) and unmatched (`unsupported_unmatched`) classification mappings remain visible and excluded cleanly rather than smoothed over.
5. National HICP indices (`2015=100`), Eurostat PPP Food PLI (`EU27=100`), and World Bank CoHD (`ICP PPP USD/day`) are macroeconomic population indicators—never observed product prices.
6. Unweighted means reflect catalog/receipt sample arithmetic means, never market-share-weighted sales volumes.

---

## 5. Statistical Forecasting, Uncertainty & Sensitivity Architecture (Phase 4)

### Phase 4A Implemented — Leak-Free Expanding-Origin Validation & Fold Accounting
- **Models & Baselines Compared:**
  1. `Damped Trend Holt ETS (α=0.55, β=0.35, φ=0.85)`
  2. `Holt Linear Trend ETS (α=0.55, β=0.35, φ=1.0)`
  3. `Ridge Linear Trend (λ=1.5)`
  4. `Random Walk with Drift (Naive Baseline)`
  5. `Random Walk (Last-Value Naive Baseline)`
- **Exact Expanding-Origin Fold Schedule (`15` valid evaluations per series · `525` across `35` series):**
  For `n = 11` annual observations (`2015–2025`), `minTrainLength = 5`, and `maxHorizon = 3`, all six origins (`2019–2024`, `k = 5..10`) are evaluated strictly on observed targets (`≤ 2025`, zero unobserved targets):
  - Origin `2019` (`2015–2019`, `5` yrs) → targets `2020 (h=1)`, `2021 (h=2)`, `2022 (h=3)` (`3` obs)
  - Origin `2020` (`2015–2020`, `6` yrs) → targets `2021 (h=1)`, `2022 (h=2)`, `2023 (h=3)` (`3` obs)
  - Origin `2021` (`2015–2021`, `7` yrs) → targets `2022 (h=1)`, `2023 (h=2)`, `2024 (h=3)` (`3` obs)
  - Origin `2022` (`2015–2022`, `8` yrs) → targets `2023 (h=1)`, `2024 (h=2)`, `2025 (h=3)` (`3` obs)
  - Origin `2023` (`2015–2023`, `9` yrs) → targets `2024 (h=1)`, `2025 (h=2)` (`2` obs)
  - Origin `2024` (`2015–2024`, `10` yrs) → target `2025 (h=1)` (`1` obs)
  Totals by horizon: `h=1` has `6` folds (`210` across 35 series), `h=2` has `5` (`175`), `h=3` has `4` (`140`) → `6 + 5 + 4 = 15` (`525` total).
- **Metric Aggregation & Performance Interpretation:**
  - Within each series (`15` folds), `MAE`, `sMAPE (%)`, and `MASE` are unweighted averages across all valid `(origin, horizon)` pairs (`h=1` contributes `6/15`, `h=2` `5/15`, `h=3` `4/15`), while `RMSE` is the root-mean-square error over those `15` folds. Across the `35`-series suite, `MAE`, `sMAPE`, and `MASE` match the unweighted mean across series (each series has identical fold count `15`), whereas suite `RMSE` is the **pooled RMSE** over all `525` fold errors.
  - **`MASE > 1` vs. Relative Baseline Wins (`Random Walk w/ Drift` `34/35`):** `bestModelByCvMae` ranks the 5 candidate models descriptively on the expanding-CV sample (not an independent post-selection outer holdout). A mean MASE of `4.566` does not contradict winning `34/35` comparisons: it shows that out-of-sample multi-step (`h=1..3`) errors exceed the in-sample 1-step naïve training scale `scale_k` computed on `[2015..originYear]`, consistent with small pre-2021 annual steps and potentially influenced by the 2022–2023 food inflation shock.

### Phase 4B Implemented — Forecast Uncertainty & Horizon Controls (`v4.2.0-phase4b`)
- **Interactive Horizon & Model Controls:** Section II provides selectable forecast horizon end years (`2026–2030`), primary model selection across all 5 statistical/naive models, and visual separation between `OBSERVED_HISTORY` (`2015–2025`), fixed-origin `HISTORICAL_BACKTEST` (`2023–2025`), and `FUTURE_FORECAST` (`2026–endYear`).
- **Residual Segregation & Percentage Normalization Formula:**
  - Unpooled single-series residuals (`none_single_series`) preserve exact index-point units per horizon (`n=6, 5, 4`); multi-series unnormalized pooling is rejected explicitly (`throw`).
  - Cross-series pooling requires explicit percentage normalization (`pctResidual = 100 * (actual - predicted) / predicted`, denominator = `predicted`, returning `null` when `!Number.isFinite(actual)` or `!Number.isFinite(predicted)` or `|predicted| <= 1e-9`) or training-scale (`suite_mase_scaled`) normalization. Its algebraic inverse mapping onto a future forecast is `pointForecast * (1 + quantile / 100)`.
- **Four-Way Interval & Coverage Taxonomy (`n ≥ 10` Quantile Threshold):**
  1. **Historical Empirical Residual Envelopes** (`empirical_single_minmax`): Single-series observed `min–max` bounds for `h=1..3` (`P10/P90` suppressed since `n = 4..6 < MIN_SAMPLE_FOR_P10_P90 = 10`).
  2. **Historical Empirical Residual Quantile Intervals** (`empirical_suite_pct_p10_p90`): Linear Type-7 `P10–P90` on %-normalized cross-suite residuals (`h=1: n=210, h=2: n=175, h=3: n=140`). Never presented as calibrated 80% prediction intervals; horizons `h=4..5` (`2029–2030`) carry `n=0` CV residuals and return `Unavailable`.
  3. **Heuristic Parametric Spreads** (`heuristic_spread`): Indicative `±1.2816 · σ · √h` symmetric scaling, not empirical quantiles.
  4. **Observed Historical Interval Coverage** (`evaluateEmpiricalIntervalCoverage`): Strictly causal prior-fold evaluation (`prior.targetYear ≤ originYear`, never including the evaluated fold's own residual). Causal backtesting does **not** guarantee residual independence, exchangeability across jurisdictions or origins, or future calibration under structural breaks.
- **Reconciling Coverage Denominators (`210` & `315` out of `525` CV evaluations across `35` series):**
  - *Single-Series Envelope & Heuristic Spread (`≥2` same-series same-horizon priors):* Eligible folds are `h=1`: `140/210` (`origins 2021–2024`), `h=2`: `70/175` (`origins 2022–2023`), `h=3`: `0/140` (`all <2 priors`) → **`210` eligible** (`6`/series), `315` excluded (`210` with `0` prior horizon targets + `105` with `1` prior `<2`).
  - *Suite %-Normalized P10–P90 (`≥10` pooled same-horizon priors across `35` series):* Eligible folds are `h=1`: `175/210` (`origins 2020–2024`, since origin `2020` pools `35` series × `1` prior year = `35 ≥ 10`), `h=2`: `105/175` (`origins 2021–2023`), `h=3`: `35/140` (`origin 2022`) → **`315` eligible** (`9`/series), `210` excluded (`0` prior horizon targets `≤ originYear`).
- **Positive-Residual Interval Offset (e.g., Italy `2028` `h=3`):** Because empirical bounds add observed `actual − predicted` residuals directly onto `pointForecast`, when every historical `h=3` residual is positive (as in Italy `n=4`: `+8.32..+20.57`, shifting `152.65 → [160.97, 173.22]`), the entire interval lies above the unadjusted point forecast. This is an uncentered historical under-prediction adjustment, not a guarantee of future price direction.
- **Jurisdiction-Level Coverage Diagnostics (`byJurisdiction`, `evaluateCoverageMatrixAllModels`):** Partitions the `525` CV evaluations cleanly across all `7` jurisdictions (`DE`, `ES`, `EU27_2020`, `FR`, `GBR`, `IT`, `NL`, `5` food baskets each = `75` folds/jurisdiction; `30` eligible under Single-Series/Heuristic and `45` under Suite Quantiles) with `h = 1, 2, 3` breakdowns. Explicitly flags horizons/jurisdictions with `n < MIN_COVERAGE_EVAL_SAMPLE (20)` (including `h=2` `n=10..15` and `h=3` `n=0..5`) and notes intra-jurisdiction correlation across the `5` baskets to prevent over-interpreting small-sample country coverage rates. Included in CSV/JSON exports and Section II expandable diagnostics.

### Phase 4C Implemented — Empirical Sensitivity Analysis (`src/analytics/sensitivityEngine.ts`, `v4.3.1-phase4c`)
- **Removed Static Proxy:** Replaced the hardcoded `[38, 27, 21, 14]` "Sobol / OAT Ranking" percentages in `src/App.tsx` with dynamic Policy Lever OAT telemetry + the reusable Section XIII Empirical Sensitivity Lab (`src/components/SensitivityPanel.tsx`).
- **Orthogonal Scenario Classification (`scenarioType` × `scenarioOrigin` × `effectMechanism`):**
  Every scenario records:
  - `scenarioType`: `'data_subset_sensitivity'`, `'missingness_sensitivity'`, `'methodological_sensitivity'`, `'boundary_or_functional_unit_sensitivity'`, or `'diagnostic_stress_test'`.
  - `scenarioOrigin`: `'empirical_alternative'` vs `'analyst_defined'` (e.g., `<100g` micro-pack threshold in `pkg_exclude_micropacks_100g` is `analyst_defined` + `data_subset_sensitivity`).
  - `effectMechanism`: Distinguishes `'analytical_method_change'`, `'sample_population_change'`, `'functional_unit_or_boundary_change'`, and `'inclusion_exclusion_rule'` so sample-composition changes are never presented as pure estimator differences.
- **Spearman Rank-Correlation Sample Metadata:** Exposes `pairwiseSampleSize`, `tiedRankGroupsBaseline`, `tiedRankGroupsScenario`, `tiedRankGroupsCount`, `excludedCategoriesCount`, `comparisonScope`, and `smallRankSampleWarning` (`n < 10`), avoiding arbitrary p-values or misleadingly equal visual emphasis on `n=4..6` vs `n=45` correlations.
- **Weighting Distinction & LCI-Record-Count Terminology:** Explicitly separates **`LCI-record-count weighting`** (baseline in Agribalyse–COICOP bridges, reflecting database LCI inventory counts rather than consumer intake), **`Equal-subgroup weighting`** (`1/k` per matched subgroup), and **`Market-share / consumption weighting (unavailable)`**.
- **Isolated GI Diagnostic Stress Test (`env_gi_unfiltered_alcohol_leak`):** Labeled `Diagnostic stress test — invalid sector inclusion` (`isDiagnosticOnly = true`), rendered visually separate from valid scenarios in Section XIII, while default `environmentEngine` strictly preserves `FOOD`-only (`3,037`) eligibility.
- **Uncertainty Assumption Registry (`UNCERTAINTY_ASSUMPTION_REGISTRY`):** Covers all `6` dimensions (`20` total scenarios: `19` valid alternatives + `1` isolated diagnostic stress test) and blocks `UNSUPPORTED_SENSITIVITY_EXPERIMENTS` (global Sobol/Monte Carlo priors, synthetic market-share weights, OFF per-serving, and `n=1` country claims).

### Phase 4D Architecture & Methodology (`src/analytics/integratedRobustness.ts`, `v4.4.0-phase4d`)
- **Preserves Existing Modules:** Reuses `classificationEngine`, `nutritionEngine`, `environmentEngine`, `affordabilityEngine`, `integratedComparator`, and `sensitivityEngine` directly on read-only datasets without altering `integratedComparator.ts` ranking outputs or creating unified composite scores.
- **Classification Uncertainty Regimes:** Evaluates baseline (`all usable mappings`), exclude ambiguous (`-34` rules), strict exact+hierarchical (`-50` rules), and exact-only (`6` rules, `0` COICOP bridges → `0` rankable COICOP-Agribalyse categories), distinguishing rule counts from usable integrated bridges and tracking status migrations (`directly_supported`, `approximate_or_hierarchical`, `ambiguous_split`, `unsupported_unmatched`).
- **Nutrition Completeness & Derived Basis:** Separates `per_100g` pairwise baseline (reporting nutrient-specific denominators), Core-5 complete-case (`n=3,130`), Full-8 complete-case (`n=1,846`), and `per_100kcal` functional-unit sensitivity. Treats `3,097` strictly as the positive-energy eligible pool (`energy_kcal > 0`) while computing separate intersecting valid denominators per nutrient (`energy_kcal > 0 && nutrient !== null`); keeps `per_serving` `Unavailable` (`3,197` missing `serving_quantity_g`); forbids cross-unit arithmetic deltas.
- **Separated Environmental Streams:** Keeps `Agribalyse 3.1.1` (`Model Output`, France cradle-to-consumer; LCI-record-count vs equal-subgroup `1/k` vs median, verified `0` within-COICOP duplicate subgroup codes), `Poore & Nemecek 2018` (`Estimated`, global farm-to-retail; full vs ex-transport, `per_kg` vs `per_100g_protein` ordinal rank check), and `GI Terroir` (`Proxy / Estimated`, `FOOD`-only `3,037` items) strictly segregated—never pooling across streams or using GI proxies to replace missing LCI data.
- **Agribalyse Weighting Denominator Grain Reconciliation (`rob_env_agb_lci_count_vs_equal_subgroup`):**
  - `totalAgribalyseLciCatalogCount`: `2,451` ADEME Agribalyse 3.1.1 items (`290` unmapped to OFF categories / belonging to unmatched `CP012` beverages).
  - `validLciRecordCount`: `2,161` unique mapped LCI records with valid CO₂eq entering at least one OFF category.
  - `categoryLciRecordPairCount`: `3,114` category–LCI-record assignments across `11` eligible categories (reflecting `953` items shared where two OFF categories map onto the same COICOP division: `CP0114` [`259`], `CP0117` [`332`], `CP0119` [`362`]).
  - `totalCoicopMappedSubgroupCount` vs `uniqueLciSubgroupCount` vs `categorySubgroupPairCount`: `60` total `Agribalyse -> COICOP` rules (`55` active in the `11` OFF categories + `5` in unmatched `CP012`); `28` active subgroups are shared across `CP0114` (`6`), `CP0117` (`6`), and `CP0119` (`16`), yielding `55 + 28 = 83` category–subgroup pairs producing `11` final category estimates.
  - Because LCI-record assignments (`3,114` / `2,161`) and category–subgroup pairs (`83` / `55`) represent **incompatible analytical grains**, ordinary `denominatorDelta` subtraction is structurally blocked (`denominatorDelta = null`, `denominatorGrainComparable = false`, guarded by `assertDenominatorGrainCompatibility`).
- **Dimension-Specific Ranking Isolation:** Every Spearman coefficient and Top-$K$/Bottom-$K$ stability check identifies its exact single analytical dimension (`dimension`, `baselineDimension`, `scenarioDimension`, `pairwiseSampleSize`, `smallRankSampleWarning` for `n < 10`), reporting independent `dimensionRankings[]` without ever pooling across nutrients (`protein_per_100g`, `fiber_per_100g`, `sugars_per_100g`, `energy_kcal_per_100g`, `protein_per_100kcal`, `fiber_per_100kcal`, `sugars_per_100kcal`) or environmental indicators (`agb_climate_co2eq_per_kg`, `agb_water_aware_m3_per_kg`). Classification scenarios (`rob_cls_exclude_ambiguous`, `rob_cls_strict_hierarchy`) report separate `agb_climate_co2eq_per_kg` and `agb_water_aware_m3_per_kg` correlations with preserved `n = 5` small-sample warnings.
- **Affordability Denominators & Descriptive Retail Coverage:** Independently evaluates Full (`1,355` raw / `1,036` `EUR/kg` / `187` `EUR/L` / `4` OFF barcode matches = `2` `EUR/kg` + `2` `EUR/L`), France (`1,178` / `904` / `172` / `4` OFF matches), and Germany (`115` / `94` / `6` / `0` OFF matches). Prohibits category-level affordability ranking stability from `0–2` `EUR/kg` barcode hits (descriptive SKU evidence only) and excludes `hicp_inflation_pct`, `PPP`, and `CoHD` from category ranking dimensions (macro context only).
- **Common-Universe Top-$K$/Bottom-$K$ Group Stability (`n >= 6` Gate):** Evaluates `rankingStability` only within compatible category dimensions over common universe $U = C_{\text{base}} \cap C_{\text{scen}}$ (`K = min(3, n)`), retaining cutoff ties with disclosed realized group sizes. Below `n = 6` eligible categories, returns `groupStabilityStatus = 'insufficient_group_stability_universe'`.
- **13-Category × 8-Layer Evidence Coverage Matrix:** Separates evidence nature (`Observed`, `Estimated`, `Model Output`, `Proxy`, `Missing`) from availability and scope across all `13` nodes × `8` category layers, with `HICP`, `PPP`, and `CoHD` displayed in a separate National/Macro Context panel.
