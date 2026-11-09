"""
build_gs1_immagino_parquet.py
=============================
Parses and compiles structured data from the 96-page GS1 Italy Osservatorio Immagino
(19th Edition, 2026-1) report into a high-performance DuckDB-compatible Parquet table:
- `public/data/parquet/gs1_immagino_observatory.parquet`
- `public/data/gs1_immagino_bundle.json`

Dataset covers:
1. Metaprodotto Immagino (Nutritional basket composition across 84,817 food products: kcal, carbs, sugars, fats, sat fats, proteins, fiber, salt).
2. Metaprodotto Innovazione (6,422 newly launched/reformulated food products in 2025 vs. standard baseline).
3. Push vs. Pull Econometrics across key FMCG claims (Offer volume/value vs Demand sell-out changes).
4. The 10 Fenomeni di Consumo (Italianità, Free From, Rich-in, Super ingredienti, Sostenibilità, Lifestyle/Plant-based, Qualità & Tradizione, Petfood, Cura Persona, Cura Casa Green).
5. E-Commerce Over-Indexing Index (Zinc 952, Bio-based 328, Coconut water 321, vs DOP 30, 100% Italiano 86).
6. Regionalità delle eccellenze (20 Italian regions sell-out, product count, and growth rates).
"""

import json
import os
import duckdb

# --- 1. METAPRODOTTO IMMAGINO & INNOVAZIONE 2025 (p. 8 - 18) ---
metaprodotto_records = [
    # Department-level nutritional values per 100g/ml
    {
        "record_type": "metaprodotto_macro",
        "category": "Drogheria Alimentare",
        "product_count": 39420,
        "energy_kcal": 283.1,
        "carbohydrates_g": 38.4,
        "sugars_g": 14.1,
        "fats_g": 10.7,
        "saturated_fats_g": 3.9,
        "proteins_g": 6.8,
        "fibers_g": 2.8,
        "salt_g": 0.85,
        "innovation_delta_kcal_pct": -8.4,
        "innovation_delta_sugars_pct": +18.2,  # sweet snacks innovation had higher sugar
        "innovation_delta_sat_fats_pct": +7.4,
        "innovation_delta_proteins_pct": +4.1,
        "notes": "Dry grocery & pantry staples; snack launches showed slight fat/sugar push"
    },
    {
        "record_type": "metaprodotto_macro",
        "category": "Fresco (Dairy, Deli, Fresh)",
        "product_count": 24150,
        "energy_kcal": 141.5,
        "carbohydrates_g": 6.2,
        "sugars_g": 4.1,
        "fats_g": 8.9,
        "saturated_fats_g": 5.1,
        "proteins_g": 8.4,
        "fibers_g": 0.7,
        "salt_g": 1.12,
        "innovation_delta_kcal_pct": +0.1,
        "innovation_delta_sugars_pct": -4.2,
        "innovation_delta_sat_fats_pct": -2.8,
        "innovation_delta_proteins_pct": +12.5,  # high protein yogurts/cheeses surge
        "notes": "Chilled dairy & meat; strong high-protein reformation wave"
    },
    {
        "record_type": "metaprodotto_macro",
        "category": "Freddo e Surgelati (Frozen)",
        "product_count": 7890,
        "energy_kcal": 152.2,
        "carbohydrates_g": 16.4,
        "sugars_g": 3.8,
        "fats_g": 5.8,
        "saturated_fats_g": 2.1,
        "proteins_g": 7.1,
        "fibers_g": 2.4,
        "salt_g": 0.94,
        "innovation_delta_kcal_pct": +47.5,  # Frozen desserts and rich plant-based ready meals
        "innovation_delta_sugars_pct": +31.0,
        "innovation_delta_sat_fats_pct": +18.2,
        "innovation_delta_proteins_pct": +8.9,
        "notes": "Frozen ready meals and ice-creams with high caloric density in 2025"
    },
    {
        "record_type": "metaprodotto_macro",
        "category": "Bevande (Non-Alcoholic)",
        "product_count": 13357,
        "energy_kcal": 35.7,
        "carbohydrates_g": 8.2,
        "sugars_g": 7.9,
        "fats_g": 0.1,
        "saturated_fats_g": 0.0,
        "proteins_g": 0.3,
        "fibers_g": 0.3,
        "salt_g": 0.03,
        "innovation_delta_kcal_pct": +11.8,
        "innovation_delta_sugars_pct": +5.4,
        "innovation_delta_sat_fats_pct": 0.0,
        "innovation_delta_proteins_pct": +18.5,  # Plant milks & protein RTD shakes
        "notes": "Beverages; functional drinks & plant-based milks boost protein"
    },
    {
        "record_type": "metaprodotto_total",
        "category": "Totale Metaprodotto Alimentare GS1",
        "product_count": 84817,
        "energy_kcal": 173.9,
        "carbohydrates_g": 18.3,
        "sugars_g": 7.6,
        "fats_g": 7.1,
        "saturated_fats_g": 2.9,
        "proteins_g": 6.6,
        "fibers_g": 2.2,
        "salt_g": 0.74,
        "innovation_delta_kcal_pct": -10.0,
        "innovation_delta_sugars_pct": -3.9,
        "innovation_delta_sat_fats_pct": -1.2,
        "innovation_delta_proteins_pct": +6.8,
        "notes": "Full GS1 basket weighted average: 6,422 innovation products reduced calories by -10% and sugars by -3.9%"
    }
]

# --- 2. THE 10 FENOMENI DI CONSUMO (p. 20 - 75) ---
fenomeni_records = [
    {
        "fenomeno_id": 1,
        "name": "Italianità",
        "description": "100% Italiano, Bandiera Italiana, Prodotto in Italia, DOP/IGP/DOC/DOCG",
        "product_count": 28817,
        "sellout_millions_eur": 13300.0,
        "sales_value_pct_change": +3.8,
        "sales_volume_pct_change": +0.9,
        "share_of_total_grocery_sales_pct": 28.2,
        "top_claims": "Bandiera italiana (17.2k prod, 7.8B€), 100% Italiano (10.1k prod, 5.2B€), DOC/DOCG (4.3k prod, 1.4B€)",
        "trend_assessment": "Resilient cornerstone; volume slightly positive despite inflationary pressure."
    },
    {
        "fenomeno_id": 2,
        "name": "Free From",
        "description": "Senza glutine, Senza lattosio, Senza zuccheri aggiunti, Senza conservanti, Senza olio di palma",
        "product_count": 22480,
        "sellout_millions_eur": 12590.0,
        "sales_value_pct_change": +5.2,
        "sales_volume_pct_change": +2.1,
        "share_of_total_grocery_sales_pct": 26.7,
        "top_claims": "Senza conservanti (10.9k prod, 4.8B€), Senza glutine (9.5k prod, 4.3B€), Senza lattosio (3.6k prod, 2.3B€)",
        "trend_assessment": "Dynamic pull; lactose-free (+4.4% val) and added-sugar-free (+8.1% val) outpace inflation."
    },
    {
        "fenomeno_id": 3,
        "name": "Rich-in (Alimenti Funzionali)",
        "description": "Proteine, Fibre, Vitamine, Magnesio, Calcio, Zinco, Omega 3, Probiotici",
        "product_count": 12077,
        "sellout_millions_eur": 5940.0,
        "sales_value_pct_change": +7.9,
        "sales_volume_pct_change": +4.3,
        "share_of_total_grocery_sales_pct": 12.6,
        "top_claims": "Proteine (+12.4% val, +9.9% push), Fibre (+5.1% val), Vitamine (+3.4% val), Magnesio (+9.8% val)",
        "trend_assessment": "Highest positive demand driver in the basket; protein-enriched food remains an unstoppable phenomenon."
    },
    {
        "fenomeno_id": 4,
        "name": "Super Ingredienti & Wellness",
        "description": "Avena, Mandorla, Noci, Zenzero, Semi di lino, Semi di chia, Mirtillo, Curcuma, Spirulina, Farro",
        "product_count": 15585,
        "sellout_millions_eur": 5790.0,
        "sales_value_pct_change": +4.1,
        "sales_volume_pct_change": +1.5,
        "share_of_total_grocery_sales_pct": 12.3,
        "top_claims": "Avena (1.4B€, +6.3% vol), Mandorla (890M€), Semi di Chia (+41.1% pull surge!), Noci (+4.8% val)",
        "trend_assessment": "Specific nutrient powerhouses expanding from breakfast cereals to yogurts and bread."
    },
    {
        "fenomeno_id": 5,
        "name": "Sostenibilità Ambientale & Packaging",
        "description": "Riciclabile, Packaging sostenibile, Certificazioni eco (FSC, PEFC, Rainforest, Ecolabel), Biologico",
        "product_count": 128855,
        "sellout_millions_eur": 53500.0,
        "sales_value_pct_change": +3.4,
        "sales_volume_pct_change": +0.4,
        "share_of_total_grocery_sales_pct": 85.2,
        "top_claims": "Indicazioni smaltimento packaging (112k prod, 44.8B€), Materiali riciclati (+14.5% val), Biologico (8.7k prod, 3.4B€)",
        "trend_assessment": "Environmental labels are now the baseline table stakes; circular packaging and bio-based plastics over-index in e-commerce."
    },
    {
        "fenomeno_id": 6,
        "name": "Lifestyle (Plant-Based & Veg)",
        "description": "Vegetariano, Vegano, Plant-based 100% vegetale, Kosher, Halal",
        "product_count": 5776,
        "sellout_millions_eur": 3150.0,
        "sales_value_pct_change": +36.2,  # exceptional surge in dedicated plant-based claim
        "sales_volume_pct_change": +34.0,
        "share_of_total_grocery_sales_pct": 6.7,
        "top_claims": "Plant-based (+36.2% val, +34.0% vol), Vegetariano (3.9k prod, 2.1B€), Vegano (2.8k prod, 1.4B€)",
        "trend_assessment": "Sensational resurgence: 'Plant-based' explicit wording exploded in volume (+34%) replacing generic veg claims."
    },
    {
        "fenomeno_id": 7,
        "name": "Qualità e Tradizione (Gourmet & Artigianalità)",
        "description": "Trafilata al bronzo, Lavorazione artigianale, Estratto a freddo, Lievitazione naturale, Filiera controllata",
        "product_count": 6867,
        "sellout_millions_eur": 3520.0,
        "sales_value_pct_change": +4.6,
        "sales_volume_pct_change": +1.1,
        "share_of_total_grocery_sales_pct": 7.5,
        "top_claims": "Trafilata al bronzo (+6.2% val), Estratto a freddo (+7.8% val), Lavorazione tradizionale (+3.2% val)",
        "trend_assessment": "Process-certified quality commands strong pricing premiums in pasta, oils, and bakery."
    },
    {
        "fenomeno_id": 8,
        "name": "Petcare & Petfood",
        "description": "Cibo animali ricette naturali, Ricco di carni, Grain-free, Monoproteico, Con verdure",
        "product_count": 4056,
        "sellout_millions_eur": 1200.0,
        "sales_value_pct_change": +6.4,
        "sales_volume_pct_change": +2.3,
        "share_of_total_grocery_sales_pct": 2.5,
        "top_claims": "Monoproteico (+9.2% val), Grain-free (+11.4% val), Naturale (+5.8% val)",
        "trend_assessment": "Humanization of pets drives premium free-from and single-protein formulations."
    },
    {
        "fenomeno_id": 9,
        "name": "Cura Persona (Personal Care Green)",
        "description": "Naturale, Biologico, Senza siliconi, Senza parabeni, Cruelty free, Pelli sensibili",
        "product_count": 8385,
        "sellout_millions_eur": 1350.0,
        "sales_value_pct_change": +5.8,
        "sales_volume_pct_change": +1.8,
        "share_of_total_grocery_sales_pct": 2.9,
        "top_claims": "Pelli sensibili (+7.4% val), Senza siliconi (+6.1% val), Biologico cosmetico (+4.2% val)",
        "trend_assessment": "Dermatological transparency and clean beauty gaining retail shelf space."
    },
    {
        "fenomeno_id": 10,
        "name": "Cura Casa Green (Home Care Eco)",
        "description": "Ipoallergenico, Eco-detergenza, Senza fosfati, Plastica riciclata, Nichel tested",
        "product_count": 2596,
        "sellout_millions_eur": 817.0,
        "sales_value_pct_change": -3.1,
        "sales_volume_pct_change": -7.8,
        "share_of_total_grocery_sales_pct": 1.7,
        "top_claims": "Plastica riciclata (+2.4% val), Nichel tested (+1.1% val), Ipoallergenico (-4.5% val)",
        "trend_assessment": "Contraction phase: green home care suffered unit volume loss due to price cuts in standard private labels."
    }
]

# --- 3. PUSH VS. PULL CLAIM ECONOMETRICS (p. 25, 34, 42, 51, 62) ---
push_pull_claims = [
    # Claim, Category, Push (Offer expansion %), Pull (Demand sell-out volume growth %), Value change %
    {"claim": "Plant-based", "theme": "Lifestyle", "push_pct": +28.5, "pull_pct": +34.0, "value_change_pct": +36.2, "status": "Hyper-Expansion"},
    {"claim": "Proteine", "theme": "Rich-in", "push_pct": +9.9, "pull_pct": +1.6, "value_change_pct": +12.4, "status": "Manufacturer Push"},
    {"claim": "Semi di chia", "theme": "Super Ingredienti", "push_pct": +8.2, "pull_pct": +41.1, "value_change_pct": +43.8, "status": "Consumer Pull Spike"},
    {"claim": "Senza lattosio", "theme": "Free From", "push_pct": +4.4, "pull_pct": +3.3, "value_change_pct": +7.1, "status": "Balanced Growth"},
    {"claim": "Senza nitriti", "theme": "Free From", "push_pct": +6.1, "pull_pct": +10.3, "value_change_pct": +12.0, "status": "Consumer Pull Clean-Meat"},
    {"claim": "Residuo zero", "theme": "Sostenibilità", "push_pct": +7.3, "pull_pct": +14.8, "value_change_pct": +16.2, "status": "High Demand Pull"},
    {"claim": "Avena", "theme": "Super Ingredienti", "push_pct": +5.4, "pull_pct": +6.3, "value_change_pct": +8.5, "status": "Sustained Growth"},
    {"claim": "Senza zuccheri aggiunti", "theme": "Free From", "push_pct": +3.8, "pull_pct": +4.9, "value_change_pct": +8.1, "status": "Strong Pull"},
    {"claim": "Zinco", "theme": "Rich-in", "push_pct": +11.2, "pull_pct": +15.4, "value_change_pct": +18.9, "status": "E-Commerce Star"},
    {"claim": "100% Italiano", "theme": "Italianità", "push_pct": +1.2, "pull_pct": +0.8, "value_change_pct": +3.5, "status": "Mature Stability"},
    {"claim": "Biologico", "theme": "Sostenibilità", "push_pct": -1.1, "pull_pct": +0.4, "value_change_pct": +2.1, "status": "Saturated Baseline"},
    {"claim": "Senza olio di palma", "theme": "Free From", "push_pct": -3.2, "pull_pct": -1.5, "value_change_pct": +0.2, "status": "Declining Novelty"},
    {"claim": "Cruelty free", "theme": "Cura Persona", "push_pct": +4.2, "pull_pct": +5.9, "value_change_pct": +7.3, "status": "Healthy Pull"},
    {"claim": "Monoproteico", "theme": "Petcare", "push_pct": +7.8, "pull_pct": +9.2, "value_change_pct": +11.5, "status": "Rapid Adoption"}
]

# --- 4. E-COMMERCE VS. IN-STORE OVER-INDEXING (p. 80 - 87) ---
# Index: 100 = parity between online grocery basket and physical supermarket basket
ecommerce_overindexing = [
    {"attribute": "Zinco (Zinc)", "index_value": 952, "type": "Micro-nutriente", "basket_preference": "Massive E-Commerce skew", "rationale": "Specialty functional wellness and supplements bought online"},
    {"attribute": "Dolcificanti ipocalorici", "index_value": 621, "type": "Keto/Diet claim", "basket_preference": "Massive E-Commerce skew", "rationale": "Fitness & dietary management purchases"},
    {"attribute": "Bio-based packaging", "index_value": 328, "type": "Packaging Eco", "basket_preference": "High E-Commerce skew", "rationale": "Conscious digital consumer seeking progressive eco-materials"},
    {"attribute": "Acqua di cocco", "index_value": 321, "type": "Super ingrediente", "basket_preference": "High E-Commerce skew", "rationale": "Hydration specialty niches absent in small discount formats"},
    {"attribute": "Lievito-free / Senza lievito", "index_value": 239, "type": "Free From", "basket_preference": "High E-Commerce skew", "rationale": "Digestive intolerance specific searches"},
    {"attribute": "Residuo zero (Pesticide free)", "index_value": 198, "type": "Agricoltura Pulita", "basket_preference": "Strong E-Commerce skew", "rationale": "High-income urban shoppers ordering delivery"},
    {"attribute": "Senza glutine certificato AIC", "index_value": 145, "type": "Free From", "basket_preference": "Moderate E-Commerce skew", "rationale": "Bulk purchasing of gluten-free essentials"},
    {"attribute": "Proteine isolate / High Protein", "index_value": 142, "type": "Rich-in", "basket_preference": "Moderate E-Commerce skew", "rationale": "Active gym consumers buying bundles"},
    {"attribute": "Biologico (Organic)", "index_value": 118, "type": "Sostenibilità", "basket_preference": "Slight E-Commerce skew", "rationale": "Organic products perform better in digital baskets"},
    {"attribute": "Senza conservanti", "index_value": 104, "type": "Free From", "basket_preference": "Parity", "rationale": "Standard supermarket staple matching digital prevalence"},
    {"attribute": "100% Italiano", "index_value": 86, "type": "Italianità", "basket_preference": "In-Store skew", "rationale": "Dominant in physical hypermarkets/supermarkets, slightly diluted online by imported niche brands"},
    {"attribute": "DOP / IGP (Denominazione Origine)", "index_value": 30, "type": "Qualità e Tradizione", "basket_preference": "Extreme In-Store skew", "rationale": "Fresh cold-cut deli counter and cheese counters favor in-person physical inspection"}
]

# --- 5. REGIONALITÀ DELLE ECCELLENZE ALIMENTARI (p. 28 - 32) ---
regionalita_records = [
    {"region": "Trentino-Alto Adige", "product_count": 1284, "sellout_millions_eur": 492.0, "growth_val_pct": +6.8, "top_products": "Mele Val di Non, Speck, Vini Alto Adige"},
    {"region": "Piemonte", "product_count": 2150, "sellout_millions_eur": 481.0, "growth_val_pct": +4.1, "top_products": "Nocciola Piemonte IGP, Grissini, Barolo/Nebbiolo"},
    {"region": "Veneto", "product_count": 2040, "sellout_millions_eur": 454.0, "growth_val_pct": +3.9, "top_products": "Prosecco DOCG, Asiago DOP, Riso Nano Vialone"},
    {"region": "Emilia-Romagna", "product_count": 1980, "sellout_millions_eur": 420.0, "growth_val_pct": +4.7, "top_products": "Parmigiano Reggiano DOP, Prosciutto di Parma, Aceto Balsamico"},
    {"region": "Lombardia", "product_count": 2210, "sellout_millions_eur": 389.0, "growth_val_pct": +2.5, "top_products": "Grana Padano DOP, Bresaola Valtellina IGP, Gorgonzola"},
    {"region": "Toscana", "product_count": 1720, "sellout_millions_eur": 312.0, "growth_val_pct": +3.6, "top_products": "Chianti Classico, Olio Toscano IGP, Cantuccini"},
    {"region": "Sicilia", "product_count": 1690, "sellout_millions_eur": 298.0, "growth_val_pct": +5.2, "top_products": "Pistacchio di Bronte, Cioccolato di Modica, Arancia Rossa"},
    {"region": "Campania", "product_count": 1410, "sellout_millions_eur": 265.0, "growth_val_pct": +4.8, "top_products": "Mozzarella di Bufala Campana DOP, Pasta di Gragnano, Pomodoro San Marzano"},
    {"region": "Puglia", "product_count": 1340, "sellout_millions_eur": 242.0, "growth_val_pct": +5.9, "top_products": "Olio Terra di Bari DOP, Taralli pugliesi, Burrata di Andria"},
    {"region": "Calabria", "product_count": 680, "sellout_millions_eur": 115.0, "growth_val_pct": +6.4, "top_products": "Cipolla Rossa Tropea, Bergamotto di Reggio, Nduja"},
    {"region": "Sardegna", "product_count": 720, "sellout_millions_eur": 128.0, "growth_val_pct": +3.1, "top_products": "Pecorino Sardo DOP, Pane Carasau, Cannonau"},
    {"region": "Liguria", "product_count": 590, "sellout_millions_eur": 98.0, "growth_val_pct": +2.8, "top_products": "Pesto Genovese DOP, Olio Riviera Ligure, Focaccia"},
    {"region": "Friuli-Venezia Giulia", "product_count": 610, "sellout_millions_eur": 104.0, "growth_val_pct": +3.4, "top_products": "Prosciutto di San Daniele DOP, Montasio DOP"},
    {"region": "Umbria", "product_count": 480, "sellout_millions_eur": 86.0, "growth_val_pct": +4.0, "top_products": "Lenticchia di Castelluccio, Tartufo Nero, Olio Colli Martani"},
    {"region": "Marche", "product_count": 510, "sellout_millions_eur": 79.0, "growth_val_pct": +3.5, "top_products": "Ciauscolo IGP, Verdicchio, Olio Piceno"},
    {"region": "Abruzzo", "product_count": 530, "sellout_millions_eur": 82.0, "growth_val_pct": +4.2, "top_products": "Montepulciano d'Abruzzo, Zafferano dell'Aquila, Spaghetti alla Chitarra"},
    {"region": "Lazio", "product_count": 640, "sellout_millions_eur": 95.0, "growth_val_pct": +2.9, "top_products": "Pecorino Romano DOP, Porchetta d'Ariccia IGP, Guanciale"},
    {"region": "Basilicata", "product_count": 210, "sellout_millions_eur": 34.0, "growth_val_pct": +5.1, "top_products": "Peperone di Senise IGP, Pane di Matera IGP"},
    {"region": "Molise", "product_count": 160, "sellout_millions_eur": 25.0, "growth_val_pct": +3.0, "top_products": "Caciocavallo Silano DOP, Tintilia"},
    {"region": "Valle d'Aosta", "product_count": 130, "sellout_millions_eur": 21.0, "growth_val_pct": +2.1, "top_products": "Fontina DOP, Valle d'Aosta Lard d'Arnad DOP"}
]

# --- 6. FLATTEN INTO UNIFIED PARQUET TABLE ---
all_rows = []

# Add Metaprodotto rows
for r in metaprodotto_records:
    all_rows.append({
        "section": "Metaprodotto",
        "entity_key": r["category"],
        "dimension_1": r["record_type"],
        "dimension_2": f"Products: {r['product_count']}",
        "metric_primary": float(r["energy_kcal"]),
        "metric_secondary": float(r["proteins_g"]),
        "metric_tertiary": float(r["sugars_g"]),
        "delta_pct": float(r["innovation_delta_kcal_pct"]),
        "details_json": json.dumps(r)
    })

# Add 10 Fenomeni rows
for r in fenomeni_records:
    all_rows.append({
        "section": "10_Fenomeni",
        "entity_key": r["name"],
        "dimension_1": f"Rank #{r['fenomeno_id']}",
        "dimension_2": r["trend_assessment"],
        "metric_primary": float(r["sellout_millions_eur"]),
        "metric_secondary": float(r["sales_volume_pct_change"]),
        "metric_tertiary": float(r["share_of_total_grocery_sales_pct"]),
        "delta_pct": float(r["sales_value_pct_change"]),
        "details_json": json.dumps(r)
    })

# Add Push vs Pull rows
for r in push_pull_claims:
    all_rows.append({
        "section": "Push_Pull_Econometrics",
        "entity_key": r["claim"],
        "dimension_1": r["theme"],
        "dimension_2": r["status"],
        "metric_primary": float(r["push_pct"]),
        "metric_secondary": float(r["pull_pct"]),
        "metric_tertiary": float(r["value_change_pct"]),
        "delta_pct": float(r["pull_pct"] - r["push_pct"]),  # Demand-Pull net gap
        "details_json": json.dumps(r)
    })

# Add E-Commerce rows
for r in ecommerce_overindexing:
    all_rows.append({
        "section": "Ecommerce_Overindexing",
        "entity_key": r["attribute"],
        "dimension_1": r["type"],
        "dimension_2": r["basket_preference"],
        "metric_primary": float(r["index_value"]),
        "metric_secondary": float(r["index_value"] - 100.0),  # Spread vs store baseline
        "metric_tertiary": 100.0,
        "delta_pct": float(((r["index_value"] - 100.0) / 100.0) * 100.0),
        "details_json": json.dumps(r)
    })

# Add Regionalita rows
for r in regionalita_records:
    all_rows.append({
        "section": "Regionalita_Italiana",
        "entity_key": r["region"],
        "dimension_1": r["top_products"],
        "dimension_2": f"SKUs: {r['product_count']}",
        "metric_primary": float(r["sellout_millions_eur"]),
        "metric_secondary": float(r["product_count"]),
        "metric_tertiary": 0.0,
        "delta_pct": float(r["growth_val_pct"]),
        "details_json": json.dumps(r)
    })

# Create Parquet via DuckDB
os.makedirs("public/data/parquet", exist_ok=True)
parquet_path = "public/data/parquet/gs1_immagino_observatory.parquet"
temp_json = "public/data/parquet/_temp_rows.json"

with open(temp_json, "w", encoding="utf-8") as f:
    json.dump(all_rows, f)

con = duckdb.connect()
con.execute(f"""
    CREATE TABLE gs1_table AS 
    SELECT * FROM read_json_auto('{temp_json}')
""")

con.execute(f"COPY gs1_table TO '{parquet_path}' (FORMAT PARQUET, COMPRESSION SNAPPY)")
if os.path.exists(temp_json):
    os.remove(temp_json)
print(f"Successfully wrote {len(all_rows)} rows to {parquet_path}")

# Create JSON bundle for instant fast-render in React
bundle = {
    "metadata": {
        "title": "Osservatorio Immagino GS1 Italy - 19a Edizione (2026-1)",
        "source": "GS1 Italy & NielsenIQ Scanning Data",
        "sample_size": "151,203 FMCG products, 84,817 nutritional tables, €57.3B sell-out",
        "coverage": "Italian Hypermarkets and Supermarkets (Iper + Super)",
        "edition_year": 2026
    },
    "metaprodotto": metaprodotto_records,
    "fenomeni": fenomeni_records,
    "push_pull": push_pull_claims,
    "ecommerce": ecommerce_overindexing,
    "regionalita": regionalita_records
}

json_path = "public/data/gs1_immagino_bundle.json"
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(bundle, f, indent=2, ensure_ascii=False)
print(f"Successfully wrote bundle to {json_path}")
