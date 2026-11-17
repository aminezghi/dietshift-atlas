import csv
import functools
import http.server
import io
import json
import os
import re
import socket
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent.parent
STAGE_DIR = ROOT / "dist-release" / "track-a-1.0.0"
TRACK_A_DIST = STAGE_DIR / "dist"
TRACK_A_PORT = int(os.environ.get("DIETSHIFT_TRACK_A_E2E_PORT", "4195"))
TRACK_A_URL = f"http://127.0.0.1:{TRACK_A_PORT}/"

EXPECTED_TRACK_B_FILENAMES = {
    "gi_terroir_bundle.json",
    "consumer_behavior_pulse.json",
    "empirical_microdata_bundle.json",
    "gs1_immagino_bundle.json",
    "pan_eu_retail_bundle.json",
    "time_use_cooking_friction.json",
    "cultural_climate_inertia.json",
    "gi_terroir_registry.parquet",
    "gs1_immagino_observatory.parquet",
    "pan_eu_retail_scanner.parquet",
    "time_use_cooking_friction.parquet",
    "cultural_climate_inertia.parquet",
    "social_discourse_velocity.parquet",
}


class _QuietTrackAHandler(http.server.SimpleHTTPRequestHandler):
    """Static file server for Track A staged dist/ with proper .wasm and .js MIME types."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".json": "application/json",
        ".parquet": "application/octet-stream",
    }

    def log_message(self, format: str, *args: object) -> None:
        return


class _ThreadingHttpServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def _port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.25)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _parse_commented_csv(text: str) -> list[dict[str, str]]:
    non_comment = [line for line in text.splitlines() if not line.startswith("#") and line.strip() != ""]
    return list(csv.DictReader(io.StringIO("\n".join(non_comment))))


@pytest.fixture(scope="module")
def track_a_preview_url():
    """Stages isolated Track A dist archive and serves ONLY Track A files cleanly."""
    assert (ROOT / "dist" / "index.html").exists(), "Run `npm run build` before Track A verification."
    assert not _port_open(TRACK_A_PORT), f"Port {TRACK_A_PORT} already in use."

    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build_release_manifest.py"), "--stage-track-a"],
        cwd=str(ROOT),
        check=True,
    )
    assert (TRACK_A_DIST / "index.html").exists()

    # Confirm zero Track B data files are staged inside Track A archive
    staged_data_files = {p.name for p in (TRACK_A_DIST / "data").rglob("*") if p.is_file()}
    assert staged_data_files.isdisjoint(EXPECTED_TRACK_B_FILENAMES), (
        f"Track B leak detected in Track A staging: {staged_data_files & EXPECTED_TRACK_B_FILENAMES}"
    )

    handler = functools.partial(_QuietTrackAHandler, directory=str(TRACK_A_DIST))
    server = _ThreadingHttpServer(("127.0.0.1", TRACK_A_PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield TRACK_A_URL
    finally:
        server.shutdown()
        server.server_close()


def test_track_a_only_all_13_sections_resilience_and_parity(track_a_preview_url, tmp_path):
    """Phase 6D WP6: verifies all 13 sections, disclosures, DuckDB, Poore LCA, and sensitivity exports in Track A."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        page = context.new_page()

        page_errors: list[str] = []
        unexpected_http_errors: list[tuple[int, str]] = []

        def on_response(res) -> None:
            if res.status >= 400:
                fname = res.url.split("/")[-1].split("?")[0]
                if res.status == 404 and fname in EXPECTED_TRACK_B_FILENAMES:
                    return
                unexpected_http_errors.append((res.status, res.url))

        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on("response", on_response)

        # 1. Section I Overview
        page.goto(track_a_preview_url, wait_until="networkidle")
        assert page.locator("h2:has-text('Plate I.')").is_visible()
        assert page.locator("[data-availability-category='excluded_from_distribution']").first.is_visible()
        assert page.get_by_role("button", name="Food GI Pins Unavailable").is_disabled()

        nav = page.locator("header nav")

        # 2. Section II NSI & Statistical Forecasts
        nav.get_by_role("button", name="II. NSI & statistical forecasts").click()
        page.locator("h2:has-text('Section II.')").wait_for(state="visible", timeout=10000)

        # 3. Section III Consumer Behavior + Plate III-F (open NHANES & GCNF intact; MTUS/ESS disclosed)
        nav.get_by_role("button", name="III. Consumer behavior & infodemiology").click()
        page.locator("h2:has-text('Section III.')").wait_for(state="visible", timeout=10000)
        page.locator("h3:has-text('Plate III-F.')").wait_for(state="visible", timeout=10000)
        page.locator("text=Clinical Ground-Truthing").first.wait_for(state="visible", timeout=10000)
        page.get_by_role("button", name="3. Public School Canteens (GCNF)").click()
        page.locator("text=[IT] Italy: Statutory Framework").wait_for(state="visible", timeout=8000)
        page.get_by_role("button", name="1. Time Poverty & Cooking Friction (MTUS)").click()
        page.locator("text=MTUS / IPUMS Time Poverty").first.wait_for(state="visible", timeout=8000)

        # 4. Section IV Full Cartography
        nav.get_by_role("button", name="IV. Full cartography").click()
        page.locator("h2:has-text('Plate I.')").first.wait_for(state="visible", timeout=10000)

        # 5. Section V DuckDB Parquet SQL (open Preset #1 succeeds; Track B Preset #6 cleanly disclosed)
        nav.get_by_role("button", name="V. DuckDB Parquet SQL").click()
        page.locator("text=/agribalyse \\(2[,.]451\\)/").wait_for(state="visible", timeout=25000)
        page.locator("text=gi_terroir (excluded)").wait_for(state="visible", timeout=10000)
        page.locator("text=Parquet query result set").first.wait_for(state="visible", timeout=15000)
        page.get_by_role("button", name="6. EUIPO GIview & Qualigeo by Sector").click()
        page.locator("text=Query references a dataset omitted from Track A open archive").first.wait_for(
            state="visible", timeout=10000
        )

        # 6. Section VI Researcher Survey Ledger
        nav.get_by_role("button", name="VI. Researcher survey ledger").click()
        page.locator("h2:has-text('Section VI.')").wait_for(state="visible", timeout=10000)

        # 7. Section VII Retail Product Trilemma
        nav.get_by_role("button", name="VII. Retail product trilemma").click()
        page.locator("h2:has-text('Section VII.')").wait_for(state="visible", timeout=10000)

        # 8. Section VIII Agribalyse 3.1 + Poore (2018) & explicit GI Track A disclosure
        nav.get_by_role("button", name="VIII. Agribalyse 3.1 (2,451)").click()
        page.locator("h3:has-text('Boundary-Aware Environmental Analytical Engine')").wait_for(
            state="visible", timeout=10000
        )
        page.locator("main select").first.select_option("gi_terroir_proxy")
        page.locator("text=Geographical Indications (EUIPO GIview & Qualigeo) registry").first.wait_for(
            state="visible", timeout=8000
        )

        # 9. Section IX Integrated Comparator & Phase 4D Robustness (12 scenarios + Poore LCA intact)
        nav.get_by_role("button", name="IX. Affordability & integrated comparator").click()
        page.get_by_test_id("tab-phase4d-robustness").click()
        page.get_by_test_id("phase4d-export-json").wait_for(state="visible", timeout=10000)
        page.locator("[data-availability-category='excluded_from_distribution']").first.wait_for(
            state="visible", timeout=8000
        )
        with page.expect_download() as dl_4d_json:
            page.get_by_test_id("phase4d-export-json").click()
        rob_json_path = tmp_path / dl_4d_json.value.suggested_filename
        dl_4d_json.value.save_as(str(rob_json_path))
        rob_json = json.loads(rob_json_path.read_text(encoding="utf-8"))
        assert len(rob_json["data"]["scenarios"]) == 12
        assert rob_json["auxiliaryAvailability"]["pooreItemsCount"] == 45
        assert rob_json["auxiliaryAvailability"]["giItemsCount"] == 0
        assert any(
            row["layers"]["environment_poore"]["validDenominator"] > 0
            and row["layers"]["environment_poore"]["evidenceNature"] == "Estimated"
            for row in rob_json["data"]["evidenceMatrix"]
        )
        assert all(
            row["layers"]["environment_gi_proxy"]["validDenominator"] == 0
            and row["layers"]["environment_gi_proxy"]["evidenceNature"] == "Missing"
            for row in rob_json["data"]["evidenceMatrix"]
        )

        # 10 & 11. Policy & Architecture
        nav.get_by_role("button", name="X. Policy intervention model").click()
        page.locator("h2:has-text('Section X.')").wait_for(state="visible", timeout=10000)
        nav.get_by_role("button", name="XI. Code floorplan & architecture").click()
        page.locator("h2:has-text('Section XI.')").wait_for(state="visible", timeout=10000)

        # 12. Section XII Retail Scanner & Open Prices EU Feed
        nav.get_by_role("button", name="XII. Pan-EU Retail Scanner & Claims").click()
        page.locator("h2:has-text('Pan-European Retail Scanner')").wait_for(state="visible", timeout=10000)
        page.locator("text=GS1 Italy Osservatorio Immagino (19th Ed.) retail dataset").first.wait_for(
            state="visible", timeout=8000
        )

        # 13. Section XIII Sensitivity (19 eligible non-GI scenarios executed, 0 false zero state, valid CSV/JSON)
        nav.get_by_role("button", name="XIII. Empirical sensitivity").click()
        page.locator("h2:has-text('Section XIII.')").wait_for(state="visible", timeout=10000)
        page.locator("text=Section XIII. Empirical Sensitivity & Robustness Analysis (19 Verified Scenarios)").first.wait_for(
            state="visible", timeout=10000
        )
        assert "0 Verified Scenarios" not in page.locator("h2:has-text('Section XIII.')").inner_text()
        page.locator("text=env_gi_unfiltered_alcohol_leak").first.wait_for(state="visible", timeout=8000)

        csv_btn = page.locator("main button:has-text('Export CSV')")
        json_btn = page.locator("main button:has-text('JSON Dossier')")
        assert csv_btn.is_enabled()
        assert json_btn.is_enabled()

        with page.expect_download() as dl_13_csv:
            csv_btn.click()
        sens_csv_path = tmp_path / dl_13_csv.value.suggested_filename
        dl_13_csv.value.save_as(str(sens_csv_path))
        sens_rows = _parse_commented_csv(sens_csv_path.read_text(encoding="utf-8"))
        assert len(sens_rows) == 19
        assert not any(r["scenario_id"] == "env_gi_unfiltered_alcohol_leak" for r in sens_rows)

        with page.expect_download() as dl_13_json:
            json_btn.click()
        sens_json_path = tmp_path / dl_13_json.value.suggested_filename
        dl_13_json.value.save_as(str(sens_json_path))
        sens_json = json.loads(sens_json_path.read_text(encoding="utf-8"))
        assert len(sens_json["scenariosExecuted"]) == 19
        assert len(sens_json["availabilitySummary"]["unavailableScenarios"]) == 1
        assert sens_json["availabilitySummary"]["unavailableScenarios"][0]["scenarioId"] == "env_gi_unfiltered_alcohol_leak"

        assert page_errors == [], f"Unexpected runtime pageerrors in Track A: {page_errors}"
        assert unexpected_http_errors == [], f"Unexpected non-Track-B HTTP errors in Track A: {unexpected_http_errors}"

        context.close()
        browser.close()
