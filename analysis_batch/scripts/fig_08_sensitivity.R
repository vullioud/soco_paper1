#!/usr/bin/env Rscript
# =============================================================================
# Fig 08: Sensitivity Summary
#   Which OAT axis (aggregation, landscape, disturbance) produces the most
#   variance in endpoint metrics?
#   Heatmap: rows = metrics, columns = OAT arms, fill = CV.
#
# Run:  Rscript analysis_batch/scripts/fig_08_sensitivity.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 08: Sensitivity Summary ===\n")
d <- load_all_data()

# =============================================================================
# Compute endpoint means (years 150-200) per scenario
# =============================================================================

# --- Stand-level metrics ---
endpoint <- d$soco_state %>%
  filter(year >= 150) %>%
  # Exclude set-aside for structural metrics
  { if ("is_set_aside" %in% names(.)) filter(., is_set_aside == 0) else . }

# Compute landscape-level means per scenario
scenario_metrics <- endpoint %>%
  group_by(landscape, aggregation, disturbance, replicate) %>%
  summarise(
    mean_volume     = mean(volume, na.rm = TRUE),
    mean_dbh_gini   = mean(dbh_gini, na.rm = TRUE),
    mean_large_trees = mean(n_large_trees, na.rm = TRUE),
    cv_volume       = sd(volume, na.rm = TRUE) / mean(volume, na.rm = TRUE),
    .groups = "drop"
  )

# --- Shannon diversity endpoint ---
if (nrow(d$shannon) > 0) {
  shan_endpoint <- d$shannon %>%
    filter(year >= 150) %>%
    group_by(landscape, aggregation, disturbance, replicate) %>%
    summarise(
      mean_shannon = mean(shannon_H, na.rm = TRUE),
      .groups = "drop"
    )
  scenario_metrics <- scenario_metrics %>%
    left_join(shan_endpoint,
              by = c("landscape", "aggregation", "disturbance", "replicate"))
}

cat(sprintf("  Scenario metrics: %d rows × %d cols\n",
            nrow(scenario_metrics), ncol(scenario_metrics)))

# =============================================================================
# Compute CV across scenarios within each OAT arm
# =============================================================================

metric_cols <- c("mean_volume", "mean_dbh_gini", "mean_large_trees", "cv_volume")
if ("mean_shannon" %in% names(scenario_metrics))
  metric_cols <- c(metric_cols, "mean_shannon")

# Nice labels
metric_labels <- c(
  mean_volume      = "Volume",
  mean_dbh_gini    = "Structural\ncomplexity\n(DBH Gini)",
  mean_large_trees = "Large trees",
  cv_volume        = "Landscape\nheterogeneity\n(volume CV)",
  mean_shannon     = "Species\ndiversity\n(Shannon)"
)

arms <- list(
  Aggregation = list(
    filter_fn = function(df) df %>%
      filter(landscape == "CL10", disturbance == "contbb", replicate == 1),
    var = "aggregation"
  ),
  Landscape = list(
    filter_fn = function(df) df %>%
      filter(aggregation == "High", disturbance == "contbb", replicate == 1),
    var = "landscape"
  ),
  Disturbance = list(
    filter_fn = function(df) df %>%
      filter(landscape == "CL10", aggregation == "High", replicate == 1),
    var = "disturbance"
  )
)

sensitivity <- data.frame()

for (arm_name in names(arms)) {
  arm <- arms[[arm_name]]
  arm_data <- arm$filter_fn(scenario_metrics)

  if (nrow(arm_data) < 2) next

  for (mc in metric_cols) {
    vals <- arm_data[[mc]]
    vals <- vals[!is.na(vals)]
    if (length(vals) < 2 || mean(vals) == 0) next

    cv <- sd(vals) / abs(mean(vals))
    sensitivity <- rbind(sensitivity, data.frame(
      arm = arm_name,
      metric = mc,
      cv = cv,
      n_scenarios = length(vals)
    ))
  }
}

cat(sprintf("  Sensitivity table: %d rows\n", nrow(sensitivity)))

# --- Labels ---
sensitivity <- sensitivity %>%
  mutate(
    metric_label = factor(metric,
      levels = names(metric_labels),
      labels = metric_labels[names(metric_labels) %in% metric]),
    arm = factor(arm, levels = c("Aggregation", "Landscape", "Disturbance"))
  )

# =============================================================================
# PLOT: Heatmap
# =============================================================================

p <- ggplot(sensitivity,
            aes(x = arm, y = metric_label, fill = cv)) +
  geom_tile(color = "white", linewidth = 1.5) +
  geom_text(aes(label = sprintf("%.2f", cv)), color = "black", size = 4) +
  scale_fill_gradient2(low = "#f7fbff", mid = "#6baed6", high = "#08306b",
                       midpoint = median(sensitivity$cv, na.rm = TRUE)) +
  labs(
    title = "Sensitivity Summary: CV Across OAT Scenarios",
    subtitle = "Higher CV = metric more sensitive to that experimental axis | endpoint years 150-200",
    x = "Experimental axis",
    y = "Metric",
    fill = "CV"
  ) +
  theme_soco(base_size = 12) +
  theme(
    panel.grid = element_blank(),
    axis.text.y = element_text(size = 10),
    legend.position = "right"
  )

save_fig(p, "fig_08_sensitivity", width = 10, height = 7)

# =============================================================================
# Also: bar chart version for easier reading
# =============================================================================

p2 <- ggplot(sensitivity,
             aes(x = arm, y = cv, fill = arm)) +
  geom_col(alpha = 0.8, width = 0.7) +
  scale_fill_manual(values = c(Aggregation = "#e41a1c",
                                Landscape = "#377eb8",
                                Disturbance = "#4daf4a")) +
  facet_wrap(~metric_label, nrow = 1, scales = "free_y") +
  labs(
    title = "Sensitivity by Experimental Axis",
    subtitle = "CV of endpoint metric across scenarios within each OAT arm",
    x = NULL,
    y = "CV (coefficient of variation)",
    fill = "Axis"
  ) +
  theme_soco() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

save_fig(p2, "fig_08_sensitivity_bars", width = 14, height = 6)

cat("=== Fig 08 complete ===\n")
