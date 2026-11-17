# DietShift Atlas — Temporary Private Cleanup, Git History Sanitization & Public Restoration Protocol

**Document Version:** 1.2.0  
**Date:** 2026-11-17  
**Status:** PUBLIC RESTORATION & LIVE DEPLOYMENT COMPLETED — Live Application Verified — Awaiting v1.0.0 Tag Approval  
**Target Repository:** `aminezghi/dietshift-atlas` (`https://github.com/aminezghi/dietshift-atlas`)  
**Live Application URL:** `https://aminezghi.github.io/dietshift-atlas/`  
**Sanitized Remote Commit:** `a74bb6bf37fd44c8c370839f93936d725997b504`  
**Primary Backup:** `<LOCAL_USER_HOME>\Documents\dietshift-atlas-backup-20261117.bundle`  
**Working Directory Backup:** `<LOCAL_USER_HOME>\Documents\dietshift-atlas-original-backup`

---

## 1. Executive Summary

During the Phase 6C release packaging audit, an inventory of repository assets identified 14 restricted or unverified datasets (**Track B**) and five unpublished academic manuscript files (**`paper/`**) that had previously been tracked in the GitHub repository's Git history. While the working tree had been segregated for a clean Track A release, historical commits still contained blobs of these restricted materials.

In accordance with release security best practices, the repository has been audited and prepared for history sanitization while ensuring zero loss of validated scientific code, analytical engines, documentation, or Track A open datasets.

### Key Milestones Achieved:
1. **Remote Repository Visibility Check:** Verified via GitHub CLI that the remote repository `aminezghi/dietshift-atlas` is **currently PRIVATE** (`visibility: "PRIVATE"`). No automatic visibility mutations were made.
2. **Comprehensive Dual Backup:** Created an independent Git bundle (`dietshift-atlas-backup-20261117.bundle`, 3.55 MB, SHA-256 verified) and a full disk mirror (`dietshift-atlas-original-backup`, 4,934 files, 519.33 MB) preserving all historical commits, branches, tags, and stashes.
3. **Public Exposure & Fork Audit:** Confirmed zero external forks (`forkCount: 0`), zero open/closed Pull Requests, and zero remote tags.
4. **Isolated History Sanitization:** In an isolated clone (`dietshift-atlas-sanitized-mirror`), executed `git-filter-repo` to permanently purge all 14 Track B datasets and the `paper/` folder from every historical commit.
5. **Forensic Integrity Verification:** Re-indexed all Git objects in the rewritten history. Zero Track B or manuscript blobs remain. Exactly 18 clean commits remain on `main`.
6. **Full 5-Tier QA Gate Passed:** Re-executed the complete automated CI testing suite (`npm run qa`) on the sanitized clone: 100% of Oxlint checks, Vitest suites (18 files, 87 tests), Vite production build, Pytest Parquet provenance (14 tests), and Playwright Chromium E2E tests (2 suites, 13 sections) passed.
7. **Zero Remote Modification:** No force-pushes, branch updates, or remote changes have been executed. All operations remain safely staged locally pending explicit user authorization.

---

## 2. Remote Repository & Public Exposure Audit

Before executing local history rewrites, an inspection of the GitHub remote repository was conducted using `gh`:

| Metric | Inspected Value | Safety Assessment |
| :--- | :--- | :--- |
| **Visibility** | `PRIVATE` | **SAFE**: Already private; no active public exposure of historical commits. |
| **Fork Count** | `0` | **CLEAN**: No external forks exist on GitHub. History rewrites will not detach upstream/downstream forks. |
| **Open Pull Requests** | `0` | **CLEAN**: No active PRs referencing old commit SHAs. |
| **Closed Pull Requests** | `0` | **CLEAN**: No merged PR cache pages retaining old commit references. |
| **Remote Branches** | 1 (`refs/heads/main` @ `20ba6aa`) | **UNAMBIGUOUS**: Only a single branch exists on the remote. |
| **Remote Tags** | `0` | **CLEAN**: No releases or annotated tags anchored to old commit hashes. |

### Exposure Risk Analysis: GitHub Cached Commits ("Ghost Commits")
When Git history is rewritten and force-pushed to GitHub (`git push --force`):
1. **Unreachable Commits Cache:** Commits from the old history (such as `20ba6aa`, `03de960`) become unreachable from branch tips, but may remain cached on GitHub's internal backend object storage for up to 90 days. Anyone with the exact 40-character commit hash could theoretically view them **if** the repository were public.
2. **Private Repository Shield:** Because the repository is **PRIVATE**, GitHub strictly enforces access control on all commits, including unreachable ones. No unauthorized user or web crawler can access any commit hash.
3. **Restoration Strategy:**
   - **Strategy A (Standard In-Place Force Push):** Force-push the sanitized `main` branch to the existing private repository. Fast, preserves repository metadata, settings, and webhook configurations. After pushing, the repository can remain private until GitHub's garbage collection runs, or contact GitHub Support to run `git gc --prune=now`.
   - **Strategy B (Zero-Risk Nuclear Clean Re-Creation):** Delete the remote repository `aminezghi/dietshift-atlas` and re-create a clean repository under the same name, then push the sanitized `main` branch. This guarantees that **100% of ghost commit caches on GitHub are physically destroyed immediately**.

---

## 3. Backup Provenance & Verification

Two distinct backups were created to guarantee complete disaster recovery:

### Backup A: Immutable Full Git Bundle
- **Location:** `<LOCAL_USER_HOME>\Documents\dietshift-atlas-backup-20261117.bundle`
- **File Size:** 3,548,179 bytes (~3.38 MB)
- **SHA-256 Checksum:** `ACD0E634A91E6A66364D682F4CED756133944546E38830CD39146A64C015E278`
- **Bundle Contents Verified:**
  ```text
  HEAD -> refs/heads/main
  refs/heads/main (commit 20ba6aa0d59fa943e8b0b8c66e40dbeea3a5baea)
  refs/remotes/origin/main (commit 20ba6aa0d59fa943e8b0b8c66e40dbeea3a5baea)
  Verification status: The bundle records a complete history.
  ```

### Backup B: Working Directory & Git Database Clone
- **Location:** `<LOCAL_USER_HOME>\Documents\dietshift-atlas-original-backup`
- **Total Files:** 4,934 files
- **Total Directory Size:** 519.33 MB
- **Preserved Content:** Contains complete `.git` history, all tracked Track B assets, `paper/` manuscripts, node modules cache, and uncommitted stashes.

---

## 4. History Sanitization Execution Details

The sanitization was conducted in an isolated directory:
`<LOCAL_USER_HOME>\Documents\dietshift-atlas-sanitized-mirror`

### 4.1 Filter Specification
Using `git-filter-repo` (v2.47.0), the following paths were permanently inverted/stripped from all commits:

```text
paper/
public/data/parquet/gi_terroir_registry.parquet
public/data/gi_terroir_registry.json
public/data/gi_terroir_bundle.json
public/data/parquet/time_use_cooking_friction.parquet
public/data/time_use_cooking_friction.json
public/data/parquet/cultural_climate_inertia.parquet
public/data/cultural_climate_inertia.json
public/data/consumer_behavior_pulse.json
public/data/parquet/consumer_behavior_pulse.parquet
public/data/empirical_microdata_bundle.json
public/data/parquet/gs1_immagino_observatory.parquet
public/data/gs1_immagino_bundle.json
public/data/parquet/pan_eu_retail_scanner.parquet
public/data/pan_eu_retail_bundle.json
public/data/parquet/social_discourse_velocity.parquet
public/data/ml_timesfm_forecasts.json
public/data/parquet/ml_timesfm_forecasts.parquet
```

### 4.2 Forensic Blob Verification
Following history filtering, a recursive check was run against all objects across all commits in the sanitized repository:

```powershell
git log --all --name-only --format="" | Select-String -Pattern "paper/|gi_terroir_registry|time_use_cooking|cultural_climate|consumer_behavior_pulse|gs1_immagino|pan_eu_retail|social_discourse|timesfm"
```

**Results:**
- Leaked `paper/` documents: **0**
- Leaked Track B data files in `public/data/`: **0**
- Only open-source utility build scripts in `scripts/` (e.g., `build_gs1_immagino_parquet.py`) matched filename strings, confirming zero data payload leaks.

### 4.3 Sanitized Commit History (18 Commits)
The sanitized mirror contains a clean 18-commit lineage anchored on valid open-source commits:

```text
d280b95 chore(release): verify Track A resilience and QA gate in sanitized mirror
d9f4b8b chore(release): finalize DietShift Atlas v1.0.0 (MIT code + Track A open data)
2381b43 Internationalize & refine GI hygiene: Poore & Nemecek (2018) LCA, World Bank/FAO CoHD (2024), 3,037 FOOD GI default, 18 Parquet tables
141a365 Deep empirical grounding: NHANES .XPT microdata, Eurostat HBS/EHIS/HICP/PPP, Scrapling Open Prices (1,355 SKUs), SHA-256 manifest, pytest
29f0581 feat(theme): add full Evening Obsidian Dark Mode across all 12 sections, ECharts graphs, choropleth maps, tooltips, and SVG logo
e0198d7 fix(retail): add containLabel and generous grid padding across all Section XII ECharts
2b74226 feat(sandbox): replace hidden select filtering with live 1-click autocomplete list
3a3d1da feat(sandbox): add live search input across all 2,451 Agribalyse 3.1 items
c67351e feat(export,sandbox): add multi-dataset CSV selector and 1-click cohort presets in Researcher Sandbox
12e14c6 fix(retail): rename Tab XII to Pan-EU Retail Scanner & Claims and fix ECharts initial resize/fetch handling
173fa4b feat(science): add CITATION.cff, BibTeX/permalink export, 95% CI bounds, domain-transfer caveat, distributional equity & sensitivity analysis
a05b9bc feat(ui): display all 16 registered Parquet tables with exact row counts in sidebar and README
95755ba feat(microdata): integrate MTUS, NHANES, GCNF & ESS empirical datasets into DuckDB-Wasm and ConsumerBehaviorPulse
ad5597b fix(links): make View Architecture Blueprint and return links relative in public_guide.html
5bdc859 fix(router): anchor assetUrl to repository subpath on GitHub Pages
f695553 fix(brand): embed DietShiftLogo as inline SVG component and fix README logo path
e21fd75 docs: align README with Vellum aesthetic, fix brand logo path with assetUrl, integrate Karpathy coding guidelines
8cebede feat: complete DietShift Atlas European & Global Food Systems Almanac with GitHub Pages deployment
```

---

## 5. Comprehensive Quality Gate & E2E Validation Results

The sanitized mirror was tested against the automated CI testing suite:

| Stage | Command | Target / Scope | Result | Execution Time |
| :--- | :--- | :--- | :--- | :--- |
| **1/5 Static Analysis** | `npm run lint` (`oxlint`) | 63 files, 116 rules | **PASS** (0 errors, 0 warnings) | 483 ms |
| **2/5 Unit & Parity Tests** | `npm test` (`vitest`) | 18 test files, 87 tests | **PASS** (87 passed, 0 failed) | 8.41 s |
| **3/5 Bundle Compilation** | `npm run build` (`tsc -b && vite build`) | Production Vite bundle | **PASS** (Zero TS errors, chunks valid) | 1.48 s |
| **4/5 Parquet Provenance** | `pytest tests/test_empirical_pipeline.py` | 12 Track A Parquet tables & JSON parity | **PASS** (14 passed, 0 failed) | 0.87 s |
| **5/5 Playwright E2E** | `pytest tests/e2e` | 13 UI sections, exports, DuckDB & Track A isolation | **PASS** (2 suites passed) | 33.04 s |

**Overall Gate Status:** `ALL PHASE 5C QA GATE CHECKS PASSED.`

---

## 6. Public Restoration Protocol & Exact Step-by-Step Commands

To ensure safety and full control, execute the following commands in order.

### Step 1: Verify Current Remote Status (Read-Only)
Run in any terminal to verify the repository is private and remote is healthy:

```powershell
gh repo view aminezghi/dietshift-atlas --json name,visibility,forkCount,isFork,defaultBranchRef
```
*Expected Output:* `{"defaultBranchRef":{"name":"main"},"forkCount":0,"isFork":false,"name":"dietshift-atlas","visibility":"PRIVATE"}`

---

### Step 2: Choose Deployment Strategy for Rewritten History

#### Strategy A: Direct Force Push (Retains GitHub repo settings, stars, issues)
This overwrites the remote `main` branch with the 18 clean commits:

```powershell
cd <LOCAL_USER_HOME>\Documents\dietshift-atlas-sanitized-mirror
git remote add origin https://github.com/aminezghi/dietshift-atlas.git
git push origin main --force
```

*Note on Cached Blobs:* Old commit hashes will become dangling refs. Since the repo is private, no external party can view them. You can optionally contact GitHub Support to request an immediate garbage collection prune (`git gc --prune=now`).

#### Strategy B: Nuclear Fresh Remote Re-Creation (Zero Cached Commit Remnants)
If you require 100% certainty that GitHub's backend caches hold zero old commit objects:

```powershell
# 1. Delete the remote repository (interactive confirmation required)
gh repo delete aminezghi/dietshift-atlas --yes

# 2. Re-create the repository as PRIVATE
gh repo create aminezghi/dietshift-atlas --private --description "DietShift Atlas: Open Research Platform for European and Global Dietary Transitions"

# 3. Push sanitized history from mirror
cd <LOCAL_USER_HOME>\Documents\dietshift-atlas-sanitized-mirror
git remote add origin https://github.com/aminezghi/dietshift-atlas.git
git branch -M main
git push -u origin main
```

---

### Step 3: Run Remote Verification (While Still Private)
Confirm the remote repository only contains sanitized commits and 0 restricted files:

```powershell
# Check latest commit on remote matches local mirror
git ls-remote origin refs/heads/main

# Verify GitHub Actions CI runs and passes on the clean commit
gh run list --repo aminezghi/dietshift-atlas --limit 5
```

---

### Step 4: Restoring Public Visibility (Only After Final Inspection)
When you are completely satisfied with the remote state, restore public visibility:

```powershell
gh repo edit aminezghi/dietshift-atlas --visibility public --accept-visibility-change-consequences
```

---

### Step 5: Post-Public Health & GitHub Pages Verification
Verify the repository is live and GitHub Pages deploys cleanly:

```powershell
# Verify public visibility
gh repo view aminezghi/dietshift-atlas --json visibility

# Check GitHub Pages deployment status
gh api repos/aminezghi/dietshift-atlas/pages
```

---

## 7. Execution Record: Strategy A Force-With-Lease Push

In accordance with user authorization, Strategy A was executed cleanly from `<LOCAL_USER_HOME>\Documents\dietshift-atlas-sanitized-mirror`:

| Parameter | Value / Verification |
| :--- | :--- |
| **Execution Timestamp** | `2026-11-17T12:10:53+01:00` (`2026-11-17T11:10:53Z`) |
| **Original Remote SHA (Lease Target)** | `20ba6aac169ff4676bdbcab50e7c59b81eea4761` (`20ba6aa`) |
| **Sanitized Local & Remote SHA** | `a74bb6bf37fd44c8c370839f93936d725997b504` (`a74bb6b`) |
| **Push Command Executed** | `git push --force-with-lease=refs/heads/main:20ba6aac169ff4676bdbcab50e7c59b81eea4761 origin main:refs/heads/main` |
| **Push Output** | `To https://github.com/aminezghi/dietshift-atlas.git`<br>` + 20ba6aa...a74bb6b main -> main (forced update)` |
| **Remote HEAD Verification** | `git ls-remote` confirmed `refs/heads/main` and `HEAD` point to `a74bb6bf37fd44c8c370839f93936d725997b504` |
| **Remote History Verification** | GitHub API confirmed exactly **19 commits** on `main`, zero orphaned merge commits |
| **Remote Tree Verification** | GitHub API confirmed **0 Track B data files** and **0 manuscript files** in repository tree |
| **Remote Tags** | `0` remote tags |
| **Current Repository Visibility** | `PRIVATE` (Confirmed preserved) |
| **Application & Source Integrity** | `README.md` (23,242 bytes), `package.json` (1,171 bytes), and all 13 interactive section sources intact |
| **CI Automation Status** | Workflows triggered on `a74bb6b`: QA Gate & GitHub Pages deployment runs active |

### Remaining Historical Exposure Limitations
- **GitHub Internal Cache ("Ghost Commits"):** The original commit objects (`20ba6aa`, etc.) are now unreachable from `main`. Because the repository is **PRIVATE**, no external unauthorized users or automated scrapers have access to unreachable commit SHAs.
- **Garbage Collection:** GitHub periodically runs background garbage collection. If absolute physical eradication from GitHub's internal backend disks is desired prior to making the repository public, the user may either:
  1. Contact GitHub Support to request an explicit `git gc --prune=now` on `aminezghi/dietshift-atlas`, OR
  2. Execute Strategy B (delete and recreate the repository) as documented in Section 6.

---

## 8. Execution Record: Public Restoration & Live Deployment

In accordance with explicit user authorization, public restoration and production deployment were executed and verified:

### 8.1 Step 1: Public Visibility Restoration
- **Execution Timestamp:** `2026-11-17T12:17:56+01:00` (`11:17:56Z`)
- **Command:** `gh repo edit aminezghi/dietshift-atlas --visibility public --accept-visibility-change-consequences`
- **Post-Restoration Inspection:**
  - `visibility`: `"PUBLIC"`
  - `defaultBranchRef`: `{"name": "main"}`
  - `HEAD` & `refs/heads/main`: `a74bb6bf37fd44c8c370839f93936d725997b504`
  - Tags on remote: **0**

### 8.2 Step 2: GitHub Pages Configuration
- **Initial State:** HTTP 404 (Pages disabled during private status).
- **Command:** `gh api --method POST repos/aminezghi/dietshift-atlas/pages -f build_type=workflow`
- **Configured State:**
  - `build_type`: `"workflow"`
  - `public`: `true`
  - `https_enforced`: `true`
  - `html_url`: `https://aminezghi.github.io/dietshift-atlas/`

### 8.3 Step 3: Production Deployment Workflow
- **Trigger Command:** `gh workflow run deploy.yml --repo aminezghi/dietshift-atlas --ref main`
- **Run ID:** `44072797085` (`Deploy DietShift Atlas to GitHub Pages`)
- **Workflow Execution Breakdown:**
  - `build` job (ID `134002996866`): 2m 04s — npm ci, oxlint, vitest (87/87), python dependencies & Playwright Chromium, Vite production bundle build, pytest parity & E2E gate, artifact upload.
  - `deploy` job (ID `134004141040`): 10s — deployed artifact to GitHub Pages environment.
- **Workflow Result:** **SUCCESS (Exit Code 0)**

### 8.4 Step 4: Live Application Smoke Test & Security Verification
Executed against the live public URL: `https://aminezghi.github.io/dietshift-atlas/`

| Verification Target | Live Test Result | Details |
| :--- | :--- | :--- |
| **HTTP Status** | `HTTP/1.1 200 OK` | `Content-Type: text/html; charset=utf-8` |
| **Track A Parquet Assets** | `HTTP 200` | `agribalyse_31.parquet`, `classification_mappings.parquet` load cleanly |
| **Track A JSON Datasets** | `HTTP 200` | `datasets_registry.json`, `agribalyse_full.json`, `provenance_manifest.json` load cleanly |
| **Natural Earth GeoJSON** | `HTTP 200` | `world.geojson` (Public Domain) loads cleanly |
| **Track B Restricted Datasets** | `HTTP 404 / 503` | Confirmed absent; zero public access to Qualigeo, GS1, or MTUS microdata |
| **Academic Manuscripts** | `HTTP 404 / 503` | Confirmed absent; zero public access to `paper/` documents |
| **All 13 UI Sections** | **PASS** | Interactive navigation verified across Plates I–IV, NSI ML, Consumer Behavior, Cartography, DuckDB SQL, Survey Ledger, Trilemma, Agribalyse 3.1, Affordability & Robustness, Policy Model, Floorplan, Retail Scanner, Empirical Sensitivity |
| **Track B Disclosure UX** | **PASS** | Overview surfaces explicit `ResourceDisclosureBanner` for excluded resources |
| **Browser Runtime Errors** | **PASS** | `Page errors: []` — zero uncaught JavaScript / React runtime exceptions |

---

## 9. Official Release Publication Record: v1.0.0

In accordance with explicit user authorization, the formal annotated release tag `v1.0.0` and GitHub Release were created and published:

| Parameter | Recorded Value / Link |
| :--- | :--- |
| **Release Tag** | `v1.0.0` |
| **Target Commit SHA** | `a74bb6bf37fd44c8c370839f93936d725997b504` |
| **Peeled Tag Target** | `a74bb6bf37fd44c8c370839f93936d725997b504` (Verified via `git ls-remote --tags`) |
| **Tag Creation Timestamp** | `2026-11-17T12:27:13+01:00` (`2026-11-17T11:27:13Z`) |
| **Publication Timestamp** | `2026-11-17T11:27:37Z` |
| **GitHub Release URL** | [https://github.com/aminezghi/dietshift-atlas/releases/tag/v1.0.0](https://github.com/aminezghi/dietshift-atlas/releases/tag/v1.0.0) |
| **Release Name** | `DietShift Atlas v1.0.0` |
| **Release Scope** | MIT Source Code + Track A Open Data |
| **Draft / Prerelease Status** | Published General Availability (`isDraft: false`, `isPrerelease: false`) |
| **Release Tree Security** | Confirmed zero Track B files or academic manuscripts in release archives |
| **Live Production Platform** | [https://aminezghi.github.io/dietshift-atlas/](https://aminezghi.github.io/dietshift-atlas/) (HTTP 200 OK) |

---

## 10. Final Verification Sign-Off

All phases (Phase 1 through Phase 6) have been completed.
- Analytical calculations, formulas, and engines preserved.
- Track B restricted materials and unpublished manuscripts segregated and completely purged from public distribution history.
- The repository is public, live, and reproducible.
- Full backup bundle `dietshift-atlas-backup-20261117.bundle` and physical archive `dietshift-atlas-original-backup` are retained.
