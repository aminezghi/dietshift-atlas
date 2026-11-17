"""
build_data_infrastructure.py
============================
Central Data Infrastructure, Metadata Registry, Version Diffing, and Automated Validation
for DietShift Atlas.

Produces:
- public/data/datasets_registry.json  (complete catalog: tiers, data_nature, update_policy,
  sources, licenses, schema + per-column missingness, duplicates, referential integrity,
  domain checks, freshness, and version diff against previous manifest)
- public/data/provenance_manifest.json (synchronized SHA-256 hashes & row/column counts
  for all 19 Parquet tables and raw cache artifacts)
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import duckdb
import pyarrow.parquet as pq

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "public" / "data"
PARQUET_DIR = DATA_DIR / "parquet"
RAW_CACHE_DIR = BASE_DIR / "scripts" / ".raw_cache"
REGISTRY_PATH = DATA_DIR / "datasets_registry.json"
MANIFEST_PATH = DATA_DIR / "provenance_manifest.json"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


DATASET_SPECS: dict[str, dict[str, Any]] = {
    "agribalyse_31.parquet": {
        "id": "agribalyse_31",
        "name": "ADEME Agribalyse 3.1.1 Life-Cycle Assessment",
        "view_name": "agribalyse",
        "tier": "processed",
        "data_nature": "Model Output",
        "update_policy": "auto_api",
        "update_cadence": "On release via ADEME Data-Fair API",
        "source_name": "ADEME / INRAE Agribalyse 3.1.1",
        "source_urls": ["https://data.ademe.fr/datasets/agribalyse-31-synthese"],
        "license": "Licence Ouverte / Open Licence v2.0 (Etalab)",
        "retrieved_at": "2026-11-08",
        "version": "3.1.1",
        "geographic_coverage": "France / EU LCA reference",
        "temporal_coverage": "2022–2024 (v3.1.1)",
        "primary_key": ["Code_AGB"],
        "limitations": "French agricultural & retail mix; PEF single score & water deprivation (AWARE m³ world eq).",
    },
    "openfoodfacts_eu.parquet": {
        "id": "openfoodfacts_eu",
        "name": "Open Food Facts EU Product Catalog",
        "view_name": "openfoodfacts",
        "tier": "processed",
        "data_nature": "Observed",
        "update_policy": "auto_api",
        "update_cadence": "Repeatable via scripts/refresh_off_clean.py",
        "source_name": "Open Food Facts Search-a-licious API",
        "source_urls": ["https://search.openfoodfacts.org/"],
        "license": "ODbL 1.0 (Database) / CC-BY-SA",
        "retrieved_at": "2026-11-16",
        "version": "2026-11-16",
        "geographic_coverage": "Multi-country EU & global",
        "temporal_coverage": "Live snapshot (2026-11)",
        "primary_key": ["code"],
        "limitations": "Crowd-sourced nutrition labels; missing Eco-Score, NOVA, or nutrients are preserved as NULL.",
    },
    "scrapling_retail_claims.parquet": {
        "id": "scrapling_retail_claims",
        "name": "Open Prices EU Retail Shelf Receipts & OFF Nutrition",
        "view_name": "scrapling_retail_claims",
        "tier": "harmonized",
        "data_nature": "Observed",
        "update_policy": "auto_api",
        "update_cadence": "Repeatable via scripts/harvest_raw_prices_scrapling.py",
        "source_name": "Open Food Facts Open Prices API + Open Food Facts",
        "source_urls": ["https://prices.openfoodfacts.org/api/v1/prices"],
        "license": "ODbL 1.0",
        "retrieved_at": "2026-11-16",
        "version": "2026-11-16",
        "geographic_coverage": "EU member states (FR, DE, IT, BE, AT, GR, NL, ES, PT)",
        "temporal_coverage": "2024–2026 receipts",
        "primary_key": ["barcode", "country_code", "retailer"],
        "limitations": "Phenomenon tags are keyword-classified; SKUs without matching OFF records have NULL nutrition.",
    },
    "global_poore_nemecek_lca.parquet": {
        "id": "global_poore_nemecek_lca",
        "name": "Poore & Nemecek (2018) Global Supply-Chain LCA",
        "view_name": "global_poore_nemecek_lca",
        "tier": "processed",
        "data_nature": "Estimated",
        "update_policy": "static_reference",
        "update_cadence": "Static published meta-analysis (38,700 farms / 119 countries)",
        "source_name": "Poore & Nemecek (Science 2018) via Our World in Data",
        "source_urls": ["https://ourworldindata.org/environmental-impacts-of-food"],
        "license": "CC-BY 4.0",
        "retrieved_at": "2026-11-13",
        "version": "2018 (OWID v1)",
        "geographic_coverage": "Global (119 countries)",
        "temporal_coverage": "2018 meta-analysis",
        "primary_key": ["food_item"],
        "limitations": "Harmonized global meta-analysis (45 major commodity groups across 38,700 farms / 119 countries) classified as Estimated; missing protein & environmental fields preserved as NULL.",
    },
    "global_healthy_diet_affordability.parquet": {
        "id": "global_healthy_diet_affordability",
        "name": "World Bank & FAO Cost & Affordability of a Healthy Diet",
        "view_name": "global_healthy_diet_affordability",
        "tier": "processed",
        "data_nature": "Observed",
        "update_policy": "auto_api",
        "update_cadence": "Annual via Our World in Data / World Bank API",
        "source_name": "World Bank & FAO Food Prices for Nutrition",
        "source_urls": ["https://ourworldindata.org/diet-affordability"],
        "license": "CC-BY 4.0",
        "retrieved_at": "2026-11-13",
        "version": "2017–2024",
        "geographic_coverage": "Global (177+ ISO3 territories)",
        "temporal_coverage": "2017–2024",
        "primary_key": ["iso3", "year"],
        "limitations": "Cost expressed in ICP PPP USD/person/day; unaffordability shares unavailable for some years/economies.",
    },
    "clinical_biomarker_grounding.parquet": {
        "id": "clinical_biomarker_grounding",
        "name": "CDC NHANES 2021–2023 Clinical Biomarker Quintiles",
        "view_name": "clinical_biomarker_grounding",
        "tier": "analytical",
        "data_nature": "Estimated",
        "update_policy": "auto_api",
        "update_cadence": "Biennial CDC NHANES .XPT release",
        "source_name": "CDC / NCHS NHANES 2021–2023 (WTDRD1 survey-weighted)",
        "source_urls": ["https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?Cycle=2021-2023"],
        "license": "Public Domain (US Government)",
        "retrieved_at": "2026-11-13",
        "version": "2021-2023",
        "geographic_coverage": "United States (adult respondents >=20y, n=4,262)",
        "temporal_coverage": "2021–2023",
        "primary_key": ["pattern_id"],
        "limitations": "Mixed empirical & proxy table: Total-C, HDL-C, Non-HDL-C, hs-CRP & SBP are WTDRD1-weighted NHANES 2021-2023 empirical quintile means, whereas LDL (0.82*Non-HDL), TG (0.72*Non-HDL), fasting glucose (96.0), HbA1c (5.5%), BMI (28.4), and CVD risk delta are derived proxies/constants; US-to-EU domain transfer caveat applies.",
    },
    "social_discourse_velocity.parquet": {
        "id": "social_discourse_velocity",
        "name": "Digital Food-System Discourse Velocity",
        "view_name": "social_discourse_velocity",
        "tier": "processed",
        "data_nature": "Observed",
        "update_policy": "auto_api",
        "update_cadence": "Repeatable via HN Algolia & RSS APIs",
        "source_name": "Hacker News Algolia API & Google News RSS",
        "source_urls": ["https://hn.algolia.com/api"],
        "license": "Public API metadata",
        "retrieved_at": "2026-11-09",
        "version": "2026-11-09",
        "geographic_coverage": "Global English / EU policy feeds",
        "temporal_coverage": "2016–2026",
        "primary_key": ["post_id"],
        "limitations": "Platform skew toward tech/policy audiences; engagement_velocity is a derived composite index.",
    },
    "gi_terroir_registry.parquet": {
        "id": "gi_terroir_registry",
        "name": "EUIPO GIview & Qualigeo Geographical Indications Registry",
        "view_name": "gi_terroir_registry",
        "tier": "harmonized",
        "data_nature": "Estimated",
        "update_policy": "auto_api",
        "update_cadence": "Repeatable via EUIPO GIview & Qualivita endpoints",
        "source_name": "EUIPO GIview Union Register + Fondazione Qualivita Qualigeo",
        "source_urls": ["https://www.tmdn.org/giview/", "https://www.qualigeo.eu/"],
        "license": "EU Open Data / Public Registry",
        "retrieved_at": "2026-11-09",
        "version": "2026-11-09",
        "geographic_coverage": "EU-27 + 55 international GI origin countries",
        "temporal_coverage": "1996–2026 registrations",
        "primary_key": ["gi_id"],
        "limitations": "Official GI identities & locations are Observed, but product-level CO2, water, land, NOVA & price premium are Estimated class proxies.",
    },
    "crosswalk_rosetta.parquet": {
        "id": "crosswalk_rosetta",
        "name": "Rosetta Stone Crosswalk (COICOP × FoodEx2 × Agribalyse)",
        "view_name": "crosswalk_rosetta",
        "tier": "harmonized",
        "data_nature": "Manually Compiled",
        "update_policy": "manual",
        "update_cadence": "Curated taxonomy concordance releases",
        "source_name": "Eurostat COICOP × EFSA FoodEx2 × ADEME Agribalyse 3.1.1",
        "source_urls": ["https://data.ademe.fr/datasets/agribalyse-31-synthese"],
        "license": "CC-BY 4.0",
        "retrieved_at": "2026-11-16",
        "version": "2.0.0",
        "geographic_coverage": "European Union",
        "temporal_coverage": "Reference classification v2.0.0",
        "primary_key": ["crosswalk_id"],
        "limitations": "15 canonical expenditure-to-LCA bridges; many-to-many aggregation introduces proxy uncertainty captured in mapping_type & confidence.",
    },
    "classification_mappings.parquet": {
        "id": "classification_mappings",
        "name": "Multi-Taxonomy Harmonisation Concordance (FoodEx2 × Agribalyse × OFF × COICOP)",
        "view_name": "classification_mappings",
        "tier": "harmonized",
        "data_nature": "Manually Compiled",
        "update_policy": "manual",
        "update_cadence": "Versioned on taxonomy / subgroup updates (build_classification_mappings.py)",
        "source_name": "ADEME Agribalyse 3.1.1 × EFSA FoodEx2 × Open Food Facts × Eurostat COICOP 2018",
        "source_urls": [
            "https://data.ademe.fr/datasets/agribalyse-31-synthese",
            "https://www.efsa.europa.eu/en/data/data-standardisation",
        ],
        "license": "CC-BY 4.0 / ODbL 1.0",
        "retrieved_at": "2026-11-16",
        "version": "3.0.0-phase3a",
        "geographic_coverage": "European Union",
        "temporal_coverage": "Phase 3A v3.0.0",
        "primary_key": ["mapping_id"],
        "limitations": "Rule-curated semantic concordance separating exact, hierarchical, approximate, ambiguous, and unmatched gaps with qualitative confidence tiers rather than fabricated probabilities.",
    },
    "statistical_price_forecasts.parquet": {
        "id": "statistical_price_forecasts",
        "name": "Eurostat/ONS HICP Statistical Backtests & Projections",
        "view_name": "statistical_price_forecasts",
        "tier": "forecast",
        "data_nature": "Forecast",
        "update_policy": "auto_api",
        "update_cadence": "Re-computed on Eurostat prc_hicp_aind updates",
        "source_name": "Eurostat prc_hicp_aind & ONS MM23 (Damped ETS / Holt ETS / Ridge / Drift)",
        "source_urls": ["https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_aind/default/table"],
        "license": "CC-BY 4.0 (Eurostat) / OGL v3 (ONS)",
        "retrieved_at": "2026-11-16",
        "version": "4.0.0-leakfree",
        "geographic_coverage": "ES, IT, NL, FR, DE, GBR, EU27_2020",
        "temporal_coverage": "2015–2025 observed, 2023–2025 out-of-sample validation, 2026–2030 forecast",
        "primary_key": ["country_code", "indicator_name", "year"],
        "limitations": "Annual sample (n=11 obs, 2015–2025); structural inflation shocks limit multi-year extrapolation. Statistical baselines only (no TimesFM inference).",
    },
    "nsi_subnational_quintiles.parquet": {
        "id": "nsi_subnational_quintiles",
        "name": "NSI Sub-National & Income Quintile Dietary Equity Model",
        "view_name": "nsi_subnational_quintiles",
        "tier": "analytical",
        "data_nature": "Model Output",
        "update_policy": "manual",
        "update_cadence": "Updated on HBS/EHIS survey waves + regional modeling",
        "source_name": "INE Spain, Eurostat HBS/EHIS/HICP + Modeled NUTS-2 Disaggregation",
        "source_urls": ["https://ec.europa.eu/eurostat/databrowser/view/hbs_str_t223/default/table"],
        "license": "CC-BY 4.0",
        "retrieved_at": "2026-11-16",
        "version": "3.2-svd",
        "geographic_coverage": "ES, IT, NL, FR, DE, GBR (30 regions × 5 quintiles)",
        "temporal_coverage": "2019–2025 reference waves",
        "primary_key": ["record_id"],
        "limitations": "National quintile HBS/EHIS anchors are Observed; NUTS-2 disaggregation, NOVA-4 share & carbon are Model Output estimates.",
    },
    "efsa_foodex2_surveys.parquet": {
        "id": "efsa_foodex2_surveys",
        "name": "Harmonized FoodEx2 Intake Matrix (Stylized Country/Age Profiles)",
        "view_name": "efsa_foodex2",
        "tier": "analytical",
        "data_nature": "Estimated",
        "update_policy": "manual",
        "update_cadence": "Manual update pending direct EFSA microdata ingestion",
        "source_name": "EFSA FoodEx2 Hierarchy + Country/Age Scaling Factors",
        "source_urls": ["https://www.efsa.europa.eu/en/data-report/food-consumption-data"],
        "license": "CC-BY 4.0 (Reference taxonomy)",
        "retrieved_at": "2026-11-08",
        "version": "2.0-stylized",
        "geographic_coverage": "24 countries × 3 age strata × 15 FoodEx2 categories",
        "temporal_coverage": "Stylized baseline",
        "primary_key": ["country_code", "population_group", "foodex2_code"],
        "limitations": "Derived from 15 template FoodEx2 rows scaled by country and age multipliers; not direct EFSA microdata records.",
    },
    "consumer_behavior_pulse.parquet": {
        "id": "consumer_behavior_pulse",
        "name": "European Intention-to-Plate Behavioral Cascade Synthesis",
        "view_name": "consumer_behavior_pulse",
        "tier": "analytical",
        "data_nature": "Estimated",
        "update_policy": "manual",
        "update_cadence": "Curated synthesis",
        "source_name": "Eurobarometer / BEUC / NSI / Wikimedia Synthesis",
        "source_urls": ["https://wikimedia.org/api/rest_v1/"],
        "license": "CC-BY 4.0",
        "retrieved_at": "2026-11-09",
        "version": "3.5",
        "geographic_coverage": "8 European countries (ES, IT, FR, DE, NL, GBR, SE, PL)",
        "temporal_coverage": "2019–2025 synthesis",
        "primary_key": ["country_code"],
        "limitations": "Country behavioral barrier percentages & elasticities are synthesized reference indicators rather than raw survey microdata.",
    },
    "gs1_immagino_observatory.parquet": {
        "id": "gs1_immagino_observatory",
        "name": "GS1 Italy Osservatorio Immagino 2026-1 Summary",
        "view_name": "gs1_immagino_observatory",
        "tier": "processed",
        "data_nature": "Manually Compiled",
        "update_policy": "manual",
        "update_cadence": "Annual GS1 Italy report publication",
        "source_name": "GS1 Italy Osservatorio Immagino (19th Edition, 2026-1)",
        "source_urls": ["https://osservatorioimmagino.it/"],
        "license": "Published report summary metrics (citation required)",
        "retrieved_at": "2026-11-08",
        "version": "19th Edition (2026-1)",
        "geographic_coverage": "Italy",
        "temporal_coverage": "2025–2026",
        "primary_key": ["section", "entity_key"],
        "limitations": "Aggregated summary statistics transcribed from GS1 Italy report; raw NielsenIQ/GS1 barcode microdata is proprietary.",
    },
    "pan_eu_retail_scanner.parquet": {
        "id": "pan_eu_retail_scanner",
        "name": "Pan-European Retail Scanner & Claims Harmonized Benchmark",
        "view_name": "pan_eu_retail_scanner",
        "tier": "analytical",
        "data_nature": "Estimated",
        "update_policy": "manual",
        "update_cadence": "Manual synthesis",
        "source_name": "GS1 Immagino Methodology Extrapolated Across 10 EU Markets + EU-27",
        "source_urls": ["https://osservatorioimmagino.it/"],
        "license": "Research benchmark compilation",
        "retrieved_at": "2026-11-08",
        "version": "3.5",
        "geographic_coverage": "IT, FR, DE, ES, NL, BE, PL, SE, AT, PT, EU27",
        "temporal_coverage": "2025–2026 benchmark",
        "primary_key": ["record_type", "country_code", "entity_name"],
        "limitations": "Non-IT country figures are stylized harmonized benchmarks modeled from retail market literature, not live scanner feeds.",
    },
    "time_use_cooking_friction.parquet": {
        "id": "time_use_cooking_friction",
        "name": "MTUS / ATUS Food Preparation & Culinary Time-Poverty Matrix",
        "view_name": "time_use_cooking_friction",
        "tier": "analytical",
        "data_nature": "Estimated",
        "update_policy": "credentials_required",
        "update_cadence": "Requires IPUMS/MTUS registration for microdata refresh",
        "source_name": "Multinational Time Use Study (MTUS) / IPUMS Time Use Reference",
        "source_urls": ["https://www.timeuse.org/mtus"],
        "license": "Academic registration required for raw microdata",
        "retrieved_at": "2026-11-09",
        "version": "1.0-stylized",
        "geographic_coverage": "11 European countries + EU-27 (5 quintiles each)",
        "temporal_coverage": "MTUS harmonized reference",
        "primary_key": ["record_id"],
        "limitations": "National baseline minutes scaled by quintile multipliers; not direct MTUS respondent microdata.",
    },
    "school_meals_procurement.parquet": {
        "id": "school_meals_procurement",
        "name": "GCNF Statutory School Meal Procurement Mandates",
        "view_name": "school_meals_procurement",
        "tier": "processed",
        "data_nature": "Manually Compiled",
        "update_policy": "manual",
        "update_cadence": "Updated on GCNF Global Survey cycles",
        "source_name": "Global Child Nutrition Foundation (GCNF) & National Ministries",
        "source_urls": ["https://gcnf.org/global-reports/"],
        "license": "CC-BY 4.0",
        "retrieved_at": "2026-11-09",
        "version": "2026",
        "geographic_coverage": "FR, IT, DE, ES, SE, UK, EU27",
        "temporal_coverage": "2024–2026 statutory frameworks",
        "primary_key": ["country_code"],
        "limitations": "7-row policy summary compiled from national legal frameworks (EGALIM, CAM, DGE) and GCNF survey benchmarks.",
    },
    "cultural_climate_inertia.parquet": {
        "id": "cultural_climate_inertia",
        "name": "ESS / TISP Climate Worry & Culinary Cultural Inertia",
        "view_name": "cultural_climate_inertia",
        "tier": "analytical",
        "data_nature": "Estimated",
        "update_policy": "manual",
        "update_cadence": "Updated on ESS / TISP dataset releases",
        "source_name": "European Social Survey (ESS) & TISP (Nature Sci Data 2024)",
        "source_urls": ["https://www.europeansocialsurvey.org/"],
        "license": "CC-BY 4.0",
        "retrieved_at": "2026-11-09",
        "version": "1.0",
        "geographic_coverage": "10 European countries + EU-27",
        "temporal_coverage": "2022–2024 waves",
        "primary_key": ["country_code"],
        "limitations": "Composite indices harmonizing ESS climate worry with culinary inertia indicators.",
    },
}


def validate_parquet_table(con: duckdb.DuckDBPyConnection, path: Path, spec: dict[str, Any]) -> dict[str, Any]:
    pf = pq.ParquetFile(path)
    n_rows = int(pf.metadata.num_rows)
    n_cols = int(pf.metadata.num_columns)
    rel_path = f"data/parquet/{path.name}"

    cols_info = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{path}')").fetchall()
    schema = []
    total_cells = n_rows * max(1, n_cols)
    total_nulls = 0

    for col_name, col_type, *_ in cols_info:
        q_col = f'"{col_name}"'
        null_cnt = int(
            con.execute(f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE {q_col} IS NULL").fetchone()[0]
        )
        total_nulls += null_cnt
        schema.append({
            "name": col_name,
            "type": col_type,
            "null_count": null_cnt,
            "null_pct": round((null_cnt / max(1, n_rows)) * 100.0, 2),
        })

    # Duplicate primary key check
    pk_cols = spec.get("primary_key", [])
    dup_count = 0
    if pk_cols:
        pk_expr = ", ".join(f'"{c}"' for c in pk_cols)
        distinct_pk = int(
            con.execute(f"SELECT COUNT(*) FROM (SELECT DISTINCT {pk_expr} FROM read_parquet('{path}'))").fetchone()[0]
        )
        dup_count = max(0, n_rows - distinct_pk)

    issues: list[dict[str, str]] = []
    if dup_count > 0:
        issues.append({"severity": "error", "message": f"{dup_count} duplicate key rows on ({', '.join(pk_cols)})"})

    # Table-specific domain & referential integrity checks
    if path.name == "scrapling_retail_claims.parquet":
        neg_price = int(con.execute(f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE price_eur <= 0 OR price_eur IS NULL").fetchone()[0])
        if neg_price > 0:
            issues.append({"severity": "error", "message": f"{neg_price} rows with non-positive or missing price_eur"})
        obs_zero = int(
            con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE nutrition_data_status = 'observed' AND energy_kcal IS NULL AND proteins_g IS NULL"
            ).fetchone()[0]
        )
        if obs_zero > 0:
            issues.append({"severity": "error", "message": f"{obs_zero} rows marked observed without energy or protein"})
        miss_nutr = int(con.execute(f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE nutrition_data_status = 'missing'").fetchone()[0])
        if miss_nutr > 0:
            issues.append({"severity": "info", "message": f"{miss_nutr} of {n_rows} SKUs lack OFF nutrition panels (preserved as NULL)"})

    elif path.name == "openfoodfacts_eu.parquet":
        imp_defaults = int(
            con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE proteins_100g = 6.5 AND energy_kcal_100g = 210 AND fiber_100g = 2.2 AND salt_100g = 0.65"
            ).fetchone()[0]
        )
        if imp_defaults > 0:
            issues.append({"severity": "error", "message": f"{imp_defaults} rows match legacy silent default imputation signature"})
        null_eco = int(con.execute(f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE ecoscore_score IS NULL").fetchone()[0])
        if null_eco > 0:
            issues.append({"severity": "info", "message": f"{null_eco} of {n_rows} products have NULL ecoscore_score (not imputed)"})

    elif path.name == "crosswalk_rosetta.parquet":
        agb_p = PARQUET_DIR / "agribalyse_31.parquet"
        efsa_p = PARQUET_DIR / "efsa_foodex2_surveys.parquet"
        broken_agb = int(
            con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{path}') c LEFT JOIN read_parquet('{agb_p}') a ON c.agb_code = a.Code_AGB WHERE a.Code_AGB IS NULL"
            ).fetchone()[0]
        )
        broken_efsa = int(
            con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{path}') c LEFT JOIN read_parquet('{efsa_p}') e ON c.foodex2_code = e.foodex2_code WHERE e.foodex2_code IS NULL"
            ).fetchone()[0]
        )
        if broken_agb > 0:
            issues.append({"severity": "error", "message": f"{broken_agb} broken agb_code references to agribalyse_31"})
        if broken_efsa > 0:
            issues.append({"severity": "error", "message": f"{broken_efsa} broken foodex2_code references to efsa_foodex2_surveys"})

    elif path.name == "classification_mappings.parquet":
        agb_p = PARQUET_DIR / "agribalyse_31.parquet"
        bad_unmatched = int(
            con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE mapping_type = 'unmatched' AND (target_code IS NOT NULL OR confidence_tier != 'unmatched')"
            ).fetchone()[0]
        )
        bad_matched = int(
            con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE mapping_type != 'unmatched' AND (target_code IS NULL OR confidence_tier = 'unmatched')"
            ).fetchone()[0]
        )
        broken_rep_agb = int(
            con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{path}') m LEFT JOIN read_parquet('{agb_p}') a ON m.representative_agb_code = a.Code_AGB WHERE m.representative_agb_code IS NOT NULL AND a.Code_AGB IS NULL"
            ).fetchone()[0]
        )
        if bad_unmatched > 0:
            issues.append({"severity": "error", "message": f"{bad_unmatched} unmatched mappings have non-null target or wrong confidence_tier"})
        if bad_matched > 0:
            issues.append({"severity": "error", "message": f"{bad_matched} non-unmatched mappings are missing target_code or marked unmatched"})
        if broken_rep_agb > 0:
            issues.append({"severity": "error", "message": f"{broken_rep_agb} broken representative_agb_code references to agribalyse_31"})

    elif path.name == "statistical_price_forecasts.parquet":
        bad_val = int(
            con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE split_role LIKE 'VALIDATION%' AND actual_value IS NULL"
            ).fetchone()[0]
        )
        if bad_val > 0:
            issues.append({"severity": "error", "message": f"{bad_val} validation rows missing observed actual_value"})

    elif path.name == "agribalyse_31.parquet":
        neg_co2 = int(
            con.execute(f"SELECT COUNT(*) FROM read_parquet('{path}') WHERE Changement_climatique_kg_CO2eq < 0").fetchone()[0]
        )
        if neg_co2 > 0:
            issues.append({"severity": "warn", "message": f"{neg_co2} items have negative net CO2eq (biogenic/land credits)"})

    has_error = any(i["severity"] == "error" for i in issues)
    has_warn = any(i["severity"] == "warn" for i in issues)
    status = "fail" if has_error else ("warn" if has_warn else "pass")

    retrieved_dt = datetime.strptime(spec["retrieved_at"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    freshness_days = max(0, (datetime.now(timezone.utc) - retrieved_dt).days)

    return {
        **spec,
        "file_path": rel_path,
        "record_count": n_rows,
        "column_count": n_cols,
        "bytes": int(path.stat().st_size),
        "sha256": sha256_file(path),
        "freshness_days": freshness_days,
        "missingness_pct": round((total_nulls / max(1, total_cells)) * 100.0, 2),
        "duplicate_key_count": dup_count,
        "validation_status": status,
        "issues": issues,
        "schema": schema,
    }


def main() -> None:
    prev_manifest = {}
    if MANIFEST_PATH.exists():
        prev_manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    prev_tables = prev_manifest.get("parquet_tables", {})

    con = duckdb.connect()
    datasets: list[dict[str, Any]] = []
    parquet_manifest: dict[str, Any] = {}
    version_changes: list[dict[str, Any]] = []

    for pfile in sorted(PARQUET_DIR.glob("*.parquet")):
        spec = DATASET_SPECS.get(pfile.name)
        if not spec:
            raise KeyError(f"Unregistered Parquet dataset: {pfile.name}")
        entry = validate_parquet_table(con, pfile, spec)
        datasets.append(entry)

        parquet_manifest[pfile.name] = {
            "rows": entry["record_count"],
            "columns": entry["column_count"],
            "bytes": entry["bytes"],
            "sha256": entry["sha256"],
        }

        prev = prev_tables.get(pfile.name)
        if not prev:
            version_changes.append({"table": pfile.name, "change": "added", "rows_after": entry["record_count"]})
        elif prev.get("sha256") != entry["sha256"]:
            version_changes.append({
                "table": pfile.name,
                "change": "updated",
                "rows_before": prev.get("rows"),
                "rows_after": entry["record_count"],
                "sha256_changed": True,
            })

    for old_name in prev_tables:
        if old_name not in parquet_manifest:
            version_changes.append({"table": old_name, "change": "removed", "rows_before": prev_tables[old_name].get("rows")})

    con.close()

    # Raw cache hashes
    raw_hashes: dict[str, str] = {}
    if RAW_CACHE_DIR.exists():
        for rf in sorted(RAW_CACHE_DIR.rglob("*")):
            if rf.is_file():
                rel = rf.relative_to(RAW_CACHE_DIR).as_posix()
                raw_hashes[rel] = sha256_file(rf)

    now_iso = datetime.now(timezone.utc).isoformat()

    manifest = {
        "generated_at_utc": now_iso,
        "pipeline": "build_data_infrastructure.py (Phase 2 Foundation)",
        "raw_source_sha256": raw_hashes,
        "parquet_tables": parquet_manifest,
        "total_parquet_tables": len(parquet_manifest),
        "total_rows": sum(v["rows"] for v in parquet_manifest.values()),
        "version_diff": version_changes,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    registry = {
        "schema_version": "1.0.0",
        "generated_at_utc": now_iso,
        "total_datasets": len(datasets),
        "total_records": sum(d["record_count"] for d in datasets),
        "total_bytes": sum(d["bytes"] for d in datasets),
        "summary_by_tier": {
            tier: sum(1 for d in datasets if d["tier"] == tier)
            for tier in ("raw", "processed", "harmonized", "analytical", "forecast")
        },
        "summary_by_nature": {
            nat: sum(1 for d in datasets if d["data_nature"] == nat)
            for nat in ("Observed", "Estimated", "Model Output", "Forecast", "Simulated", "Manually Compiled")
        },
        "validation_summary": {
            "pass": sum(1 for d in datasets if d["validation_status"] == "pass"),
            "warn": sum(1 for d in datasets if d["validation_status"] == "warn"),
            "fail": sum(1 for d in datasets if d["validation_status"] == "fail"),
        },
        "version_diff": version_changes,
        "datasets": datasets,
    }
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[OK] Registry generated: {registry['total_datasets']} datasets, {registry['total_records']:,} rows, {registry['total_bytes']:,} bytes")
    print(f"     Validation summary: {registry['validation_summary']}")
    if version_changes:
        print(f"     Version diff ({len(version_changes)} changes): {[c['table'] + ':' + c['change'] for c in version_changes]}")


if __name__ == "__main__":
    main()
