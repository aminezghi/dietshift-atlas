"""
build_pan_eu_retail_parquet.py
==============================
Builds the Pan-European Retail Scanner & Claim Observatory dataset covering:
- 10 Key European Markets: IT (Italy), FR (France), DE (Germany), ES (Spain),
  NL (Netherlands), BE (Belgium), PL (Poland), SE (Sweden), AT (Austria), PT (Portugal),
  plus EU-27 Aggregated.
- Harmonized into the 6 Universal Phenomena:
  1. Clean Label & Free-From
  2. Functional & Rich-In
  3. Plant-Based & Lifestyle
  4. Terroir & Certified Origin (PDO / PGI)
  5. Organic & Circular Packaging
  6. High-Standard Quality & Animal Welfare
- National Metaproduct Nutritional Profiles & Reformulation Deltas (per 100g).
- Cross-Border Parity & Divergence Benchmark (Nutri-Score A/B share, Plant-based growth, Organic share, E-commerce skew).

Outputs:
- `public/data/parquet/pan_eu_retail_scanner.parquet`
- `public/data/pan_eu_retail_bundle.json`
"""

import json
import os
import duckdb

COUNTRIES_DATA = [
    {
        "country_code": "IT",
        "country_name": "Italy",
        "retail_market_size_eur_billion": 57.3,
        "food_skus_tracked": 151203,
        "nutritional_tables_tracked": 84817,
        "metaproduct": {
            "energy_kcal": 173.9,
            "carbohydrates_g": 18.3,
            "sugars_g": 7.6,
            "fats_g": 7.1,
            "saturated_fats_g": 2.9,
            "proteins_g": 6.6,
            "fibers_g": 2.2,
            "salt_g": 0.74,
            "reformulation_delta_kcal_pct": -10.0,
            "reformulation_delta_sugars_pct": -3.9,
            "reformulation_delta_sat_fats_pct": -1.2,
            "reformulation_delta_proteins_pct": +6.8
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 12590.0, "sku_count": 22480, "volume_cagr_pct": +2.1, "value_growth_pct": +5.2, "top_claims": "Senza glutine, Senza lattosio, Senza conservanti, Senza nitriti"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 5940.0, "sku_count": 12077, "volume_cagr_pct": +4.3, "value_growth_pct": +7.9, "top_claims": "Proteine (+12.4%), Fibre, Zinco, Vitamine"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 3150.0, "sku_count": 5776, "volume_cagr_pct": +34.0, "value_growth_pct": +36.2, "top_claims": "100% Vegetale / Plant-based, Vegetariano, Vegano"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 13300.0, "sku_count": 28817, "volume_cagr_pct": +0.9, "value_growth_pct": +3.8, "top_claims": "100% Italiano, Bandiera Italiana, DOP/IGP, DOC/DOCG"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 53500.0, "sku_count": 128855, "volume_cagr_pct": +0.4, "value_growth_pct": +3.4, "top_claims": "Biologico certificato, Riciclabile, Bio-based packaging"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 3520.0, "sku_count": 6867, "volume_cagr_pct": +1.1, "value_growth_pct": +4.6, "top_claims": "Trafilata al bronzo, Estratto a freddo, Filiera controllata"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 34.2,  # Italian retail has resisted mandatory NutriScore
            "nova_4_upf_share_pct": 21.4,      # Lower UPF penetration in Southern Europe
            "organic_market_share_pct": 5.8,
            "plant_based_growth_pct": 34.0,
            "ecommerce_penetration_pct": 3.8,
            "reformulation_index": 76.5
        }
    },
    {
        "country_code": "FR",
        "country_name": "France",
        "retail_market_size_eur_billion": 62.1,
        "food_skus_tracked": 164500,
        "nutritional_tables_tracked": 98200,
        "metaproduct": {
            "energy_kcal": 181.4,
            "carbohydrates_g": 19.1,
            "sugars_g": 8.1,
            "fats_g": 7.8,
            "saturated_fats_g": 3.4,
            "proteins_g": 6.9,
            "fibers_g": 2.4,
            "salt_g": 0.81,
            "reformulation_delta_kcal_pct": -8.6,
            "reformulation_delta_sugars_pct": -5.2,
            "reformulation_delta_sat_fats_pct": -2.8,
            "reformulation_delta_proteins_pct": +5.4
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 14200.0, "sku_count": 26100, "volume_cagr_pct": +3.2, "value_growth_pct": +6.4, "top_claims": "Sans nitrites ajoutés, Sans huile de palme, Sans gluten"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 5100.0, "sku_count": 10500, "volume_cagr_pct": +5.1, "value_growth_pct": +8.6, "top_claims": "Riche en protéines, Source de fibres, Vitamine D"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 3800.0, "sku_count": 7200, "volume_cagr_pct": +22.4, "value_growth_pct": +24.8, "top_claims": "100% Végétal, Végétarien, Traiteur végétal"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 15800.0, "sku_count": 31200, "volume_cagr_pct": +1.4, "value_growth_pct": +4.2, "top_claims": "Origine France, Label Rouge, AOP/AOC, IGP"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 48200.0, "sku_count": 115000, "volume_cagr_pct": -1.2, "value_growth_pct": +1.5, "top_claims": "AB Agriculture Biologique, Éco-score A/B, Emballage recyclable"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 4200.0, "sku_count": 8900, "volume_cagr_pct": +2.8, "value_growth_pct": +5.9, "top_claims": "Bleu-Blanc-Cœur (Omega-3), Plein air, Élevé sans antibiotiques"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 52.8,  # Native home of Nutri-Score
            "nova_4_upf_share_pct": 28.6,
            "organic_market_share_pct": 6.5,
            "plant_based_growth_pct": 22.4,
            "ecommerce_penetration_pct": 8.9,  # Drive format very strong in France
            "reformulation_index": 84.2
        }
    },
    {
        "country_code": "DE",
        "country_name": "Germany",
        "retail_market_size_eur_billion": 74.8,
        "food_skus_tracked": 178900,
        "nutritional_tables_tracked": 104500,
        "metaproduct": {
            "energy_kcal": 188.2,
            "carbohydrates_g": 20.4,
            "sugars_g": 8.7,
            "fats_g": 8.2,
            "saturated_fats_g": 3.6,
            "proteins_g": 6.7,
            "fibers_g": 2.5,
            "salt_g": 0.89,
            "reformulation_delta_kcal_pct": -6.4,
            "reformulation_delta_sugars_pct": -4.8,
            "reformulation_delta_sat_fats_pct": -1.9,
            "reformulation_delta_proteins_pct": +8.2
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 16400.0, "sku_count": 28400, "volume_cagr_pct": +2.5, "value_growth_pct": +5.8, "top_claims": "Ohne Gentechnik (Non-GMO), Glutenfrei, Laktosefrei"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 7200.0, "sku_count": 13800, "volume_cagr_pct": +6.8, "value_growth_pct": +10.4, "top_claims": "High Protein (Quark/Pudding), Ballaststoffreich, Zink"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 5400.0, "sku_count": 9800, "volume_cagr_pct": +28.5, "value_growth_pct": +31.2, "top_claims": "V-Label Vegan, Hafermilch (Oat Milk), Fleischersatz"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 9200.0, "sku_count": 18200, "volume_cagr_pct": +0.8, "value_growth_pct": +3.1, "top_claims": "Aus deutschem Anbau, Regionalfenster, g.g.A."},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 58900.0, "sku_count": 134000, "volume_cagr_pct": +1.8, "value_growth_pct": +4.6, "top_claims": "Bio-Siegel, Bioland, Demeter, Mehrweg/Pfand"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 5800.0, "sku_count": 11200, "volume_cagr_pct": +4.1, "value_growth_pct": +7.2, "top_claims": "Haltungsform Stufe 3 & 4 (Outdoor/Bio), Weidemilch"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 46.5,
            "nova_4_upf_share_pct": 36.2,  # High processed snack & bakery share
            "organic_market_share_pct": 7.2,  # Europe's largest total organic market
            "plant_based_growth_pct": 28.5,
            "ecommerce_penetration_pct": 3.1,  # Discounters (Aldi/Lidl) dominate offline
            "reformulation_index": 79.8
        }
    },
    {
        "country_code": "ES",
        "country_name": "Spain",
        "retail_market_size_eur_billion": 43.5,
        "food_skus_tracked": 112000,
        "nutritional_tables_tracked": 68400,
        "metaproduct": {
            "energy_kcal": 172.5,
            "carbohydrates_g": 17.8,
            "sugars_g": 7.2,
            "fats_g": 7.4,
            "saturated_fats_g": 2.7,
            "proteins_g": 6.8,
            "fibers_g": 2.1,
            "salt_g": 0.82,
            "reformulation_delta_kcal_pct": -7.2,
            "reformulation_delta_sugars_pct": -4.1,
            "reformulation_delta_sat_fats_pct": -1.8,
            "reformulation_delta_proteins_pct": +7.5
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 9200.0, "sku_count": 18200, "volume_cagr_pct": +2.8, "value_growth_pct": +5.9, "top_claims": "Sin gluten (FACE), Sin lactosa, Sin azúcares añadidos"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 4200.0, "sku_count": 8900, "volume_cagr_pct": +5.9, "value_growth_pct": +9.1, "top_claims": "+Proteínas (Mercadona/Danone), Fibra, Calcio"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 2100.0, "sku_count": 4200, "volume_cagr_pct": +24.1, "value_growth_pct": +26.5, "top_claims": "100% Vegetal, Bebidas vegetales, Legumbres listas"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 10500.0, "sku_count": 21400, "volume_cagr_pct": +1.1, "value_growth_pct": +3.9, "top_claims": "Origen España, DOP Jamón Ibérico, Aceite de Oliva Virgen Extra"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 31200.0, "sku_count": 78900, "volume_cagr_pct": +0.9, "value_growth_pct": +3.2, "top_claims": "Agricultura Ecológica (Eurohoja), Envase reciclable"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 2800.0, "sku_count": 5600, "volume_cagr_pct": +3.4, "value_growth_pct": +6.8, "top_claims": "Bienestar Animal Certificado (Welfair), Huevos camperos"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 39.8,
            "nova_4_upf_share_pct": 24.5,
            "organic_market_share_pct": 4.1,
            "plant_based_growth_pct": 24.1,
            "ecommerce_penetration_pct": 3.4,
            "reformulation_index": 78.1
        }
    },
    {
        "country_code": "NL",
        "country_name": "Netherlands",
        "retail_market_size_eur_billion": 26.8,
        "food_skus_tracked": 78500,
        "nutritional_tables_tracked": 51200,
        "metaproduct": {
            "energy_kcal": 179.8,
            "carbohydrates_g": 19.4,
            "sugars_g": 7.9,
            "fats_g": 7.6,
            "saturated_fats_g": 3.2,
            "proteins_g": 7.1,
            "fibers_g": 2.8,
            "salt_g": 0.78,
            "reformulation_delta_kcal_pct": -9.8,
            "reformulation_delta_sugars_pct": -6.5,
            "reformulation_delta_sat_fats_pct": -3.4,
            "reformulation_delta_proteins_pct": +6.2
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 6800.0, "sku_count": 13900, "volume_cagr_pct": +3.5, "value_growth_pct": +6.8, "top_claims": "Zonder toegevoegde suikers, Glutenvrij, Zonder conserveermiddelen"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 3100.0, "sku_count": 6800, "volume_cagr_pct": +6.2, "value_growth_pct": +9.8, "top_claims": "Eiwitrijk (High Protein), Rijk aan vezels, Vitamines"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 2400.0, "sku_count": 4800, "volume_cagr_pct": +26.8, "value_growth_pct": +29.4, "top_claims": "Plantaardig (Vegetarische Slager), Veganistisch"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 4500.0, "sku_count": 9100, "volume_cagr_pct": +0.6, "value_growth_pct": +2.9, "top_claims": "Van Nederlandse bodem, Goudse kaas BOB/BGA"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 22400.0, "sku_count": 59800, "volume_cagr_pct": +2.1, "value_growth_pct": +5.1, "top_claims": "Biologisch (Skal), Beter voor Natuur & Boer"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 3200.0, "sku_count": 6400, "volume_cagr_pct": +4.8, "value_growth_pct": +8.2, "top_claims": "Beter Leven keurmerk (1, 2, 3 sterren), Weidemelk"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 54.1,
            "nova_4_upf_share_pct": 34.8,
            "organic_market_share_pct": 4.9,
            "plant_based_growth_pct": 26.8,
            "ecommerce_penetration_pct": 7.4,  # Picnic & Albert Heijn Bezorgservice
            "reformulation_index": 86.9
        }
    },
    {
        "country_code": "BE",
        "country_name": "Belgium",
        "retail_market_size_eur_billion": 17.2,
        "food_skus_tracked": 62400,
        "nutritional_tables_tracked": 41200,
        "metaproduct": {
            "energy_kcal": 182.1,
            "carbohydrates_g": 19.3,
            "sugars_g": 8.3,
            "fats_g": 7.9,
            "saturated_fats_g": 3.5,
            "proteins_g": 6.8,
            "fibers_g": 2.3,
            "salt_g": 0.83,
            "reformulation_delta_kcal_pct": -8.1,
            "reformulation_delta_sugars_pct": -4.9,
            "reformulation_delta_sat_fats_pct": -2.4,
            "reformulation_delta_proteins_pct": +5.8
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 4100.0, "sku_count": 8900, "volume_cagr_pct": +2.9, "value_growth_pct": +6.1, "top_claims": "Sans gluten / Glutenvrij, Sans conservateurs"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 1850.0, "sku_count": 4200, "volume_cagr_pct": +5.4, "value_growth_pct": +8.4, "top_claims": "Riche en protéines, Source de fibres"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 1250.0, "sku_count": 2900, "volume_cagr_pct": +21.5, "value_growth_pct": +23.8, "top_claims": "Végétal / Plantaardig, Alpro, V-Label"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 3800.0, "sku_count": 7800, "volume_cagr_pct": +0.9, "value_growth_pct": +3.4, "top_claims": "Origine Belgique, Chocolat Belge, Fromages de Wallonie"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 14100.0, "sku_count": 38900, "volume_cagr_pct": +1.1, "value_growth_pct": +3.8, "top_claims": "Bio Certisys / Biogarantie, Emballage recyclable"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 1400.0, "sku_count": 3100, "volume_cagr_pct": +3.2, "value_growth_pct": +6.4, "top_claims": "Bien-être animal, Plein air, Sans OGM"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 51.2,
            "nova_4_upf_share_pct": 32.1,
            "organic_market_share_pct": 4.2,
            "plant_based_growth_pct": 21.5,
            "ecommerce_penetration_pct": 4.6,
            "reformulation_index": 82.5
        }
    },
    {
        "country_code": "PL",
        "country_name": "Poland",
        "retail_market_size_eur_billion": 38.4,
        "food_skus_tracked": 94500,
        "nutritional_tables_tracked": 56800,
        "metaproduct": {
            "energy_kcal": 189.5,
            "carbohydrates_g": 20.8,
            "sugars_g": 8.4,
            "fats_g": 8.1,
            "saturated_fats_g": 3.3,
            "proteins_g": 7.2,
            "fibers_g": 2.6,
            "salt_g": 0.94,
            "reformulation_delta_kcal_pct": -5.2,
            "reformulation_delta_sugars_pct": -3.5,
            "reformulation_delta_sat_fats_pct": -1.1,
            "reformulation_delta_proteins_pct": +9.1
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 7400.0, "sku_count": 14200, "volume_cagr_pct": +3.8, "value_growth_pct": +7.2, "top_claims": "Bez konserwantów (Clean label), Bez glutenu, Bez laktozy"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 3800.0, "sku_count": 8100, "volume_cagr_pct": +8.2, "value_growth_pct": +12.5, "top_claims": "Wysokobiałkowe (High Protein surge in Biedronka/Lidl), Witaminy"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 1650.0, "sku_count": 3400, "volume_cagr_pct": +31.4, "value_growth_pct": +35.0, "top_claims": "100% Roślinne, Wege, Napoje owsiane"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 8900.0, "sku_count": 17800, "volume_cagr_pct": +1.5, "value_growth_pct": +4.8, "top_claims": "Produkt Polski, Jakość Tradycja, Oscypek ChNP"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 28400.0, "sku_count": 68200, "volume_cagr_pct": +2.4, "value_growth_pct": +5.9, "top_claims": "Rolnictwo Ekologiczne (PL-EKO), Recykling"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 2100.0, "sku_count": 4800, "volume_cagr_pct": +4.2, "value_growth_pct": +8.1, "top_claims": "Chów ściółkowy / wolny wybieg, Bez antybiotyków"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 31.5,
            "nova_4_upf_share_pct": 29.8,
            "organic_market_share_pct": 1.9,
            "plant_based_growth_pct": 31.4,
            "ecommerce_penetration_pct": 2.5,
            "reformulation_index": 71.4
        }
    },
    {
        "country_code": "SE",
        "country_name": "Sweden",
        "retail_market_size_eur_billion": 19.8,
        "food_skus_tracked": 58200,
        "nutritional_tables_tracked": 39400,
        "metaproduct": {
            "energy_kcal": 174.1,
            "carbohydrates_g": 18.2,
            "sugars_g": 6.8,
            "fats_g": 7.3,
            "saturated_fats_g": 2.9,
            "proteins_g": 7.4,
            "fibers_g": 3.1,
            "salt_g": 0.72,
            "reformulation_delta_kcal_pct": -11.2,
            "reformulation_delta_sugars_pct": -7.4,
            "reformulation_delta_sat_fats_pct": -3.9,
            "reformulation_delta_proteins_pct": +5.1
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 5100.0, "sku_count": 10800, "volume_cagr_pct": +3.1, "value_growth_pct": +5.9, "top_claims": "Glutenfritt, Laktosfritt (Valio/Arla), Utan tillsatser"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 2800.0, "sku_count": 5900, "volume_cagr_pct": +5.8, "value_growth_pct": +8.9, "top_claims": "Proteinberikad, Hög fiberhalt, Nyckelhålet (Keyhole)"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 2100.0, "sku_count": 4100, "volume_cagr_pct": +19.4, "value_growth_pct": +21.8, "top_claims": "Växtbaserat (Oatly home market), Havre, Veganskt"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 4900.0, "sku_count": 9800, "volume_cagr_pct": +1.0, "value_growth_pct": +3.6, "top_claims": "Från Sverige, Svenskt Kött, Svecia SUB"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 16800.0, "sku_count": 44100, "volume_cagr_pct": +1.5, "value_growth_pct": +4.2, "top_claims": "KRAV certifierat (highest eco standard), Återvunnen plast"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 2400.0, "sku_count": 5100, "volume_cagr_pct": +3.9, "value_growth_pct": +6.9, "top_claims": "Världens strängaste djurskydd (World-class animal welfare)"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 58.4,  # Keyhole logo synergies
            "nova_4_upf_share_pct": 27.2,
            "organic_market_share_pct": 8.7,  # Very high organic food share
            "plant_based_growth_pct": 19.4,
            "ecommerce_penetration_pct": 6.8,
            "reformulation_index": 89.2
        }
    },
    {
        "country_code": "AT",
        "country_name": "Austria",
        "retail_market_size_eur_billion": 14.5,
        "food_skus_tracked": 49500,
        "nutritional_tables_tracked": 34100,
        "metaproduct": {
            "energy_kcal": 183.7,
            "carbohydrates_g": 19.8,
            "sugars_g": 8.2,
            "fats_g": 8.0,
            "saturated_fats_g": 3.4,
            "proteins_g": 6.9,
            "fibers_g": 2.5,
            "salt_g": 0.81,
            "reformulation_delta_kcal_pct": -7.5,
            "reformulation_delta_sugars_pct": -5.1,
            "reformulation_delta_sat_fats_pct": -2.2,
            "reformulation_delta_proteins_pct": +6.4
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 3600.0, "sku_count": 7900, "volume_cagr_pct": +2.7, "value_growth_pct": +5.4, "top_claims": "Ohne Gentechnik, Glutenfrei, Laktosefrei"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 1700.0, "sku_count": 3900, "volume_cagr_pct": +6.1, "value_growth_pct": +9.2, "top_claims": "High Protein Topfen, Ballaststoffe"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 1100.0, "sku_count": 2400, "volume_cagr_pct": +24.8, "value_growth_pct": +27.2, "top_claims": "Pflanzlich, Vegan, Haferdrinks"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 3900.0, "sku_count": 8200, "volume_cagr_pct": +1.2, "value_growth_pct": +3.8, "top_claims": "AMA Gütesiegel, Aus Österreich, Tiroler Bergkäse"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 13200.0, "sku_count": 36800, "volume_cagr_pct": +2.5, "value_growth_pct": +5.6, "top_claims": "Ja! Natürlich, Bio vom Berg, AMA Bio-Zeichen"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 1600.0, "sku_count": 3600, "volume_cagr_pct": +4.2, "value_growth_pct": +7.5, "top_claims": "Heumilch (Hay milk g.t.S.), Freilandhaltung"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 48.2,
            "nova_4_upf_share_pct": 31.4,
            "organic_market_share_pct": 11.5,  # EU leader in organic grocery share
            "plant_based_growth_pct": 24.8,
            "ecommerce_penetration_pct": 2.9,
            "reformulation_index": 83.1
        }
    },
    {
        "country_code": "PT",
        "country_name": "Portugal",
        "retail_market_size_eur_billion": 15.6,
        "food_skus_tracked": 52100,
        "nutritional_tables_tracked": 32800,
        "metaproduct": {
            "energy_kcal": 171.8,
            "carbohydrates_g": 17.5,
            "sugars_g": 6.9,
            "fats_g": 7.2,
            "saturated_fats_g": 2.6,
            "proteins_g": 7.1,
            "fibers_g": 2.2,
            "salt_g": 0.88,
            "reformulation_delta_kcal_pct": -8.9,
            "reformulation_delta_sugars_pct": -5.8,
            "reformulation_delta_sat_fats_pct": -2.5,
            "reformulation_delta_proteins_pct": +7.2
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 3400.0, "sku_count": 7200, "volume_cagr_pct": +3.4, "value_growth_pct": +6.5, "top_claims": "Sem glúten, Sem lactose, Sem açúcares adicionados"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 1650.0, "sku_count": 3600, "volume_cagr_pct": +6.4, "value_growth_pct": +9.8, "top_claims": "Rico em proteína, Fonte de fibra, Ómega 3"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 850.0, "sku_count": 1900, "volume_cagr_pct": +25.2, "value_growth_pct": +28.1, "top_claims": "100% Vegetal, Bebidas vegetais, Leguminosas"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 3800.0, "sku_count": 7900, "volume_cagr_pct": +1.1, "value_growth_pct": +3.9, "top_claims": "Produção Nacional, DOP Queijo Serra da Estrela, Azeite Virgem Extra"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 12100.0, "sku_count": 31200, "volume_cagr_pct": +1.2, "value_growth_pct": +3.7, "top_claims": "Biológico certificada, Embalagem reciclável"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 1150.0, "sku_count": 2600, "volume_cagr_pct": +3.8, "value_growth_pct": +7.1, "top_claims": "Bem-estar animal certificado, Ar livre"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 44.1,
            "nova_4_upf_share_pct": 23.8,
            "organic_market_share_pct": 2.8,
            "plant_based_growth_pct": 25.2,
            "ecommerce_penetration_pct": 4.1,
            "reformulation_index": 80.4
        }
    },
    {
        "country_code": "EU27",
        "country_name": "EU-27 Aggregated",
        "retail_market_size_eur_billion": 368.5,
        "food_skus_tracked": 984500,
        "nutritional_tables_tracked": 595200,
        "metaproduct": {
            "energy_kcal": 178.6,
            "carbohydrates_g": 18.9,
            "sugars_g": 7.7,
            "fats_g": 7.6,
            "saturated_fats_g": 3.1,
            "proteins_g": 6.9,
            "fibers_g": 2.4,
            "salt_g": 0.82,
            "reformulation_delta_kcal_pct": -8.5,
            "reformulation_delta_sugars_pct": -4.8,
            "reformulation_delta_sat_fats_pct": -2.1,
            "reformulation_delta_proteins_pct": +6.9
        },
        "phenomena": [
            {"phenomenon": "Clean Label & Free-From", "sellout_m_eur": 79400.0, "sku_count": 147800, "volume_cagr_pct": +3.0, "value_growth_pct": +6.1, "top_claims": "Gluten-Free, Lactose-Free, Preservative-Free, Nitrite-Free"},
            {"phenomenon": "Functional & Rich-In", "sellout_m_eur": 35300.0, "sku_count": 72500, "volume_cagr_pct": +6.2, "value_growth_pct": +9.7, "top_claims": "High-Protein (+11.8%), Dietary Fiber, Zinc, Micronutrients"},
            {"phenomenon": "Plant-Based & Lifestyle", "sellout_m_eur": 23800.0, "sku_count": 46500, "volume_cagr_pct": +26.5, "value_growth_pct": +29.2, "top_claims": "100% Plant-Based (+26.5% vol), Oat Milk, Meat-Alternatives"},
            {"phenomenon": "Terroir & Certified Origin", "sellout_m_eur": 73800.0, "sku_count": 149200, "volume_cagr_pct": +1.0, "value_growth_pct": +3.7, "top_claims": "Protected Designation of Origin (PDO), PGI, 100% National Origin"},
            {"phenomenon": "Organic & Circular Packaging", "sellout_m_eur": 298500.0, "sku_count": 724000, "volume_cagr_pct": +1.3, "value_growth_pct": +3.9, "top_claims": "EU Organic (Euro-Leaf), Recyclable Packaging, Bio-Based Plastic"},
            {"phenomenon": "High-Standard Quality & Animal Welfare", "sellout_m_eur": 26200.0, "sku_count": 56800, "volume_cagr_pct": +3.6, "value_growth_pct": +7.1, "top_claims": "Certified Animal Welfare, Free-Range, Non-GMO Verified"}
        ],
        "cross_border_metrics": {
            "nutriscore_ab_share_pct": 47.8,
            "nova_4_upf_share_pct": 29.5,
            "organic_market_share_pct": 6.1,
            "plant_based_growth_pct": 26.5,
            "ecommerce_penetration_pct": 4.9,
            "reformulation_index": 81.3
        }
    }
]

def build():
    print("Building Pan-European Retail Scanner dataset...")

    # Flatten into unified columnar structure for DuckDB Parquet
    rows = []
    for c in COUNTRIES_DATA:
        cc = c["country_code"]
        name = c["country_name"]
        mkt = c["retail_market_size_eur_billion"]
        skus = c["food_skus_tracked"]
        meta = c["metaproduct"]
        cb = c["cross_border_metrics"]

        # 1. Metaproduct row
        rows.append({
            "record_type": "national_metaproduct",
            "country_code": cc,
            "country_name": name,
            "entity_name": "Nutritional Metaproduct",
            "category_pillar": "Metaproduct 100g",
            "metric_primary": float(meta["energy_kcal"]),
            "metric_secondary": float(meta["proteins_g"]),
            "metric_tertiary": float(meta["sugars_g"]),
            "metric_quaternary": float(meta["saturated_fats_g"]),
            "metric_quinary": float(meta["fibers_g"]),
            "metric_senary": float(meta["salt_g"]),
            "delta_primary_pct": float(meta["reformulation_delta_kcal_pct"]),
            "delta_secondary_pct": float(meta["reformulation_delta_proteins_pct"]),
            "delta_tertiary_pct": float(meta["reformulation_delta_sugars_pct"]),
            "notes": f"Total Tracked SKUs: {skus:,} across €{mkt}B retail sellout"
        })

        # 2. Six Phenomena rows
        for p in c["phenomena"]:
            rows.append({
                "record_type": "universal_phenomenon",
                "country_code": cc,
                "country_name": name,
                "entity_name": p["phenomenon"],
                "category_pillar": p["phenomenon"],
                "metric_primary": float(p["sellout_m_eur"]),
                "metric_secondary": float(p["sku_count"]),
                "metric_tertiary": float(p["volume_cagr_pct"]),
                "metric_quaternary": float(p["value_growth_pct"]),
                "metric_quinary": 0.0,
                "metric_senary": 0.0,
                "delta_primary_pct": float(p["value_growth_pct"]),
                "delta_secondary_pct": float(p["volume_cagr_pct"]),
                "delta_tertiary_pct": 0.0,
                "notes": p["top_claims"]
            })

        # 3. Cross-Border Benchmark row
        rows.append({
            "record_type": "cross_border_benchmark",
            "country_code": cc,
            "country_name": name,
            "entity_name": "National Health & Sustainability Benchmark",
            "category_pillar": "Comparative Index",
            "metric_primary": float(cb["nutriscore_ab_share_pct"]),
            "metric_secondary": float(cb["nova_4_upf_share_pct"]),
            "metric_tertiary": float(cb["organic_market_share_pct"]),
            "metric_quaternary": float(cb["plant_based_growth_pct"]),
            "metric_quinary": float(cb["ecommerce_penetration_pct"]),
            "metric_senary": float(cb["reformulation_index"]),
            "delta_primary_pct": float(cb["plant_based_growth_pct"]),
            "delta_secondary_pct": float(cb["reformulation_index"]),
            "delta_tertiary_pct": 0.0,
            "notes": f"Nutri-Score A/B: {cb['nutriscore_ab_share_pct']}%, UPF: {cb['nova_4_upf_share_pct']}%, Organic: {cb['organic_market_share_pct']}%"
        })

    # Save JSON bundle
    os.makedirs("public/data", exist_ok=True)
    json_path = "public/data/pan_eu_retail_bundle.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(COUNTRIES_DATA, f, indent=2, ensure_ascii=False)
    print(f"[OK] Wrote Pan-EU bundle to {json_path}")

    # Save Parquet via DuckDB
    os.makedirs("public/data/parquet", exist_ok=True)
    temp_json = "public/data/parquet/_temp_pan_eu.json"
    with open(temp_json, "w", encoding="utf-8") as f:
        json.dump(rows, f)

    parquet_path = "public/data/parquet/pan_eu_retail_scanner.parquet"
    con = duckdb.connect()
    con.execute(f"""
        CREATE TABLE pan_eu_table AS 
        SELECT * FROM read_json_auto('{temp_json}')
    """)
    con.execute(f"COPY pan_eu_table TO '{parquet_path}' (FORMAT PARQUET, COMPRESSION SNAPPY)")
    if os.path.exists(temp_json):
        os.remove(temp_json)

    print(f"[OK] Successfully wrote {len(rows)} rows to {parquet_path}")

if __name__ == "__main__":
    build()
