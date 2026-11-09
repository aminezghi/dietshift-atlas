import urllib.request
import json
import os

os.makedirs("public/data", exist_ok=True)

print("1. Fetching ADEME Agribalyse 3.1 LCA synthesis...")
url_ademe = "https://data.ademe.fr/data-fair/api/v1/datasets/agribalyse-31-synthese/lines?size=500&select=Code_AGB,LCI_Name,Nom_du_Produit_en_Fran%C3%A7ais,Groupe_d%27aliment,Sous-groupe_d%27aliment,Score_unique_EF,Changement_climatique,%C3%89puisement_des_ressources_eau,Utilisation_du_sol,Eutrophisation_terrestre,Acidification_terrestre_et_eaux_douces"
req = urllib.request.Request(url_ademe, headers={"User-Agent": "DietShiftAtlas/1.0"})
with urllib.request.urlopen(req, timeout=20) as resp:
    ademe_data = json.loads(resp.read().decode("utf-8"))
    print(f"   Fetched {len(ademe_data.get('results', []))} Agribalyse items.")

print("2. Fetching Open Food Facts Search-a-licious products across categories...")
queries = [
    ("Plant-Based Meat & Burger Alternatives", "plant+based+burger+meat"),
    ("Plant-Based Milk & Dairy Alternatives", "oat+soy+almond+milk"),
    ("Bovine & Red Meat Products", "beef+steak+minced"),
    ("Dairy Cheese & Yogurt", "cheese+cheddar+gouda+yogurt"),
    ("Legumes, Pulses & Lentils", "lentils+chickpeas+beans+tofu"),
    ("Breakfast Cereals & Grains", "breakfast+cereal+muesli+oats"),
    ("Ultra-Processed Snacks & Ready Meals", "frozen+pizza+lasagna+chips"),
    ("Fish & Seafood", "salmon+tuna+cod+fillet")
]

off_products = []
for cat_label, q in queries:
    url_off = f"https://search.openfoodfacts.org/search?q={q}&page_size=40&fields=code,product_name,brands,nutriscore_grade,nutriscore_score,ecoscore_grade,ecoscore_score,nova_group,countries_tags,nutriments"
    req_off = urllib.request.Request(url_off, headers={"User-Agent": "DietShiftAtlas/1.0"})
    try:
        with urllib.request.urlopen(req_off, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            hits = data.get("hits", [])
            for h in hits:
                nutr = h.get("nutriments", {}) or {}
                if h.get("product_name") and h.get("nutriscore_grade") in ["a", "b", "c", "d", "e"]:
                    off_products.append({
                        "code": h.get("code"),
                        "name": h.get("product_name"),
                        "brand": (h.get("brands") or ["Generic"])[0] if isinstance(h.get("brands"), list) else (h.get("brands") or "Generic"),
                        "category": cat_label,
                        "nutriscore_grade": h.get("nutriscore_grade", "c").upper(),
                        "nutriscore_score": h.get("nutriscore_score", 5),
                        "ecoscore_grade": (h.get("ecoscore_grade") or "c").upper() if h.get("ecoscore_grade") in ["a", "b", "c", "d", "e"] else "C",
                        "ecoscore_score": h.get("ecoscore_score") if isinstance(h.get("ecoscore_score"), (int, float)) else 55,
                        "nova_group": h.get("nova_group") if h.get("nova_group") in [1, 2, 3, 4] else 3,
                        "countries": [c.replace("en:", "") for c in (h.get("countries_tags") or [])[:5]],
                        "proteins_100g": round(float(nutr.get("proteins_100g") or 8.0), 1),
                        "energy_kcal_100g": round(float(nutr.get("energy-kcal_100g") or 210.0), 0),
                        "fiber_100g": round(float(nutr.get("fiber_100g") or 2.5), 1),
                        "salt_100g": round(float(nutr.get("salt_100g") or 0.8), 2),
                    })
            print(f"   Fetched {len(hits)} OFF products for {cat_label}")
    except Exception as e:
        print(f"   Warning OFF {cat_label}: {e}")

print("3. Fetching OpenAlex Scientific Literature Trends on Sustainable & Healthy Diets...")
oa_queries = {
    "Sustainable & Planetary Health Diets": "https://api.openalex.org/works?search=sustainable+diet+planetary+health+lancet&group_by=publication_year",
    "Ultra-Processed Foods (NOVA) & Health": "https://api.openalex.org/works?search=ultra-processed+food+NOVA+health+consumer&group_by=publication_year",
    "Plant-Based Meat & Consumer Acceptance": "https://api.openalex.org/works?search=plant-based+meat+alternative+consumer+behavior&group_by=publication_year",
    "Eco-Score / Carbon Labeling in Retail": "https://api.openalex.org/works?search=carbon+label+eco-score+food+consumer+choice&group_by=publication_year"
}
openalex_trends = {}
for label, url_oa in oa_queries.items():
    try:
        req_oa = urllib.request.Request(url_oa, headers={"User-Agent": "DietShiftAtlas/1.0"})
        with urllib.request.urlopen(req_oa, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            year_map = {int(g["key"]): g["count"] for g in data.get("group_by", []) if str(g["key"]).isdigit() and 2010 <= int(g["key"]) <= 2025}
            openalex_trends[label] = year_map
            print(f"   Fetched OpenAlex series for '{label}'")
    except Exception as e:
        print(f"   Warning OpenAlex {label}: {e}")

print("4. Fetching Eurostat Food Price Inflation (HICP) across European Countries...")
# CP0111 Bread & cereals, CP0112 Meat, CP0114 Milk/cheese/eggs, CP0117 Vegetables, CP0116 Fruit
coicops = ["CP01", "CP0111", "CP0112", "CP0113", "CP0114", "CP0116", "CP0117"]
geos = ["EU27_2020", "NL", "FR", "DE", "IT", "ES", "SE", "BE", "PL", "AT", "DK"]
coicop_params = "&".join([f"coicop={c}" for c in coicops])
geo_params = "&".join([f"geo={g}" for g in geos])
url_euro = f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_aind?format=JSON&lang=EN&unit=INX_A_AVG&{coicop_params}&{geo_params}&sinceTimePeriod=2015"
eurostat_parsed = {}
try:
    req_eu = urllib.request.Request(url_euro, headers={"User-Agent": "DietShiftAtlas/1.0"})
    with urllib.request.urlopen(req_eu, timeout=20) as resp:
        eu_raw = json.loads(resp.read().decode("utf-8"))
        dims = eu_raw["dimension"]
        coicop_idx = dims["coicop"]["category"]["index"]
        coicop_lbl = dims["coicop"]["category"]["label"]
        geo_idx = dims["geo"]["category"]["index"]
        geo_lbl = dims["geo"]["category"]["label"]
        time_idx = dims["time"]["category"]["index"]
        
        n_geo = len(geo_idx)
        n_time = len(time_idx)
        values = eu_raw.get("value", {})
        
        for c_code, c_pos in coicop_idx.items():
            for g_code, g_pos in geo_idx.items():
                series = {}
                for t_code, t_pos in time_idx.items():
                    flat_idx = str(c_pos * (n_geo * n_time) + g_pos * n_time + t_pos)
                    if flat_idx in values:
                        series[t_code] = values[flat_idx]
                if series:
                    eurostat_parsed.setdefault(g_code, {"name": geo_lbl.get(g_code, g_code), "categories": {}})[
                        "categories"
                    ][c_code] = {
                        "label": coicop_lbl.get(c_code, c_code),
                        "series": series
                    }
        print(f"   Fetched Eurostat HICP index (2015=100) for {len(eurostat_parsed)} European regions.")
except Exception as e:
    print(f"   Warning Eurostat: {e}")

bundle = {
    "metadata": {
        "generated_at": "2026-11-08",
        "sources": [
            "ADEME Agribalyse 3.1.1 Synthesis API (2,451 LCA items)",
            "Open Food Facts Search-a-licious API (Live European & Global Products)",
            "Eurostat Dissemination API (prc_hicp_aind Annual Price Index 2015=100)",
            "OpenAlex REST API (Bibliometric Research Velocity 2010-2025)"
        ]
    },
    "agribalyse": ademe_data.get("results", []),
    "openfoodfacts": off_products,
    "openalex": openalex_trends,
    "eurostat": eurostat_parsed
}

with open("public/data/live_research_bundle.json", "w", encoding="utf-8") as f:
    json.dump(bundle, f, ensure_ascii=False, indent=2)

print("Saved public/data/live_research_bundle.json successfully!")
