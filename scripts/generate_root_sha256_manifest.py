import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
SRC_MANIFEST = ROOT / "release" / "RELEASE_MANIFEST.json"
OUT_MANIFEST = ROOT / "RELEASE_SHA256_MANIFEST.json"

with open(SRC_MANIFEST, "r", encoding="utf-8") as f:
    data = json.load(f)

manifest = {
    "release_version": data.get("release_candidate_version", "1.0.0"),
    "schema_version": "1.0.0",
    "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    "summary": {
        "track_a_open_data_files": data["summary_counts"]["track_a_open_data_files"],
        "track_a_parquet_tables": data["summary_counts"]["track_a_parquet_tables"],
        "software_and_docs_files": data["summary_counts"]["software_source_and_docs_files"],
        "track_b_excluded_files": data["summary_counts"]["track_b_excluded_data_files"],
        "track_a_total_bytes": data["summary_counts"]["track_a_total_bytes"]
    },
    "track_a_data_assets": {},
    "software_and_documentation": {}
}

for item in data.get("track_a_open_data", []):
    manifest["track_a_data_assets"][item["relative_path"]] = {
        "sha256": item["sha256"],
        "size_bytes": item["size_bytes"],
        "dataset_version": item.get("dataset_version"),
        "license": item.get("license"),
        "source": item.get("source"),
        "governance_status": item.get("governance_status")
    }

for item in data.get("software_source_and_docs", []):
    manifest["software_and_documentation"][item["relative_path"]] = {
        "sha256": item["sha256"],
        "size_bytes": item["size_bytes"],
        "license": item.get("license"),
        "classification": item.get("classification")
    }

with open(OUT_MANIFEST, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)

print(f"[OK] Generated {OUT_MANIFEST} with {len(manifest['track_a_data_assets'])} Track A data assets and {len(manifest['software_and_documentation'])} software/docs entries.")
