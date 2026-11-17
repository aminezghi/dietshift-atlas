# DietShift Atlas — Country-Profile Provenance Register (WP5 / B-05)

**Provenance Date:** 2026-11-17  
**Audited Source:** [`src/types/research.ts`](../../src/types/research.ts) (`COUNTRY_PROFILES`, lines `115–641`, `25` jurisdictions)  
**Downstream Consumers:** Overview Scorecard & Map (`src/App.tsx`), Section VI Researcher Survey baseline comparison (`ResearcherSandbox.tsx`), and Section X Policy Intervention Simulator (`src/analytics/policyScenarioModel.ts`, `v5.1.0-phase5a`).  
**Constraint Verification:** All `25` country profiles were inspected in full; **zero numeric values were modified, and zero citations were fabricated or backfilled.**

---

## 1. Schema, Units & Evidence Classification

Every entry in `COUNTRY_PROFILES` shares identical TypeScript schema (`CountryDietaryProfile`) and uniform classification:

| Variable Field | Unit / Normalization | Data Nature & Provenance Status | Downstream Analytical Handling |
| :--- | :--- | :--- | :--- |
| `eatLancetIndex.redMeat`, `.dairy`, `.legumesNuts`, `.wholeGrains`, `.vegetablesFruits` | Normalized `%` of EAT-Lancet daily boundary target (`100 = EAT-Lancet target`) | **Manually Compiled — Unverified Upstream Provenance** | Conceptual radar comparison in Overview & Sandbox (`App.tsx`, `ResearcherSandbox.tsx`) and relative multiplier anchors in Policy Simulator (`policyScenarioModel.ts`). |
| `eatLancetIndex.ultraProcessedShare` | `%` of daily energy intake (`NOVA 4` % kcal benchmark) | **Manually Compiled — Unverified Upstream Provenance** | Radar axis 6 (`max: 70`) & `simUpfReductionPct` linear perturbation anchor. |
| `dailyCarbonKg` | `kg CO₂eq / person / day` | **Manually Compiled — Unverified Upstream Provenance** | Scaled deterministically by `ANALYST_POLICY_COEFFICIENTS` (`plantCarbonSlope: 0.42`, `wasteCarbonSlope: 0.18`). |
| `dailyWaterLiters` | `L / person / day` *(distinct from Agribalyse AWARE `m³ world-eq`)* | **Manually Compiled — Unverified Upstream Provenance** | Scaled deterministically by `ANALYST_POLICY_COEFFICIENTS` (`plantWaterSlope: 0.24`, `wasteWaterSlope: 0.16`). |
| `dailyLandM2` | `m² / person / day` *(distinct from Agribalyse PEF `Pt`)* | **Manually Compiled — Unverified Upstream Provenance** | Scaled deterministically by `ANALYST_POLICY_COEFFICIENTS` (`plantLandSlope: 0.48`, `wasteLandSlope: 0.15`). |
| `dailyBasketCostEur` | `EUR / person / day` *(unadjusted nominal EUR baseline)* | **Manually Compiled — Unverified Upstream Provenance** | Perturbed via linear nominal `%` shifts (`pppNormalized: false` in `policyScenarioModel.ts`). |
| `sayDoGapScore` | Index score (`0–100` heuristic intention-action gap indicator) | **Manually Compiled / Heuristic — Unverified Upstream Provenance** | Descriptive Overview KPI only. |
| `plantProteinSharePct` | `%` of daily protein from plant sources | **Manually Compiled — Unverified Upstream Provenance** | Descriptive Overview KPI only. |

### Missing Provenance Across All 25 Jurisdictions
Per WP5 audit, the following metadata are **absent** from [`src/types/research.ts`](../../src/types/research.ts), [`datasets_registry.json`](../../public/data/datasets_registry.json), and [`provenance_manifest.json`](../../public/data/provenance_manifest.json) for all `25` entries:
- `original_source`: **Missing** (no national intake survey, FAO FBS cycle, or household cost table cited per row)
- `bibliographic_reference`: **Missing** (beyond general framework reference to Willett et al., 2019 EAT-Lancet normalization targets)
- `publication_or_observation_year`: **Missing**
- `retrieval_url`: **Missing**
- `transformation_or_normalization`: Unspecified conversion equations mapping raw intake/FAO/national survey grams into `%` EAT-Lancet targets (`redMeat`, `dairy`, `legumesNuts`, `wholeGrains`, `vegetablesFruits`) and environmental/cost totals.

---

## 2. Complete 25-Jurisdiction Structured Register (Values Preserved Verbatim)

| `code` | `name` (`geoJsonName`) | `region` | `redMeat` (%) | `dairy` (%) | `legumesNuts` (%) | `wholeGrains` (%) | `vegFruits` (%) | `UPF` (% kcal) | `dailyCarbonKg` | `dailyWaterLiters` | `dailyLandM2` | `dailyBasketCostEur` | `sayDoGapScore` | `plantProteinSharePct` | Provenance Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `EU27_2020` | European Union (EU-27) (`European Union`) | Europe | `285` | `175` | `38` | `64` | `78` | `31` | `4.85` | `3120` | `6.4` | `7.40` | `68` | `39` | Manually Compiled — **Unverified Upstream Provenance** |
| `NL` | Netherlands (`Netherlands`) | Europe | `295` | `235` | `42` | `72` | `74` | `37` | `5.15` | `2980` | `6.8` | `8.65` | `76` | `41` | Manually Compiled — **Unverified Upstream Provenance** |
| `FR` | France (`France`) | Europe | `310` | `210` | `34` | `58` | `84` | `31` | `5.30` | `3340` | `7.1` | `8.30` | `64` | `37` | Manually Compiled — **Unverified Upstream Provenance** |
| `DE` | Germany (`Germany`) | Europe | `305` | `195` | `36` | `76` | `72` | `39` | `5.05` | `3050` | `6.6` | `7.90` | `74` | `40` | Manually Compiled — **Unverified Upstream Provenance** |
| `IT` | Italy (`Italy`) | Europe | `240` | `165` | `54` | `68` | `92` | `18` | `4.45` | `3410` | `5.8` | `7.55` | `52` | `45` | Manually Compiled — **Unverified Upstream Provenance** |
| `ES` | Spain (`Spain`) | Europe | `275` | `155` | `58` | `61` | `90` | `22` | `4.65` | `3520` | `6.1` | `6.85` | `55` | `44` | Manually Compiled — **Unverified Upstream Provenance** |
| `SE` | Sweden (`Sweden`) | Europe | `265` | `215` | `46` | `82` | `76` | `41` | `4.90` | `2890` | `6.5` | `9.10` | `79` | `42` | Manually Compiled — **Unverified Upstream Provenance** |
| `DK` | Denmark (`Denmark`) | Europe | `290` | `225` | `44` | `86` | `79` | `36` | `5.10` | `2940` | `6.7` | `9.45` | `77` | `41` | Manually Compiled — **Unverified Upstream Provenance** |
| `PL` | Poland (`Poland`) | Europe | `315` | `160` | `29` | `62` | `69` | `28` | `4.95` | `2850` | `6.4` | `5.40` | `58` | `36` | Manually Compiled — **Unverified Upstream Provenance** |
| `BE` | Belgium (`Belgium`) | Europe | `295` | `190` | `35` | `64` | `77` | `35` | `5.00` | `3110` | `6.6` | `8.40` | `70` | `38` | Manually Compiled — **Unverified Upstream Provenance** |
| `AT` | Austria (`Austria`) | Europe | `300` | `205` | `36` | `70` | `76` | `33` | `5.08` | `3080` | `6.7` | `8.50` | `71` | `38` | Manually Compiled — **Unverified Upstream Provenance** |
| `FI` | Finland (`Finland`) | Europe | `270` | `240` | `40` | `84` | `73` | `38` | `4.95` | `2880` | `6.4` | `8.95` | `75` | `40` | Manually Compiled — **Unverified Upstream Provenance** |
| `PT` | Portugal (`Portugal`) | Europe | `265` | `160` | `56` | `62` | `88` | `24` | `4.70` | `3390` | `6.0` | `6.45` | `54` | `43` | Manually Compiled — **Unverified Upstream Provenance** |
| `GR` | Greece (`Greece`) | Europe | `250` | `185` | `60` | `64` | `94` | `21` | `4.55` | `3480` | `5.9` | `6.60` | `51` | `45` | Manually Compiled — **Unverified Upstream Provenance** |
| `IE` | Ireland (`Ireland`) | Europe | `325` | `225` | `33` | `66` | `71` | `44` | `5.45` | `3150` | `7.3` | `9.15` | `73` | `36` | Manually Compiled — **Unverified Upstream Provenance** |
| `CZ` | Czechia (`Czech Republic`) | Europe | `320` | `175` | `28` | `60` | `66` | `30` | `5.12` | `2910` | `6.6` | `5.95` | `60` | `35` | Manually Compiled — **Unverified Upstream Provenance** |
| `RO` | Romania (`Romania`) | Europe | `280` | `165` | `38` | `65` | `75` | `23` | `4.60` | `2820` | `6.0` | `4.90` | `49` | `41` | Manually Compiled — **Unverified Upstream Provenance** |
| `GBR` | United Kingdom (`England`) | Europe | `290` | `200` | `39` | `68` | `72` | `51` | `5.10` | `3090` | `6.7` | `8.20` | `78` | `39` | Manually Compiled — **Unverified Upstream Provenance** |
| `NOR` | Norway (`Norway`) | Europe | `275` | `220` | `42` | `83` | `75` | `42` | `5.00` | `2920` | `6.5` | `10.40` | `77` | `40` | Manually Compiled — **Unverified Upstream Provenance** |
| `CHE` | Switzerland (`Switzerland`) | Europe | `285` | `230` | `41` | `74` | `81` | `34` | `5.15` | `3180` | `6.8` | `11.20` | `74` | `40` | Manually Compiled — **Unverified Upstream Provenance** |
| `USA` | United States (`USA`) | Global Benchmark | `395` | `210` | `31` | `42` | `59` | `58` | `6.75` | `3980` | `9.4` | `9.80` | `81` | `32` | Manually Compiled — **Unverified Upstream Provenance** |
| `JPN` | Japan (`Japan`) | Global Benchmark | `155` | `85` | `88` | `74` | `82` | `26` | `3.60` | `2640` | `4.3` | `7.20` | `41` | `54` | Manually Compiled — **Unverified Upstream Provenance** |
| `BRA` | Brazil (`Brazil`) | Global Benchmark | `365` | `145` | `92` | `58` | `68` | `29` | `6.10` | `3650` | `8.6` | `4.85` | `56` | `42` | Manually Compiled — **Unverified Upstream Provenance** |
| `CAN` | Canada (`Canada`) | Global Benchmark | `350` | `195` | `38` | `54` | `66` | `49` | `6.15` | `3690` | `8.5` | `9.10` | `76` | `35` | Manually Compiled — **Unverified Upstream Provenance** |
| `AUS` | Australia (`Australia`) | Global Benchmark | `375` | `205` | `36` | `58` | `70` | `46` | `6.40` | `3780` | `8.9` | `9.35` | `75` | `34` | Manually Compiled — **Unverified Upstream Provenance** |

---

## 3. Resolution Path Required Before Empirical Reliance

1. **Author Bibliographic Audit:** Supply exact survey/model citations (e.g., FAOSTAT Food Balance Sheets year/item mapping, EFSA Comprehensive Database survey wave, Global Dietary Database, Poore & Nemecek / Springmann per-capita baseline coefficients, Monteiro/Monteiro-derived UPF share studies) or formally replace `COUNTRY_PROFILES` in a future minor release with an auditable Python-generated `country_dietary_baselines.parquet` registered in `datasets_registry.json`.
2. **Permissible Current Use:** Only as transparent illustrative anchor profiles (`Manually Compiled`) for Section X heuristic sensitivity sliders (`policyScenarioModel.ts`), never cited in manuscripts as primary national dietary surveillance observations.
