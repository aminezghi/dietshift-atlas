import hashlib
import json
from pathlib import Path

import pyarrow.parquet as pq
import pytest

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
PARQUET_DIR = DATA_DIR / "parquet"


@pytest.fixture(scope="module")
def manifest():
    manifest_path = DATA_DIR / "provenance_manifest.json"
    assert manifest_path.exists(), "provenance_manifest.json is missing"
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_provenance_manifest_all_parquet_hashes_and_rows(manifest):
    tables = manifest["parquet_tables"]
    assert manifest["total_parquet_tables"] == 19
    assert len(tables) == 19

    observed_total_rows = 0
    checked_count = 0
    for name, meta in tables.items():
        p = PARQUET_DIR / name
        if not p.exists():
            continue  # Track B restricted table excluded from Track A distribution
        digest = hashlib.sha256(p.read_bytes()).hexdigest()
        assert digest == meta["sha256"], f"SHA-256 mismatch for {name}"
        pf = pq.ParquetFile(p)
        assert pf.metadata.num_rows == meta["rows"], f"Row count mismatch for {name}"
        assert pf.metadata.num_columns == meta["columns"], f"Column count mismatch for {name}"
        observed_total_rows += pf.metadata.num_rows
        checked_count += 1

    assert checked_count >= 12, f"Expected at least 12 Track A tables, found {checked_count}"
    if checked_count == 19:
        assert observed_total_rows == manifest["total_rows"]
        assert observed_total_rows >= 17000


def test_datasets_registry_completeness_and_validation():
    reg_path = DATA_DIR / "datasets_registry.json"
    assert reg_path.exists(), "datasets_registry.json is missing"
    reg = json.loads(reg_path.read_text(encoding="utf-8"))
    assert reg["total_datasets"] == 19
    assert reg["validation_summary"]["fail"] == 0
    assert reg["validation_summary"]["warn"] == 0
    for ds in reg["datasets"]:
        assert ds["tier"] in {"raw", "processed", "harmonized", "analytical", "forecast"}
        assert ds["data_nature"] in {"Observed", "Estimated", "Model Output", "Forecast", "Simulated", "Manually Compiled"}
        assert ds["update_policy"] in {"auto_api", "manual", "static_reference", "credentials_required", "archived"}
        assert ds["record_count"] > 0
        assert ds["validation_status"] == "pass"
        if ds["id"] == "agribalyse_31":
            assert ds["data_nature"] == "Model Output"
        elif ds["id"] == "global_poore_nemecek_lca":
            assert ds["data_nature"] == "Estimated"
        elif ds["id"] == "clinical_biomarker_grounding":
            assert ds["data_nature"] == "Estimated"
        elif ds["id"] == "openfoodfacts_eu":
            assert ds["data_nature"] == "Observed"
            assert ds["record_count"] == 3197
        elif ds["id"] == "statistical_price_forecasts":
            assert ds["data_nature"] == "Forecast"
            assert ds["record_count"] == 560


def test_crosswalk_rosetta_referential_integrity():
    import duckdb
    con = duckdb.connect()
    rows = con.execute("""
        SELECT c.crosswalk_id, c.agb_code, a.Code_AGB, c.mean_co2_kg, a.Changement_climatique_kg_CO2eq, COUNT(e.foodex2_code) AS efsa_cnt
        FROM read_parquet('public/data/parquet/crosswalk_rosetta.parquet') c
        LEFT JOIN read_parquet('public/data/parquet/agribalyse_31.parquet') a ON c.agb_code = a.Code_AGB
        LEFT JOIN read_parquet('public/data/parquet/efsa_foodex2_surveys.parquet') e ON c.foodex2_code = e.foodex2_code
        GROUP BY 1,2,3,4,5
    """).fetchall()
    con.close()
    assert len(rows) == 15
    for cid, agb_c, joined_agb, c_co2, a_co2, efsa_cnt in rows:
        assert joined_agb == agb_c, f"Broken Agribalyse ref in {cid}: {agb_c}"
        assert abs(c_co2 - round(a_co2, 3)) < 1e-6, f"CO2 mismatch in {cid}: {c_co2} != {a_co2}"
        assert efsa_cnt > 0, f"Broken FoodEx2 ref in {cid}"


def test_openfoodfacts_no_legacy_silent_imputation():
    import duckdb
    con = duckdb.connect()
    res = con.execute("""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN proteins_100g = 6.5 AND energy_kcal_100g = 210 AND fiber_100g = 2.2 AND salt_100g = 0.65 THEN 1 ELSE 0 END) AS legacy_imputed,
            SUM(CASE WHEN primary_country IS NULL AND countries IS NOT NULL AND len(countries) > 0 THEN 1 ELSE 0 END) AS country_mismatch
        FROM read_parquet('public/data/parquet/openfoodfacts_eu.parquet')
    """).fetchone()
    con.close()
    assert res[0] >= 3000
    assert res[1] == 0, f"Found {res[1]} rows with legacy default imputation"
    assert res[2] == 0, f"Found {res[2]} rows with primary_country/countries mismatch"


def test_statistical_price_forecasts_no_leakage():
    import duckdb
    con = duckdb.connect()
    rows = con.execute("""
        SELECT country_code, indicator_name, damped_ets_val_mae, naive_val_mae, COUNT(*)
        FROM read_parquet('public/data/parquet/statistical_price_forecasts.parquet')
        WHERE split_role LIKE 'VALIDATION%'
        GROUP BY 1,2,3,4
    """).fetchall()
    con.close()
    assert len(rows) == 35  # 7 jurisdictions x 5 observed HICP series
    for cc, ind, dmp_mae, niv_mae, cnt in rows:
        assert cnt == 3
        assert dmp_mae > 0.5, f"Suspiciously near-zero MAE ({dmp_mae}) for {cc} {ind}"
        assert niv_mae > 0.5


def test_nhanes_clinical_biomarker_invariants():
    json_path = DATA_DIR / "clinical_biomarker_grounding.json"
    parquet_path = PARQUET_DIR / "clinical_biomarker_grounding.parquet"
    assert json_path.exists() and parquet_path.exists()

    records = json.loads(json_path.read_text(encoding="utf-8"))
    assert len(records) == 5

    total_n = sum(r["n_respondents"] for r in records)
    assert total_n > 3000, f"Expected >3000 weighted NHANES adults, got {total_n}"

    # Verify ordering Q5 (highest fiber) -> Q1 (lowest fiber)
    fibers = [r["mean_fiber_g_day"] for r in records]
    assert fibers == sorted(fibers, reverse=True)

    for r in records:
        assert r["n_respondents"] >= 500
        assert 100.0 < r["total_cholesterol_mg_dl"] < 300.0
        assert 0.0 < r["total_cholesterol_ci95"] < 25.0
        assert 50.0 < r["non_hdl_cholesterol_mg_dl"] < r["total_cholesterol_mg_dl"]
        assert 0.0 < r["hs_crp_ci95"] < 5.0
        assert 90.0 < r["systolic_bp_mmhg"] < 160.0
        assert 0.0 < r["systolic_bp_ci95"] < 10.0
        assert "NHANES" in r["cohort_source"]

    table = pq.read_table(parquet_path)
    assert table.num_rows == 5


def test_eurostat_econometric_calibration_ranges():
    cal_path = DATA_DIR / "econometric_calibration.json"
    assert cal_path.exists()
    cal = json.loads(cal_path.read_text(encoding="utf-8"))

    expected_codes = {"IT", "FR", "DE", "ES", "NL", "BE", "PL", "SE", "AT", "PT", "EU27", "UK"}
    assert expected_codes.issubset(set(cal.keys()))

    for code, entry in cal.items():
        assert 5.0 <= entry["hbs_q1_food_share_pct"] <= 50.0
        assert 5.0 <= entry["hbs_q5_food_share_pct"] <= 40.0
        assert 1.0 <= entry["ehis_q1_5plus_veg_pct"] <= 60.0
        assert 1.0 <= entry["ehis_q5_5plus_veg_pct"] <= 60.0
        assert -1.2 <= entry["empirical_own_price_elasticity"] <= -0.2
        assert 0.0 < entry["hicp_meat_inflation_21_24_pct"] < 100.0
        assert 0.0 < entry["hicp_backtest_22_24_mape_pct"] < 35.0
        assert 0.01 <= entry["empirical_ci95_rel_halfwidth"] <= 0.25
        assert 50.0 <= entry["eurostat_food_ppp_index_eu27_100"] <= 160.0


def test_scrapling_retail_claims_schema_and_coverage():
    parquet_path = PARQUET_DIR / "scrapling_retail_claims.parquet"
    json_path = DATA_DIR / "scrapling_retail_claims.json"
    assert parquet_path.exists() and json_path.exists()

    table = pq.read_table(parquet_path)
    assert table.num_rows >= 500
    rows = table.to_pylist()

    countries = {r["country_code"] for r in rows if r.get("country_code")}
    assert len(countries) >= 4, f"Expected multi-country EU coverage, found {countries}"
    assert "FR" in countries and "DE" in countries and "IT" in countries

    prices = [r["price_eur"] for r in rows]
    assert all(isinstance(p, (int, float)) and 0 < p < 500 for p in prices)

    observed_nutr = [r for r in rows if r.get("nutrition_data_status") == "observed"]
    missing_nutr = [r for r in rows if r.get("nutrition_data_status") == "missing"]
    assert len(observed_nutr) >= 900
    assert all(r["energy_kcal"] is None and r["proteins_g"] is None for r in missing_nutr)
    qty_rows = [r for r in rows if r.get("product_quantity") is not None]
    assert len(qty_rows) >= 1000
    assert all(r["product_quantity"] > 0 and r["product_quantity_unit"] in {"g", "kg", "mg", "ml", "cl", "l"} for r in qty_rows)


def test_poore_nemecek_global_lca_invariants():
    parquet_path = PARQUET_DIR / "global_poore_nemecek_lca.parquet"
    assert parquet_path.exists()
    table = pq.read_table(parquet_path)
    assert table.num_rows >= 40
    rows = {r["food_item"]: r for r in table.to_pylist()}
    assert "Beef (beef herd)" in rows and "Peas" in rows
    beef = rows["Beef (beef herd)"]
    peas = rows["Peas"]
    assert beef["ghg_kg_co2eq_per_kg"] > 50.0
    assert peas["ghg_kg_co2eq_per_kg"] < 2.0
    assert 0.0 <= beef["transport_share_pct"] < 5.0
    assert beef["land_use_m2_per_kg"] > peas["land_use_m2_per_kg"]


def test_world_bank_cohd_global_affordability_invariants():
    parquet_path = PARQUET_DIR / "global_healthy_diet_affordability.parquet"
    bench_path = DATA_DIR / "global_benchmarks.json"
    assert parquet_path.exists() and bench_path.exists()

    table = pq.read_table(parquet_path)
    assert table.num_rows >= 1000
    rows = table.to_pylist()
    assert len({r["iso3"] for r in rows}) >= 150
    assert max(r["year"] for r in rows) >= 2024

    bench = json.loads(bench_path.read_text(encoding="utf-8"))
    by_iso = {c["iso3"]: c for c in bench["cohd_latest_by_country"]}
    for iso in ("ITA", "FRA", "DEU", "USA", "BRA", "IND", "NGA"):
        assert iso in by_iso
        assert 1.0 < by_iso[iso]["cost_healthy_diet_ppp_usd"] < 15.0
        assert 0.0 <= by_iso[iso]["unaffordable_pct"] <= 100.0


def test_classification_mappings_integrity():
    import duckdb
    con = duckdb.connect()
    rows = con.execute("""
        SELECT m.mapping_id, m.source_system, m.target_system, m.target_code,
               m.mapping_type, m.confidence_tier, m.representative_agb_code, a.Code_AGB
        FROM read_parquet('public/data/parquet/classification_mappings.parquet') m
        LEFT JOIN read_parquet('public/data/parquet/agribalyse_31.parquet') a
          ON m.representative_agb_code = a.Code_AGB
    """).fetchall()
    con.close()

    assert len(rows) >= 150
    seen_types = {r[4] for r in rows}
    assert seen_types == {"exact", "hierarchical", "approximate", "ambiguous", "unmatched"}
    for mid, src, tgt, tcode, mtype, ctier, rep_agb, joined_agb in rows:
        if mtype == "unmatched":
            assert tcode is None and ctier == "unmatched", f"Unmatched row {mid} must have NULL target"
        else:
            assert tcode is not None and ctier != "unmatched", f"Matched row {mid} missing target"
        if rep_agb is not None:
            assert joined_agb == rep_agb, f"Broken representative_agb_code {rep_agb} in {mid}"


def test_classification_mappings_curated_good_and_bad_cases():
    rows = json.loads((DATA_DIR / "classification_mappings.json").read_text(encoding="utf-8"))
    by_id = {r["mapping_id"]: r for r in rows}

    # Known-good audited exact rules
    assert by_id["MAP_AGB_FOODEX2_27"]["mapping_type"] == "exact"
    assert by_id["MAP_OFF_FOODEX2_07"]["mapping_type"] == "exact"
    assert sum(1 for r in rows if r["mapping_type"] == "exact") == 6

    # Known-bad false-exact cases caught by scope parity audit
    assert by_id["MAP_AGB_COICOP_24"]["mapping_type"] != "exact"
    assert by_id["MAP_AGB_FOODEX2_24"]["mapping_type"] != "exact"
    assert by_id["MAP_OFF_COICOP_11"]["mapping_type"] != "exact"

    # Known-unmatched gaps preserved without fabricated targets
    assert by_id["MAP_COICOP_FOODEX2_UNMATCHED_01"]["target_code"] is None
    assert by_id["MAP_COICOP_FOODEX2_UNMATCHED_01"]["confidence_tier"] == "unmatched"


def test_forecast_expanding_cv_summary_invariants():
    summary_path = DATA_DIR / "forecast_validation_summary.json"
    assert summary_path.exists()
    reports = json.loads(summary_path.read_text(encoding="utf-8"))
    assert len(reports) == 35
    drift_wins = sum(1 for r in reports if r["best_cv_model"] == "naive_drift")
    assert drift_wins >= 30, f"Expected simple drift baseline to win majority without bias, got {drift_wins}"
    for r in reports:
        assert r["fold_count"] == 15
        for m in ("damped_ets", "holt_ets", "ridge_trend", "naive_drift", "naive_rw"):
            assert r["overall"][m]["mae"] > 0
            assert r["overall"][m]["mase"] > 0
            assert r["overall"][m]["smape_pct"] > 0


def test_json_parquet_parity_audit(manifest):
    """Phase 5B I-01: enforce row-count parity between Parquet canonical stores and derived JSON bundles."""
    one_to_one_pairs = [
        ("agribalyse_full.json", None, "agribalyse_31.parquet"),
        ("scrapling_retail_claims.json", None, "scrapling_retail_claims.parquet"),
        ("classification_mappings.json", None, "classification_mappings.parquet"),
        ("statistical_price_forecasts.json", None, "statistical_price_forecasts.parquet"),
        ("crosswalk_rosetta.json", None, "crosswalk_rosetta.parquet"),
        ("clinical_biomarker_grounding.json", None, "clinical_biomarker_grounding.parquet"),
        ("time_use_cooking_friction.json", None, "time_use_cooking_friction.parquet"),
        ("school_meals_procurement.json", None, "school_meals_procurement.parquet"),
        ("cultural_climate_inertia.json", None, "cultural_climate_inertia.parquet"),
        ("gi_terroir_bundle.json", "gi_terroir_records", "gi_terroir_registry.parquet"),
        ("consumer_behavior_pulse.json", "gi_terroir_records", "gi_terroir_registry.parquet"),
        ("consumer_behavior_pulse.json", "country_behavior_profiles", "consumer_behavior_pulse.parquet"),
        ("consumer_behavior_pulse.json", "social_discourse_posts", "social_discourse_velocity.parquet"),
        ("nsi_subnational_quintiles.json", "rows", "nsi_subnational_quintiles.parquet"),
        ("live_research_bundle.json", "openfoodfacts", "openfoodfacts_eu.parquet"),
        ("live_research_bundle.json", "efsa_surveys", "efsa_foodex2_surveys.parquet"),
        ("global_benchmarks.json", "poore_nemecek_lca", "global_poore_nemecek_lca.parquet"),
    ]

    for json_name, nested_key, parquet_name in one_to_one_pairs:
        json_path = DATA_DIR / json_name
        parquet_path = PARQUET_DIR / parquet_name
        if not json_path.exists() or not parquet_path.exists():
            continue  # Track B restricted pair excluded from Track A open distribution
        obj = json.loads(json_path.read_text(encoding="utf-8"))
        rows = obj[nested_key] if nested_key else obj
        pq_rows = pq.ParquetFile(parquet_path).metadata.num_rows
        assert len(rows) == pq_rows, f"Parity drift: {json_name}[{nested_key}]={len(rows)} != {parquet_name}={pq_rows}"
        assert pq_rows == manifest["parquet_tables"][parquet_name]["rows"]

    # Composite/snapshot exceptions explicitly audited in Phase 5B (I-01):
    # 1. gs1_immagino_bundle.json partitions the 61 rows of gs1_immagino_observatory.parquet across 5 arrays (if Track B present)
    gs1_path = DATA_DIR / "gs1_immagino_bundle.json"
    gs1_pq_path = PARQUET_DIR / "gs1_immagino_observatory.parquet"
    if gs1_path.exists() and gs1_pq_path.exists():
        gs1 = json.loads(gs1_path.read_text(encoding="utf-8"))
        gs1_sum = sum(len(gs1[k]) for k in ("metaprodotto", "fenomeni", "push_pull", "ecommerce", "regionalita"))
        assert gs1_sum == pq.ParquetFile(gs1_pq_path).metadata.num_rows == 61

    # 2. global_benchmarks.cohd_latest_by_country holds latest-year snapshot (1 row per ISO3 economy) vs 1,399 multi-year rows
    gb = json.loads((DATA_DIR / "global_benchmarks.json").read_text(encoding="utf-8"))
    cohd_pq = pq.ParquetFile(PARQUET_DIR / "global_healthy_diet_affordability.parquet").read()
    distinct_iso3 = len(set(cohd_pq.column("iso3").to_pylist()))
    assert len(gb["cohd_latest_by_country"]) == distinct_iso3 == 177
    assert cohd_pq.num_rows == 1399

    # 3. live_research_bundle.agribalyse holds a legacy 500-item preview slice, superseded at runtime by agribalyse_full.json (2,451)
    lrb = json.loads((DATA_DIR / "live_research_bundle.json").read_text(encoding="utf-8"))
    assert len(lrb["agribalyse"]) == 500
    assert pq.ParquetFile(PARQUET_DIR / "agribalyse_31.parquet").metadata.num_rows == 2451

