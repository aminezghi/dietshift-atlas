# DietShift Atlas — Phase 6C Release Archive Architecture & Exclusion Policy (WP1)

**Release Candidate:** `1.0.0-rc.1` (`v5.2.0-phase5c` analytical baseline)  
**Authoritative Manifest Generator:** [`scripts/build_release_manifest.py`](../../scripts/build_release_manifest.py)  
**Generated Manifest & Notices:** [`release/RELEASE_MANIFEST.json`](../../release/RELEASE_MANIFEST.json) · [`release/ATTRIBUTION_AND_DATA_NOTICES.md`](../../release/ATTRIBUTION_AND_DATA_NOTICES.md)

---

## 1. Three-Zone Release Packaging Structure

An unrestricted public software + open-data archive for DietShift Atlas cleanly separates **Source & Docs (MIT)**, **Track A Open Data**, and **Track B Restricted/Unverified Exclusions**:

- **Software Source, Tests, Build Scripts & Docs:** `134` files (`MIT`)
```text
dietshift-atlas-1.0.0-rc.1/
├── [Zone 1: Software Source, Tests, Build Scripts & Documentation — MIT (134 files)]
│   ├── src/                        # React 19 UI + pure TypeScript analytical engines
│   ├── public/*.html, icons        # Public guides, floorplan, icons (zero restricted data)
│   ├── scripts/                    # Ingestion, QA gate, Natural Earth prep & release packager
│   ├── tests/                      # Pytest Parquet/JSON parity & Playwright Chromium E2E
│   ├── docs/                       # Phase 6A/6B/6C governance, methodology, guide & limitations
│   ├── LICENSE, CITATION.cff, README.md, package.json, requirements*.txt
│   └── [Excluded Pending Approval] paper/ (blocked by B-01 manuscript revision sign-off)
│
├── [Zone 2: Track A — Open or Attribution-Compatible Data Assets (33 files, 9,976,923 B)]
│   ├── public/data/parquet/        # 13 Open/Attribution ZSTD Parquet tables
│   ├── public/data/*.json          # 19 Verified Track A JSON tables & metadata catalogs
│   └── public/data/world.geojson   <- Replaced cleanly by Public Domain Natural Earth v5.1.1
│                                      (release/geo/world.naturalearth.110m.compatible.geojson)
│
└── [EXCLUDED FROM PUBLIC ARCHIVES: Track B Assets (14 data files, 13,747,912 B)]
    ├── 6 Restricted/Permission-Required Parquets
    ├── 7 Restricted/Composite JSON Bundles (incl. consumer_behavior_pulse.json & empirical_microdata_bundle.json)
    └── Legacy public/data/world.geojson (unpinned origin & dubious boundary provenance)
```

---

## 2. Track A Inclusion Ledger (`33` Verified Data Assets)

### 2.1 Open / Attribution Parquet Tables (`13/19`)
`agribalyse_31.parquet` (`Etalab 2.0`), `classification_mappings.parquet` (`CC-BY 4.0 / ODbL 1.0`), `clinical_biomarker_grounding.parquet` (`US Gov Public Domain` — mixed WTDRD1/proxy disclosure), `crosswalk_rosetta.parquet` (`CC-BY 4.0`), `efsa_foodex2_surveys.parquet` (`CC-BY 4.0` taxonomy ref), `global_healthy_diet_affordability.parquet` (`CC-BY 4.0`), `global_poore_nemecek_lca.parquet` (`CC-BY 4.0`), `nsi_subnational_quintiles.parquet` (`CC-BY 4.0`), `openfoodfacts_eu.parquet` (`ODbL 1.0 / CC-BY-SA`), `school_meals_procurement.parquet` (`CC-BY 4.0`), `scrapling_retail_claims.parquet` (`ODbL 1.0`), `statistical_price_forecasts.parquet` (`CC-BY 4.0 / OGL v3.0`), `consumer_behavior_pulse.parquet` (`CC-BY 4.0 / CC-BY-SA` synthesis rows only).

### 2.2 Open / Attribution JSON Mirrors & Replacement Cartography (`20` files)
- Clean 1:1 Track A JSON datasets & metadata catalogs: `agribalyse_full.json`, `classification_mappings.json`, `clinical_biomarker_grounding.json`, **`consumer_pulse_rows.json` (`8` synthesis rows only — free of embedded Track B records!)**, `crosswalk_rosetta.json`, `datasets_registry.json`, `econometric_calibration.json`, `efsa_foodex2.json`, `forecast_validation_summary.json`, `global_benchmarks.json`, `live_research_bundle.json`, `nsi_rows_only.json`, `nsi_subnational_quintiles.json`, `off_expanded_rows.json`, `off_full.json`, `provenance_manifest.json`, `school_meals_procurement.json`, `scrapling_retail_claims.json`, `statistical_price_forecasts.json`.
- Pinned Natural Earth `v5.1.1` replacement geometry mapped to `public/data/world.geojson` (`release/geo/world.naturalearth.110m.compatible.geojson`, **Public Domain**).

---

## 3. Track B Exclusion Ledger (`14` Data Assets + `5` Manuscript Files)

| File Category | Exact Excluded Paths | Why Excluded From Public / Unrestricted Releases |
| :--- | :--- | :--- |
| **GI Terroir (Qualigeo mixed)** | `public/data/parquet/gi_terroir_registry.parquet`, `public/data/gi_terroir_bundle.json` | Embeds copyrighted Fondazione Qualivita (`qualigeo.eu`) texts/URLs/slugs prohibiting redistribution without written permission. |
| **GS1 Immagino & Pan-EU** | `public/data/parquet/gs1_immagino_observatory.parquet`, `public/data/gs1_immagino_bundle.json`, `public/data/parquet/pan_eu_retail_scanner.parquet`, `public/data/pan_eu_retail_bundle.json` | Copyrighted GS1 Italy *Osservatorio Immagino* summaries (`PERMISSION REQUIRED`; underlying NielsenIQ microdata proprietary). |
| **MTUS / IPUMS Time Use** | `public/data/parquet/time_use_cooking_friction.parquet`, `public/data/time_use_cooking_friction.json` | IPUMS MTUS forbids third-party data redistribution and non-scholarly extract sharing (`VERIFIED — REDISTRIBUTION RESTRICTED`). |
| **ESS (`CC BY-NC-SA 4.0`)** | `public/data/parquet/cultural_climate_inertia.parquet`, `public/data/cultural_climate_inertia.json` | ESS data carries **`CC BY-NC-SA 4.0`** Non-Commercial ShareAlike clause (conflicts with permissive MIT/CC-BY redistribution). |
| **HN Algolia & Google News RSS** | `public/data/parquet/social_discourse_velocity.parquet` | Y Combinator anti-scraping/non-commercial TOS + Google News RSS personal-use restriction + publisher copyrights. |
| **Mixed Composite Bundles Embedding Track B** | `public/data/consumer_behavior_pulse.json` (`6.49 MB`), `public/data/empirical_microdata_bundle.json` (`53.4 KB`) | **`consumer_behavior_pulse.json`** embeds `6,845` `gi_terroir_records` (Qualigeo) and `129` `social_discourse_posts` (HN/RSS); **`empirical_microdata_bundle.json`** embeds `time_use` (`60` MTUS rows) and `cultural_climate` (`11` ESS rows). Both are **excluded completely** to prevent Track B leakage. |
| **Unverified Map Polygons** | `public/data/world.geojson` | Unpinned commit/SHA and upstream shapefile caveats (`UNVERIFIED — DO NOT REDISTRIBUTE`; replaced in Track A by Natural Earth `v5.1.1`). |
| **Manuscripts (`paper/*`)** | `paper/DIETSHIFT_ATLAS_ACADEMIC_PAPER.{md,html,docx}`, `paper/main.tex`, `paper/references.bib` | Excluded from `v1.0.0-rc.1` distribution package until author resolves B-01 retracted claims ([`PHASE6B_MANUSCRIPT_REMEDIATION.md`](PHASE6B_MANUSCRIPT_REMEDIATION.md)). |

---

## 4. Reproducible Packaging Commands

```bash
# 1. Regenerate SHA-256 compatible Natural Earth GeoJSON candidate
python scripts/prepare_natural_earth_geojson.py

# 2. Regenerate release/RELEASE_MANIFEST.json and release/ATTRIBUTION_AND_DATA_NOTICES.md
python scripts/build_release_manifest.py

# 3. Build production Vite app & materialize isolated Track A release staging in dist-release/
npm run build
python scripts/build_release_manifest.py --stage-track-a
```
