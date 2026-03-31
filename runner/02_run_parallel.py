"""Run iLandC simulations in parallel, driven by run_table.csv.

After each run completes, computes analysis-ready summaries from the SQLite
database (species aggregation, diversity indices, stand volumes, removals),
appends them to output/_combined/ CSVs, merges SOCO CSVs (thinning
soco_stand_state to decadal snapshots), and deletes the raw SQLite.

Use --keep-raw to skip SQLite deletion.
Use --reference-only to run only the OAT reference scenario for testing.
"""

import argparse
import csv
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from threading import Lock

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib

# Import shared summary module (same directory)
sys.path.insert(0, str(Path(__file__).parent))
from summarize import (build_stand_btype_map, summarize_sqlite, HEADERS)


# ---- iLand CLI override keys (columns in run_table.csv that become key=value args) ----
OVERRIDE_KEYS = [
    "system.path.output",
    "system.database.out",
    "system.database.climate",
    "model.climate.co2concentration",
    "model.world.environmentFile",
    "model.initialization.file",
    "model.initialization.saplingFile",
    "model.management.abe.agentDataFile",
    "modules.barkbeetle.referenceClimate.tableName",
    "user.output_prefix",
    "user.bb_enabled",
    "user.disturbance_start_year",
    "user.outbreak_probability",
    "user.baseline_probability",
    "modules.barkbeetle.backgroundInfestationProbability",
    "user.outbreak_start_year",
    "user.outbreak_end_year",
    "user.management_enabled",
    "model.world.timeEventsEnabled",
    "model.world.timeEventsFile",
    "system.settings.threadCount",
]

# Seconds to wait between launching each worker
STAGGER_DELAY = 5

# SOCO CSV file patterns (without prefix)
SOCO_FILES = [
    "soco_ml_activities.csv",
    "soco_decade_decisions.csv",
    "soco_decade_budget.csv",
    "soco_decade_snapshot.csv",
    "soco_stand_state.csv",
]

# Thread-safe lock for writing to combined CSV files
_write_lock = Lock()


def post_process_run(run_row: dict, run_dir: Path, combined_dir: Path,
                     project_dir: Path, keep_raw: bool):
    """Compute summaries from SQLite, merge SOCO CSVs, clean up."""
    run_id = run_row["run_id"]
    landscape = run_row.get("landscape") or run_row.get("cluster", "").replace("CLUSTER", "CL")
    condition = run_row.get("condition", run_row.get("disturbance", "unknown"))
    disturbance = run_row.get("disturbance", condition)
    meta_row = [
        run_id,
        run_row.get("cluster", ""),
        landscape,
        run_row["aggregation"],
        condition,
        disturbance,
        run_row["climate"],
        str(run_row["replicate"]),
    ]

    db_path = run_dir / "iLand_output.sqlite"

    # --- 1. Compute summaries from SQLite ---
    if db_path.exists() and db_path.stat().st_size > 50_000:
        stand_btype = build_stand_btype_map(run_dir, run_id, project_dir)
        summaries = summarize_sqlite(db_path, stand_btype)

        with _write_lock:
            # Write each summary table
            for table_name, header in HEADERS.items():
                out_file = combined_dir / f"{table_name}.csv"
                write_header = not out_file.exists()
                with open(out_file, "a", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    if write_header:
                        writer.writerow(header)
                    for row in summaries.get(table_name, []):
                        writer.writerow(meta_row + row)

            # Barkbeetle (dynamic header)
            bb_rows = summaries.get("barkbeetle_yearly", [])
            bb_cols = summaries.get("barkbeetle_cols", [])
            if bb_rows and bb_cols:
                out_file = combined_dir / "barkbeetle_yearly.csv"
                write_header = not out_file.exists()
                with open(out_file, "a", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    if write_header:
                        writer.writerow(["run_id", "cluster", "landscape", "aggregation",
                                         "condition", "disturbance", "climate", "replicate"] + bb_cols)
                    for row in bb_rows:
                        writer.writerow(meta_row + row)

            # Wind (dynamic header)
            wind_rows = summaries.get("wind_yearly", [])
            wind_cols = summaries.get("wind_cols", [])
            if wind_rows and wind_cols:
                out_file = combined_dir / "wind_yearly.csv"
                write_header = not out_file.exists()
                with open(out_file, "a", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    if write_header:
                        writer.writerow(["run_id", "cluster", "landscape", "aggregation",
                                         "condition", "disturbance", "climate", "replicate"] + wind_cols)
                    for row in wind_rows:
                        writer.writerow(meta_row + row)

            # Stand species shares (dynamic header — species columns vary)
            sp_rows = summaries.get("stand_species_shares", [])
            sp_cols = summaries.get("stand_species_cols", [])
            if sp_rows and sp_cols:
                out_file = combined_dir / "stand_species_shares.csv"
                write_header = not out_file.exists()
                with open(out_file, "a", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    if write_header:
                        writer.writerow(
                            ["run_id", "cluster", "landscape", "aggregation",
                             "condition", "disturbance", "climate", "replicate",
                             "year", "standid", "behavioral_type",
                             "total_ba"] + sp_cols)
                    for row in sp_rows:
                        writer.writerow(meta_row + row)

        if not keep_raw:
            db_path.unlink()

    # --- 2. Merge SOCO CSVs (with decadal thinning for soco_stand_state) ---
    prefix = f"{run_id}_"
    for soco_file in SOCO_FILES:
        src = run_dir / f"{prefix}{soco_file}"
        if not src.exists():
            src = run_dir / soco_file
        if not src.exists():
            continue

        thin_decadal = (soco_file == "soco_stand_state.csv")
        out_file = combined_dir / f"soco_{soco_file.replace('soco_', '')}"

        with _write_lock:
            write_header = not out_file.exists()
            with open(src, "r", encoding="utf-8") as fin:
                reader = csv.reader(fin)
                header = next(reader, None)
                if header is None:
                    continue

                # Find year column index for decadal thinning
                year_idx = None
                if thin_decadal:
                    try:
                        year_idx = header.index("year")
                    except ValueError:
                        thin_decadal = False

                with open(out_file, "a", newline="", encoding="utf-8") as fout:
                    writer = csv.writer(fout)
                    if write_header:
                        writer.writerow(["run_id", "cluster", "landscape", "aggregation",
                                         "condition", "disturbance", "climate", "replicate"] + header)
                    for row in reader:
                        # Thin soco_stand_state to decadal snapshots
                        if thin_decadal and year_idx is not None:
                            try:
                                year = int(row[year_idx])
                                if year % 10 != 0:
                                    continue
                            except (ValueError, IndexError):
                                pass
                        writer.writerow(meta_row + row)


def run_single(ilandc_exe: str, project_dir: str, base_xml: str,
               sim_years: int, run_id: str, overrides: dict,
               log_dir: str) -> dict:
    """Execute a single ilandc run. Returns result dict."""
    t0 = time.time()

    out_dir = Path(project_dir) / overrides["system.path.output"]
    out_dir.mkdir(parents=True, exist_ok=True)

    cmd = [ilandc_exe, base_xml, str(sim_years)]
    for key in OVERRIDE_KEYS:
        if key in overrides:
            cmd.append(f"{key}={overrides[key]}")

    log_path = Path(log_dir) / f"{run_id}.log"
    with open(log_path, "w") as log_file:
        result = subprocess.run(
            cmd, cwd=project_dir,
            stdout=log_file, stderr=subprocess.STDOUT,
            timeout=14400,
        )

    elapsed = time.time() - t0
    return {
        "run_id": run_id,
        "exit_code": result.returncode,
        "elapsed_s": round(elapsed, 1),
        "log": str(log_path),
        "output_dir": str(out_dir),
    }


def is_completed(run: dict, project_dir: str) -> bool:
    """Treat an existing SQLite or SOCO export as completed, even if the CSV flag is stale."""
    if run.get("completed") == "True":
        return True
    out_dir = Path(project_dir) / run["system.path.output"]
    if not out_dir.exists():
        return False
    return (out_dir / "iLand_output.sqlite").exists() or any(out_dir.glob("*soco_stand_state.csv"))


def main():
    parser = argparse.ArgumentParser(description="Run iLandC simulations in parallel")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print commands without executing")
    parser.add_argument("--force", action="store_true",
                        help="Re-run even if already completed")
    parser.add_argument("--keep-raw", action="store_true",
                        help="Keep raw SQLite files after post-processing")
    parser.add_argument("--reference-only", action="store_true",
                        help="Run only the OAT reference scenario (for testing)")
    parser.add_argument("--config", default=None,
                        help="Path to config TOML (default: runner/config.toml)")
    parser.add_argument("--table", default=None,
                        help="Path to run_table CSV (default: runner/run_table.csv)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max number of pending runs to execute (for batching)")
    args = parser.parse_args()

    runner_dir  = Path(__file__).parent
    config_path = Path(args.config) if args.config else runner_dir / "config.toml"

    with open(config_path, "rb") as f:
        cfg = tomllib.load(f)

    ilandc_exe  = cfg["general"]["ilandc_exe"]
    project_dir = cfg["general"]["project_dir"]
    base_xml    = cfg["general"]["base_xml"]
    max_workers = cfg["threading"]["max_workers"]
    paths_cfg    = cfg.get("paths", {})
    table_path   = Path(args.table) if args.table else Path(project_dir) / paths_cfg.get("run_table", "runner/run_table.csv")
    log_dir      = Path(project_dir) / paths_cfg.get("log_dir", "runner/logs")
    status_dir   = Path(project_dir) / paths_cfg.get("status_dir", "runner/status")
    log_dir.mkdir(parents=True, exist_ok=True)
    status_dir.mkdir(parents=True, exist_ok=True)

    combined_dir = Path(project_dir) / paths_cfg.get("combined_dir", "output/_combined")
    combined_dir.mkdir(parents=True, exist_ok=True)

    # Read run table
    with open(table_path, "r") as f:
        reader = csv.DictReader(f)
        all_runs = list(reader)

    # Filter to reference-only if requested
    if args.reference_only:
        ref = cfg["experiment"].get("oat_reference", {})
        agent_map = cfg["experiment"]["agent_mapping"]
        ref_agg = agent_map.get(ref.get("aggregation", ""), "")
        ref_cl = ref.get("cluster", "").replace("CLUSTER", "CL")
        ref_condition = ref.get("condition", ref.get("disturbance", ""))
        ref_prefix = f"{ref_cl}_{ref_agg}_{ref_condition}_"
        all_runs = [r for r in all_runs if r["run_id"].startswith(ref_prefix)]
        print(f"Reference-only mode: filtered to {len(all_runs)} run(s) matching {ref_prefix}*")

    pending = [r for r in all_runs if args.force or not is_completed(r, project_dir)]
    if args.limit:
        pending = pending[:args.limit]
    print(f"Total runs: {len(all_runs)} | Pending: {len(pending)} | Workers: {max_workers}")
    print(f"Post-process: inline summaries | Decadal thinning: soco_stand_state | Keep raw: {args.keep_raw}")

    if not pending:
        print("Nothing to run.")
        return

    # --- Dry run mode ---
    if args.dry_run:
        print(f"\n=== DRY RUN — {len(pending)} commands ===\n")
        for run in pending:
            cmd_parts = [ilandc_exe, base_xml, run["sim_years"]]
            for key in OVERRIDE_KEYS:
                if key in run:
                    cmd_parts.append(f"{key}={run[key]}")
            print(f"[{run['run_id']}]")
            print(f"  cd {project_dir}")
            print(f"  {' '.join(cmd_parts)}")
            print()
        return

    # --- Parallel execution with inline post-processing ---
    completed_file = status_dir / "completed.txt"
    failed_file    = status_dir / "failed.txt"
    n_done = 0

    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        for i, run in enumerate(pending):
            sim_years = int(run["sim_years"])
            overrides = {k: run[k] for k in OVERRIDE_KEYS if k in run}
            if i > 0:
                time.sleep(STAGGER_DELAY)
            future = executor.submit(
                run_single, ilandc_exe, project_dir, base_xml,
                sim_years, run["run_id"], overrides, str(log_dir)
            )
            futures[future] = run

        for future in as_completed(futures):
            run = futures[future]
            run_id = run["run_id"]
            n_done += 1
            try:
                result = future.result()
                if result["exit_code"] == 0:
                    run_dir = Path(result["output_dir"])
                    post_process_run(run, run_dir, combined_dir,
                                     Path(project_dir), args.keep_raw)
                    with open(completed_file, "a") as f:
                        f.write(f"{run_id}  {datetime.now().isoformat()}\n")
                    print(f"[{n_done}/{len(pending)}] OK+PP  {run_id}  ({result['elapsed_s']}s)")
                else:
                    with open(failed_file, "a") as f:
                        f.write(f"{run_id}  {datetime.now().isoformat()}  exit={result['exit_code']}\n")
                    print(f"[{n_done}/{len(pending)}] FAIL(exit={result['exit_code']})  {run_id}  "
                          f"log: {result['log']}")
            except Exception as e:
                print(f"[{n_done}/{len(pending)}] ERROR  {run_id}: {e}")
                with open(failed_file, "a") as f:
                    f.write(f"{run_id}  {datetime.now().isoformat()}  ERROR: {e}\n")

    # Summary
    print(f"\nDone. Combined outputs: {combined_dir}")
    for f in sorted(combined_dir.glob("*.csv")):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
