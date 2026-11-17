# DietShift Atlas — Data Dictionary (Key Warehouse Schemas)

Full per-column types, null counts, and null percentages for all **19** Parquet tables (`17,627` rows) are generated automatically in `public/data/datasets_registry.json` and inspectable in the in-app **Data Catalog** modal. Key documented schemas:

## 1. `openfoodfacts_eu.parquet` (3,197 rows, 22 columns)
- `code` (`VARCHAR`, PK): Product EAN barcode.
- `name`, `brand`, `category` (`VARCHAR`): Product title, brand, harmonized category.
- `nutriscore_grade` (`VARCHAR`), `nutriscore_score` (`BIGINT`, nullable): FSA-derived Nutri-Score grade (`A`–`E`) and numeric points.
- `ecoscore_grade` (`VARCHAR`, nullable), `ecoscore_score` (`DOUBLE`, nullable): Environmental Eco-Score (`NULL` when absent in OFF — never defaulted).
- `nova_group` (`BIGINT`, nullable): Processing level `1`–`4` (`NULL` when absent).
- `primary_country` (`VARCHAR`, nullable), `countries` (`VARCHAR[]`): Normalized country tag(s).
- `serving_size` (`VARCHAR`, nullable), `serving_quantity_g` (`DOUBLE`, nullable).
- `energy_kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `sugars_100g`, `fat_100g`, `saturated_fat_100g`, `fiber_100g`, `salt_100g` (`DOUBLE`, nullable): Nutrients per 100g (`NULL` when absent).
- `nutrition_data_status` (`VARCHAR`): `'observed'` (>=4 nutrients), `'partial'` (1–3), or `'missing'` (0).

## 2. `scrapling_retail_claims.parquet` (1,355 rows, 29 columns)
- `barcode`, `country_code`, `retailer` (`VARCHAR`, composite PK): Receipt SKU, ISO-2 EU country, OSM retailer name.
- `product_name`, `brand`, `fenomeno_category`, `primary_claim`, `labels_list`, `image_url`, `scraped_with` (`VARCHAR`): Retail product identity, claim classification, and D4Vinci Scrapling ingestion metadata.
- `price_eur` (`DOUBLE`), `price_per` (`VARCHAR`), `product_quantity` (`DOUBLE`, nullable), `product_quantity_unit` (`VARCHAR`, nullable), `quantity_label` (`VARCHAR`, nullable), `city` (`VARCHAR`), `observed_date` (`VARCHAR`): Observed retail shelf/receipt price & package size metadata from Open Prices EU (`1,036` `g`, `187` `ml`, `132` `NULL`).
- `energy_kcal`, `proteins_g`, `sugars_g`, `saturated_fats_g`, `carbohydrates_g`, `fiber_g`, `salt_g` (`DOUBLE`, nullable): Per-100g nutrition joined by barcode from Open Food Facts (`NULL` when unmatched — never `0.0`).
- `nutrition_data_status` (`VARCHAR`): `'observed'` (1,023), `'partial'` (8), or `'missing'` (324).
- `nutriscore`, `ecoscore` (`VARCHAR`, nullable), `nova_group` (`BIGINT`, nullable).
- `data_source` (`VARCHAR`): Provenance string indicating whether OFF nutrition matched.
- *Empirical Sensitivity Boundaries (Phase 4C):* Retail SKU coverage splits into `FR` (`1,178`), `DE` (`115`), `IT` (`28`), `BE` (`26`), and `<5` observations for `AT/GR/ES/NL/PT`; micro-packs (`<100g`), `132` missing-weight SKUs, and `187` liquids drive mean-vs-median `EUR/kg` divergence. In `openfoodfacts_eu.parquet`, optional `fiber_100g` is `NULL` in `1,348` / `3,197` records (`42.2%`), `serving_quantity_g` is `100%` `NULL`, and `301` records carry `primary_country = 'united-states'`.

## 3. `crosswalk_rosetta.parquet` (15 rows, 19 columns)
- `crosswalk_id` (`VARCHAR`, PK), `ecoicop_code`, `ecoicop_label`, `foodex2_code`, `foodex2_level1`, `foodex2_level2`.
- `agb_code` (`VARCHAR`, FK -> `agribalyse_31.Code_AGB`), `agb_lci_name` (`VARCHAR`), `mean_co2_kg` (`DOUBLE`), `mean_water_m3` (`DOUBLE`).
- `mapping_type` (`VARCHAR`): `'exact'`, `'partial'`, `'broader'`, or `'ambiguous'`.
- `confidence` (`DOUBLE`): Mapping confidence score in `(0, 1]`.
- `explanation`, `source_reference`, `mapping_version` (`VARCHAR`).

## 4. `statistical_price_forecasts.parquet` (560 rows, 33 columns)
- `series_id` (`VARCHAR`), `country_code`, `country_label`, `indicator_name`, `year` (composite PK: `country_code`, `indicator_name`, `year`): `7` jurisdictions × `5` observed Eurostat/ONS HICP series (`35` series) × `16` years (`2015–2030`).
- `split_role` (`VARCHAR`): `'TRAIN (2015-2022)'`, `'VALIDATION (2023-2025)'`, or `'FORECAST (2026-2030)'`.
- `actual_value` (`DOUBLE`, nullable): Observed HICP/CPIH index (`2015=100`, non-null through `2025`).
- `damped_ets_p50`, `damped_ets_p10`, `damped_ets_p90`, `ets_baseline`, `ridge_linear_baseline`, `naive_drift_baseline`, `naive_rw_baseline` (`DOUBLE`): Fixed-origin backtest (`2023–2025`) and projection (`2026–2030`) columns stored in Parquet, superseded dynamically in Section II (`forecastingEngine.ts v4.2.0-phase4b`) across all `15` expanding-origin folds (`2019–2024`) with separated `empirical_single_minmax`, `empirical_suite_pct_p10_p90`, and `heuristic_spread` bands (`h=4..5` explicitly `Unavailable`).
- `*_val_mae`, `*_val_rmse` (`damped_ets`, `ets`, `ridge`, `naive`, `naive_rw`), `damped_ets_cv_mae`, `damped_ets_cv_mase`, `damped_ets_cv_smape`, `naive_drift_cv_mae`, `naive_rw_cv_mae`, `best_cv_model`, `best_cv_mae`, `best_cv_mase`, `data_source`: Point-forecast accuracy metrics and provenance (`ONS MM23 CPIH` vs `Eurostat prc_hicp_aind`).

## 4b. `classification_mappings.parquet` (161 rows, 19 columns)
- `mapping_id` (`VARCHAR`, PK), `source_system`, `source_code`, `source_label`, `source_parent_label`, `source_item_count` (`BIGINT`), `target_system`, `target_code` (nullable, `35` unmatched), `target_label` (nullable), `mapping_type` (`exact`, `hierarchical`, `approximate`, `ambiguous`, `unmatched`), `hierarchy_direction`, `confidence_tier`, `is_ambiguous`, `is_unmatched`, `candidate_targets`, `representative_agb_code`, `rationale`, `source_reference`, `mapping_version` (`3.0.0-phase3a`). See [`CLASSIFICATION_MAPPING.md`](CLASSIFICATION_MAPPING.md).

## 5. `SensitivityScenarioResult` Output & Export Schema (`sensitivityEngine.ts` v4.3.1-phase4c)
All CSV (`serializeSensitivityScenariosCsv`) and JSON Dossier (`SensitivityPanel.tsx`) exports preserve the following provenance and analytical fields:
- **Identity & Taxonomy:** `scenarioId`, `baselineId`, `label`, `dimension` (`classification` | `nutrition_missingness` | `environmental_proxy` | `package_quantity` | `geographic_coverage` | `aggregation`), `assumptionId`.
- **Classification & Provenance:** `scenarioType` (`data_subset_sensitivity` | `missingness_sensitivity` | `methodological_sensitivity` | `boundary_or_functional_unit_sensitivity` | `diagnostic_stress_test`), `scenarioOrigin` (`empirical_alternative` | `analyst_defined`), `effectMechanism` & `effectMechanismLabel` (`analytical_method_change` | `sample_population_change` | `functional_unit_or_boundary_change` | `inclusion_exclusion_rule`), `isDiagnosticOnly`, `reusedEngineAndVersion`, `assumptionChanges[]`.
- **Sample Counts & Values:** `baselineSummary` and `scenarioSummary` (`recordTotal`, `validDenominator`, `excludedCount`, `categoryCount`, `meanAcrossCategories`, `medianAcrossCategories`, `unit`), plus `affectedRecords` (`count`, `pctOfTotal`, `excludedOrReclassifiedDelta`, `denominatorDelta`).
- **Differences & Rank Statistics:** `deltaMetrics` (`absoluteDiff`, `relativeDiffPct`, `comparableAcrossUnits`, `crossUnitNote`) and `rankingMetrics` (`pairwiseSampleSize`, `tiedRankGroupsCount`, `tiedRankGroupsBaseline`, `tiedRankGroupsScenario`, `excludedCategoriesCount`, `comparisonScope`, `smallRankSampleWarning`, `rankChangesCount`, `maxAbsRankShift`, `spearmanRho`, `conclusionStability`, `topDrivers[]`).
- **Interpretation & Limitations:** `caveats[]` (recording small-sample flags, sample-composition vs estimator distinction, unit-boundary rules, and OAT scope) alongside `UNCERTAINTY_ASSUMPTION_REGISTRY` and `UNSUPPORTED_SENSITIVITY_EXPERIMENTS`.

## 6. `IntegratedRobustnessResult` & `CategoryEvidenceCoverageRow` Schema (`integratedRobustness.ts` v4.4.0-phase4d)
All Phase 4D CSV and JSON exports preserve:
- **Scenario & Provenance Metadata:** `robustnessVersion`, `scenarioId`, `layer` (`classification` | `nutrition` | `environment` | `affordability`), `scenarioType`, `scenarioOrigin`, `effectMechanism`, `effectMechanismLabel`, `assumptionId`, `reusedEngineAndVersion`.
- **Universe & Denominators:** `comparisonUniverse` (`commonCategoryIds`, `commonUniverseSize`, `baselineOnlyExcludedIds`, `scenarioOnlyExcludedIds`, `exclusionReason`) and `denominators` (`baselineTotal`, `baselineValid`, `baselineExcluded`, `scenarioTotal`, `scenarioValid`, `scenarioExcluded`, nullable `denominatorDelta`, `denominatorGrainComparable`, `denominatorDeltaBlockedReason`, `positiveEnergyEligibleCount`, `nutrientSpecificBaselineDenominators`, `nutrientSpecificScenarioDenominators`, `environmentalWeightingGrain` containing `totalAgribalyseLciCatalogCount`, `validLciRecordCount`, `categoryLciRecordPairCount`, `totalCoicopMappedSubgroupCount`, `uniqueLciSubgroupCount`, `categorySubgroupPairCount`, `sharedSubgroupInstancesCount`, `eligibleCategoryCount`, `finalCategoryEstimateCount`, `aggregationWeightingMethod`, and `retailBaselineSubset`/`retailScenarioSubset` with `exactOffBarcodeTotalMatches`, `exactOffBarcodeMassEurKgMatches`, `exactOffBarcodeLiquidEurLMatches`).
- **Common-Universe Ranking & Dimension-Specific Stability (`n >= 6` Gate):** `rankingStability` plus `dimensionRankings[]` (each entry containing explicit `dimension`, `baselineDimension`, `scenarioDimension`, `unit`, `pairwiseSampleSize`, `tiedRankGroupsCount`, `spearmanRho`, `smallRankSampleWarning`, `groupStability` with `status`, `kCutoff`, `topKBaseIds`, `topKScenIds`, `topKRealizedSizes`, `topKJaccard`, `topKEntering`, `topKExiting`, `bottomKBaseIds`, `bottomKScenIds`, `bottomKRealizedSizes`, `bottomKJaccard`, `bottomKEntering`, `bottomKExiting`, `topBottomOverlapBase`, `topBottomOverlapScen`) or `null` with explicit blocking reason (`descriptive_sku_evidence_only`, `Exact-only regime yields 0 usable ...`). CSV export appends a `# DIMENSION_RANKINGS_BREAKDOWN` block for every single-indicator ranking pair.
- **13 × 8 Category Evidence Matrix & Separate Macro Panel:** Each of the `13` category nodes maps across `8` category layers (`classification_bridge`, `nutrition_per_100g`, `nutrition_per_100kcal`, `nutrition_per_serving`, `environment_agribalyse`, `environment_poore`, `environment_gi_proxy`, `affordability_retail_sku_eur_kg`), recording `evidenceNature` (`Observed` | `Estimated` | `Model Output` | `Proxy` | `Missing`), `availabilityStatus`, `validDenominator`, `sourceDatasetAndVersion`, `mappingOrMatchingStatus`, `functionalUnit`, `geographyAndBoundary`, `scope` (`category_level`), and `blockingOrMissingnessReason`, kept strictly apart from `macroContext` (`HICP`, `PPP`, `CoHD`).
