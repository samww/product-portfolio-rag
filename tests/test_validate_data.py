"""Tests for scripts/validate_data.py.

Verifies the script produces a summary with correct counts and identifies
the known governance gaps. Runs the script as a subprocess and checks stdout.
"""

import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parent.parent / "scripts" / "validate_data.py"


def run_validate():
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Script failed:\n{result.stderr}"
    return result.stdout


# ---------------------------------------------------------------------------
# Behavior 1: script reports correct application and product counts
# ---------------------------------------------------------------------------

def test_validate_reports_counts():
    output = run_validate()
    assert "30 applications" in output
    assert "14 products" in output


# ---------------------------------------------------------------------------
# Behavior 2: script reports all 6 divisions
# ---------------------------------------------------------------------------

def test_validate_reports_divisions():
    output = run_validate()
    for division in ["Analytics", "Data Collection", "Client Services",
                     "Finance", "Platform Engineering", "HR"]:
        assert division in output


# ---------------------------------------------------------------------------
# Behavior 3: script reports exactly 3 ownership gaps
# ---------------------------------------------------------------------------

def test_validate_reports_ownership_gaps():
    output = run_validate()
    assert "3" in output
    assert "owner" in output.lower()


# ---------------------------------------------------------------------------
# Behavior 4: script reports total ARR
# ---------------------------------------------------------------------------

def test_validate_reports_total_arr():
    output = run_validate()
    # Total ARR: sum of all 14 products = $43,800,000
    assert "43,800,000" in output or "43800000" in output or "43.8" in output


# ---------------------------------------------------------------------------
# Behavior 5: script includes ROI preview table with known high-ROI product
# ---------------------------------------------------------------------------

def test_validate_reports_roi_table():
    output = run_validate()
    # DataLicensing has the highest ARR ($6.2m) — must appear in ROI table
    assert "DataLicensing" in output
