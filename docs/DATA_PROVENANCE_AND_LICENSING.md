# DietShift Atlas — Data Provenance, Inventory & Licensing Registry (WP3)

**Registry Baseline:** [`public/data/datasets_registry.json`](../public/data/datasets_registry.json) (`schema_version: 1.0.0`, generated `2026-11-16T14:32:17.443076+00:00`)  
**Total Tracked Parquet Warehouse:** `19` datasets · `17,627` rows · `944,545` bytes (ZSTD compressed)  
**Validation Summary:** `19 pass`, `0 warn`, `0 fail`, `0 duplicate primary keys`

> [!IMPORTANT]
> **Software License vs. Third-Party Data Rights:** The repository [`LICENSE`](../LICENSE) (`MIT License, Copyright (c) 2026 Amine Zouaghi`) covers the DietShift Atlas **source code** only. It does **not** re-license upstream datasets. Several bundled datasets derive from scraped portals, academic-restricted registries, or commercial summary reports whose redistribution rights are explicitly flagged **`Unverified — requires confirmation`** below.

---

## 1. Evidence Taxonomy Used Across Datasets

Every dataset is tagged strictly according to [`src/types/dataRegistry.ts`](../src/types/dataRegistry.ts):
- **`Observed` (`4` datasets):** Directly measured records or macro statistics retrieved from official agencies or public barcode/receipt databases without synthetic scaling (preserving nulls rather than imputing).
- **`Estimated` (`8` datasets):** Secondary modeled compilations, keyword class-proxies, stylized country/quintile multiplications, or mixed empirical/proxy tables.
- **`Model Output` (`2` datasets):** Structural analytical or life-cycle inventory model outputs (ADEME Agribalyse PEF 3.1 LCI; NUTS-2 SVD equity disaggregation).
- **`Forecast` (`1` dataset):** Expanding-origin historical backtests and out-of-sample projections (`2026–2030`) over observed HICP series.
- **`Manually Compiled` (`4` datasets):** Hand-curated classification concordances, policy mandate tables, or transcribed summary statistics.

---

## 2. Complete Inventory of Registered Parquet Datasets (`19/19`)

### 2.1 Environmental Life-Cycle & Terroir Datasets

| Field | `agribalyse_31` | `global_poore_nemecek_lca` | `gi_terroir_registry` |
| :--- | :--- | :--- | :--- |
| **File / SQL View** | `public/data/parquet/agribalyse_31.parquet` (`agribalyse`) | `public/data/parquet/global_poore_nemecek_lca.parquet` (`global_poore_nemecek_lca`) | `public/data/parquet/gi_terroir_registry.parquet` (`gi_terroir_registry`) |
| **Source Institution** | ADEME / INRAE (France) | Poore & Nemecek (*Science* 2018) via Our World in Data (OWID) | EUIPO GIview Union Register + Fondazione Qualivita / Qualigeo |
| **Source URL(s)** | https://data.ademe.fr/datasets/agribalyse-31-synthese | https://ourworldindata.org/environmental-impacts-of-food | https://www.tmdn.org/giview/ , https://www.qualigeo.eu/ |
| **Tier / Data Nature** | `processed` / **`Model Output`** | `processed` / **`Estimated`** *(corrected from Observed in Phase 5A)* | `harmonized` / **`Estimated`** *(official IDs + proxy impacts)* |
| **Version / Retrieved** | `3.1.1` / `2026-11-08` | `2018 (OWID v1)` / `2026-11-13` | `2026-11-09` / `2026-11-09` |
| **Geo / Temporal Scope** | France / EU retail mix · `2022–2024 (v3.1.1)` | Global meta-analysis (`38,700` farms, `119` countries) · `2018` | EU-27 + `55` countries · `1996–2026` registrations |
| **Shape / Size / Null %** | `2,451` rows × `14` cols · `118,170` B · `0.0%` NULL | `45` rows × `19` cols · `18,107` B · `5.61%` NULL (`32/45` protein, `38/45` kcal) | `6,845` rows × `24` cols · `404,856` B · `0.0%` NULL |
| **Update Policy** | `auto_api` (ADEME Data-Fair API) | `static_reference` | `auto_api` (EUIPO & Qualivita endpoints) |
| **License / Status** | **`Licence Ouverte / Open Licence v2.0 (Etalab)`** — **Verified Open (Attribution Required)** | **`CC-BY 4.0`** (OWID compilation) — **Verified Open (Attribution Required)** | Declared `"EU Open Data / Public Registry"` — **`Unverified — requires confirmation`** *(EUIPO Union Register is public/EU open data; Qualigeo scraped metadata redistribution terms unverified)* |
| **Required Attribution** | ADEME / INRAE Agribalyse 3.1.1 (Etalab 2.0) | Poore & Nemecek (2018), *Science*; processed by OWID (`CC-BY 4.0`) | EUIPO GIview Union Register; Qualivita/Qualigeo confirmation pending |
| **Allowed Uses** | French-mix cradle-to-consumer LCA comparison per 1 kg, AWARE `m³ world-eq`, PEF `Pt` | Global farm-to-retail commodity comparison (`per_kg`, `per_100g_protein`, `per_1000kcal`) | Food-sector GI heritage mapping (`3,037` `FOOD`-only default) with proxy caveats |
| **Prohibited / Misuse** | Treating as measured SKU impacts or converting `Eau_m3` to physical L or `Sol_Pt` to `m²` | Presenting as nation-specific LCI or pooling directly with Agribalyse | Using keyword class-proxy CO₂/water/land as physical LCA; mixing `WINE`/`SPIRIT`/`CRAFT` into food averages |

### 2.2 Nutrition, Retail Barcodes, Scanner Claims & Affordability Datasets

| Field | `openfoodfacts_eu` | `scrapling_retail_claims` | `global_healthy_diet_affordability` | `gs1_immagino_observatory` | `pan_eu_retail_scanner` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **File / View** | `openfoodfacts_eu.parquet` (`openfoodfacts`) | `scrapling_retail_claims.parquet` (`scrapling_retail_claims`) | `global_healthy_diet_affordability.parquet` (`global_healthy_diet_affordability`) | `gs1_immagino_observatory.parquet` (`gs1_immagino_observatory`) | `pan_eu_retail_scanner.parquet` (`pan_eu_retail_scanner`) |
| **Institution** | Open Food Facts (Search-a-licious API) | Open Food Facts Open Prices + OFF | World Bank & FAO via OWID | GS1 Italy (*Osservatorio Immagino*, 19th Ed.) | Extrapolation built on GS1 Immagino methodology |
| **URL(s)** | https://search.openfoodfacts.org/ | https://prices.openfoodfacts.org/api/v1/prices | https://ourworldindata.org/diet-affordability | https://osservatorioimmagino.it/ | https://osservatorioimmagino.it/ |
| **Tier / Nature** | `processed` / **`Observed`** | `harmonized` / **`Observed`** | `processed` / **`Observed`** | `processed` / **`Manually Compiled`** | `analytical` / **`Estimated`** |
| **Version / Date** | `2026-11-16` / `2026-11-16` | `2026-11-16` / `2026-11-16` | `2017–2024` / `2026-11-13` | `19th Edition (2026-1)` / `2026-11-08` | `3.5` / `2026-11-08` |
| **Geo / Temporal** | EU & benchmark tags (`11` categories) · `2026-11-16` | EU retail receipts (`FR=1,178`, `DE=115`, `62` other) · `2026-11-16` | `177` ISO3 countries · `2017–2024` | Italy FMCG summary · `2025–2026` | `IT, FR, DE, ES, NL, BE, PL, SE, AT, PT, EU27` · `2025–2026` |
| **Shape / Null %** | `3,197` × `22` · `131,308` B · `15.45%` NULL (`100%` missing `serving_quantity_g`) | `1,355` × `29` · `97,645` B · `10.18%` NULL (`1,036` g, `187` ml, `132` missing qty) | `1,399` × `9` · `23,530` B · `12.97%` NULL (preserved) | `61` × `9` · `14,697` B · `0.0%` NULL | `88` × `15` · `9,988` B · `0.0%` NULL |
| **Update Policy** | `auto_api` | `auto_api` | `auto_api` | `manual` | `manual` |
| **License / Status** | **`ODbL 1.0` (database) / `CC-BY-SA` (content)** — **Verified Open (Share-Alike + Attribution)** | **`ODbL 1.0`** — **Verified Open (Share-Alike + Attribution)** | **`CC-BY 4.0`** (OWID / World Bank CoHD) — **Verified Open (Attribution Required)** | Declared `"Published report summary metrics (citation required)"` — **`Unverified — requires confirmation`** | Declared `"Research benchmark compilation"` — **`Unverified — requires confirmation`** |
| **Attribution** | Open Food Facts contributors (`ODbL 1.0`) | Open Prices & Open Food Facts contributors (`ODbL 1.0`) | World Bank & FAO Food Prices for Nutrition / OWID (`CC-BY 4.0`) | GS1 Italy *Osservatorio Immagino* (19th Ed. 2026-1) | Author compilation derived from GS1 methodology; commercial NielsenIQ underlying data is proprietary |
| **Allowed Uses** | Unweighted category nutrition profiles (`per_100g`, `per_100kcal` where energy > 0), missingness auditing | Descriptive `EUR/kg` (`1,036`) & `EUR/L` (`187`) retail unit-price dispersion | National daily least-cost healthy diet (`ICP PPP USD/day`) & headcount unaffordability context | Exploratory review of published Italian aggregate label-claim shares (`151,203` SKU study summary) | Cross-market pedagogical illustration of modeled retail shelf structure |
| **Prohibited / Misuse** | Reading as market-share-weighted intake; using `per_serving` (`0/3,197`); ODbL redistribution without notice | Treating FR-skewed sample as representative EU grocery CPI or computing category affordability rankings (`4` OFF overlaps) | Equating macro `ICP PPP USD/day` with individual retail SKU prices | Claiming raw barcode-level NielsenIQ/GS1 microdata access | Treating non-Italian stylized rows (`FR`..`EU27`) as observed live supermarket scanner panels |

### 2.3 Harmonisation, Crosswalks & Statistical Price Forecasts

| Field | `crosswalk_rosetta` | `classification_mappings` | `statistical_price_forecasts` |
| :--- | :--- | :--- | :--- |
| **File / View** | `crosswalk_rosetta.parquet` (`crosswalk_rosetta`) | `classification_mappings.parquet` (`classification_mappings`) | `statistical_price_forecasts.parquet` (`statistical_price_forecasts`) |
| **Source Institution** | Curated bridge: Eurostat COICOP × EFSA FoodEx2 × ADEME Agribalyse 3.1.1 | Curated bridge: ADEME Agribalyse 3.1.1 × EFSA FoodEx2 × OFF × COICOP 2018 | Eurostat `prc_hicp_aind` & UK ONS `MM23` processed by DietShift Atlas |
| **Source URL(s)** | https://data.ademe.fr/datasets/agribalyse-31-synthese | https://data.ademe.fr/datasets/agribalyse-31-synthese , https://www.efsa.europa.eu/en/data/data-standardisation | https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_aind/default/table |
| **Tier / Nature** | `harmonized` / **`Manually Compiled`** | `harmonized` / **`Manually Compiled`** | `forecast` / **`Forecast`** *(observed history + statistical CV/projections)* |
| **Version / Date** | `2.0.0` / `2026-11-16` | `3.0.0-phase3a` / `2026-11-16` | `4.0.0-leakfree` / `2026-11-16` |
| **Geo / Temporal** | EU · Reference `v2.0.0` | EU · Phase 3A `v3.0.0` | `ES, IT, NL, FR, DE, GBR, EU27_2020` (`35` series) · `2015–2025` obs, `2026–2030` proj |
| **Shape / Null %** | `15` × `19` · `7,474` B · `0.0%` NULL | `161` × `19` · `17,612` B · `10.04%` NULL (`35` unmatched target gaps) | `560` × `33` · `28,184` B · `0.95%` NULL |
| **Update Policy** | `manual` | `manual` | `auto_api` |
| **License / Status** | **`CC-BY 4.0`** *(compatible with Etalab 2.0 attribution)* — **Verified Attribution Required** | **`CC-BY 4.0 / ODbL 1.0`** *(inherits OFF Share-Alike where derived from OFF categories)* — **Verified Mixed Open Terms** | **`CC-BY 4.0` (Eurostat) / `OGL v3.0` (UK ONS)** — **Verified Open (Attribution Required)** |
| **Allowed Uses** | Canonical 15-category COICOP–FoodEx2–Agribalyse conceptual lookup | Explicit mapping regime filtering (`6` exact, `70` hierarchical, `16` approximate, `34` ambiguous, `35` unmatched) | Expanding-origin backtesting (`n=15` folds/series), `h=1..3` empirical residual envelopes/quantiles |
| **Prohibited / Misuse** | Ignoring `mapping_type` ambiguity or assuming 1:1 mass conservation across unequal groups | Dropping `unmatched`/`ambiguous` flags silently or ranking categories on `0`-bridge exact-only subsets | Reading macro HICP indices (`2015=100`) as absolute prices or reading `h=4..5` (`2029–2030`) as empirically bounded |

### 2.4 Sub-National Equity, Health Surveys, Clinical Biomarkers & Behavioral / Policy Datasets

| Field | `nsi_subnational_quintiles` | `efsa_foodex2_surveys` | `clinical_biomarker_grounding` | `time_use_cooking_friction` |
| :--- | :--- | :--- | :--- | :--- |
| **File / View** | `nsi_subnational_quintiles.parquet` (`nsi_subnational_quintiles`) | `efsa_foodex2_surveys.parquet` (`efsa_foodex2`) | `clinical_biomarker_grounding.parquet` (`clinical_biomarker_grounding`) | `time_use_cooking_friction.parquet` (`time_use_cooking_friction`) |
| **Institution** | INE Spain, Eurostat HBS (`hbs_str_t223`)/EHIS (`hlth_ehis_fv3i`)/HICP + Author SVD disaggregation | EFSA FoodEx2 Hierarchy + Stylized Scaling Multipliers | CDC / NCHS NHANES 2021–2023 (`.XPT` files, `n=4,262` adults `≥20y`) | Multinational Time Use Study (MTUS) / IPUMS reference + Stylized Quintile Scaling |
| **URL(s)** | https://ec.europa.eu/eurostat/databrowser/view/hbs_str_t223/default/table | https://www.efsa.europa.eu/en/data-report/food-consumption-data | https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?Cycle=2021-2023 | https://www.timeuse.org/mtus |
| **Tier / Nature** | `analytical` / **`Model Output`** | `analytical` / **`Estimated`** | `analytical` / **`Estimated`** *(mixed WTDRD1 empirical + derived constants)* | `analytical` / **`Estimated`** |
| **Version / Date** | `3.2-svd` / `2026-11-16` | `2.0-stylized` / `2026-11-08` | `2021-2023` / `2026-11-13` | `1.0-stylized` / `2026-11-09` |
| **Geo / Temporal** | `30` regions across `ES, IT, NL, FR, DE, GBR` × `5` quintiles · `2019–2025` | `24` countries × `3` age strata × `15` FoodEx2 · `Stylized baseline` | United States adults `≥20y` · `2021–2023` | `11` European countries + `EU-27` × `5` quintiles · `MTUS reference` |
| **Shape / Null %** | `150` × `23` · `12,764` B · `0.0%` NULL | `1,080` × `13` · `12,790` B · `0.0%` NULL | `5` × `24` · `5,518` B · `0.0%` NULL | `60` × `12` · `4,605` B · `0.0%` NULL |
| **Update Policy** | `manual` | `manual` | `auto_api` (biennial CDC `.XPT`) | `credentials_required` (IPUMS/MTUS login for raw microdata) |
| **License / Status** | **`CC-BY 4.0`** (Eurostat HBS/EHIS) — **Verified Open + Model Documentation Required** | **`CC-BY 4.0 (Reference taxonomy)`** — **Verified for EFSA reference; stylized multipliers author-generated** | **`Public Domain (US Government)`** — **Verified Public Domain** | Declared `"Academic registration required for raw microdata"` — **`Unverified — requires confirmation`** |
| **Limitations / Misuse** | Regional NUTS-2 breakdown, NOVA-4 & carbon are **modeled disaggregations**; never present as observed regional survey counts | Scaled from 15 template categories via hardcoded country/age factors; **not raw EFSA Comprehensive Database microdata** | `Total-C`, `HDL-C`, `Non-HDL-C`, `hs-CRP`, `SBP` are WTDRD1-weighted US means; **`LDL`, `TG`, `fasting_glucose=96.0`, `hba1c=5.5`, `bmi=28.4`, `CVD Δ` are fixed ratios/constants**; US-to-EU domain transfer caveat applies | Stylized quintile multipliers; raw MTUS/IPUMS microdata redistribution without agreement is prohibited |

| Field | `consumer_behavior_pulse` | `cultural_climate_inertia` | `school_meals_procurement` | `social_discourse_velocity` |
| :--- | :--- | :--- | :--- | :--- |
| **File / View** | `consumer_behavior_pulse.parquet` (`consumer_behavior_pulse`) | `cultural_climate_inertia.parquet` (`cultural_climate_inertia`) | `school_meals_procurement.parquet` (`school_meals_procurement`) | `social_discourse_velocity.parquet` (`social_discourse_velocity`) |
| **Institution** | Eurobarometer / BEUC / NSI / Wikimedia API Synthesis | European Social Survey (ESS) & TISP (*Nature Sci Data* 2024) | Global Child Nutrition Foundation (GCNF) & National Ministries | Hacker News Algolia API & Google News RSS |
| **URL(s)** | https://wikimedia.org/api/rest_v1/ | https://www.europeansocialsurvey.org/ | https://gcnf.org/global-reports/ | https://hn.algolia.com/api |
| **Tier / Nature** | `analytical` / **`Estimated`** | `analytical` / **`Estimated`** | `processed` / **`Manually Compiled`** | `processed` / **`Observed`** *(metadata/headline snapshot)* |
| **Version / Date** | `3.5` / `2026-11-09` | `1.0` / `2026-11-09` | `2026` / `2026-11-09` | `2026-11-09` / `2026-11-09` |
| **Geo / Temporal** | `ES, IT, FR, DE, NL, GBR, SE, PL` (`8` countries) · `2019–2025` | `10` EU countries + `EU-27` · `2022–2024` | `FR, IT, DE, ES, SE, UK, EU27` · `2024–2026` | Keyword-queried discourse items · `2026-11-09` |
| **Shape / Null %** | `8` × `21` · `5,067` B · `0.0%` NULL | `11` × `9` · `2,192` B · `0.0%` NULL | `7` × `12` · `3,230` B · `0.0%` NULL | `129` × `11` · `26,808` B · `0.0%` NULL |
| **Update Policy** | `manual` | `manual` | `manual` | `auto_api` |
| **License / Status** | Declared `"CC-BY 4.0"` — *synthesized indicators; live Wikimedia pageviews CC-BY-SA / CC0* (**`VERIFIED — ATTRIBUTION REQUIRED`**) | **`VERIFIED — REDISTRIBUTION RESTRICTED`** (`CC BY-NC-SA 4.0` ESS ERIC non-commercial ShareAlike, overriding legacy `"CC-BY 4.0"` registry label; TISP `CC-BY 4.0`) | **`CC-BY 4.0`** (GCNF reports + statutory texts) — **`VERIFIED — ATTRIBUTION REQUIRED`** | **`VERIFIED — REDISTRIBUTION RESTRICTED`** (YC Hacker News & Google News RSS TOS + third-party publisher copyrights; retain locally only) |
| **Limitations / Misuse** | Synthesized national barrier & intention-to-action cascade percentages; not respondent survey microdata | Composite ESS/TISP indices; non-commercial ShareAlike (`CC BY-NC-SA 4.0`) excludes commercial/MIT redistribution | 7-row statutory summary (EGALIM, CAM, DGE); does not measure municipality-level compliance | Live API snapshot biased toward Anglophone tech (HN) & search-indexed RSS news |

---

## 3. Auxiliary Non-Registry Assets & Runtime Data Streams

These files and endpoints power UI modules or runtime calibration outside the `19` SQL tables in `datasets_registry.json` (full Track A / Track B governance rules are enforced in [`docs/phase6/PHASE6B_DATA_GOVERNANCE.md`](phase6/PHASE6B_DATA_GOVERNANCE.md)):

| Asset / Endpoint | Location / File | Nature | License & Verification Status | Documented Role & Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **`COUNTRY_PROFILES` (`25` editions)** | [`src/types/research.ts`](../src/types/research.ts) | `Manually Compiled` | **`UNVERIFIED — DO NOT REDISTRIBUTE`** *(as primary empirical table; see [`PHASE6B_COUNTRY_PROFILES_PROVENANCE.md`](phase6/PHASE6B_COUNTRY_PROFILES_PROVENANCE.md))* | Powers Overview scorecard and `policyScenarioModel.ts` baseline (`dailyCarbonKg`, `dailyWaterLiters`, `dailyLandM2`, `dailyBasketCostEur`, `eatLancetIndex`). Values preserved verbatim pending author citation audit. |
| **`world.geojson`** | [`public/data/world.geojson`](../public/data/world.geojson) | Reference Geometry | **`UNVERIFIED — DO NOT REDISTRIBUTE`** *(pending Natural Earth replacement / SHA pin)* | Fetched via [`scripts/build_parquet_and_geojson.py`](../scripts/build_parquet_and_geojson.py) (`johan/world.geo.json` [UNLICENSE, dubious boundary provenance] / `holtzy/D3-graph-gallery` [MIT]); exact source SHA not logged in `provenance_manifest.json`. |
| **`econometric_calibration.json`** | `public/data/econometric_calibration.json` | `Observed` / `Estimated` | **`CC-BY 4.0`** (derived from Eurostat `hbs_str_t223`, `hlth_ehis_fv3i`, `prc_hicp_midx`, `prc_ppp_ind`) | Supplies empirical `hbs_q1_food_share_pct`, `hbs_q5_food_share_pct`, `ehis_q1/q5`, `eurostat_food_ppp_index_eu27_100`, and price elasticities into Overview / Section IX / Section X. |
| **OpenAlex REST API Metadata** | Bundled inside `live_research_bundle.json` (`openalex` key) | `Observed` bibliometrics | **`CC0 1.0`** (OpenAlex metadata) | Yearly scholarly publication counts (2015–2026) queried via `api.openalex.org`. |
| **Synced JSON Mirrors (`26` files)** | `public/data/*.json` | Derived JSON mirrors | Inherits corresponding Parquet table license | Pre-exported JSON bundles read by TypeScript analytical engines in memory via `dataProvider.ts` (parity verified against Parquet by `test_json_parquet_parity_audit`). |

---

## 4. Mandatory Attribution & Redistribution Checklist Before v1.0 Public Release

1. **Confirm Qualivita / Qualigeo Redistribution Terms:** Determine whether scraped `qualigeo.eu` attributes in `gi_terroir_registry.parquet` must be replaced strictly with official **EUIPO GIview Union Register** fields before public redistribution or commercial use.
2. **Confirm Commercial Restrictions on ESS (`cultural_climate_inertia`):** Verify whether the included ESS wave is governed by **`CC BY-NC-SA 4.0`**; if so, remove generic `"CC-BY 4.0"` label from `datasets_registry.json` and isolate non-commercial clauses.
3. **Review GS1 Italy & MTUS Stylized Tables:** Confirm written permission or clarify abstract-benchmark licensing for `gs1_immagino_observatory.parquet`, `pan_eu_retail_scanner.parquet`, and `time_use_cooking_friction.parquet`.
4. **Preserve ODbL 1.0 Share-Alike Notices:** Any downstream redistribution modifying or publishing `openfoodfacts_eu.parquet`, `scrapling_retail_claims.parquet`, or `classification_mappings.parquet` must comply with **ODbL 1.0** share-alike and attribution obligations.
5. **Document & Cite `COUNTRY_PROFILES` & `world.geojson`:** Add explicit bibliographic provenance and commit/source licenses to `datasets_registry.json` (or companion manifest) for the `25` hardcoded country baselines and cartographic boundaries.
