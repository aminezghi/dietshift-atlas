# DietShift Atlas v1.0.0 — Public Repository Readiness Report

**Assessment Date:** 2026-11-17  
**Evaluated Target:** DietShift Atlas v1.0.0 — MIT Source Code + Track A Open Data (Option A)  
**Analytical Baseline:** `v5.2.0-phase5c`  
**Resilience Baseline:** `v6.3.0-phase6d`  
**Repository:** [`https://github.com/aminezghi/dietshift-atlas`](https://github.com/aminezghi/dietshift-atlas)  
**Git Working Branch:** `main` (synchronized at `origin/main` commit `20ba6aa`)  

---

## 1. Executive Summary

This report establishes the comprehensive release-readiness verdict for **DietShift Atlas v1.0.0** under **Option A: Public GitHub Repository Finalization & v1.0.0 Release**.

The primary objective was to audit and prepare the public repository to guarantee that any external user or researcher can discover, clone, install, build, run, navigate all 13 sections, and export results with zero runtime crashes, complete data provenance transparency, and full legal licensing compliance—without claiming academic journal readiness or revising the academic draft manuscripts in `paper/`.

### Summary of Completed Verifications:
- **Zero Credentials / Secrets:** Automated heuristic security scan confirmed 0 exposed API keys, credentials, or private machine paths across all tracked and untracked files.
- **Pure Track A Open Distribution:** 33 open datasets (13 Parquets + 19 JSONs + Natural Earth GeoJSON) are fully cataloged, hashed with SHA-256, and verified. 14 Track B commercial/proprietary datasets and 5 academic draft files in `paper/` are strictly excluded from the public distribution bundle.
- **Track A Resilience Verified in Headless Chromium:** Under an isolated pure Track A environment (zero Track B files on disk), the web application boots cleanly, renders all 13 sections without uncaught runtime errors, and displays actionable resource disclosures where Track B data is excluded.
- **All Automated Tests Pass:**
  - `oxlint`: 0 warnings, 0 errors across 63 files.
  - `vitest`: 18 test files, 87 tests passing (100%).
  - `tsc -b && vite build`: Strict production build succeeds in 1.30s.
  - `pytest tests/test_empirical_pipeline.py`: 14 Parquet provenance and JSON parity tests passing (100%).
  - `pytest tests/e2e`: 2 Playwright Chromium E2E suites passing (100%).

---

## 2. Work Package Audit Findings (WP1–WP9)

### WP1 — Complete Repository Audit
- **Tracked vs Untracked Hygiene:** Audited all 102 tracked files in Git index and identified untracked modules added during Phases 5A–5C and 6A–6D (`src/analytics/`, `src/version.ts`, `src/utils/resourceAvailability.ts`, `docs/`, `release/`, `.github/workflows/qa-gate.yml`).
- **`.gitignore` Hardening:** Added explicit rules ignoring test artifacts (`playwright-report/`, `test-results/`, `coverage/`), temporary scratchpads (`scratch/`, `*.tmp`, `.tmp*`), and Python cache files.
- **Security & Paths Scan:** Automated scan identified and sanitized 2 local development paths in historical audit logs (`TECHNICAL_AUDIT.md` and `PHASE6A_REPOSITORY_AUDIT.md`).
- **Delivered Document:** [`docs/phase6/GITHUB_REPOSITORY_AUDIT.md`](docs/phase6/GITHUB_REPOSITORY_AUDIT.md).

### WP2 — Public Repository Distribution Policy & Git History Remediation
- **Governance Segregation:** Formalized the legal partition between MIT permissive software/documentation, 33 Track A open datasets, 14 Track B restricted datasets, and 5 academic draft manuscripts in `paper/`.
- **Git History Inspection:** Forensic inspection of all 16 commits on `main` revealed that historical commits (`d1edcf4`, `45d85de`, `20ba6aa`) introduced Track B files (`gi_terroir_registry.parquet`, `cultural_climate_inertia.parquet`, `time_use_cooking_friction.parquet`, `consumer_behavior_pulse.json`) and manuscripts (`paper/`) into Git commit history blobs.
- **Remediation Protocol:** Documented a step-by-step non-destructive `git-filter-repo` procedure for the repository owner to execute prior to public mirror or push if license compliance requires scrubbing historical commit blobs. Strict constraint honored: the automated agent did not rewrite history or execute force-pushes.
- **Delivered Document:** [`docs/phase6/PUBLIC_DISTRIBUTION_POLICY.md`](docs/phase6/PUBLIC_DISTRIBUTION_POLICY.md).

### WP3 — Clean-Environment Reproducibility Audit
- **Zero-Python Web Execution:** Verified that the compiled web application requires **only Node.js (>= 18) and npm (>= 9)**. All analytical data is pre-compiled into `public/data/`; no Python runtime or database server is required to clone and run the application locally.
- **Quick-Start Documentation:** Restructured [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md) to place copy-pasteable Node commands prominently at the top, followed by optional developer Python toolchain instructions for QA and data pipeline rebuilds.
- **Delivered Document:** [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md).

### WP4 — Functional Verification Across All 13 Sections Under Track A
- Verified that under a pure Track A distribution:
  - **Section I (Overview):** Operates cleanly with `[EU27_2020 FALLBACK]` disclosures.
  - **Section II (Researcher Sandbox):** Operates with all 2,451 Agribalyse items, live search, and blank-preserving CSV imports.
  - **Section III (Nutrition Comparison):** Operates with EFSA FoodEx2 and Open Food Facts (`per_100g` vs `per_100kcal`).
  - **Section IV (Environmental Comparison):** Operates with Poore & Nemecek 2018 (45 commodities).
  - **Section V (DuckDB-Wasm Workbench):** Registers all 13 Track A tables; displays actionable unavailable messages for Track B tables.
  - **Section VI (Affordability & Food Security):** Operates with World Bank & FAO CoHD 2024 data.
  - **Section VII (Sensitivity Analysis):** Executes 19 independent scenarios cleanly; isolates the GI scenario with a data-availability notice.
  - **Section VIII (Integrated Robustness):** Executes all 12 multidimensional scenarios cleanly.
  - **Sections IX & X (Consumer Behavior Pulse & Social Microdata):** Gracefully degrade with clear `ResourceDisclosureBanner` notices when Track B files are absent.
  - **Sections XI, XII, XIII:** GS1 Immagino, Open Prices EU, and Multi-Taxonomy Concordance operate cleanly.
  - **Exports:** All CSV/JSON export actions succeed without errors.

### WP5 — Scientific and Analytical Accuracy Audit
- **Zero Formula Modifications:** Confirmed that pure analytical engines in `src/analytics/` (`nutritionEngine.ts`, `environmentEngine.ts`, `affordabilityEngine.ts`, `sensitivityEngine.ts`, `integratedRobustness.ts`) remain 100% identical to the approved Phase 5C analytical baseline.
- **Safeguards Preserved:**
  - Zero universal composite scores or unweighted averages.
  - Denominator-grain safeguards active (`per_100g` vs `per_100kcal`).
  - Dimension-specific ranking isolation preserved.
  - Missing data preserved as NULL (zero silent default imputation).
  - Native environmental units respected: AWARE $\text{m}^3\text{ world-eq}$ (NOT physical litres) and PEF 3.1 $\text{Pt}$ (NOT physical square metres).
- **Country Profile Integrity:** Verified that all 25 numeric baseline diets in `COUNTRY_PROFILES` (`src/types/research.ts`) match the approved baseline byte-for-byte.

### WP6 — Root `README.md` Finalization
- Overhauled [`README.md`](README.md) into a comprehensive, professional GitHub landing document containing:
  1. Title and active badge row (CI Passing, MIT License, Open Data License, DuckDB-Wasm, Node.js).
  2. Clear executive overview and target audience definitions.
  3. Detailed inventory of all 13 analytical observatories and their empirical foundations.
  4. Visual Evidence Classification Framework matrix (`DataNatureBadge`).
  5. Mermaid diagram and documentation of the Dual-Path Data Architecture.
  6. Complete 20-row datasets table detailing names, sources, formats, licenses, and tracks.
  7. Copy-pasteable Node.js quick-start reproduction commands.
  8. Data export capabilities (CSV, JSON, SQL, BibTeX).
  9. Key scientific caveats and limitations.
  10. Dual-track licensing policy and redistribution terms.
  11. Formal BibTeX and APA citations.
  12. Direct clickable links to the full `docs/` suite.

### WP7 — GitHub Actions CI Configuration Audit
- **Runner Cleanliness:** Verified `.github/workflows/qa-gate.yml` and `deploy.yml` run on `ubuntu-latest` with standard actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5`).
- **Dependency Hygiene:** Replaced ad-hoc `pip install` commands with pinned `pip install -r requirements-dev.txt`.
- **Zero Local Coupling:** Confirmed that workflows contain zero hardcoded machine paths, zero personal secrets, and do not fail when Track B assets are absent.

### WP8 — Scoped Release Packaging & Manifest Reconciliation
- **Manifests Reconciled:** Reconciled `release/RELEASE_MANIFEST.json` and generated root [`RELEASE_SHA256_MANIFEST.json`](RELEASE_SHA256_MANIFEST.json) covering 148 software/docs entries and 33 Track A data assets (181 total verified entries).
- **Version Synchronization:** Synchronized version `1.0.0` across `package.json`, `src/version.ts`, `CITATION.cff`, and both manifest catalogs.
- **Staging Generation:** Generated clean distribution directory `dist-release/track-a-1.0.0/dist/` containing strictly 33 Track A files and 0 Track B files.
- **Documentation Delivered:**
  - [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md)
  - [`RELEASE_CHECKLIST_v1.0.0.md`](RELEASE_CHECKLIST_v1.0.0.md)
  - [`docs/phase6/SCOPED_RELEASE_PACKAGE_REPORT.md`](docs/phase6/SCOPED_RELEASE_PACKAGE_REPORT.md)

### WP9 — Complete Verification Run
- Executed full 5-stage quality gate (`npm run qa`) and isolated Track A Chromium E2E tests:
  - Oxlint: 0 warnings, 0 errors.
  - Vitest: 18 test files, 87 passed tests.
  - Build: 0 errors in 1.30s.
  - Pytest Parquet parity: 14 passed tests.
  - Playwright Chromium: 2 test suites passed in 31.85s.

---

## 3. Explicit Readiness Verdicts

The project is evaluated across four distinct operational dimensions:

### Verdict 1: READY TO COMMIT — [YES]
**Status:** **APPROVED FOR IMMEDIATE COMMIT**  
**Conditions & Scope:**
- All modified tracked files (`package.json`, `CITATION.cff`, `README.md`, `.gitignore`, `.github/workflows/`) and newly added untracked architecture files (`src/analytics/`, `src/version.ts`, `src/utils/resourceAvailability.ts`, `docs/`, `release/`, `RELEASE_*`) are fully verified, linted, tested, and ready to be staged and committed to the local `main` branch.
- Recommended commit command:
  ```bash
  git add .
  git commit -m "chore(release): finalize DietShift Atlas v1.0.0 (MIT code + Track A open data)"
  ```

---

### Verdict 2: READY TO PUSH — [CONDITIONAL]
**Status:** **CONDITIONAL UPON OWNER DECISION ON GIT HISTORY**  
**Assessment:**
- **Technically Ready:** The code compiles, passes CI, and will deploy cleanly to GitHub Pages via `deploy.yml`.
- **Condition on History Exposure:** As documented in WP1 and WP2, historical commit blobs on `origin/main` (`d1edcf4`, `45d85de`, `20ba6aa`) contain snapshots of Track B restricted files (`gi_terroir_registry.parquet`, `cultural_climate_inertia.parquet`, `time_use_cooking_friction.parquet`, `consumer_behavior_pulse.json`) and draft manuscripts in `paper/`.
- **Options for the Owner:**
  - *Option 2A (Push Directly without History Rewrite):* If the repository is currently private, or if the owner accepts leaving past commits as-is while the current HEAD and release tarballs are 100% Track A, the owner may simply push:
    ```bash
    git push origin main
    ```
  - *Option 2B (Clean History Scrub Before Public Mirror):* If the owner requires that the public GitHub repository contain zero trace of Track B blobs in its commit history, the owner should execute the verified `git-filter-repo` protocol documented in [`docs/phase6/PUBLIC_DISTRIBUTION_POLICY.md`](docs/phase6/PUBLIC_DISTRIBUTION_POLICY.md#4-history-remediation-plan-user-execution-protocol) in a separate clone before force-pushing.

---

### Verdict 3: READY TO TAG v1.0.0 — [CONDITIONAL]
**Status:** **CONDITIONAL UPON COMPLETION OF VERDICT 1 & 2**  
**Assessment:**
- All software version files (`package.json`, `src/version.ts`, `CITATION.cff`, `RELEASE_NOTES_v1.0.0.md`, `RELEASE_SHA256_MANIFEST.json`) are already harmonized to version `1.0.0`.
- In strict adherence to project rules, the automated agent has **NOT** created the Git tag automatically.
- Once Verdict 1 (Commit) and Verdict 2 (Push decision) are completed by the owner, tag creation is approved:
  ```bash
  git tag -a v1.0.0 -m "DietShift Atlas v1.0.0 — MIT Source Code + Track A Open Data"
  git push origin v1.0.0
  ```

---

### Verdict 4: NOT READY (Blocking Items) — [NONE]
**Status:** **NO CODE OR DATA DEFECTS BLOCKING RELEASE**  
**Findings:**
- There are **zero** unresolved code errors, zero lint warnings, zero test failures, zero missing dependencies, zero exposed secrets, and zero analytical formula regressions.
- The distinction between open Track A assets and restricted Track B assets is fully implemented, verified, and disclosed in the user interface.

---

## 4. Recommended Next Steps for the Repository Owner

1. **Review Final Modified Files:**
   Run `git status` to inspect all staged changes.
2. **Execute Commit:**
   ```bash
   git add .
   git commit -m "chore(release): finalize DietShift Atlas v1.0.0 (MIT code + Track A open data)"
   ```
3. **Select History Strategy (Option 2A vs 2B):**
   - For standard push: `git push origin main`.
   - For history scrubbing: Follow [`docs/phase6/PUBLIC_DISTRIBUTION_POLICY.md`](docs/phase6/PUBLIC_DISTRIBUTION_POLICY.md).
4. **Create Tag & Publish GitHub Release:**
   ```bash
   git tag -a v1.0.0 -m "DietShift Atlas v1.0.0 — MIT Source Code + Track A Open Data"
   git push origin v1.0.0
   ```
   On GitHub, draft a new release for `v1.0.0` using the text from [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md).
