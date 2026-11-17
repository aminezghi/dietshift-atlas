# DietShift Atlas — Reproducibility, Python Dependencies & Legacy Pipeline Hygiene (WP6 / B-06)

**Audit Date:** 2026-11-17  
**Baseline:** `v5.2.0-phase5c` / `1.0.0-rc.1`  

---

## 1. Python Dependency Audit & Categorized Reconciliation

Static AST inspection across all `20+` Python scripts in `scripts/` and test suites in `tests/` identified three genuinely required packages previously omitted from root [`requirements.txt`](../../requirements.txt):

| Package | Imported Modules & Verified Callers | Dependency Category | Resolution Applied |
| :--- | :--- | :--- | :--- |
| **`pyarrow`** | `tests/test_empirical_pipeline.py:5`, `scripts/build_data_infrastructure.py:24`, `scripts/build_deep_empirical_pipeline.py:36`, `scripts/build_empirical_social_microdata.py`, `scripts/build_international_benchmarks.py:34-35` | **Pipeline & Validation (Mandatory)** | Added (`pyarrow>=18.0`) to `requirements.txt` and `requirements-dev.txt`. |
| **`numpy`** | `scripts/build_deep_empirical_pipeline.py:34`, `scripts/build_nsi_and_ml_parquet.py` (`SVD`, `KMeans` & statistics) | **Pipeline (Mandatory)** | Added (`numpy>=2.0`) to `requirements.txt`. |
| **`pandas`** | `scripts/build_deep_empirical_pipeline.py:35`, `scripts/build_international_benchmarks.py:33` | **Pipeline (Mandatory)** | Added (`pandas>=2.2`) to `requirements.txt`. |
| **`pytest`** | `tests/test_empirical_pipeline.py:6`, `tests/e2e/test_atlas_e2e.py`, invoked by `scripts/run_qa_gate.py` (`npm run qa`) | **Development / QA Validation (Mandatory for tests)** | Added (`pytest>=8.0`) to `requirements-dev.txt` (plus noted cleanly inside `requirements.txt`). |
| **`python-docx` / `Pillow` / `cairosvg`** | `scripts/polish_docx.py:12` (`docx`); `scripts/logo_skill/scripts/render_png.py` (`PIL`, `cairosvg`) | **Optional Manuscript / Asset Utilities** | Kept optional in `requirements-dev.txt` / comments rather than forcing heavy native Cairo bindings onto QA/frontend users. |

**Clean Split Applied:**
- [`requirements.txt`](../../requirements.txt): Core analytical pipeline + web-harvesting dependencies (`duckdb`, `pyarrow`, `numpy`, `pandas`, `scrapling`, `curl_cffi`, `playwright`, `requests`, etc.).
- [`requirements-dev.txt`](../../requirements-dev.txt): Lightweight QA/CI validation dependency file (`pytest`, `pyarrow`, `duckdb`, `playwright`) matching `.github/workflows/qa-gate.yml` without requiring full scraper rebuild dependencies when only running `npm run qa`.

---

## 2. Script Classification & Legacy Quarantine Ledger

Every Python script under `scripts/` has been verified and classified into **Supported Production Pipeline**, **Auxiliary Utilities**, or **Deprecated Legacy Scripts**:

### 2.1 Supported Active Scripts (`scripts/`)
1. `scripts/refresh_off_clean.py` — Authoritative Open Food Facts Search-a-licious API harvester (`3,197` rows, strictly preserving missing nutriments/NOVA/Eco-Score as `NULL`).
2. `scripts/harvest_raw_prices_scrapling.py` — Authoritative Open Prices EU + OFF enrichment (`1,355` rows, NULL-preserving).
3. `scripts/build_gi_terroir_and_social_scrapling.py` + `scripts/enrich_gi_coordinates.py` — Builds `gi_terroir_registry.parquet` (`6,845` rows) and `social_discourse_velocity.parquet` (`129` rows). *(See `PHASE6B_DATA_GOVERNANCE.md` for Qualigeo & HN/RSS redistribution restrictions.)*
4. `scripts/build_gs1_immagino_parquet.py` & `scripts/build_pan_eu_retail_parquet.py` — Generates transcribed GS1 summary & Pan-EU benchmark tables (`PERMISSION REQUIRED` for public redistribution).
5. `scripts/build_empirical_social_microdata.py` — Generates `efsa_foodex2_surveys`, `time_use_cooking_friction`, `school_meals_procurement`, `cultural_climate_inertia`, `consumer_behavior_pulse`, plus initial biomarker scaffold (**must execute before Step 6**).
6. `scripts/build_deep_empirical_pipeline.py` — Overwrites biomarker table with real CDC NHANES 2021–2023 (`WTDRD1`) `.XPT` microdata (`clinical_biomarker_grounding.parquet`) + Eurostat HBS/EHIS/HICP/PPP `econometric_calibration.json`.
7. `scripts/build_international_benchmarks.py` — Compiles Poore & Nemecek 2018 & World Bank/FAO CoHD (`global_benchmarks.json`, Parquet tables).
8. `scripts/build_nsi_and_ml_parquet.py` — Builds `crosswalk_rosetta`, `nsi_subnational_quintiles`, and `statistical_price_forecasts` (`560` rows); stdout banner safely remediated in Phase 6B (`L12` changed from legacy `"TIMESFM 2.0 BACKTESTING"` to `"EXPANDING-ORIGIN STATISTICAL HICP BACKTESTING"`).
9. `scripts/build_classification_mappings.py` — Builds `161`-rule `classification_mappings.parquet` concordance (`v3.0.0-phase3a`).
10. `scripts/build_data_infrastructure.py` — Validates all `19` Parquet tables and refreshes `datasets_registry.json` & `provenance_manifest.json`.
11. `scripts/run_qa_gate.py` — Fail-fast 5-stage QA gate runner (`npm run qa`).

### 2.2 Deprecated / Legacy Scripts (Retained for Historical Auditability, Blocked from Accidental Execution)

| Script | Verified Defects & Overwrite Risks | Phase 6B Quarantine Control Applied |
| :--- | :--- | :--- |
| **`scripts/fetch_live_data.py`** | 1. Fetches only `500` Agribalyse items (`size=500`) and embeds them inside `live_research_bundle.json`.<br>2. Silently imputes missing OFF nutrients (`proteins=8.0`, `energy=210.0`, `fiber=2.5`, `salt=0.8`), missing Eco-Score (`'C'/55`), and missing NOVA (`3`).<br>3. Overwrites `public/data/live_research_bundle.json` directly on execution. | Preserved intact for provenance history, **marked `[DEPRECATED]`** at file header, and **guarded with `--allow-legacy-imputation` CLI flag** (exits cleanly with code `1` and pointer to `refresh_off_clean.py` if accidentally invoked without opt-in). |
| **`scripts/build_consumer_pulse_and_scale_off.py`** | 1. Silently imputes missing OFF nutrients (`proteins=6.5`, `energy=210.0`, `fiber=2.2`, `salt=0.65`, `sugars=4.5`, `sat_fat=2.1`), missing Eco-Score (`'C'/52`), and missing NOVA (`3`) (`lines 99–126`).<br>2. Overwrites `public/data/live_research_bundle.json`, `public/data/off_expanded_rows.json`, and `public/data/parquet/openfoodfacts_eu.parquet`.<br>3. `tests/test_empirical_pipeline.py` & `build_data_infrastructure.py` actively fail on that constant tuple signature. | Preserved intact for provenance history, **marked `[DEPRECATED]`** at file header, and **guarded with `--allow-legacy-imputation` CLI flag** before running any bundle/Parquet mutation (directing maintainers to `refresh_off_clean.py`). |

### 2.3 Auxiliary One-Off Scripts (Out of Analytical Core)
- `scripts/build_parquet_and_geojson.py` (historical initial Parquet/GeoJSON bootstrapper), `scripts/scraple_italian_retail_claims.py`, `scripts/harvest_pan_eu_retail_claims.py`, `scripts/build_logo_kit.py`, `scripts/generate_logo_concepts.py`, `scripts/polish_docx.py`. Documented as non-pipeline helper utilities.
