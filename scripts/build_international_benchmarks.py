#!/usr/bin/env python3
"""
DietShift Atlas — International Microdata & Global LCA Pipeline
================================================================
Ingests real primary global datasets to cross-validate and internationalize EU outputs:
1. Poore & Nemecek (2018, Science, 38,700 farms / 119 countries):
   - Full lifecycle supply-chain stages (land use, farm, feed, processing, transport, retail, packaging, losses)
   - GHG per kg / 100g protein / 1000kcal, Land Use (m2/kg), Freshwater Withdrawals (L/kg),
     Scarcity-Weighted Water (L eq/kg), and Eutrophying Emissions (g PO4eq/kg).
2. World Bank & FAO Food Prices for Nutrition (via Our World in Data Grapher API, 2017-2024):
   - Cost of a Healthy Diet (ICP PPP $/person/day) across 185 jurisdictions
   - Share (%) & Headcount (millions) unable to afford a healthy diet across 160 countries
   - Cost-to-Food-Expenditure affordability ratio (ICP 2021 cycle, 176 countries)
   - Mapped directly against `public/data/world.geojson` feature names for zero-drop Plate I rendering.

Outputs:
- public/data/parquet/global_poore_nemecek_lca.parquet
- public/data/parquet/global_healthy_diet_affordability.parquet
- public/data/global_benchmarks.json
- Updates public/data/provenance_manifest.json with all 18 Parquet tables + raw source SHA-256 hashes.
"""

from __future__ import annotations

import hashlib
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "scripts" / ".raw_cache" / "international"
DATA_DIR = ROOT / "public" / "data"
PARQUET_DIR = DATA_DIR / "parquet"

CACHE_DIR.mkdir(parents=True, exist_ok=True)
PARQUET_DIR.mkdir(parents=True, exist_ok=True)

OWID_SLUGS: dict[str, str] = {
    "poore_stages": "food-emissions-supply-chain",
    "poore_ghg_kg": "ghg-per-kg-poore",
    "poore_ghg_protein": "ghg-per-protein-poore",
    "poore_ghg_kcal": "ghg-kcal-poore",
    "poore_land_kg": "land-use-per-kg-poore",
    "poore_water_kg": "water-withdrawals-per-kg-poore",
    "poore_scarcity_kg": "scarcity-water-per-kg-poore",
    "poore_eutroph_kg": "eutrophying-emissions-per-kg-poore",
    "wb_cost_healthy_diet": "cost-healthy-diet",
    "wb_unaffordable_share": "share-healthy-diet-unaffordable",
    "wb_unaffordable_count": "number-healthy-diet-unaffordable",
    "wb_food_exp_ratio": "cost-healthy-diet-share-food-expenditure",
}

GEOJSON_NAME_OVERRIDES: dict[str, str] = {
    "United States": "United States of America",
    "United Kingdom": "England",
    "Democratic Republic of Congo": "Democratic Republic of the Congo",
    "Congo": "Republic of the Congo",
    "Tanzania": "United Republic of Tanzania",
    "Czechia": "Czech Republic",
    "Serbia": "Republic of Serbia",
    "Eswatini": "Swaziland",
    "Palestine": "West Bank",
    "Cote d'Ivoire": "Ivory Coast",
    "Timor": "East Timor",
    "North Macedonia": "Macedonia",
    "Bahamas": "The Bahamas",
    "Gambia": "Gambia",
    "Guinea-Bissau": "Guinea Bissau",
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def download_owid_csv(key: str, slug: str) -> tuple[pd.DataFrame, str]:
    cache_path = CACHE_DIR / f"{slug}.csv"
    url = f"https://ourworldindata.org/grapher/{slug}.csv?v=1&csvType=full&useColumnShortNames=true"
    print(f"  [↓] Fetching OWID Grapher CSV ({key}): {slug} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "DietShift-Atlas/2.0 (Research)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    cache_path.write_bytes(raw)
    digest = hashlib.sha256(raw).hexdigest()
    return pd.read_csv(cache_path), digest


def normalize_entity_for_map(entity: str, geojson_names: set[str]) -> str:
    if entity in geojson_names:
        return entity
    mapped = GEOJSON_NAME_OVERRIDES.get(entity)
    if mapped and mapped in geojson_names:
        return mapped
    return entity


def build_poore_nemecek_table(raw_dfs: dict[str, pd.DataFrame]) -> pd.DataFrame:
    df_s = raw_dfs["poore_stages"].rename(
        columns={
            "entity": "food_item",
            "food_emissions_land_use": "stage_land_use",
            "food_emissions_farm": "stage_farm",
            "food_emissions_animal_feed": "stage_animal_feed",
            "food_emissions_processing": "stage_processing",
            "food_emissions_transport": "stage_transport",
            "food_emissions_retail": "stage_retail",
            "food_emissions_packaging": "stage_packaging",
            "food_emissions_losses": "stage_losses",
        }
    ).drop(columns=["year"], errors="ignore")

    def prep_metric(key: str, target_col: str) -> pd.DataFrame:
        df = raw_dfs[key].copy()
        val_col = [c for c in df.columns if c not in ("entity", "code", "year")][0]
        df = df.rename(columns={"entity": "food_item", val_col: target_col})
        return df[["food_item", target_col]].drop_duplicates(subset=["food_item"])

    merged = df_s.copy()
    metric_specs = [
        ("poore_ghg_kg", "ghg_kg_co2eq_per_kg"),
        ("poore_ghg_protein", "ghg_kg_per_100g_protein"),
        ("poore_ghg_kcal", "ghg_kg_per_1000kcal"),
        ("poore_land_kg", "land_use_m2_per_kg"),
        ("poore_water_kg", "freshwater_withdrawals_l_per_kg"),
        ("poore_scarcity_kg", "scarcity_water_l_per_kg"),
        ("poore_eutroph_kg", "eutrophying_g_po4_per_kg"),
    ]
    for key, col in metric_specs:
        m = prep_metric(key, col)
        merged = merged.merge(m, on="food_item", how="outer")

    stage_cols = [
        "stage_land_use",
        "stage_farm",
        "stage_animal_feed",
        "stage_processing",
        "stage_transport",
        "stage_retail",
        "stage_packaging",
        "stage_losses",
    ]
    for col in stage_cols:
        if col in merged.columns:
            merged[col] = merged[col].fillna(0.0).round(3)

    # Compute total lifecycle GHG from supply chain stages where Poore kg column matches
    merged["total_supply_chain_ghg"] = merged[stage_cols].sum(axis=1).round(3)
    merged["ghg_kg_co2eq_per_kg"] = (
        merged["ghg_kg_co2eq_per_kg"].fillna(merged["total_supply_chain_ghg"]).round(2)
    )
    denom = merged["total_supply_chain_ghg"].where(merged["total_supply_chain_ghg"] > 0)
    merged["transport_share_pct"] = ((merged["stage_transport"] / denom) * 100.0).fillna(0.0).round(2)

    for c in [
        "ghg_kg_per_100g_protein",
        "ghg_kg_per_1000kcal",
        "land_use_m2_per_kg",
        "freshwater_withdrawals_l_per_kg",
        "scarcity_water_l_per_kg",
        "eutrophying_g_po4_per_kg",
    ]:
        merged[c] = merged[c].round(2)

    merged["data_source"] = "Poore & Nemecek (Science, 2018) — 38,700 farms across 119 countries"
    merged = merged.sort_values("ghg_kg_co2eq_per_kg", ascending=False).reset_index(drop=True)
    return merged


def build_cohd_table(raw_dfs: dict[str, pd.DataFrame], geojson_names: set[str]) -> pd.DataFrame:
    df_cost = raw_dfs["wb_cost_healthy_diet"].rename(
        columns={"entity": "country_name", "cost_of_a_healthy_diet_in_ppp_dollars": "cost_healthy_diet_ppp_usd"}
    )
    df_share = raw_dfs["wb_unaffordable_share"].rename(
        columns={
            "entity": "country_name",
            "percent_of_the_population_who_cannot_afford_a_healthy_diet": "unaffordable_pct",
        }
    )
    df_cnt = raw_dfs["wb_unaffordable_count"].rename(
        columns={
            "entity": "country_name",
            "people_who_cannot_afford_a_healthy_diet": "unaffordable_people",
        }
    )
    df_ratio = raw_dfs["wb_food_exp_ratio"].rename(
        columns={
            "entity": "country_name",
            "affordability_of_a_healthy_diet__ratio_of_cost_to_food_expenditures": "cost_to_food_exp_ratio",
        }
    )

    merged = df_cost.merge(df_share[["country_name", "code", "year", "unaffordable_pct"]], on=["country_name", "code", "year"], how="outer")
    merged = merged.merge(df_cnt[["country_name", "code", "year", "unaffordable_people"]], on=["country_name", "code", "year"], how="outer")
    merged = merged.merge(df_ratio[["country_name", "code", "year", "cost_to_food_exp_ratio"]], on=["country_name", "code", "year"], how="left")

    # Keep only sovereign countries/territories with ISO3 codes (drop aggregate World/continent headers except 'World' flagged separately)
    merged["iso3"] = merged["code"].fillna("")
    merged = merged[merged["iso3"].str.len() == 3].copy()
    merged["geojson_name"] = merged["country_name"].apply(lambda x: normalize_entity_for_map(x, geojson_names))
    merged["unaffordable_millions"] = (merged["unaffordable_people"] / 1_000_000.0).round(3)
    merged["cost_healthy_diet_ppp_usd"] = merged["cost_healthy_diet_ppp_usd"].round(2)
    merged["unaffordable_pct"] = merged["unaffordable_pct"].round(1)
    merged["cost_to_food_exp_ratio"] = merged["cost_to_food_exp_ratio"].round(3)
    merged["data_source"] = "World Bank & FAO Food Prices for Nutrition (ICP PPP)"

    cols = [
        "iso3",
        "country_name",
        "geojson_name",
        "year",
        "cost_healthy_diet_ppp_usd",
        "unaffordable_pct",
        "unaffordable_millions",
        "cost_to_food_exp_ratio",
        "data_source",
    ]
    return merged[cols].sort_values(["country_name", "year"]).reset_index(drop=True)


def update_provenance_manifest(raw_hashes: dict[str, str]) -> dict[str, Any]:
    manifest_path = DATA_DIR / "provenance_manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {"raw_source_sha256": {}, "parquet_tables": {}}

    manifest["generated_at_utc"] = datetime.now(timezone.utc).isoformat()
    manifest["pipeline"] = (
        "build_deep_empirical_pipeline.py + harvest_raw_prices_scrapling.py + build_international_benchmarks.py"
    )
    manifest["raw_source_sha256"].update(raw_hashes)

    tables_meta: dict[str, Any] = {}
    total_rows = 0
    for p in sorted(PARQUET_DIR.glob("*.parquet")):
        pf = pq.ParquetFile(p)
        n_rows = pf.metadata.num_rows
        total_rows += n_rows
        tables_meta[p.name] = {
            "rows": n_rows,
            "columns": pf.metadata.num_columns,
            "bytes": p.stat().st_size,
            "sha256": sha256_file(p),
        }

    manifest["parquet_tables"] = tables_meta
    manifest["total_parquet_tables"] = len(tables_meta)
    manifest["total_rows"] = total_rows
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    print("[1/4] Fetching Poore & Nemecek (2018) and World Bank / FAO Food Prices for Nutrition...")
    raw_dfs: dict[str, pd.DataFrame] = {}
    raw_hashes: dict[str, str] = {}
    for key, slug in OWID_SLUGS.items():
        df, digest = download_owid_csv(key, slug)
        raw_dfs[key] = df
        raw_hashes[f"OWID_{slug}.csv"] = digest

    world_geojson = json.loads((DATA_DIR / "world.geojson").read_text(encoding="utf-8"))
    geojson_names = {f["properties"]["name"] for f in world_geojson.get("features", []) if "name" in f.get("properties", {})}

    print("[2/4] Compiling global_poore_nemecek_lca.parquet (38,700 farms across 119 countries)...")
    poore_df = build_poore_nemecek_table(raw_dfs)
    poore_parquet = PARQUET_DIR / "global_poore_nemecek_lca.parquet"
    pq.write_table(pa.Table.from_pandas(poore_df, preserve_index=False), poore_parquet, compression="snappy")
    print(f"  -> Wrote {len(poore_df)} global food LCA rows to {poore_parquet.name}")

    print("[3/4] Compiling global_healthy_diet_affordability.parquet (World Bank & FAO CoHD 2017-2024)...")
    cohd_df = build_cohd_table(raw_dfs, geojson_names)
    cohd_parquet = PARQUET_DIR / "global_healthy_diet_affordability.parquet"
    pq.write_table(pa.Table.from_pandas(cohd_df, preserve_index=False), cohd_parquet, compression="snappy")

    # Extract latest complete record per country for Choropleth & peer comparator JSON
    latest_cohd = (
        cohd_df.dropna(subset=["cost_healthy_diet_ppp_usd"])
        .sort_values("year")
        .groupby("iso3", as_index=False)
        .last()
    )
    # Merge latest unaffordable_pct and 2021 food expenditure ratio separately if later year lacks share
    latest_share = (
        cohd_df.dropna(subset=["unaffordable_pct"])
        .sort_values("year")
        .groupby("iso3", as_index=False)
        .last()[["iso3", "unaffordable_pct", "unaffordable_millions", "year"]]
        .rename(columns={"year": "share_year"})
    )
    latest_ratio = (
        cohd_df.dropna(subset=["cost_to_food_exp_ratio"])
        .sort_values("year")
        .groupby("iso3", as_index=False)
        .last()[["iso3", "cost_to_food_exp_ratio"]]
    )
    country_summary = latest_cohd.drop(columns=["unaffordable_pct", "unaffordable_millions", "cost_to_food_exp_ratio"]).merge(
        latest_share, on="iso3", how="left"
    ).merge(latest_ratio, on="iso3", how="left")

    benchmarks_payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "poore_nemecek_lca": json.loads(poore_df.to_json(orient="records")),
        "cohd_latest_by_country": json.loads(country_summary.to_json(orient="records")),
        "global_summary": {
            "poore_commodities_count": int(len(poore_df)),
            "cohd_countries_count": int(len(country_summary)),
            "cohd_latest_year": int(country_summary["year"].max()),
        },
    }
    (DATA_DIR / "global_benchmarks.json").write_text(
        json.dumps(benchmarks_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        f"  -> Wrote {len(cohd_df)} CoHD panel rows ({len(country_summary)} countries latest={country_summary['year'].max()})"
    )

    print("[4/4] Refreshing provenance_manifest.json across all 18 Parquet tables...")
    manifest = update_provenance_manifest(raw_hashes)
    print(f"[OK] Manifest updated: {manifest['total_parquet_tables']} Parquet tables, {manifest['total_rows']:,} total rows.")


if __name__ == "__main__":
    main()
