import csv
import io
import json
import os
import socket
import subprocess
import time
import urllib.request
from collections import Counter
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent.parent
DIST_DIR = ROOT / "dist"
DATA_DIR = ROOT / "public" / "data"
PREVIEW_PORT = int(os.environ.get("DIETSHIFT_E2E_PORT", "4193"))
BASE_URL = f"http://127.0.0.1:{PREVIEW_PORT}/"


def _find_npx() -> str:
    return "npx.cmd" if os.name == "nt" else "npx"


def _port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.25)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _parse_commented_csv(text: str) -> list[dict[str, str]]:
    non_comment = [line for line in text.splitlines() if not line.startswith("#") and line.strip() != ""]
    return list(csv.DictReader(io.StringIO("\n".join(non_comment))))


@pytest.fixture(scope="module")
def preview_url():
    """Starts an isolated vite preview server over the production dist/ build for deterministic E2E testing."""
    assert (DIST_DIR / "index.html").exists(), (
        "Production dist/index.html is missing. Run `npm run build` before Playwright E2E tests."
    )
    assert not _port_open(PREVIEW_PORT), f"Port {PREVIEW_PORT} already in use; cannot isolate preview server."

    proc = subprocess.Popen(
        [_find_npx(), "vite", "preview", "--host", "127.0.0.1", "--port", str(PREVIEW_PORT), "--strictPort"],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    deadline = time.time() + 20
    try:
        while time.time() < deadline:
            if proc.poll() is not None:
                out, err = proc.communicate(timeout=2)
                raise RuntimeError(
                    f"vite preview exited early ({proc.returncode}): {out.decode(errors='ignore')} {err.decode(errors='ignore')}"
                )
            try:
                with urllib.request.urlopen(BASE_URL, timeout=1) as resp:
                    if resp.status == 200:
                        break
            except Exception:
                time.sleep(0.2)
        else:
            raise TimeoutError(f"vite preview did not respond on {BASE_URL} within 20s")

        yield BASE_URL
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


def test_all_13_sections_dedup_accessibility_fallbacks_and_exports(preview_url, tmp_path):
    """Comprehensive Phase 5C CI verification across all 13 sections, controls, and downloads."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        page = context.new_page()

        console_errors: list[str] = []
        page_errors: list[str] = []
        http_errors: list[tuple[int, str]] = []
        data_requests: list[str] = []

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on(
            "response",
            lambda res: (
                data_requests.append(res.url.split("/")[-1]) if "/data/" in res.url else None,
                http_errors.append((res.status, res.url)) if res.status >= 400 else None,
            ),
        )

        # 1. Load Overview (Section I)
        page.goto(preview_url, wait_until="networkidle")
        assert page.locator("h2:has-text('Plate I.')").is_visible()
        assert page.locator("h2:has-text('Plate II.')").is_visible()
        assert page.locator("h2:has-text('Plate III.')").is_visible()
        assert page.locator("h2:has-text('Plate IV.')").is_visible()

        # Verify NOVA NULL toggle (H-05) & Plate III denominator visibility
        nova_toggle = page.get_by_test_id("toggle-missing-nova")
        assert nova_toggle.is_checked()
        plate3_before = page.locator("h2:has-text('Plate III.')").inner_text()
        assert "/ 3197 Open Food Facts items" in plate3_before
        nova_toggle.click()
        plate3_after = page.locator("h2:has-text('Plate III.')").inner_text()
        assert "/ 3197 Open Food Facts items" not in plate3_after
        assert page.locator("text=NULL-NOVA items excluded").is_visible()
        nova_toggle.click()  # restore

        # Verify Modal keyboard accessibility (M-04) + focus restoration
        page.locator("header button:has-text('Data Catalog')").first.click()
        dialog = page.get_by_role("dialog")
        dialog.wait_for(state="visible", timeout=5000)
        assert dialog.get_attribute("aria-modal") == "true"
        assert page.evaluate("document.activeElement && document.activeElement.closest('[role=\"dialog\"]') !== null")
        page.keyboard.press("Tab")
        assert page.evaluate("document.activeElement && document.activeElement.closest('[role=\"dialog\"]') !== null")
        page.keyboard.press("Escape")
        dialog.wait_for(state="detached", timeout=5000)
        assert page.evaluate("document.activeElement && document.activeElement.textContent.includes('Data Catalog')")

        # Verify Chart Data Table toggle (M-04) on Overview Plate II Radar
        page.get_by_role("button", name="View chart data table").first.click()
        assert "Planetary Health Diet alignment" in page.locator("table caption").first.inner_text()
        page.get_by_role("button", name="Show chart view").first.click()

        # Overview Policy Simulation slider + CSV download parity (C-02 + M-05)
        sliders = page.locator("aside input[type='range']")
        sliders.nth(0).fill("50")
        page.wait_for_timeout(150)
        ui_carbon_text = page.locator("main section").first.inner_text()
        page.get_by_title("Select dataset to export as CSV").select_option("country_profile")
        with page.expect_download() as dl_info:
            page.locator("header button:has-text('Export CSV')").click()
        dl_path = tmp_path / dl_info.value.suggested_filename
        dl_info.value.save_as(str(dl_path))
        sim_rows = _parse_commented_csv(dl_path.read_text(encoding="utf-8"))
        assert len(sim_rows) == 1
        assert sim_rows[0]["Plant_Shift_Pct"] == "50"
        assert sim_rows[0]["Policy_CI95_Available"] == "false"
        assert sim_rows[0]["PPP_Normalized"] == "false"
        assert sim_rows[0]["Simulated_CO2_kg_d"] in ui_carbon_text

        # 2. Traverse ALL remaining Sections II through XIII + verify key exports
        nav = page.locator("header nav")

        # Section II: NSI & statistical forecasts + Export CSV & JSON parity
        nav.get_by_role("button", name="II. NSI & statistical forecasts").click()
        page.locator("h2:has-text('Section II.')").wait_for(state="visible", timeout=10000)
        page.get_by_label("Uncertainty band mode").wait_for(state="visible", timeout=8000)
        page.locator("text=Methodological transparency:").wait_for(state="visible", timeout=8000)
        with page.expect_download() as dl_fc_csv:
            page.locator("main button:has-text('Export CSV')").first.click()
        fc_csv_path = tmp_path / dl_fc_csv.value.suggested_filename
        dl_fc_csv.value.save_as(str(fc_csv_path))
        fc_csv_rows = _parse_commented_csv(fc_csv_path.read_text(encoding="utf-8"))
        assert len(fc_csv_rows) == 16  # 2015..2030
        assert any(r["year"] == "2030" and r["band_supported"] == "false" for r in fc_csv_rows)

        # Section III + Plate III-F
        nav.get_by_role("button", name="III. Consumer behavior & infodemiology").click()
        page.locator("h2:has-text('Section III.')").wait_for(state="visible", timeout=10000)
        page.locator("h3:has-text('Plate III-F.')").wait_for(state="visible", timeout=10000)

        # Section IV: Full cartography
        nav.get_by_role("button", name="IV. Full cartography").click()
        page.locator("h2:has-text('Plate I.')").wait_for(state="visible", timeout=10000)
        page.locator("h3:has-text('European and global reference edition matrix')").wait_for(state="visible")

        # Section V: DuckDB Parquet SQL
        nav.get_by_role("button", name="V. DuckDB Parquet SQL").click()
        page.locator("text=DuckDB").first.wait_for(state="visible", timeout=10000)

        # Section VI: ResearcherSandbox + native AWARE/PEF units + CSV export parity
        nav.get_by_role("button", name="VI. Researcher survey ledger").click()
        page.locator("h2:has-text('Section VI.')").wait_for(state="visible", timeout=10000)
        assert page.locator("text=AWARE world-eq (not L)").is_visible()
        assert page.locator("text=not m²").is_visible()
        with page.expect_download() as dl_sb_csv:
            page.get_by_role("button", name="Download template CSV").click()
        sb_csv_path = tmp_path / dl_sb_csv.value.suggested_filename
        dl_sb_csv.value.save_as(str(sb_csv_path))
        sb_rows = _parse_commented_csv(sb_csv_path.read_text(encoding="utf-8"))
        assert "water_aware_m3_per_kg" in sb_rows[0]
        assert "land_pt_per_kg" in sb_rows[0]

        # Section VII: Retail product trilemma
        nav.get_by_role("button", name="VII. Retail product trilemma").click()
        page.locator("h2:has-text('Section VII.')").wait_for(state="visible", timeout=10000)
        page.locator("h3:has-text('Open Food Facts EU')").wait_for(state="visible", timeout=10000)

        # Section VIII: Agribalyse 3.1 (2,451) + Compatibility & Boundary Guard
        nav.get_by_role("button", name="VIII. Agribalyse 3.1 (2,451)").click()
        page.locator("h3:has-text('Boundary-Aware Environmental Analytical Engine')").wait_for(state="visible", timeout=10000)
        page.get_by_role("button", name="Compatibility & Boundary Guard").click()
        page.wait_for_timeout(400)

        # Section IX: Affordability & integrated comparator + Phase 4D Robustness export parity
        nav.get_by_role("button", name="IX. Affordability & integrated comparator").click()
        page.get_by_role("button", name="Integrated Comparator (13)").wait_for(state="visible", timeout=10000)
        page.get_by_test_id("tab-phase4d-robustness").click()
        page.get_by_test_id("phase4d-export-csv").wait_for(state="visible", timeout=10000)
        with page.expect_download() as dl_4d_csv:
            page.get_by_test_id("phase4d-export-csv").click()
        rob_csv_path = tmp_path / dl_4d_csv.value.suggested_filename
        dl_4d_csv.value.save_as(str(rob_csv_path))
        rob_raw_text = rob_csv_path.read_text(encoding="utf-8")
        rob_scenarios_csv = _parse_commented_csv(rob_raw_text.split("# EVIDENCE_MATRIX_CATEGORY")[0])
        assert len(rob_scenarios_csv) == 12
        assert "# EVIDENCE_MATRIX_CATEGORY" in rob_raw_text
        with page.expect_download() as dl_4d_json:
            page.get_by_test_id("phase4d-export-json").click()
        rob_json_path = tmp_path / dl_4d_json.value.suggested_filename
        dl_4d_json.value.save_as(str(rob_json_path))
        rob_json = json.loads(rob_json_path.read_text(encoding="utf-8"))
        assert len(rob_json["data"]["scenarios"]) == 12
        assert len(rob_json["data"]["evidenceMatrix"]) == 13

        # Section X: Policy intervention model
        nav.get_by_role("button", name="X. Policy intervention model").click()
        page.locator("h2:has-text('Section X.')").wait_for(state="visible", timeout=10000)

        # Section XI: Code floorplan & architecture
        nav.get_by_role("button", name="XI. Code floorplan & architecture").click()
        page.locator("h2:has-text('Section XI.')").wait_for(state="visible", timeout=10000)

        # Section XII: Pan-EU Retail Scanner & Claims
        nav.get_by_role("button", name="XII. Pan-EU Retail Scanner & Claims").click()
        page.locator("h2:has-text('Pan-European Retail Scanner')").wait_for(state="visible", timeout=10000)

        # Section XIII: Empirical sensitivity + CSV export parity vs public/data/ counts
        nav.get_by_role("button", name="XIII. Empirical sensitivity").click()
        page.locator("h2:has-text('Section XIII.')").wait_for(state="visible", timeout=10000)
        page.locator("text=19 valid alternative(s) displayed").wait_for(state="visible", timeout=10000)
        with page.expect_download() as dl_13_csv:
            page.locator("main button:has-text('Export CSV')").click()
        sens_csv_path = tmp_path / dl_13_csv.value.suggested_filename
        dl_13_csv.value.save_as(str(sens_csv_path))
        sens_rows = _parse_commented_csv(sens_csv_path.read_text(encoding="utf-8"))
        assert len(sens_rows) == 20
        gi_records = json.loads((DATA_DIR / "gi_terroir_bundle.json").read_text(encoding="utf-8"))["gi_terroir_records"]
        expected_food_gi = sum(1 for r in gi_records if (r.get("product_sector") or "FOOD") == "FOOD")
        gi_row = next(r for r in sens_rows if r["scenario_id"] == "env_gi_unfiltered_alcohol_leak")
        assert gi_row["is_diagnostic_only"] == "true"
        assert gi_row["baseline_valid_denom"] == str(expected_food_gi)
        assert gi_row["scenario_valid_denom"] == str(len(gi_records))
        with page.expect_download() as dl_13_json:
            page.locator("main button:has-text('JSON Dossier')").click()
        sens_json_path = tmp_path / dl_13_json.value.suggested_filename
        dl_13_json.value.save_as(str(sens_json_path))
        sens_json = json.loads(sens_json_path.read_text(encoding="utf-8"))
        assert len(sens_json["scenariosExecuted"]) == 20

        # Confirm zero console/page/HTTP errors and single-fetch deduplication across static JSONs
        assert console_errors == []
        assert page_errors == []
        assert http_errors == []
        json_counts = Counter(u for u in data_requests if u.endswith(".json") or u.endswith(".geojson"))
        duplicates = {k: v for k, v in json_counts.items() if v > 1}
        assert duplicates == {}, f"Unexpected duplicate JSON/GeoJSON network requests: {duplicates}"

        # 3. Deep-link routing + H-06 EU27_2020 HICP fallback + L-02 USA fallback disclosures
        page_dl = context.new_page()
        dl_errors: list[str] = []
        page_dl.on("pageerror", lambda err: dl_errors.append(str(err)))
        page_dl.goto(f"{preview_url}#module=inflation&country=GBR", wait_until="networkidle")
        hicp_heading = page_dl.locator("h2:has-text('Eurostat HICP food price indices')").inner_text(timeout=8000)
        assert "EU27_2020" in hicp_heading and "GBR" in hicp_heading

        page_dl.get_by_role("button", name="View chart data table").first.click()
        assert "EU27_2020 FALLBACK" in page_dl.locator("table caption").first.inner_text()
        page_dl.get_by_role("button", name="Show chart view").first.click()

        page_dl.locator("aside select").first.select_option("USA")
        nav_dl = page_dl.locator("header nav")
        nav_dl.get_by_role("button", name="II. NSI & statistical forecasts").click()
        page_dl.locator("text=Jurisdiction Fallback Disclosure").first.wait_for(state="visible", timeout=8000)
        nav_dl.get_by_role("button", name="III. Consumer behavior & infodemiology").click()
        page_dl.locator("text=Jurisdiction Fallback Disclosure").first.wait_for(state="visible", timeout=8000)
        nav_dl.get_by_role("button", name="XII. Pan-EU Retail Scanner & Claims").click()
        page_dl.locator("text=Jurisdiction Fallback Disclosure").first.wait_for(state="visible", timeout=8000)
        assert dl_errors == []
        page_dl.close()

        # 4. Adverse network failure + non-blocking UI + Retry recovery (L-01)
        ctx_err = browser.new_context(viewport={"width": 1440, "height": 900})
        page_err = ctx_err.new_page()
        fail_once = {"active": True}

        def handle_gb(route):
            if fail_once["active"]:
                fail_once["active"] = False
                route.fulfill(status=500, body="Simulated HTTP 500")
            else:
                route.continue_()

        page_err.route("**/data/global_benchmarks.json", handle_gb)
        page_err.goto(preview_url, wait_until="networkidle")
        alert = page_err.get_by_role("alert").first
        alert.wait_for(state="visible", timeout=8000)
        assert "global_benchmarks.json" in alert.inner_text()
        assert page_err.locator("h2:has-text('Plate II.')").is_visible()
        page_err.get_by_role("button", name="Retry Failed Streams").click()
        page_err.wait_for_timeout(500)
        assert page_err.get_by_role("alert").count() == 0
        ctx_err.close()

        browser.close()
