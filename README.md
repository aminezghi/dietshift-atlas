# DietShift Atlas — European & Global Food Systems Almanac

> **A Local-First, High-Performance Computational Observatory for Dietary Transitions, Nutritional Economics, Environmental Footprints, and Retail Food Basket Dynamics across Europe and the World.**

[![Deploy DietShift Atlas to GitHub Pages](https://github.com/aminezghi/dietshift-atlas/actions/workflows/deploy.yml/badge.svg)](https://github.com/aminezghi/dietshift-atlas/actions/workflows/deploy.yml)
[![DuckDB-Wasm](https://img.shields.io/badge/DuckDB--Wasm-1.28.0-FFF100?logo=duckdb&logoColor=black)](https://duckdb.org/docs/api/wasm/overview)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made by Amine](https://img.shields.io/badge/Made%20by-Amine-8a1253?style=flat&logo=linkedin)](https://www.linkedin.com/in/zouaghi-amine/)

---

## 🏛️ Executive Summary

**DietShift Atlas** is an interactive, local-first computational almanac engineered to bridge the critical gap between macroeconomic climate targets and microeconomic consumer plate realities. 

Designed following the classical **Hallmark Almanac** aesthetic (deep Prussian blue `#163d4a`, imperial bordeaux `#8a1253`, crisp parchment `#eaedf2`, and typographic pairings of *Newsreader*, *Hanken Grotesk*, and *IBM Plex Mono*), the Atlas provides researchers, policymakers, retail analysts, and citizens with zero-latency querying over European food systems.

### 🌟 Key Highlights

- **100% In-Browser SQL Analytics**: Powered by **DuckDB-Wasm**, executing multi-table joins across 12 compressed columnar Parquet files directly in web worker memory without a backend server.
- **Section XII: Pan-European Retail Scanner Observatory**: Modeled after GS1 Italy's Immagino methodology and harmonized across 10 EU member states (IT, FR, DE, ES, NL, BE, PL, SE, AT, PT + EU-27 benchmark) across 6 universal food phenomena (*100% Italian/Local*, *Plant-Based/Veg*, *Free-From*, *Rich-In Protein*, *Sustainability/Eco*, *Traditional/PDO/PGI*).
- **On-Demand D4Vinci Scrapling Harvester**: Real-world retail product scraper targeting Carrefour, Coop, Esselunga, and Rewe, extracting 13 meta-product nutrition dimensions and packaging claims.
- **AI Forecasting Engine (Google TimesFM)**: Pre-computed zero-shot foundation model time-series forecasts through 2030 across 5 income quintiles and 7 food categories.
- **Editorial Architectural Blueprints**: Vector-rendered, publication-grade blueprints (created with `diagram-design`) detailing the 4-tier system pipeline and 5-stage behavioral cascade.
- **Citizen Public Guide**: An accessible, jargon-free guide built following the `Understand-Anything` framework, demystifying the food transition for the general public.

---

## 📊 In-Memory Parquet Tables (DuckDB-Wasm)

| Table | Records | Data Source / Description |
| :--- | :--- | :--- |
| `pan_eu_retail_scanner` | 132 | Pan-European retail market penetration & basket growth across 11 territories (10 countries + EU-27) |
| `gs1_immagino_observatory` | 24 | GS1 Italy Immagino metasystem (138k GS1 barcodes, €45.4B turnover, 6 macro-phenomena) |
| `scrapling_retail_claims` | 24 | Granular retail SKU scanner scraped via D4Vinci Scrapling with 13 nutritional variables |
| `nsi_subnational_quintiles` | 150 | Subnational household budget surveys (INSEE, ISTAT, Destatis, INE, CBS) by income quintile |
| `ml_timesfm_forecasts` | 336 | Google TimesFM 200M foundation model projections through 2030 (mean + 80% CI) |
| `consumer_behavior_pulse` | 14 | Multi-country behavioral friction indicators & intention-to-action say-do gap scores |
| `social_discourse_velocity` | 50 | Social sentiment & discourse velocity (Mastodon/Bluesky/Twitter corpora) |
| `gi_terroir_registry` | 6,845 | European Commission eAmbrosia geographical indications (PDO, PGI, TSG) |
| `agribalyse_31` | 2,451 | ADEME Agribalyse 3.1.1 life cycle assessments (CO2 eq, water scarcity, land use, PEF) |
| `openfoodfacts_eu` | 5,000 | Open Food Facts European product dataset with Nutri-Score, NOVA group, and Eco-Score |
| `efsa_foodex2_surveys` | 180 | European Food Safety Authority Comprehensive European Food Consumption Database |
| `crosswalk_rosetta` | 50 | Canonical crosswalk mapping FoodEx2, Agribalyse, OpenFoodFacts, and COICOP |

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js**: v18.0.0 or later (v20 LTS recommended)
- **npm**: v9.0.0 or later
- **Python**: 3.10+ (optional, only needed if rebuilding parquet files via `scripts/`)

### Setup & Run

```bash
# 1. Clone the repository
git clone https://github.com/aminezghi/dietshift-atlas.git
cd dietshift-atlas

# 2. Install dependencies
npm install

# 3. Start local Vite development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Production Build

```bash
# Typecheck and compile static bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 GitHub Pages Deployment

DietShift Atlas is configured for automatic zero-configuration continuous deployment via **GitHub Actions** (`.github/workflows/deploy.yml`).

### Deployment Steps:

1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/<your-username>/dietshift-atlas.git
   git branch -M main
   git push -u origin main
   ```
2. In your GitHub repository:
   - Navigate to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. That's it! Every push to `main` will automatically build and publish DietShift Atlas to `https://<your-username>.github.io/dietshift-atlas/`.

---

## 🛠️ Tech Stack & Architecture

- **Frontend Core**: React 19, TypeScript, Vite 6, Tailwind CSS v4
- **Database & Query Layer**: DuckDB-Wasm 1.28 (Apache Arrow columnar format)
- **Data Visualizations**: Apache ECharts (`echarts-for-react`) with custom Hallmark Almanac themes
- **Harvester**: D4Vinci Scrapling 0.5.1 (Python automated browser parser)
- **Machine Learning**: Google Research TimesFM (Time Series Foundation Model)
- **Visual Blueprints**: `diagram-design` vector SVG engine + interactive codebase floorplan
- **Documentation**: `Understand-Anything` framework citizen guide

---

## 📚 Public Guide & Interactive Blueprints

- **Public Citizen Guide**: Accessible in-app or directly via [`/public_guide.html`](public/public_guide.html)
- **Editorial Architecture Blueprint**: Viewable in Section XI or standalone at [`/architecture_blueprint.html`](public/architecture_blueprint.html)
- **Behavioral Cascade Blueprint**: Viewable in Section VIII or standalone at [`/behavioral_cascade_blueprint.html`](public/behavioral_cascade_blueprint.html)
- **Interactive Codebase Floorplan**: High-density interactive force graph at [`/floorplan.html`](public/floorplan.html)

---

## 👤 Author & Attribution

- **Creator**: **Amine Zouaghi**
- **LinkedIn**: [linkedin.com/in/zouaghi-amine](https://www.linkedin.com/in/zouaghi-amine/)
- **GitHub**: [github.com/aminezghi](https://github.com/aminezghi)
- **Vellum Project**: [github.com/aminezghi/vellum](https://github.com/aminezghi/vellum)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
