#!/usr/bin/env Rscript
# =============================================================================
# 04_ownership_maps.R
#
# Produces a 5-panel ownership map figure showing the spatial arrangement of
# behavioral types across aggregation scenarios on a 20x20 stand grid.
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== 04 Ownership Maps ===\n")

# ---------------------------------------------------------------------------
# 1. Read env file and compute stand centroids
# ---------------------------------------------------------------------------
env <- read.csv(
  "init/CLUSTER10/base/rep_001/env_file_diverse_seed1.csv",
  stringsAsFactors = FALSE
)

# Each stand has 4 cells (2x2 at 100m resolution).
# Compute centroid per stand, then derive grid row/col position.
stand_grid <- env %>%
  group_by(id) %>%
  summarise(mean_x = mean(x), mean_y = mean(y), .groups = "drop") %>%
  mutate(
    grid_col = floor(mean_x / 2),
    grid_row = floor(mean_y / 2)
  ) %>%
  rename(stand_id = id)

cat(sprintf("  Grid: %d stands, cols 0-%d, rows 0-%d\n",
            nrow(stand_grid),
            max(stand_grid$grid_col),
            max(stand_grid$grid_row)))

# ---------------------------------------------------------------------------
# 2. For each aggregation, get stand -> behavioral_type from soco_stand_state
# ---------------------------------------------------------------------------
soco <- read.csv(
  file.path(DATA_DIR, "soco_stand_state.csv"),
  stringsAsFactors = FALSE
)

# Filter: CL10 landscape, contbb disturbance, replicate 1, year 10
btype_map <- soco %>%
  filter(
    landscape == "CL10",
    disturbance == "contbb",
    replicate == 1,
    year == 10
  ) %>%
  distinct(aggregation, stand_id, behavioral_type)

cat(sprintf("  Ownership mappings: %d rows across %d aggregations\n",
            nrow(btype_map),
            n_distinct(btype_map$aggregation)))

# ---------------------------------------------------------------------------
# 3. Join grid coordinates with behavioral type
# ---------------------------------------------------------------------------
plot_data <- btype_map %>%
  inner_join(stand_grid, by = "stand_id")

# Set factor levels for behavioral_type
plot_data$behavioral_type <- factor(
  plot_data$behavioral_type,
  levels = c("MF", "OP", "TR", "PA", "EN")
)

# Set factor levels for aggregation (panel order)
agg_order <- c("High", "Random", "state_only", "small_only", "big_only")
plot_data$aggregation <- factor(
  plot_data$aggregation,
  levels = agg_order,
  labels = agg_labels[agg_order]
)

cat(sprintf("  Plot data: %d rows\n", nrow(plot_data)))

# ---------------------------------------------------------------------------
# 4. Plot 5-panel ownership map
# ---------------------------------------------------------------------------
p <- ggplot(plot_data, aes(x = grid_col, y = grid_row, fill = behavioral_type)) +
  geom_tile(color = "white", linewidth = 0.15) +
  facet_wrap(~aggregation, nrow = 1) +
  scale_fill_manual(
    values = btype_palette,
    labels = btype_labels,
    name   = "Owner type",
    drop   = FALSE
  ) +
  coord_equal() +
  theme_soco() +
  theme(
    axis.title = element_blank(),
    axis.text  = element_blank(),
    axis.ticks = element_blank(),
    panel.grid = element_blank()
  )

# ---------------------------------------------------------------------------
# 5. Save figure
# ---------------------------------------------------------------------------
save_fig(p, "fig_ownership_maps", width = 16, height = 4)

cat("=== Done ===\n")
