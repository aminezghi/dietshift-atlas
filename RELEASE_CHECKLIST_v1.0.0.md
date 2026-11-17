# DietShift Atlas — Release Checklist v1.0.0

This checklist governs the release transition from local development to the public GitHub release of **DietShift Atlas v1.0.0**.

---

## 1. Pre-Commit Checklist (Local Verification)

- [x] **Zero TypeScript Errors:** `npm run build` (`tsc -b && vite build`) compiles with zero errors and zero warnings.
- [x] **Zero Linter Warnings:** `npm run lint` (`oxlint`) passes with 0 warnings and 0 errors across all 63 files.
- [x] **Vitest Unit & Component Suite:** `npm test` passes all 18 test files (87 passing tests).
- [x] **Track A Resilience E2E:** `pytest tests/e2e/test_track_a_archive_e2e.py` passes 100% in headless Chromium.
- [x] **Full 5-Stage QA Gate:** `npm run qa` (`python scripts/run_qa_gate.py`) passes all 5 stages.
- [x] **Secret & Credential Scan:** `python scripts/scan_repo_security.py` confirms 0 API keys, passwords, or machine paths.
- [x] **No Analytical Formula Changes:** Pure analytical calculation engines in `src/analytics/` match approved baseline.
- [x] **No Country Profile Baseline Changes:** 25 `COUNTRY_PROFILES` retain verified numerical baselines.
- [x] **Version Consistency:** `package.json` (`1.0.0`), `src/version.ts` (`1.0.0`), `CITATION.cff` (`1.0.0`), and `RELEASE_SHA256_MANIFEST.json` are synchronized.
- [x] **Release Manifest Reconciliation:** `release/RELEASE_MANIFEST.json` and `RELEASE_SHA256_MANIFEST.json` match with 148 software/docs files and 33 Track A data assets.

---

## 2. Pre-Push Checklist (Git & Remote Safety)

- [x] **Track B Assets Isolated:** Track B files are excluded from the Track A public distribution bundle.
- [x] **Academic Manuscripts Preserved:** Files under `paper/` remain preserved locally and are not deleted or exposed.
- [x] **No Forced Commits or History Rewrites:** Local working tree changes do not rewrite Git history without explicit user command.
- [ ] **History Remediation Decision:** If publishing as a completely new public repository without historical blobs of Track B assets, review the step-by-step history remediation protocol in `docs/phase6/PUBLIC_DISTRIBUTION_POLICY.md`.
- [ ] **Review Git Status:** Run `git status` to verify the exact set of modified and untracked files before staging.

---

## 3. Pre-Tag Checklist (v1.0.0 Release Verification)

> [!WARNING]
> Do NOT create the `v1.0.0` Git tag automatically. The tag must be explicitly created by the repository owner after committing all finalized files.

- [ ] All required files committed to `main` with a clean commit message:
  ```bash
  git add .
  git commit -m "chore(release): prepare DietShift Atlas v1.0.0 release (MIT code + Track A open data)"
  ```
- [ ] Verify clean working tree (`git status` reports nothing to commit).
- [ ] Verify that HEAD commit contains valid `package.json`, `CITATION.cff`, and `README.md`.

---

## 4. Post-Tag Checklist (GitHub Publication)

Execute these steps only when the repository owner approves publishing:

- [ ] **Create Git Tag:**
  ```bash
  git tag -a v1.0.0 -m "DietShift Atlas v1.0.0 — MIT Source Code + Track A Open Data"
  ```
- [ ] **Push Commits and Tag to Origin:**
  ```bash
  git push origin main
  git push origin v1.0.0
  ```
- [ ] **Verify GitHub Actions:**
  - Verify that `qa-gate.yml` passes on GitHub Actions.
  - Verify that `deploy.yml` completes successfully and deploys to GitHub Pages (`https://aminezghi.github.io/dietshift-atlas/`).
- [ ] **Publish GitHub Release:**
  - Create a new Release on GitHub targeting tag `v1.0.0`.
  - Copy contents from `RELEASE_NOTES_v1.0.0.md` into the release description.
  - Attach the staged Track A distribution archive (`dist-release/track-a-1.0.0/`) if distributing a standalone zip.
