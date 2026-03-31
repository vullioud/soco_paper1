# ==============================================================================
# LANDSCAPE INIT — Generate Grid, Trees, Saplings, Env, Agent Tables
# ==============================================================================
# Run this script when changing the spatial layout.
# Does NOT generate behavioral config (activities, traits, params, species).
# Those live as authoritative JSON in abe/SOCO/config/tables/.
# ==============================================================================

# Set working directory to this folder
if (requireNamespace("rstudioapi", quietly = TRUE) && rstudioapi::isAvailable()) {
  setwd(dirname(rstudioapi::getActiveDocumentContext()$path))
} else {
  # When run via Rscript, assume we're already in landscape_init/
  if (!file.exists("helpers/create_regular_grid.R")) {
    setwd("landscape_init")
  }
}

# --- Load helpers ---
source("helpers/create_regular_grid.R")
source("helpers/create_diverse_init.R")
source("helpers/grid_helper.R")
# --- Load scenario definitions ---
source("scenarios/grid_scenarios.R")

# --- Paths ---
init_dir   <- "../init"                          # iLand init files
stand_dir  <- "../abe/SOCO/stand_files"          # Agent CSV tables

# Source BWI landscapes (from init_german_landcape_rep/)
source_data_dir <- "init_german_landcape_rep"
# All 12 BWI landscape clusters
all_cluster_ids <- c("02","03","04","05","06","07","08","10","11","12","13","14")

# Climate scenarios: GCM + scenario combinations
# "historical" is the baseline; RCP variants use the same trees/saplings but different env files
climate_gcm <- "ICHEC-EC-EARTH"
climate_scenarios <- c("historical", "rcp_4_5", "rcp_8_5")

source_landscapes <- lapply(all_cluster_ids, function(cl_id) {
  cl_name <- paste0("CLUSTER", cl_id)
  list(
    name  = cl_name,
    trees = file.path(source_data_dir, paste0("trees_", cl_name, ".csv")),
    saps  = file.path(source_data_dir, paste0("saplings_", cl_name, ".csv")),
    env   = file.path(source_data_dir,
                      paste0("env_file_", cl_name, "_REPL0_", climate_gcm, "_historical.csv"))
  )
})

# Which ownership scenarios to export agent tables for.
# These differ only in who manages which stand; forest init is shared.
ownership_scenarios <- c("Random", "High", "state_only", "small_only", "big_only")

# Shared init folder name used by all aggregation scenarios in the runner.
base_init_name <- "base"

# --- 1. Generate landscape raster ---
message("Generating regular grid landscape...")
generate_regular_landscape(output_dir = init_dir, n_cells = 40, block_size = 2)

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

# --- 5. Generate diverse forest init files (per source landscape) ---
message("\n", strrep("=", 60))
message("GENERATING DIVERSE FOREST INITIALIZATION FILES")
message(strrep("=", 60))

for (landscape in source_landscapes) {
    lname <- landscape$name
    ldir  <- file.path(init_dir, lname)
    message(sprintf("\n>>> Source landscape: %s >>>", lname))

    # BASE MODE: One shared set of files per cluster/replicate.
    # Aggregation scenarios differ only by agent table, not by forest init.
    generate_all_replicates(
        seeds              = 1:10,
        mode               = "random",
        output_dir         = file.path(ldir, base_init_name),
        source_tree_csv    = landscape$trees,
        source_sapling_csv = landscape$saps,
        source_env_csv     = landscape$env
    )
}

# --- 6. Generate climate-variant env files (RCP scenarios) ---
# Trees and saplings are climate-independent — only env files change.
# Uses existing stand mappings from step 5 and swaps the source env file.
message("\n", strrep("=", 60))
message("GENERATING CLIMATE-VARIANT ENV FILES")
message(strrep("=", 60))

for (clim in climate_scenarios) {
    if (clim == "historical") next   # already generated in step 5
    message(sprintf("\n--- Climate scenario: %s ---", clim))

    for (landscape in source_landscapes) {
        lname <- landscape$name
        cl_id <- sub("CLUSTER", "", lname)

        # Source env for this climate scenario
        clim_env <- file.path(source_data_dir,
                              paste0("env_file_", lname, "_REPL0_", climate_gcm, "_", clim, ".csv"))
        if (!file.exists(clim_env)) {
            message(sprintf("  SKIP %s: source env not found (%s)", lname, clim_env))
            next
        }

        # Shared base mode
        regenerate_climate_env_all_replicates(
            seeds          = 1:10,
            source_env_csv = clim_env,
            climate_label  = clim,
            output_dir     = file.path(init_dir, lname, base_init_name)
        )
    }
}

message("\nLandscape init complete.")
