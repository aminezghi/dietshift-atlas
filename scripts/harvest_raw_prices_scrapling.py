"""
harvest_raw_prices_scrapling.py
===============================
D4Vinci Scrapling (0.5.1) harvester for European retail shelf & receipt prices
from Open Food Facts Open Prices (https://prices.openfoodfacts.org/), enriched
with genuine Open Food Facts nutritional panels (via search.openfoodfacts.org).

Data Integrity Guarantees:
- Missing nutritional fields remain NULL (never imputed as 0.0).
- Missing Nutri-Score, Eco-Score, or NOVA group remain NULL (never defaulted to 'C' or 3).
- Energy is derived from energy-kcal_100g, or energy-kj_100g / 4.184 when kcal is absent.
- Each record includes `nutrition_data_status` ('observed' | 'partial' | 'missing') and `data_source`.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import duckdb
from scrapling import Fetcher

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_JSON = BASE_DIR / "public" / "data" / "scrapling_retail_claims.json"
OUT_PARQUET = BASE_DIR / "public" / "data" / "parquet" / "scrapling_retail_claims.parquet"
RAW_CACHE_DIR = BASE_DIR / "scripts" / ".raw_cache"
RAW_PRICES_CACHE = RAW_CACHE_DIR / "open_prices_raw.json"
OFF_NUTR_CACHE = RAW_CACHE_DIR / "open_prices_off_nutriments.json"

RAW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)

EU_COUNTRIES = {"FR", "DE", "IT", "ES", "NL", "BE", "AT", "PT", "PL", "SE", "GR", "LU", "IE", "FI", "DK"}


def classify_phenomenon(labels_tags: list[str], categories_tags: list[str], product_name: str) -> tuple[str, str]:
    blob = " ".join(labels_tags + categories_tags + [product_name]).lower()
    if any(k in blob for k in ("vegan", "vegetarian", "plant-based", "soja", "soy", "oat", "legume", "tofu", "lentil")):
        return "Lifestyle (Plant-based)", "100% Vegetale / Plant-based"
    if any(k in blob for k in ("organic", "bio", "eu-organic", "biologique", "ecologico")):
        return "Organic & Sustainability", "EU Organic / Bio Certified"
    if any(k in blob for k in ("pdo", "pgi", "dop", "igp", "aoc", "terroir")):
        return "Terroir & Geographical Indication", "PDO / PGI Protected Terroir"
    if any(k in blob for k in ("protein", "proteine", "high-protein", "fibre", "fiber")):
        return "Functional / Rich-In", "Rich-In Protein / Fiber"
    if any(k in blob for k in ("gluten-free", "sans-gluten", "lactose-free", "no-palm-oil", "no-added-sugar")):
        return "Free-From & Clean Label", "Free-From Formulation"
    return "Standard Retail Basket", "Standard Packaged Food"


def _num_or_none(val: Any, digits: int = 2) -> float | None:
    if val is None or isinstance(val, bool):
        return None
    try:
        num = float(val)
    except (TypeError, ValueError):
        return None
    if num < 0 or num > 10000:
        return None
    return round(num, digits)


def fetch_open_prices(max_pages: int = 20) -> list[dict[str, Any]]:
    print(f"[*] Crawling up to {max_pages} pages of live EU EUR prices via D4Vinci Scrapling 0.5.1...")
    raw_items: list[dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        url = f"https://prices.openfoodfacts.org/api/v1/prices?size=100&page={page}&currency=EUR&order_by=-date"
        try:
            res = Fetcher.get(url, stealthy_headers=True)
            if res.status != 200:
                print(f"  [!] Page {page} HTTP {res.status}")
                continue
            payload = res.json()
            items = payload.get("items", [])
            if not items:
                break
            raw_items.extend(items)
        except Exception as exc:
            print(f"  [!] Page {page} error: {exc}")
        time.sleep(0.35)
    RAW_PRICES_CACHE.write_text(json.dumps(raw_items), encoding="utf-8")
    return raw_items


def fetch_off_nutriments_for_barcodes(barcodes: list[str], refresh: bool = False) -> dict[str, dict[str, Any]]:
    cached: dict[str, dict[str, Any]] = {}
    if OFF_NUTR_CACHE.exists() and not refresh:
        cached = json.loads(OFF_NUTR_CACHE.read_text(encoding="utf-8"))

    missing = [b for b in barcodes if b not in cached]
    if missing:
        print(f"[*] Fetching Open Food Facts nutrition panels for {len(missing)} barcodes in batches...")
        batch_size = 40
        for i in range(0, len(missing), batch_size):
            batch = missing[i : i + batch_size]
            q = "code:(" + " OR ".join(batch) + ")"
            url = f"https://search.openfoodfacts.org/search?q={urllib.parse.quote(q)}&page_size={batch_size}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "DietShiftAtlas/4.0 (Research)"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                found_in_batch = set()
                for hit in data.get("hits", []):
                    code = str(hit.get("code") or "").strip()
                    if not code:
                        continue
                    found_in_batch.add(code)
                    cached[code] = {
                        "nutriments": hit.get("nutriments") or {},
                        "nutriscore_grade": hit.get("nutriscore_grade"),
                        "ecoscore_grade": hit.get("ecoscore_grade"),
                        "nova_group": hit.get("nova_group"),
                        "serving_size": hit.get("serving_size"),
                    }
                for b in batch:
                    if b not in found_in_batch:
                        cached[b] = {}
            except Exception as exc:
                print(f"  [!] Batch {i // batch_size + 1} lookup warning: {exc}")
            time.sleep(0.15)
        OFF_NUTR_CACHE.write_text(json.dumps(cached), encoding="utf-8")
    return cached


def main(live_prices: bool = False, refresh_off: bool = False) -> None:
    if live_prices or not RAW_PRICES_CACHE.exists():
        raw_items = fetch_open_prices()
    else:
        raw_items = json.loads(RAW_PRICES_CACHE.read_text(encoding="utf-8"))
        print(f"[*] Loaded {len(raw_items)} cached Open Prices EU receipts from {RAW_PRICES_CACHE.name}")

    # First pass: collect valid EU items & unique barcodes
    filtered_items = []
    seen_keys = set()
    unique_barcodes = []
    seen_barcodes = set()

    for it in raw_items:
        prod = it.get("product") or {}
        loc = it.get("location") or {}
        cc = (loc.get("osm_address_country_code") or "").upper()
        if cc not in EU_COUNTRIES:
            continue
        name = (prod.get("product_name") or it.get("product_name") or "").strip()
        barcode = str(prod.get("code") or it.get("product_code") or "").strip()
        price = it.get("price")
        if not name or not barcode or price is None:
            continue
        try:
            price_val = round(float(price), 2)
        except (TypeError, ValueError):
            continue
        if price_val <= 0 or price_val > 150:
            continue

        retailer = (loc.get("osm_name") or "Independent Retailer").strip()
        dedup_key = (barcode, cc, retailer)
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)
        filtered_items.append((it, prod, loc, cc, name, barcode, price_val, retailer))
        if barcode not in seen_barcodes:
            seen_barcodes.add(barcode)
            unique_barcodes.append(barcode)

    off_lookup = fetch_off_nutriments_for_barcodes(unique_barcodes, refresh=refresh_off)

    curated = []
    status_counts = {"observed": 0, "partial": 0, "missing": 0}

    for it, prod, loc, cc, name, barcode, price_val, retailer in filtered_items:
        labels = [str(l) for l in (prod.get("labels_tags") or []) if isinstance(l, str)]
        cats = [str(c) for c in (prod.get("categories_tags") or []) if isinstance(c, str)]
        fenomeno, primary_claim = classify_phenomenon(labels, cats, name)
        clean_labels = (
            ", ".join(l.replace("en:", "").replace("fr:", "").replace("-", " ").title() for l in labels[:5])
            or primary_claim
        )

        off_rec = off_lookup.get(barcode) or {}
        nutr = off_rec.get("nutriments") or {}

        kcal = _num_or_none(nutr.get("energy-kcal_100g"), 1)
        if kcal is None:
            kj = _num_or_none(nutr.get("energy-kj_100g"), 1)
            if kj is not None:
                kcal = round(kj / 4.184, 1)

        proteins = _num_or_none(nutr.get("proteins_100g"), 2)
        sugars = _num_or_none(nutr.get("sugars_100g"), 2)
        sat_fats = _num_or_none(nutr.get("saturated-fat_100g"), 2)
        carbs = _num_or_none(nutr.get("carbohydrates_100g"), 2)
        fiber = _num_or_none(nutr.get("fiber_100g"), 2)
        salt = _num_or_none(nutr.get("salt_100g"), 3)

        present_count = sum(v is not None for v in (kcal, proteins, sugars, sat_fats, carbs, fiber, salt))
        if present_count >= 4:
            nutr_status = "observed"
        elif present_count >= 1:
            nutr_status = "partial"
        else:
            nutr_status = "missing"
        status_counts[nutr_status] += 1

        ns_raw = str(prod.get("nutriscore_grade") or off_rec.get("nutriscore_grade") or "").upper()
        es_raw = str(prod.get("ecoscore_grade") or off_rec.get("ecoscore_grade") or "").upper()
        nova_raw = prod.get("nova_group") if prod.get("nova_group") is not None else off_rec.get("nova_group")

        nutriscore = ns_raw if ns_raw in {"A", "B", "C", "D", "E"} else None
        ecoscore = es_raw if es_raw in {"A", "B", "C", "D", "E"} else None
        nova_group = int(nova_raw) if str(nova_raw) in {"1", "2", "3", "4"} else None

        prod_qty_raw = prod.get("product_quantity")
        prod_qty = _num_or_none(prod_qty_raw, 2)
        if prod_qty is not None and prod_qty <= 0:
            prod_qty = None
        qty_unit_raw = str(prod.get("product_quantity_unit") or "").strip().lower()
        prod_qty_unit = qty_unit_raw if (prod_qty is not None and qty_unit_raw in {"g", "kg", "mg", "ml", "cl", "l"}) else None
        if prod_qty_unit is None:
            prod_qty = None
        qty_label = str(prod.get("quantity") or "").strip() or None

        curated.append({
            "barcode": barcode,
            "product_name": name,
            "brand": (prod.get("brands") or "Unbranded / Store Brand").strip(),
            "fenomeno_category": fenomeno,
            "primary_claim": primary_claim,
            "labels_list": clean_labels,
            "energy_kcal": kcal,
            "proteins_g": proteins,
            "sugars_g": sugars,
            "saturated_fats_g": sat_fats,
            "carbohydrates_g": carbs,
            "fiber_g": fiber,
            "salt_g": salt,
            "nutrition_data_status": nutr_status,
            "nutriscore": nutriscore,
            "ecoscore": ecoscore,
            "nova_group": nova_group,
            "image_url": prod.get("image_url") or "",
            "price_eur": price_val,
            "price_per": str(it.get("price_per") or "UNIT"),
            "product_quantity": prod_qty,
            "product_quantity_unit": prod_qty_unit,
            "quantity_label": qty_label,
            "retailer": retailer,
            "country_code": cc,
            "city": (loc.get("osm_address_city") or "").strip(),
            "observed_date": str(it.get("date") or ""),
            "data_source": (
                "Open Prices EU + Open Food Facts" if nutr_status != "missing" else "Open Prices EU (no OFF nutrition)"
            ),
            "scraped_with": "scrapling-0.5.1 (OpenPrices EU)",
        })

    OUT_JSON.write_text(json.dumps(curated, indent=2, ensure_ascii=False), encoding="utf-8")

    con = duckdb.connect()
    con.execute("CREATE OR REPLACE TABLE t AS SELECT * FROM read_json_auto(?, sample_size=-1)", [str(OUT_JSON)])
    con.execute(f"COPY t TO '{OUT_PARQUET}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    by_country = con.execute(
        "SELECT country_code, COUNT(*), ROUND(MEDIAN(price_eur), 2) FROM t GROUP BY country_code ORDER BY COUNT(*) DESC"
    ).fetchall()
    con.close()

    print(f"[OK] Saved {len(curated)} EU retail SKUs -> {OUT_JSON.name} & {OUT_PARQUET.name}")
    print(f"     Nutrition status: {status_counts}")
    for cc, cnt, med in by_country:
        print(f"     {cc}: {cnt} SKUs | Median Price: EUR {med}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live-prices", action="store_true", help="Re-crawl Open Prices API instead of cached raw JSON")
    parser.add_argument("--refresh-off", action="store_true", help="Refresh OFF nutrition lookups")
    args = parser.parse_args()
    main(live_prices=args.live_prices, refresh_off=args.refresh_off)
