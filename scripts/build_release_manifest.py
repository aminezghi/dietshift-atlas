"""
build_release_manifest.py
=========================
Phase 6C WP1 & WP4 — Builds the reproducible DietShift Atlas Release Manifest
(`release/RELEASE_MANIFEST.json`) separating:
1. Application source code, UI assets, scripts, tests & docs (MIT, excluding unapproved paper/)
2. Track A Open / Attribution-Compatible Data Assets (13 Parquet + clean Track A JSONs + NE GeoJSON)
3. Track B Restricted / Permission-Required / Unverified Excluded Assets (6 Parquet + 7 JSONs + legacy world.geojson)

Optionally materializes an isolated Track A distribution staging directory under
`dist-release/track-a-1.0.0-rc.1/` (`--stage-track-a`) for WP5 smoke testing without
touching production `public/data/` files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
PARQUET_DIR = DATA_DIR / "parquet"
RELEASE_DIR = ROOT / "release"
MANIFEST_OUT = RELEASE_DIR / "RELEASE_MANIFEST.json"
NOTICE_OUT = RELEASE_DIR / "ATTRIBUTION_AND_DATA_NOTICES.md"
STAGE_OUT = ROOT / "dist-release" / "track-a-1.0.0"

# Explicit Track B exclusions (zero leakage into Track A public archive)
TRACK_B_PARQUETS: dict[str, dict[str, str]] = {
    "gi_terroir_registry.parquet": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED / PERMISSION REQUIRED",
        "reason": "Embeds Fondazione Qualivita Qualigeo copyrighted descriptions/titles/URLs alongside EUIPO GIview.",
        "source": "EUIPO GIview + Fondazione Qualivita Qualigeo",
    },
    "gs1_immagino_observatory.parquet": {
        "classification": "PERMISSION REQUIRED",
        "reason": "Transcribed GS1 Italy Osservatorio Immagino 19th Ed. copyright report summaries; underlying NielsenIQ microdata proprietary.",
        "source": "GS1 Italy Osservatorio Immagino (19th Ed. 2026-1)",
    },
    "pan_eu_retail_scanner.parquet": {
        "classification": "PERMISSION REQUIRED",
        "reason": "Anchored on GS1 Italy report metrics + synthesized pan-EU extensions.",
        "source": "GS1 Immagino Methodology Extrapolation",
    },
    "time_use_cooking_friction.parquet": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED / PERMISSION REQUIRED",
        "reason": "IPUMS MTUS terms forbid third-party redistribution and non-scholarly extract sharing.",
        "source": "MTUS / IPUMS Time Use Reference (v1.0-stylized)",
    },
    "cultural_climate_inertia.parquet": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED",
        "reason": "ESS ERIC data licensed CC BY-NC-SA 4.0 (Non-Commercial ShareAlike), incompatible with permissive MIT/CC-BY redistribution.",
        "source": "European Social Survey (ESS ERIC) + TISP (Nature Sci Data 2024)",
    },
    "social_discourse_velocity.parquet": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED",
        "reason": "Y Combinator Hacker News TOS, Google News RSS personal-use terms, and third-party publisher headline copyrights.",
        "source": "Hacker News Algolia API & Google News RSS",
    },
}

TRACK_B_JSONS: dict[str, dict[str, str]] = {
    "gi_terroir_bundle.json": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED / PERMISSION REQUIRED",
        "reason": "Mirrors 6,845 gi_terroir_registry rows including Qualigeo copyrighted fields.",
        "source": "EUIPO GIview + Fondazione Qualivita Qualigeo",
    },
    "consumer_behavior_pulse.json": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED / PERMISSION REQUIRED",
        "reason": "6.49 MB composite JSON embeds 6,845 gi_terroir_records (Qualigeo) and 129 social_discourse_posts (HN/RSS). Track A open slice is isolated in consumer_pulse_rows.json.",
        "source": "Composite bundle (Eurobarometer/Wikimedia + Qualigeo/GIview + HN/RSS)",
    },
    "empirical_microdata_bundle.json": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED / PERMISSION REQUIRED",
        "reason": "Composite bundle embeds MTUS/IPUMS time_use (60 rows) and ESS CC BY-NC-SA cultural_climate (11 rows). Open components exist independently in clinical_biomarker_grounding.json, school_meals_procurement.json, and econometric_calibration.json.",
        "source": "Composite bundle (CDC NHANES + Eurostat + GCNF + MTUS + ESS)",
    },
    "gs1_immagino_bundle.json": {
        "classification": "PERMISSION REQUIRED",
        "reason": "Mirrors GS1 Italy Osservatorio Immagino copyright report summary.",
        "source": "GS1 Italy Osservatorio Immagino (19th Ed. 2026-1)",
    },
    "pan_eu_retail_bundle.json": {
        "classification": "PERMISSION REQUIRED",
        "reason": "Mirrors pan_eu_retail_scanner anchored on GS1 Italy report summaries.",
        "source": "GS1 Immagino Methodology Extrapolation",
    },
    "time_use_cooking_friction.json": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED / PERMISSION REQUIRED",
        "reason": "Mirrors time_use_cooking_friction (IPUMS/MTUS restricted terms).",
        "source": "MTUS / IPUMS Time Use Reference (v1.0-stylized)",
    },
    "cultural_climate_inertia.json": {
        "classification": "VERIFIED — REDISTRIBUTION RESTRICTED",
        "reason": "Mirrors cultural_climate_inertia (ESS CC BY-NC-SA 4.0).",
        "source": "European Social Survey (ESS ERIC) + TISP",
    },
}

# Explicit Track A attributions for derived JSON bundles matching Parquet open licenses
TRACK_A_JSON_META: dict[str, tuple[str, str, str, str]] = {
    "agribalyse_full.json": ("3.1.1", "ADEME / INRAE Agribalyse 3.1.1", "Licence Ouverte / Open Licence v2.0 (Etalab)", "Credit ADEME / INRAE Agribalyse 3.1.1"),
    "classification_mappings.json": ("3.0.0-phase3a", "ADEME Agribalyse × EFSA FoodEx2 × OFF × COICOP 2018", "CC-BY 4.0 / ODbL 1.0", "Credit Agribalyse, EFSA, Eurostat; preserve ODbL 1.0 share-alike"),
    "clinical_biomarker_grounding.json": ("2021-2023", "CDC / NCHS NHANES 2021-2023 (WTDRD1) + derived proxies", "Public Domain (US Government)", "Cite CDC/NCHS NHANES 2021-2023; retain proxy-column disclaimer"),
    "consumer_pulse_rows.json": ("3.5", "Eurobarometer / BEUC / NSI / Wikimedia Synthesis", "CC-BY 4.0 / CC-BY-SA", "Cite DietShift Atlas synthesis & Wikimedia Pageviews API"),
    "crosswalk_rosetta.json": ("2.0.0", "Eurostat COICOP × EFSA FoodEx2 × ADEME Agribalyse 3.1.1", "CC-BY 4.0", "Credit ADEME, EFSA, Eurostat"),
    "datasets_registry.json": ("1.0.0", "DietShift Atlas Metadata Registry", "MIT", "Metadata catalog only; contains no Track B data rows"),
    "econometric_calibration.json": ("2024", "Eurostat HBS/EHIS/HICP/PPP Dissemination API", "CC-BY 4.0 (Eurostat)", "Credit Eurostat statistical tables"),
    "efsa_foodex2.json": ("2.0-stylized", "EFSA FoodEx2 Hierarchy + Stylized Scaling Multipliers", "CC-BY 4.0 (Reference taxonomy)", "Credit EFSA FoodEx2 reference & disclose stylized multipliers"),
    "forecast_validation_summary.json": ("4.0.0-leakfree", "Eurostat prc_hicp_aind & UK ONS MM23 Statistical CV", "CC-BY 4.0 (Eurostat) / OGL v3.0 (ONS)", "Credit Eurostat & UK Office for National Statistics"),
    "global_benchmarks.json": ("2018 / 2017-2024", "Poore & Nemecek (2018) + World Bank & FAO CoHD via OWID", "CC-BY 4.0", "Cite Poore & Nemecek (2018), World Bank/FAO, and Our World in Data"),
    "live_research_bundle.json": ("3.1.1 / 2026-11-16", "ADEME Agribalyse, Open Food Facts, OpenAlex, Eurostat HICP, EFSA ref", "Etalab 2.0 / ODbL 1.0 / CC0 / CC-BY 4.0", "Preserve Open Food Facts ODbL 1.0, ADEME Etalab 2.0, Eurostat CC-BY 4.0"),
    "nsi_rows_only.json": ("3.2-svd", "INE Spain, Eurostat HBS/EHIS/HICP + Modeled NUTS-2 SVD", "CC-BY 4.0", "Credit INE Spain & Eurostat; disclose NUTS-2 SVD modeling"),
    "nsi_subnational_quintiles.json": ("3.2-svd", "INE Spain, Eurostat HBS/EHIS/HICP + Modeled NUTS-2 SVD & K-means", "CC-BY 4.0", "Credit INE Spain & Eurostat; disclose NUTS-2 SVD modeling"),
    "off_expanded_rows.json": ("2026-11-16", "Open Food Facts Search-a-licious API", "ODbL 1.0 / CC-BY-SA", "Credit Open Food Facts contributors (ODbL 1.0 share-alike)"),
    "off_full.json": ("2026-11-08-legacy-881", "Open Food Facts Search-a-licious API (initial 881-item snapshot)", "ODbL 1.0 / CC-BY-SA", "Credit Open Food Facts contributors (ODbL 1.0)"),
    "provenance_manifest.json": ("1.0.0", "DietShift Atlas Build Provenance Checksums", "MIT", "Metadata SHA-256 catalog only"),
    "school_meals_procurement.json": ("2026", "Global Child Nutrition Foundation (GCNF) & National Ministries", "CC-BY 4.0", "Credit GCNF & statutory ministry acts (EGALIM, CAM, DGE)"),
    "scrapling_retail_claims.json": ("2026-11-16", "Open Food Facts Open Prices API + Open Food Facts", "ODbL 1.0", "Credit Open Prices & Open Food Facts contributors (ODbL 1.0)"),
    "statistical_price_forecasts.json": ("4.0.0-leakfree", "Eurostat prc_hicp_aind & UK ONS MM23 Backtests", "CC-BY 4.0 (Eurostat) / OGL v3.0 (ONS)", "Credit Eurostat & UK Office for National Statistics"),
}

SOURCE_ROOT_FILES = [
    ".gitignore",
    ".oxlintrc.json",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "vitest.config.ts",
    "index.html",
    "requirements.txt",
    "requirements-dev.txt",
    "CITATION.cff",
    "LICENSE",
    "README.md",
    "AGENTS.md",
]

SOURCE_DIRS = ["src", "scripts", "tests", "docs", ".github"]
PUBLIC_CODE_FILES = [
    "public/public_guide.html",
    "public/architecture_blueprint.html",
    "public/floorplan.html",
    "public/favicon.ico",
    "public/favicon.svg",
    "public/apple-touch-icon.png",
    "public/icons.svg",
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_source_entries(pkg_version: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    software_entries: list[dict[str, Any]] = []
    excluded_docs: list[dict[str, Any]] = []

    def add_file(rel_path: Path, note: str = "") -> None:
        full = ROOT / rel_path
        rel_str = str(rel_path).replace("\\", "/")
        entry: dict[str, Any] = {
            "relative_path": rel_str,
            "size_bytes": full.stat().st_size,
            "sha256": sha256_file(full),
            "version": pkg_version,
            "source": "DietShift Atlas repository",
            "license": "MIT",
            "attribution": "Amine Zouaghi (DietShift Atlas Contributors)",
            "classification": "Software Source & Docs",
        }
        if rel_str == "src/types/research.ts":
            entry["data_governance_caveat"] = (
                "Code structure licensed MIT; embedded 25 COUNTRY_PROFILES numeric baselines remain "
                "Manually Compiled — Unverified Provenance (see PHASE6B_COUNTRY_PROFILES_PROVENANCE.md)."
            )
        if note:
            entry["note"] = note
        software_entries.append(entry)

    for f in SOURCE_ROOT_FILES:
        p = Path(f)
        if (ROOT / p).exists():
            add_file(p)

    for pf in PUBLIC_CODE_FILES:
        p = Path(pf)
        if (ROOT / p).exists():
            add_file(p)

    for folder in SOURCE_DIRS:
        base = ROOT / folder
        if not base.exists():
            continue
        for item in sorted(base.rglob("*")):
            if not item.is_file():
                continue
            rel = item.relative_to(ROOT)
            parts = rel.parts
            if "__pycache__" in parts or ".raw_cache" in parts or "logo_skill" in parts:
                continue
            add_file(rel)

    # Unapproved academic manuscripts under paper/ remain excluded from clean release package
    paper_dir = ROOT / "paper"
    if paper_dir.exists():
        for item in sorted(paper_dir.rglob("*")):
            if item.is_file():
                rel_str = str(item.relative_to(ROOT)).replace("\\", "/")
                excluded_docs.append({
                    "relative_path": rel_str,
                    "size_bytes": item.stat().st_size,
                    "sha256": sha256_file(item),
                    "track": "Track B (Pending Author Revision — B-01)",
                    "classification": "UNAPPROVED MANUSCRIPT — DO NOT DISTRIBUTE AS v1.0",
                    "reason": "Contains retracted TimesFM / leakage-era metrics flagged in PHASE6B_MANUSCRIPT_REMEDIATION.md.",
                })

    return software_entries, excluded_docs


def collect_data_tracks() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    reg = json.loads((DATA_DIR / "datasets_registry.json").read_text(encoding="utf-8"))
    reg_by_id = {d["id"]: d for d in reg["datasets"]}

    track_a: list[dict[str, Any]] = []
    track_b: list[dict[str, Any]] = []

    # 1. All 19 Parquet tables
    for pq_path in sorted(PARQUET_DIR.glob("*.parquet")):
        rel_str = str(pq_path.relative_to(ROOT)).replace("\\", "/")
        ds_id = pq_path.stem
        meta = reg_by_id.get(ds_id, {})
        sz = pq_path.stat().st_size
        digest = sha256_file(pq_path)

        if pq_path.name in TRACK_B_PARQUETS:
            tb = TRACK_B_PARQUETS[pq_path.name]
            track_b.append({
                "relative_path": rel_str,
                "size_bytes": sz,
                "sha256": digest,
                "dataset_version": meta.get("version", "unknown"),
                "source": tb["source"],
                "license": meta.get("license", "Restricted"),
                "governance_status": tb["classification"],
                "track": "Track B",
                "reason": tb["reason"],
            })
        else:
            track_a.append({
                "relative_path": rel_str,
                "distribution_path": rel_str,
                "size_bytes": sz,
                "sha256": digest,
                "dataset_version": str(meta.get("version", "unknown")),
                "source": str(meta.get("source_name", "Institutional source")),
                "license": str(meta.get("license", "Attribution required")),
                "attribution": f"{meta.get('source_name', ds_id)} ({meta.get('license', '')})",
                "track": "Track A",
                "governance_status": (
                    "VERIFIED — REDISTRIBUTION PERMITTED"
                    if "Public Domain" in str(meta.get("license", ""))
                    else "VERIFIED — ATTRIBUTION REQUIRED"
                ),
            })

    # 2. All 26 JSON files under public/data/
    for j_path in sorted(DATA_DIR.glob("*.json")):
        rel_str = str(j_path.relative_to(ROOT)).replace("\\", "/")
        sz = j_path.stat().st_size
        digest = sha256_file(j_path)
        if j_path.name in TRACK_B_JSONS:
            tb = TRACK_B_JSONS[j_path.name]
            track_b.append({
                "relative_path": rel_str,
                "size_bytes": sz,
                "sha256": digest,
                "dataset_version": "bundle",
                "source": tb["source"],
                "license": "Restricted / Permission Required",
                "governance_status": tb["classification"],
                "track": "Track B",
                "reason": tb["reason"],
            })
        else:
            ver, src, lic, attr = TRACK_A_JSON_META[j_path.name]
            track_a.append({
                "relative_path": rel_str,
                "distribution_path": rel_str,
                "size_bytes": sz,
                "sha256": digest,
                "dataset_version": ver,
                "source": src,
                "license": lic,
                "attribution": attr,
                "track": "Track A",
                "governance_status": (
                    "VERIFIED — REDISTRIBUTION PERMITTED"
                    if lic in {"Public Domain (US Government)", "MIT"}
                    else "VERIFIED — ATTRIBUTION REQUIRED"
                ),
            })

    # 3. Geographic assets: legacy world.geojson -> Track B; Natural Earth v5.1.1 -> Track A
    legacy_geo = DATA_DIR / "world.geojson"
    if legacy_geo.exists():
        track_b.append({
            "relative_path": "public/data/world.geojson",
            "size_bytes": legacy_geo.stat().st_size,
            "sha256": sha256_file(legacy_geo),
            "dataset_version": "unpinned-github-raw",
            "source": "holtzy/D3-graph-gallery / johan/world.geo.json",
            "license": "Unverified boundary provenance",
            "governance_status": "UNVERIFIED — DO NOT REDISTRIBUTE",
            "track": "Track B",
            "reason": "Unpinned commit/SHA and upstream shapefile caveat; superseded in Track A archive by pinned Natural Earth v5.1.1.",
        })

    ne_geo = RELEASE_DIR / "geo" / "world.naturalearth.110m.compatible.geojson"
    if not ne_geo.exists():
        raise FileNotFoundError(f"Missing {ne_geo}. Run scripts/prepare_natural_earth_geojson.py first.")
    track_a.append({
        "relative_path": "release/geo/world.naturalearth.110m.compatible.geojson",
        "distribution_path": "public/data/world.geojson",
        "size_bytes": ne_geo.stat().st_size,
        "sha256": sha256_file(ne_geo),
        "dataset_version": "v5.1.1",
        "source": "Natural Earth Admin 0 Countries 1:110m (nvkelso/natural-earth-vector)",
        "license": "Public Domain (Natural Earth)",
        "attribution": "Made with Natural Earth (Public Domain)",
        "track": "Track A",
        "governance_status": "VERIFIED — REDISTRIBUTION PERMITTED",
    })

    return track_a, track_b


def write_attribution_notice(track_a: list[dict[str, Any]], track_b: list[dict[str, Any]], pkg_version: str) -> None:
    lines = [
        f"# DietShift Atlas {pkg_version} — Data Attribution & Archive Segregation Notice",
        "",
        "## Track A Included Open / Attribution Datasets",
        "",
        "| Distribution Path | Version | License | Required Attribution / Note |",
        "| :--- | :--- | :--- | :--- |",
    ]
    for a in track_a:
        lines.append(
            f"| `{a['distribution_path']}` | `{a['dataset_version']}` | {a['license']} | {a['attribution']} |"
        )
    lines.extend([
        "",
        "## Track B Excluded Restricted / Unverified Datasets",
        "",
        "| Original Repo Path | Governance Status | Exclusion Reason |",
        "| :--- | :--- | :--- |",
    ])
    for b in track_b:
        lines.append(f"| `{b['relative_path']}` | **{b['governance_status']}** | {b['reason']} |")
    NOTICE_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def stage_track_a_archive(pkg_version: str, track_a: list[dict[str, Any]]) -> Path:
    if STAGE_OUT.exists():
        shutil.rmtree(STAGE_OUT)
    STAGE_OUT.mkdir(parents=True, exist_ok=True)

    # 1. Copy compiled Vite dist/ minus all data/ first, then copy ONLY Track A data into dist/data/
    dist_src = ROOT / "dist"
    if not dist_src.exists():
        raise FileNotFoundError("dist/ missing; run `npm run build` before staging Track A release.")

    dist_dst = STAGE_OUT / "dist"
    shutil.copytree(dist_src, dist_dst, ignore=shutil.ignore_patterns("data"))
    (dist_dst / "data" / "parquet").mkdir(parents=True, exist_ok=True)

    for entry in track_a:
        src_file = ROOT / entry["relative_path"]
        dist_rel = entry["distribution_path"]
        assert dist_rel.startswith("public/data/"), f"Unexpected dist path: {dist_rel}"
        sub = dist_rel.removeprefix("public/data/")
        target = dist_dst / "data" / sub
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_file, target)

    # Copy governance & citation docs alongside Track A bundle
    for doc_name in ("LICENSE", "CITATION.cff", "README.md"):
        shutil.copy2(ROOT / doc_name, STAGE_OUT / doc_name)
    shutil.copy2(MANIFEST_OUT, STAGE_OUT / "RELEASE_MANIFEST.json")
    shutil.copy2(NOTICE_OUT, STAGE_OUT / "ATTRIBUTION_AND_DATA_NOTICES.md")
    print(f"[OK] Staged clean Track A web release directory -> {STAGE_OUT.relative_to(ROOT)} ({len(track_a)} Track A assets bundled, 0 Track B files)")
    return STAGE_OUT


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Phase 6C Release Manifest & optional Track A archive staging")
    parser.add_argument("--stage-track-a", action="store_true", help="Stage isolated Track A web bundle into dist-release/")
    args = parser.parse_args()

    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    pkg_version = str(pkg["version"])

    software_entries, excluded_manuscripts = collect_source_entries(pkg_version)
    track_a, track_b = collect_data_tracks()

    git_commit = "unknown"
    try:
        git_commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        pass

    manifest = {
        "schema_version": "1.0.0",
        "release_candidate_version": pkg_version,
        "analytical_baseline_tag": "v5.2.0-phase5c",
        "documentation_baseline_tag": "v6.0.0-phase6a",
        "git_head_short": git_commit,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "regeneration_command": "python scripts/build_release_manifest.py",
        "staging_command": "python scripts/build_release_manifest.py --stage-track-a",
        "summary_counts": {
            "software_source_and_docs_files": len(software_entries),
            "track_a_open_data_files": len(track_a),
            "track_a_parquet_tables": sum(1 for x in track_a if x["relative_path"].endswith(".parquet")),
            "track_b_excluded_data_files": len(track_b),
            "track_b_excluded_parquet_tables": sum(1 for x in track_b if x["relative_path"].endswith(".parquet")),
            "excluded_unapproved_manuscript_files": len(excluded_manuscripts),
            "track_a_total_bytes": sum(x["size_bytes"] for x in track_a),
            "track_b_excluded_total_bytes": sum(x["size_bytes"] for x in track_b),
        },
        "software_source_and_docs": software_entries,
        "track_a_open_data": track_a,
        "track_b_excluded_assets": track_b,
        "excluded_unapproved_manuscripts": excluded_manuscripts,
    }

    MANIFEST_OUT.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_attribution_notice(track_a, track_b, pkg_version)

    print(f"[OK] Wrote {MANIFEST_OUT.relative_to(ROOT)}:")
    print(f"     Software/Docs: {manifest['summary_counts']['software_source_and_docs_files']} files (MIT)")
    print(f"     Track A Included Data: {manifest['summary_counts']['track_a_open_data_files']} files ({manifest['summary_counts']['track_a_parquet_tables']} Parquets, {manifest['summary_counts']['track_a_total_bytes']:,} B)")
    print(f"     Track B Excluded Data: {manifest['summary_counts']['track_b_excluded_data_files']} files ({manifest['summary_counts']['track_b_excluded_parquet_tables']} Parquets, {manifest['summary_counts']['track_b_excluded_total_bytes']:,} B)")
    print(f"     Excluded Unapproved Manuscripts: {manifest['summary_counts']['excluded_unapproved_manuscript_files']} files")

    if args.stage_track_a:
        stage_track_a_archive(pkg_version, track_a)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
