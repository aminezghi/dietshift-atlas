"""
build_gi_statutory_zones.py
===========================
Parses the three official statutory GI production-area Excel workbooks in
`new gi datasets/` (France, Italy, Spain) and generates:
1. public/data/parquet_statutory/gi_statutory_products.parquet  (2,109 GIs)
2. public/data/parquet_statutory/gi_municipality_index.parquet  (50,763 LAU municipalities)
3. public/data/gi_statutory_zones.json                          (compact UI lookup & aggregates)

Does NOT alter any existing file inside public/data/parquet/.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import openpyxl
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "new gi datasets"
DATA_DIR = ROOT / "public" / "data"
OUT_PARQUET_DIR = DATA_DIR / "parquet_statutory"
OUT_JSON = DATA_DIR / "gi_statutory_zones.json"

CN_CHAPTER_NAMES: dict[str, str] = {
    "01": "01 · Live Animals",
    "02": "02 · Meat & Edible Offal",
    "03": "03 · Fish, Molluscs & Crustaceans",
    "04": "04 · Dairy, Eggs & Natural Honey",
    "06": "06 · Live Plants & Flowers",
    "07": "07 · Edible Vegetables & Tubers",
    "08": "08 · Edible Fruit, Citrus & Nuts",
    "09": "09 · Spices, Coffee & Herbs",
    "10": "10 · Cereals & Grains",
    "11": "11 · Milling, Flours & Starches",
    "12": "12 · Oil Seeds, Grains & Botanicals",
    "15": "15 · Olive Oils & Fats",
    "16": "16 · Processed Meat & Fish Preparations",
    "17": "17 · Sugars & Confectionery",
    "18": "18 · Cocoa & Chocolate Preparations",
    "19": "19 · Bakery, Pasta & Pastry Goods",
    "20": "20 · Prepared Vegetables & Fruit",
    "21": "21 · Miscellaneous Edible Preparations",
    "22": "22 · Wine, Spirits & Vinegar",
    "25": "25 · Salt & Mineral Products",
    "33": "33 · Essential Oils & Extracts",
    "35": "35 · Proteins & Starches",
    "45": "45 · Cork & Agricultural Fibers",
    "53": "53 · Flax & Bast Textile Fibers",
}

WORKBOOK_SPECS = [
    (
        "FR",
        "France",
        "France_GI area of production_municipality_RM 2.xlsx",
        ["FR_PDO_FOOD", "FR_PGI_FOOD", "FR_PDO_PGI_WINE", "FR_GI_Spirit"],
    ),
    (
        "IT",
        "Italy",
        "Italy_GI_area of production_municipality_RM_filled_v2 2.xlsx",
        ["IT_PDO_FOOD", "IT_PGI_FOOD", "IT_PDO_PGI_WINE", "IT_GI_Spirit"],
    ),
    (
        "ES",
        "Spain",
        "Spain_GI area of production_province_RM 4.xlsx",
        ["ES_PDO_FOOD", "ES_PGI_FOOD", "ES_PDO_PGI_WINE", "ES_GI_SPIRIT"],
    ),
]


def _clean_text(val: Any) -> str:
    if val is None:
        return ""
    s = str(val).replace("_x000D_", " ").replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def _normalize_sector(product_type: str, sheet_name: str) -> str:
    pt = product_type.lower()
    if "wine" in pt:
        return "WINE"
    if "spirit" in pt:
        return "SPIRIT"
    if "food" in pt:
        return "FOOD"
    sn = sheet_name.upper()
    if "WINE" in sn:
        return "WINE"
    if "SPIRIT" in sn:
        return "SPIRIT"
    return "FOOD"


def _normalize_scheme(raw_type: str) -> str:
    rt = raw_type.upper()
    if "PDO" in rt or "DESIGNATION OF ORIGIN" in rt:
        return "PDO"
    if "PGI" in rt or "GEOGRAPHICAL INDICATION (PGI)" in rt:
        return "PGI"
    return "GI"


def _parse_int(val: Any) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return None


def _split_list(raw: str) -> list[str]:
    if not raw:
        return []
    delim = ";" if ";" in raw else ","
    seen: set[str] = set()
    out: list[str] = []
    for part in raw.split(delim):
        cleaned = _clean_text(part)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            out.append(cleaned)
    return out


def _is_plant_class(text: str) -> bool:
    t = text.lower()
    return (
        "1.5" in t
        or "1.6" in t
        or "olive oil" in t
        or "oils and fats" in t
        or "fruit" in t
        or "vegetables" in t
        or "cereals" in t
        or "pulses" in t
    )


def _is_animal_class(text: str) -> bool:
    t = text.lower()
    return (
        "1.1" in t
        or "1.2" in t
        or "1.3" in t
        or "1.4" in t
        or "1.7" in t
        or "1.8" in t
        or "meat" in t
        or "cheese" in t
        or "fish" in t
    )


def _get_col(row_dict: dict[str, Any], *prefixes: str) -> str:
    for key, val in row_dict.items():
        lk = key.lower().strip()
        for pref in prefixes:
            if lk == pref or lk.startswith(pref):
                cleaned = _clean_text(val)
                if cleaned:
                    return cleaned
    return ""


def _parse_cn_chapters(cn_raw: str) -> list[str]:
    if not cn_raw:
        return []
    found: list[str] = []
    seen: set[str] = set()
    for match in re.finditer(r"\b(\d{2})(?:\d{2})?\s*[-–]", cn_raw):
        chap = match.group(1)
        if chap not in seen:
            seen.add(chap)
            found.append(CN_CHAPTER_NAMES.get(chap, f"{chap} · Other Tariff Chapter"))
    return found


def load_statutory_data() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    product_rows: list[dict[str, Any]] = []
    muni_rows: list[dict[str, Any]] = []

    for cc, cname, fname, product_sheets in WORKBOOK_SPECS:
        fpath = SRC_DIR / fname
        if not fpath.exists():
            raise FileNotFoundError(f"Expected statutory GI workbook not found: {fpath}")

        wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)

        # 1. Parse product sheets
        for sname in product_sheets:
            ws = wb[sname]
            rows_iter = ws.iter_rows(min_row=1, max_col=31, values_only=True)
            header = [str(x).strip() if x is not None else "" for x in next(rows_iter)]

            for r in rows_iter:
                if not any(x is not None and str(x).strip() != "" for x in r[:8]):
                    continue
                d = {header[i]: r[i] for i in range(min(len(header), len(r))) if header[i]}

                file_number = _clean_text(d.get("File number"))
                product_name = _clean_text(d.get("Name"))
                if not file_number or not product_name:
                    continue

                sector = _normalize_sector(_clean_text(d.get("Product type")), sname)
                gi_scheme = _normalize_scheme(_clean_text(d.get("Type")))
                eu_class = _clean_text(d.get("Product category (obsolete)"))
                cn_code = _clean_text(d.get("Combined nomenclature code"))
                status = _clean_text(d.get("Status"))
                legal_instrument = _clean_text(d.get("Legal instrument"))
                reg_date = _clean_text(d.get("Date of registration"))[:10]
                reg_year = _parse_int(d.get("Registration_Year"))
                if reg_year is None and len(reg_date) >= 4 and reg_date[:4].isdigit():
                    reg_year = int(reg_date[:4])

                producer_group_name = _get_col(d, "recognised producer group name")
                producer_group_address = _get_col(d, "recognised producer group address")
                control_authority = _get_col(d, "competent control authorities")
                enrichment_status = _clean_text(d.get("enrichmentStatus"))

                regions_raw = _get_col(d, "region (ccaa / nuts-2)", "region")
                provinces_raw = _get_col(d, "provinces (nuts-3)", "provinces")
                regions_list = _split_list(regions_raw)
                provinces_list = _split_list(provinces_raw)

                # Concatenate split Municipalities columns (France uses Municipalities_2.._4)
                muni_chunks = [
                    _clean_text(d.get(col))
                    for col in ("Municipalities", "Municipalities_2", "Municipalities_3", "Municipalities_4")
                ]
                combined_munis = "; ".join([c for c in muni_chunks if c]) if any(";" in c for c in muni_chunks) else ", ".join([c for c in muni_chunks if c])
                muni_list = _split_list(combined_munis)
                muni_count = len(muni_list)
                if muni_count > 20:
                    muni_preview = ", ".join(muni_list[:20]) + f" (+{muni_count - 20:,} more)"
                else:
                    muni_preview = ", ".join(muni_list)

                product_rows.append({
                    "file_number": file_number,
                    "country_code": cc,
                    "country_name": cname,
                    "product_name": product_name,
                    "product_sector": sector,
                    "gi_scheme": gi_scheme,
                    "eu_class": eu_class,
                    "cn_code": cn_code,
                    "status": status,
                    "legal_instrument": legal_instrument,
                    "registration_date": reg_date,
                    "registration_year": reg_year,
                    "producer_group_name": producer_group_name,
                    "producer_group_address": producer_group_address,
                    "control_authority": control_authority,
                    "enrichment_status": enrichment_status,
                    "regions_nuts2": ", ".join(regions_list),
                    "provinces_nuts3": ", ".join(provinces_list),
                    "region_count": len(regions_list),
                    "province_count": len(provinces_list),
                    "municipality_count": muni_count,
                    "municipalities_preview": muni_preview,
                    "data_source_url": _clean_text(d.get("Data_Source_URL")),
                })

        # 2. Parse MUNICIPALITY_GI_TYPES
        ws_m = wb["MUNICIPALITY_GI_TYPES"]
        m_iter = ws_m.iter_rows(min_row=1, max_col=10, values_only=True)
        m_hdr = [str(x).strip() if x is not None else "" for x in next(m_iter)]

        for r in m_iter:
            if r[0] is None or str(r[0]).strip() == "":
                continue
            md = {m_hdr[i]: r[i] for i in range(min(len(m_hdr), len(r))) if m_hdr[i]}
            muni_name = _clean_text(md.get("Municipality"))
            if not muni_name:
                continue
            insee_raw = _clean_text(md.get("Insee"))
            prov = _clean_text(md.get("Province") or md.get("Department"))
            reg = _clean_text(md.get("Region"))
            gi_count = _parse_int(md.get("Number of GI Products")) or 0
            gi_prods = _clean_text(md.get("GI Products"))
            cat_count = _parse_int(md.get("Number of GI Categories")) or 0
            gi_cats = _clean_text(md.get("GI Categories"))

            muni_rows.append({
                "country_code": cc,
                "municipality": muni_name,
                "insee_code": insee_raw if insee_raw else None,
                "province_or_dept": prov,
                "region": reg if reg else None,
                "gi_product_count": gi_count,
                "gi_products": gi_prods,
                "gi_category_count": cat_count,
                "gi_categories": gi_cats,
                "has_plant_gi": _is_plant_class(gi_cats),
                "has_animal_gi": _is_animal_class(gi_cats),
            })

        wb.close()

    return product_rows, muni_rows


def write_parquets(product_rows: list[dict[str, Any]], muni_rows: list[dict[str, Any]]) -> None:
    OUT_PARQUET_DIR.mkdir(parents=True, exist_ok=True)

    prod_schema = pa.schema([
        ("file_number", pa.string()),
        ("country_code", pa.string()),
        ("country_name", pa.string()),
        ("product_name", pa.string()),
        ("product_sector", pa.string()),
        ("gi_scheme", pa.string()),
        ("eu_class", pa.string()),
        ("cn_code", pa.string()),
        ("status", pa.string()),
        ("legal_instrument", pa.string()),
        ("registration_date", pa.string()),
        ("registration_year", pa.int32()),
        ("producer_group_name", pa.string()),
        ("producer_group_address", pa.string()),
        ("control_authority", pa.string()),
        ("enrichment_status", pa.string()),
        ("regions_nuts2", pa.string()),
        ("provinces_nuts3", pa.string()),
        ("region_count", pa.int32()),
        ("province_count", pa.int32()),
        ("municipality_count", pa.int32()),
        ("municipalities_preview", pa.string()),
        ("data_source_url", pa.string()),
    ])
    prod_table = pa.Table.from_pylist(product_rows, schema=prod_schema)
    pq.write_table(prod_table, OUT_PARQUET_DIR / "gi_statutory_products.parquet", compression="zstd")

    muni_schema = pa.schema([
        ("country_code", pa.string()),
        ("municipality", pa.string()),
        ("insee_code", pa.string()),
        ("province_or_dept", pa.string()),
        ("region", pa.string()),
        ("gi_product_count", pa.int32()),
        ("gi_products", pa.string()),
        ("gi_category_count", pa.int32()),
        ("gi_categories", pa.string()),
        ("has_plant_gi", pa.bool_()),
        ("has_animal_gi", pa.bool_()),
    ])
    muni_table = pa.Table.from_pylist(muni_rows, schema=muni_schema)
    pq.write_table(muni_table, OUT_PARQUET_DIR / "gi_municipality_index.parquet", compression="zstd")


def build_json_bundle(product_rows: list[dict[str, Any]], muni_rows: list[dict[str, Any]]) -> None:
    country_counts: dict[str, dict[str, int]] = {
        cc: {
            "products": sum(1 for r in product_rows if r["country_code"] == cc),
            "food_products": sum(1 for r in product_rows if r["country_code"] == cc and r["product_sector"] == "FOOD"),
            "municipalities": sum(1 for r in muni_rows if r["country_code"] == cc),
        }
        for cc in ("FR", "IT", "ES")
    }

    # Lookup map keyed by official EU File number (handles 3 transfrontier ES/FR duplicates gracefully)
    products_by_file_number: dict[str, dict[str, Any]] = {}
    for r in product_rows:
        fn = r["file_number"]
        existing = products_by_file_number.get(fn)
        if existing is None:
            products_by_file_number[fn] = {
                "cn_code": r["cn_code"],
                "legal_instrument": r["legal_instrument"],
                "registration_year": r["registration_year"],
                "producer_group": r["producer_group_name"],
                "control_authority": r["control_authority"],
                "regions": r["regions_nuts2"],
                "provinces": r["provinces_nuts3"],
                "region_count": r["region_count"],
                "province_count": r["province_count"],
                "municipality_count": r["municipality_count"],
                "municipalities_preview": r["municipalities_preview"],
                "data_source_url": r["data_source_url"],
            }
        else:
            # Merge transfrontier metadata
            merged_regions = _split_list(f"{existing['regions']}, {r['regions_nuts2']}")
            merged_provs = _split_list(f"{existing['provinces']}, {r['provinces_nuts3']}")
            existing["regions"] = ", ".join(merged_regions)
            existing["provinces"] = ", ".join(merged_provs)
            existing["region_count"] = len(merged_regions)
            existing["province_count"] = len(merged_provs)
            existing["municipality_count"] += r["municipality_count"]
            if r["municipalities_preview"] and r["municipalities_preview"] not in existing["municipalities_preview"]:
                existing["municipalities_preview"] = (
                    f"{existing['municipalities_preview']} | [{r['country_code']}] {r['municipalities_preview']}"
                )

    # Aggregate NUTS-2 regional statistics
    nuts2_acc: dict[tuple[str, str], dict[str, Any]] = {}
    for r in product_rows:
        regs = _split_list(r["regions_nuts2"])
        is_food = r["product_sector"] == "FOOD"
        is_plant = _is_plant_class(r["eu_class"])
        for reg in regs:
            key = (r["country_code"], reg)
            entry = nuts2_acc.setdefault(
                key,
                {
                    "country_code": r["country_code"],
                    "region_name": reg,
                    "total_gis": 0,
                    "food_gis": 0,
                    "wine_gis": 0,
                    "spirit_gis": 0,
                    "plant_food_gis": 0,
                    "animal_food_gis": 0,
                    "total_municipality_links": 0,
                    "sample_products": [],
                },
            )
            entry["total_gis"] += 1
            entry["total_municipality_links"] += r["municipality_count"]
            if is_food:
                entry["food_gis"] += 1
                if is_plant:
                    entry["plant_food_gis"] += 1
                else:
                    entry["animal_food_gis"] += 1
                if len(entry["sample_products"]) < 5:
                    entry["sample_products"].append(f"{r['product_name']} ({r['gi_scheme']})")
            elif r["product_sector"] == "WINE":
                entry["wine_gis"] += 1
            elif r["product_sector"] == "SPIRIT":
                entry["spirit_gis"] += 1

    nuts2_regions = []
    for entry in nuts2_acc.values():
        fg = entry["food_gis"]
        entry["plant_food_share_pct"] = round((entry["plant_food_gis"] / fg) * 100.0, 1) if fg > 0 else 0.0
        entry["sample_products"] = ", ".join(entry["sample_products"])
        nuts2_regions.append(entry)
    nuts2_regions.sort(key=lambda x: (-x["food_gis"], -x["total_gis"], x["region_name"]))

    # Aggregate NUTS-3 Province / Department hotspots from MUNICIPALITY_GI_TYPES
    prov_acc: dict[tuple[str, str], dict[str, Any]] = {}
    for m in muni_rows:
        prov = m["province_or_dept"] or "Unspecified"
        key = (m["country_code"], prov)
        p = prov_acc.setdefault(
            key,
            {
                "country_code": m["country_code"],
                "province_name": prov,
                "region_name": m["region"] or "",
                "municipality_count": 0,
                "sum_gis": 0,
                "plant_muni_count": 0,
                "max_gis_in_municipality": -1,
                "top_municipality": "",
                "top_municipality_gi_count": 0,
            },
        )
        p["municipality_count"] += 1
        p["sum_gis"] += m["gi_product_count"]
        if m["has_plant_gi"]:
            p["plant_muni_count"] += 1
        if m["gi_product_count"] > p["max_gis_in_municipality"]:
            p["max_gis_in_municipality"] = m["gi_product_count"]
            p["top_municipality"] = m["municipality"]
            p["top_municipality_gi_count"] = m["gi_product_count"]

    province_hotspots: list[dict[str, Any]] = []
    for cc in ("IT", "FR", "ES"):
        cc_provs = []
        for p in prov_acc.values():
            if p["country_code"] != cc:
                continue
            mc = p["municipality_count"]
            cc_provs.append({
                "country_code": cc,
                "province_name": p["province_name"],
                "region_name": p["region_name"],
                "municipality_count": mc,
                "mean_gis_per_municipality": round(p["sum_gis"] / mc, 2) if mc > 0 else 0.0,
                "max_gis_in_municipality": p["max_gis_in_municipality"],
                "top_municipality": p["top_municipality"],
                "top_municipality_gi_count": p["top_municipality_gi_count"],
                "plant_municipality_share_pct": round((p["plant_muni_count"] / mc) * 100.0, 1) if mc > 0 else 0.0,
            })
        cc_provs.sort(key=lambda x: (-x["mean_gis_per_municipality"], -x["max_gis_in_municipality"]))
        province_hotspots.extend(cc_provs[:30])

    # Top 300 Municipalities (100 per country sorted by GI product count desc)
    top_municipalities: list[dict[str, Any]] = []
    for cc in ("FR", "IT", "ES"):
        cc_munis = [m for m in muni_rows if m["country_code"] == cc]
        cc_munis.sort(key=lambda m: (-m["gi_product_count"], -m["gi_category_count"], m["municipality"]))
        for m in cc_munis[:100]:
            top_municipalities.append({
                "country_code": cc,
                "municipality": m["municipality"],
                "insee_code": m["insee_code"],
                "province_or_dept": m["province_or_dept"],
                "region": m["region"],
                "gi_product_count": m["gi_product_count"],
                "gi_category_count": m["gi_category_count"],
                "has_plant_gi": m["has_plant_gi"],
                "has_animal_gi": m["has_animal_gi"],
                "gi_products_preview": m["gi_products"][:240] + ("..." if len(m["gi_products"]) > 240 else ""),
                "gi_categories": m["gi_categories"],
            })

    # EU Combined Nomenclature (CN) chapters concordance
    cn_acc: dict[str, dict[str, Any]] = {}
    for r in product_rows:
        chapters = _parse_cn_chapters(r["cn_code"])
        if not chapters:
            chapters = ["99 · Unspecified CN Chapter"]
        for ch in chapters:
            entry = cn_acc.setdefault(
                ch,
                {"cn_chapter": ch, "FR": 0, "IT": 0, "ES": 0, "total_gis": 0, "food_gis": 0},
            )
            entry[r["country_code"]] += 1
            entry["total_gis"] += 1
            if r["product_sector"] == "FOOD":
                entry["food_gis"] += 1

    cn_chapters = sorted(cn_acc.values(), key=lambda x: (-x["total_gis"], x["cn_chapter"]))

    payload = {
        "metadata": {
            "version": "1.0.0-statutory",
            "total_products": len(product_rows),
            "total_municipalities": len(muni_rows),
            "country_counts": country_counts,
            "sources": (
                "EU eAmbrosia, INAO/US-ODR (aires.csv), ISTAT Elenco-comuni-italiani (2026), "
                "MAPA Register 06 & Pliegos, INE diccionario26 (2026)"
            ),
        },
        "products_by_file_number": products_by_file_number,
        "nuts2_regions": nuts2_regions,
        "province_hotspots": province_hotspots,
        "top_municipalities": top_municipalities,
        "cn_chapters": cn_chapters,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    product_rows, muni_rows = load_statutory_data()
    write_parquets(product_rows, muni_rows)
    build_json_bundle(product_rows, muni_rows)
    print(
        f"[OK] Built statutory GI infrastructure: "
        f"{len(product_rows)} products -> parquet_statutory/gi_statutory_products.parquet, "
        f"{len(muni_rows)} municipalities -> parquet_statutory/gi_municipality_index.parquet, "
        f"JSON -> {OUT_JSON.name} ({OUT_JSON.stat().st_size:,} bytes)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
