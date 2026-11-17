# DietShift Atlas — Scientific Methodology (WP2)

**Engine Baseline:** `v5.2.0-phase5c`  
**Normative Principle:** Every analytical calculation executes client-side via deterministic, strongly typed TypeScript modules in [`src/analytics/`](../src/analytics/) with explicit unit compatibility checks, missingness preservation (`NULL` is never imputed as `0`), denominator reporting, and separation of empirical observations from modeled estimates, forecasts, and heuristic simulations.

---

## 1. Nutrition Analytical Engine (`src/analytics/nutritionEngine.ts`, `v3.1.0-phase3b`)

### 1.1 Data Sources & Completeness Taxonomy
- **Primary Food Catalog:** `openfoodfacts_eu.parquet` (`3,197` SKUs across `11` harmonized food categories; `Observed` snapshot retrieved `2026-11-16`).
- **Secondary Retail Enrichments:** `scrapling_retail_claims.parquet` (`1,355` Open Prices SKUs enriched where barcode lookup succeeded: `1,023` observed / `8` partial / `324` missing).
- **Tracked Nutrient Keys (`8`):** `energy_kcal`, `proteins_g`, `carbohydrates_g`, `sugars_g`, `fat_g`, `saturated_fat_g`, `fiber_g`, `salt_g`. *(Note: retail Open Prices lookups currently lack total `fat_100g` separate from `saturated_fats_g`.)*
- **Profile Completeness Classification:**
  - `complete`: `8/8` tracked nutrients non-null
  - `partial`: `1–7/8` tracked nutrients non-null
  - `missing`: `0/8` tracked nutrients non-null
- **Zero vs. Missing Rule:** Observed nutritional zeros (e.g., `0 g/100g` sugars in bottled water or plain coffee) are preserved as numeric `0` and included in valid denominators. Unreported fields remain `NULL` (`null`), never substituted with category averages or `0`.
- **NOVA Processing Filter Transparency (`filterProductsWithNovaAudit`):** Left-rail NOVA `[1..4]` toggles include an explicit **`Include Unknown NOVA (NULL)`** gate (enabled by default), displaying exact `missingNovaMatchedCount` and `excludedMissingNovaCount` whenever missing-NOVA items are filtered out.

### 1.2 Comparison Bases & Gatekeeping Equations
1. **`per_100g` (`Observed`):** Raw label nutrition values in mass (`g/100g`) and energy (`kcal/100g`) without transformation (`3,197/3,197` eligible; nutrient-specific valid denominators `n` vary per field).
2. **`per_100kcal` (`Model Output` / derived nutrient density):**
   $$\text{Nutrient}_{100\text{kcal}} = \left(\frac{\text{Nutrient}_{100\text{g}}}{\text{Energy}_{\text{kcal}/100\text{g}}}\right) \times 100$$
   - **Exclusion Gate:** Products with `energy_kcal_100g === NULL` (`missing_energy`) or `energy_kcal_100g <= 0` (`non_positive_energy`) are excluded cleanly rather than clamping denominator energy to an arbitrary positive value.
   - **Positive-Energy Eligible Pool:** Exactly `3,097 / 3,197` OFF SKUs satisfy `energy_kcal > 0` (`100` excluded). Within this pool, **each nutrient computes its own separate valid denominator** (`energy_kcal > 0 && nutrient !== null`), rather than assuming all `3,097` products carry every nutrient.
   - Cross-unit arithmetic deltas between `per_100g` and `per_100kcal` are structurally blocked.
3. **`per_serving` (`Model Output` / derived serving):** Computes values from `serving_quantity_g > 0` or parsed mass/volume labels (using an explicit `1.0 g/ml` aqueous assumption only for labeled `ml`/`cl`/`l` strings). Because Open Food Facts Search-a-licious API records in `openfoodfacts_eu.parquet` lack `serving_quantity_g` (`3,197 / 3,197` `NULL`), **`per_serving` transparently returns `0%` computable (`Unavailable`)** rather than guessing a default serving weight.

### 1.3 Aggregation Weighting
- Category summaries (`aggregateNutritionByCategory`) compute **unweighted arithmetic means and medians** across valid non-null barcodes per category (`n = validDenominator`), **not** sales- or consumption-weighted dietary intake.

---

## 2. Environmental Analytical Engine (`src/analytics/environmentEngine.ts`, `v3.2.0-phase3c`)

### 2.1 Segregated Data Streams (Never Pooled)
DietShift Atlas strictly isolates three non-comparable environmental data streams via `ENVIRONMENT_SOURCE_METADATA`:

| Stream | Source File (`data_nature`) | System Boundary & Geography | Native Functional Unit & Indicators |
| :--- | :--- | :--- | :--- |
| **1. ADEME Agribalyse 3.1.1** | `agribalyse_31.parquet` (`2,451` rows · `Model Output`) | **Cradle-to-consumer gate** (agriculture, processing, packaging, transport, retail, home preparation) · **France / EU supply mix** | `1 kg` edible/prepared food: Climate (`kg CO₂eq/kg`), Water Scarcity AWARE (`m³ world eq/kg`), Land Use EF Soil Quality (`Pt/kg`), Acidification (`mol H+ eq/kg`), Terrestrial Eutrophication (`mol N eq/kg`), PEF 3.1 Single Score (`mPt/kg`). |
| **2. Poore & Nemecek (2018)** | `global_poore_nemecek_lca.parquet` (`45` commodities · `Estimated`) | **Farm-to-retail gate** (`stage_land_use` through `stage_losses`) · **Global production-weighted meta-analysis** (`38,700` farms, `119` countries) | Native multi-unit support: `per kg` (`ghg_kg_co2eq_per_kg`, `land_use_m2_per_kg`, `freshwater_withdrawals_l_per_kg`, `scarcity_water_l_per_kg`, `eutrophying_g_po4_per_kg`), `per 100g protein` (`32/45` non-null), `per 1000 kcal` (`38/45` non-null). |
| **3. EUIPO GIview & Qualigeo** | `gi_terroir_registry.parquet` (`6,845` items · `Estimated` class proxy) | Secondary category benchmark via rule-based `classify_gi_full -> eu_class` keyword matching (**not** product-level LCA) | Proxy `co2_kg_per_kg`, `water_L_per_kg`, `land_m2_per_kg` tagged `isClassProxy: true`. |

### 2.2 Food-Sector Eligibility Filter
- `filterFoodEligibleEnvironmentRecords` excludes **`WINE` (`3,198`)**, **`SPIRIT` (`499`)**, and **`CRAFT_AND_INDUSTRIAL` (`111`)** from GI Terroir food environmental summaries by default, retaining **`3,037` `FOOD` items** (`3,808` excluded with transparent logging). Including alcohol/industrial GIs is isolated strictly as a Phase 4C diagnostic stress test (`env_gi_unfiltered_alcohol_leak`).

### 2.3 Unit & Composite Safeguards
- **`checkEnvironmentCompatibility` & `compareEnvironmentRecords`:** Reject numeric subtraction or pooling across streams or incompatible metrics—explicitly separating deprivation-weighted **AWARE `m³ world eq/kg`** from unweighted freshwater `L/kg`, and dimensionless/normalized **PEF `Pt/kg`** from physical `m²/kg` land area.
- **Composite Prohibition (`attemptCompositeScore`):** Blocks summing normalized environmental pillars into an ad-hoc single score without an explicit normalized weighting scheme summing to `1.0`.
- **Unweighted vs. Market-Share Summaries:** Category environmental means represent unweighted simple arithmetic averages over matched LCI catalog entries, paired with medians and `[min, max]` ranges; market-share weighting is marked **unavailable**.

---

## 3. Affordability Analytical Engine (`src/analytics/affordabilityEngine.ts`, `v3.3.0-phase3d`)

`checkAffordabilityLayerCompatibility` prohibits pooling or unit-converting four structurally incompatible economic layers:

1. **Observed Retail Shelf Unit Prices (`scrapling_retail_claims.parquet`, `1,355` SKUs · `Observed`):**
   - `evaluateRetailUnitPrice` computes unit prices strictly from observed shelf prices (`price_eur`) and package sizes:
     - **Mass SKUs (`EUR / kg`):** `1,036` records
     - **Liquid SKUs (`EUR / L`):** `187` records
     - **Excluded (`missing_package_quantity`):** `132` records with `NULL` size
   - Prevents mass-vs-volume conflation (`incompatible_mass_vs_volume`) and records geographic concentration (`FR = 1,178`, `DE = 115`, `62` other EU).
2. **Macro Inflation Indices (Eurostat `prc_hicp_aind` / ONS `MM23`, `2015 = 100` · `Observed`):**
   - Computes point deltas, cumulative `%` growth, and annualized CAGR over observed histories (`2015–2025`), tagged `isAbsolutePrice: false`.
   - When a selected country (e.g., `GBR` in macro context panels or non-EU nations) lacks the exact Eurostat series, `hicpSeriesInfo.isFallback` explicitly propagates **`[EU27_2020 FALLBACK]`** into Overview chart titles, series labels, HTML accessible tables, and exports.
3. **PPP Food Price-Level Index (Eurostat `prc_ppp_ind`, `PLI_EU27_2020`, COICOP `A01`, `2024` · `Observed`):**
   - Comparative cross-country price-level index (`EU27_2020 = 100`), never a currency FX rate. **`refuseSkuPppConversion`** blocks dividing or multiplying single supermarket SKUs by aggregate national PLI.
4. **Cost of a Healthy Diet (`global_healthy_diet_affordability.parquet`, World Bank & FAO · `Observed`):**
   - National least-cost healthy diet benchmark (`ICP PPP USD / person / day`) and headcount unaffordability (`%` and millions, preserving `NULL`s across `177` ISO3 countries, `2017–2024`). Separated completely from single-item retail prices.

---

## 4. Multi-Taxonomy Classification & Integrated Comparison (`classificationEngine.ts`, `integratedComparator.ts v3.4.0-phase3d`)

- **Classification Concordance (`classification_mappings.parquet`, `161` curated rules, `v3.0.0-phase3a`):** Maps between `Open Food Facts`, `ADEME Agribalyse 3.1.1`, `EFSA FoodEx2`, and `Eurostat COICOP 2018` (`crosswalk_rosetta.parquet` contains `15` canonical multi-system conceptual bridges).
- **Explicit Mapping Uncertainty Taxonomy:**
  - `exact` (`6` rules) · `hierarchical` (`70` rules) · `approximate` (`16` rules) · `ambiguous` (`34` rules) · `unmatched` (`35` rules; `target_code = NULL`, `is_unmatched = true`).
  - Integrated comparator retains explicit bridge statuses (`directly_supported`, `approximate_or_hierarchical`, `ambiguous_split`, `unsupported_unmatched` such as COICOP `CP0115` Oils & fats and `CP012` Non-alcoholic beverages) and uses qualitative confidence tiers rather than invented probability weights.
- **No Universal Cross-Domain Score (`attemptUnifiedFoodScore`):** Deliberately refuses combining Nutrition, Environment, and Affordability into a synthetic multi-pillar score; supports transparent sorting strictly **within one compatible metric dimension at a time** (`rankCategoriesWithinDimension`).

---

## 5. Statistical Forecasting & Uncertainty Quantification (`src/analytics/forecastingEngine.ts`, `v4.2.0-phase4b`)

### 5.1 Leak-Free Expanding-Origin Cross-Validation Protocol
Evaluated across **`35` annual HICP food series** (`7` jurisdictions: `DE, ES, EU27_2020, FR, GBR, IT, NL` × `5` food baskets, `n = 11` annual observations `2015–2025`):
- With `minTrainLength = 5` and `maxHorizon = 3`, **`6` strictly causal training origins (`2019–2024`)** generate **`15` observed out-of-sample evaluations per series** (`h=1: 6`, `h=2: 5`, `h=3: 4` -> **`525` total folds across `35` series**).
- At each origin $k \in \{5,\dots,10\}$, model fitting and training naive scale computation `scale_k` inspect **exclusively `[0 .. trainEndLen - 1]`** (zero future leakage).

### 5.2 Model Suite (`5` Deterministic / Classical Models — No Foundation Models)
1. **Damped Trend Holt ETS (`α=0.55, β=0.35, φ=0.85`):** Level $l_t = \alpha y_t + (1-\alpha)(l_{t-1}+\phi b_{t-1})$, trend $b_t = \beta(l_t - l_{t-1}) + (1-\beta)\phi b_{t-1}$, forecast $\hat{y}_{T+h|T} = l_T + \sum_{j=1}^h \phi^j b_T$.
2. **Holt Linear Trend ETS (`α=0.55, β=0.35, φ=1.0`):** Undamped linear projection $\hat{y}_{T+h|T} = l_T + h b_T$.
3. **Ridge Linear Trend (`λ=1.5`):** Closed-form centered OLS with $L_2$ slope shrinkage $\hat{\beta} = \frac{\sum (x_i-\bar{x})(y_i-\bar{y})}{\sum (x_i-\bar{x})^2 + \lambda}$.
4. **Random Walk with Drift (`naive_drift`):** Slope $\bar{d} = (y_T - y_1)/(T-1)$, forecast $\hat{y}_{T+h|T} = y_T + h \bar{d}$ (empirical lowest-MAE winner on `34/35` CV series).
5. **Random Walk (`naive_random_walk`):** Last observed value $\hat{y}_{T+h|T} = y_T$.

### 5.3 Error Metrics & Residual Uncertainty Intervals
- **Error Metrics:** Per-series `MAE`, `sMAPE (%)`, `MASE` (normalized by origin training scale `scale_k`), and `RMSE`; suite `RMSE` is pooled across all `525` fold residuals. Mean suite `MASE > 1` (`4.566`) occurs cleanly because 2022–2023 food inflation steps exceeded pre-2021 1-step training differences.
- **Four Interval & Coverage Regimes:**
  1. **`empirical_single_minmax` (`h=1..3`):** Single-series historical `actual - predicted` min/max envelope (`n = 4..6 < MIN_SAMPLE_FOR_P10_P90 = 10`, so P10/P90 quantiles are suppressed). Note: if all historical errors share one sign (e.g., Italy `h=3` residuals `+8.32..+20.57`), adding uncentered residuals shifts the entire empirical band above/below the raw point forecast.
  2. **`empirical_suite_pct_p10_p90` (`h=1..3`):** Cross-series pooling requires percentage normalization (`pctResidual = 100 * (actual - predicted) / predicted`) paired with linear Type-7 P10/P90 quantiles (`h=1: n=210`, `h=2: n=175`, `h=3: n=140`).
  3. **`heuristic_spread`:** Symmetric indicative `± 1.2816 · σ · √h` scaling (never labeled as calibrated probability bounds).
  4. **Horizons `h=4..5` (`2029–2030`):** Carry `0` historical CV residuals (`band_supported = false`) and explicitly render **`Unavailable`** bounds.
- **Causal Coverage Evaluation (`evaluateEmpiricalIntervalCoverage`):** Evaluates only strictly prior folds satisfying `prior.targetYear <= originYear` (`210/525` eligible for single-series/heuristic `≥2` prior rule; `315/525` eligible for suite P10–P90 `≥10` prior rule), reporting jurisdiction-level flags whenever `n < MIN_COVERAGE_EVAL_SAMPLE (20)`.

---

## 6. Sensitivity (`v4.3.1-phase4c`) & Integrated Robustness (`v4.4.0-phase4d`)

### 6.1 Phase 4C Empirical Sensitivity (`src/analytics/sensitivityEngine.ts`)
Replaces legacy static sensitivity placeholders with `20` empirically computed one-at-a-time (OAT) scenarios across `6` analytical dimensions (`19` valid alternatives in the main matrix + `1` isolated diagnostic stress test):
- **Classification (`3`):** `cls_exclude_ambiguous`, `cls_strict_hierarchy_only`, `cls_strict_exact_only`
- **Nutrition Missingness (`3`):** `nut_core5_complete_case`, `nut_full8_complete_case`, `nut_basis_per_100kcal`
- **Environmental Proxy (`4`):** `env_agb_median_vs_mean`, `env_poore_exclude_transport`, `env_poore_protein_unit_rank`, and **`env_gi_unfiltered_alcohol_leak`** (`isDiagnosticOnly: true`, isolated from main matrix)
- **Package Quantity (`3`):** `pkg_exclude_micropacks_100g` (`analyst_defined`), `pkg_unnormalized_per_package`, `pkg_liquid_per_litre_scope`
- **Geographic Coverage (`4`):** `geo_off_europe_only`, `geo_off_france_only`, `geo_retail_france_only`, `geo_retail_germany_only`
- **Aggregation (`3`):** `agg_off_median_vs_mean_energy`, `agg_retail_median_vs_mean_eur_kg`, `agg_coicop_equal_subgroup_weight`

Every scenario carries orthogonal metadata: `scenarioType`, `scenarioOrigin` (`empirical_alternative` vs `analyst_defined`), `effectMechanism`, and Spearman rank metadata (`pairwiseSampleSize`, tied groups, `smallRankSampleWarning` when `n < 10`).

### 6.2 Phase 4D Integrated Comparator Robustness (`src/analytics/integratedRobustness.ts`)
Evaluates `12` integrated robustness scenarios (`rob_cls_exclude_ambiguous`, `rob_cls_strict_hierarchy`, `rob_cls_exact_only`, `rob_nut_core5_cc`, `rob_nut_full8_cc`, `rob_nut_derived_per100kcal`, `rob_env_agb_lci_count_vs_equal_subgroup`, `rob_env_agb_median_vs_mean`, `rob_env_poore_excl_transport`, `rob_env_poore_protein_unit`, `rob_aff_fr_subset`, `rob_aff_de_subset`) alongside a **`13-Category × 8-Layer` Evidence Coverage Matrix**:
- **Agribalyse Weighting Grain Reconciliation (`rob_env_agb_lci_count_vs_equal_subgroup`):** Separates `totalAgribalyseLciCatalogCount` (`2,451`), `validLciRecordCount` (`2,161` unique mapped LCI items), `categoryLciRecordPairCount` (`3,114` category–LCI pairs across shared COICOP codes `CP0114`/`CP0117`/`CP0119`), `totalCoicopMappedSubgroupCount` (`60`), `uniqueLciSubgroupCount` (`55` active + `5` unmatched `CP012`), `categorySubgroupPairCount` (`83` via `28` shared COICOP subgroups), `eligibleCategoryCount` (`11`), and `finalCategoryEstimateCount` (`11`). Cross-grain subtraction is forbidden (`denominatorDelta = null`, `assertDenominatorGrainCompatibility`).
- **Dimension-Specific Ranking Isolation:** Computes Spearman $\rho$ and common-universe Top-$K$/Bottom-$K$ Jaccard stability ($K = \min(3, n)$, suppressed below $n = 6$ via `'insufficient_group_stability_universe'`) strictly within individual dimensions (`protein_per_100g`, `fiber_per_100g`, `sugars_per_100g`, `energy_kcal_per_100g`, `protein_per_100kcal`, `fiber_per_100kcal`, `sugars_per_100kcal`, `agb_climate_co2eq_per_kg`, `agb_water_aware_m3_per_kg`).
- **Retail Sparsity Guard:** `4` exact OFF barcode matches in Full/FR (`2` EUR/kg + `2` EUR/L; `0` in DE) preclude category affordability ranking (`descriptive SKU evidence only`). Macro indicators (`hicp_inflation_pct`, `PPP`, `CoHD`) remain confined to the National/Macro panel.

---

## 7. Policy Scenario Simulator (`policyScenarioModel.ts v5.1.0-phase5a`) & Researcher Sandbox (`sandboxLedger.ts v5.1.0-phase5a`)

- **Policy Intervention Simulator (`evaluatePolicyScenario`):**
  - Applies explicit analyst-defined linear perturbation coefficients (`ANALYST_POLICY_COEFFICIENTS`: `plantCarbonSlope: 0.42`, `wasteCarbonSlope: 0.18`, `carbonTaxDivisorEurT: 150`, `carbonTaxPassThroughWeight: 0.18`, `defaultElasticityFallback: -0.65`, etc.) combined with Eurostat `hbs_q1_food_share_pct` / `hbs_q5_food_share_pct` tax exposure ratios over static **`COUNTRY_PROFILES`** (`Manually Compiled`).
  - Explicitly sets `uncertaintyStatus.available = false` (`ci95ForPolicyCarbonShift = null` — refusing to attach Eurostat baseline dispersion CI to synthetic policy sliders) and `pppStatus.pppNormalized = false` (nominal `%` shifts, not PPP adjustments).
- **Researcher Survey Ledger (`ResearcherSandbox.tsx`, `sandboxLedger.ts`):**
  - Importing from ADEME Agribalyse 3.1.1 (`fromAgribalyseToBasketItem`) preserves native **AWARE `m³ world-eq/d`** and **PEF `Pt/d`** units, keeping nutrition (`kcalPer100g`, `proteinPer100g`), `novaGroup`, and `costEurPerKg` strictly `null` (zero hardcoded constants).
  - CSV upload parser (`parseSurveyCsvRows`) preserves blank cells as `null`, tallies per-column missingness counts (`BasketMissingnessCounts`), and exports blank cells rather than zeros in CSV templates.

---

## 8. Explicit Methodological Refusals (What the Software Does Not Do)

1. **No TimesFM / Foundation Model Forecasting:** Zero neural network weights or foundation-model APIs run in build or browser pipelines; all forecasts are auditable classical statistical/naive formulas.
2. **No Global Sobol / Monte Carlo Variance Decomposition:** Phase 4C performs deterministic OAT sensitivity perturbations (`sensitivityEngine.ts`) rather than fabricating Bayesian or probabilistic parameter priors.
3. **No Market-Share or Intake Weighted Averages:** Product/LCI category summaries reflect catalog/receipt arithmetic distributions (`unweighted`).
4. **No Single Multi-Domain "Truth Score":** Nutrition, Environment, and Affordability are never collapsed into an unweighted weighted sum across incompatible scales.
