# ==============================================================================
# LANDSCAPE INIT — Generate Grid, Trees, Saplings, Env, Agent Tables
# ==============================================================================
# Run this script when changing the spatial layout.
# Does NOT generate behavioral config (activities, traits, params, species).
# Those live as authoritative JSON in abe/SOCO/config/tables/.
# ==============================================================================

# Set working directory to this folder
# setwd(dirname(rstudioapi::getActiveDocumentContext()$path))

# --- Load helpers ---
source("helpers/create_regular_grid.R")
source("helpers/create_diverse_init.R")
source("helpers/grid_helper.R")
source("helpers/init_grid_helper.R")

# --- Load scenario definitions ---
source("scenarios/grid_scenarios.R")

# --- Paths ---
init_dir   <- "../init"                          # iLand init files
stand_dir  <- "../abe/SOCO/stand_files"          # Agent CSV tables

# Source BWI data
source_trees <- file.path(init_dir, "trees_CLUSTER10.csv")
source_saps  <- file.path(init_dir, "saplings_CLUSTER10.csv")
source_env   <- file.path(init_dir, "env_file_CLUSTER10_REPL1_ICHEC-EC-EARTH_historical.csv")

# --- 1. Generate landscape raster (if not exists) ---
if (!file.exists(file.path(init_dir, "stand_map_regular.asc"))) {
    message("Generating regular grid landscape...")
    generate_regular_landscape(output_dir = init_dir, n_cells = 40, block_size = 2)
}

# --- 2. Load grid ---
library(terra)
stand_r <- rast(file.path(init_dir, "stand_map_regular.asc"))
valid_ids <- unique(values(stand_r, mat = FALSE))
valid_ids <- valid_ids[!is.na(valid_ids)]
message(sprintf("Loaded grid: %d stands", length(valid_ids)))

# --- 3. Generate agent allocation scenarios ---
landscape_owner_list <- list()
for (i in 1:nrow(scenarios_config)) {
    name <- scenarios_config$name[i]
    coeff <- scenarios_config$cluster_coeff[i]
    map_tbl <- cluster_stands_by_clustering(stand_r, props = target_proportions,
                                            cluster = coeff, seed = 7)
    landscape_owner_list[[name]] <- map_tbl %>% filter(stand_id %in% valid_ids)
}
# Homogeneous scenarios
landscape_owner_list[["state_only"]] <- cluster_stands_by_clustering(
    stand_r, props = c(0,1,0), cluster = 1, seed = 7) %>% filter(stand_id %in% valid_ids)
landscape_owner_list[["small_only"]] <- cluster_stands_by_clustering(
    stand_r, props = c(1,0,0), cluster = 1, seed = 7) %>% filter(stand_id %in% valid_ids)
landscape_owner_list[["big_only"]] <- cluster_stands_by_clustering(
    stand_r, props = c(0,0,1), cluster = 1, seed = 7) %>% filter(stand_id %in% valid_ids)

# --- 4. Export agent tables ---
export_agent_tables(landscape_owner_list, owner_params = agent_size_params,
                    shuffled = FALSE, out_dir = stand_dir)

# --- 5. Generate diverse forest init files ---
message("\n", strrep("=", 60))
message("GENERATING DIVERSE FOREST INITIALIZATION FILES")
message(strrep("=", 60))

# RANDOM MODE: One set of files, scenario-agnostic
generate_all_replicates(
    seeds              = 1:10,
    mode               = "random",
    output_dir         = file.path(init_dir, "random"),
    source_tree_csv    = source_trees,
    source_sapling_csv = source_saps,
    source_env_csv     = source_env
)

# MATCHED MODE: One set per clustering scenario
for (scenario_name in names(landscape_owner_list)) {
    generate_all_replicates(
        seeds              = 1:10,
        mode               = "matched",
        output_dir         = file.path(init_dir, paste0("matched_", scenario_name)),
        owner_map          = landscape_owner_list[[scenario_name]],
        source_tree_csv    = source_trees,
        source_sapling_csv = source_saps,
        source_env_csv     = source_env
    )
}

message("\nLandscape init complete.")
