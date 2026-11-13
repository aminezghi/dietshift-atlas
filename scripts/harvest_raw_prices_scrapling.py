"""
harvest_raw_prices_scrapling.py
===============================
D4Vinci Scrapling (0.5.1) live harvester for real European retail shelf & receipt
prices from Open Food Facts Open Prices (https://prices.openfoodfacts.org/).
Preserves the existing `scrapling_retail_claims` schema while enriching every record
with observed EUR price, unit basis (KILOGRAM / UNIT), OSM store chain, EU country code,
city, NOVA group, and receipt observation date.
"""

import json
import time
from pathlib import Path
import duckdb
from scrapling import Fetcher

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_JSON = BASE_DIR / "public" / "data" / "scrapling_retail_claims.json"
OUT_PARQUET = BASE_DIR / "public" / "data" / "parquet" / "scrapling_retail_claims.parquet"
RAW_CACHE_DIR = BASE_DIR / "scripts" / ".raw_cache"
RAW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)

EU_COUNTRIES = {"FR", "DE", "IT", "ES", "NL", "BE", "AT", "PT", "PL", "SE", "GR", "LU", "IE", "FI", "DK"}


def classify_phenomenon(labels_tags: list, categories_tags: list, product_name: str) -> tuple[str, str]:
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


def main(max_pages: int = 20):
    print(f"[*] Crawling up to {max_pages} pages of live EU EUR prices via D4Vinci Scrapling 0.5.1...")
    raw_items = []
    seen_keys = set()

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

    with open(RAW_CACHE_DIR / "open_prices_raw.json", "w", encoding="utf-8") as f:
        json.dump(raw_items, f)

    curated = []
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

        labels = [str(l) for l in (prod.get("labels_tags") or []) if isinstance(l, str)]
        cats = [str(c) for c in (prod.get("categories_tags") or []) if isinstance(c, str)]
        fenomeno, primary_claim = classify_phenomenon(labels, cats, name)
        clean_labels = ", ".join(l.replace("en:", "").replace("fr:", "").replace("-", " ").title() for l in labels[:5]) or primary_claim

        nutriscore = str(prod.get("nutriscore_grade") or "UNKNOWN").upper()
        ecoscore = str(prod.get("ecoscore_grade") or "UNKNOWN").upper()
        nova_raw = prod.get("nova_group")
        nova_group = int(nova_raw) if str(nova_raw) in {"1", "2", "3", "4"} else None

        curated.append({
            "barcode": barcode,
            "product_name": name,
            "brand": (prod.get("brands") or "European Retail Brand").strip(),
            "fenomeno_category": fenomeno,
            "primary_claim": primary_claim,
            "labels_list": clean_labels,
            "energy_kcal": 0.0,
            "proteins_g": 0.0,
            "sugars_g": 0.0,
            "saturated_fats_g": 0.0,
            "carbohydrates_g": 0.0,
            "fiber_g": 0.0,
            "salt_g": 0.0,
            "nutriscore": nutriscore if nutriscore in {"A", "B", "C", "D", "E"} else "C",
            "ecoscore": ecoscore if ecoscore in {"A", "B", "C", "D", "E"} else "C",
            "nova_group": nova_group or 3,
            "image_url": prod.get("image_url") or "",
            "price_eur": price_val,
            "price_per": str(it.get("price_per") or "UNIT"),
            "retailer": retailer,
            "country_code": cc,
            "city": (loc.get("osm_address_city") or "").strip(),
            "observed_date": str(it.get("date") or ""),
            "scraped_with": "scrapling-0.5.1 (OpenPrices EU)",
        })

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(curated, f, indent=2, ensure_ascii=False)

    con = duckdb.connect()
    con.execute("CREATE OR REPLACE TABLE t AS SELECT * FROM read_json_auto(?)", [str(OUT_JSON)])
    con.execute(f"COPY t TO '{OUT_PARQUET}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    by_country = con.execute("SELECT country_code, COUNT(*), ROUND(MEDIAN(price_eur), 2) FROM t GROUP BY country_code ORDER BY COUNT(*) DESC").fetchall()
    con.close()

    print(f"[OK] Saved {len(curated)} unique live EU priced SKUs -> {OUT_JSON} & {OUT_PARQUET}")
    for cc, cnt, med in by_country:
        print(f"     {cc}: {cnt} SKUs | Median Price: EUR {med}")


if __name__ == "__main__":
    main()
