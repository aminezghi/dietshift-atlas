"""
build_classification_mappings.py
================================
Builds the normalized, traceable multi-taxonomy harmonisation dataset
(`classification_mappings.parquet` & `classification_mappings.json`) bridging:
- ADEME Agribalyse 3.1.1 (all 61 observed Groupe_aliment / Sous_groupe_aliment subcategories)
- EFSA FoodEx2 (all 15 categories in efsa_foodex2_surveys.parquet)
- Open Food Facts EU (all 11 curated categories in openfoodfacts_eu.parquet)
- Eurostat COICOP / ECOICOP food expenditure & HICP divisions

Integrity Rules:
- Never invents exact equivalences or synthetic probability scores to fill taxonomic gaps.
- Explicitly distinguishes: 'exact', 'hierarchical', 'approximate', 'ambiguous', and 'unmatched'.
- For 'unmatched' entries, target_code / target_label are NULL and confidence_tier is 'unmatched'.
- Every Agribalyse subgroup count and representative Code_AGB is dynamically verified
  against agribalyse_31.parquet; OFF and FoodEx2 nodes are verified against their Parquet tables.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import duckdb

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "public" / "data"
PARQUET_DIR = DATA_DIR / "parquet"

MAPPING_VERSION = "3.0.0-phase3a"

SRC_AGB_COICOP = "ADEME Agribalyse 3.1.1 (data.ademe.fr); Eurostat COICOP 2018 (ramon/nomenclatures)"
SRC_AGB_FOODEX = "ADEME Agribalyse 3.1.1 (Groupe/Sous-groupe); EFSA FoodEx2 Catalogue (efsa_foodex2_surveys)"
SRC_OFF_FOODEX = "Open Food Facts Search-a-licious Queries; EFSA FoodEx2 Catalogue"
SRC_OFF_COICOP = "Open Food Facts Search-a-licious Queries; Eurostat COICOP 2018"
SRC_FOODEX_COICOP = "EFSA FoodEx2 (efsa_foodex2_surveys); Eurostat HICP/HBS COICOP (prc_hicp_aind)"

# ---------------------------------------------------------------------------
# COICOP Reference Labels (Eurostat prc_hicp_aind & COICOP 2018)
# ---------------------------------------------------------------------------
COICOP_LABELS: dict[str, str] = {
    "CP0111": "01.1.1 Bread and cereals",
    "CP0112": "01.1.2 Meat",
    "CP0113": "01.1.3 Fish and seafood",
    "CP0114": "01.1.4 Milk, cheese and eggs",
    "CP0115": "01.1.5 Oils and fats",
    "CP0116": "01.1.6 Fruit",
    "CP0117": "01.1.7 Vegetables (incl. potatoes & pulses)",
    "CP0118": "01.1.8 Sugar, jam, honey, chocolate and confectionery",
    "CP0119": "01.1.9 Food products n.e.c. (sauces, condiments, ready meals, infant food)",
    "CP012": "01.2 Non-alcoholic beverages (coffee, tea, cocoa, waters, soft drinks & juices)",
    "CP021": "02.1 Alcoholic beverages (outside Food COICOP 01.1)",
}

FOODEX2_LABELS: dict[str, tuple[str, str]] = {
    "A000J": ("Grains and grain-based products", "Refined bakery & white pasta"),
    "A01QR": ("Grains and grain-based products", "Wholegrain bread & oats"),
    "A01QX": ("Meat and meat products", "Bovine & ovine ruminant red meat"),
    "A01RG": ("Meat and meat products", "Porcine & poultry white/cured meat"),
    "A03TD": ("Meat and meat products", "Plant-based meat analogues (extruded)"),
    "A026V": ("Fish, seafood and amphibians", "Marine & aquaculture fish fillets"),
    "A02LR": ("Milk and dairy products", "Liquid cow milk & fermented yogurt"),
    "A02QE": ("Milk and dairy products", "Ripened hard & soft dairy cheeses"),
    "A03TH": ("Milk and dairy products", "Plant-based dairy drinks (oat/soy)"),
    "A01BS": ("Fruit and fruit products", "Fresh temperate & citrus fruits"),
    "A00FJ": ("Vegetables and vegetable products", "Leafy greens, brassicas & root veg"),
    "A011X": ("Legumes, nuts, oilseeds and spices", "Lentils, chickpeas, beans & pulses"),
    "A014C": ("Legumes, nuts, oilseeds and spices", "Tree nuts, peanuts & seeds"),
    "A034F": ("Sugar, confectionery and ultra-processed", "Sweet snacks, confectionery & biscuits"),
    "A03LZ": ("Composite dishes & ready-to-eat meals", "Convenience frozen & chilled meals"),
}

# Tuple format per taxonomy bridge:
# (target_code_or_None, target_label_or_None, mapping_type, hierarchy_dir, confidence_tier, candidates_or_None, rationale)
AGB_TO_COICOP: dict[tuple[str, str], tuple[str | None, str | None, str, str | None, str, str | None, str]] = {
    ("aides culinaires et ingrédients divers", "aides culinaires"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "high", None, "Culinary stocks/broths classify directly under COICOP 01.1.9 Food products n.e.c."),
    ("aides culinaires et ingrédients divers", "algues"): ("CP0117", COICOP_LABELS["CP0117"], "approximate", None, "low", "CP0117 (Vegetables); CP0119 (Food n.e.c.)", "Edible seaweeds sit between COICOP 01.1.7 aquatic vegetables and 01.1.9 specialty ingredients."),
    ("aides culinaires et ingrédients divers", "condiments"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "high", None, "Mustard, vinegar & condiments belong under COICOP 01.1.9 Food products n.e.c."),
    ("aides culinaires et ingrédients divers", "denrées destinées à une alimentation particulière"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "moderate", None, "Dietetic/special nutrition formulas map to COICOP 01.1.9 Food products n.e.c. (dietetic preparations)."),
    ("aides culinaires et ingrédients divers", "herbes"): ("CP0117", COICOP_LABELS["CP0117"], "ambiguous", None, "moderate", "CP0117 (Fresh culinary herbs); CP0119 (Dried herbs & spices)", "COICOP splits fresh culinary herbs (01.1.7) from dried/processed culinary herbs (01.1.9)."),
    ("aides culinaires et ingrédients divers", "ingrédients divers"): ("CP0119", COICOP_LABELS["CP0119"], "approximate", None, "low", "CP0119; CP0111; CP0118", "Miscellaneous ingredients (gelatin, yeast, starches) predominantly enter COICOP 01.1.9, with starch overlaps in 01.1.1."),
    ("aides culinaires et ingrédients divers", "sauces"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "high", None, "Prepared culinary sauces, ketchup, and dressings classify under COICOP 01.1.9."),
    ("aides culinaires et ingrédients divers", "sels"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "high", None, "Table & cooking salts classify unambiguously under COICOP 01.1.9.1."),
    ("aides culinaires et ingrédients divers", "épices"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "high", None, "Dried spices and spice blends classify under COICOP 01.1.9.1."),

    ("aliments infantiles", "céréales et biscuits infantiles"): ("CP0119", COICOP_LABELS["CP0119"], "ambiguous", None, "moderate", "CP0119 (Homogenised baby food); CP0111 (Infant cereals)", "COICOP assigns homogenised baby food to 01.1.9 while dry infant cereals may fall under 01.1.1."),
    ("aliments infantiles", "desserts infantiles"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "high", None, "Prepared homogenised fruit/dairy baby desserts classify under COICOP 01.1.9 Homogenised baby food."),
    ("aliments infantiles", "laits et boissons infantiles"): ("CP0114", COICOP_LABELS["CP0114"], "ambiguous", None, "moderate", "CP0114 (Infant milk formula); CP0119 (Baby food preparations)", "COICOP splits infant milk powder (01.1.4) from ready-to-feed infant beverages/foods (01.1.9)."),
    ("aliments infantiles", "petits pots salés et plats infantiles"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "high", None, "Savoury jarred baby meals classify under COICOP 01.1.9 Homogenised baby food."),

    ("boissons", "boisson alcoolisées"): ("CP021", COICOP_LABELS["CP021"], "hierarchical", "narrower", "high", None, "Alcoholic beverages fall under COICOP Division 02.1, outside the Food & Non-Alcoholic Beverages COICOP 01.1 HICP scope."),
    ("boissons", "boissons sans alcool"): ("CP012", COICOP_LABELS["CP012"], "hierarchical", "narrower", "high", None, "Soft drinks, juices, coffee & tea map to COICOP 01.2 Non-alcoholic beverages (partially captured in Food+Bev CP01)."),
    ("boissons", "eaux"): ("CP012", COICOP_LABELS["CP012"], "hierarchical", "narrower", "high", "CP012 (Bottled mineral/spring waters); Uncovered (Municipal tap water)", "Bottled water belongs to COICOP 01.2.2; municipal tap water sits outside COICOP food classification."),

    ("entrées et plats composés", "feuilletées et autres entrées"): ("CP0119", COICOP_LABELS["CP0119"], "ambiguous", None, "moderate", "CP0119 (Ready-made composite starters); CP0111 (Savoury pastries)", "Savoury pastry starters split between COICOP 01.1.1 bakery and 01.1.9 composite dishes."),
    ("entrées et plats composés", "pizzas, tartes et crêpes salées"): ("CP0111", COICOP_LABELS["CP0111"], "ambiguous", None, "moderate", "CP0111 (Pizzas & quiches under Eurostat ECOICOP 01.1.1); CP0119 (Ready meals)", "Eurostat COICOP groups pizzas & quiches under 01.1.1.7, whereas ready-to-bake/chilled composite variants overlap 01.1.9."),
    ("entrées et plats composés", "plats composés"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "moderate", None, "Multi-ingredient composite meat/fish/pasta meals classify primarily under COICOP 01.1.9 Food products n.e.c."),
    ("entrées et plats composés", "plats végétariens"): ("CP0119", COICOP_LABELS["CP0119"], "approximate", None, "moderate", "CP0119 (Ready vegetarian dishes); CP0117 (Prepared vegetable/pulse patties)", "Vegetarian composite meals fall in 01.1.9, though simple legume/soy escalopes overlap 01.1.7."),
    ("entrées et plats composés", "salades composées et crudités"): ("CP0117", COICOP_LABELS["CP0117"], "ambiguous", None, "moderate", "CP0117 (Prepared vegetable salads); CP0119 (Composite deli salads)", "Deli salads with pasta/protein sit between COICOP 01.1.7 prepared vegetables and 01.1.9 ready dishes."),
    ("entrées et plats composés", "sandwichs"): ("CP0111", COICOP_LABELS["CP0111"], "ambiguous", None, "moderate", "CP0111 (Bakery-based filled rolls); CP0119 (Takeaway convenience sandwiches); COICOP 11.1 (Catering)", "Retail prepacked sandwiches span COICOP 01.1.1, 01.1.9, and out-of-home catering 11.1 depending on purchase outlet."),
    ("entrées et plats composés", "soupes"): ("CP0119", COICOP_LABELS["CP0119"], "hierarchical", "narrower", "high", None, "Prepared liquid and dehydrated soups classify under COICOP 01.1.9 Food products n.e.c."),

    ("fruits, légumes, légumineuses et oléagineux", "fruits"): ("CP0116", COICOP_LABELS["CP0116"], "hierarchical", "narrower", "high", None, "Narrower subset of COICOP 01.1.6: Eurostat 01.1.6 also includes tree nuts (which Agribalyse separates into 'fruits à coque')."),
    ("fruits, légumes, légumineuses et oléagineux", "fruits à coque et graines oléagineuses"): ("CP0116", COICOP_LABELS["CP0116"], "hierarchical", "narrower", "high", None, "Eurostat COICOP 2018 places tree nuts, peanuts, and edible seeds under 01.1.6.4/.8 Fruit."),
    ("fruits, légumes, légumineuses et oléagineux", "légumes"): ("CP0117", COICOP_LABELS["CP0117"], "hierarchical", "narrower", "high", None, "Vegetables form the primary subclass inside COICOP 01.1.7 (excluding potatoes/pulses separated in Agribalyse)."),
    ("fruits, légumes, légumineuses et oléagineux", "légumineuses"): ("CP0117", COICOP_LABELS["CP0117"], "hierarchical", "narrower", "high", None, "Dried and cooked pulses/legumes classify under COICOP 01.1.7.4/.5 Vegetables."),
    ("fruits, légumes, légumineuses et oléagineux", "pommes de terre et autres tubercules"): ("CP0117", COICOP_LABELS["CP0117"], "hierarchical", "narrower", "high", None, "Eurostat COICOP places potatoes and tubers inside 01.1.7.4 Vegetables."),

    ("glaces et sorbets", "desserts glacés"): ("CP0118", COICOP_LABELS["CP0118"], "hierarchical", "narrower", "high", None, "Edible ices and frozen desserts classify under COICOP 01.1.8.4 Sugar, jam, chocolate & ice cream."),
    ("glaces et sorbets", "glaces"): ("CP0118", COICOP_LABELS["CP0118"], "hierarchical", "narrower", "high", None, "Dairy & vegan ice creams classify under COICOP 01.1.8.4."),
    ("glaces et sorbets", "sorbets"): ("CP0118", COICOP_LABELS["CP0118"], "hierarchical", "narrower", "high", None, "Fruit sorbets classify under COICOP 01.1.8.4."),

    ("lait et produits laitiers", "crèmes et spécialités à base de crème"): ("CP0114", COICOP_LABELS["CP0114"], "hierarchical", "narrower", "high", None, "Dairy cream classifies inside COICOP 01.1.4.7 Milk, cheese and eggs."),
    ("lait et produits laitiers", "fromages"): ("CP0114", COICOP_LABELS["CP0114"], "hierarchical", "narrower", "high", None, "All dairy cheeses classify directly inside COICOP 01.1.4.5 Cheese and curd."),
    ("lait et produits laitiers", "laits"): ("CP0114", COICOP_LABELS["CP0114"], "ambiguous", None, "moderate", "CP0114 (Dairy cow/goat/sheep milk); CP0119/CP012 (Plant-based milk alternatives)", "Agribalyse 'laits' groups cow milk (COICOP 01.1.4) alongside soy/oat/almond drinks."),
    ("lait et produits laitiers", "produits laitiers frais et assimilés"): ("CP0114", COICOP_LABELS["CP0114"], "hierarchical", "narrower", "moderate", "CP0114 (Yogurt/fromage frais); CP0118/CP0119 (Chocolate & soy desserts)", "Fresh dairy desserts mostly map to COICOP 01.1.4, though cocoa/soy puddings can sit in 01.1.8/01.1.9."),

    ("matières grasses", "autres matières grasses"): ("CP0115", COICOP_LABELS["CP0115"], "hierarchical", "narrower", "high", None, "Animal cooking fats (lard, duck fat, tallow) map to COICOP 01.1.5.5 Other edible oils & fats."),
    ("matières grasses", "beurres"): ("CP0115", COICOP_LABELS["CP0115"], "hierarchical", "narrower", "high", None, "Butter belongs under COICOP 01.1.5.1 Oils and fats (distinct from COICOP 01.1.4 Dairy)."),
    ("matières grasses", "huiles de poissons"): (None, None, "unmatched", None, "unmatched", None, "Fish oil capsules/supplements have no clean COICOP 01.1 food price index division (medical/supplement boundary)."),
    ("matières grasses", "huiles et graisses végétales"): ("CP0115", COICOP_LABELS["CP0115"], "hierarchical", "narrower", "high", None, "Olive, sunflower, rapeseed & coconut oils map directly under COICOP 01.1.5.3/.4 Oils and fats."),
    ("matières grasses", "margarines"): ("CP0115", COICOP_LABELS["CP0115"], "hierarchical", "narrower", "high", None, "Margarines and vegetable fat spreads classify under COICOP 01.1.5.2 Oils and fats."),

    ("produits céréaliers", "céréales de petit-déjeuner et biscuits"): ("CP0111", COICOP_LABELS["CP0111"], "ambiguous", None, "moderate", "CP0111 (Breakfast cereals & sweet/savoury biscuits); CP0118 (Chocolate-coated confectionery bars)", "Most biscuits/cereals map to COICOP 01.1.1, while chocolate-enrobed bars straddle 01.1.8 Confectionery."),
    ("produits céréaliers", "farines et pâtes à tarte"): ("CP0111", COICOP_LABELS["CP0111"], "hierarchical", "narrower", "high", None, "Flours, semolina, and raw pastry doughs belong under COICOP 01.1.1.2 Flours and other cereals."),
    ("produits céréaliers", "gâteaux et pâtisseries"): ("CP0111", COICOP_LABELS["CP0111"], "hierarchical", "narrower", "high", None, "Cakes, pastries, and tarts belong under COICOP 01.1.1.4 Other bakery products."),
    ("produits céréaliers", "pains et viennoiseries"): ("CP0111", COICOP_LABELS["CP0111"], "hierarchical", "narrower", "high", None, "Bread and viennoiserie map directly to COICOP 01.1.1.3 Bread."),
    ("produits céréaliers", "pâtes, riz et céréales"): ("CP0111", COICOP_LABELS["CP0111"], "hierarchical", "narrower", "high", None, "Rice, pasta, couscous, quinoa & oats map to COICOP 01.1.1.1/.6 Bread and cereals."),

    ("produits sucrés", "chocolats et produits à base de chocolat"): ("CP0118", COICOP_LABELS["CP0118"], "hierarchical", "narrower", "high", None, "Chocolate bars and spreads map directly to COICOP 01.1.8.3 Chocolate."),
    ("produits sucrés", "confiseries non chocolatées"): ("CP0118", COICOP_LABELS["CP0118"], "hierarchical", "narrower", "high", None, "Sugar confectionery, candies & chewing gum map to COICOP 01.1.8.5."),
    ("produits sucrés", "confitures et assimilés"): ("CP0118", COICOP_LABELS["CP0118"], "hierarchical", "narrower", "high", None, "Jams, marmalades, compotes with added sugar & spreads map to COICOP 01.1.8.2."),
    ("produits sucrés", "sucres, miels et assimilés"): ("CP0118", COICOP_LABELS["CP0118"], "hierarchical", "narrower", "high", None, "Refined sugars, honey, maple & syrups map to COICOP 01.1.8.1/.2."),

    ("viandes, œufs, poissons", "autres produits à base de viande"): ("CP0112", COICOP_LABELS["CP0112"], "hierarchical", "narrower", "high", None, "Prepared meat preparations/offal belong under COICOP 01.1.2 Meat."),
    ("viandes, œufs, poissons", "charcuteries"): ("CP0112", COICOP_LABELS["CP0112"], "hierarchical", "narrower", "high", None, "Processed/cured/dried/salted meats classify under COICOP 01.1.2.7 Meat."),
    ("viandes, œufs, poissons", "mollusques et crustacés crus"): ("CP0113", COICOP_LABELS["CP0113"], "hierarchical", "narrower", "high", None, "Raw shellfish/crustaceans/molluscs map to COICOP 01.1.3.2/.3 Fish and seafood."),
    ("viandes, œufs, poissons", "mollusques et crustacés cuits"): ("CP0113", COICOP_LABELS["CP0113"], "hierarchical", "narrower", "high", None, "Cooked shellfish/crustaceans map to COICOP 01.1.3 Fish and seafood."),
    ("viandes, œufs, poissons", "poissons crus"): ("CP0113", COICOP_LABELS["CP0113"], "hierarchical", "narrower", "high", None, "Fresh/chilled/frozen finfish map directly to COICOP 01.1.3.1 Fish and seafood."),
    ("viandes, œufs, poissons", "poissons cuits"): ("CP0113", COICOP_LABELS["CP0113"], "approximate", None, "moderate", None, "Cooked fish portions represent domestic preparation states of raw COICOP 01.1.3 retail purchases."),
    ("viandes, œufs, poissons", "produits à base de poissons et produits de la mer"): ("CP0113", COICOP_LABELS["CP0113"], "hierarchical", "narrower", "high", None, "Smoked, breaded, canned, and surimi seafood map to COICOP 01.1.3.5/.6."),
    ("viandes, œufs, poissons", "substituts de charcuterie"): ("CP0119", COICOP_LABELS["CP0119"], "ambiguous", None, "moderate", "CP0119 (Plant-based meat analogues); CP0112 (Veg deli alternatives priced in meat aisles)", "EU HICP national baskets lack a uniform COICOP split between meat substitutes (01.1.9) and meat (01.1.2)."),
    ("viandes, œufs, poissons", "substituts de viande"): ("CP0119", COICOP_LABELS["CP0119"], "ambiguous", None, "moderate", "CP0119 (Plant-based protein analogues); CP0117 (Pulses/tofu preparations)", "Retail Eurostat COICOP splits vegan burger/tofu substitutes inconsistently between 01.1.9 and 01.1.7."),
    ("viandes, œufs, poissons", "viandes crues"): ("CP0112", COICOP_LABELS["CP0112"], "ambiguous", None, "high", "CP0112 (Bovine, Pork, Poultry combined)", "Matches COICOP 01.1.2 Meat cleanly at 4-digit level, but merges ruminant beef (~28 kg CO2/kg) with poultry (~4 kg CO2/kg)."),
    ("viandes, œufs, poissons", "viandes cuites"): ("CP0112", COICOP_LABELS["CP0112"], "approximate", None, "moderate", None, "Cooked meat weights reflect kitchen yield/moisture loss relative to raw retail purchases in COICOP 01.1.2."),
    ("viandes, œufs, poissons", "œufs"): ("CP0114", COICOP_LABELS["CP0114"], "hierarchical", "narrower", "high", None, "Eggs classify inside COICOP 01.1.4.7 Milk, cheese and eggs."),
}

# Bridge all 61 Agribalyse subgroups -> FoodEx2 categories available in efsa_foodex2_surveys.parquet (15 categories)
# Unrepresented subgroups stay strictly 'unmatched' (NEVER invented).
AGB_TO_FOODEX2: dict[tuple[str, str], tuple[str | None, str | None, str, str | None, str, str | None, str]] = {
    ("produits céréaliers", "pains et viennoiseries"): ("A01QR", "Wholegrain bread & oats", "ambiguous", None, "moderate", "A01QR (Wholegrain bread); A000J (White bakery/refined wheat)", "Agribalyse merges wholemeal bread (A01QR), white bread & viennoiserie (A000J) into one subgroup."),
    ("produits céréaliers", "pâtes, riz et céréales"): ("A000J", "Refined bakery & white pasta", "ambiguous", None, "moderate", "A000J (Refined white pasta/rice); A01QR (Wholegrain oats/grains)", "Subgroup mixes white rice/pasta (A000J) with oats & wholegrain cereals (A01QR)."),
    ("produits céréaliers", "farines et pâtes à tarte"): ("A000J", "Refined bakery & white pasta", "approximate", None, "moderate", None, "Intermediate flour/dough inputs are proxied via bakery/pasta output category A000J in the stylized FoodEx2 table."),
    ("produits céréaliers", "céréales de petit-déjeuner et biscuits"): ("A034F", "Sweet snacks, confectionery & biscuits", "ambiguous", None, "moderate", "A034F (Sweet biscuits); A01QR (Plain oat breakfast cereals)", "Sweet biscuits map to A034F whereas unsweetened oat/bran flakes belong to A01QR."),
    ("produits céréaliers", "gâteaux et pâtisseries"): ("A034F", "Sweet snacks, confectionery & biscuits", "approximate", None, "moderate", None, "Cakes & sweet pastries overlap EFSA FoodEx2 A034F within the 15 available FoodEx2 survey categories."),

    ("viandes, œufs, poissons", "viandes crues"): ("A01QX", "Bovine & ovine ruminant red meat", "ambiguous", None, "low", "A01QX (Ruminant beef/lamb); A01RG (Pork/poultry white meat)", "Agribalyse stores beef, lamb, pork, poultry, and game all under 'viandes crues', spanning both FoodEx2 meat regimes."),
    ("viandes, œufs, poissons", "viandes cuites"): ("A01QX", "Bovine & ovine ruminant red meat", "ambiguous", None, "low", "A01QX (Cooked ruminant); A01RG (Cooked pork/poultry)", "Cooked meats likewise combine ruminant and monogastric species."),
    ("viandes, œufs, poissons", "charcuteries"): ("A01RG", "Porcine & poultry white/cured meat", "hierarchical", "narrower", "high", None, "Cured pork/poultry charcuterie maps directly to EFSA FoodEx2 survey anchor A01RG."),
    ("viandes, œufs, poissons", "autres produits à base de viande"): ("A01RG", "Porcine & poultry white/cured meat", "ambiguous", None, "low", "A01RG; A01QX", "Mixed processed meat products and offal cannot be assigned unambiguously to ruminant vs. porcine."),
    ("viandes, œufs, poissons", "substituts de viande"): ("A03TD", "Plant-based meat analogues (extruded)", "exact", "equivalent", "high", None, "Direct 1:1 domain alignment between Agribalyse 'substituts de viande' and FoodEx2 survey node A03TD."),
    ("viandes, œufs, poissons", "substituts de charcuterie"): ("A03TD", "Plant-based meat analogues (extruded)", "hierarchical", "narrower", "moderate", None, "Plant-based cold-cut analogues are a narrower subset of extruded meat analogues A03TD."),
    ("viandes, œufs, poissons", "poissons crus"): ("A026V", "Marine & aquaculture fish fillets", "hierarchical", "narrower", "high", None, "Raw finfish map cleanly to FoodEx2 A026V Marine & aquaculture fish fillets."),
    ("viandes, œufs, poissons", "poissons cuits"): ("A026V", "Marine & aquaculture fish fillets", "approximate", None, "moderate", None, "Cooked finfish map approximately (cooking weight-loss differential) to A026V."),
    ("viandes, œufs, poissons", "produits à base de poissons et produits de la mer"): ("A026V", "Marine & aquaculture fish fillets", "approximate", None, "moderate", None, "Breaded, canned & smoked fish sit near A026V, though processing & breading alter impact intensity."),
    ("viandes, œufs, poissons", "mollusques et crustacés crus"): (None, None, "unmatched", None, "unmatched", None, "FoodEx2 survey matrix in this atlas covers finfish (A026V) only and has no crustacean/mollusc code."),
    ("viandes, œufs, poissons", "mollusques et crustacés cuits"): (None, None, "unmatched", None, "unmatched", None, "No crustacean/mollusc code present in the 15-group FoodEx2 survey table."),
    ("viandes, œufs, poissons", "œufs"): (None, None, "unmatched", None, "unmatched", None, "Eggs are absent from the 15-category efsa_foodex2_surveys table (no A031G Eggs row ingested)."),

    ("lait et produits laitiers", "laits"): ("A02LR", "Liquid cow milk & fermented yogurt", "ambiguous", None, "moderate", "A02LR (Cow milk); A03TH (Oat/soy drinks)", "Agribalyse 'laits' contains dairy milks (A02LR) plus plant-based drinks like soy/oat milk (A03TH)."),
    ("lait et produits laitiers", "produits laitiers frais et assimilés"): ("A02LR", "Liquid cow milk & fermented yogurt", "ambiguous", None, "moderate", "A02LR (Plain/fruit yogurts); A034F (Dairy sweet desserts)", "Combines fermented yogurts (A02LR) with sweet dairy/chocolate desserts."),
    ("lait et produits laitiers", "fromages"): ("A02QE", "Ripened hard & soft dairy cheeses", "exact", "equivalent", "high", None, "Direct alignment between Agribalyse 'fromages' (121 items) and FoodEx2 A02QE Ripened hard & soft dairy cheeses."),
    ("lait et produits laitiers", "crèmes et spécialités à base de crème"): (None, None, "unmatched", None, "unmatched", None, "Dairy creams are not separately represented in the 15-group FoodEx2 survey matrix."),

    ("fruits, légumes, légumineuses et oléagineux", "fruits"): ("A01BS", "Fresh temperate & citrus fruits", "hierarchical", "broader", "high", None, "Broader than FoodEx2 A01BS: Agribalyse 'fruits' includes canned fruits in syrup and dried fruits alongside fresh fruit."),
    ("fruits, légumes, légumineuses et oléagineux", "légumes"): ("A00FJ", "Leafy greens, brassicas & root veg", "exact", "equivalent", "high", None, "Direct alignment with FoodEx2 A00FJ Leafy greens, brassicas & root veg."),
    ("fruits, légumes, légumineuses et oléagineux", "légumineuses"): ("A011X", "Lentils, chickpeas, beans & pulses", "exact", "equivalent", "high", None, "Direct alignment between Agribalyse legumes/pulses and FoodEx2 A011X."),
    ("fruits, légumes, légumineuses et oléagineux", "fruits à coque et graines oléagineuses"): ("A014C", "Tree nuts, peanuts & seeds", "exact", "equivalent", "high", None, "Direct alignment between Agribalyse nuts/oilseeds and FoodEx2 A014C."),
    ("fruits, légumes, légumineuses et oléagineux", "pommes de terre et autres tubercules"): (None, None, "unmatched", None, "unmatched", None, "Starchy tubers are separated from green vegetables in EFSA FoodEx2 and are not included in the 15-group survey table."),

    ("entrées et plats composés", "pizzas, tartes et crêpes salées"): ("A03LZ", "Convenience frozen & chilled meals", "hierarchical", "narrower", "high", None, "Pizzas and savoury tarts form a direct narrower slice of FoodEx2 A03LZ Convenience meals."),
    ("entrées et plats composés", "plats composés"): ("A03LZ", "Convenience frozen & chilled meals", "hierarchical", "narrower", "moderate", None, "Ready composite meals map directly to FoodEx2 A03LZ."),
    ("entrées et plats composés", "plats végétariens"): ("A03TD", "Plant-based meat analogues (extruded)", "ambiguous", None, "moderate", "A03TD (Soy patties); A03LZ (Vegetarian composite dishes)", "Combines tofu/soy meat-analogue patties (A03TD) with composite vegetarian dishes like veggie lasagne (A03LZ)."),
    ("entrées et plats composés", "sandwichs"): ("A03LZ", "Convenience frozen & chilled meals", "approximate", None, "low", None, "Convenience sandwiches fall loosely under ready-to-eat composite foods A03LZ."),
    ("entrées et plats composés", "feuilletées et autres entrées"): ("A03LZ", "Convenience frozen & chilled meals", "approximate", None, "low", None, "Ready savoury starters approximate composite convenience foods A03LZ."),
    ("entrées et plats composés", "salades composées et crudités"): ("A00FJ", "Leafy greens, brassicas & root veg", "ambiguous", None, "low", "A00FJ (Raw crudités); A03LZ (Deli composite salads)", "Simple raw crudités belong with vegetables A00FJ while deli pasta/protein salads belong with A03LZ."),
    ("entrées et plats composés", "soupes"): (None, None, "unmatched", None, "unmatched", None, "Soups are not represented in the current 15-group FoodEx2 survey table."),

    ("produits sucrés", "chocolats et produits à base de chocolat"): ("A034F", "Sweet snacks, confectionery & biscuits", "hierarchical", "narrower", "high", None, "Chocolate bars and products belong inside FoodEx2 A034F Sweet snacks & confectionery."),
    ("produits sucrés", "confiseries non chocolatées"): ("A034F", "Sweet snacks, confectionery & biscuits", "hierarchical", "narrower", "high", None, "Sugar confectionery maps to FoodEx2 A034F."),
    ("produits sucrés", "confitures et assimilés"): (None, None, "unmatched", None, "unmatched", None, "Jams/marmalades have no explicit category among the 15 ingested FoodEx2 groups."),
    ("produits sucrés", "sucres, miels et assimilés"): (None, None, "unmatched", None, "unmatched", None, "Table sugars and honey are omitted from the 15 ingested FoodEx2 groups."),
}


def build_mappings() -> list[dict[str, Any]]:
    con = duckdb.connect()

    # Dynamic inspection from actual Parquet tables
    agb_rows = con.execute("""
        SELECT Groupe_aliment, Sous_groupe_aliment, COUNT(*) AS cnt, ARG_MIN(Code_AGB, Code_AGB) AS rep_code
        FROM read_parquet('public/data/parquet/agribalyse_31.parquet')
        GROUP BY 1, 2 ORDER BY 1, 2
    """).fetchall()
    agb_stats = {(g, sg): (int(cnt), str(code)) for g, sg, cnt, code in agb_rows}

    off_rows = con.execute("""
        SELECT category, COUNT(*) AS cnt
        FROM read_parquet('public/data/parquet/openfoodfacts_eu.parquet')
        GROUP BY 1 ORDER BY 1
    """).fetchall()
    off_stats = {str(cat): int(cnt) for cat, cnt in off_rows}

    fx_rows = con.execute("""
        SELECT DISTINCT foodex2_code, foodex2_level1, foodex2_level2
        FROM read_parquet('public/data/parquet/efsa_foodex2_surveys.parquet')
        ORDER BY 1
    """).fetchall()
    fx_stats = {str(c): (str(l1), str(l2)) for c, l1, l2 in fx_rows}

    con.close()

    if set(agb_stats.keys()) != set(AGB_TO_COICOP.keys()):
        diff = set(agb_stats.keys()) ^ set(AGB_TO_COICOP.keys())
        raise RuntimeError(f"Agribalyse subgroup mismatch with AGB_TO_COICOP: {diff}")
    if set(fx_stats.keys()) != set(FOODEX2_LABELS.keys()):
        diff = set(fx_stats.keys()) ^ set(FOODEX2_LABELS.keys())
        raise RuntimeError(f"FoodEx2 mismatch with FOODEX2_LABELS: {diff}")

    records: list[dict[str, Any]] = []

    def add_record(
        mapping_id: str,
        source_system: str,
        source_code: str,
        source_label: str,
        source_parent_label: str | None,
        source_item_count: int,
        target_system: str,
        target_code: str | None,
        target_label: str | None,
        mapping_type: str,
        hierarchy_direction: str | None,
        confidence_tier: str,
        candidate_targets: str | None,
        representative_agb_code: str | None,
        rationale: str,
        source_reference: str,
    ) -> None:
        assert mapping_type in {"exact", "hierarchical", "approximate", "ambiguous", "unmatched"}
        if mapping_type == "unmatched":
            assert target_code is None and target_label is None and confidence_tier == "unmatched"
        records.append({
            "mapping_id": mapping_id,
            "source_system": source_system,
            "source_code": source_code,
            "source_label": source_label,
            "source_parent_label": source_parent_label,
            "source_item_count": source_item_count,
            "target_system": target_system,
            "target_code": target_code,
            "target_label": target_label,
            "mapping_type": mapping_type,
            "hierarchy_direction": hierarchy_direction,
            "confidence_tier": confidence_tier,
            "is_ambiguous": mapping_type == "ambiguous",
            "is_unmatched": mapping_type == "unmatched",
            "candidate_targets": candidate_targets,
            "representative_agb_code": representative_agb_code,
            "rationale": rationale,
            "source_reference": source_reference,
            "mapping_version": MAPPING_VERSION,
        })

    # 1. All 61 Agribalyse subgroups -> COICOP + FoodEx2
    for idx, ((grp, sgrp), (cnt, rep_code)) in enumerate(sorted(agb_stats.items()), start=1):
        src_code = f"AGB:{grp}/{sgrp}"
        src_label = f"{sgrp} ({grp})"
        # 1a. Agribalyse -> COICOP
        t_code, t_lbl, m_type, h_dir, c_tier, cands, rat = AGB_TO_COICOP[(grp, sgrp)]
        add_record(
            mapping_id=f"MAP_AGB_COICOP_{idx:02d}",
            source_system="Agribalyse",
            source_code=src_code,
            source_label=src_label,
            source_parent_label=grp,
            source_item_count=cnt,
            target_system="COICOP",
            target_code=t_code,
            target_label=t_lbl,
            mapping_type=m_type,
            hierarchy_direction=h_dir,
            confidence_tier=c_tier,
            candidate_targets=cands,
            representative_agb_code=rep_code,
            rationale=rat,
            source_reference=SRC_AGB_COICOP,
        )

        # 1b. Agribalyse -> FoodEx2 (explicit unmatched when subgroup has no entry in the 15 FoodEx2 table)
        if (grp, sgrp) in AGB_TO_FOODEX2:
            ft_code, ft_lbl, fm_type, fh_dir, fc_tier, fcands, frat = AGB_TO_FOODEX2[(grp, sgrp)]
        else:
            ft_code, ft_lbl, fm_type, fh_dir, fc_tier, fcands = None, None, "unmatched", None, "unmatched", None
            frat = f"No FoodEx2 category exists in efsa_foodex2_surveys (15 ingested categories) for Agribalyse subgroup '{sgrp}'."
        add_record(
            mapping_id=f"MAP_AGB_FOODEX2_{idx:02d}",
            source_system="Agribalyse",
            source_code=src_code,
            source_label=src_label,
            source_parent_label=grp,
            source_item_count=cnt,
            target_system="FoodEx2",
            target_code=ft_code,
            target_label=ft_lbl,
            mapping_type=fm_type,
            hierarchy_direction=fh_dir,
            confidence_tier=fc_tier,
            candidate_targets=fcands,
            representative_agb_code=rep_code,
            rationale=frat,
            source_reference=SRC_AGB_FOODEX,
        )

    # 2. All 11 Open Food Facts categories -> FoodEx2 and COICOP
    off_rules: dict[str, tuple[tuple[Any, ...], tuple[Any, ...]]] = {
        "Plant-Based Meat & Burger Alternatives": (
            ("A03TD", "Plant-based meat analogues (extruded)", "exact", "equivalent", "high", None, None,
             "OFF vegan/vegetarian burger, patty, and seitan queries map directly to EFSA FoodEx2 A03TD."),
            ("CP0119", COICOP_LABELS["CP0119"], "ambiguous", None, "moderate", "CP0119 (Meat analogues n.e.c.); CP0117 (Legume-based preparations)", None,
             "National statistical institutes classify plant-based meat analogues inconsistently across COICOP 01.1.9 and 01.1.7."),
        ),
        "Plant-Based Milk & Dairy Alternatives": (
            ("A03TH", "Plant-based dairy drinks (oat/soy)", "approximate", None, "high", "A03TH (Oat/soy drinks); A02LR (Dairy yogurt comparison)", None,
             "OFF query combines oat/soy/almond drinks (exact A03TH) with plant-based yogurt alternatives not isolated in A03TH."),
            ("CP0114", COICOP_LABELS["CP0114"], "ambiguous", None, "moderate", "CP0114 (Dairy & dairy-substitute section); CP012 (Non-dairy beverages)", None,
             "COICOP separates soy/oat beverages from cow milk inconsistently across member states (01.1.4 vs 01.1.9/01.2)."),
        ),
        "Legumes, Pulses & Tofu": (
            ("A011X", "Lentils, chickpeas, beans & pulses", "approximate", None, "high", "A011X (Pulses); A03TD (Soy tofu/tempeh processing)", None,
             "Lentils/chickpeas/beans match FoodEx2 A011X exactly, while tofu/tempeh overlap A03TD meat/protein analogues."),
            ("CP0117", COICOP_LABELS["CP0117"], "hierarchical", "narrower", "high", "CP0117 (Dried/canned pulses); CP0119 (Hummus/prepared spreads)", None,
             "Whole pulses sit under COICOP 01.1.7 Vegetables, whereas prepared hummus overlaps 01.1.9."),
        ),
        "Whole Grains, Oats & Cereals": (
            ("A01QR", "Wholegrain bread & oats", "approximate", None, "moderate", "A01QR (Wholegrain bread & oats); A000J (Pasta & brown/white cereals)", None,
             "OFF category pairs wholegrain bread & oats (A01QR) with quinoa/bulgur/pasta which straddle A000J."),
            ("CP0111", COICOP_LABELS["CP0111"], "hierarchical", "narrower", "high", None, None,
             "Narrower subset of COICOP CP0111: Bread and cereals also encompasses white bread, refined pastries, cakes, and sweet bakery."),
        ),
        "Fresh & Frozen Vegetables & Fruits": (
            ("A00FJ", "Leafy greens, brassicas & root veg", "ambiguous", None, "moderate", "A00FJ (Vegetables); A01BS (Fruits)", None,
             "Combined OFF F&V bucket merges FoodEx2 vegetables (A00FJ) and fresh fruits (A01BS) into a single label."),
            ("CP0117", COICOP_LABELS["CP0117"], "ambiguous", None, "moderate", "CP0117 (Vegetables); CP0116 (Fruit)", None,
             "Combined OFF F&V bucket spans two separate 4-digit HICP divisions (CP0116 Fruit and CP0117 Vegetables)."),
        ),
        "Nuts, Seeds & Healthy Oils": (
            ("A014C", "Tree nuts, peanuts & seeds", "ambiguous", None, "moderate", "A014C (Tree nuts & seeds); Unmatched (Olive & rapeseed culinary oils)", None,
             "OFF bucket merges nuts/nut butters (A014C) with culinary olive/rapeseed oils which lack a FoodEx2 oil group in efsa_foodex2_surveys."),
            ("CP0115", COICOP_LABELS["CP0115"], "ambiguous", None, "moderate", "CP0115 (Olive & vegetable oils); CP0116 (Tree nuts & seeds)", None,
             "COICOP cleanly divides edible oils (CP0115) from tree nuts (CP0116), making this combined OFF bucket ambiguous."),
        ),
        "Bovine, Pork & Poultry Meats": (
            ("A01QX", "Bovine & ovine ruminant red meat", "hierarchical", "broader", "high", "A01QX (Ruminant); A01RG (Porcine, poultry & charcuterie)", None,
             "Broader OFF meat bucket encompasses both ruminant meat (A01QX) and porcine/poultry/charcuterie (A01RG)."),
            ("CP0112", COICOP_LABELS["CP0112"], "hierarchical", "narrower", "high", None, None,
             "Narrower subset of COICOP CP0112 Meat: query omits ovine/lamb, game, and edible offal covered under COICOP 01.1.2."),
        ),
        "Dairy Milk, Cheese & Yogurt": (
            ("A02LR", "Liquid cow milk & fermented yogurt", "hierarchical", "broader", "high", "A02LR (Milk & yogurt); A02QE (Ripened cheese)", None,
             "Broader OFF dairy bucket spans both liquid milk/yogurt (A02LR) and cheeses (A02QE)."),
            ("CP0114", COICOP_LABELS["CP0114"], "hierarchical", "narrower", "high", None, None,
             "Milk, cheese, and yogurt map inside COICOP CP0114 (Milk, cheese and eggs), excluding eggs."),
        ),
        "Fish & Seafood": (
            ("A026V", "Marine & aquaculture fish fillets", "hierarchical", "broader", "high", "A026V (Finfish); Unmatched (Shrimp/crustaceans)", None,
             "OFF Fish & Seafood aligns broadly with FoodEx2 A026V but also captures crustaceans like shrimp."),
            ("CP0113", COICOP_LABELS["CP0113"], "hierarchical", "narrower", "high", None, None,
             "Narrower retail query sample inside Eurostat COICOP CP0113 Fish and seafood (salted/mollusc subgroups incomplete)."),
        ),
        "Ultra-Processed Snacks & Confectionery": (
            ("A034F", "Sweet snacks, confectionery & biscuits", "approximate", None, "moderate", "A034F (Chocolate/biscuits/candy); Unmatched (Savoury crisps/pretzels)", None,
             "Chocolate, biscuits & candies map to A034F, whereas potato crisps & pretzels belong in savoury potato/bakery snack nodes."),
            ("CP0118", COICOP_LABELS["CP0118"], "ambiguous", None, "moderate", "CP0118 (Chocolate & confectionery); CP0117 (Potato crisps); CP0111 (Biscuits/crackers)", None,
             "OFF ultra-processed snacks span three COICOP classes: CP0118 confectionery, CP0117 potato crisps, and CP0111 biscuits."),
        ),
        "Ultra-Processed Ready Meals & Sauces": (
            ("A03LZ", "Convenience frozen & chilled meals", "ambiguous", None, "low", "A03LZ (Frozen pizza & ready meals); Unmatched (Soda, cola, energy drinks)", None,
             "OFF query bundles convenience meals (A03LZ) together with carbonated sodas & energy drinks having no FoodEx2 match here."),
            ("CP0119", COICOP_LABELS["CP0119"], "ambiguous", None, "low", "CP0119 (Ready meals); CP0111 (Frozen pizza); CP012 (Soft drinks/energy drinks)", None,
             "Combines COICOP CP0119 ready meals, CP0111 pizza, and CP012 sweetened beverages."),
        ),
    }

    if set(off_stats.keys()) != set(off_rules.keys()):
        raise RuntimeError(f"OFF category mismatch: {set(off_stats.keys()) ^ set(off_rules.keys())}")

    for idx, (cat_name, cnt) in enumerate(sorted(off_stats.items()), start=1):
        fx_rule, cp_rule = off_rules[cat_name]
        ft_code, ft_lbl, fm_type, fh_dir, fc_tier, fcands, _, frat = fx_rule
        add_record(
            mapping_id=f"MAP_OFF_FOODEX2_{idx:02d}",
            source_system="OpenFoodFacts",
            source_code=f"OFF:{cat_name}",
            source_label=cat_name,
            source_parent_label="Open Food Facts EU Catalog (Search-a-licious)",
            source_item_count=cnt,
            target_system="FoodEx2",
            target_code=ft_code,
            target_label=ft_lbl,
            mapping_type=fm_type,
            hierarchy_direction=fh_dir,
            confidence_tier=fc_tier,
            candidate_targets=fcands,
            representative_agb_code=None,
            rationale=frat,
            source_reference=SRC_OFF_FOODEX,
        )

        ct_code, ct_lbl, cm_type, ch_dir, cc_tier, ccands, _, crat = cp_rule
        add_record(
            mapping_id=f"MAP_OFF_COICOP_{idx:02d}",
            source_system="OpenFoodFacts",
            source_code=f"OFF:{cat_name}",
            source_label=cat_name,
            source_parent_label="Open Food Facts EU Catalog (Search-a-licious)",
            source_item_count=cnt,
            target_system="COICOP",
            target_code=ct_code,
            target_label=ct_lbl,
            mapping_type=cm_type,
            hierarchy_direction=ch_dir,
            confidence_tier=cc_tier,
            candidate_targets=ccands,
            representative_agb_code=None,
            rationale=crat,
            source_reference=SRC_OFF_COICOP,
        )

    # 3. All 15 FoodEx2 survey groups -> COICOP (plus explicit unmatched Eurostat COICOP gaps)
    fx_to_coicop: dict[str, tuple[str | None, str | None, str, str | None, str, str | None, str]] = {
        "A000J": ("CP0111", COICOP_LABELS["CP0111"], "hierarchical", "narrower", "high", None, "Refined bakery & white pasta sit inside COICOP 01.1.1 Bread and cereals."),
        "A01QR": ("CP0111", COICOP_LABELS["CP0111"], "hierarchical", "narrower", "high", None, "Wholegrain bread & oats sit inside COICOP 01.1.1 Bread and cereals."),
        "A01QX": ("CP0112", COICOP_LABELS["CP0112"], "hierarchical", "narrower", "high", None, "Bovine & ovine ruminant red meat maps cleanly under COICOP 01.1.2 Meat (narrower subset)."),
        "A01RG": ("CP0112", COICOP_LABELS["CP0112"], "hierarchical", "narrower", "high", None, "Porcine, poultry & cured meats sit inside COICOP 01.1.2 Meat (narrower subset)."),
        "A03TD": ("CP0119", COICOP_LABELS["CP0119"], "ambiguous", None, "moderate", "CP0119 (Food n.e.c.); CP0117 (Pulse-based foods)", "No dedicated HICP COICOP plant-analogue index; countries classify under 01.1.9 or 01.1.7."),
        "A026V": ("CP0113", COICOP_LABELS["CP0113"], "hierarchical", "narrower", "high", None, "Marine & aquaculture fish fillets form the core of COICOP 01.1.3 Fish and seafood."),
        "A02LR": ("CP0114", COICOP_LABELS["CP0114"], "hierarchical", "narrower", "high", None, "Liquid milk & natural yogurt map inside COICOP 01.1.4 Milk, cheese and eggs."),
        "A02QE": ("CP0114", COICOP_LABELS["CP0114"], "hierarchical", "narrower", "high", None, "Ripened hard & soft dairy cheeses map cleanly inside COICOP 01.1.4."),
        "A03TH": ("CP0114", COICOP_LABELS["CP0114"], "ambiguous", None, "low", "CP0114 (Dairy substitutes); CP012 (Non-alcoholic drinks); CP0119 (Food n.e.c.)", "Plant-based drinks sit awkwardly across HICP 01.1.4, 01.1.9, and 01.2 depending on national CPI rules."),
        "A01BS": ("CP0116", COICOP_LABELS["CP0116"], "hierarchical", "narrower", "high", None, "Fresh fruits form the core of COICOP 01.1.6 Fruit (narrower subset excluding dried/nuts)."),
        "A00FJ": ("CP0117", COICOP_LABELS["CP0117"], "hierarchical", "narrower", "high", None, "Leafy greens, tomatoes & root vegetables sit inside COICOP 01.1.7 Vegetables."),
        "A011X": ("CP0117", COICOP_LABELS["CP0117"], "hierarchical", "narrower", "high", None, "Dried/cooked pulses sit inside COICOP 01.1.7.5 Vegetables."),
        "A014C": ("CP0116", COICOP_LABELS["CP0116"], "hierarchical", "narrower", "high", None, "Tree nuts, peanuts & seeds classify inside COICOP 01.1.6 under Eurostat COICOP 2018."),
        "A034F": ("CP0118", COICOP_LABELS["CP0118"], "ambiguous", None, "moderate", "CP0118 (Confectionery & chocolate); CP0111 (Sweet biscuits)", "A034F spans both COICOP 01.1.8 confectionery and COICOP 01.1.1 sweet biscuits."),
        "A03LZ": ("CP0119", COICOP_LABELS["CP0119"], "approximate", None, "moderate", "CP0119 (Composite meals); CP0111 (Frozen pizzas)", "Frozen/chilled ready meals sit mostly in 01.1.9 with frozen pizzas sitting in 01.1.1."),
    }

    for idx, (fx_code, (l1, l2)) in enumerate(sorted(fx_stats.items()), start=1):
        ct_code, ct_lbl, cm_type, ch_dir, cc_tier, ccands, crat = fx_to_coicop[fx_code]
        add_record(
            mapping_id=f"MAP_FOODEX2_COICOP_{idx:02d}",
            source_system="FoodEx2",
            source_code=fx_code,
            source_label=l2,
            source_parent_label=l1,
            source_item_count=1,
            target_system="COICOP",
            target_code=ct_code,
            target_label=ct_lbl,
            mapping_type=cm_type,
            hierarchy_direction=ch_dir,
            confidence_tier=cc_tier,
            candidate_targets=ccands,
            representative_agb_code=None,
            rationale=crat,
            source_reference=SRC_FOODEX_COICOP,
        )

    # 4. Unmatched Eurostat COICOP food/beverage divisions absent from FoodEx2 & OFF curated tables
    add_record(
        mapping_id="MAP_COICOP_FOODEX2_UNMATCHED_01",
        source_system="COICOP",
        source_code="CP0115",
        source_label=COICOP_LABELS["CP0115"],
        source_parent_label="CP01 Food and non-alcoholic beverages",
        source_item_count=1,
        target_system="FoodEx2",
        target_code=None,
        target_label=None,
        mapping_type="unmatched",
        hierarchy_direction=None,
        confidence_tier="unmatched",
        candidate_targets=None,
        representative_agb_code=None,
        rationale="Eurostat COICOP 01.1.5 Oils & fats (butter, margarine, olive/vegetable oil) has no corresponding category in the 15-group efsa_foodex2_surveys table.",
        source_reference=SRC_FOODEX_COICOP,
    )
    add_record(
        mapping_id="MAP_COICOP_FOODEX2_UNMATCHED_02",
        source_system="COICOP",
        source_code="CP012",
        source_label=COICOP_LABELS["CP012"],
        source_parent_label="CP01 Food and non-alcoholic beverages",
        source_item_count=1,
        target_system="FoodEx2",
        target_code=None,
        target_label=None,
        mapping_type="unmatched",
        hierarchy_direction=None,
        confidence_tier="unmatched",
        candidate_targets=None,
        representative_agb_code=None,
        rationale="Coffee, tea, cocoa, bottled water, fruit juices & sodas (COICOP 01.2) lack a matching group in the 15-category efsa_foodex2_surveys table.",
        source_reference=SRC_FOODEX_COICOP,
    )

    return records


def main() -> None:
    rows = build_mappings()
    out_json = DATA_DIR / "classification_mappings.json"
    out_parquet = PARQUET_DIR / "classification_mappings.parquet"
    out_json.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")

    con = duckdb.connect()
    con.execute("CREATE TABLE cm AS SELECT * FROM read_json_auto(?, sample_size=-1)", [str(out_json)])
    con.execute(f"COPY cm TO '{out_parquet}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    summary = con.execute("""
        SELECT mapping_type, COUNT(*), SUM(source_item_count)
        FROM cm GROUP BY 1 ORDER BY 2 DESC
    """).fetchall()
    con.close()

    print(f"[OK] Generated {len(rows)} classification mapping rules -> {out_json.name} & {out_parquet.name}")
    for m_type, cnt, items in summary:
        print(f"     {m_type:14s}: {cnt:3d} rules ({items} source items/nodes)")


if __name__ == "__main__":
    main()
