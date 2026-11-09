"""
harvest_pan_eu_retail_claims.py
===============================
On-demand D4Vinci Scrapling harvester for Pan-European grocery items and claims.
Supports targeting specific EU countries (IT, FR, DE, ES, NL, BE, PL, SE, AT, PT).

Usage:
  python scripts/harvest_pan_eu_retail_claims.py --country FR --limit 20
"""

import sys
import os
import json
import time
import argparse
import duckdb
from scrapling import Fetcher

HEADERS = {
    "User-Agent": "DietShiftAtlas-PanEU/2.0 (https://github.com/aminezghi/vellum; research@dietshift.atlas)"
}

COUNTRY_MAP = {
    "IT": {"name": "Italy", "tag": "italy"},
    "FR": {"name": "France", "tag": "france"},
    "DE": {"name": "Germany", "tag": "germany"},
    "ES": {"name": "Spain", "tag": "spain"},
    "NL": {"name": "Netherlands", "tag": "netherlands"},
    "BE": {"name": "Belgium", "tag": "belgium"},
    "PL": {"name": "Poland", "tag": "poland"},
    "SE": {"name": "Sweden", "tag": "sweden"},
    "AT": {"name": "Austria", "tag": "austria"},
    "PT": {"name": "Portugal", "tag": "portugal"}
}

CATEGORIES = [
    {"pillar": "Plant-Based & Lifestyle", "query": "categories_tags_en=plant-based-foods"},
    {"pillar": "Clean Label & Free-From", "query": "categories_tags_en=gluten-free-foods"},
    {"pillar": "Functional & Rich-In", "query": "search_terms=protein"},
    {"pillar": "Organic & Circular Packaging", "query": "search_terms=organic"},
    {"pillar": "Terroir & Certified Origin", "query": "search_terms=dop"}
]

def harvest_country(country_code="FR", limit=15):
    c_info = COUNTRY_MAP.get(country_code.upper())
    if not c_info:
        print(f"Unknown country code: {country_code}. Supported: {list(COUNTRY_MAP.keys())}")
        return

    c_name = c_info["name"]
    c_tag = c_info["tag"]
    print(f"[*] Initiating Scrapling harvest for {c_name} (Code: {country_code})...")

    harvested = []
    seen = set()

    for cat in CATEGORIES:
        pillar = cat["pillar"]
        query = cat["query"]
        url = (
            f"https://world.openfoodfacts.org/api/v2/search?"
            f"countries_tags_en={c_tag}&{query}&page_size={limit}"
            f"&fields=code,product_name,brands,nutriments,labels_tags,categories_tags,ecoscore_grade,nutriscore_grade"
        )
        print(f"    -> Crawling pillar: {pillar}...")

        try:
            time.sleep(1.2)
            res = Fetcher.get(url, headers=HEADERS)
            if res.status == 200:
                data = res.json()
                products = data.get("products", [])
                for p in products:
                    bc = str(p.get("code", "")).strip()
                    if not bc or bc in seen:
                        continue
                    name = p.get("product_name", "").strip()
                    if not name:
                        continue

                    seen.add(bc)
                    nutriments = p.get("nutriments", {})
                    labels = p.get("labels_tags", [])
                    clean_labels = [l.replace("en:", "").replace("-", " ").title() for l in labels if isinstance(l, str)][:5]

                    harvested.append({
                        "country_code": country_code.upper(),
                        "country_name": c_name,
                        "barcode": bc,
                        "product_name": name,
                        "brand": p.get("brands", "National Retail Brand").strip(),
                        "category_pillar": pillar,
                        "claims_list": ", ".join(clean_labels) if clean_labels else pillar,
                        "energy_kcal": float(nutriments.get("energy-kcal_100g") or nutriments.get("energy-kcal") or 0.0),
                        "proteins_g": float(nutriments.get("proteins_100g") or nutriments.get("proteins") or 0.0),
                        "sugars_g": float(nutriments.get("sugars_100g") or nutriments.get("sugars") or 0.0),
                        "saturated_fats_g": float(nutriments.get("saturated-fat_100g") or nutriments.get("saturated-fat") or 0.0),
                        "fiber_g": float(nutriments.get("fiber_100g") or nutriments.get("fiber") or 0.0),
                        "salt_g": float(nutriments.get("salt_100g") or nutriments.get("salt") or 0.0),
                        "nutriscore": (p.get("nutriscore_grade") or "N/A").upper(),
                        "ecoscore": (p.get("ecoscore_grade") or "N/A").upper(),
                        "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S")
                    })
            else:
                print(f"       [!] Status {res.status} for {pillar}")
        except Exception as e:
            print(f"       [!] Error scraping {pillar}: {e}")

    print(f"[OK] Harvested {len(harvested)} items for {c_name}.")
    
    # Append/save to JSON
    out_dir = "public/data/pan_eu_scrapes"
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, f"scrape_{country_code.lower()}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(harvested, f, indent=2, ensure_ascii=False)
    print(f"[OK] Saved to {out_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", default="FR", help="Country code e.g. FR, DE, ES")
    parser.add_argument("--limit", type=int, default=10, help="Products per category")
    args = parser.parse_args()
    harvest_country(args.country, args.limit)
