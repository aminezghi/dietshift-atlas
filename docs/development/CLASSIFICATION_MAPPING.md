# DietShift Atlas — Food Classification & Harmonisation Architecture (Phase 3A)

## 1. Taxonomies Covered
- **ADEME Agribalyse 3.1.1 (`Agribalyse`)**: All `61` distinct `(Groupe_aliment, Sous_groupe_aliment)` subcategories covering `2,451` LCI items, each dynamically linked to row counts and representative `Code_AGB` foreign keys.
- **EFSA FoodEx2 (`FoodEx2`)**: All `15` stylized food groups present in `efsa_foodex2_surveys.parquet` (`A000J` through `A03TH`).
  > **Scope Disclosure:** `efsa_foodex2_surveys.parquet` is a `15`-category stylized intake matrix (`24` countries × `3` age strata), **not** the complete multi-level EFSA FoodEx2 master catalogue or raw EFSA Comprehensive Database microdata. Consequently, categories absent from these `15` groups (e.g., eggs, oils/fats, potatoes, soups, crustaceans, herbs/spices) are explicitly preserved as `unmatched`.
- **Open Food Facts EU (`OpenFoodFacts`)**: All `11` curated query clusters covering `3,197` products in `openfoodfacts_eu.parquet`.
- **Eurostat COICOP / ECOICOP (`COICOP`)**: Eurostat HICP/HBS divisions (`CP0111`–`CP0119`, `CP012`, `CP021`) plus 5-digit ECOICOP sub-anchors in `crosswalk_rosetta.parquet`.

## 2. Classification Criteria & Semantic Validation

Every rule in `public/data/parquet/classification_mappings.parquet` (`161` rules, generated deterministically by `scripts/build_classification_mappings.py`) classifies pairs using strict set-theoretic and scope criteria rather than lexical similarity:

| Mapping Type | Strict Qualification Criteria | Rules | Source Items |
| :--- | :--- | ---: | ---: |
| **`exact`** | Both categories define the **same conceptual boundary** within the modeled scope—neither side systematically omits major sub-items present in the other or merges external groups. | 6 | 789 |
| **`hierarchical`** | One category is a clean subset (`narrower`) or clean superset (`broader`) of the target division without crossing unrelated taxonomic branches. | 70 | 4,080 |
| **`approximate`** | Partial thematic overlap where secondary items fall outside the target boundary (e.g., cooking state shifts, plant yogurts mixed with drinks, or intermediate flours proxied to bakery). | 16 | 1,733 |
| **`ambiguous`** | Source merges **two or more conflicting target regimes** with materially distinct emissions, prices, or COICOP branches (lists competing splits in `candidate_targets`). | 34 | 4,137 |
| **`unmatched`** | No verified corresponding category exists in the target table. Preserves `target_code = NULL` and `confidence_tier = 'unmatched'`—never backfilled. | 35 | 574 |

### Audit of `exact` Candidates
Shared category labels do **not** qualify automatically as `exact`. During item-level audit of Agribalyse 3.1.1 contents (`agribalyse_31.parquet`) and Eurostat COICOP definitions:
- `AGB:fruits → CP0116 Fruit` was downgraded from `exact` to `hierarchical (narrower)` because COICOP `01.1.6` includes tree nuts (which Agribalyse isolates under `fruits à coque`).
- `AGB:fruits → A01BS Fresh temperate & citrus fruits` was downgraded to `hierarchical (broader)` because Agribalyse `fruits` contains canned fruit in syrup and dried fruit alongside fresh produce.
- `OFF:Whole Grains, Oats & Cereals → CP0111`, `OFF:Bovine, Pork & Poultry Meats → CP0112`, and `OFF:Fish & Seafood → CP0113` were downgraded to `hierarchical (narrower)` because `CP0111` includes pastries/white bread, `CP0112` includes lamb/offal, and the OFF seafood query omits several molluscs/prepared subdivisions.

Only **`6`** rules survived strict item-level scope parity:
1. `AGB:légumes` ↔ `FoodEx2:A00FJ` (`MAP_AGB_FOODEX2_26`)
2. `AGB:légumineuses` ↔ `FoodEx2:A011X` (`MAP_AGB_FOODEX2_27`)
3. `AGB:fruits à coque et graines oléagineuses` ↔ `FoodEx2:A014C` (`MAP_AGB_FOODEX2_25`)
4. `AGB:fromages` ↔ `FoodEx2:A02QE` (`MAP_AGB_FOODEX2_33` — fresh curds reside in `produits laitiers frais`)
5. `AGB:substituts de viande` ↔ `FoodEx2:A03TD` (`MAP_AGB_FOODEX2_58`)
6. `OFF:Plant-Based Meat & Burger Alternatives` ↔ `FoodEx2:A03TD` (`MAP_OFF_FOODEX2_07`)

## 3. Taxonomic vs. Nutritional, Environmental & Economic Equivalence
A `exact` or `hierarchical` **taxonomic correspondence** establishes only that two classification codes describe comparable food sets. It **does NOT imply equivalence** in:
- **Nutrition:** Raw agricultural items, fortified plant alternatives, and salted/sugared retail formulations within the same taxonomic group differ markedly in energy, sodium, and micronutrient density.
- **Environment:** Category-level Agribalyse LCA factors (French mix, cradle-to-consumer gate) vary across origin, greenhouse vs. open-field seasonality, and processing state; they do not equal product-specific barcode EPDs.
- **Economics:** COICOP price indices track expenditure-weighted national baskets rather than individual brand-level SKU shelf prices.

## 4. Separation Between Dual-Anchor Rosetta (`crosswalk_rosetta`) & `classification_mappings`
- **`crosswalk_rosetta.parquet` (`15` rows):** Canonical numerical **allocation & yield bridge** used by SQL joins (`ECOICOP 5-digit × FoodEx2 × representative Agribalyse Code_AGB`), carrying `allocation_weight`, `edible_yield_factor`, `mean_co2_kg`, and `eat_lancet_group`. Kept separate and unchanged for backward SQL compatibility.
- **`classification_mappings.parquet` (`161` rows):** Comprehensive qualitative **taxonomy concordance & gap audit ledger** across all `61` Agribalyse subgroups, `15` FoodEx2 groups, `11` OFF categories, and Eurostat COICOP divisions, preserving `unmatched` and `ambiguous` relationships without numerical weights.
