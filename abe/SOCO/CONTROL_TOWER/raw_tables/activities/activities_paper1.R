# Paper 1: Activity distributions by behavioral_type and phase
# 20 rows: 5 types x 4 phases. These are own_ideal distributions (pre-guideline blend).

library(tidyverse)
library(jsonlite)

# Activity options per phase
harvesting_options <- c("shelterwood", "targetDBH", "clearcut", "plenter_harvest", "femel", "noManagement")
thinning_options   <- c("selectiveThinning", "fromBelow", "plenter_thinning", "noManagement")
tending_options    <- c("tending", "noManagement")
planting_options   <- c("planting", "noManagement")

activity_data <- tribble(
  ~type, ~phase,       ~options,            ~alpha,
  "MF",  "Harvesting", harvesting_options,  c(4, 3, 0, 3, 5, 0),
  "MF",  "Thinning",   thinning_options,    c(5, 3, 2, 0),
  "MF",  "Tending",    tending_options,     c(8, 2),
  "MF",  "Planting",   planting_options,    c(9, 1),

  "OP",  "Harvesting", harvesting_options,  c(2, 2, 7, 0, 1, 0),
  "OP",  "Thinning",   thinning_options,    c(3, 6, 0, 1),
  "OP",  "Tending",    tending_options,     c(6, 4),
  "OP",  "Planting",   planting_options,    c(9, 1),

  "TR",  "Harvesting", harvesting_options,  c(2, 1, 0, 0, 1, 6),
  "TR",  "Thinning",   thinning_options,    c(3, 2, 0, 5),
  "TR",  "Tending",    tending_options,     c(3, 7),
  "TR",  "Planting",   planting_options,    c(3, 7),

  "PA",  "Harvesting", harvesting_options,  c(0, 0, 0, 0, 0, 10),
  "PA",  "Thinning",   thinning_options,    c(0, 0, 0, 10),
  "PA",  "Tending",    tending_options,     c(0, 10),
  "PA",  "Planting",   planting_options,    c(0, 10),

  "EN",  "Harvesting", harvesting_options,  c(0, 3, 0, 3, 0, 6),
  "EN",  "Thinning",   thinning_options,    c(0, 0, 2, 8),
  "EN",  "Tending",    tending_options,     c(0, 10),
  "EN",  "Planting",   planting_options,    c(1, 9)
)

# Export to flat JSON: type -> phase -> {options, alpha}
export_activity_json_paper1 <- function(data, path) {
  dir_path <- dirname(path)
  if (!dir.exists(dir_path)) dir.create(dir_path, recursive = TRUE)

  json_tree <- list()
  for (i in seq_len(nrow(data))) {
    row <- data[i, ]
    type <- row$type
    phase <- row$phase
    if (is.null(json_tree[[type]])) json_tree[[type]] <- list()
    json_tree[[type]][[phase]] <- list(
      options = row$options[[1]],
      alpha = row$alpha[[1]]
    )
  }

  write_json(json_tree, path, auto_unbox = TRUE, pretty = TRUE)
  message(sprintf("Exported activity distributions to %s", path))
}
