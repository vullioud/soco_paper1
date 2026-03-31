"""Shared summary computation for iLand SQLite outputs.

Used by 02_run_parallel.py (inline post-processing) and
extract_batch_data.py (standalone re-extraction).

All functions work on a single run at a time.
"""

import csv
import math
import sqlite3
from collections import defaultdict
from pathlib import Path


# ---------------------------------------------------------------------------
# Stand -> behavioral_type mapping
# ---------------------------------------------------------------------------

def build_stand_btype_map(run_dir: Path, run_id: str,
                          project_dir: Path = None) -> dict:
    """Read SOCO stand state CSV to get {stand_id: behavioral_type}.

    Falls back to agent table if SOCO state is unavailable.
    """
    prefix = f"{run_id}_"
    stand_type = {}

    # Try SOCO stand state file (multiple possible locations)
    for candidate in [
        run_dir / f"{prefix}soco_stand_state.csv",
        run_dir / "soco_stand_state.csv",
    ]:
        if candidate.exists() and candidate.stat().st_size > 0:
            with open(candidate, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    stand_type[int(row["stand_id"])] = row["behavioral_type"]
            if stand_type:
                return stand_type

    # Fallback: agent table
    if project_dir is not None:
        # Parse aggregation from run_id
        parts = run_id.split("_")
        middle = parts[1:-2]
        climate_labels = {"hist", "rcp26", "rcp45", "rcp85"}
        condition_labels = {"bb", "nod", "contbb", "lowbb", "wind", "outbreak", "control", "nomanagement"}
        if middle and middle[-1] in climate_labels:
            middle = middle[:-1]
        if middle and middle[-1] in condition_labels:
            middle = middle[:-1]
        agg_short = "_".join(middle)

        agent_table = project_dir / f"abe/SOCO/stand_files/agent_table_{agg_short}_shuffled-false.csv"
        if agent_table.exists():
            owner_to_btype = {"state": "MF", "big": "OP", "small": "small"}
            with open(agent_table, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    stand_type[int(row["id"])] = owner_to_btype.get(
                        row["owner_type"], row["owner_type"])

    return stand_type


# ---------------------------------------------------------------------------
# SQLite summary computation
# ---------------------------------------------------------------------------

def summarize_sqlite(db_path: Path, stand_btype: dict) -> dict:
    """Open an iLand SQLite database and compute all analysis summaries.

    Returns a dict of lists-of-lists (rows without metadata prefix):
        {
            "stand_volume":        [[year, sid, uid, btype, area, vol, ba, age, th, dbh, stems], ...],
            "species_by_year_type": [[year, species, btype, total_ba, n_stands], ...],
            "species_by_year":     [[year, species, total_ba, n_stands], ...],
            "stand_shannon":       [[year, sid, btype, H, simpson, richness, total_ba], ...],
            "landscape_diversity": [[year, gamma_H, gamma_simp, gamma_rich, mean_alpha, beta, n_stands], ...],
            "removal":             [[year, uid, sid, btype, area, age, activity, vAfter, vThin, vFinal, vSalv, vDist], ...],
            "barkbeetle_yearly":   [[col1, col2, ...], ...],
            "barkbeetle_cols":     [col_name1, col_name2, ...],
        }
    """
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    results = {}

    # --- Build standid -> btype from available data ---
    try:
        cur.execute("SELECT DISTINCT standid FROM abeStand")
        all_sids = {r[0] for r in cur.fetchall()}
    except sqlite3.OperationalError:
        all_sids = set()
    sb = {sid: stand_btype.get(sid, "UNKNOWN") for sid in all_sids}

    # --- 1. stand_volume ---
    rows = []
    try:
        cur.execute("SELECT year, standid, unitid, area, volume, basalarea, "
                     "age, topHeight, dbh, stems FROM abeStand")
        for year, sid, uid, area, vol, ba, age, th, dbh, stems in cur:
            btype = sb.get(sid, "UNKNOWN")
            rows.append([year, sid, uid, btype, area,
                         round(vol, 2), round(ba, 4), age,
                         round(th, 2) if th else "",
                         round(dbh, 2) if dbh else "", stems])
    except sqlite3.OperationalError:
        pass
    results["stand_volume"] = rows

    # --- 2. species aggregation ---
    agg = defaultdict(lambda: {"total_ba": 0.0, "n_stands": 0})
    stand_species = defaultdict(lambda: defaultdict(float))
    try:
        cur.execute("SELECT year, species, standid, basalarea FROM abeStandDetail")
        for year, species, sid, ba in cur:
            btype = sb.get(sid, "UNKNOWN")
            ba_val = ba if ba else 0
            agg[(year, species, btype)]["total_ba"] += ba_val
            agg[(year, species, btype)]["n_stands"] += 1
            if ba_val > 0:
                stand_species[(sid, year)][species] += ba_val
    except sqlite3.OperationalError:
        pass

    # species_by_year_type
    rows = []
    for (year, species, btype), vals in sorted(agg.items()):
        rows.append([year, species, btype,
                     round(vals["total_ba"], 4), vals["n_stands"]])
    results["species_by_year_type"] = rows

    # species_by_year (landscape-level)
    agg_land = defaultdict(lambda: {"total_ba": 0.0, "n_stands": 0})
    for (year, species, _btype), vals in agg.items():
        agg_land[(year, species)]["total_ba"] += vals["total_ba"]
        agg_land[(year, species)]["n_stands"] += vals["n_stands"]
    rows = []
    for (year, species), vals in sorted(agg_land.items()):
        rows.append([year, species,
                     round(vals["total_ba"], 4), vals["n_stands"]])
    results["species_by_year"] = rows

    # --- 3. Alpha diversity (Shannon, Simpson, richness) ---
    rows = []
    gini_rows = []
    for (sid, year), sp_dict in stand_species.items():
        total = sum(sp_dict.values())
        if total > 0:
            proportions = [ba / total for ba in sp_dict.values() if ba > 0]
            H = -sum(p * math.log(p) for p in proportions)
            simpson_1D = 1.0 - sum(p * p for p in proportions)
            richness = len(proportions)
            btype = sb.get(sid, "UNKNOWN")
            rows.append([year, sid, btype, round(H, 4),
                         round(simpson_1D, 4), richness, round(total, 4)])

            # Species Gini evenness (1 - Gini; higher = more even)
            n = len(proportions)
            if n <= 1:
                evenness = 0.0
            else:
                p_sorted = sorted(proportions)
                gini = sum((2 * i - n - 1) * p_sorted[i - 1]
                           for i in range(1, n + 1)) / (n * sum(p_sorted))
                evenness = round(1.0 - abs(gini), 4)
            gini_rows.append([year, sid, btype, evenness])
    results["stand_shannon"] = rows
    results["stand_species_gini"] = gini_rows

    # --- 3b. Per-stand species shares (wide format) ---
    # One row per (standid, year), one column per species (BA share).
    # Reuses stand_species dict from step 2.
    all_species = sorted({sp for sp_dict in stand_species.values()
                          for sp in sp_dict})
    share_rows = []
    for (sid, year), sp_dict in sorted(stand_species.items()):
        total = sum(sp_dict.values())
        btype = sb.get(sid, "UNKNOWN")
        row = [year, sid, btype, round(total, 4)]
        for sp in all_species:
            ba = sp_dict.get(sp, 0.0)
            row.append(round(ba / total, 4) if total > 0 else 0)
        share_rows.append(row)
    results["stand_species_shares"] = share_rows
    results["stand_species_cols"] = all_species

    # --- 4. Gamma / beta diversity ---
    year_landscape_species = defaultdict(float)
    for (sid, year), sp_dict in stand_species.items():
        for species, ba in sp_dict.items():
            year_landscape_species[(year, species)] += ba

    years_with_data = sorted({y for (y, _) in year_landscape_species})
    rows = []
    for year in years_with_data:
        gamma_dict = {sp: ba for (y, sp), ba in year_landscape_species.items()
                      if y == year}
        gamma_total = sum(gamma_dict.values())
        if gamma_total <= 0:
            continue
        gamma_props = [ba / gamma_total for ba in gamma_dict.values() if ba > 0]
        gamma_H = -sum(p * math.log(p) for p in gamma_props)
        gamma_simpson = 1.0 - sum(p * p for p in gamma_props)
        gamma_richness = len(gamma_props)

        alpha_H_list = []
        for (sid, y), sp_dict in stand_species.items():
            if y != year:
                continue
            total = sum(sp_dict.values())
            if total > 0:
                props = [ba / total for ba in sp_dict.values() if ba > 0]
                alpha_H_list.append(-sum(p * math.log(p) for p in props))
        mean_alpha = (sum(alpha_H_list) / len(alpha_H_list)
                      if alpha_H_list else 0)
        beta = (gamma_H / mean_alpha) if mean_alpha > 0 else 0
        n_stands = len(alpha_H_list)

        rows.append([year, round(gamma_H, 4), round(gamma_simpson, 4),
                     gamma_richness, round(mean_alpha, 4),
                     round(beta, 4), n_stands])
    results["landscape_diversity"] = rows

    # --- 5. removal ---
    rows = []
    try:
        cur.execute("SELECT year, unitid, standid, area, age, activity, "
                     "volumeAfter, volumeThinning, volumeFinal, "
                     "volumeSalvaged, volumeDisturbed FROM abeStandRemoval")
        for row in cur:
            year, uid, sid, area, age, activity = row[:6]
            vAfter, vThin, vFinal, vSalv, vDist = row[6:]
            btype = sb.get(sid, "UNKNOWN")
            rows.append([year, uid, sid, btype, area, age,
                         activity if activity else "regular",
                         round(vAfter, 2), round(vThin, 2), round(vFinal, 2),
                         round(vSalv, 2), round(vDist, 2)])
    except sqlite3.OperationalError:
        pass
    results["removal"] = rows

    # --- 6. barkbeetle ---
    bb_rows = []
    bb_cols = []
    try:
        cur.execute("SELECT * FROM barkbeetle")
        bb_cols = [d[0] for d in cur.description]
        for r in cur.fetchall():
            bb_rows.append([round(v, 4) if isinstance(v, float) else v
                           for v in r])
    except sqlite3.OperationalError:
        pass
    results["barkbeetle_yearly"] = bb_rows
    results["barkbeetle_cols"] = bb_cols

    # --- 7. wind ---
    wind_rows = []
    wind_cols = []
    try:
        cur.execute("SELECT * FROM wind")
        wind_cols = [d[0] for d in cur.description]
        for r in cur.fetchall():
            wind_rows.append([round(v, 4) if isinstance(v, float) else v
                             for v in r])
    except sqlite3.OperationalError:
        pass
    results["wind_yearly"] = wind_rows
    results["wind_cols"] = wind_cols

    con.close()
    return results


# ---------------------------------------------------------------------------
# CSV headers (same as analysis_batch/data/ format)
# ---------------------------------------------------------------------------

HEADERS = {
    "stand_volume": [
        "run_id", "cluster", "landscape", "aggregation", "condition", "disturbance", "climate", "replicate",
        "year", "standid", "unitid", "behavioral_type", "area",
        "volume", "basalarea", "age", "topHeight", "dbh", "stems",
    ],
    "species_by_year_type": [
        "run_id", "cluster", "landscape", "aggregation", "condition", "disturbance", "climate", "replicate",
        "year", "species", "behavioral_type", "total_ba", "n_stands",
    ],
    "species_by_year": [
        "run_id", "cluster", "landscape", "aggregation", "condition", "disturbance", "climate", "replicate",
        "year", "species", "total_ba", "n_stands",
    ],
    "stand_shannon": [
        "run_id", "cluster", "landscape", "aggregation", "condition", "disturbance", "climate", "replicate",
        "year", "standid", "behavioral_type", "shannon_H",
        "simpson_1D", "richness", "total_ba",
    ],
    "landscape_diversity": [
        "run_id", "cluster", "landscape", "aggregation", "condition", "disturbance", "climate", "replicate",
        "year", "gamma_H", "gamma_simpson", "gamma_richness",
        "mean_alpha_H", "beta_whittaker", "n_stands",
    ],
    "removal": [
        "run_id", "cluster", "landscape", "aggregation", "condition", "disturbance", "climate", "replicate",
        "year", "unitid", "standid", "behavioral_type", "area", "age",
        "activity", "volumeAfter", "volumeThinning", "volumeFinal",
        "volumeSalvaged", "volumeDisturbed",
    ],
    "stand_species_gini": [
        "run_id", "cluster", "landscape", "aggregation", "condition", "disturbance", "climate", "replicate",
        "year", "standid", "behavioral_type", "species_evenness",
    ],
}
