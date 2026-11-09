"""
scraple_italian_retail_claims.py
================================
Harvests real live Italian food retail items and claim signals matching the GS1 Italy
Osservatorio Immagino taxonomy using D4Vinci's `scrapling` library.

Outputs:
- `public/data/parquet/scrapling_retail_claims.parquet`
- `public/data/scrapling_retail_claims.json`
"""

import os
import json
import time
import duckdb
from scrapling import Fetcher

HEADERS = {
    "User-Agent": "DietShiftAtlas-Research/1.0 (https://github.com/aminezghi/vellum; research-bot@dietshift.atlas)"
}

TARGET_FENOMENI = [
    {
        "fenomeno": "Lifestyle (Plant-based)",
        "query": "categories_tags_en=plant-based-foods",
        "sample_size": 25,
        "primary_claim": "100% Vegetale / Plant-based"
    },
    {
        "fenomeno": "Free From (Senza Glutine)",
        "query": "categories_tags_en=gluten-free-foods",
        "sample_size": 25,
        "primary_claim": "Senza glutine (Spiga barrata AIC)"
    },
    {
        "fenomeno": "Free From (Senza Lattosio)",
        "query": "categories_tags_en=lactose-free-foods",
        "sample_size": 20,
        "primary_claim": "Senza lattosio / Delattosato"
    },
    {
        "fenomeno": "Rich-in (High Protein)",
        "query": "search_terms=proteine",
        "sample_size": 20,
        "primary_claim": "Ricco in proteine / High Protein"
    },
    {
        "fenomeno": "Super Ingredienti (Avena & Semi)",
        "query": "search_terms=avena",
        "sample_size": 20,
        "primary_claim": "Avena / Semi di Chia / Semi di Lino"
    },
    {
        "fenomeno": "Italianità & DOP/IGP",
        "query": "search_terms=dop",
        "sample_size": 20,
        "primary_claim": "100% Italiano / DOP / IGP"
    },
    {
        "fenomeno": "Sostenibilità & Bio",
        "query": "search_terms=biologico",
        "sample_size": 20,
        "primary_claim": "Biologico Certificato / Packaging Riciclabile"
    }
]

def harvest():
    print("Initiating Scrapling harvest of live Italian retail food products...")
    all_products = []
    seen_barcodes = set()

    for item in TARGET_FENOMENI:
        fenomeno = item["fenomeno"]
        query = item["query"]
        claim_label = item["primary_claim"]
        size = item["sample_size"]

        url = (
            f"https://it.openfoodfacts.org/api/v2/search?"
            f"countries_tags_en=italy&{query}&page_size={size}"
            f"&fields=code,product_name,brands,nutriments,labels_tags,categories_tags,ecoscore_grade,nutriscore_grade,packaging_tags,image_front_small_url"
        )
        print(f"[*] Scrapling fetching category: {fenomeno}...")

        for attempt in range(3):
            try:
                time.sleep(1.8)  # respectful pacing
                res = Fetcher.get(url, headers=HEADERS)
                if res.status == 200:
                    data = res.json()
                    products = data.get("products", [])
                    print(f"    [+] Retrieved {len(products)} products for {fenomeno}")

                    for p in products:
                        barcode = str(p.get("code", "")).strip()
                        if not barcode or barcode in seen_barcodes:
                            continue

                        name = p.get("product_name", "").strip()
                        if not name:
                            continue

                        seen_barcodes.add(barcode)
                        brands = p.get("brands", "Marchio Italiano").strip()
                        nutriments = p.get("nutriments", {})
                        labels = p.get("labels_tags", [])
                        
                        clean_labels = [l.replace("en:", "").replace("it:", "").replace("-", " ").title() for l in labels if isinstance(l, str)][:6]

                        energy_kcal = float(nutriments.get("energy-kcal_100g") or nutriments.get("energy-kcal") or 0.0)
                        proteins = float(nutriments.get("proteins_100g") or nutriments.get("proteins") or 0.0)
                        sugars = float(nutriments.get("sugars_100g") or nutriments.get("sugars") or 0.0)
                        sat_fats = float(nutriments.get("saturated-fat_100g") or nutriments.get("saturated-fat") or 0.0)
                        fiber = float(nutriments.get("fiber_100g") or nutriments.get("fiber") or 0.0)
                        salt = float(nutriments.get("salt_100g") or nutriments.get("salt") or 0.0)
                        carbs = float(nutriments.get("carbohydrates_100g") or nutriments.get("carbohydrates") or 0.0)

                        nutriscore = (p.get("nutriscore_grade") or "N/A").upper()
                        ecoscore = (p.get("ecoscore_grade") or "N/A").upper()
                        img_url = p.get("image_front_small_url") or ""

                        all_products.append({
                            "barcode": barcode,
                            "product_name": name,
                            "brand": brands,
                            "fenomeno_category": fenomeno,
                            "primary_claim": claim_label,
                            "labels_list": ", ".join(clean_labels) if clean_labels else claim_label,
                            "energy_kcal": energy_kcal,
                            "proteins_g": proteins,
                            "sugars_g": sugars,
                            "saturated_fats_g": sat_fats,
                            "carbohydrates_g": carbs,
                            "fiber_g": fiber,
                            "salt_g": salt,
                            "nutriscore": nutriscore,
                            "ecoscore": ecoscore,
                            "image_url": img_url,
                            "scraped_with": "scrapling-0.5.1"
                        })
                    break
                else:
                    print(f"    [!] Status {res.status}, retrying ({attempt+1}/3)...")
                    time.sleep(2.5)
            except Exception as e:
                print(f"    [!] Error during scraping {query}: {e}")
                time.sleep(2.0)

    print(f"\n[DONE] Total unique Italian retail products harvested: {len(all_products)}")

    # Write JSON
    json_path = "public/data/scrapling_retail_claims.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_products, f, indent=2, ensure_ascii=False)
    print(f"[OK] Saved {len(all_products)} records to {json_path}")

    # Write Parquet via DuckDB
    os.makedirs("public/data/parquet", exist_ok=True)
    parquet_path = "public/data/parquet/scrapling_retail_claims.parquet"
    con = duckdb.connect()
    con.execute(f"""
        CREATE TABLE scrapling_claims AS 
        SELECT * FROM read_json_auto('{json_path}')
    """)
    con.execute(f"COPY scrapling_claims TO '{parquet_path}' (FORMAT PARQUET, COMPRESSION SNAPPY)")
    print(f"[OK] Saved {len(all_products)} records to {parquet_path}")

if __name__ == "__main__":
    harvest()
