library(terra)
library(dplyr)
library(readr)

# ==============================================================================
# 1. PRE-PROCESS GRID (Generate Full 11km Landscape)
# ==============================================================================
# ==============================================================================
# 1. CLEAN PRE-PROCESSING (Respects Original Polygons)
# ==============================================================================
preprocess_grid_clean <- function(
    base_grid_path,
    env_csv_path,
    tree_csv_path,
    sapling_csv_path,
    output_dir
) {
  
  message("\n=== STARTING CLEAN STAND GENERATION (POLYGON PRESERVATION) ===")
  
  if (!dir.exists(output_dir)) dir.create(output_dir, recursive = TRUE)
  if (!file.exists(base_grid_path)) stop("Base grid file not found: ", base_grid_path)
  
  # 1. LOAD MASTER RASTER
  # We assume this raster already contains the CORRECT Stand IDs (The "Old Way" IDs)
  rs <- rast(base_grid_path)
  
  # 2. PRESERVE ORIGINAL IDs (Do not overwrite with a grid!)
  # We simply read the values. No "br * col" math.
  orig_vals <- values(rs)[,1]
  
  # Sanity Check: If your raster is float/decimal, we force integer
  # iLand requires Integer Stand IDs.
  if (!is.integer(orig_vals)) {
    message("Warning: Base raster is not Integer. forcing conversion...")
    orig_vals <- as.integer(orig_vals)
  }
  
  # 3. SAVE THE MAP (Pass-through)
  # We save exactly what we loaded. No re-gridding.
  stand_blocks_r <- rs[[1]]
  values(stand_blocks_r) <- orig_vals
  names(stand_blocks_r) <- "stand_id"
  
  out_raster_name <- file.path(output_dir, "stand_map_clean.asc")
  # Use INT4S to ensure iLand can read the IDs correctly
  writeRaster(stand_blocks_r, out_raster_name, overwrite = TRUE, datatype='INT4S', NAflag = -9999)
  message(sprintf("Clean Raster created: %s", out_raster_name))
  
  # 4. FILTER/UPDATE CSVs
  # Since we are keeping original IDs, we don't need a complex translation map.
  # We just need to ensure we only keep records for valid IDs (remove NAs).
  
  valid_ids <- unique(orig_vals[!is.na(orig_vals)])
  
  process_csv_clean <- function(path, id_col, out_name) {
    if (!file.exists(path)) return(NULL)
    
    df <- read_csv(path, show_col_types = FALSE)
    
    # Ensure ID column is integer
    df[[id_col]] <- as.integer(df[[id_col]])
    
    # Filter: Keep only rows that match a valid stand ID in the raster
    n_orig <- nrow(df)
    df_clean <- df %>% filter(!!sym(id_col) %in% valid_ids)
    n_new <- nrow(df_clean)
    
    out_path <- file.path(output_dir, out_name)
    
    # IMPORTANT: write_csv defaults to NO row names, preventing the "Shifted Column" bug
    write_csv(df_clean, out_path)
    message(sprintf("Processed %s: Kept %d / %d rows. Saved to %s", basename(path), n_new, n_orig, out_name))
  }
  
  process_csv_clean(env_csv_path, "id", "env_file_clean.csv")
  process_csv_clean(tree_csv_path, "stand_id", "tree2_clean.csv")
  process_csv_clean(sapling_csv_path, "stand_id", "sapling2_clean.csv")
  
  message("=== CLEAN PROCESSING COMPLETE ===\n")
  return(out_raster_name)
}

# ==============================================================================
# 2. SUBSET CREATION (Active Window Filtering)
# ==============================================================================
create_active_subset <- function(
    full_raster_path,
    full_tree_path,
    full_sapling_path,
    full_env_path, # <--- THIS ARGUMENT WAS MISSING IN YOUR FILE
    output_dir,
    landscape_meta
) {
  
  message("\n=== CREATING ACTIVE SUBSET (Trees/Saplings/Env) ===")
  
  # 1. Load Full Raster & Crop to Active Area
  if(!file.exists(full_raster_path)) stop("Full raster not found")
  
  r_full <- terra::rast(full_raster_path)
  
  # Define Crop Extent
  crop_ext <- terra::ext(
    landscape_meta$x, 
    landscape_meta$x + landscape_meta$width,
    landscape_meta$y, 
    landscape_meta$y + landscape_meta$height
  )
  
  message(sprintf("Cropping to window: x[%d-%d], y[%d-%d]", 
                  landscape_meta$x, landscape_meta$x + landscape_meta$width,
                  landscape_meta$y, landscape_meta$y + landscape_meta$height))
  
  r_active <- terra::crop(r_full, crop_ext)
  
  # 2. Identify Valid Stand IDs in the Active Area
  # We only want trees/env data for stands visible in this window
  active_ids <- unique(terra::values(r_active)[,1])
  active_ids <- active_ids[!is.na(active_ids)]
  
  message(sprintf("Found %d unique stands in the active window.", length(active_ids)))
  
  # 3. Filter Trees
  if(file.exists(full_tree_path)) {
    df_tree <- read_csv(full_tree_path, show_col_types = FALSE)
    n_orig <- nrow(df_tree)
    df_active <- df_tree %>% filter(stand_id %in% active_ids)
    n_new <- nrow(df_active)
    
    out_tree <- file.path(output_dir, "tree2_active.csv")
    write_csv(df_active, out_tree)
    message(sprintf("Trees: Filtered %d -> %d. Saved to %s", n_orig, n_new, basename(out_tree)))
  }
  
  # 4. Filter Saplings
  if(file.exists(full_sapling_path)) {
    df_sap <- read_csv(full_sapling_path, show_col_types = FALSE)
    n_orig <- nrow(df_sap)
    df_active <- df_sap %>% filter(stand_id %in% active_ids)
    n_new <- nrow(df_active)
    
    out_sap <- file.path(output_dir, "sapling2_active.csv")
    write_csv(df_active, out_sap)
    message(sprintf("Saplings: Filtered %d -> %d. Saved to %s", n_orig, n_new, basename(out_sap)))
  }
  
  # 5. Filter Environment (Crucial for avoiding crashes)
  if(file.exists(full_env_path)) {
    df_env <- read_csv(full_env_path, show_col_types = FALSE)
    n_orig <- nrow(df_env)
    # Ensure ID match
    df_env$id <- as.integer(df_env$id)
    
    df_active <- df_env %>% filter(id %in% active_ids)
    n_new <- nrow(df_active)
    
    out_env <- file.path(output_dir, "env_file_active.csv")
    write_csv(df_active, out_env)
    message(sprintf("Environment: Filtered %d -> %d. Saved to %s", n_orig, n_new, basename(out_env)))
  }
  
  return(list(raster=full_raster_path))
}
