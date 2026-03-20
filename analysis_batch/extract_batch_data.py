#!/usr/bin/env python3
"""
Copy pre-computed summary CSVs from output/_combined/ to analysis_batch/data/.

The inline post-processing in runner/02_run_parallel.py now computes all
summaries (species aggregation, diversity indices, stand volumes, removals)
directly from SQLite during each run.  This script just copies the results
to the analysis directory.

Usage: python analysis_batch/extract_batch_data.py
"""

import shutil
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
COMBINED_DIR = PROJECT_DIR / "output" / "_combined"
OUT_DIR = Path(__file__).parent / "data"


# Files produced by 02_run_parallel.py inline post-processing
SUMMARY_FILES = [
    "stand_volume.csv",
    "species_by_year_type.csv",
    "species_by_year.csv",
    "stand_shannon.csv",
    "stand_species_gini.csv",
    "landscape_diversity.csv",
    "removal.csv",
    "barkbeetle_yearly.csv",
    # SOCO CSVs (merged with metadata)
    "soco_stand_state.csv",
    "soco_ml_activities.csv",
    "soco_decade_decisions.csv",
    "soco_decade_budget.csv",
    "soco_decade_snapshot.csv",
]


def main():
    if not COMBINED_DIR.exists():
        print(f"Combined directory not found: {COMBINED_DIR}")
        print("Run simulations first: python runner/02_run_parallel.py")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Clear old data
    for f in OUT_DIR.glob("*.csv"):
        f.unlink()

    copied = 0
    missing = 0

    for name in SUMMARY_FILES:
        src = COMBINED_DIR / name
        if not src.exists():
            print(f"  SKIP (not found): {name}")
            missing += 1
            continue

        dst = OUT_DIR / name
        shutil.copy2(src, dst)
        size_mb = dst.stat().st_size / (1024 * 1024)
        print(f"  {name}  ({size_mb:.1f} MB)")
        copied += 1

    print(f"\nDone. Copied {copied} files to {OUT_DIR}/")
    if missing:
        print(f"  ({missing} files not found in _combined/ — run simulations first)")

    # Total size
    total = sum(f.stat().st_size for f in OUT_DIR.glob("*.csv"))
    print(f"  Total: {total / (1024 * 1024):.1f} MB")


if __name__ == "__main__":
    main()
