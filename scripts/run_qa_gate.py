"""Unified Phase 5C CI Quality Gate Runner for DietShift Atlas.

Executes the full repeatable verification pipeline in strict order:
1. Oxlint static analysis
2. Vitest unit, React component, cross-engine & export parity checks
3. TypeScript type-checking and Vite production bundle build
4. Pytest Parquet provenance & JSON-Parquet parity checks
5. Playwright Chromium E2E checks across all 13 sections & live downloads
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _npm_cmd() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def run_step(label: str, cmd: list[str]) -> None:
    print(f"\n=== [QA GATE] {label} ===", flush=True)
    result = subprocess.run(cmd, cwd=str(ROOT), check=False)
    if result.returncode != 0:
        print(f"FAIL [QA GATE] Step failed ({result.returncode}): {label}", file=sys.stderr)
        sys.exit(result.returncode)
    print(f"PASS [QA GATE] {label}", flush=True)


def main() -> int:
    npm = _npm_cmd()
    steps: list[tuple[str, list[str]]] = [
        ("1/5 Oxlint static analysis", [npm, "run", "lint"]),
        ("2/5 Vitest engines, components, scenario & export parity", [npm, "test"]),
        ("3/5 TypeScript & Vite production build", [npm, "run", "build"]),
        (
            "4/5 Pytest Parquet provenance & JSON-Parquet parity",
            [sys.executable, "-m", "pytest", "tests/test_empirical_pipeline.py", "-v"],
        ),
        (
            "5/5 Playwright Chromium 13-section E2E & download parity",
            [sys.executable, "-m", "pytest", "tests/e2e", "-v"],
        ),
    ]
    for label, cmd in steps:
        run_step(label, cmd)

    print("\nALL PHASE 5C QA GATE CHECKS PASSED.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
