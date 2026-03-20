#!/usr/bin/env Rscript
# =============================================================================
# Fig 03: Phase-Conditioned Ridge Plots
#   Within each phase, compare stand-state distributions across types.
#   4 metrics × 4 phases = 16-panel grid using ggridges.
#
# Run:  Rscript analysis_batch/scripts/fig_03_ridge_by_phase.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")
library(ggridges)

cat("=== Fig 03: Ridge Plots by Phase ===\n")
d <- load_all_data()

REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"
REF_DISTURBANCE <- "contbb"
REF_REPLICATE   <- 1

# --- Determine phase column ---
phase_col <- intersect(c("active_phase", "structural_phase", "current_phase"),
                       names(d$soco_state))[1]
cat(sprintf("  Using phase column: %s\n", phase_col))

# --- Filter: years 100-200, exclude set-aside, reference scenario ---
state_ref <- d$soco_state %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         disturbance == REF_DISTURBANCE,
         replicate == REF_REPLICATE,
         year >= 100) %>%
  rename(phase = !!phase_col)

if ("is_set_aside" %in% names(state_ref)) {
  state_ref <- state_ref %>% filter(is_set_aside == 0)
}

cat(sprintf("  Rows after filter: %d\n", nrow(state_ref)))

# --- Prepare data ---
state_ref <- state_ref %>%
  mutate(
    behavioral_type = factor(behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN")),
    phase = factor(phase,
      levels = c("Planting", "Tending", "Thinning", "Harvesting"))
  ) %>%
  filter(!is.na(phase))

# --- Check available metrics ---
metrics <- list()
if ("dbh_gini" %in% names(state_ref))
  metrics[["DBH Gini"]] <- "dbh_gini"
if ("volume" %in% names(state_ref))
  metrics[["Volume (m\u00b3/ha)"]] <- "volume"
if ("n_large_trees" %in% names(state_ref))
  metrics[["Large trees (n/ha)"]] <- "n_large_trees"
if ("n_height_layers" %in% names(state_ref))
  metrics[["Height layers"]] <- "n_height_layers"

cat(sprintf("  Metrics: %s\n", paste(names(metrics), collapse = ", ")))
stopifnot(length(metrics) >= 2)

# --- Build one ridge panel per metric ---
plot_list <- list()

for (i in seq_along(metrics)) {
  metric_label <- names(metrics)[i]
  metric_col <- metrics[[i]]

  plot_data <- state_ref %>%
    select(behavioral_type, phase, value = !!sym(metric_col)) %>%
    filter(!is.na(value))

  p <- ggplot(plot_data, aes(x = value, y = behavioral_type,
                              fill = behavioral_type)) +
    geom_density_ridges(alpha = 0.7, scale = 0.9, rel_min_height = 0.01,
                        linewidth = 0.3) +
    scale_fill_manual(values = btype_palette,
                      labels = btype_labels) +
    facet_wrap(~phase, nrow = 1, scales = "free_x") +
    labs(x = metric_label, y = NULL) +
    theme_soco(base_size = 9) +
    theme(legend.position = "none")

  plot_list[[i]] <- p
}

# --- Combine ---
p_combined <- wrap_plots(plot_list, ncol = 1) +
  plot_annotation(
    title = "Stand Structure by Phase and Owner Type",
    subtitle = paste(REF_LANDSCAPE, "/", REF_AGGREGATION, "/",
                     REF_DISTURBANCE, "/ rep", REF_REPLICATE,
                     "| years 100-200 | set-aside excluded")
  )

save_fig(p_combined, "fig_03_ridge_by_phase", width = 14, height = 14)
cat("=== Fig 03 complete ===\n")
