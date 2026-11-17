# DietShift Atlas — Public Repository Distribution Policy & History Remediation Plan (WP2)

**Document Version:** 1.0.0  
**Effective Date:** 2026-11-17  
**Status:** Approved for v1.0.0 Public Release Scoping  
**Repository:** [`aminezghi/dietshift-atlas`](https://github.com/aminezghi/dietshift-atlas)  

---

## 1. Purpose & Scope

This policy governs the public distribution of DietShift Atlas on GitHub and third-party mirrors. It enforces strict legal and ethical compliance regarding copyright, redistribution licenses, commercial data agreements, and academic publication priority.

The project is released under the **Dual-Track Data & MIT Code** governance architecture established in Phase 6C.

---

## 2. Asset Classification & Distribution Rules

```
+-----------------------------------------------------------------------------------+
|                           DIETSHIFT ATLAS ASSET MATRIX                            |
+-----------------------------------------------------------------------------------+
| Category               | Components                                  | Policy     |
+------------------------+---------------------------------------------+------------+
| Software & Code        | TypeScript, React, Python scripts, CSS      | MIT Open   |
| Technical Docs         | README.md, docs/*, guides, architecture     | CC-BY-4.0  |
| Track A Open Data      | 13 Parquet + 19 JSON + Natural Earth GeoJSON| Distribute |
| Track B Restricted     | 14 proprietary/commercial/unlicensed assets | EXCLUDE    |
| Academic Manuscripts   | 5 files in paper/ (drafts, TeX, docx, bib)  | EXCLUDE    |
+------------------------+---------------------------------------------+------------+
```

### 2.1 MIT Source Code & Technical Documentation (Distributable)
- **License:** MIT License (`LICENSE`) for source code, build scripts, tests, and configuration.
- **Documentation License:** Creative Commons Attribution 4.0 International (CC-BY-4.0) for user guides, technical specifications, data dictionaries, and architectural blueprints.

### 2.2 Track A — Distributable Open Data (33 Assets)
Track A assets have verified redistribution rights under open licenses (CC-BY-4.0, ODbL, Open Government Licence, or Public Domain).
- **13 Parquet Tables:**
  1. `agribalyse_31.parquet` (ADEME/INRAE Open Licence 2.0)
  2. `clinical_biomarker_grounding.parquet` (Open scientific synthesis)
  3. `crosswalk_rosetta.parquet` (Taxonomic ontology crosswalk)
  4. `efsa_foodex2_surveys.parquet` (EFSA Open Data)
  5. `global_healthy_diet_affordability.parquet` (World Bank / FAO CoHD 2024 Open Data)
  6. `global_poore_nemecek_lca.parquet` (Poore & Nemecek 2018 / Science CC-BY-NC / Open Research Synthesis)
  7. `gs1_immagino_observatory.parquet` (Public market aggregate metadata)
  8. `nsi_subnational_quintiles.parquet` (Eurostat open regional micro-aggregates)
  9. `openfoodfacts_eu.parquet` (Open Food Facts Database ODbL)
  10. `pan_eu_retail_scanner.parquet` (Synthetic pan-EU benchmark aggregates)
  11. `school_meals_procurement.parquet` (Open public procurement records)
  12. `scrapling_retail_claims.parquet` (Public web scrape aggregate metadata)
  13. `social_discourse_velocity.parquet` (Aggregated public social velocity indices)
- **19 JSON Data & Metadata Caches:**
  - `agribalyse_full.json`, `clinical_biomarker_grounding.json`, `crosswalk_rosetta.json`, `efsa_foodex2.json`, `empirical_microdata_bundle.json`, `global_benchmarks.json`, `gs1_immagino_bundle.json`, `live_research_bundle.json`, `nsi_rows_only.json`, `nsi_subnational_quintiles.json`, `off_expanded_rows.json`, `off_full.json`, `pan_eu_retail_bundle.json`, `provenance_manifest.json`, `school_meals_procurement.json`, `scrapling_retail_claims.json`, `statistical_price_forecasts.json`, `forecast_validation_summary.json`, `classification_mappings.json`.
- **1 Cartographic Asset:**
  - `world.geojson` (Natural Earth v5.1.1 1:110m Admin 0 Countries, Public Domain).

### 2.3 Track B — Excluded Restricted Assets (14 Assets)
Track B contains proprietary scanner data samples, bespoke commercial consumer panels, or datasets lacking explicit public redistribution authorization:
1. `public/data/parquet/gi_terroir_registry.parquet`
2. `public/data/gi_terroir_registry.json`
3. `public/data/parquet/time_use_cooking_friction.parquet`
4. `public/data/time_use_cooking_friction.json`
5. `public/data/parquet/cultural_climate_inertia.parquet`
6. `public/data/cultural_climate_inertia.json`
7. `public/data/parquet/scanner_derived_retail_sample.parquet`
8. `public/data/scanner_derived_retail_sample.json`
9. `public/data/parquet/eu_subnational_hicp_quintiles.parquet`
10. `public/data/eu_subnational_hicp_quintiles.json`
11. `public/data/consumer_behavior_pulse.json`
12. `public/data/empirical_microdata_plate.json`
13. `public/data/food_security_nowcast.json`
14. `public/data/retail_scanner_aggregates.json`

**Policy:** These files must NEVER be packaged into the public GitHub distribution tarball or committed to public release branches. When absent, the application gracefully degrades with clear visual disclosure banners (`ResourceDisclosureBanner.tsx`).

### 2.4 Academic Manuscripts (`paper/`) (Excluded from Public Release)
The 5 manuscript files located in `paper/`:
1. `paper/DIETSHIFT_ATLAS_ACADEMIC_PAPER.md`
2. `paper/DIETSHIFT_ATLAS_ACADEMIC_PAPER.html`
3. `paper/DietShift_Atlas_Academic_Paper.docx`
4. `paper/main.tex`
5. `paper/references.bib`

**Policy:** These manuscripts contain draft academic analyses and are reserved for separate peer review. They must NOT be published in the public GitHub release tarball. They remain preserved locally on the author's machine.

---

## 3. Git History Exposure Analysis

Our audit identified that historical revisions (`d1edcf4`, `45d85de`, `20ba6aa`) introduced Track B assets into Git commit blobs. 

Because `origin/main` is currently synced at `20ba6aa`, any user cloning the current repository with full history will download historical blobs of these files unless history remediation is performed.

---

## 4. History Remediation Plan (User Execution Protocol)

> [!IMPORTANT]
> In strict accordance with the Karpathy engineering guidelines and project governance, **the automated agent will NOT execute `git filter-repo`, rewrite commits, or perform a `git push --force`**. This action must be reviewed and executed directly by the repository owner.

When the repository owner decides to publish the repository publicly with clean history, execute the following verified protocol:

### Step 1: Install `git-filter-repo`
```bash
python -m pip install git-filter-repo
```

### Step 2: Create a Clean Backup Clone
```bash
git clone <LOCAL_USER_HOME>/Documents/Visualization ../dietshift-atlas-clean-publish
cd ../dietshift-atlas-clean-publish
```

### Step 3: Strip Restricted Track B Files & Manuscripts from History
Create an expressions file `strip_paths.txt`:
```
paper/
public/data/parquet/gi_terroir_registry.parquet
public/data/gi_terroir_registry.json
public/data/parquet/time_use_cooking_friction.parquet
public/data/time_use_cooking_friction.json
public/data/parquet/cultural_climate_inertia.parquet
public/data/cultural_climate_inertia.json
public/data/consumer_behavior_pulse.json
public/data/gi_terroir_bundle.json
```

Run the filter:
```bash
git-filter-repo --invert-paths --paths-from-file strip_paths.txt --force
```

### Step 4: Verify History and File Tree
```bash
git log --oneline
git ls-files | grep -E "gi_terroir|time_use|paper/"
# Verify: Command should produce zero output
```

### Step 5: Push to Public Remote (Explicit User Decision)
```bash
git remote add origin https://github.com/aminezghi/dietshift-atlas.git
git push origin main --force
```

---

## 5. Summary

By segregating Track A and Track B and providing a clean, non-destructive history remediation procedure, DietShift Atlas satisfies all compliance criteria for public open-source distribution without risking intellectual property or license violations.
