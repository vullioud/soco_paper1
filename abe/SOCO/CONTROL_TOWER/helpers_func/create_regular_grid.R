library(terra)
library(dplyr)
library(readr)

# ==============================================================================
# CREATE REGULAR GRID FOR LEARNING DATABASE
# ==============================================================================
# This script creates a regular 2x2 cell stand grid for systematic experiments
#
# Grid specifications:
# - Total landscape: 40 x 40 cells = 4000m x 4000m
# - Cell size: 100m x 100m
# - Stand size: 2 x 2 cells = 200m x 200m = 4 hectares
# - Total stands: 20 x 20 = 400 stands
# - Stand IDs: 1 to 400 (sequential)
# ==============================================================================

#' Create a regular 2x2 block stand grid
#'
#' @param n_cells Number of cells per dimension (default 40 for 40x40)
#' @param block_size Number of cells per stand dimension (default 2 for 2x2 blocks)
#' @param cell_size Size of each cell in meters (default 100)
#' @param output_path Path to save the ASC file
#' @return A SpatRaster object with stand IDs
create_regular_stand_grid <- function(n_cells = 40,
                                      block_size = 2,
                                      cell_size = 100,
                                      output_path = NULL) {

  message(sprintf("\n=== Creating Regular Stand Grid ==="))
  message(sprintf("Landscape: %d x %d cells (%dm x %dm)",
                  n_cells, n_cells, n_cells*cell_size, n_cells*cell_size))
  message(sprintf("Stand size: %d x %d cells (%dm x %dm = %.1f ha)",
                  block_size, block_size,
                  block_size*cell_size, block_size*cell_size,
                  (block_size*cell_size)^2 / 10000))

  # Calculate number of stands per dimension
  n_stands_per_dim <- n_cells / block_size
  if (n_stands_per_dim != floor(n_stands_per_dim)) {
    stop("n_cells must be divisible by block_size!")
  }

  total_stands <- n_stands_per_dim^2
  message(sprintf("Total stands: %d x %d = %d stands",
                  n_stands_per_dim, n_stands_per_dim, total_stands))

  # Create empty matrix
  grid_matrix <- matrix(NA, nrow = n_cells, ncol = n_cells)

  # Fill with stand IDs (1 to 400)
  # CRITICAL: Fill from bottom-left to top-right to match iLand coordinate system
  # iLand uses: (0,0) at bottom-left, Y increases upward
  # Stand 1 should be at bottom-left, Stand 400 at top-right
  stand_id <- 1
  for (row_block in n_stands_per_dim:1) {  # REVERSED: start from top row (high y)
    for (col_block in 1:n_stands_per_dim) {  # left to right (low x to high x)
      # Calculate cell indices for this stand
      # Rows in matrix go from top (row 1) to bottom (row 40)
      # But we want stand 1 at bottom (high row indices in matrix)
      row_start <- (row_block - 1) * block_size + 1
      row_end <- row_block * block_size
      col_start <- (col_block - 1) * block_size + 1
      col_end <- col_block * block_size

      # Assign stand ID to all cells in this 2x2 block
      grid_matrix[row_start:row_end, col_start:col_end] <- stand_id
      stand_id <- stand_id + 1
    }
  }

  # Create SpatRaster - NO FLIPPING NEEDED NOW
  r <- rast(grid_matrix)

  # Set spatial properties
  ext(r) <- c(0, n_cells * cell_size, 0, n_cells * cell_size)
  names(r) <- "stand_id"

  # Validate
  unique_stands <- unique(values(r)[!is.na(values(r))])
  message(sprintf("✓ Created %d unique stands (IDs: %d to %d)",
                  length(unique_stands), min(unique_stands), max(unique_stands)))

  # Save if path provided
  if (!is.null(output_path)) {
    writeRaster(r, output_path, overwrite = TRUE, datatype = 'INT4S', NAflag = -9999)
    message(sprintf("✓ Saved to: %s", output_path))
  }

  return(r)
}


#' Create environment file for regular grid
#'
#' @param stand_raster SpatRaster with stand IDs
#' @param output_path Path to save CSV
#' @param default_climate Climate table name (default from existing data)
#' @return Data frame with environment data
create_environment_file <- function(stand_raster,
                                   output_path = NULL,
                                   default_climate = "ICHEC-EC-EARTH_historical_point37179") {

  message("\n=== Creating Environment File ===")

  # CRITICAL: iLand expects environment coordinates as CELL INDICES in the 100m grid
  # NOT metric coordinates!
  #
  # For a 40x40 landscape with 100m cells:
  # - Cell indices range from 0 to 39
  # - Each stand is 2x2 cells
  # - Stand 1 centroid is at cell (0.5, 0.5) → use cell index 0 or 1 for center
  #
  # Working example uses cell indices directly (e.g., x=19, y=68 for 110x110 grid)

  n_stands_per_row <- 20  # 40 cells / 2 cells per stand
  n_cells_per_stand <- 2  # 2x2 cells per stand

  # Create data frame with proper centroids
  env_records <- list()

  for (stand_id in 1:400) {
    # Calculate row and column of this stand (0-indexed)
    stand_row <- floor((stand_id - 1) / n_stands_per_row)  # 0 to 19
    stand_col <- (stand_id - 1) %% n_stands_per_row  # 0 to 19

    # Calculate centroid in CELL INDICES (not meters!)
    # Each stand spans 2 cells, so centroid is at +0.5 offset in cell units
    # For iLand, we use the cell index of the center (round to integer)
    x_cell <- stand_col * n_cells_per_stand + (n_cells_per_stand / 2) - 0.5  # e.g., 0.5, 2.5, 4.5, ... → round to 1, 3, 5, ...
    y_cell <- stand_row * n_cells_per_stand + (n_cells_per_stand / 2) - 0.5  # e.g., 0.5, 2.5, 4.5, ...

    # Round to nearest cell index
    x_cell <- round(x_cell)
    y_cell <- round(y_cell)

    env_records[[stand_id]] <- data.frame(
      id = stand_id,
      x = x_cell,
      y = y_cell,
      model.site.soilDepth = 120,
      model.site.pctSand = 30,
      model.site.pctClay = 24,
      model.site.pctSilt = 46,
      model.site.availableNitrogen = 65,
      model.climate.tableName = default_climate
    )
  }

  # Combine all records
  env_df <- bind_rows(env_records)

  message(sprintf("✓ Created environment data for %d stands", nrow(env_df)))

  if (!is.null(output_path)) {
    write_csv(env_df, output_path)
    message(sprintf("✓ Saved to: %s", output_path))
  }

  return(env_df)
}


#' Create template tree file for regular grid
#'
#' @param stand_ids Vector of stand IDs
#' @param output_path Path to save CSV
#' @param species Species code (default "fasy" = European beech)
#' @param base_age Base age for trees (default 60)
#' @return Data frame with tree data
create_template_tree_file <- function(stand_ids,
                                     output_path = NULL,
                                     species = "fasy",
                                     base_age = 60) {

  message("\n=== Creating Template Tree File ===")

  # Create a simple default structure for each stand
  # This creates 3 diameter classes per stand (small, medium, large trees)

  tree_records <- list()

  for (sid in stand_ids) {
    # Small trees: DBH 25-30 cm
    tree_records[[length(tree_records) + 1]] <- data.frame(
      stand_id = sid,
      species = species,
      count = 50,  # stems per hectare * 4 ha = 200 stems
      dbh_from = 25,
      dbh_to = 30,
      hd = 70,  # height/dbh ratio
      age = base_age,
      bwi_plot_id = sprintf("%d/1", sid),
      layer = "overstory"
    )

    # Medium trees: DBH 35-40 cm
    tree_records[[length(tree_records) + 1]] <- data.frame(
      stand_id = sid,
      species = species,
      count = 40,
      dbh_from = 35,
      dbh_to = 40,
      hd = 65,
      age = base_age,
      bwi_plot_id = sprintf("%d/1", sid),
      layer = "overstory"
    )

    # Large trees: DBH 45-50 cm
    tree_records[[length(tree_records) + 1]] <- data.frame(
      stand_id = sid,
      species = species,
      count = 30,
      dbh_from = 45,
      dbh_to = 50,
      hd = 60,
      age = base_age,
      bwi_plot_id = sprintf("%d/1", sid),
      layer = "overstory"
    )
  }

  tree_df <- bind_rows(tree_records)

  message(sprintf("✓ Created %d tree records for %d stands (3 diameter classes per stand)",
                  nrow(tree_df), length(stand_ids)))
  message(sprintf("  Species: %s, Base age: %d years", species, base_age))

  if (!is.null(output_path)) {
    write_csv(tree_df, output_path)
    message(sprintf("✓ Saved to: %s", output_path))
  }

  return(tree_df)
}


#' Create template sapling file for regular grid
#'
#' @param stand_ids Vector of stand IDs
#' @param output_path Path to save CSV
#' @param species Species code (default "fasy")
#' @return Data frame with sapling data
create_template_sapling_file <- function(stand_ids,
                                        output_path = NULL,
                                        species = "fasy") {

  message("\n=== Creating Template Sapling File ===")

  # Create sapling data for each stand
  # Using height classes typical for iLand

  sapling_records <- list()

  for (sid in stand_ids) {
    # Small saplings: 0.05-2m height
    sapling_records[[length(sapling_records) + 1]] <- data.frame(
      stand_id = sid,
      species = species,
      count = 2000,  # stems per hectare * 4 ha
      height_from = 0.05,
      height_to = 2.0,
      age = 5,
      bwi_plot_id = sprintf("%d/1", sid)
    )

    # Medium saplings: 2-4m height
    sapling_records[[length(sapling_records) + 1]] <- data.frame(
      stand_id = sid,
      species = species,
      count = 500,
      height_from = 2.0,
      height_to = 4.0,
      age = 10,
      bwi_plot_id = sprintf("%d/1", sid)
    )
  }

  sapling_df <- bind_rows(sapling_records)

  message(sprintf("✓ Created %d sapling records for %d stands (2 height classes per stand)",
                  nrow(sapling_df), length(stand_ids)))
  message(sprintf("  Species: %s", species))

  if (!is.null(output_path)) {
    write_csv(sapling_df, output_path)
    message(sprintf("✓ Saved to: %s", output_path))
  }

  return(sapling_df)
}


# ==============================================================================
# MAIN EXECUTION FUNCTION
# ==============================================================================

#' Generate complete regular grid landscape
#'
#' @param output_dir Directory to save all files
#' @param n_cells Number of cells per dimension (default 40)
#' @param block_size Cells per stand dimension (default 2)
#' @export
generate_regular_landscape <- function(output_dir = "../../../init",
                                      n_cells = 40,
                                      block_size = 2) {

  message("\n" %+% strrep("=", 70))
  message("GENERATING REGULAR GRID LANDSCAPE FOR LEARNING DATABASE")
  message(strrep("=", 70))

  # Create output directory
  if (!dir.exists(output_dir)) {
    dir.create(output_dir, recursive = TRUE)
    message(sprintf("Created output directory: %s", output_dir))
  }

  # 1. Create stand grid raster
  message("\n[Step 1/4] Creating stand grid raster...")
  stand_raster <- create_regular_stand_grid(
    n_cells = n_cells,
    block_size = block_size,
    output_path = file.path(output_dir, "stand_map_regular.asc")
  )

  # Get stand IDs
  stand_ids <- sort(unique(values(stand_raster)[!is.na(values(stand_raster))]))

  # 2. Create environment file
  message("\n[Step 2/4] Creating environment file...")
  env_df <- create_environment_file(
    stand_raster = stand_raster,
    output_path = file.path(output_dir, "env_file_regular.csv")
  )

  # 3. Create tree file
  message("\n[Step 3/4] Creating tree file...")
  tree_df <- create_template_tree_file(
    stand_ids = stand_ids,
    output_path = file.path(output_dir, "tree_regular.csv")
  )

  # 4. Create sapling file
  message("\n[Step 4/4] Creating sapling file...")
  sapling_df <- create_template_sapling_file(
    stand_ids = stand_ids,
    output_path = file.path(output_dir, "sapling_regular.csv")
  )

  message("\n" %+% strrep("=", 70))
  message("✓ COMPLETE! Regular grid landscape generated successfully.")
  message(strrep("=", 70))
  message(sprintf("\nFiles created in: %s", output_dir))
  message(sprintf("  - stand_map_regular.asc   (%d stands)", length(stand_ids)))
  message(sprintf("  - env_file_regular.csv    (%d records)", nrow(env_df)))
  message(sprintf("  - tree_regular.csv        (%d records)", nrow(tree_df)))
  message(sprintf("  - sapling_regular.csv     (%d records)", nrow(sapling_df)))

  return(list(
    raster = stand_raster,
    env = env_df,
    trees = tree_df,
    saplings = sapling_df
  ))
}

# String concatenation operator for cleaner messages
`%+%` <- function(a, b) paste0(a, b)
