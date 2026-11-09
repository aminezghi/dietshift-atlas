# DietShift Atlas — A Friendly Guide for the Curious Citizen

> *"An open-science digital almanac connecting what we buy at the supermarket, the land where it grows, and the future of our health and planet."*
> 
> **Architected by:** Amine ([GitHub](https://github.com/aminezghi/vellum) · [LinkedIn](https://www.linkedin.com/in/zouaghi-amine/))  
> **Built with:** Open Science, Client-Side DuckDB-Wasm, D4Vinci Scrapling & Google TimesFM 2.0  
> **Methodology:** Inspired by the pedagogical knowledge graph principles of [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything).

---

## Table of Contents
1. [What is DietShift Atlas? (In Plain English)](#1-what-is-dietshift-atlas-in-plain-english)
2. [The Core Problem: The "Intention-to-Plate" Paradox](#2-the-core-problem-the-intention-to-plate-paradox)
3. [The 4 Layers of the System (How It Works Under the Hood)](#3-the-4-layers-of-the-system-how-it-works-under-the-hood)
4. [A Guided Tour Through the 12 Observatories](#4-a-guided-tour-through-the-12-observatories)
5. [Key Concepts Demystified](#5-key-concepts-demystified)
6. [How We Protect Transparency (Zero Server Tracking)](#6-how-we-protect-transparency-zero-server-tracking)
7. [Frequently Asked Questions (F.A.Q.)](#7-frequently-asked-questions-faq)

---

## 1. What is DietShift Atlas? (In Plain English)

Have you ever wondered:
- *Why is a box of ultra-processed breakfast cereal cheaper than fresh berries?*
- *When a packaging label says "Rich in Protein" or "Plant-Based", is it actually healthier or just clever marketing?*
- *How much water and carbon dioxide does a single kilogram of Parmigiano Reggiano or oat milk require?*
- *Why do most of us genuinely want to eat better, but end up buying the same old items at the supermarket checkout?*

**DietShift Atlas** is an interactive, open-access digital tool designed to answer these questions with hard, verifiable scientific data. 

Instead of relying on food company press releases or generic opinions, it unifies **8 independent European scientific databases**:
- Official European food consumption surveys (**EFSA FoodEx2**).
- Comprehensive environmental life-cycle analyses (**ADEME Agribalyse 3.1**).
- Real barcode nutrition fact panels (**Open Food Facts**).
- The official European register of protected agricultural heritage (**EUIPO GIview** & **Qualigeo**).
- National statistical household budgets (**ISTAT, INE, INSEE, CBS, Destatis, ONS**).
- The most comprehensive retail scanner data on the continent (**GS1 Italy Immagino** & **NielsenIQ**).

---

## 2. The Core Problem: The "Intention-to-Plate" Paradox

Across Europe, **72% of consumers** state in surveys that they want to eat healthier and more sustainably. Yet, when we inspect actual cash-register receipts, healthy sustainable items make up less than **28% of grocery baskets**.

Why this massive 82% attrition gap? DietShift Atlas maps this out as a **5-stage cascade**:

```
[Stage 1: Cultural Awareness] 100% of citizens hear about climate & health in news & social media
         │
         ▼ (Drop -28%: Information overload, conflicting diet advice)
[Stage 2: Stated Intention] 72% actively want to buy cleaner, less-processed foods
         │
         ▼ (Drop -31%: The "Price Wall", inflation, habitual convenience)
[Stage 3: Supermarket Checkout] 41% of basket contents survive the shelf algorithm & promotions
         │
         ▼ (Drop -13%: Household food waste & expiration spoilage)
[Stage 4: True Nutritional Intake] 28% of meals meet health guidelines
         │
         ▼ (Drop -10%: Cooking emissions & supply-chain leakage)
[Stage 5: Net Planetary Benefit] 18% actual environmental footprint reduction
```

DietShift Atlas gives you the interactive levers to see how policy decisions (like cutting VAT on legumes or introducing carbon taxes on high-emissions meat) can plug these leaks.

---

## 3. The 4 Layers of the System (How It Works Under the Hood)

Following the pedagogical architecture of **Egonex-AI/Understand-Anything**, the entire platform is organized into 4 clear functional tiers:

### Tier 1: Real-World Ingestion & Harvesters
- Uses **D4Vinci Scrapling** (an advanced open-source crawler) to harvest live grocery barcodes, certified claims (Gluten-Free, Lactose-Free, Organic), and real supermarket prices across European stores without getting blocked.
- Ingests **6,029 European protected foods** (PDO, PGI, TSG) from EUIPO and Qualigeo.

### Tier 2: The In-Browser Columnar Data Warehouse (DuckDB-Wasm)
- **Zero server costs, zero privacy tracking.**
- Rather than sending your clicks to a cloud server, DietShift Atlas downloads 11 compressed **ZSTD Parquet tables** straight into your web browser.
- A local database engine called **DuckDB-Wasm** runs in the background of your computer, executing complex analytical SQL queries in under 50 milliseconds!

### Tier 3: Machine Learning & Econometric Modeling
- **Google TimesFM 2.0**: A cutting-edge artificial intelligence foundation model developed by Google Research for chronological zero-shot forecasting of food prices and consumption.
- **Push vs. Pull Econometrics**: Mathematical scatter models separating what food companies push onto shelves from what shoppers actually demand.

### Tier 4: The Reactive Almanac User Deck
- Built in modern React, TypeScript, and Apache ECharts.
- Styled according to the **Hallmark Almanac** visual standard: peaceful paper-tinted cards (`#eaedf2`), deep sea-teal text (`#163d4a`), and tyrian berry accents (`#8a1253`), avoiding distracting neon colors.

---

## 4. A Guided Tour Through the 12 Observatories

When you open DietShift Atlas, you have 12 analytical sections at your fingertips:

### I. Almanac Overview & Meridian Plate
An overview of your country's current dietary profile compared to the **EAT-Lancet Planetary Boundary** diet (a scientifically calculated balance that keeps humanity healthy without exceeding Earth's ecological capacity).

### II. NSI & Google TimesFM 2.0 Lab
Explore how income quintiles (from the 20% lowest-income households to the top 20%) affect food choices in Italy (ISTAT), Spain (INE), France (INSEE), the Netherlands (CBS), Germany (Destatis), and the UK (ONS). Test AI forecasts up to 2028.

### III. Consumer Behavior & Infodemiology
Track digital curiosity across 6 European languages on Wikipedia, trending Reddit food discussions, and measure the 5-stage intention-to-plate attrition drop.

### IV. Full Cartography & Terroir Geocoder
An interactive Europe-wide map with **6,845 protected geographical indications** (Parmigiano Reggiano, Prosciutto di Parma, Roquefort, Champagne, Queso Manchego, etc.). Explore the carbon footprint, water use, and economic premium of each terroir tradition.

### V. DuckDB Parquet SQL Console
A transparent playground for data enthusiasts. Type standard SQL queries directly against our 11 Parquet tables and see results instantly in your browser.

### VI. Researcher Survey Ledger
Simulate a full 24-hour dietary recall. Type in items you ate today and immediately view their calculated caloric content, protein density, and environmental footprint.

### VII. Retail Product Trilemma
Visualizes the eternal trade-off in modern grocery shopping:
1. **Nutrition:** High protein and low sugar/salt.
2. **Environment:** Low greenhouse gas and water usage.
3. **Affordability:** Low cost per 1,000 calories.

### VIII. Agribalyse 3.1 Environmental Database
Explore 2,451 food products categorized by French ecological agency ADEME, showing greenhouse gas emissions (kg CO2 eq), water consumption ($m^3$), and land usage ($m^2$).

### IX. Food Inflation & Literature Engine
Examines historical food price spikes and links them to published scientific research on dietary shifts during economic crises.

### X. Policy Intervention Simulator
Grab the policy sliders! Test what happens if:
- Plant-based shift increases by +35%
- Ultra-processed food drops by -25%
- A €50/tonne carbon tax is levied on high-emissions meats
- Household food waste is cut by -20%

### XI. Codebase Floorplan & Dual Blueprints
Total code transparency. Inspect the interactive 33-file code graph (generated via `haydenschmitty/floorplan`) or view the publication-grade SVG architectural blueprint (styled via `cathrynlavery/diagram-design`).

### XII. Pan-European Retail Scanner & Claim Observatory
The crown jewel of supermarket scanner intelligence. Covers **151,203 products**, **84,817 nutritional panels**, and **€57.3B in supermarket sales**.
- **Metaproduct Gauge:** Compare standard food against newly launched 2025 products.
- **Push vs. Pull:** See how *Plant-Based* (+34% volume) and *Chia Seeds* (+41% volume) exploded in consumer demand, while *High-Protein* (+9.9% offer) is heavily pushed by manufacturers.
- **Cross-Border Parity:** Switch between **10 European countries** (Italy, France, Germany, Spain, Netherlands, Belgium, Poland, Sweden, Austria, Portugal, and EU-27) to compare Nutri-Score adoption and organic shares.
- **Agentic AI Grocery Planner:** Simulate an autonomous AI shopping assistant assembling a weekly grocery basket constrained by your health and sustainability goals.

---

## 5. Key Concepts Demystified

### What is a "Metaproduct"?
Imagine putting every single item in the supermarket into one giant blender—weighted by how many units people actually buy. The resulting nutritional values per 100 grams tell you the true "nutritional baseline" of the nation. In Italy, the GS1 Metaproduct averages **173.9 kcal, 6.6g protein, 7.6g sugar, and 2.9g saturated fat**.

### What does "Push vs. Pull" mean?
- **Push:** Food manufacturers expand shelf space and launch new products (e.g., introducing dozens of high-protein puddings and yogurts).
- **Pull:** Shoppers actively seek out and buy products even before marketing ramps up (e.g., consumers searching for pesticide-free "zero-residue" vegetables or chia seeds).

### What is NOVA Classification?
- **NOVA 1:** Unprocessed or minimally processed foods (fresh apples, oats, raw meat, eggs).
- **NOVA 2:** Processed culinary ingredients (olive oil, butter, salt, honey).
- **NOVA 3:** Traditional processed foods (canned tuna in brine, fresh bakery bread, aged cheeses).
- **NOVA 4 (Ultra-Processed):** Industrial formulations with 5+ ingredients, flavor enhancers, emulsifiers, and artificial colors (packaged sodas, mass-market sweet snacks, reconstituted meats).

### What is E-Commerce Over-Indexing?
An index measuring whether a product sells better online or in physical stores:
- **Index > 300 (Online Stars):** Zinc supplements (952), low-calorie sweeteners (621), and bio-based packaging (328). Shoppers actively search for specific dietary niches online.
- **Index < 50 (In-Store Champions):** Traditional fresh meats and PDO cheeses (30). People still prefer seeing, smelling, and selecting fresh deli items in person!

---

## 6. How We Protect Transparency (Zero Server Tracking)

Most modern web dashboards send your inputs, queries, and locations back to central cloud servers. 

**DietShift Atlas is fundamentally different:**
- It uses **Client-Side WASM (WebAssembly)**: the computational database runs completely inside your browser's memory.
- All 11 Parquet data tables are static, public, cryptographic assets.
- You can download the entire application or floorplan as a single file and run it completely offline.

---

## 7. Frequently Asked Questions (F.A.Q.)

**Q: Where can I try DietShift Atlas?**  
A: Open [http://localhost:5173/](http://localhost:5173/) in your web browser. 

**Q: Can I inspect the source code?**  
A: Yes! Visit Tab XI (*Code floorplan & architecture*) inside the app, or inspect the standalone floorplan at [http://localhost:5173/floorplan.html](http://localhost:5173/floorplan.html).

**Q: Can I contribute or report a data discrepancy?**  
A: The project is open-source. You can check the repository and connect with the author on [LinkedIn](https://www.linkedin.com/in/zouaghi-amine/) or [GitHub](https://github.com/aminezghi/vellum).

---

*Authored with open science standards for citizens, researchers, and policymakers.*
