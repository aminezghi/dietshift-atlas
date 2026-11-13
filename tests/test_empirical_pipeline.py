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
    assert manifest["total_parquet_tables"] == 18
    assert len(tables) == 18

    observed_total_rows = 0
    for name, meta in tables.items():
        p = PARQUET_DIR / name
        assert p.exists(), f"Missing parquet file {p}"
        digest = hashlib.sha256(p.read_bytes()).hexdigest()
        assert digest == meta["sha256"], f"SHA-256 mismatch for {name}"
        pf = pq.ParquetFile(p)
        assert pf.metadata.num_rows == meta["rows"], f"Row count mismatch for {name}"
        assert pf.metadata.num_columns == meta["columns"], f"Column count mismatch for {name}"
        observed_total_rows += pf.metadata.num_rows

    assert observed_total_rows == manifest["total_rows"]
    assert observed_total_rows >= 17500


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
