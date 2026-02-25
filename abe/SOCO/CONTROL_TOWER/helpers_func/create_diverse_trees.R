library(dplyr)
library(readr)

#' Create diverse tree initialization by sampling from existing data
#'
#' @param stand_ids Vector of stand IDs (1-400)
#' @param source_tree_file Path to source tree CSV with real forest data
#' @param output_path Path to save new tree CSV
#' @return Data frame with diverse tree data
create_diverse_tree_file <- function(stand_ids,
                                     source_tree_file = NULL,
                                     output_path = NULL) {

  message("\n=== Creating Diverse Tree File ===")

  # If no source file, use working example
  if (is.null(source_tree_file)) {
    source_tree_file <- "../../../small_landscape_working_example/init/trees_CLUSTER10.csv"
  }

  # Read source data
  if (!file.exists(source_tree_file)) {
    stop(sprintf("Source tree file not found: %s", source_tree_file))
  }

  source_trees <- read_csv(source_tree_file, show_col_types = FALSE)
  message(sprintf("✓ Loaded source data: %d records from %d stands",
                  nrow(source_trees),
                  length(unique(source_trees$stand_id))))

  # Get unique source stands
  source_stand_ids <- unique(source_trees$stand_id)

  # Sample source stands for our 400 stands (with replacement)
  set.seed(42)  # Reproducible sampling
  sampled_sources <- sample(source_stand_ids, size = length(stand_ids), replace = TRUE)

  # Create mapping: new_stand_id -> source_stand_id
  stand_mapping <- data.frame(
    new_stand_id = stand_ids,
    source_stand_id = sampled_sources
  )

  # Build new tree records
  tree_records <- list()

  for (i in 1:nrow(stand_mapping)) {
    new_id <- stand_mapping$new_stand_id[i]
    source_id <- stand_mapping$source_stand_id[i]

    # Get all trees from this source stand
    source_stand_trees <- source_trees %>%
      filter(stand_id == source_id)

    if (nrow(source_stand_trees) > 0) {
      # Copy trees to new stand
      new_stand_trees <- source_stand_trees %>%
        mutate(
          stand_id = new_id,
          bwi_plot_id = sprintf("%d/1", new_id)
        )

      tree_records[[i]] <- new_stand_trees
    }
  }

  # Combine all records
  tree_df <- bind_rows(tree_records)

  message(sprintf("✓ Created %d tree records for %d stands",
                  nrow(tree_df), length(stand_ids)))
  message(sprintf("  - Species diversity: %d species",
                  length(unique(tree_df$species))))
  message(sprintf("  - Age range: %.0f to %.0f years",
                  min(tree_df$age), max(tree_df$age)))

  if (!is.null(output_path)) {
    write_csv(tree_df, output_path)
    message(sprintf("✓ Saved to: %s", output_path))
  }

  return(tree_df)
}


#' Create diverse sapling initialization by sampling from existing data
#'
#' @param stand_ids Vector of stand IDs (1-400)
#' @param source_sapling_file Path to source sapling CSV
#' @param output_path Path to save new sapling CSV
#' @return Data frame with diverse sapling data
create_diverse_sapling_file <- function(stand_ids,
                                        source_sapling_file = NULL,
                                        output_path = NULL) {

  message("\n=== Creating Diverse Sapling File ===")

  # If no source file, use working example
  if (is.null(source_sapling_file)) {
    source_sapling_file <- "../../../small_landscape_working_example/init/saplings_CLUSTER10.csv"
  }

  # Read source data
  if (!file.exists(source_sapling_file)) {
    stop(sprintf("Source sapling file not found: %s", source_sapling_file))
  }

  source_saplings <- read_csv(source_sapling_file, show_col_types = FALSE)
  message(sprintf("✓ Loaded source data: %d records from %d stands",
                  nrow(source_saplings),
                  length(unique(source_saplings$stand_id))))

  # Get unique source stands
  source_stand_ids <- unique(source_saplings$stand_id)

  # Sample source stands for our 400 stands (with replacement, same seed as trees)
  set.seed(42)  # Same seed as trees to maintain consistency
  sampled_sources <- sample(source_stand_ids, size = length(stand_ids), replace = TRUE)

  # Create mapping
  stand_mapping <- data.frame(
    new_stand_id = stand_ids,
    source_stand_id = sampled_sources
  )

  # Build new sapling records
  sapling_records <- list()

  for (i in 1:nrow(stand_mapping)) {
    new_id <- stand_mapping$new_stand_id[i]
    source_id <- stand_mapping$source_stand_id[i]

    # Get all saplings from this source stand
    source_stand_saplings <- source_saplings %>%
      filter(stand_id == source_id)

    if (nrow(source_stand_saplings) > 0) {
      # Copy saplings to new stand
      new_stand_saplings <- source_stand_saplings %>%
        mutate(
          stand_id = new_id,
          bwi_plot_id = sprintf("%d/1", new_id)
        )

      sapling_records[[i]] <- new_stand_saplings
    }
  }

  # Combine all records
  sapling_df <- bind_rows(sapling_records)

  message(sprintf("✓ Created %d sapling records for %d stands",
                  nrow(sapling_df), length(stand_ids)))
  message(sprintf("  - Species diversity: %d species",
                  length(unique(sapling_df$species))))

  if (!is.null(output_path)) {
    write_csv(sapling_df, output_path)
    message(sprintf("✓ Saved to: %s", output_path))
  }

  return(sapling_df)
}
