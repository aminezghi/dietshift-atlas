# DietShift Atlas — A Friendly Guide for the Curious Citizen

> *"An open-science digital almanac connecting supermarket nutrition labels, environmental life-cycle inventories, European protected origin registers, and household affordability inside your web browser."*
>
> **Architected by:** Amine Zouaghi ([GitHub @aminezghi](https://github.com/aminezghi/dietshift-atlas) · [LinkedIn](https://www.linkedin.com/in/zouaghi-amine/))  
> **Version:** `1.0.0-rc.1` (Analytical baseline `v5.2.0-phase5c`)  
> **Built with:** Client-Side DuckDB-Wasm (`1.33.1`), Apache ECharts 6, Pure TypeScript Analytical Engines & Open Science Standards

---

## Table of Contents
1. [What is DietShift Atlas? (In Plain English)](#1-what-is-dietshift-atlas-in-plain-english)
2. [The Core Problem: The "Intention-to-Plate" Paradox](#2-the-core-problem-the-intention-to-plate-paradox)
3. [The 4 Layers of the System (How It Works Under the Hood)](#3-the-4-layers-of-the-system-how-it-works-under-the-hood)
4. [A Guided Tour Through the 13 Observatories](#4-a-guided-tour-through-the-13-observatories)
5. [Key Concepts Demystified](#5-key-concepts-demystified)
6. [How We Protect Transparency (Zero Server Tracking)](#6-how-we-protect-transparency-zero-server-tracking)
7. [Frequently Asked Questions (F.A.Q.)](#7-frequently-asked-questions-faq)

---

## 1. What is DietShift Atlas? (In Plain English)

Have you ever wondered:
- *Why do staple whole foods inflate faster in price crises than shelf-stable ultra-processed products?*
- *When a package label highlights "High Protein" or "Plant-Based", what do measured nutrition panels actually show—and where are label values missing?*
- *How do environmental footprints (CO₂eq, AWARE water scarcity, PEF soil quality) differ from farm-to-retail commodity estimates?*
- *Why do most citizens say they want to eat healthier and more sustainably, yet supermarket purchases still lag dietary goals?*

**DietShift Atlas** is a client-side interactive digital almanac designed to explore these questions with verifiable, clearly badged scientific data (`Observed`, `Model Output`, `Estimated`, `Forecast`, `Manually Compiled`, or `Simulated`).

Across **19 ZSTD-compressed Parquet tables (`17,627` rows)** and calibrated macro bundles, it brings together:
- Environmental life-cycle models from **ADEME / INRAE Agribalyse 3.1.1** (`2,451` items, French cradle-to-consumer mix) and **Poore & Nemecek (2018)** (`45` global farm-to-retail commodities).
- Cleaned barcoded nutrition panels from **Open Food Facts** (`3,197` EU catalog products preserving missing values as `NULL`) and real EU receipt shelf prices from **Open Prices** (`1,355` SKUs, largely France and Germany).
- European protected agricultural heritage registers (**EUIPO GIview** & **Qualigeo**, `6,845` items — `3,037` food-sector items selected by default).
- Macroeconomic price inflation & affordability datasets (**Eurostat HICP & PPP**, **UK ONS MM23**, **INE Spain**, **World Bank & FAO Cost of a Healthy Diet**).
- Summary report benchmarks transcribed from **GS1 Italy *Osservatorio Immagino*** (whose underlying national scanner study covers `151,203` products and `84,817` panels across `€57.3B` sell-out; raw NielsenIQ microdata are proprietary and not bundled).

---

## 2. The Core Problem: The "Intention-to-Plate" Paradox

Behavioral synthesis indicators in Section III (`consumer_behavior_pulse.parquet`) illustrate why dietary intentions decay between awareness and actual healthy eating:
- Information overload and front-of-pack label confusion;
- The socioeconomic grocery **"Price Wall"** when inflation hits whole foods unevenly across income quintiles (`Q1`–`Q5`);
- Culinary time poverty and convenience habits;
- Household spoilage and downstream supply-chain losses.

---

## 3. The 4 Layers of the System (How It Works Under the Hood)

### Tier 1: Reproducible Ingestion & Harvesters
- Collects Open Food Facts nutrition labels without fake zero/average imputations (`refresh_off_clean.py`), Open Prices EUR receipt prices (`harvest_raw_prices_scrapling.py`), Eurostat/NHANES empirical microdata (`build_deep_empirical_pipeline.py`), and OWID international benchmarks.

### Tier 2: In-Browser Columnar Data Warehouse (`DuckDB-Wasm 1.33.1`)
- **Zero server telemetry, zero cloud compute costs.**
- Your browser loads **19 ZSTD Parquet tables (`17,627` rows; `944,545` B)** via `DuckDB-Wasm` when opening SQL explorers and executes complex SQL queries locally in milliseconds.

### Tier 3: Audited TypeScript Analytical Engines & Statistical Forecasting
- **Causal Expanding-Origin Forecasting (`statistical_price_forecasts`, `560` rows):** Evaluates five classical statistical and naive models (`Damped Trend ETS`, `Holt Linear ETS`, `Ridge Linear Trend`, `Random Walk with Drift`, and `Random Walk`) across `35` Eurostat/ONS HICP food series with empirical `h=1..3` residual intervals (`h=4..5` explicitly marked `Unavailable`).
- **Unit-Safe Nutrition, Environmental, Affordability & Robustness Engines:** Enforce strict `per_100g` vs. `per_100kcal` separation, preserve native `AWARE m³ world-eq` and `PEF Pt` units, keep macro PPP/HICP separate from SKU prices, and avoid arbitrary unified composite scores.

### Tier 4: Reactive Almanac Interface (`13` Observatories)
- Built in **React 19, TypeScript, Vite 8, and Apache ECharts 6** with `DataNatureBadge` provenance badges, interactive data-table accessibility fallbacks, and live CSV/JSON exports.

---

## 4. A Guided Tour Through the 13 Observatories

| Section | Title | What You Can Explore |
| :---: | :--- | :--- |
| **I** | **Almanac Overview & Plate** | National EAT-Lancet baseline radar (`COUNTRY_PROFILES`, manually compiled), Open Food Facts nutrients vs. NOVA, Eurostat HICP curves (with explicit `[EU27_2020 FALLBACK]` captions when triggered), and Agribalyse vs. Poore & Nemecek comparisons. |
| **II** | **NSI & Statistical Forecasts** | Income quintile (`Q1–Q5`) regional equity disaggregation paired with causal `2019–2024` expanding-origin HICP backtests (`2026–2030` projections). |
| **III** | **Consumer Behavior & Infodemiology** | Intention-to-plate cascade (`Estimated`), culinary time-use synthesis, CDC NHANES 2021–2023 survey-weighted biomarkers (`Estimated`), school meal legal mandates, ESS/TISP inertia (`CC BY-NC-SA` non-commercial source caveat), and digital discourse metadata. |
| **IV** | **Full Cartography** | World and European maps (`world.geojson`) plus geographical indication terroir clusters (`gi_terroir_registry`). |
| **V** | **DuckDB Parquet SQL** | Run 12 curated SQL presets or write custom analytical `SELECT` queries directly against all `19` in-browser Parquet views. |
| **VI** | **Researcher Survey Ledger** | Upload blank-preserving participant 24h recall CSVs or append ADEME Agribalyse 3.1.1 items while keeping missing nutrition/price fields `NULL` and preserving `AWARE m³ world-eq` / `PEF Pt` units. |
| **VII** | **Retail Product Trilemma** | Audit `3,197` OFF barcodes across `per_100g` vs. `per_100kcal` (`3,097` positive-energy pool; `per_serving` `Unavailable`), plus `Include Unknown NOVA (NULL)` filtering. |
| **VIII** | **Agribalyse 3.1 (2,451)** | Explore ADEME Agribalyse LCI indicators separately from Poore & Nemecek 2018 and `FOOD`-only GI Terroir proxies (`3,037` items by default). |
| **IX** | **Affordability & Integrated Comparator** | Compare observed `EUR/kg` (`1,036`) vs. `EUR/L` (`187`) retail SKUs alongside macro `HICP`/`PPP`/`CoHD`, inspect the `161`-rule taxonomy concordance, and explore `12` Phase 4D integrated robustness scenarios (`13×8` Evidence Matrix). |
| **X** | **Policy Intervention Model** | Test deterministic analyst-defined policy sensitivity sliders (`Simulated`, nominal `%` shifts, `95% CI: Unavailable`). |
| **XI** | **Code Floorplan & Architecture** | Inspect the interactive 33-file subsystem code graph and vector architecture schematic. |
| **XII** | **Pan-EU Retail Scanner & Claims** | Inspect GS1 Italy report summaries, Push vs. Pull claim quadrants, stylized EU scanner benchmarks, and the DuckDB SQL grocery planner. |
| **XIII** | **Empirical Sensitivity** | Inspect `19` valid one-at-a-time sensitivity scenarios across `6` analytical dimensions plus `1` isolated GI alcohol diagnostic stress test. |

---

## 5. Key Concepts Demystified

- **Metaproduct (GS1 Report Context):** In GS1 Italy's published study, sales-volume-weighted supermarket staples establish an aggregate national nutrition reference. Because open datasets lack SKU sales volumes, DietShift Atlas's live Open Food Facts and Agribalyse category averages report **unweighted catalog arithmetic means and medians** instead.
- **AWARE Water vs. Liters & PEF `Pt` vs. `m²`:** ADEME Agribalyse `Eau_m3` measures regionalized **water scarcity deprivation (`m³ world-eq`)** and `Sol_Pt` measures normalized **PEF soil quality points (`Pt`)**. Neither should ever be converted to raw liters or physical square meters by multiplying with arbitrary scalars.
- **NOVA Classification (`1–4` + `NULL`):** Groups foods from minimally processed (`NOVA 1`) to ultra-processed formulations (`NOVA 4`). Products lacking a label NOVA tag remain explicitly `NULL` and can be toggled in the left sidebar.

---

## 6. How We Protect Transparency (Zero Server Tracking)

- **100% Client-Side Execution:** Queries, chart filters, CSV/JSON exports, and sensitivity suites run strictly inside your browser session without uploading user inputs to external servers.
- **Complete Provenance & Limitations Docs:** See [`docs/SCIENTIFIC_METHODOLOGY.md`](SCIENTIFIC_METHODOLOGY.md), [`docs/DATA_PROVENANCE_AND_LICENSING.md`](DATA_PROVENANCE_AND_LICENSING.md), [`docs/USER_GUIDE.md`](USER_GUIDE.md), and [`docs/LIMITATIONS_AND_RESPONSIBLE_USE.md`](LIMITATIONS_AND_RESPONSIBLE_USE.md).

---

## 7. Frequently Asked Questions (F.A.Q.)

**Q: How can I reproduce or audit the code locally?**  
A: Follow [`docs/REPRODUCIBILITY.md`](REPRODUCIBILITY.md) (`npm ci && npm run qa`) and visit Tab `XI` inside the application.

**Q: Can I report a bug or license question?**  
A: Open an issue on [GitHub (`aminezghi/dietshift-atlas`)](https://github.com/aminezghi/dietshift-atlas) or connect with [Amine Zouaghi on LinkedIn](https://www.linkedin.com/in/zouaghi-amine/).
