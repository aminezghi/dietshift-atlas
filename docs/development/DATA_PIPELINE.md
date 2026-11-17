# DietShift Atlas — Data Pipeline & Infrastructure

## 1. Data Tiers

DietShift Atlas organizes all datasets into explicit architectural tiers tracked in `public/data/datasets_registry.json`:

| Tier | Location | Purpose |
| :--- | :--- | :--- |
| **Raw** | `scripts/.raw_cache/` (gitignored) | Cached source downloads (CDC NHANES `.XPT`, Eurostat JSONs, OWID Grapher CSVs, Open Prices EU receipts, Open Food Facts Search-a-licious raw responses). |
| **Processed** | `public/data/parquet/` | Cleaned, typed, ZSTD-compressed Parquet tables preserving genuine `NULL`s for missing fields (`agribalyse_31`, `openfoodfacts_eu`, `global_poore_nemecek_lca`, `global_healthy_diet_affordability`, `gs1_immagino_observatory`, `school_meals_procurement`, `social_discourse_velocity`). |
| **Harmonized** | `public/data/parquet/` | Cross-linked datasets bridging identifiers across sources (`scrapling_retail_claims`, `gi_terroir_registry`, `crosswalk_rosetta`, `classification_mappings`). |
| **Analytical** | `public/data/parquet/` | Modeled, disaggregated, or cohort-derived tables (`nsi_subnational_quintiles`, `clinical_biomarker_grounding`, `efsa_foodex2_surveys`, `consumer_behavior_pulse`, `pan_eu_retail_scanner`, `time_use_cooking_friction`, `cultural_climate_inertia`). |
| **Forecast** | `public/data/parquet/` | Out-of-sample chronological statistical backtests and horizon projections (`statistical_price_forecasts`). |

## 2. Core Ingestion & Validation Scripts (Strict Execution Order)

> Note: Run `build_empirical_social_microdata.py` **before** `build_deep_empirical_pipeline.py` so real CDC NHANES `WTDRD1` biomarkers overwrite the stylized biomarker scaffolding. Never invoke deprecated scripts (`fetch_live_data.py`, `build_consumer_pulse_and_scale_off.py`); see [`docs/phase6/PHASE6B_PIPELINE_HYGIENE.md`](../phase6/PHASE6B_PIPELINE_HYGIENE.md).

| Script | Inputs / Sources | Outputs | Update Mode |
| :--- | :--- | :--- | :--- |
| `scripts/refresh_off_clean.py` | Open Food Facts Search-a-licious API (`22` dietary queries) | `openfoodfacts_eu.parquet` (`3,197` rows), `off_expanded_rows.json`, `live_research_bundle.json` (`openfoodfacts`) | Repeatable API (`auto_api`) |
| `scripts/harvest_raw_prices_scrapling.py` | Open Prices EU (`prices.openfoodfacts.org`) + OFF barcode nutrition lookup | `scrapling_retail_claims.parquet` (`1,355` rows), `scrapling_retail_claims.json` | Repeatable API (`auto_api`) |
| `scripts/build_gi_terroir_and_social_scrapling.py` + `enrich_gi_coordinates.py` | EUIPO GIview Union Register, Qualigeo REST/sheets *(restricted redistribution)*, HN Algolia & RSS | `gi_terroir_registry.parquet` (`6,845`), `social_discourse_velocity.parquet` (`129`) | Mixed (`auto_api`; see Governance) |
| `scripts/build_empirical_social_microdata.py` | Stylized multipliers (`v1.0`/`v3.5`), GCNF legal acts, ESS/TISP | `efsa_foodex2_surveys.parquet`, `time_use_cooking_friction.parquet`, `school_meals_procurement.parquet`, `cultural_climate_inertia.parquet`, `consumer_behavior_pulse.parquet` | `manual` / `credentials_required` |
| `scripts/build_deep_empirical_pipeline.py` | CDC NHANES `.XPT` (`DEMO_L`, `DR1TOT_L`, `TCHOL_L`, `HDL_L`, `HSCRP_L`, `BPXO_L`), Eurostat APIs (`hbs_str_t223`, `hlth_ehis_fv3i`, `prc_hicp_aind`, `prc_ppp_ind`) | `clinical_biomarker_grounding.parquet` (`5` rows, mixed measured + proxy columns), `econometric_calibration.json`, `empirical_microdata_bundle.json` | Repeatable API (`auto_api`) |
| `scripts/build_international_benchmarks.py` | OWID Grapher CSVs (Poore & Nemecek 2018; World Bank & FAO CoHD 2017–2024) | `global_poore_nemecek_lca.parquet`, `global_healthy_diet_affordability.parquet`, `global_benchmarks.json` | Repeatable API (`auto_api`) / Static (`static_reference`) |
| `scripts/build_nsi_and_ml_parquet.py` | INE WSTempus (`75413`, `73991`), Eurostat HBS/EHIS/HICP, `agribalyse_31.parquet` | `crosswalk_rosetta.parquet`, `nsi_subnational_quintiles.parquet` (SVD PCA + K-means), `statistical_price_forecasts.parquet` (`560` rows) | Mixed (`auto_api` + `manual`) |
| `scripts/build_classification_mappings.py` | `openfoodfacts_eu.parquet`, `agribalyse_31.parquet`, `efsa_foodex2_surveys.parquet`, COICOP 2018 | `classification_mappings.parquet` (`161` rules), `classification_mappings.json` | `manual` |
| `scripts/build_data_infrastructure.py` | All **19** Parquet tables in `public/data/parquet/` + `scripts/.raw_cache/` | `datasets_registry.json`, `provenance_manifest.json` (SHA-256, schema, null %, duplicate keys, FK checks, version diff) | Automated post-build |

## 3. Automated Validation Checks

`scripts/build_data_infrastructure.py` and `tests/test_empirical_pipeline.py` enforce on every build:
1. **Schema & Missingness:** Extracts DuckDB column types, null counts, and null percentages per column across all `19` tables.
2. **Primary-Key Uniqueness:** Verifies zero duplicate rows on each table's declared primary/composite key.
3. **Referential Integrity:** Verifies `crosswalk_rosetta.agb_code` joins cleanly to `agribalyse_31.Code_AGB` and `crosswalk_rosetta.foodex2_code` joins to `efsa_foodex2_surveys.foodex2_code`.
4. **No Silent Imputations:** Fails if `openfoodfacts_eu` contains the legacy constant default tuple or if `scrapling_retail_claims` marks missing nutrients as `'observed'`.
5. **Causal Forecasting & Residual Uncertainty Safeguards:** Verifies `statistical_price_forecasts` holds non-null `actual_value` on all 2015–2025 observed rows and expanding-origin validation summaries (`35` series × `15` folds). Client-side uncertainty bands in `forecastingEngine.ts v4.2.0-phase4b` separate `empirical_single_minmax`, `empirical_suite_pct_p10_p90` (`n >= 10`), and `heuristic_spread` (`±1.2816·σ·√h`) for `h=1..3`, keeping `h=4..5` (`2029–2030`) explicitly `Unavailable`.
6. **JSON–Parquet Parity & Version Diffing:** Compares SHA-256 hashes and verifies 17 JSON–Parquet parity assertions across `public/data/*.json` and `public/data/parquet/*.parquet`.
