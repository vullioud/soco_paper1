"""Aggregate outputs from all completed runs into analysis-ready datasets."""

import csv
import sqlite3
import sys
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib


# iLand SQLite tables to extract
ILND_TABLES = ["abeStand", "abeStandDetail", "abeStandRemoval", "barkbeetle", "wind"]

# SOCO CSV file patterns (without prefix)
SOCO_FILES = [
    "soco_ml_activities.csv",
    "soco_decade_decisions.csv",
    "soco_decade_budget.csv",
    "soco_decade_snapshot.csv",
    "soco_stand_state.csv",
]


def parse_run_id(run_id: str) -> dict:
    """Extract cluster, aggregation, disturbance, replicate from run_id.

    Handles both V1 (CL05_High_rep_001) and V2 (CL10_High_bb_rep_001) formats.
    """
    parts = run_id.split("_")
    rep_str = parts[-1]                          # 001
    rep_num = int(rep_str.replace("rep", ""))
    cl = parts[0]                                # CL05
    middle = parts[1:-2]                         # ["High", "bb"] or ["state", "only"]
    dist_labels = {"bb", "nod", "contbb", "lowbb"}
    if middle and middle[-1] in dist_labels:
        disturbance = middle[-1]
        agg = "_".join(middle[:-1])
    else:
        disturbance = "bb"                       # V1 runs default to bb
        agg = "_".join(middle)
    cluster = cl.replace("CL", "CLUSTER") if cl != "ROOT" else ""
    return {"cluster": cluster, "aggregation": agg, "disturbance": disturbance,
            "replicate": rep_num}


def extract_sqlite_tables(db_path: Path, run_id: str, out_dir: Path):
    """Extract tables from a single run's SQLite, append metadata columns."""
    meta = parse_run_id(run_id)
    conn = sqlite3.connect(str(db_path))

    for table in ILND_TABLES:
        try:
            cursor = conn.execute(f"SELECT * FROM {table}")
            cols = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
        except sqlite3.OperationalError:
            continue  # table doesn't exist in this run

        out_file = out_dir / f"{table}_all.csv"
        write_header = not out_file.exists()

        with open(out_file, "a", newline="") as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(["run_id", "cluster", "aggregation", "disturbance",
                                 "replicate"] + cols)
            for row in rows:
                writer.writerow([run_id, meta["cluster"], meta["aggregation"],
                                 meta["disturbance"], meta["replicate"]] + list(row))

    conn.close()


def merge_soco_csvs(run_dir: Path, run_id: str, out_dir: Path):
    """Merge SOCO CSV files, adding metadata columns."""
    meta = parse_run_id(run_id)
    prefix = f"{run_id}_"

    for soco_file in SOCO_FILES:
        src = run_dir / f"{prefix}{soco_file}"
        if not src.exists():
            # try without prefix
            src = run_dir / soco_file
        if not src.exists():
            continue

        out_file = out_dir / f"combined_{soco_file}"
        write_header = not out_file.exists()

        with open(src, "r") as fin:
            reader = csv.reader(fin)
            header = next(reader, None)
            if header is None:
                continue

            with open(out_file, "a", newline="") as fout:
                writer = csv.writer(fout)
                if write_header:
                    writer.writerow(["run_id", "cluster", "aggregation", "disturbance",
                                     "replicate"] + header)
                for row in reader:
                    writer.writerow([run_id, meta["cluster"], meta["aggregation"],
                                     meta["disturbance"], meta["replicate"]] + row)


def main():
    config_path = Path(__file__).parent / "config.toml"
    with open(config_path, "rb") as f:
        cfg = tomllib.load(f)

    project_dir = Path(cfg["general"]["project_dir"])
    output_base = project_dir / "output"
    combined    = output_base / "_combined"
    combined.mkdir(parents=True, exist_ok=True)

    # Clear previous combined files
    for f in combined.glob("*.csv"):
        f.unlink()

    # Find completed runs
    run_dirs = sorted(d for d in output_base.iterdir()
                      if d.is_dir() and not d.name.startswith("_"))

    n_processed = 0
    for run_dir in run_dirs:
        run_id = run_dir.name
        db_path = run_dir / "iLand_output.sqlite"

        if not db_path.exists():
            print(f"  SKIP {run_id}: no SQLite found")
            continue

        print(f"  Processing {run_id}...")
        extract_sqlite_tables(db_path, run_id, combined)
        merge_soco_csvs(run_dir, run_id, combined)
        n_processed += 1

    # Summary
    print(f"\nProcessed {n_processed} runs -> {combined}")
    for f in sorted(combined.glob("*.csv")):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
