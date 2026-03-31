"""Generate a run table from the experimental design in a TOML config.

Supports two designs:
  - "factorial": full cross of clusters x aggregations x conditions x climate scenarios
  - "oat": one-at-a-time — vary each dimension from a reference scenario
"""

import csv
import sys
from collections import Counter
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:          # Python < 3.11
    import tomli as tomllib           # pip install tomli


# Short labels for climate scenarios (used in run_id)
CLIMATE_SHORT = {
    "historical": "hist",
    "rcp_2_6":    "rcp26",
    "rcp_4_5":    "rcp45",
    "rcp_8_5":    "rcp85",
}


def get_condition_cfg(cfg):
    """Return the condition block, falling back to legacy disturbance configs."""
    return cfg.get("condition") or cfg.get("disturbance", {})


def oat_combinations(cfg):
    """Return set of (cluster, aggregation, condition, climate, replicate) tuples for OAT design.

    Arms, each varying one axis from the reference:
      1. Aggregation arm
      2. Landscape (cluster) arm
      3. Condition arm
      4. Climate arm
      5. Replicate arm
    """
    ref = cfg["experiment"]["oat_reference"]
    ref_condition = ref.get("condition", ref.get("disturbance"))
    ref_rep = ref.get("replicate", 1)
    ref_clim = ref.get("climate", "historical")
    rep_start = cfg["experiment"]["replicate_start"]
    rep_end = cfg["experiment"]["replicate_end"]
    climate_scenarios = cfg.get("climate", {}).get("scenarios", ["historical"])
    condition_cfg = get_condition_cfg(cfg)
    combos = set()
    # Arm 1: all aggregations × ref others
    for agg in cfg["experiment"]["aggregations"]:
        combos.add((ref["cluster"], agg, ref_condition, ref_clim, ref_rep))
    # Arm 2: all clusters × ref others
    for cl in cfg["experiment"]["clusters"]:
        combos.add((cl, ref["aggregation"], ref_condition, ref_clim, ref_rep))
    # Arm 3: all conditions × ref others
    for condition in condition_cfg["scenarios"]:
        combos.add((ref["cluster"], ref["aggregation"], condition, ref_clim, ref_rep))
    # Arm 4: all climate scenarios × ref others
    for clim in climate_scenarios:
        combos.add((ref["cluster"], ref["aggregation"], ref_condition, clim, ref_rep))
    # Arm 5: all replicates × ref others
    for rep in range(rep_start, rep_end + 1):
        combos.add((ref["cluster"], ref["aggregation"], ref_condition, ref_clim, rep))
    return combos


def factorial_combinations(cfg):
    """Return set of (cluster, aggregation, condition, climate, replicate) tuples for full factorial."""
    rep_start = cfg["experiment"]["replicate_start"]
    rep_end = cfg["experiment"]["replicate_end"]
    climate_scenarios = cfg.get("climate", {}).get("scenarios", ["historical"])
    condition_cfg = get_condition_cfg(cfg)
    combos = set()
    for cl in cfg["experiment"]["clusters"]:
        for agg in cfg["experiment"]["aggregations"]:
            for condition in condition_cfg["scenarios"]:
                for clim in climate_scenarios:
                    for rep in range(rep_start, rep_end + 1):
                        combos.add((cl, agg, condition, clim, rep))
    return combos


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate run_table.csv from experimental design")
    parser.add_argument("--config", default=str(Path(__file__).parent / "config.toml"),
                        help="Path to config TOML (default: runner/config.toml)")
    args = parser.parse_args()

    config_path = Path(args.config)
    with open(config_path, "rb") as f:
        cfg = tomllib.load(f)

    project_dir  = Path(cfg["general"]["project_dir"])
    sim_years    = cfg["general"]["sim_years"]
    agent_map    = cfg["experiment"]["agent_mapping"]
    init_override = cfg["experiment"].get("init_override", {})
    rep_start    = cfg["experiment"]["replicate_start"]
    rep_end      = cfg["experiment"]["replicate_end"]
    threads      = cfg["threading"]["threads_per_worker"]

    paths_cfg = cfg.get("paths", {})

    # Condition scenarios (legacy fallback: disturbance block)
    condition_cfg = get_condition_cfg(cfg)
    condition_params = condition_cfg.get("params", {})

    # Climate scenarios
    climate_cfg  = cfg.get("climate", {})
    climate_gcm  = climate_cfg.get("gcm", "ICHEC-EC-EARTH")
    climate_co2  = climate_cfg.get("co2", {})

    # Management override (e.g., nomanagement → management_enabled = false)
    mgmt_override = cfg["experiment"].get("management_override", {})

    # Design type
    design = cfg["experiment"].get("design", "factorial")
    if design == "oat":
        combos = oat_combinations(cfg)
    else:
        combos = factorial_combinations(cfg)

    init_dir = project_dir / "init"
    rows = []
    warnings = []

    # Cache: env file path -> most common climate table name (for BB reference climate)
    _bb_ref_cache = {}

    def get_bb_reference_climate(env_rel_path):
        """Find the most common climate point in the env file for this run."""
        env_path = init_dir / env_rel_path
        cache_key = str(env_path)
        if cache_key in _bb_ref_cache:
            return _bb_ref_cache[cache_key]
        if not env_path.exists():
            return None
        counts = Counter()
        with open(env_path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                counts[row["model.climate.tableName"]] += 1
        if not counts:
            return None
        most_common = counts.most_common(1)[0][0]
        _bb_ref_cache[cache_key] = most_common
        return most_common

    output_root = paths_cfg.get("output_root", "output")

    for cluster, agg, condition_label, clim_label, rep_num in sorted(combos):
        cl_short = cluster.replace("CLUSTER", "CL") if cluster else "ROOT"
        agg_short = agent_map[agg]                    # High, Random, state_only, ...
        clim_short = CLIMATE_SHORT.get(clim_label, clim_label)
        init_agg = init_override.get(agg, agg)
        cp = condition_params.get(condition_label, {})

        rep_str = f"rep_{rep_num:03d}"
        run_id  = f"{cl_short}_{agg_short}_{condition_label}_{clim_short}_{rep_str}"

        # --- Build init paths (using init_agg for forest files) ---
        rel_init = f"{cluster}/{init_agg}/{rep_str}" if cluster else f"{init_agg}/{rep_str}"
        abs_init = init_dir / rel_init

        if not abs_init.exists():
            warnings.append(f"MISSING init dir: {abs_init}")
            continue

        seed = rep_num

        # Env file: climate-specific name for non-historical
        if clim_label == "historical":
            env_filename = f"env_file_diverse_seed{seed}.csv"
        else:
            env_filename = f"env_file_diverse_seed{seed}_{clim_label}.csv"

        env_file     = f"init/{rel_init}/{env_filename}"
        tree_file    = f"{rel_init}/tree2_diverse_seed{seed}.csv"
        sapling_file = f"{rel_init}/sapling2_diverse_seed{seed}.csv"

        # Validate init files exist
        if not (init_dir / rel_init / env_filename).exists():
            warnings.append(f"MISSING env file: {env_file}")
        if not (init_dir / rel_init / f"tree2_diverse_seed{seed}.csv").exists():
            warnings.append(f"MISSING tree file: init/{tree_file}")

        agent_table  = f"abe/SOCO/stand_files/agent_table_{agg_short}_shuffled-false.csv"
        if not (project_dir / agent_table).exists():
            warnings.append(f"MISSING agent table: {agent_table}")

        output_path  = f"{output_root}/{run_id}"
        out_p = project_dir / output_path
        completed = (out_p / "iLand_output.sqlite").exists() or \
                    any(out_p.glob("*soco_stand_state.csv")) if out_p.exists() else False

        # BB reference climate: table name must exist in the active climate DB
        bb_ref = get_bb_reference_climate(f"{rel_init}/{env_filename}")
        if bb_ref is None:
            warnings.append(f"Could not determine BB reference climate for init/{rel_init}/{env_filename}")
        elif clim_label != "historical":
            # Transform table name to match the climate scenario's DB
            # e.g. ICHEC-EC-EARTH_historical_point39162 -> ICHEC-EC-EARTH_rcp_4_5_point39162
            bb_ref = bb_ref.replace("_historical_", f"_{clim_label}_")

        # --- Climate database and CO2 ---
        climate_db = f"climate_db_{climate_gcm}_{clim_label}_v4.sqlite"
        co2 = climate_co2.get(clim_label, 350)

        # --- Wind time events file (cluster + replicate specific) ---
        cl_num = cluster.replace("CLUSTER", "").lstrip("0") if cluster else "10"
        time_events_enabled = cp.get("time_events_enabled", "false")
        time_events_file = f"wind_Events/Scaled_cl{cl_num}_repl{rep_num}.txt"

        if time_events_enabled == "true":
            wind_file_abs = project_dir / "scripts" / time_events_file
            if not wind_file_abs.exists():
                warnings.append(f"MISSING wind events: {wind_file_abs}")

        rows.append({
            "run_id":       run_id,
            "cluster":      cluster,
            "landscape":    cl_short,
            "aggregation":  agg,
            "condition":    condition_label,
            "disturbance":  condition_label,
            "climate":      clim_label,
            "replicate":    rep_num,
            "sim_years":    sim_years,
            "completed":    completed,
            # iLand CLI overrides
            "system.path.output":                       output_path,
            "system.database.out":                      f"../{output_root}/{run_id}/iLand_output.sqlite",
            "system.database.climate":                  climate_db,
            "model.climate.co2concentration":            co2,
            "model.world.environmentFile":              env_file,
            "model.initialization.file":                tree_file,
            "model.initialization.saplingFile":         sapling_file,
            "model.management.abe.agentDataFile":       agent_table,
            "modules.barkbeetle.referenceClimate.tableName": bb_ref or "",
            "user.output_prefix":                       f"{run_id}_",
            "user.bb_enabled":                          cp.get("bb_enabled", "true"),
            "user.disturbance_start_year":              cp.get("disturbance_start_year", "100"),
            "user.outbreak_probability":                cp.get("outbreak_probability", "0.005"),
            "user.baseline_probability":                cp.get("baseline_probability", "0.000685"),
            "modules.barkbeetle.backgroundInfestationProbability": cp.get("background_infestation_probability", "0.000685"),
            "user.outbreak_start_year":                 cp.get("outbreak_start_year", ""),
            "user.outbreak_end_year":                   cp.get("outbreak_end_year", ""),
            "user.management_enabled":                  mgmt_override.get(agg, "true"),
            "model.world.timeEventsEnabled":            time_events_enabled,
            "model.world.timeEventsFile":               time_events_file,
            "system.settings.threadCount":              threads,
        })

    # --- Write CSV ---
    out_path = project_dir / paths_cfg.get("run_table", "runner/run_table.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else []
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Design: {design} | Generated {len(rows)} runs -> {out_path}")
    if design == "oat":
        ref = cfg["experiment"]["oat_reference"]
        ref_short = (ref["cluster"].replace("CLUSTER", "CL") + " x " +
                     agent_map[ref["aggregation"]] + " x " + ref.get("condition", ref.get("disturbance", "")) +
                     " x " + CLIMATE_SHORT.get(ref.get("climate", "historical"), "hist") +
                     " x rep_" + str(ref.get("replicate", 1)))
        print(f"  OAT reference: {ref_short}")
    for w in warnings:
        print(f"  WARNING: {w}", file=sys.stderr)
    if not rows:
        print("ERROR: no valid runs generated!", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
