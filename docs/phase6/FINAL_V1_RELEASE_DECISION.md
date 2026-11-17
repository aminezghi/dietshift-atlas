# DietShift Atlas — Final v1.0 Release Freeze & Independent Verification Decision

**Audit Date:** 2026-11-17  
**Repository:** https://github.com/aminezghi/dietshift-atlas  
**Evaluated Release Candidate:** `1.0.0-rc.1` (version preserved; zero `v1.0.0` tag created)  
**Verified Baseline Chain:** `v5.2.0-phase5c` (analytics/QA) -> `v6.0.0-phase6a` (docs audit) -> `v6.1.0-phase6b` (remediation) -> `v6.2.0-phase6c` (Track A/B segregation) -> `v6.3.0-phase6d` (Track A resilience)

---

## Executive Release Summary

| Release Channel / Question | Verdict | Blocking Status | Primary Decision Basis |
| :--- | :---: | :--- | :--- |
| **1. Public Source-Code Release (`MIT`)** | **PASS** | Ready for open code release (`1.0.0-rc.1`) | All source files (`src/*`, `scripts/*`, `tests/*`, `docs/*`, `.oxlintrc.json`) build cleanly via `npm ci && npm run build`, pass `oxlint` (`0` warnings/errors), exclude Track B data/manuscripts cleanly, and carry `LICENSE` (`MIT`) + `CITATION.cff` (`1.0.0-rc.1`). |
| **2. Controlled Research Distribution (Full Dev Snapshot + Governance Notices)** | **CONDITIONAL PASS** | Permitted for closed peer review / internal institutional inspection only | Full `19`-table workspace passes all `5` QA stages (`18/18` Vitest / `87/87` tests, `14/14` Pytest parity tests, `2/2` Playwright E2E specs), provided restricted Track B assets are not redistributed externally without upstream consent. |
| **3. Track A Data Redistribution (`33` Open / Attribution Assets)** | **PASS WITH ATTRIBUTION** | Permitted cleanly via segregated Track A archive | Contains strictly verified open/attribution datasets (`13` Parquets, `19` clean JSONs, Public Domain Natural Earth `v5.1.1`) with explicit notices (`release/ATTRIBUTION_AND_DATA_NOTICES.md`) and full runtime resilience verified across all `13` sections (`0` pageerrors, `0` Track B leaks). |
| **4. Full-Corpus Data Redistribution (`19` Parquets + All Bundles)** | **FAIL (BLOCKED)** | Unlawful / non-compliant for public redistribution | Bundled Track B (`14` assets) includes Fondazione Qualivita Qualigeo copyrighted fields, GS1 Italy / NielsenIQ *Osservatorio Immagino* tables, IPUMS/MTUS restricted data, ESS `CC BY-NC-SA 4.0` non-commercial data, HN/Google News RSS headlines, and unpinned `world.geojson`. |
| **5. Journal / Manuscript Submission (`paper/*`)** | **FAIL (BLOCKED BY B-01 & B-05)** | Excluded from release archives until author signs off edits | `5` manuscript files in `paper/` still contain pre-Phase-4/5 retracted claims (TimesFM `89.4%` leakage, stale counts, unverified `COUNTRY_PROFILES` prose) cataloged in [`PHASE6B_MANUSCRIPT_REMEDIATION.md`](PHASE6B_MANUSCRIPT_REMEDIATION.md); unresolved by author decision. |
| **6. Unqualified `v1.0.0` Tag / Release Promotion** | **FAIL — DO NOT PROMOTE YET** | Promote only after clearing Track B scope / `B-01` / `B-05` | An unqualified `v1.0.0` repo-wide release implies full-dataset & manuscript sign-off. Until either `B-01` + `B-05` + Track B clearances are resolved OR `v1.0.0` is explicitly scoped solely as a **Code + Track A Open-Data** release, remain at `1.0.0-rc.1`. |

---

## WP1 — Analytical Integrity Freeze Audit

### Git Baseline & Filesystem Observations
- **Git Commit & Tag State:** `git tag --sort=-creatordate` returned **0 Git tags**; Git `HEAD` remains `20ba6aa` (*Internationalize & refine GI hygiene: Poore & Nemecek (2018) LCA, World Bank/FAO CoHD (2024), 3,037 FOOD GI default, 18 Parquet tables*). All Phase 3A–6D implementations exist cleanly in the working tree rather than tagged commits in local `.git` history.
- **`src/types/research.ts` (`COUNTRY_PROFILES`) Verification:** Diffed directly against `HEAD` (`20ba6aa`): all `25` manual `COUNTRY_PROFILES` objects and their numeric baselines (`eatLancetIndex`, `dailyCarbonKg`, `dailyWaterLiters`, `dailyLandM2`, `dailyBasketCostEur`, `sayDoGapScore`, `plantProteinSharePct`) remain **byte-for-byte unchanged**; diffs are strictly nullable field types (`| null`), AWARE/PEF unit comments, `BasketItemOrigin`, and the Phase 5A provenance docstring.
- **Analytical Engines (`src/analytics/*`) Verification:** Engine version identifiers remain frozen (`classificationEngine` `v3.0.0-phase3a`, `nutritionEngine` `v3.1.0-phase3b`, `environmentEngine` `v3.2.0-phase3c`, `affordabilityEngine` `v3.3.0-phase3d`, `integratedComparator` `v3.4.0-phase3d`, `forecastingEngine` `v4.2.0-phase4b`, `sensitivityEngine` `v4.3.1-phase4c`, `integratedRobustness` `v4.4.0-phase4d`, `policyScenarioModel` `v5.1.0-phase5a`, `sandboxLedger` `v5.1.0-phase5a`). The sole post-Phase-5C edit in `src/analytics/` is in [`integratedRobustness.ts`](../../src/analytics/integratedRobustness.ts#L1755-L1790), where `envGiCell` metadata labels distinguish `giItems.length === 0` (Track A exclusion disclosure) without changing any numerical calculation, matrix denominator (`validDenominator`), or `giItems.length > 0` strings.
- **Production Datasets (`public/data/*`):** Verified unchanged during Phase 6C–6D; all `14` Parquet integrity/parity checks (`tests/test_empirical_pipeline.py`) pass `14/14` against `provenance_manifest.json` and `datasets_registry.json` (`19` tables, `17,627` rows).

---

## WP2 — Independent Methodology Audit (Code vs. Documentation)

Direct inspection of `src/analytics/*.ts`, [`SCIENTIFIC_METHODOLOGY.md`](../SCIENTIFIC_METHODOLOGY.md), and [`LIMITATIONS_AND_RESPONSIBLE_USE.md`](../LIMITATIONS_AND_RESPONSIBLE_USE.md) confirms strict code-to-documentation parity across all `8` analytical domains:

| Analytical Domain | Inspected Implementation Invariant | Status vs. Docs |
| :--- | :--- | :---: |
| **Nutrition Denominators** | `per_100g` covers `3,197` OFF SKUs preserving zeros vs `NULL`; `per_100kcal` filters to positive energy (`3,097`) and computes separate per-nutrient denominators; `per_serving` yields `0%` (`Unavailable`, `serving_quantity_g` 100% `NULL`); NOVA filter defaults to including `NULL` with exact excluded count tracking. | **Verified** |
| **Environmental Units & Boundaries** | Strictly segregates Agribalyse 3.1.1 (`Model Output`, France cradle-to-consumer, AWARE `m³ world eq/kg`, PEF `Pt/kg`), Poore & Nemecek 2018 (`Estimated`, global farm-to-retail `per kg` / `100g protein` / `1000 kcal`), and GI Terroir (`FOOD`-only `3,037/6,845` default, `isClassProxy: true`); composite scoring blocked. | **Verified** |
| **Affordability Interpretation** | Separates Open Prices `EUR/kg` (`1,036`), `EUR/L` (`187`), and `132` missing-size SKUs (`86.9%` FR); blocks SKU×PPP division (`refuseSkuPppConversion`); propagates `[EU27_2020 FALLBACK]` into chart titles/tables/exports; isolates macro HICP/PPP/CoHD from barcode SKUs. | **Verified** |
| **Classification Uncertainty** | Preserves all `161` rules across `exact` (`6`), `hierarchical` (`70`), `approximate` (`16`), `ambiguous` (`34`), `unmatched` (`35`, `CP0115`/`CP012`); prohibits synthetic universal composite (`attemptUnifiedFoodScore`). | **Verified** |
| **Forecast Validation** | `35` annual HICP series × `6` causal origins (`2019–2024`, `minTrainLength=5`, `maxHorizon=3`) = `525` expanding-origin CV folds across `5` deterministic models (no TimesFM); empirical single min/max, %-normalized suite P10–P90, causal prior-only coverage (`210`/`315`), and `h=4..5` (`2029–2030`) `Unavailable` intervals match formulas. | **Verified** |
| **Sensitivity Eligibility** | `sensitivityEngine.ts` computes `20` OAT scenarios when all inputs exist (`19` valid + isolated `env_gi_unfiltered_alcohol_leak`), `19` eligible non-GI scenarios in Track A (`1` GI diagnostic explicitly omitted), preserving small-sample warnings (`n < 10`). | **Verified** |
| **Integrated Robustness** | All `12` Phase 4D scenarios + `13×8` Evidence Matrix preserve Agribalyse grain reconciliation (`2,451 / 2,161 / 3,114 / 60 / 55 / 83 / 11`, cross-grain delta blocked), dimension-isolated Spearman/Jaccard (suppressed `< 6` categories), and descriptive `4`-barcode overlap disclosure (`2` EUR/kg + `2` EUR/L FR/Full, `0` DE). | **Verified** |
| **Policy Simulation Disclosures** | `policyScenarioModel.ts` exposes analyst-defined coefficients (`ANALYST_POLICY_COEFFICIENTS`) over manually compiled `COUNTRY_PROFILES`, enforces `Policy_CI95_Available = false` and `PPP_Normalized = false` in Section X & CSV exports. | **Verified** |

**Residual Unsupported Claim Outside Frozen App (`B-01` & `B-05`):**
- `paper/*` manuscripts still retain unsupported pre-Phase-4/5 claims (inventoried in `PHASE6B_MANUSCRIPT_REMEDIATION.md`).
- All `25` hardcoded `COUNTRY_PROFILES` lack primary-source bibliographic entries (`Manually Compiled — Unverified Upstream Provenance`), though UI badges and docs explicitly disclose this limitation.

---

## WP3 — Track A Clean-Environment Reproduction (Strict Zero-Fallback Isolation)

### Clean-Environment Defects Uncovered & Fixed During Verification
Testing an isolated copy containing strictly Zone 1 (software/docs) and Zone 2 (`33` Track A files) exposed two release defects that were resolved cleanly without altering formulas, engine outputs, data, or version strings:
1. **Missing `.oxlintrc.json` in Manifest (`scripts/build_release_manifest.py`):** `.oxlintrc.json` and `.gitignore` were omitted from `SOURCE_ROOT_FILES`, causing `npm run lint` to fail inside a fresh Track A clone (`exit code 1`). Fixed by including both dotfiles in [`build_release_manifest.py`](../../scripts/build_release_manifest.py#L130-L133).
2. **`npm run preview` SPA HTML Fallback Masking Track A Omissions (`dataProvider.ts` & `resourceAvailability.ts`):** Serving Track A with Vite's documented `npm run preview` returns `HTTP 200 text/html` (`index.html`) for omitted Track B JSONs (`gi_terroir_bundle.json`, `consumer_behavior_pulse.json`, `empirical_microdata_bundle.json`) instead of `HTTP 404`, bypassing Track A fallback loading in Section III (`ConsumerBehaviorPulse`, `EmpiricalSocialMicrodataPlate`). Fixed cleanly in [`fetchCachedJson`](../../src/services/dataProvider.ts#L92-L106) and [`classifyDuckDBSqlError`](../../src/utils/resourceAvailability.ts#L271-L276).

### Verified Clean-Environment Reproduction Record (Post-Fix)
Executed outside the repository in an isolated temporary directory (`%TEMP%\dietshift_track_a_clean_*`) with **strictly `33` Track A files** (`public/data/` verified free of all `14` Track B exclusions and all `5` `paper/` files):

| Step | Command / Action | Result | Observed Details |
| :---: | :--- | :---: | :--- |
| **1** | Copy Zone 1 + Zone 2 (`RELEASE_MANIFEST.json`) | **PASS** | `33` Track A data files (`0` Track B files, Natural Earth SHA verified) |
| **2** | `npm ci` | **PASS** | Exit `0` in `14.2s` from clean `package-lock.json` |
| **3** | `npm run lint` (`oxlint`) | **PASS** | Exit `0` in `1.1s` (`0` warnings, `0` errors) |
| **4** | `npm run build` (`tsc -b && vite build`) | **PASS** | Exit `0` in `3.2s` |
| **5** | Launch built app (`vite preview` inside clean dir) + walk Sections `I`–`XIII` in headless Chromium | **PASS** | `0` `pageerror`s, `0` unexpected non-Track-B HTTP errors across all `13` sections |
| **6** | Run analyses (Overview, Forecasts, III NHANES/GCNF, V DuckDB SQL Preset #1 & #4, VIII LCA, IX 4D, X Policy, XIII Sensitivity) | **PASS** | DuckDB Preset #4 returned `11 rows`; Section IX preserved `45` Poore LCA items (`12` scenarios); Section XIII executed `19` non-GI scenarios |
| **7** | Export CSV & JSON files | **PASS** | `dietshift_IT_simulation.csv` (`339 B`), `dietshift_forecast_uncertainty_IT_naive_drift_2030.csv` (`16` rows), `dietshift_researcher_survey_template.csv` (`861 B`), Phase 4D CSV/JSON (`12` scenarios), Phase 4C CSV/JSON (`19` rows + `1` unavailable GI scenario) |
| **8** | Inspect missing-resource disclosures | **PASS** | Clean `excluded_from_distribution` notices observed in Sections `I`, `III`, `V` (`gi_terroir_registry` SQL error), `VIII`, `IX`, `XII`, and `XIII` |

*Scope Note on Full-Workspace QA Scripts Run Inside a Track A-Only Directory:* Inside the stripped Track A-only clone, `vitest run` passes `14/18` test files (`76/80` tests) while `4` full-corpus files (`crossEngineParity.test.ts`, `sensitivityEngine.test.ts`, `integratedRobustness.test.ts`, `environmentEngine.test.ts`) fail solely because they inspect omitted Track B `gi_terroir_bundle.json` on disk; similarly, `pytest tests/test_empirical_pipeline.py` passes `12/14` while `2` full-19-Parquet manifest/parity tests require all `19` Parquets. Against the full development workspace (`npm run qa`), **all 5 stages pass 100%**.

---

## WP4 — Licensing & Release Governance Verification

- **Software License:** Root [`LICENSE`](../../LICENSE) confirmed as `MIT License, Copyright (c) 2026 Amine Zouaghi`; [`package.json`](../../package.json) & [`CITATION.cff`](../../CITATION.cff) declare `MIT` software licensing strictly scoped to code/docs, never re-licensing third-party datasets.
- **Track A Licences & Notices:** All `33` assets in [`release/RELEASE_MANIFEST.json`](../../release/RELEASE_MANIFEST.json) carry explicit institutional sources and open terms (`Public Domain` CDC NHANES & Natural Earth `v5.1.1`; `Etalab Open Licence v2.0` ADEME Agribalyse; `ODbL 1.0 / CC-BY-SA` Open Food Facts & Open Prices; `CC-BY 4.0` Eurostat, INE, OWID/Poore, OWID/WB-FAO CoHD, GCNF, EFSA ref; `OGL v3.0` UK ONS; `CC0` OpenAlex) mirrored in [`release/ATTRIBUTION_AND_DATA_NOTICES.md`](../../release/ATTRIBUTION_AND_DATA_NOTICES.md).
- **Natural Earth Provenance:** Track A `world.geojson` derives deterministically from pinned Natural Earth `v5.1.1` Admin 0 `1:110m` (`Public Domain`) via [`prepare_natural_earth_geojson.py`](../../scripts/prepare_natural_earth_geojson.py).
- **Track B & Manuscript Exclusion:** All `14` restricted/permission-required/unverified data assets and `5` unapproved `paper/*` manuscript files remain isolated from Track A archives (`0` leaked files verified programmatically).
- **Country Profiles:** All `25` entries remain verbatim preserved and documented in [`PHASE6B_COUNTRY_PROFILES_PROVENANCE.md`](PHASE6B_COUNTRY_PROFILES_PROVENANCE.md) & [`PHASE6C_COUNTRY_PROFILES_EVIDENCE.md`](PHASE6C_COUNTRY_PROFILES_EVIDENCE.md).

---

## WP5 — Documentation Consistency Audit

- **Core Claims Reconciled:** `README.md`, `CITATION.cff`, `package.json`, `src/version.ts`, `PUBLIC_GUIDE.md`, `SCIENTIFIC_METHODOLOGY.md`, `DATA_PROVENANCE_AND_LICENSING.md`, `CHANGELOG.md`, and `docs/phase6/*` consistently report version `1.0.0-rc.1`, classical expanding-origin HICP models (zero TimesFM), full `19` Parquet workspace vs segregated `33`-file Track A (`13` open Parquets) / `14`-file Track B exclusions, and zero implied redistribution of Track B datasets inside Track A.
- **Minor Non-Blocking Phase 6A Snapshot Caveats Noted (Preserved Frozen Under Freeze Rule):**
  - `docs/USER_GUIDE.md:15` retains a Phase 6A parenthetical note referencing legacy BibTeX `"4.0.0"` before `B-03` wired `APP_VERSION` (`1.0.0-rc.1`) in Phase 6B.
  - `docs/LIMITATIONS_AND_RESPONSIBLE_USE.md:97` retains a Phase 6A sentence flagging `PUBLIC_GUIDE.md` as stale before Phase 6B updated `PUBLIC_GUIDE.md`.
  - `docs/REPRODUCIBILITY.md:74-78` reflects pre-Phase-6D QA file counts (`58` Oxlint / `16` Vitest / `1` E2E) superseded by Phase 6D (`63` Oxlint / `18` Vitest / `2` E2E specs).
  - None of these three historical doc notes claim restricted datasets are bundled in Track A or misrepresent analytical findings; left untouched under the release-freeze rule (or trivial doc-polish on final `1.0.0` promotion).

---

## WP6 — Final Verification Evidence & Conditions for `v1.0.0`

**Final Workspace Verification Run (`npm run qa` after final Phase 6D/WP3 fix):**
- `oxlint`: **`0` warnings, `0` errors** across `63` files.
- `vitest run`: **`18/18` test files passed, `87/87` tests passed**.
- `tsc -b && vite build`: **`0` errors**.
- `pytest tests/test_empirical_pipeline.py -v`: **`14/14` passed**.
- `pytest tests/e2e -v`: **`2/2` passed** (both full-baseline `test_atlas_e2e.py` and isolated Track A `test_track_a_archive_e2e.py`).
- `release/RELEASE_MANIFEST.json`: **`1.0.0-rc.1`**, verified **`100%` SHA-256 match** across all tracked manifest assets and **`33` Track A / `14` Track B / `5` excluded manuscript files**.

**Conditions Required Before Creating a `v1.0.0` Git Tag:**
1. Decide release scope explicitly: if shipping a public GitHub release immediately, publish strictly **Zone 1 (Source & Docs MIT) + Zone 2 (Track A `33` Open Assets)** and keep **Track B** & **`paper/*`** excluded.
2. For full-corpus or manuscript release: complete author remediation of `B-01` (`paper/*` manuscripts), author citation/replacement of `B-05` (`25` `COUNTRY_PROFILES`), and written legal clearance or open replacement for Track B assets (`Qualigeo`, `GS1 Italy`, `MTUS`, `ESS CC BY-NC-SA`, `HN/RSS`).
