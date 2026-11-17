"""
refresh_off_clean.py
====================
Rebuilds `openfoodfacts_eu.parquet`, `off_expanded_rows.json`, and the `openfoodfacts`
slice of `live_research_bundle.json` directly from Open Food Facts Search-a-licious API
without silent default imputations.

Data Integrity Guarantees:
- Missing nutriments stay NULL (no fallback 6.5g protein, 210 kcal, 2.2g fiber, etc.).
- Missing Eco-Score stays NULL (no fallback 'C' / 52.0).
- Missing NOVA group stays NULL (no fallback 3).
- Energy kcal uses `energy-kcal_100g`, falling back only to exact unit conversion `energy-kj_100g / 4.184`.
- Both `primary_country` and `countries` are populated consistently on every record.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.request
from pathlib import Path
from typing import Any

import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "public" / "data"
PARQUET_DIR = DATA_DIR / "parquet"
RAW_CACHE_DIR = BASE_DIR / "scripts" / ".raw_cache"
RAW_OFF_CACHE = RAW_CACHE_DIR / "off_search_raw.json"

RAW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
PARQUET_DIR.mkdir(parents=True, exist_ok=True)

OFF_QUERIES = [
    ("Plant-Based Meat & Burger Alternatives", "plant+based+burger+sausage+meat"),
    ("Plant-Based Meat & Burger Alternatives", "vegan+steak+nuggets+mince+seitan"),
    ("Plant-Based Meat & Burger Alternatives", "vegetarian+patty+falafel+meatballs"),
    ("Plant-Based Milk & Dairy Alternatives", "oat+milk+barista+drink"),
    ("Plant-Based Milk & Dairy Alternatives", "soy+almond+coconut+milk+yogurt"),
    ("Legumes, Pulses & Tofu", "lentils+chickpeas+beans+peas"),
    ("Legumes, Pulses & Tofu", "tofu+tempeh+edamame+hummus"),
    ("Whole Grains, Oats & Cereals", "wholegrain+bread+oats+muesli+porridge"),
    ("Whole Grains, Oats & Cereals", "quinoa+bulgur+brown+rice+rye+pasta"),
    ("Fresh & Frozen Vegetables & Fruits", "spinach+broccoli+tomatoes+carrots+salad"),
    ("Fresh & Frozen Vegetables & Fruits", "apples+berries+oranges+bananas+avocado"),
    ("Nuts, Seeds & Healthy Oils", "walnuts+almonds+hazelnuts+chia+flaxseed"),
    ("Nuts, Seeds & Healthy Oils", "extra+virgin+olive+oil+rapeseed+nut+butter"),
    ("Bovine, Pork & Poultry Meats", "beef+steak+pork+chicken+breast+turkey"),
    ("Bovine, Pork & Poultry Meats", "ham+salami+bacon+sausage+charcuterie"),
    ("Dairy Milk, Cheese & Yogurt", "milk+yogurt+kefir+skyr+quark"),
    ("Dairy Milk, Cheese & Yogurt", "cheese+cheddar+gouda+mozzarella+parmesan"),
    ("Fish & Seafood", "salmon+tuna+cod+mackerel+sardines+shrimp"),
    ("Ultra-Processed Snacks & Confectionery", "potato+chips+crisps+crackers+pretzels"),
    ("Ultra-Processed Snacks & Confectionery", "chocolate+biscuits+cookies+candy+gummies"),
    ("Ultra-Processed Ready Meals & Sauces", "frozen+pizza+lasagna+ready+meal+noodles"),
    ("Ultra-Processed Ready Meals & Sauces", "soda+cola+energy+drink+sweetened+beverage"),
]


def _num_or_none(val: Any, digits: int = 2, max_val: float = 10000.0) -> float | None:
    if val is None or isinstance(val, bool):
        return None
    try:
        num = float(val)
    except (TypeError, ValueError):
        return None
    if num < 0 or num > max_val:
        return None
    return round(num, digits)


def fetch_raw_hits() -> list[dict[str, Any]]:
    print("[*] Fetching clean Open Food Facts catalog across 22 dietary queries...")
    batches = []
    for cat_label, q in OFF_QUERIES:
        for page in (1, 2):
            url = f"https://search.openfoodfacts.org/search?q={q}&page_size=100&page={page}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "DietShiftAtlas/4.0 (Research)"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                batches.append({"category": cat_label, "query": q, "page": page, "hits": payload.get("hits", [])})
            except Exception as exc:
                print(f"  [!] OFF query warning ({cat_label} p{page}): {exc}")
            time.sleep(0.15)
    RAW_OFF_CACHE.write_text(json.dumps(batches), encoding="utf-8")
    return batches


def main(live: bool = False) -> None:
    if live or not RAW_OFF_CACHE.exists():
        batches = fetch_raw_hits()
    else:
        batches = json.loads(RAW_OFF_CACHE.read_text(encoding="utf-8"))
        print(f"[*] Loaded {len(batches)} cached OFF search batches from {RAW_OFF_CACHE.name}")

    seen_codes: dict[str, dict[str, Any]] = {}
    for batch in batches:
        cat_label = batch["category"]
        for h in batch.get("hits", []):
            code = str(h.get("code") or "").strip()
            if not code or code in seen_codes:
                continue
            pname = (h.get("product_name") or "").strip()
            ns_grade = str(h.get("nutriscore_grade") or "").lower()
            if not pname or ns_grade not in {"a", "b", "c", "d", "e"}:
                continue

            nutr = h.get("nutriments") or {}
            brands_val = h.get("brands")
            if isinstance(brands_val, list) and brands_val:
                brand_str = str(brands_val[0]).strip()
            elif brands_val:
                brand_str = str(brands_val).strip()
            else:
                brand_str = "Unbranded"

            ns_score = h.get("nutriscore_score")
            ns_score_int = int(ns_score) if isinstance(ns_score, (int, float)) else None

            eco_g = str(h.get("ecoscore_grade") or "").lower()
            eco_grade = eco_g.upper() if eco_g in {"a", "b", "c", "d", "e"} else None
            eco_s = h.get("ecoscore_score")
            eco_score = round(float(eco_s), 1) if isinstance(eco_s, (int, float)) else None

            nova_raw = h.get("nova_group")
            nova_group = int(nova_raw) if str(nova_raw) in {"1", "2", "3", "4"} else None

            c_tags = [c.replace("en:", "").strip() for c in (h.get("countries_tags") or []) if isinstance(c, str)][:5]
            primary_country = c_tags[0] if c_tags else None

            kcal = _num_or_none(nutr.get("energy-kcal_100g"), 1)
            if kcal is None:
                kj = _num_or_none(nutr.get("energy-kj_100g"), 1, max_val=45000.0)
                if kj is not None:
                    kcal = round(kj / 4.184, 1)

            proteins = _num_or_none(nutr.get("proteins_100g"), 2, 100.0)
            carbs = _num_or_none(nutr.get("carbohydrates_100g"), 2, 100.0)
            sugars = _num_or_none(nutr.get("sugars_100g"), 2, 100.0)
            fat = _num_or_none(nutr.get("fat_100g"), 2, 100.0)
            sat_fat = _num_or_none(nutr.get("saturated-fat_100g"), 2, 100.0)
            fiber = _num_or_none(nutr.get("fiber_100g"), 2, 100.0)
            salt = _num_or_none(nutr.get("salt_100g"), 3, 100.0)

            present_n = sum(v is not None for v in (kcal, proteins, carbs, sugars, fat, sat_fat, fiber, salt))
            nutr_status = "observed" if present_n >= 4 else ("partial" if present_n >= 1 else "missing")

            serving_qty = _num_or_none(h.get("serving_quantity"), 1, 5000.0)
            serving_size = str(h.get("serving_size")).strip() if h.get("serving_size") else None

            seen_codes[code] = {
                "code": code,
                "name": pname[:90],
                "brand": brand_str[:50],
                "category": cat_label,
                "nutriscore_grade": ns_grade.upper(),
                "nutriscore_score": ns_score_int,
                "ecoscore_grade": eco_grade,
                "ecoscore_score": eco_score,
                "nova_group": nova_group,
                "primary_country": primary_country,
                "countries": c_tags,
                "serving_size": serving_size,
                "serving_quantity_g": serving_qty,
                "energy_kcal_100g": kcal,
                "proteins_100g": proteins,
                "carbohydrates_100g": carbs,
                "sugars_100g": sugars,
                "fat_100g": fat,
                "saturated_fat_100g": sat_fat,
                "fiber_100g": fiber,
                "salt_100g": salt,
                "nutrition_data_status": nutr_status,
            }

    off_list = list(seen_codes.values())
    (DATA_DIR / "off_expanded_rows.json").write_text(
        json.dumps(off_list, ensure_ascii=False), encoding="utf-8"
    )

    con = duckdb.connect()
    con.execute(
        "CREATE OR REPLACE TABLE openfoodfacts_eu AS SELECT * FROM read_json_auto(?, sample_size=-1)",
        [str(DATA_DIR / "off_expanded_rows.json")],
    )
    con.execute(
        f"COPY openfoodfacts_eu TO '{PARQUET_DIR / 'openfoodfacts_eu.parquet'}' (FORMAT PARQUET, COMPRESSION ZSTD)"
    )
    stats = con.execute("""
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN primary_country IS NULL THEN 1 ELSE 0 END) AS null_country,
               SUM(CASE WHEN ecoscore_score IS NULL THEN 1 ELSE 0 END) AS null_eco,
               SUM(CASE WHEN nova_group IS NULL THEN 1 ELSE 0 END) AS null_nova,
               SUM(CASE WHEN fiber_100g IS NULL THEN 1 ELSE 0 END) AS null_fiber,
               SUM(CASE WHEN energy_kcal_100g IS NULL THEN 1 ELSE 0 END) AS null_kcal
        FROM openfoodfacts_eu
    """).fetchone()
    con.close()

    bundle_path = DATA_DIR / "live_research_bundle.json"
    if bundle_path.exists():
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        bundle["openfoodfacts"] = off_list
        if isinstance(bundle.get("metadata", {}).get("sources"), list) and len(bundle["metadata"]["sources"]) > 1:
            bundle["metadata"]["sources"][1] = (
                f"Open Food Facts Search-a-licious API ({len(off_list):,} products, un-imputed NULLs preserved)"
            )
        bundle_path.write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")

    print(
        f"[OK] Saved {len(off_list)} clean OFF products -> openfoodfacts_eu.parquet "
        f"(null_country={stats[1]}, null_eco={stats[2]}, null_nova={stats[3]}, null_fiber={stats[4]}, null_kcal={stats[5]})"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Re-fetch from OFF API instead of raw cache")
    args = parser.parse_args()
    main(live=args.live)
