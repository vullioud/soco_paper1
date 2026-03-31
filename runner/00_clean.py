"""Clean all existing output data, logs, and status files.

Dry-run by default.  Pass --confirm to actually delete.
"""

import argparse
import shutil
from pathlib import Path


PROJECT_DIR = Path(__file__).parent.parent
OUTPUT_DIR  = PROJECT_DIR / "output"
DATA_DIR    = PROJECT_DIR / "analysis_batch" / "data"
RUNNER_DIR  = Path(__file__).parent


def dir_size(p: Path) -> int:
    if not p.exists():
        return 0
    return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())


def fmt(nbytes: int) -> str:
    if nbytes > 1_000_000_000:
        return f"{nbytes / 1e9:.1f} GB"
    if nbytes > 1_000_000:
        return f"{nbytes / 1e6:.1f} MB"
    return f"{nbytes / 1e3:.0f} KB"


def main():
    parser = argparse.ArgumentParser(description="Clean existing output data")
    parser.add_argument("--confirm", action="store_true",
                        help="Actually delete (default is dry-run)")
    args = parser.parse_args()

    targets = []

    # 1. output/_combined/
    combined = OUTPUT_DIR / "_combined"
    if combined.exists():
        targets.append(("output/_combined/", combined, dir_size(combined)))

    # 2. Individual run directories (output/CL*_*/)
    if OUTPUT_DIR.exists():
        for d in sorted(OUTPUT_DIR.iterdir()):
            if d.is_dir() and not d.name.startswith("_"):
                targets.append((f"output/{d.name}/", d, dir_size(d)))

    # 3. analysis_batch/data/*.csv
    if DATA_DIR.exists():
        for f in sorted(DATA_DIR.glob("*.csv")):
            targets.append((f"analysis_batch/data/{f.name}", f, f.stat().st_size))

    # 4. Runner logs
    log_dir = RUNNER_DIR / "logs"
    if log_dir.exists():
        for f in sorted(log_dir.glob("*.log")):
            targets.append((f"runner/logs/{f.name}", f, f.stat().st_size))

    # 5. Runner status
    status_dir = RUNNER_DIR / "status"
    if status_dir.exists():
        for f in sorted(status_dir.glob("*.txt")):
            targets.append((f"runner/status/{f.name}", f, f.stat().st_size))

    # 6. Stale run table
    rt = RUNNER_DIR / "run_table.csv"
    if rt.exists():
        targets.append(("runner/run_table.csv", rt, rt.stat().st_size))

    if not targets:
        print("Nothing to clean.")
        return

    total = sum(s for _, _, s in targets)
    print(f"{'[DRY RUN] ' if not args.confirm else ''}Targets ({len(targets)} items, {fmt(total)} total):\n")

    for label, path, size in targets:
        print(f"  {fmt(size):>10s}  {label}")

    print(f"\n  {'-' * 30}")
    print(f"  {'TOTAL':>10s}  {fmt(total)}")

    if not args.confirm:
        print("\nPass --confirm to delete.")
        return

    print("\nDeleting...")
    freed = 0
    for label, path, size in targets:
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        freed += size

    # Recreate empty directories so the pipeline doesn't fail
    (OUTPUT_DIR / "_combined").mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (RUNNER_DIR / "logs").mkdir(exist_ok=True)
    (RUNNER_DIR / "status").mkdir(exist_ok=True)

    print(f"Done. Freed {fmt(freed)}.")


if __name__ == "__main__":
    main()
