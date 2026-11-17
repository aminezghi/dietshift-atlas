# DietShift Atlas — Methodological Limitations & Responsible Use (WP6)

**Purpose:** This document provides a direct, prominent, non-footnoted statement of all material data, modeling, statistical, and licensing limitations identified across **DietShift Atlas (`v5.2.0-phase5c`)**. Researchers, policymakers, and reviewers must treat these boundaries as hard constraints on valid inference.

---

## 1. Taxonomy & Data-Nature Limitations

### 1.1 Unweighted Catalog Samples vs. Population Consumption or Market Shares
- **What:** Nutrition averages (`openfoodfacts_eu.parquet`, `3,197` SKUs), environmental means (`agribalyse_31.parquet`, `2,451` LCI items), and retail unit prices (`scrapling_retail_claims.parquet`, `1,355` SKUs) are **unweighted arithmetic summaries** across available catalog/receipt entries.
- **Why:** Verified SKU-level sales volumes, household scanner expenditure weights, and nationally harmonized dietary intake weights per barcode are unavailable in open data.
- **Affected Outputs:** Section I plates, Section VII nutrition summaries, Section VIII Agribalyse summaries, Section IX integrated comparators, and Section XIII mean-vs-median checks (`agb_water_aware_m3_per_kg` mean-vs-median Spearman $\rho = 0.591$).
- **How to Interpret:** Treat category metrics as properties of the **captured product/LCI catalog**, never as consumption-weighted population intake or market-share-weighted grocery prices.

### 1.2 Missing `per_serving` Nutritional Basis (`100%` Excluded)
- **What:** Evaluating Open Food Facts nutrition on a `per_serving` basis excludes `3,197 / 3,197` products (`0%` computable).
- **Why:** Search-a-licious API snapshots omitted structured `serving_quantity_g` fields, and `nutritionEngine.ts` forbids inventing default serving sizes.
- **Affected Outputs:** Section VII `Per Serving` toggle, Phase 4D `rob_nut_*` coverage panels, and Section XIII unsupported experiment list.
- **How to Interpret:** `per_100g` and `per_100kcal` (`3,097` positive-energy pool with nutrient-specific valid denominators) are valid bases; per-serving claims are **unavailable** until v2 barcode serving enrichment is ingested.

### 1.3 Nutrition Profile Missingness (`15.45%` NULL Density & Incomplete Nutrients)
- **What:** In `openfoodfacts_eu.parquet`, `15.45%` of total cells are `NULL`; `Core-5` complete cases drop the pool to `n = 3,130`, `Full-8` complete cases drop it to `n = 1,846`, and retail Open Prices lookups omit `fat_100g` distinct from `saturated_fats_g` (`324/1,355` missing nutrition entirely). Meanwhile, NOVA processing group is frequently `NULL`.
- **Why:** Crowd-sourced product labels frequently omit optional fiber/salt/fat/NOVA declarations.
- **Affected Outputs:** Section VII nutrition distributions, left-rail NOVA filtering, and Phase 4C/4D missingness sensitivity scenarios.
- **How to Interpret:** Distinguish observed zeros (`0 g`) from missing (`NULL`). Always inspect the active nutrient-specific denominator `n` and keep track of excluded `NULL NOVA` rows via the left-rail counter.

### 1.4 Cross-Taxonomic Mapping Ambiguity & Unmatched Categories
- **What:** Out of `161` curated taxonomy concordance rules (`classification_mappings.parquet`), only `6` are `exact`, `70` `hierarchical`, `16` `approximate`, `34` **`ambiguous`**, and `35` **`unmatched`** (`target_code = NULL`), while only `4` exact barcodes link Open Food Facts to Open Prices EU. Under strict `exact-only` filtering (`rob_cls_exact_only`), `0` usable COICOP–Agribalyse bridges survive (`0` rankable categories). Furthermore, `CP0115` (Oils & fats) and `CP012` (Non-alcoholic beverages) lack direct curated bridges; shared COICOP divisions (`CP0114`, `CP0117`, `CP0119`) cause `55` active Agribalyse subgroups (`2,161` unique items) to expand into `83` category–subgroup pairs (`3,114` category–LCI pairs) across `11` categories.
- **Why:** FoodEx2, Agribalyse, Open Food Facts, and COICOP were engineered for incompatible institutional purposes (intake exposure, engineering LCI, retail crowdsourcing, and CPI basket inflation).
- **Affected Outputs:** Section VII/IX integrated comparison, `ClassificationInspector`, `rob_cls_*` scenarios, and `rob_env_agb_lci_count_vs_equal_subgroup`.
- **How to Interpret:** Category links are coarse structural alignments whose subgroup weighting (`LCI-record-count` vs `equal-subgroup 1/k`) materially alters category averages; never subtract raw denominators across incompatible LCI-record and subgroup grains.

---

## 2. Environmental & Terroir Modeling Limitations

### 2.1 Geographic & Boundary Incompatibility Across LCA Streams
- **What:** `agribalyse_31.parquet` (`Model Output`, France cradle-to-consumer), `global_poore_nemecek_lca.parquet` (`Estimated`, global farm-to-retail meta-analysis across `38,700` farms in `119` countries), and `gi_terroir_registry.parquet` (`Estimated` keyword class proxies) measure fundamentally non-equivalent boundaries, characterization factors, and geographies.
- **Why:** No unified harmonized farm-to-fork product-level LCA dataset exists across all EU countries and barcodes.
- **Affected Outputs:** Overview Plate IV, Section VIII, Section IX integrated comparator, and Section XIII.
- **How to Interpret:** Never pool values or subtract metrics across Agribalyse, Poore & Nemecek, and GI Terroir, and never cite French Agribalyse cradle-to-consumer values as physical local footprints for Germany, Spain, UK, or non-EU countries.

### 2.2 Non-Interchangeable Physical & Impact Units (`AWARE m³ world-eq` vs `L`; `PEF Pt` vs `m²`)
- **What:** Agribalyse `Eau_m3` is **AWARE water scarcity deprivation-weighted cubic meters (`m³ world-eq/kg`)**, and `Sol_Pt` is dimensionless/normalized **PEF 3.1 soil-quality `Pt/kg`**—not physical liters of freshwater or square meters of land.
- **Why:** European Product Environmental Footprint (PEF 3.1) characterizes midpoint scarcity and biotic production indices rather than unweighted physical volumes/areas.
- **Affected Outputs:** Section VI (`ResearcherSandbox`), Section VIII (`EnvironmentComparisonPanel`), and Section IX.
- **How to Interpret:** Compare `m³ world-eq` only within Agribalyse AWARE and `Pt` only within Agribalyse PEF Land Use; conversion to liters or hectares requires upstream disaggregated inventory characterization not bundled here.

### 2.3 GI Terroir Class Proxies & Non-Food Contamination Risk
- **What:** Product-level `co2_kg_per_kg`, `water_L_per_kg`, and `land_m2_per_kg` inside `gi_terroir_registry.parquet` (`6,845` items) are rule-based keyword proxies (`classify_gi_full -> eu_class`). Additionally, `3,808` of `6,845` registrations are **`WINE` (`3,198`)**, **`SPIRIT` (`499`)**, or **`CRAFT_AND_INDUSTRIAL` (`111`)**, leaving `3,037` `FOOD` entries.
- **Why:** Official GI registers (EUIPO GIview / Qualigeo) contain legal product specifications, not empirical LCA inventories.
- **Affected Outputs:** Section IV maps, Section VIII GI explorer, and Section XIII diagnostic `env_gi_unfiltered_alcohol_leak`.
- **How to Interpret:** Treat environmental figures on GI records strictly as illustrative class benchmarks (`FOOD`-only by default), never as verified terroir sustainability proof.

---

## 3. Affordability, Forecasting & Econometric Limitations

### 3.1 Extreme Retail Sample Sparsity & French Geographic Skew
- **What:** Open Prices EU (`scrapling_retail_claims.parquet`, `1,355` SKUs: `1,036` `EUR/kg`, `187` `EUR/L`, `132` missing size) is `86.9%` French (`FR = 1,178`) and `8.5%` German (`DE = 115`), with only `4` exact barcode matches to the OFF sample in `FULL`/`FR` (`2` `EUR/kg` + `2` `EUR/L`) and **`0` in `DE`**.
- **Why:** Voluntary crowdsourced receipt coverage in Open Prices is heavily concentrated in France.
- **Affected Outputs:** Section IX (`AffordabilityAndIntegratedPanel`, `rob_aff_fr_subset`, `rob_aff_de_subset`), Section XIII (`geo_retail_*`).
- **How to Interpret:** Unit prices (`EUR/kg`, `EUR/L`) provide descriptive SKU-level snapshots only; **cross-category affordability rankings and EU-wide retail price claims are prohibited**.

### 3.2 Macro-Economic Indicators (`HICP`, `PPP PLI`, `CoHD`) vs. SKU Prices
- **What:** Eurostat `prc_hicp_aind` (`2015 = 100`), Eurostat `prc_ppp_ind` (`PLI_EU27_2020`, `EU27_2020 = 100`), and World Bank/FAO CoHD (`ICP PPP USD / person / day`) measure national/aggregate index levels or population diet thresholds. Where selected jurisdictions lack Eurostat HICP (`e.g., GBR` in Eurostat macro views or `USA`/`JPN`), UI components fall back to **`EU27_2020`** (or `[IT]` in sub-panels lacking country coverage).
- **Why:** Macro statistical indices cannot be disaggregated to barcode prices, and Eurostat dissemination excludes non-EU nations.
- **Affected Outputs:** Overview Plate III, Section IX macro panel, and cross-country selectors.
- **How to Interpret:** Whenever `[EU27_2020 FALLBACK]` or `[IT]` fallback notices appear, do not attribute those figures to the selected non-covered nation, and never multiply individual retail EUR SKUs by macro PPP indices.

### 3.3 Short-Series Statistical Forecasting & Absent Foundation-Model / Multi-Year Bands
- **What:** Each HICP series contains only `n = 11` annual observations (`2015–2025`), yielding `15` expanding-origin CV folds (`h=1..3`) where a simple **`Random Walk with Drift`** beats `Damped ETS`, `Holt ETS`, `Ridge`, and `Random Walk` on `34/35` series (mean suite `MASE = 4.566` reflects post-2021 inflation regime break exceeding pre-2021 step sizes). Moreover:
  - Single-series `P10–P90` quantiles are mathematically suppressed (`n = 4..6 < 10`);
  - Uncentered empirical `min–max` shifts (e.g., Italy `2028`) can sit entirely above/below the point forecast;
  - Horizons `h=4..5` (`2029–2030`) carry **`0` CV residuals (`Unavailable`)**;
  - **No TimesFM / neural foundation model is run** (prior `89.4% MAE` academic paper claims originated from pre-Phase-4A target leakage and are formally invalid).
- **Why:** Annual macro series cannot calibrate complex AI architectures or long-horizon prediction intervals without structural assumptions.
- **How to Interpret:** Treat Section II forecasts strictly as transparent statistical baselines under structural break risk; never quote `2029–2030` projections as empirically uncertainty-bounded.

---

## 4. Stylized Baselines, Mixed Biomarkers, Policy Simulator & Metadata Limitations

### 4.1 Undocumented Manual Baselines (`COUNTRY_PROFILES`) & Heuristic Policy Model
- **What:** Overview country scorecards and Section X Policy Simulator rest on `25` hardcoded `COUNTRY_PROFILES` (`src/types/research.ts`, lacking per-country bibliography/years/SEs in `datasets_registry.json`) perturbed by analyst-defined linear slopes (`ANALYST_POLICY_COEFFICIENTS` in `policyScenarioModel.ts`).
- **Why:** Standardized harmonious national baseline footprints across all 25 global/EU comparator jurisdictions were curated manually during early prototyping.
- **Affected Outputs:** Overview scorecard, Section VI baseline radar overlay, and Section X Policy Simulator KPIs and CSVs (`Policy_CI95_Available = false`, `PPP_Normalized = false`).
- **How to Interpret:** Treat Section X exclusively as **deterministic sensitivity exploration** (`Simulated` / `Analyst-Defined`) illustrating relative directional trade-offs, never as calibrated econometric causal predictions or welfare forecasts.

### 4.2 Stylized Survey Tables & Mixed Measured/Proxy Clinical Biomarkers
- **What:** Several analytical tables—`efsa_foodex2_surveys.parquet` (`v2.0-stylized`), `time_use_cooking_friction.parquet` (`v1.0-stylized`), `consumer_behavior_pulse.parquet` (`v3.5`), and non-Italian rows in `pan_eu_retail_scanner.parquet` (`v3.5`)—are derived from template ratios/country multipliers or published summary metrics rather than respondent/receipt microdata. Additionally, `clinical_biomarker_grounding.parquet` blends **real CDC NHANES 2021–2023 (`n=4,262`) `WTDRD1`-weighted empirical means** (`Total-C`, `HDL-C`, `Non-HDL-C`, `hs-CRP`, `SBP`) with **fixed ratios/constants** (`LDL = 0.82 * Non-HDL`, `TG = 0.72 * Non-HDL`, `fasting_glucose = 96.0`, `hba1c = 5.5`, `bmi = 28.4`, derived `CVD risk Δ`) and carries a **US-to-EU domain transfer caveat**.
- **Why:** Raw IPUMS MTUS, NielsenIQ scanner panels, and EU-wide harmonized clinical-dietary cohorts are access-restricted or unavailable under open distribution.
- **Affected Outputs:** Section III, Section XII, and SQL queries on those views in Section V.
- **How to Interpret:** Cite only measured NHANES columns as empirical respondent estimates; treat stylized behavioral/time-use/scanner tables strictly as exploratory illustrative frameworks.

### 4.3 Third-Party Redistribution Rights & Peripheral Documentation Gaps
- **What:** While MIT covers DietShift Atlas source code and `ODbL`/`Etalab 2.0`/`CC-BY 4.0`/`OGL v3`/`Public Domain` cover open institutional feeds, third-party dataset redistribution permissions remain **unverified** for `Qualigeo` (`gi_terroir_registry`), `GS1 Immagino` / `Pan-EU` benchmarks, `MTUS/IPUMS` (`time_use`), `ESS` potential `CC BY-NC-SA` non-commercial restrictions (`cultural_climate_inertia`), `HN/Google News RSS` publisher metadata (`social_discourse_velocity`), and un-tracked `public/data/world.geojson`. Simultaneously, existing `paper/*` manuscripts and `docs/PUBLIC_GUIDE.md` still carry stale pre-Phase-4/5 claims flagged as v1.0 release blockers.
- **Why:** Documentation & legal clearance lagged behind Phase 3–5 code/QA hardening.
- **How to Interpret:** Do **not** redistribute bundled commercial/scraped/NC datasets commercially or cite the stale `paper/` drafts without completing the v1.0 release checklist in [`PHASE6A_RELEASE_READINESS_ASSESSMENT.md`](phase6/PHASE6A_RELEASE_READINESS_ASSESSMENT.md).
