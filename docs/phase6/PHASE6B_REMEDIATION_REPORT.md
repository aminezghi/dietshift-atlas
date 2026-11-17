# DietShift Atlas — Phase 6B Final Remediation & v1.0-rc.1 Validation Report (WP7)

**Report Date:** 2026-11-17  
**Validated Code & Data Baseline:** `v5.2.0-phase5c` (unchanged analytical engines & source Parquet/JSON tables)  
**Release Candidate Tag Reconciled Across Metadata:** `1.0.0-rc.1` (`v6.1.0-phase6b`)  

---

## 1. Summary of Blockers Addressed (`B-01` through `B-06`)

| Blocker | Remediation Status | Summary of Remediation Executed in Phase 6B | Remaining Uncertainty / External Sign-Off Required |
| :---: | :---: | :--- | :--- |
| **B-01 (`paper/*`)** | **Cataloged & Proposed (`Author Approval Pending`)** | Inspected all `5` files in [`paper/`](../../paper/) (`DIETSHIFT_ATLAS_ACADEMIC_PAPER.{md,html,docx}`, `main.tex`, `references.bib`). Compiled exact line-by-line inventory of retracted `Google TimesFM 200M` claims, `89.4%` MAE target-leakage results (`1.164 vs 10.940 vs 16.201`), `12` -> `19` table count drift, stale `3,740`/`39`/`448` row counts, `DuckDB-Wasm 1.28` -> `1.33.1`, GS1 `151,203` SKU conflation, and composite weighting assumptions in [`PHASE6B_MANUSCRIPT_REMEDIATION.md`](PHASE6B_MANUSCRIPT_REMEDIATION.md). **No `paper/` files were silently rewritten without author approval.** | **`[OWNER: Author — Amine Zouaghi]`** Must approve proposed text/table revisions in [`PHASE6B_MANUSCRIPT_REMEDIATION.md`](PHASE6B_MANUSCRIPT_REMEDIATION.md), update `DIETSHIFT_ATLAS_ACADEMIC_PAPER.md` & `main.tex`, regenerate HTML, and re-run `scripts/polish_docx.py` before manuscript submission. |
| **B-02 (Data Governance)** | **Audited & Segregated** | Verified authoritative upstream terms for all `7` flagged datasets/assets (`Qualigeo / Fondazione Qualivita`, `GS1 Italy Osservatorio Immagino`, `IPUMS/MTUS`, `ESS ERIC CC BY-NC-SA 4.0`, `YC Hacker News / Google News RSS`, `public/data/world.geojson`, `COUNTRY_PROFILES`) plus all remaining institutional tables in [`PHASE6B_DATA_GOVERNANCE.md`](PHASE6B_DATA_GOVERNANCE.md) & [`DATA_PROVENANCE_AND_LICENSING.md`](../DATA_PROVENANCE_AND_LICENSING.md). Partitioned assets into **Track A (`13` open/attribution tables)** vs **Track B (`7` local-only/restricted/unverified assets)** while preserving all local workspace datasets untouched. | **`[OWNER: Maintainer / Legal Clearance]`** Do **not** mirror Track B tables in open MIT public dataset archives unless: (1) Fondazione Qualivita grants written consent or `gi_terroir_registry` is rebuilt from EUIPO GIview alone; (2) GS1 Italy approves summary reuse; (3) IPUMS/CTUR confirms exemption; (4) ESS `CC BY-NC-SA 4.0` non-commercial clause is segregated from permissive MIT bundles; (5) third-party RSS/HN links are stripped; (6) `public/data/world.geojson` is swapped for pinned Natural Earth Public Domain geometry. |
| **B-03 (Version & Citations)** | **Remediated** | Established [`package.json`](../../package.json) (`"version": "1.0.0-rc.1"`) as the single authoritative software version imported dynamically via [`src/version.ts`](../../src/version.ts) into [`src/App.tsx`](../../src/App.tsx) (`BibTeX` export & footer colophon); synchronized [`package-lock.json`](../../package-lock.json), [`CITATION.cff`](../../CITATION.cff) (`date-released: "2026-11-17"`, removed `timesfm` keyword, zero invented DOI), [`README.md`](../../README.md), [`docs/PUBLIC_GUIDE.md`](../PUBLIC_GUIDE.md), [`public/public_guide.html`](../../public/public_guide.html) (`13` sections, `19` tables, `NULL`-preserving OFF, GS1 benchmark distinction), and [`public/architecture_blueprint.html`](../../public/architecture_blueprint.html) (`DuckDB-Wasm 1.33.1`, `6,845 GI`). Preserved all historical changelog & engine version strings intact. | None for software release metadata. Final `1.0.0` (removing `-rc.1`) awaits closure of `B-01`, `B-02`, and `B-05`; Zenodo DOI must be minted only on final tagged release. |
| **B-04 (Technical Docs)** | **Remediated** | Reconciled [`DATA_SOURCES.md`](../development/DATA_SOURCES.md) (`19` datasets adding `classification_mappings`, fixed `global_poore_nemecek_lca` and `clinical_biomarker_grounding` from `Observed` -> `Estimated`, documented `CC BY-NC-SA 4.0` / Qualigeo / GS1 / MTUS / HN restrictions), [`DATA_DICTIONARY.md`](../development/DATA_DICTIONARY.md) (`19` tables, corrected `scrapling_retail_claims` `29` cols & `statistical_price_forecasts` `33` cols, added Section `4b`, updated Phase 4B residual rules), [`DATA_PIPELINE.md`](../development/DATA_PIPELINE.md) (`19` tables, exact execution order, Phase 4B validation alignment), and docstrings/logs in [`build_data_infrastructure.py`](../../scripts/build_data_infrastructure.py) and [`build_international_benchmarks.py`](../../scripts/build_international_benchmarks.py). | `public/data/datasets_registry.json` (`cultural_climate_inertia.license: "CC-BY 4.0"`) remains preserved unchanged per Phase 6B dataset-immutability constraint; `build_data_infrastructure.py` should align that string when datasets are next regenerated. |
| **B-05 (`COUNTRY_PROFILES`)** | **Documented (`Verbatim Preserved`)** | Audited and transcribed all `25` entries (`EU27_2020`, EU states, `GBR`, `NOR`, `CHE`, `USA`, `JPN`, `BRA`, `CAN`, `AUS`) from [`src/types/research.ts`](../../src/types/research.ts) in [`PHASE6B_COUNTRY_PROFILES_PROVENANCE.md`](PHASE6B_COUNTRY_PROFILES_PROVENANCE.md), preserving all numbers unchanged (`zero` invented citations) and labeling missing upstream citations explicitly as **`Manually Compiled — Unverified Upstream Provenance`**. | **`[OWNER: Author — Amine Zouaghi]`** Supply per-country survey/FAO/budget bibliographic citations or migrate to a cited Python-built `country_dietary_baselines.parquet` before citing absolute baseline figures as empirical observations. |
| **B-06 (Pipeline Hygiene)** | **Remediated** | Verified actual AST imports across `scripts/` & `tests/`; updated [`requirements.txt`](../../requirements.txt) with `pyarrow>=18.0.0`, `numpy>=2.0.0`, `pandas>=2.2.0`, `pytest>=8.0.0`, created lightweight [`requirements-dev.txt`](../../requirements-dev.txt) for CI/validation runs, updated [`REPRODUCIBILITY.md`](../REPRODUCIBILITY.md), corrected [`build_nsi_and_ml_parquet.py:12`](../../scripts/build_nsi_and_ml_parquet.py#L12) stdout banner (`TIMESFM 2.0` -> `EXPANDING-ORIGIN STATISTICAL HICP BACKTESTING`), and quarantined deprecated [`fetch_live_data.py`](../../scripts/fetch_live_data.py) and [`build_consumer_pulse_and_scale_off.py`](../../scripts/build_consumer_pulse_and_scale_off.py) behind `--allow-legacy-imputation` guards in [`PHASE6B_PIPELINE_HYGIENE.md`](PHASE6B_PIPELINE_HYGIENE.md). | Upstream live API harvests depend on external servers unless cached inside `scripts/.raw_cache/`. |

---

## 2. Files Added or Modified in Phase 6B

- **New Phase 6B Documentation & Dependency Files (`6`):**
  - [`docs/phase6/PHASE6B_MANUSCRIPT_REMEDIATION.md`](PHASE6B_MANUSCRIPT_REMEDIATION.md)
  - [`docs/phase6/PHASE6B_DATA_GOVERNANCE.md`](PHASE6B_DATA_GOVERNANCE.md)
  - [`docs/phase6/PHASE6B_COUNTRY_PROFILES_PROVENANCE.md`](PHASE6B_COUNTRY_PROFILES_PROVENANCE.md)
  - [`docs/phase6/PHASE6B_PIPELINE_HYGIENE.md`](PHASE6B_PIPELINE_HYGIENE.md)
  - [`docs/phase6/PHASE6B_REMEDIATION_REPORT.md`](PHASE6B_REMEDIATION_REPORT.md)
  - [`requirements-dev.txt`](../../requirements-dev.txt)
- **Synchronized Version / Citation / Code Glue (`5`):**
  - [`package.json`](../../package.json), [`package-lock.json`](../../package-lock.json) (`version: "1.0.0-rc.1"`)
  - [`src/version.ts`](../../src/version.ts), [`src/App.tsx`](../../src/App.tsx) (`APP_VERSION` wired into BibTeX exporter & footer colophon; zero analytical logic changed)
  - [`CITATION.cff`](../../CITATION.cff) (`1.0.0-rc.1`, `2026-11-17`, removed `timesfm`)
- **Reconciled Documentation & Safe Script Hygiene (`12`):**
  - [`README.md`](../../README.md), [`docs/PUBLIC_GUIDE.md`](../PUBLIC_GUIDE.md), [`docs/REPRODUCIBILITY.md`](../REPRODUCIBILITY.md), [`docs/DATA_PROVENANCE_AND_LICENSING.md`](../DATA_PROVENANCE_AND_LICENSING.md)
  - [`public/public_guide.html`](../../public/public_guide.html), [`public/architecture_blueprint.html`](../../public/architecture_blueprint.html)
  - [`docs/development/DATA_SOURCES.md`](../development/DATA_SOURCES.md), [`docs/development/DATA_DICTIONARY.md`](../development/DATA_DICTIONARY.md), [`docs/development/DATA_PIPELINE.md`](../development/DATA_PIPELINE.md), [`docs/development/CHANGELOG.md`](../development/CHANGELOG.md)
  - [`requirements.txt`](../../requirements.txt)
  - [`scripts/build_data_infrastructure.py`](../../scripts/build_data_infrastructure.py) (docstring), [`scripts/build_international_benchmarks.py`](../../scripts/build_international_benchmarks.py) (docstring/log), [`scripts/build_nsi_and_ml_parquet.py`](../../scripts/build_nsi_and_ml_parquet.py) (stdout header), [`scripts/fetch_live_data.py`](../../scripts/fetch_live_data.py) (`--allow-legacy-imputation` guard), [`scripts/build_consumer_pulse_and_scale_off.py`](../../scripts/build_consumer_pulse_and_scale_off.py) (`--allow-legacy-imputation` guard)
- **Unchanged Analytical & Data Integrity Confirmation:**
  - Zero files modified inside `src/analytics/*`, `public/data/parquet/*`, `public/data/*.json`, or `COUNTRY_PROFILES` numeric baselines in `src/types/research.ts`.

---

## 3. Observed Validation Results (`WP7` Verification Gate)

Executed directly on the remediated workspace without weakening any test or assertion:

1. **Unified 5-Stage QA Gate (`npm run qa` -> `python scripts/run_qa_gate.py`):** **PASSED (Exit 0)**
   - **1/5 `oxlint`:** `0` warnings, `0` errors across **`59` files** (`532ms`).
   - **2/5 `vitest run`:** **`16` test files, `73` tests passed** (`4.77s`), including `phase5aIntegrity.test.ts`, `crossEngineParity.test.ts`, `integratedRobustness.test.ts`, `sensitivityEngine.test.ts`, and React UI/export parity specs.
   - **3/5 `tsc -b && vite build`:** `0` TypeScript errors (`2,847` modules transformed in `1.57s`).
   - **4/5 `pytest tests/test_empirical_pipeline.py -v`:** **`14/14` passed** (`1.36s`), verifying all `19` Parquet SHA-256 hashes, `17,627` rows, schema/FK integrity, zero silent imputation, and `17` JSON–Parquet parity assertions.
   - **5/5 `pytest tests/e2e -v`:** **`1/1` Playwright Chromium E2E test passed** (`23.41s`) across all `13` UI sections (`I`–`XIII`), fallback disclosures, modal keyboard focus trap, and live CSV/JSON exports.
2. **Release Metadata & Legacy Guard Verification:**
   - Software version `1.0.0-rc.1` verified consistent across `package.json`, `package-lock.json`, `src/version.ts`, `src/App.tsx`, and `CITATION.cff` (`timesfm` removed).
   - `datasets_registry.json` verified intact (`19` tables, `17,627` rows, `pass=19/warn=0/fail=0`).
   - Invoking `python scripts/fetch_live_data.py` or `python scripts/build_consumer_pulse_and_scale_off.py` without `--allow-legacy-imputation` exits with code `1` (`[BLOCKED - DEPRECATED]`), preventing accidental overwrites.
3. **Markdown Link Check:** Verified across all `18` root, development, public-guide, methodology, provenance, reproducibility, user-guide, limitations, and Phase 6A/6B Markdown files (verified right after writing this report).

---

## 4. Final v1.0 Research Release Candidate Assessment & Outstanding Approvals

### Release Recommendation: **READY AS SOFTWARE & DOCUMENTATION `1.0.0-rc.1` — HOLD FINAL PUBLIC `v1.0.0` ARCHIVAL RELEASE PENDING AUTHOR & DATA CLEARANCES**

- **Software & Internal Reproducibility (`PASS`):** The analytical software, client-side observability architecture (`13` tabs, `DuckDB-Wasm 1.33.1`), reproducible Python dependency manifests, technical documentation (`19` tables), legacy script safety guards, and 5-stage automated QA suite cleanly meet **Research Release Candidate (`1.0.0-rc.1`)** standards. *(Note: Automated test passage proves deterministic code, schema, and export parity under documented tolerances—not independent domain-external causal validity of stylized estimates.)*
- **Mandatory Pending Actions Before Tagging Unqualified Public `v1.0.0` / Archival DOI / Manuscript Submission:**
  1. **Author Sign-Off & Manuscript Update (`B-01` · Owner: Amine Zouaghi):** Apply and approve revisions itemized in [`PHASE6B_MANUSCRIPT_REMEDIATION.md`](PHASE6B_MANUSCRIPT_REMEDIATION.md) across `paper/*`.
  2. **Public Dataset Archive Segregation / Clearances (`B-02` · Owner: Maintainer / Rights Holders):** Publish only **Track A (`13` open/attribution tables)** in any public standalone open-data deposit unless Fondazione Qualivita, GS1 Italy, and IPUMS/CTUR grant written redistribution permissions, ESS (`CC BY-NC-SA 4.0`) non-commercial scope is honored separately, HN/RSS third-party links are removed, and `public/data/world.geojson` is replaced by pinned Natural Earth Public Domain geometry.
  3. **Baseline Survey Bibliographies (`B-05` · Owner: Amine Zouaghi):** Attach primary bibliographic sources and reference years for all `25` entries in `COUNTRY_PROFILES` ([`PHASE6B_COUNTRY_PROFILES_PROVENANCE.md`](PHASE6B_COUNTRY_PROFILES_PROVENANCE.md)).
