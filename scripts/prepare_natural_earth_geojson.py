"""
prepare_natural_earth_geojson.py
================================
Phase 6C WP2 — Evaluates and builds a clean Public Domain replacement for
`public/data/world.geojson` sourced directly from Natural Earth v5.1.1
(`nvkelso/natural-earth-vector`), without mutating `public/data/world.geojson`.

Outputs:
- `release/geo/world.naturalearth.110m.compatible.geojson`
- `release/geo/NATURAL_EARTH_PROVENANCE.json`
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "scripts" / ".raw_cache" / "natural_earth"
OUT_DIR = ROOT / "release" / "geo"
OUT_GEO = OUT_DIR / "world.naturalearth.110m.compatible.geojson"
OUT_PROV = OUT_DIR / "NATURAL_EARTH_PROVENANCE.json"

NE_VERSION = "v5.1.1"
NE_GEO_URL = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_VERSION}/geojson/ne_110m_admin_0_countries.geojson"
NE_LICENSE_URL = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_VERSION}/LICENSE.md"
HEADERS = {"User-Agent": "DietShiftAtlas-ReleasePackager/1.0.0-rc.1"}

# Legacy ECharts & research.ts (`COUNTRY_PROFILES`) / `world.geojson` feature.properties.name compatibility map
NE_TO_APP_NAME_MAP: dict[str, str] = {
    "United Kingdom": "England",
    "United States of America": "USA",
    "Czechia": "Czech Republic",
    "Bosnia and Herz.": "Bosnia and Herzegovina",
    "Central African Rep.": "Central African Republic",
    "Dem. Rep. Congo": "Democratic Republic of the Congo",
    "Dominican Rep.": "Dominican Republic",
    "Timor-Leste": "East Timor",
    "Eq. Guinea": "Equatorial Guinea",
    "Falkland Is.": "Falkland Islands",
    "Fr. S. Antarctic Lands": "French Southern and Antarctic Lands",
    "Guinea-Bissau": "Guinea Bissau",
    "Côte d'Ivoire": "Ivory Coast",
    "North Macedonia": "Macedonia",
    "N. Cyprus": "Northern Cyprus",
    "Serbia": "Republic of Serbia",
    "Congo": "Republic of the Congo",
    "Solomon Is.": "Solomon Islands",
    "S. Sudan": "South Sudan",
    "eSwatini": "Swaziland",
    "Bahamas": "The Bahamas",
    "Tanzania": "United Republic of Tanzania",
    "Palestine": "West Bank",
    "W. Sahara": "Western Sahara",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch_cached(url: str, dest: Path) -> bytes:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 100:
        return dest.read_bytes()
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    dest.write_bytes(data)
    return data


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_geo_bytes = fetch_cached(NE_GEO_URL, CACHE_DIR / f"ne_110m_admin_0_countries_{NE_VERSION}.geojson")
    raw_lic_bytes = fetch_cached(NE_LICENSE_URL, CACHE_DIR / f"LICENSE_{NE_VERSION}.md")

    ne_obj = json.loads(raw_geo_bytes.decode("utf-8"))
    raw_features: list[dict[str, Any]] = ne_obj.get("features", [])

    compat_features: list[dict[str, Any]] = []
    geom_invalid = 0
    mapped_aliases = 0

    for feat in raw_features:
        props = feat.get("properties", {})
        geom = feat.get("geometry")
        if not geom or geom.get("type") not in {"Polygon", "MultiPolygon"} or not geom.get("coordinates"):
            geom_invalid += 1
            continue

        ne_name = str(props.get("NAME") or props.get("ADMIN") or "")
        app_name = NE_TO_APP_NAME_MAP.get(ne_name, ne_name)
        if app_name != ne_name:
            mapped_aliases += 1

        iso3 = str(props.get("ISO_A3") or "")
        if iso3 == "-99":
            iso3 = str(props.get("ADM0_A3") or "-99")

        compat_features.append({
            "type": "Feature",
            "id": iso3,
            "properties": {
                "name": app_name,
                "ne_name": ne_name,
                "iso_a3": props.get("ISO_A3"),
                "adm0_a3": props.get("ADM0_A3"),
                "admin": props.get("ADMIN"),
            },
            "geometry": geom,
        })

    out_obj = {
        "type": "FeatureCollection",
        "metadata": {
            "source": f"Natural Earth {NE_VERSION} Admin 0 Countries (1:110m)",
            "source_url": NE_GEO_URL,
            "license": "Public Domain (Natural Earth)",
            "license_url": NE_LICENSE_URL,
            "raw_sha256": sha256_bytes(raw_geo_bytes),
            "name_compatibility_aliases_applied": mapped_aliases,
        },
        "features": compat_features,
    }
    out_bytes = json.dumps(out_obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OUT_GEO.write_bytes(out_bytes)

    # Compatibility audit against legacy world.geojson, COUNTRY_PROFILES, and COHD
    legacy_w = json.loads((ROOT / "public" / "data" / "world.geojson").read_text(encoding="utf-8"))
    legacy_names = {f["properties"]["name"] for f in legacy_w.get("features", [])}
    legacy_ids = {f.get("id") for f in legacy_w.get("features", [])}

    compat_names = {f["properties"]["name"] for f in compat_features}
    compat_ids = {f.get("id") for f in compat_features}

    res_ts = (ROOT / "src" / "types" / "research.ts").read_text(encoding="utf-8")
    cp_names = set(re.findall(r"geoJsonName:\s*'([^']+)'", res_ts))

    gb = json.loads((ROOT / "public" / "data" / "global_benchmarks.json").read_text(encoding="utf-8"))
    cohd_names = {r["geojson_name"] for r in gb.get("cohd_latest_by_country", []) if r.get("geojson_name")}

    prov = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "upstream_version": NE_VERSION,
        "source_url": NE_GEO_URL,
        "license": "Public Domain (Natural Earth Terms of Use)",
        "license_url": NE_LICENSE_URL,
        "raw_license_sha256": sha256_bytes(raw_lic_bytes),
        "raw_geojson_bytes": len(raw_geo_bytes),
        "raw_geojson_sha256": sha256_bytes(raw_geo_bytes),
        "compatible_output_path": str(OUT_GEO.relative_to(ROOT)).replace("\\", "/"),
        "compatible_output_bytes": len(out_bytes),
        "compatible_output_sha256": sha256_bytes(out_bytes),
        "feature_count": len(compat_features),
        "geometry_invalid_count": geom_invalid,
        "name_aliases_mapped": mapped_aliases,
        "compatibility_checks": {
            "legacy_world_geojson_feature_count": len(legacy_w.get("features", [])),
            "legacy_names_covered_count": len(legacy_names & compat_names),
            "legacy_names_missing": sorted(legacy_names - compat_names),
            "additional_features_in_ne": sorted(compat_names - legacy_names),
            "legacy_ids_missing": sorted(legacy_ids - compat_ids),
            "country_profiles_covered_count": len(cp_names & compat_names),
            "country_profiles_not_polygons": sorted(cp_names - compat_names),
            "cohd_names_matched_legacy": len(cohd_names & legacy_names),
            "cohd_names_matched_ne_compatible": len(cohd_names & compat_names),
        },
        "note": "Non-destructive release candidate replacement asset. public/data/world.geojson remains untouched pending Phase 6C sign-off or explicit Track A staging swap.",
    }
    OUT_PROV.write_text(json.dumps(prov, indent=2) + "\n", encoding="utf-8")

    print(f"[OK] Built Natural Earth {NE_VERSION} compatible GeoJSON: {len(compat_features)} features ({len(out_bytes):,} B)")
    print(f"     Raw SHA-256: {prov['raw_geojson_sha256']}")
    print(f"     Compat SHA-256: {prov['compatible_output_sha256']}")
    print(f"     Legacy names covered: {prov['compatibility_checks']['legacy_names_covered_count']}/{len(legacy_names)}")
    print(f"     Missing legacy names: {prov['compatibility_checks']['legacy_names_missing']}")
    print(f"     COUNTRY_PROFILES covered: {prov['compatibility_checks']['country_profiles_covered_count']}/{len(cp_names)} (not polygons: {prov['compatibility_checks']['country_profiles_not_polygons']})")
    print(f"     COHD names matched: legacy={prov['compatibility_checks']['cohd_names_matched_legacy']} vs ne_compat={prov['compatibility_checks']['cohd_names_matched_ne_compatible']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
