# ==============================================================================
# Generate climate-variant env files only (RCP scenarios)
# Standalone version of step 6 from generate_grid.R
# ==============================================================================

if (requireNamespace("rstudioapi", quietly = TRUE) && rstudioapi::isAvailable()) {
  setwd(dirname(rstudioapi::getActiveDocumentContext()$path))
} else {
  if (!file.exists("helpers/create_regular_grid.R")) {
    setwd("landscape_init")
  }
}

source("helpers/create_diverse_init.R")

# --- Config ---
init_dir        <- "../init"
source_data_dir <- "init_german_landcape_rep"

climate_gcm <- "ICHEC-EC-EARTH"
climate_scenarios <- c("rcp_4_5", "rcp_8_5")
base_init_name <- "base"

all_cluster_ids <- c("02","03","04","05","06","07","08","10","11","12","13","14")

message("\n", strrep("=", 60))
message("GENERATING CLIMATE-VARIANT ENV FILES")
message(strrep("=", 60))

for (clim in climate_scenarios) {
    message(sprintf("\n--- Climate scenario: %s ---", clim))

    for (cl_id in all_cluster_ids) {
        cl_name <- paste0("CLUSTER", cl_id)

        clim_env <- file.path(source_data_dir,
                              paste0("env_file_", cl_name, "_REPL0_", climate_gcm, "_", clim, ".csv"))
        if (!file.exists(clim_env)) {
            message(sprintf("  SKIP %s: source env not found (%s)", cl_name, clim_env))
            next
        }

        # Shared base mode
        regenerate_climate_env_all_replicates(
            seeds          = 1:10,
            source_env_csv = clim_env,
            climate_label  = clim,
            output_dir     = file.path(init_dir, cl_name, base_init_name)
        )
    }
}

message("\nClimate env generation complete.")
