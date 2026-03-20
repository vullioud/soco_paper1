#!/usr/bin/env Rscript
# =============================================================================
# Fig 06: Landscape Heterogeneity — Means AND Variance
#   4 panels: mean volume, mean dbh_gini, CV volume, CV dbh_gini.
#   Compare aggregation scenarios (CL10, contbb).
#
# Run:  Rscript analysis_batch/scripts/fig_06_landscape_heterogeneity.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 06: Landscape Heterogeneity ===\n")
d <- load_all_data()

REF_LANDSCAPE   <- "CL10"
REF_DISTURBANCE <- "contbb"
REF_REPLICATE   <- 1

# --- Filter: aggregation arm ---
state <- d$soco_state %>%
  filter(landscape == REF_LANDSCAPE,
         disturbance == REF_DISTURBANCE,
         replicate == REF_REPLICATE)

cat(sprintf("  Rows: %d | Aggregations: %s\n", nrow(state),
            paste(unique(state$aggregation), collapse = ", ")))
stopifnot(nrow(state) > 0)

# --- Compute mean and CV per (year, aggregation) ---
stats_data <- state %>%
  group_by(year, aggregation) %>%
  summarise(
    mean_volume   = mean(volume, na.rm = TRUE),
    mean_dbh_gini = mean(dbh_gini, na.rm = TRUE),
    cv_volume     = sd(volume, na.rm = TRUE) /
                    mean(volume, na.rm = TRUE),
    cv_dbh_gini   = sd(dbh_gini, na.rm = TRUE) /
                    mean(dbh_gini, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  pivot_longer(
    cols = c(mean_volume, mean_dbh_gini,
             cv_volume, cv_dbh_gini),
    names_to = "metric",
    values_to = "value"
  ) %>%
  mutate(
    metric = factor(metric,
      levels = c("mean_volume", "cv_volume",
                 "mean_dbh_gini", "cv_dbh_gini"),
      labels = c("Mean Volume (m\u00b3/ha)",
                 "Volume CV",
                 "Mean DBH Gini",
                 "DBH Gini CV")),
    aggregation = factor(aggregation,
      levels = names(agg_colors))
  )

# --- Plot ---
p <- ggplot(stats_data,
            aes(x = year, y = value, color = aggregation)) +
  geom_line(linewidth = 0.6, alpha = 0.8) +
  scale_color_manual(values = agg_colors,
                     labels = agg_labels) +
  scale_x_continuous(breaks = seq(0, 200, 50)) +
  facet_wrap(~metric, nrow = 2, scales = "free_y") +
  labs(
    title = "Landscape Heterogeneity by Aggregation Scenario",
    subtitle = paste(
      REF_LANDSCAPE, "/", REF_DISTURBANCE,
      "/ rep", REF_REPLICATE,
      "| top = means, bottom = CV (sd/mean) across stands"
    ),
    x = "Year",
    y = NULL,
    color = "Aggregation"
  ) +
  theme_soco()

save_fig(p, "fig_06_landscape_heterogeneity", width = 14, height = 8)
cat("=== Fig 06 complete ===\n")
