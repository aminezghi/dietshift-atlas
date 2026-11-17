# DietShift Atlas — Reproducibility, Build & Execution Guide (WP4)

**Verified Baseline:** `v5.2.0-phase5c`  
**Verified Local Environment:** Windows 11 (`win32`), Node.js `v24.1.0`, `npm 11.3.0`, Python `3.13.5`, Vitest `v5.1.0`, Vite `v8.3.6`, Playwright Chromium (`1.53.0` system / `1.64.1` `.venv`), DuckDB `2.0.0`, PyArrow `23.0.1`, Pytest `9.1.1`.  
**CI Environment ([`.github/workflows/qa-gate.yml`](../.github/workflows/qa-gate.yml)):** `ubuntu-latest`, Node.js `20`, Python `3.13`.

---

## 1. Quick Start (Web Application — No Python Required)

The compiled DietShift Atlas web application requires **only Node.js and npm**. All analytical data is pre-compiled into `public/data/`, so **no Python installation, database server, or external backend is needed** to run or build the application.

```bash
# 1. Clone repository
git clone https://github.com/aminezghi/dietshift-atlas.git
cd dietshift-atlas

# 2. Install frontend dependencies (exact lockfile)
npm ci

# 3. Verify code quality & tests
npm run lint    # Oxlint TypeScript/React static analysis (0 errors)
npm test        # Vitest engine & component tests (87 passing tests)

# 4. Build production bundle
npm run build   # Type-check with tsc -b and bundle with Vite into dist/

# 5. Preview locally
npm run preview # Starts local HTTP server at http://localhost:4173
```

---

## 2. System & Toolchain Requirements

| Component | Verified Requirement | Notes |
| :--- | :--- | :--- |
| **Node.js & npm** | Node `20+` (CI) / `24.1.0` (verified local) · `npm ci` | Drives TypeScript (`~7.0.2`), Vite (`^8.3.6`), Oxlint (`^1.90.0`), and Vitest (`^5.1.0`). |
| **Python** | Python `3.13` (`3.13.5` verified) | Drives QA gate runner, Pytest Parquet parity checks, and data ingestion/regeneration scripts. |
| **Browser** | Chromium (for Playwright E2E) + WebAssembly & Web Worker support (modern Chrome, Edge, Firefox, Safari) | Required to run live `DuckDB-Wasm ^1.33.1-dev57.0` SQL queries and inspect WebGL/Canvas ECharts visualizations. |
| **Disk & Memory** | `~150 MB` static assets + `node_modules`; Chromium browser requires `~150+ MB` free RAM for `35.91 MB` DuckDB-Wasm worker instantiation | All SQL and analytical math execute 100% locally client-side after asset fetch. |

> [!NOTE]
> **Python Dependency Layout (Resolved in Phase 6B):** Root [`requirements.txt`](../requirements.txt) includes core analytical pipeline dependencies (`duckdb`, `pyarrow`, `numpy`, `pandas`), scraping harvesters (`scrapling`, `curl_cffi`, `playwright`), and `pytest`. For CI or verification-only runs without heavy web scrapers, install [`requirements-dev.txt`](../requirements-dev.txt). Legacy scripts using constant fallback imputation (`fetch_live_data.py`, `build_consumer_pulse_and_scale_off.py`) are quarantined with `--allow-legacy-imputation` guards (see [`docs/phase6/PHASE6B_PIPELINE_HYGIENE.md`](phase6/PHASE6B_PIPELINE_HYGIENE.md)).

---

## 3. Developer Setup & Python Environment (Optional — For QA & Data Pipelines)

To run the complete data-pipeline regeneration scripts, Parquet schema verifications, or the automated Python QA gate, configure a Python virtual environment:

### 3.1 Install Python Dependencies
```bash
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# For automated QA and test runs:
pip install -r requirements-dev.txt

# Or for the full scraping and data engineering pipeline:
pip install -r requirements.txt

# Install Playwright browser binary for E2E tests:
python -m playwright install chromium --with-deps
```

---

## 4. Reproducing the Offline Verification Suite (`npm run qa`)

The deterministic Phase 5C CI quality gate ([`scripts/run_qa_gate.py`](../scripts/run_qa_gate.py)) executes **five strictly fail-fast stages without live external internet requests**:

```bash
npm run qa
# Equivalent to: python scripts/run_qa_gate.py
```

| Stage | Command Run | Verified Scope (`v5.2.0-phase5c`) |
| :---: | :--- | :--- |
| **1/5 Static Lint** | `npm run lint` (`oxlint`) | Checks static JS/TS hygiene (`58` files). |
| **2/5 Engine, Component & Parity Tests** | `npm test` (`vitest run`) | Runs `16` test files (`73` tests) over `src/analytics/*`, `src/services/dataProvider.ts`, `src/utils/exportDownload.ts`, `src/types/dataRegistry.ts`, and React JSDOM component/App parity tests. |
| **3/5 TypeScript & Bundle Build** | `npm run build` (`tsc -b && vite build`) | Verifies strict TypeScript compilation and chunked asset output into `dist/`. |
| **4/5 Parquet & JSON–Parquet Parity** | `npm run test:data` (`python -m pytest tests/test_empirical_pipeline.py -v`) | Validates all `19` ZSTD Parquet tables against `datasets_registry.json`, SHA-256 hashes, primary keys, nullability/non-imputation checks, and `17` 1:1 JSON–Parquet parity assertions (`14/14` tests). |
| **5/5 Headless Chromium E2E** | `npm run test:e2e` (`python -m pytest tests/e2e -v`) | Spawns `vite preview` over `dist/` and checks all `13` sections (`I`–`XIII`), deep links, EU27/country fallback disclosures, modal keyboard focus trapping, HTTP 500 retry, single-fetch dedup, and live CSV/JSON downloads. |

---

## 5. Data Pipeline Reconstruction & Script Execution Order

The static `public/data/` snapshot committed in the repository is directly queryable offline. Rebuilding raw datasets from upstream institutional APIs requires external network access and must execute in **specific script order** so empirical microdata overrides stylized intermediate outputs and legacy imputation scripts are avoided.

### 4.1 Safe Active Pipeline Execution Sequence

```bash
# Step 1: Retail Open Food Facts clean harvest (preserves missing fields as NULL)
python scripts/refresh_off_clean.py

# Step 2: Open Prices EU shelf receipts + OFF nutrition enrichment
python scripts/harvest_raw_prices_scrapling.py

# Step 3: GI terroir registry (EUIPO/Qualigeo), GS1 Italy Immagino, Pan-EU Retail & Social Discourse
python scripts/build_gi_terroir_and_social_scrapling.py
python scripts/enrich_gi_coordinates.py
python scripts/build_gs1_immagino_parquet.py
python scripts/build_pan_eu_retail_parquet.py

# Step 4: Stylized behavioral / time-use / school-meal tables + biomarker scaffolding
python scripts/build_empirical_social_microdata.py

# Step 5: MUST RUN AFTER Step 4 — overwrites synthetic biomarker scaffold with real CDC NHANES WTDRD1 .XPT microdata + pulls live Eurostat HBS/EHIS/HICP/PPP cubes
python scripts/build_deep_empirical_pipeline.py

# Step 6: Global OWID benchmarks (Poore & Nemecek 2018 + World Bank/FAO CoHD)
python scripts/build_international_benchmarks.py

# Step 7: NSI SVD regional equity model + leak-free statistical HICP backtests/projections (2015–2030)
python scripts/build_nsi_and_ml_parquet.py

# Step 8: Multi-taxonomy concordance (classification_mappings.parquet: 161 rules)
python scripts/build_classification_mappings.py

# Step 9: Regenerate datasets_registry.json, provenance_manifest.json, schema checks & SHA-256 hashes
python scripts/build_data_infrastructure.py
```

### 4.2 Legacy Scripts to Avoid in Clean Rebuilds
Do **not** execute [`scripts/fetch_live_data.py`](../scripts/fetch_live_data.py) or [`scripts/build_consumer_pulse_and_scale_off.py`](../scripts/build_consumer_pulse_and_scale_off.py) when regenerating Open Food Facts tables: both retain legacy fixed-default nutriment imputation logic (`proteins_100g = 6.5`, `energy_kcal_100g = 210`, etc.) superseded by `refresh_off_clean.py`. (Note: `build_data_infrastructure.py` actively checks for and flags that legacy imputation tuple if detected.)

### 4.3 Runtime Browser Delivery (`DuckDB-Wasm` vs. `dataProvider.ts`)
- **Dual-Path Verified Architecture:** Analytical engines in [`src/analytics/`](../src/analytics/) execute over deduplicated in-memory JSON bundles loaded once per session via [`src/services/dataProvider.ts`](../src/services/dataProvider.ts). Simultaneously, [`src/services/duckdbEngine.ts`](../src/services/duckdbEngine.ts) registers all `19` ZSTD Parquet tables from `public/data/parquet/*.parquet` via `absoluteAssetUrl` into Web Worker memory when Sections `V` (`DuckDBParquetWorkbench`) or `XII` (`Agentic SQL Planner`) open.
- **Parity Guarantee:** Whenever any Parquet file or JSON file is rebuilt, Step 9 (`build_data_infrastructure.py`) plus `pytest tests/test_empirical_pipeline.py` verify that both representations remain synchronized.

---

## 6. Known Reproducibility Limitations

1. **Upstream Live API Temporal Drift:** Re-running `refresh_off_clean.py`, `harvest_raw_prices_scrapling.py`, `build_gi_terroir_and_social_scrapling.py`, or `build_deep_empirical_pipeline.py` against live external servers (`search.openfoodfacts.org`, `prices.openfoodfacts.org`, `ec.europa.eu/eurostat`, `hn.algolia.com`) will return newly contributed or revised records rather than reproducing identical row counts (`3,197`, `1,355`, `6,845`, `129`) unless cached files inside `scripts/.raw_cache/` are reused.
2. **Private/Unpinned Non-Registry Geometry (`public/data/world.geojson`):** `scripts/build_parquet_and_geojson.py` downloads `world.geojson` from remote GitHub raw URLs without recording a Git commit SHA in `provenance_manifest.json`. Preserve the committed `public/data/world.geojson` for byte-identical cartographic boundaries.
3. **Curated Reference Constants (`COUNTRY_PROFILES` & Stylized Tables):** Replicating stylized outputs in `efsa_foodex2_surveys.parquet`, `time_use_cooking_friction.parquet`, `consumer_behavior_pulse.parquet`, and `COUNTRY_PROFILES` (`src/types/research.ts`) depends on preserving those exact checked-in lookup coefficients.
4. **Live DuckDB-Wasm SQL Not Exercised in CI Chromium:** CI Playwright verifies panel mounting and JSON-backed engine exports rather than awaiting full `35.91 MB` Wasm initialization inside GitHub Actions; interactive SQL correctness in DuckDB is verified instead against native Python DuckDB in `tests/test_empirical_pipeline.py`.
5. **Credentialed Upstream Microdata (`time_use_cooking_friction`):** Refreshing MTUS/IPUMS primary microdata requires academic registration (`update_policy: "credentials_required"`).
