# Batch Simulation Runner

Pipeline for running iLand + SoCoABE simulations across a One-At-a-Time (OAT) experimental design.

## Prerequisites

- **iLandC executable** — the console (headless) version of iLand
- **Python 3.11+** (or Python 3.9+ with `pip install tomli`)
- **Init files** in `init/` — environment, tree, and sapling CSVs for each cluster/aggregation/replicate
- **Agent tables** in `abe/SOCO/stand_files/` — one per aggregation level
- **Base XML** (`small_Ex.xml`) — the iLand project file at the project root

## Pipeline

### Step 0: Clean previous outputs (optional)

```bash
python runner/00_clean.py          # dry-run: shows what would be deleted
python runner/00_clean.py --confirm  # actually delete
```

Removes `output/_combined/`, individual run directories, `analysis_batch/data/*.csv`, runner logs, status files, and the run table. Recreates empty directories so the pipeline doesn't fail.

### Step 1: Generate the run table

```bash
python runner/01_generate_run_table.py
```

Reads `config.toml` and generates `runner/run_table.csv` — one row per simulation run with all iLand CLI overrides. Validates that init files and agent tables exist, warns on missing files.

For OAT designs, only the reference run plus runs that vary one factor at a time are generated (not the full factorial grid).

### Step 2: Run simulations in parallel

```bash
python runner/02_run_parallel.py
```

Launches iLandC processes in parallel. After each run completes, it **immediately post-processes** the output using `summarize.py` (extracts SQLite tables, computes diversity indices, merges SOCO CSVs into `output/_combined/`) and deletes the raw SQLite to save disk space.

**Flags:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Print the commands that would be executed, without running anything |
| `--force` | Re-run all simulations, even those already marked as completed |
| `--keep-raw` | Keep raw SQLite files after post-processing (default: delete them) |

Progress is tracked in `runner/status/`:
- `completed.txt` — successfully finished runs with timestamps
- `failed.txt` — failed runs with exit codes

Logs for each run are written to `runner/logs/{run_id}.log`.

### Step 3: Post-process (standalone)

```bash
python runner/03_post_process.py
```

Re-aggregates all completed runs into `output/_combined/`. Use this if you kept raw SQLite files (`--keep-raw`) and want to regenerate the combined CSVs, or if you ran simulations outside the pipeline.

**Note:** This clears existing combined CSVs before re-processing. Step 2 already does post-processing inline, so you only need Step 3 if re-aggregating.

### Summarize module

`runner/summarize.py` is a shared library used by Steps 2 and 3. It opens a single run's iLand SQLite database and computes:
- `stand_volume` — per-stand annual metrics (volume, BA, age, DBH, stems)
- `species_by_year_type` — species BA aggregated by behavioral type
- `species_by_year` — landscape-level species BA
- `stand_shannon` — per-stand Shannon H', Simpson 1-D, richness
- `stand_species_gini` — per-stand species evenness (1 - Gini)
- `landscape_diversity` — gamma/beta diversity
- `removal` — harvest and salvage volumes from `abeStandRemoval`
- `barkbeetle_yearly` — bark beetle statistics

## Configuration (`config.toml`)

```toml
[general]
project_dir = "C:/Users/you/Documents/SOCO_paper1"
ilandc_exe  = "C:/path/to/ilandc.exe"
base_xml    = "small_Ex.xml"
sim_years   = 200

[experiment]
design       = "oat"   # "factorial" or "oat"
clusters     = ["CLUSTER05", "CLUSTER10", "CLUSTER14"]
aggregations = ["matched_High", "matched_Random", "matched_state_only",
                "matched_small_only", "matched_big_only"]
replicate_start = 1
replicate_end   = 3

[experiment.oat_reference]
cluster     = "CLUSTER10"
aggregation = "matched_High"
disturbance = "contbb"
replicate   = 1

[experiment.agent_mapping]
matched_High       = "High"
matched_Random     = "Random"
matched_state_only = "state_only"
matched_small_only = "small_only"
matched_big_only   = "big_only"

# small_only/big_only reuse High's forest init (only agent table differs)
[experiment.init_override]
matched_small_only = "matched_High"
matched_big_only   = "matched_High"

[disturbance]
scenarios = ["contbb", "bb", "nod"]

[disturbance.params.contbb]
bb_enabled = "true"
disturbance_start_year = "0"
outbreak_probability = "0.001"
baseline_probability = "0.001"
background_infestation_probability = "0.001"

[disturbance.params.bb]
bb_enabled = "true"
disturbance_start_year = "100"
outbreak_probability = "0.0025"
baseline_probability = "0.000685"
background_infestation_probability = "0.000685"

[disturbance.params.nod]
bb_enabled = "false"
disturbance_start_year = "99999"
outbreak_probability = "0"
baseline_probability = "0"
background_infestation_probability = "0.00001"

[threading]
max_workers        = 11  # parallel ilandc processes (one per OAT run)
threads_per_worker = 2   # iLand internal threads per process
```

### Key parameters

| Section | Key | Description |
|---------|-----|-------------|
| `general` | `project_dir` | Absolute path to the project root |
| `general` | `ilandc_exe` | Path to the iLandC console executable |
| `general` | `base_xml` | iLand project XML file (relative to project root) |
| `general` | `sim_years` | Simulation length in years (currently 200) |
| `experiment` | `design` | `"oat"` (one-at-a-time) or `"factorial"` |
| `experiment` | `clusters` | List of landscape cluster directories in `init/` |
| `experiment` | `aggregations` | List of aggregation directories in `init/{cluster}/` |
| `experiment` | `replicate_start/end` | Range of replicate numbers |
| `experiment.oat_reference` | | Reference scenario (center point for OAT arms) |
| `experiment.agent_mapping` | `<dir> = <short>` | Maps directory names to short labels for run IDs and agent table filenames |
| `experiment.init_override` | `<dir> = <source_dir>` | Reuse another aggregation's forest init files (only agent table differs) |
| `disturbance` | `scenarios` | List of disturbance scenario names |
| `disturbance.params.<name>` | | iLand bark beetle parameters per scenario (injected as XML overrides) |
| `threading` | `max_workers` | Number of parallel iLandC processes |
| `threading` | `threads_per_worker` | iLand-internal threads per process |

## Experimental design

### OAT (One-At-a-Time)

The OAT design varies one factor at a time from a reference scenario, producing a minimal set of runs for sensitivity analysis.

**Reference:** CL10 / High / contbb / rep 1

| Arm | Varied factor | Levels | # runs |
|-----|---------------|--------|--------|
| Aggregation | Ownership layout | High, Random, state_only, small_only, big_only | 5 |
| Landscape | Forest landscape | CL05, CL10, CL14 | 3 (2 new + ref) |
| Disturbance | Bark beetle regime | contbb, bb, nod | 3 (2 new + ref) |
| Replicate | Stochastic init | rep 1, 2, 3 | 3 (2 new + ref) |
| **Total unique runs** | | | **11** |

Each run simulates 200 years.

### Customizing the experiment

**Add a landscape:** Add its `CLUSTER` directory name to `clusters`. Ensure `init/{cluster}/` contains matching aggregation subdirectories with env/tree/sapling files.

**Change aggregations:** Edit `aggregations` and `agent_mapping`. The mapping connects directory names (e.g., `matched_High`) to short labels (e.g., `High`) used for:
- Agent table lookup: `abe/SOCO/stand_files/agent_table_{short_name}_shuffled-false.csv`
- Run ID construction: `CL10_High_contbb_rep_001`

**Add init overrides:** If a new aggregation scenario shares forest init with an existing one (only the agent table differs), add it to `[experiment.init_override]`.

**Add disturbance scenarios:** Add a name to `disturbance.scenarios` and define its parameters in `[disturbance.params.<name>]`.

**Scale replicates:** Set `replicate_end` to the desired count. Each replicate uses a different seed for init files (`seed1`, `seed2`, etc.). The init files must already exist.

**Switch to factorial:** Set `design = "factorial"` to generate all combinations instead of OAT. Warning: 5 agg × 3 landscapes × 3 disturbances × 3 replicates = 135 runs.

**Adjust parallelism:** Set `max_workers` based on available CPU/RAM. Each iLandC process uses `threads_per_worker` internal threads, so total threads ≈ `max_workers × threads_per_worker`.

## Output structure

```
output/
├── CL10_High_contbb_rep_001/          # Per-run output directory
│   ├── iLand_output.sqlite            # Raw output (deleted unless --keep-raw)
│   └── CL10_High_contbb_rep_001_soco_*.csv   # SOCO agent outputs
├── CL10_Random_contbb_rep_001/
├── CL05_High_contbb_rep_001/
├── ...
└── _combined/                         # Aggregated analysis-ready CSVs
    ├── soco_stand_state.csv           # Annual stand metrics + structural phases
    ├── soco_ml_activities.csv         # Cognitive activity decisions per stand-year
    ├── soco_decade_budget.csv         # Agent budget per decade
    ├── soco_decade_snapshot.csv       # Stand planning status per decade
    ├── stand_volume.csv               # iLand abeStand (volume, BA, age, DBH)
    ├── removal.csv                    # Harvest and salvage volumes
    ├── species_by_year.csv            # Landscape-level species BA
    ├── species_by_year_type.csv       # Species BA by behavioral type
    ├── stand_shannon.csv              # Per-stand Shannon, Simpson, richness
    ├── stand_species_gini.csv         # Per-stand species evenness
    ├── landscape_diversity.csv        # Gamma/beta diversity indices
    └── barkbeetle_yearly.csv          # Bark beetle statistics
```

All combined CSVs have `run_id`, `landscape`, `aggregation`, `disturbance`, and `replicate` columns prepended for filtering.

## Analysis

Combined CSVs are copied to `analysis_batch/data/` for R analysis scripts. See `analysis_batch/scripts/` for the full batch analysis (OAT comparison plots) and `analysis/scripts/` for single-run analysis.
