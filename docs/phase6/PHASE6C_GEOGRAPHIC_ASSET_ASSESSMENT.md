# DietShift Atlas — Phase 6C Geographic Asset Replacement Assessment (WP2)

**Assessment Date:** 2026-11-17  
**Generator Script:** [`scripts/prepare_natural_earth_geojson.py`](../../scripts/prepare_natural_earth_geojson.py)  
**Verification Artifact:** [`release/geo/NATURAL_EARTH_PROVENANCE.json`](../../release/geo/NATURAL_EARTH_PROVENANCE.json)  
**Staged Candidate Replacement:** [`release/geo/world.naturalearth.110m.compatible.geojson`](../../release/geo/world.naturalearth.110m.compatible.geojson)  
**Production File Status:** `public/data/world.geojson` was **intentionally left unchanged** in the production tree per WP2 constraints until final release swap approval.

---

## 1. Existing Asset Inspection & Usage Audit

- **Existing Asset:** `public/data/world.geojson` (`275,429` bytes, `177` GeoJSON `Feature` polygons).
- **Upstream Fetch Origin ([`scripts/build_parquet_and_geojson.py`](../../scripts/build_parquet_and_geojson.py)):** Pulled from unpinned raw GitHub branches (`holtzy/D3-graph-gallery` [MIT wrapper] / `johan/world.geo.json` [`UNLICENSE` wrapper whose author explicitly warns upstream border provenance is *"dubious"*]), with no commit SHA or license logged in `provenance_manifest.json`.
- **Application Consumers:**
  1. [`src/components/InteractiveChoroplethMap.tsx`](../../src/components/InteractiveChoroplethMap.tsx) (`Sections I` & `IV`): fetches `data/world.geojson`, registers `echarts.registerMap('world_dietshift', geoJson)` (matching polygons by **`feature.properties.name`**), renders choropleth series via `COUNTRY_PROFILES[code].geoJsonName` and World Bank/FAO `cohdByGeoName[geojson_name]`, and maps click selections back to `COUNTRY_PROFILES` via `nameToCodeMap`.
  2. [`scripts/build_international_benchmarks.py`](../../scripts/build_international_benchmarks.py): maps `global_healthy_diet_affordability.parquet` ISO3 codes to `world.geojson` polygon names (`151/177` mainland polygons; 26 island micro-states/HK/MO/USA-alias remain non-polygons at 110m scale).

---

## 2. Proposed Public Domain Replacement & Compatibility Evaluation

- **Proposed Replacement:** Official **Natural Earth `v5.1.1` Admin 0 Countries (1:110m)** (`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.1/geojson/ne_110m_admin_0_countries.geojson`).
- **License & Legal Certainty:** Explicit **Public Domain** declaration (`LICENSE.md`: *"Everything here is public domain... You may use the maps in any manner, including modifying the content and design, electronic dissemination, and offset printing"*, raw GeoJSON `838,726` bytes, SHA-256 `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`).
- **Why Unmodified Raw Natural Earth Cannot Be Dropped In Directly:**
  Raw Natural Earth uses uppercase `properties.NAME` (not lowercase `properties.name` expected by ECharts default `registerMap`) and uses updated sovereign names (`United Kingdom`, `United States of America`, `Czechia`, `Bosnia and Herz.`, `eSwatini`, etc.) instead of `COUNTRY_PROFILES.geoJsonName` (`England`, `USA`, `Czech Republic`) and `world.geojson` legacy spellings.
- **Controlled Compatibility Transformation Applied (`prepare_natural_earth_geojson.py`):**
  Applying a documented `24`-entry property-alias mapping (`NE_TO_APP_NAME_MAP`, permitted explicitly under Natural Earth's Public Domain license) while keeping raw geometries and `ne_name` / `iso_a3` / `adm0_a3` metadata yields [`release/geo/world.naturalearth.110m.compatible.geojson`](../../release/geo/world.naturalearth.110m.compatible.geojson):

| Verification Metric | Legacy `public/data/world.geojson` | Staged Natural Earth `v5.1.1` Candidate | Result |
| :--- | :---: | :---: | :---: |
| **File Size** | `275,429 B` | **`266,815 B`** (`-3.1%`) | **Compact** |
| **Feature Polygon Count** | `177` | **`177`** | **Exact Parity** |
| **Invalid / Null Geometries** | `0` | **`0`** | **Valid** |
| **Legacy Feature Names Covered** | `177 / 177` | **`177 / 177`** (`0` missing) | **100% Parity** |
| **`COUNTRY_PROFILES` Polygons Matched** | `24 / 25` (`European Union` N/A) | **`24 / 25`** (`European Union` N/A) | **100% Parity** |
| **`global_benchmarks.json` CoHD Matches** | `151 / 177` | **`151 / 177`** | **100% Parity** |
| **Live Browser ECharts Map Load (WP5)** | Tracked separately | Loaded in Sections `I` & `IV` (`0` JS/map errors) | **Verified** |

---

## 3. Recommendation

- **Safe for Production Replacement Upon Release Sign-Off:** In Track A isolated releases, [`build_release_manifest.py`](../../scripts/build_release_manifest.py) already maps `release/geo/world.naturalearth.110m.compatible.geojson` into `data/world.geojson`. Copying it over `public/data/world.geojson` and updating `scripts/build_parquet_and_geojson.py` cleanly closes the `world.geojson` provenance gap in a final release commit.
