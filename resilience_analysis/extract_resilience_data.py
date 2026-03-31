#!/usr/bin/env python3
"""
Extract analysis-ready CSVs from combined runner outputs.

The extractor is config-driven so pilot and main resilience runs can write to
separate namespaces without overwriting one another.
"""

import argparse
import csv
import sys
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib


PROJECT_DIR = Path(__file__).parent.parent


def load_config(config_path: Path) -> dict:
    with open(config_path, "rb") as f:
        return tomllib.load(f)


def get_paths(cfg: dict) -> tuple[Path, Path, Path, int]:
    paths_cfg = cfg.get("paths", {})
    analysis_cfg = cfg.get("analysis", {})
    combined_dir = PROJECT_DIR / paths_cfg.get("combined_dir", "output/_combined")
    out_dir = PROJECT_DIR / paths_cfg.get("extracted_data_dir", "resilience_analysis/data")
    run_table = PROJECT_DIR / paths_cfg.get("run_table", "runner/run_table.csv")
    min_year = int(analysis_cfg.get("data_start_year", 1))
    return combined_dir, out_dir, run_table, min_year


def load_runs(run_table_path: Path) -> dict:
    runs = {}
    with open(run_table_path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            runs[row["run_id"]] = row
    return runs


def clear_output_dir(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in out_dir.glob("*.csv"):
        f.unlink()


def extract_run_manifest(runs: dict, out_dir: Path):
    out_path = out_dir / "run_manifest.csv"
    rows = []
    for run_id, row in sorted(runs.items()):
        rows.append({
            "run_id": run_id,
            "cluster": row.get("cluster", ""),
            "landscape": row.get("landscape", row.get("cluster", "").replace("CLUSTER", "CL")),
            "aggregation": row.get("aggregation", ""),
            "condition": row.get("condition", row.get("disturbance", "")),
            "climate": row.get("climate", ""),
            "replicate": row.get("replicate", ""),
            "completed": row.get("completed", ""),
        })
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"  run_manifest.csv  ({len(rows)} rows)")


def extract_landscape_metrics(valid_ids, combined_dir: Path, out_dir: Path, min_year: int):
    out_path = out_dir / "landscape_metrics.csv"
    vol_agg = {}
    vol_file = combined_dir / "stand_volume.csv"
    if not vol_file.exists():
        print(f"  SKIP landscape_metrics: {vol_file.name} not found")
        return

    with open(vol_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row["run_id"]
            if rid not in valid_ids:
                continue
            year = int(row["year"])
            if year < min_year:
                continue
            key = (rid, year)
            if key not in vol_agg:
                vol_agg[key] = {
                    "cluster": row.get("cluster", ""),
                    "landscape": row["landscape"],
                    "aggregation": row["aggregation"],
                    "condition": row.get("condition", row.get("disturbance", "")),
                    "climate": row.get("climate", "historical"),
                    "replicate": row["replicate"],
                    "sum_vol": 0.0,
                    "sum_ba": 0.0,
                    "sum_stems": 0.0,
                    "sum_area": 0.0,
                    "volumes": [],
                    "n_stands": 0,
                }
            a = vol_agg[key]
            area = float(row.get("area", 1))
            vol = float(row["volume"]) * area
            ba = float(row["basalarea"]) * area
            stems = float(row["stems"]) * area
            a["sum_vol"] += vol
            a["sum_ba"] += ba
            a["sum_stems"] += stems
            a["sum_area"] += area
            a["volumes"].append(float(row["volume"]))
            a["n_stands"] += 1

    struct_agg = {}
    soco_file = combined_dir / "soco_stand_state.csv"
    if soco_file.exists():
        with open(soco_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rid = row["run_id"]
                if rid not in valid_ids:
                    continue
                year = int(row["year"])
                if year < min_year:
                    continue
                key = (rid, year)
                if key not in struct_agg:
                    struct_agg[key] = {"sum_gini": 0.0, "sum_layers": 0.0,
                                       "sum_large": 0.0, "n": 0}
                s = struct_agg[key]
                s["sum_gini"] += float(row.get("dbh_gini", 0))
                s["sum_layers"] += float(row.get("n_height_layers", 0))
                s["sum_large"] += float(row.get("n_large_trees", 0))
                s["n"] += 1

    div_data = {}
    div_file = combined_dir / "landscape_diversity.csv"
    if div_file.exists():
        with open(div_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rid = row["run_id"]
                if rid not in valid_ids:
                    continue
                year = int(row["year"])
                if year < min_year:
                    continue
                div_data[(rid, year)] = {
                    "gamma_H": row.get("gamma_H", ""),
                    "gamma_richness": row.get("gamma_richness", ""),
                }

    conifers = {"piab", "abal", "pisy", "psme", "lade", "pice", "pini"}
    conifer_agg = {}
    sp_file = combined_dir / "species_by_year.csv"
    if sp_file.exists():
        with open(sp_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rid = row["run_id"]
                if rid not in valid_ids:
                    continue
                year = int(row["year"])
                if year < min_year:
                    continue
                key = (rid, year)
                if key not in conifer_agg:
                    conifer_agg[key] = {"conifer_ba": 0.0, "total_ba": 0.0}
                ba = float(row["total_ba"])
                conifer_agg[key]["total_ba"] += ba
                if row["species"] in conifers:
                    conifer_agg[key]["conifer_ba"] += ba

    header = [
        "run_id", "cluster", "landscape", "aggregation", "condition", "climate", "replicate", "year",
        "total_volume", "total_ba", "total_stems", "mean_volume", "cv_volume",
        "mean_dbh_gini", "mean_n_height_layers", "total_n_large_trees",
        "shannon_gamma", "conifer_ba_pct", "species_richness",
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for (rid, year), a in sorted(vol_agg.items()):
            n = a["n_stands"]
            mean_vol = sum(a["volumes"]) / n if n else 0
            if n > 1:
                var = sum((v - mean_vol) ** 2 for v in a["volumes"]) / (n - 1)
                sd_vol = var ** 0.5
            else:
                sd_vol = 0
            cv_vol = sd_vol / mean_vol if mean_vol > 0 else 0

            s = struct_agg.get((rid, year), {})
            sn = s.get("n", 0)
            mean_gini = s["sum_gini"] / sn if sn else ""
            mean_layers = s["sum_layers"] / sn if sn else ""
            total_large = s.get("sum_large", "")

            d = div_data.get((rid, year), {})
            c = conifer_agg.get((rid, year), {})
            con_pct = (c["conifer_ba"] / c["total_ba"] * 100) if c.get("total_ba", 0) > 0 else ""

            writer.writerow([
                rid, a["cluster"], a["landscape"], a["aggregation"], a["condition"], a["climate"], a["replicate"], year,
                round(a["sum_vol"], 2), round(a["sum_ba"], 2), round(a["sum_stems"], 0),
                round(mean_vol, 2), round(cv_vol, 4),
                round(mean_gini, 4) if mean_gini != "" else "",
                round(mean_layers, 2) if mean_layers != "" else "",
                round(total_large, 1) if total_large != "" else "",
                d.get("gamma_H", ""), round(con_pct, 2) if con_pct != "" else "",
                d.get("gamma_richness", ""),
            ])
    print(f"  landscape_metrics.csv  ({len(vol_agg)} rows)")


def extract_species_yearly(valid_ids, combined_dir: Path, out_dir: Path, min_year: int):
    src = combined_dir / "species_by_year.csv"
    dst = out_dir / "species_yearly.csv"
    if not src.exists():
        print(f"  SKIP species_yearly: {src.name} not found")
        return
    n = 0
    with open(src, "r", encoding="utf-8") as fin, open(dst, "w", newline="", encoding="utf-8") as fout:
        reader = csv.DictReader(fin)
        writer = csv.DictWriter(fout, fieldnames=reader.fieldnames)
        writer.writeheader()
        for row in reader:
            if row["run_id"] not in valid_ids:
                continue
            yr = int(row["year"])
            if yr < min_year or yr % 10 != 0:
                continue
            writer.writerow(row)
            n += 1
    print(f"  species_yearly.csv  ({n} rows, decadal)")


def extract_removal_summary(valid_ids, combined_dir: Path, out_dir: Path, min_year: int):
    src = combined_dir / "removal.csv"
    dst = out_dir / "removal_summary.csv"
    if not src.exists():
        print(f"  SKIP removal_summary: {src.name} not found")
        return

    agg = {}
    with open(src, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row["run_id"]
            if rid not in valid_ids:
                continue
            year = int(row["year"])
            if year < min_year:
                continue
            key = (rid, year)
            if key not in agg:
                agg[key] = {
                    "cluster": row.get("cluster", ""),
                    "landscape": row["landscape"],
                    "aggregation": row["aggregation"],
                    "condition": row.get("condition", row.get("disturbance", "")),
                    "climate": row.get("climate", "historical"),
                    "replicate": row["replicate"],
                    "vol_thinning": 0.0,
                    "vol_final": 0.0,
                    "vol_salvaged": 0.0,
                    "vol_disturbed": 0.0,
                }
            a = agg[key]
            a["vol_thinning"] += float(row.get("volumeThinning", 0))
            a["vol_final"] += float(row.get("volumeFinal", 0))
            a["vol_salvaged"] += float(row.get("volumeSalvaged", 0))
            a["vol_disturbed"] += float(row.get("volumeDisturbed", 0))

    header = ["run_id", "cluster", "landscape", "aggregation", "condition", "climate", "replicate", "year",
              "vol_thinning", "vol_final", "vol_salvaged", "vol_disturbed"]
    with open(dst, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for (rid, year), a in sorted(agg.items()):
            writer.writerow([
                rid, a["cluster"], a["landscape"], a["aggregation"], a["condition"], a["climate"], a["replicate"], year,
                round(a["vol_thinning"], 2), round(a["vol_final"], 2),
                round(a["vol_salvaged"], 2), round(a["vol_disturbed"], 2),
            ])
    print(f"  removal_summary.csv  ({len(agg)} rows)")


def extract_barkbeetle(valid_ids, combined_dir: Path, out_dir: Path, min_year: int):
    src = combined_dir / "barkbeetle_yearly.csv"
    dst = out_dir / "barkbeetle_summary.csv"
    if not src.exists():
        print(f"  SKIP barkbeetle_summary: {src.name} not found")
        return

    keep_cols = [
        "run_id", "cluster", "landscape", "aggregation", "condition", "disturbance",
        "climate", "replicate", "year", "killedVolume", "infestedArea_ha",
        "backgroundActivation_ha",
    ]
    n = 0
    with open(src, "r", encoding="utf-8") as fin, open(dst, "w", newline="", encoding="utf-8") as fout:
        reader = csv.DictReader(fin)
        out_fields = [c for c in keep_cols if c in reader.fieldnames]
        writer = csv.DictWriter(fout, fieldnames=out_fields, extrasaction="ignore")
        writer.writeheader()
        for row in reader:
            if row["run_id"] not in valid_ids:
                continue
            if int(row["year"]) < min_year:
                continue
            writer.writerow(row)
            n += 1
    print(f"  barkbeetle_summary.csv  ({n} rows, slimmed)")


def main():
    parser = argparse.ArgumentParser(description="Extract resilience analysis data")
    parser.add_argument("--config", default=str(PROJECT_DIR / "resilience_analysis" / "pilot" / "config.toml"),
                        help="Path to experiment TOML config")
    parser.add_argument("--run-table", default=None,
                        help="Override run_table path")
    args = parser.parse_args()

    cfg = load_config(Path(args.config))
    combined_dir, out_dir, run_table_path, min_year = get_paths(cfg)
    if args.run_table:
        run_table_path = PROJECT_DIR / args.run_table if not Path(args.run_table).is_absolute() else Path(args.run_table)

    if not combined_dir.exists():
        print(f"Combined directory not found: {combined_dir}")
        print("Run simulations first.")
        sys.exit(1)
    if not run_table_path.exists():
        print(f"Run table not found: {run_table_path}")
        sys.exit(1)

    clear_output_dir(out_dir)
    runs = load_runs(run_table_path)
    valid_ids = set(runs.keys())

    print(f"Filtering to {len(valid_ids)} run_ids from {run_table_path.name}")
    print(f"\nExtracting from {combined_dir} -> {out_dir}")

    extract_run_manifest(runs, out_dir)
    extract_landscape_metrics(valid_ids, combined_dir, out_dir, min_year)
    extract_species_yearly(valid_ids, combined_dir, out_dir, min_year)
    extract_removal_summary(valid_ids, combined_dir, out_dir, min_year)
    extract_barkbeetle(valid_ids, combined_dir, out_dir, min_year)

    print(f"\nDone. Output in {out_dir}/")
    total = sum(f.stat().st_size for f in out_dir.glob("*.csv"))
    print(f"  Total: {total / (1024 * 1024):.1f} MB")


if __name__ == "__main__":
    main()
