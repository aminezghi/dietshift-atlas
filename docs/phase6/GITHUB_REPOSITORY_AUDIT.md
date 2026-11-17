# DietShift Atlas — GitHub Repository Audit (WP1)

**Audit Date:** 2026-11-17  
**Audited Revision:** Git `HEAD` (`20ba6aa`)  
**Target Release:** DietShift Atlas v1.0.0 — MIT Source Code + Track A Open Data  
**Repository:** [`aminezghi/dietshift-atlas`](https://github.com/aminezghi/dietshift-atlas)  

---

## 1. Executive Summary

This repository audit provides an exhaustive accounting of all tracked, modified, and untracked files, Git commit history, security and secret scans, `.gitignore` rules, and license/data segregation prior to finalizing the public GitHub v1.0.0 release.

### Key Audit Findings:
1. **Zero Secret / Credential Leaks:** An automated heuristic scan across all files confirmed zero API keys, passwords, bearer tokens, AWS credentials, or personal secrets. Hardcoded local user paths were sanitized to relative portable repository roots.
2. **Track B Assets in Git History:** Certain Track B restricted datasets (`cultural_climate_inertia.parquet`, `time_use_cooking_friction.parquet`, `gi_terroir_registry.parquet`, `consumer_behavior_pulse.json`) and manuscripts (`paper/`) were committed in earlier revisions (`d1edcf4`, `45d85de`, `20ba6aa`). While harmless in a local clone, distributing a truly public repository containing restricted assets in its `.git` history requires a designated remediation procedure (e.g. `git-filter-repo` / BFG Repo-Cleaner) prior to public mirror or push if license compliance prohibits historical blobs.
3. **Working Tree Cleanliness:** `.gitignore` was hardened to exclude build outputs (`dist/`, `dist-release/`), Python caches (`__pycache__/`, `.pytest_cache/`), test runners (`playwright-report/`, `test-results/`, `coverage/`), and temporary scratchpads (`scratch/`, `*.tmp`).
4. **License Clear-Cut:** MIT source code and documentation are cleanly partitioned from open public data (Track A) and restricted/commercial data (Track B).

---

## 2. File Status Breakdown

### 2.1 Tracked Files in Git Index (`git ls-files`)
The repository contains 102 tracked files across source code, core scripts, documentation, and baseline assets:
- **Core Frontend:** `src/App.tsx`, `src/index.css`, `src/services/duckdbEngine.ts`, `src/types/research.ts`, `src/utils/assetPath.ts`, and core component visualizers.
- **Data Pipelines:** `scripts/build_consumer_pulse_and_scale_off.py`, `scripts/build_international_benchmarks.py`, `scripts/harvest_raw_prices_scrapling.py`, `scripts/fetch_live_data.py`.
- **Infrastructure & Config:** `package.json`, `package-lock.json`, `vite.config.ts`, `requirements.txt`, `.gitignore`, `.github/workflows/deploy.yml`.
- **Documentation:** `README.md`, `CITATION.cff`, `docs/PUBLIC_GUIDE.md`, `public/architecture_blueprint.html`.
- **Data (Historic in HEAD):** 18 Parquet tables and 21 JSON caches previously committed at `20ba6aa`.

### 2.2 Untracked Files Pending Finalization
The working tree contains validated files developed across Phases 5A–5C, 6A–6D, and Release Freeze:
- **Automated QA & CI:** `.github/workflows/qa-gate.yml`, `vitest.config.ts`, `requirements-dev.txt`, `scripts/run_qa_gate.py`, `tests/e2e/test_track_a_archive_e2e.py`.
- **Analytical & Resilience Architecture:** `src/analytics/` (pure analytical engines), `src/version.ts`, `src/utils/resourceAvailability.ts`, `src/components/ResourceDisclosureBanner.tsx`, `src/components/trackAResilience.test.tsx`, `src/services/dataProvider.ts`.
- **Documentation Suite:** `docs/SCIENTIFIC_METHODOLOGY.md`, `docs/DATA_PROVENANCE_AND_LICENSING.md`, `docs/LIMITATIONS_AND_RESPONSIBLE_USE.md`, `docs/REPRODUCIBILITY.md`, `docs/USER_GUIDE.md`, and Phase 5/6 audit logs under `docs/phase6/`.
- **Release Staging:** `release/` (canonical release manifest generator and validation tools).

---

## 3. Git History Exposure Audit

A forensic scan of all 16 commits on `main` revealed the following historical commits introducing Track B or paper assets:

| Commit Hash | Commit Subject | Identified Files |
| :--- | :--- | :--- |
| `d1edcf4` | feat: complete DietShift Atlas European & Global Food Systems Almanac with GitHub Pages deployment | `public/data/parquet/gi_terroir_registry.parquet`, `public/data/consumer_behavior_pulse.json`, `public/data/gi_terroir_bundle.json` |
| `45d85de` | feat(microdata): integrate MTUS, NHANES, GCNF & ESS empirical datasets into DuckDB-Wasm and ConsumerBehaviorPulse | `public/data/parquet/cultural_climate_inertia.parquet`, `public/data/parquet/time_use_cooking_friction.parquet`, `paper/DIETSHIFT_ATLAS_ACADEMIC_PAPER.md`, `paper/main.tex`, `paper/references.bib` |
| `03de960` | Deep empirical grounding: NHANES .XPT microdata, Eurostat HBS/EHIS/HICP/PPP, Scrapling Open Prices (1,355 SKUs), SHA-256 manifest, pytest | Updates to data bundles |
| `20ba6aa` | Internationalize & refine GI hygiene: Poore & Nemecek (2018) LCA, World Bank/FAO CoHD (2024), 3,037 FOOD GI default, 18 Parquet tables | Updates to `gi_terroir_registry.parquet` |

### History Remediation Recommendation
In accordance with the project guidelines ("Do not force-push or rewrite Git history without explicit user instruction"):
- **Current State:** The working tree and release package strictly enforce Track A isolation.
- **For a Scoped Public Mirror / Open Source Distribution:** If the owner intends to make `origin/main` completely public without historical blobs of proprietary/unredistributable data, the recommended remediation procedure is documented in `docs/phase6/PUBLIC_DISTRIBUTION_POLICY.md` (using `git-filter-repo --invert-paths --path public/data/parquet/gi_terroir_registry.parquet ...`).

---

## 4. Security & Credentials Audit

An automated regex scan was executed across all text, source, configuration, and documentation files:
- **Scanned Rules:** API keys, secret keys, passwords, bearer tokens, AWS credentials, personal GitHub PATs, and absolute local filesystem paths (`C:\Users\...`).
- **Results:**
  - Zero exposed credentials or secrets.
  - Zero personal machine paths in production codebase or runtime configurations.
  - Development logs were updated to use relative repository paths.

---

## 5. Summary & Verification

The repository structure is fully audited, clean, secure, and ready for public policy formalization under WP2.
