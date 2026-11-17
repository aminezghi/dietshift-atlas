# DietShift Atlas — Dataset Licensing & Redistribution Governance Register (WP2 / B-02)

**Governance Date:** 2026-11-17  
**Registry Baseline:** [`public/data/datasets_registry.json`](../../public/data/datasets_registry.json) (`19` Parquet tables, `17,627` rows) + auxiliary runtime files (`public/data/world.geojson`, `src/types/research.ts` `COUNTRY_PROFILES`)  
**Governing Rule:** Zero implied permissions from public URL accessibility; upstream licensing restrictions explicitly override convenience bundling. No dataset with `VERIFIED — REDISTRIBUTION RESTRICTED`, `UNVERIFIED — DO NOT REDISTRIBUTE`, or `PERMISSION REQUIRED` may be included in an unrestricted public open-data release bundle without documented written clearance or clean-room replacement.

---

## 1. Authoritative Status Definitions Used

| Governance Status | Operational Meaning for DietShift Atlas v1.0 Release Packaging |
| :--- | :--- |
| **`VERIFIED — REDISTRIBUTION PERMITTED`** | Upstream terms explicitly allow copying, modification, and commercial/non-commercial redistribution without special authorization beyond standard license preservation (e.g., Public Domain / CC0). |
| **`VERIFIED — ATTRIBUTION REQUIRED`** | Upstream open license explicitly permits redistribution and adaptation provided credit/notice/ShareAlike obligations (`CC-BY 4.0`, `Etalab Open Licence v2.0`, `ODbL 1.0`, `OGL v3.0`) are preserved cleanly. |
| **`VERIFIED — REDISTRIBUTION RESTRICTED`** | Authoritative upstream terms prohibit commercial reuse, forbid third-party redistribution/mirroring, enforce `CC BY-NC-SA 4.0` non-commercial restrictions, or bar automated extraction for redistribution. Retain only locally for reproducible inspection or isolate from open release packages. |
| **`PERMISSION REQUIRED`** | Upstream rights holder asserts copyright over systematic reproduction, report aggregation, or derived benchmarks; written permission (or documented fair-dealing exemption) must be obtained before bundling for external download. |
| **`UNVERIFIED — DO NOT REDISTRIBUTE`** | Incomplete upstream license provenance or missing source bibliography; excluded from public open-data redistribution bundles until provenance is verified or replaced cleanly. |

---

## 2. Detailed Governance Review of the Seven Flagged Sources (`B-02`)

### 2.1 Geographical Indications (`gi_terroir_registry.parquet` — `6,845` rows)
- **Original Publishers:**
  1. **EUIPO GIview Union Register** (European Union Intellectual Property Office / European Commission DG AGRI, `https://www.tmdn.org/giview/`).
  2. **Fondazione Qualivita — Qualigeo** (`https://www.qualigeo.eu/`, REST index `qualivita.it/rest/products-autocomplete.php`).
- **Authoritative Terms Located (Verified 2026-11-17):**
  - *EUIPO Union Register / European Commission GI data:* Public EU open-registry metadata permitted for reference with attribution (`EUIPO GIview Union Register`).
  - *Qualigeo (`qualigeo.eu`):* Explicit copyright & legal notice states that **all contents, texts, and images on the website are the exclusive property of Fondazione Qualivita**, and **copying, reproduction, redistribution, or publication in any form or medium is strictly prohibited without express written authorization**.
- **Usage & Redistribution Matrix:**
  - *Use / Modification:* Local analytical inspection possible; scraped `qualigeo_url`, Qualigeo slugs, `disciplinare_note` HTML extracts, and `QUALIGEO_*` records (`scripts/build_gi_terroir_and_social_scrapling.py:312-419`) embed Fondazione Qualivita copyrighted content.
  - *Commercial / Non-Commercial Redistribution of Combined Table:* **Prohibited without express written authorization** from Fondazione Qualivita.
  - *Derived Data (`co2_kg_per_kg`, `water_L_per_kg`, `land_m2_per_kg`):* Keyword class proxies authored in DietShift Atlas (`classify_gi_full`), but attached to Qualigeo-derived identifiers/notes.
- **Required Attribution:** EUIPO GIview Union Register (`tmdn.org/giview/`); written clearance from Fondazione Qualivita if Qualigeo fields remain bundled.
- **Assigned Governance Status:**
  - EUIPO-only subset: **`VERIFIED — ATTRIBUTION REQUIRED`**
  - Combined **`gi_terroir_registry.parquet` / `gi_terroir_bundle.json`** (containing Qualigeo scraped text/rows): **`VERIFIED — REDISTRIBUTION RESTRICTED`** / **`PERMISSION REQUIRED`** *(Exclude Qualigeo-sourced rows/fields from public open redistribution packages unless Fondazione Qualivita grants written permission, or regenerate cleanly from EUIPO GIview alone.)*

### 2.2 GS1 Italy *Osservatorio Immagino* & Pan-EU Scanner Benchmarks (`gs1_immagino_observatory.parquet` `61` rows; `pan_eu_retail_scanner.parquet` `88` rows)
- **Original Publisher:** **GS1 Italy & GS1 Italy Servizi S.r.l.** in collaboration with **NielsenIQ** (*Osservatorio Immagino*, 19th Edition 2026-1, `https://osservatorioimmagino.it/`).
- **Authoritative Terms Located (Verified 2026-11-17):**
  - GS1 Italy legal/copyright notices state that report data, studies, and compilations published via *Osservatorio Immagino* are copyright-protected; personal consultation/study with explicit citation (*"Osservatorio Immagino GS1 Italy"*) is customary, while **systematic reproduction, modification, mirroring, or commercial exploitation requires express written authorization from GS1 Italy**; raw NielsenIQ/Immagino barcode microdata remain strictly proprietary.
- **Derived Table Distinction:**
  - `gs1_immagino_observatory.parquet` (`61` rows): Manual transcription of published report aggregate statistics (`Metaprodotto`, `Fenomeni`, regional shares, E-commerce index).
  - `pan_eu_retail_scanner.parquet` (`88` rows): Reproduces Italy GS1 report summary values (`IT`) alongside author-synthesized non-Italian country benchmark rows (`FR..EU27`, `Estimated`).
- **Required Attribution:** GS1 Italy & NielsenIQ (*Osservatorio Immagino*, 19th Edition, 2026-1).
- **Assigned Governance Status:** **`PERMISSION REQUIRED`** *(Retain citation-linked summary benchmarks only under academic quotation boundaries; do **not** bundle into an unrestricted MIT-licensed public dataset download without written GS1 Italy clearance.)*

### 2.3 MTUS / IPUMS Time Use Benchmarks (`time_use_cooking_friction.parquet` — `60` rows)
- **Original Publishers:** **Centre for Time Use Research (CTUR), University College London** & **IPUMS Time Use (University of Minnesota)** (`https://www.timeuse.org/mtus`, `https://www.mtusdata.org/`).
- **Authoritative Terms Located (Verified 2026-11-17):**
  - IPUMS / MTUS user agreement strictly limits access to **registered non-commercial scholarly/educational research**, explicitly stating **"You will not redistribute MTUS data or extracts to any third party"** (every researcher must register directly), forbids commercial use, forbids cells with `< 30` unweighted observations, and permits publishing only limited summary coefficients/tables inside academic publications with mandatory citation.
- **Transformation Status in Repo:** `scripts/build_empirical_social_microdata.py` generates `time_use_cooking_friction.parquet` (`v1.0-stylized`) using hardcoded national baseline minutes scaled by quintile multipliers rather than redistributing raw IPUMS respondent extracts—yet the table still presents itself as `"Multinational Time Use Study (MTUS) & ATUS IPUMS Crosswalk"` without documenting primary IPUMS extract citations or confirming exemption as an external Parquet bundle.
- **Required Attribution:** Multinational Time Use Study (CTUR, UCL) & IPUMS Time Use, University of Minnesota.
- **Assigned Governance Status:** **`VERIFIED — REDISTRIBUTION RESTRICTED`** (upstream microdata / non-commercial restriction) · **`PERMISSION REQUIRED`** for standalone public bundling of derived benchmark tables referencing IPUMS MTUS.

### 2.4 European Social Survey (`cultural_climate_inertia.parquet` — `11` rows)
- **Original Publishers:** **European Social Survey ERIC (ESS ERIC)** (`https://www.europeansocialsurvey.org/`) paired with **TISP (*Nature Scientific Data* 2024)**.
- **Authoritative Terms Located (Verified 2026-11-17):**
  - ESS primary data are distributed under **`Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)`** (ESS documentation is `CC BY-SA 4.0`).
  - **Key Binding Clauses:** (a) **Non-Commercial (NC):** Commercial exploitation is strictly prohibited even by non-profits generating commercial revenue; (b) **ShareAlike (SA):** Any adapted, remixed, or derived composite table incorporating ESS variables **must be redistributed under `CC BY-NC-SA 4.0`**, never under `CC-BY 4.0` or `MIT`; (c) **Anti-Mirroring Guidance:** ESS explicitly advises linking users to the official ESS Data Portal rather than mirroring data externally (and if hosted, exact ESS Round/version identifiers must be stated).
  - **Verified Registry Error:** `public/data/datasets_registry.json` currently declares `license: "CC-BY 4.0"` for `cultural_climate_inertia`, which conflicts directly with ESS's **`NC-SA`** license!
- **Required Attribution:** ESS ERIC (exact Round & Version citation required) + TISP (*Nature Sci Data* 2024, `CC-BY 4.0`).
- **Assigned Governance Status:** **`VERIFIED — REDISTRIBUTION RESTRICTED`** (`CC BY-NC-SA 4.0`; non-commercial only, ShareAlike required, incompatible with permissive commercial/MIT dataset bundles).

### 2.5 Hacker News Algolia API & Google News RSS (`social_discourse_velocity.parquet` — `129` rows)
- **Original Publishers:** **Y Combinator** (`news.ycombinator.com`), **Algolia** (`hn.algolia.com/api`), **Google LLC** (`Google News RSS`), and underlying news publishers holding title/article copyright.
- **Authoritative Terms Located (Verified 2026-11-17):**
  - *Y Combinator Terms of Use:* Explicitly prohibit commercial exploitation, copying/reproducing/distributing/publishing site content, and automated data mining, robots, or scraping without written authorization.
  - *Algolia Search API:* Governed by Algolia TOS & Acceptable Use Policy.
  - *Google Terms & Google News Guidelines:* Google retains rights over compilation/presentation and limits RSS usage to **personal, non-commercial use**, while individual publishers retain copyright over headlines, snippets, and linked news items.
- **Required Attribution:** Original linked publishers, Hacker News / Algolia, Google News (for local inspection only).
- **Assigned Governance Status:** **`VERIFIED — REDISTRIBUTION RESTRICTED`** / **`UNVERIFIED — DO NOT REDISTRIBUTE`** *(Retain locally only or drop third-party headlines/URLs from external downloadable dataset releases).*

### 2.6 Cartographic Polygons (`public/data/world.geojson`)
- **Upstream Origins Retrieved (`scripts/build_parquet_and_geojson.py:13-14`):**
  1. `https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson` (repo MIT License).
  2. `https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json` (repo `UNLICENSE`).
- **Authoritative Terms & Provenance Gap (Verified 2026-11-17):**
  - While `johan/world.geo.json` carries an `UNLICENSE` file, its author explicitly caveats that the **legal status of the underlying geographic border coordinates is "dubious"/unverified** (recommending Natural Earth / `world-atlas` when formal provenance is required). Moreover, `provenance_manifest.json` does not log which URL or commit SHA generated the committed `public/data/world.geojson`.
- **Assigned Governance Status:** **`UNVERIFIED — DO NOT REDISTRIBUTE`** *(Replace with Natural Earth 110m Public Domain `world-atlas` TopoJSON/GeoJSON with recorded SHA-256 before formal open release).*

### 2.7 Manually Compiled Country Profiles (`COUNTRY_PROFILES` in `src/types/research.ts`, `25` entries)
- **Original Compiler:** Author of DietShift Atlas (manually compiled TypeScript constants).
- **Provenance & Terms Audit (`WP5` / [`PHASE6B_COUNTRY_PROFILES_PROVENANCE.md`](PHASE6B_COUNTRY_PROFILES_PROVENANCE.md)):**
  - The TypeScript data structure itself is authored inside the repository (`MIT` software license), **but zero row-level primary source citations, reference years, retrieval URLs, or estimation formulas exist in code or `datasets_registry.json`** for any of the `25` countries' baselines (`eatLancetIndex`, `dailyCarbonKg`, `dailyWaterLiters`, `dailyLandM2`, `dailyBasketCostEur`, `sayDoGapScore`, `plantProteinSharePct`).
- **Assigned Governance Status:** Code artifact is MIT software configuration; as an external empirical dataset claim, **`UNVERIFIED — DO NOT REDISTRIBUTE`** as primary observed country statistics until upstream sources are formally documented or replaced by referenced national dietary intake tables.

---

## 3. Complete 21-Asset Governance Ledger & Redistribution Segregation Policy

### 3.1 Summary Classification of All 19 Parquet Tables + 2 Runtime Assets

| Release Bundle Track | Asset ID / File | Rows | License / Terms | Governance Status | Action for `v1.0` Public Release |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Track A — Open Release Permitted** | `clinical_biomarker_grounding.parquet` *(NHANES US gov)* | `5` | US Government Public Domain (`CDC/NCHS`) | **`VERIFIED — REDISTRIBUTION PERMITTED`** | Include with NHANES citation + proxy column note |
| **Track A — Attribution Required** | `agribalyse_31.parquet` | `2,451` | `Etalab Open Licence v2.0` | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with ADEME/INRAE credit |
| **Track A — Attribution Required** | `openfoodfacts_eu.parquet` | `3,197` | `ODbL 1.0` / `CC-BY-SA` | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with ODbL 1.0 notice |
| **Track A — Attribution Required** | `scrapling_retail_claims.parquet` | `1,355` | `ODbL 1.0` (Open Prices + OFF) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with ODbL 1.0 notice |
| **Track A — Attribution Required** | `global_poore_nemecek_lca.parquet` | `45` | `CC-BY 4.0` (OWID / Poore & Nemecek) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with OWID + *Science* 2018 credit |
| **Track A — Attribution Required** | `global_healthy_diet_affordability.parquet` | `1,399` | `CC-BY 4.0` (OWID / World Bank & FAO) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with OWID + WB/FAO credit |
| **Track A — Attribution Required** | `statistical_price_forecasts.parquet` | `560` | `CC-BY 4.0` (Eurostat) / `OGL v3.0` (ONS) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with Eurostat & UK ONS OGL v3 credit |
| **Track A — Attribution Required** | `nsi_subnational_quintiles.parquet` | `150` | `CC-BY 4.0` (INE Spain / Eurostat HBS/EHIS) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with Eurostat/INE credit + SVD model note |
| **Track A — Attribution Required** | `crosswalk_rosetta.parquet` | `15` | `CC-BY 4.0` (derived over COICOP/FoodEx2/Agribalyse) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with taxonomy credits |
| **Track A — Attribution Required** | `classification_mappings.parquet` | `161` | `CC-BY 4.0 / ODbL 1.0` | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with ODbL + taxonomy credits |
| **Track A — Attribution Required** | `efsa_foodex2_surveys.parquet` *(taxonomy + stylized scales)* | `1,080` | `CC-BY 4.0` (EFSA FoodEx2 ref + author multipliers) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with explicit `"v2.0-stylized"` caveat |
| **Track A — Attribution Required** | `school_meals_procurement.parquet` | `7` | `CC-BY 4.0` (GCNF / statutory legal acts) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with GCNF & statutory ministry credits |
| **Track A — Attribution Required** | `consumer_behavior_pulse.parquet` *(synthesized + Wikimedia)* | `8` | `CC-BY 4.0` / `CC-BY-SA` (Wikimedia pageviews) | **`VERIFIED — ATTRIBUTION REQUIRED`** | Include with explicit `"Estimated synthesis"` caveat |
| **Track B — Restricted / Non-Commercial** | `cultural_climate_inertia.parquet` *(ESS + TISP)* | `11` | **`CC BY-NC-SA 4.0`** (ESS ERIC; TISP `CC-BY 4.0`) | **`VERIFIED — REDISTRIBUTION RESTRICTED`** | **Remove `"CC-BY 4.0"` error; exclude from permissive MIT commercial data archive; restrict to non-commercial ESS Round-cited release only** |
| **Track B — Permission Required / Restricted** | `gi_terroir_registry.parquet` *(Qualigeo fraction)* | `6,845` | EUIPO Open + **Qualigeo Copyrighted** | **`VERIFIED — REDISTRIBUTION RESTRICTED`** / **`PERMISSION REQUIRED`** | **Exclude Qualigeo-derived fields/rows from public redistribution unless written Qualivita consent obtained, or rebuild cleanly from EUIPO GIview only** |
| **Track B — Permission Required** | `gs1_immagino_observatory.parquet` | `61` | GS1 Italy / NielsenIQ Copyright | **`PERMISSION REQUIRED`** | **Exclude from open downloadable data pack pending written GS1 Italy permission** |
| **Track B — Permission Required** | `pan_eu_retail_scanner.parquet` | `88` | Derived from GS1 Italy benchmarks + stylized | **`PERMISSION REQUIRED`** | **Exclude from open downloadable data pack pending GS1 clearance for `IT` baseline** |
| **Track B — Restricted / Permission Required** | `time_use_cooking_friction.parquet` | `60` | IPUMS MTUS non-commercial no-redistribution | **`VERIFIED — REDISTRIBUTION RESTRICTED`** / **`PERMISSION REQUIRED`** | **Exclude from open public data pack; replace with direct IPUMS extract citation links** |
| **Track B — Restricted / Do Not Redistribute** | `social_discourse_velocity.parquet` | `129` | YC HN Terms + Google News RSS + Publisher © | **`VERIFIED — REDISTRIBUTION RESTRICTED`** | **Exclude third-party headlines/URLs from public downloadable data releases** |
| **Track B — Unverified Geometry** | `public/data/world.geojson` | — | Unverified upstream shapefile / SHA | **`UNVERIFIED — DO NOT REDISTRIBUTE`** | **Replace with Natural Earth 110m Public Domain (`world-atlas`) before public data pack** |
| **Track B — Undocumented Baselines** | `COUNTRY_PROFILES` (`src/types/research.ts`) | `25` | Author TypeScript constants (missing upstream citations) | **`UNVERIFIED — DO NOT REDISTRIBUTE`** *(as empirical table)* | Retain only as MIT UI reference defaults until WP5 sources are audited & cited |

### 3.2 Mandatory Local vs. Public Release Rule
- Under Phase 6B constraints (**do not modify production datasets** during remediation), all `19` `.parquet` and JSON files remain intact in the working tree so existing QA parity checks continue verifying the app unchanged.
- Before building any public Zenodo / PyPI / HuggingFace / GitHub Release **dataset archive** (`v1.0.0`), the maintainer **must publish Track A only** (`13` verified open/attribution Parquet tables) and withhold Track B artifacts until written permissions (`Qualivita`, `GS1 Italy`, `IPUMS/CTUR`), non-commercial `CC BY-NC-SA 4.0` packaging (`ESS`), clean `EUIPO-only` rebuild, and Natural Earth `world.geojson` replacement are completed.
