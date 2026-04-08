suppressPackageStartupMessages({
  library(data.table)
  library(ggplot2)
})

LANDSCAPE_IN <- file.path("resilience_analysis", "pilot", "data", "landscape_metrics.csv")
SPECIES_IN <- file.path("resilience_analysis", "pilot", "data", "species_yearly.csv")
OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "scenario-recovery")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(TABLES_OUT, "scenario_recovery*.csv"))
unlink(file.path(FIGURES_OUT, "scenario_recovery*.png"))

normalize_aggregation <- function(x) {
  x <- as.character(x)
  needs_prefix <- !is.na(x) & nzchar(x) & !grepl("^matched_", x)
  x[needs_prefix] <- paste0("matched_", x[needs_prefix])
  x
}

condition_label <- function(x) {
  out <- as.character(x)
  out[out == "control"] <- "Control"
  out[out == "chronic"] <- "Constant"
  out[out == "outbreak"] <- "Outbreak"
  out
}

species_vector <- function(values, species) {
  if (!length(values)) {
    return(NULL)
  }
  tapply(values, species, sum, na.rm = TRUE)
}

bray_curtis_two_vectors <- function(a, b) {
  if (is.null(a)) a <- numeric()
  if (is.null(b)) b <- numeric()

  all_species <- union(names(a), names(b))
  if (!length(all_species)) {
    return(NA_real_)
  }

  vec_a <- numeric(length(all_species))
  vec_b <- numeric(length(all_species))
  names(vec_a) <- all_species
  names(vec_b) <- all_species

  if (length(a)) vec_a[names(a)] <- a
  if (length(b)) vec_b[names(b)] <- b

  denom <- sum(vec_a + vec_b)
  if (!is.finite(denom) || denom <= 0) {
    return(NA_real_)
  }

  sum(abs(vec_a - vec_b)) / denom
}

message("=== Scenario recovery plots ===")
message("This script creates descriptive recovery trajectories grouped by scenario.")

landscape_metrics <- fread(LANDSCAPE_IN)
landscape_metrics[, aggregation := normalize_aggregation(aggregation)]
landscape_metrics <- landscape_metrics[
  condition %in% c("control", "chronic", "outbreak") & year >= 140 & year <= 250
]

species_yearly <- fread(SPECIES_IN)
species_yearly[, aggregation := normalize_aggregation(aggregation)]
species_yearly <- species_yearly[
  condition %in% c("control", "chronic", "outbreak") & year >= 140 & year <= 250
]

trajectory_long <- rbindlist(list(
  landscape_metrics[, .(
    landscape, aggregation, condition, replicate, year,
    metric = "Landscape volume (m3)",
    value = total_volume
  )],
  landscape_metrics[, .(
    landscape, aggregation, condition, replicate, year,
    metric = "Landscape Shannon H'",
    value = shannon_gamma
  )],
  landscape_metrics[, .(
    landscape, aggregation, condition, replicate, year,
    metric = "Conifer BA share (%)",
    value = conifer_ba_pct
  )],
  landscape_metrics[, .(
    landscape, aggregation, condition, replicate, year,
    metric = "DBH Gini",
    value = mean_dbh_gini
  )],
  species_yearly[
    ,
    {
      baseline_vec <- species_vector(total_ba[year == 140], species[year == 140])
      years_present <- sort(unique(year))
      .(
        year = years_present,
        metric = "Bray-Curtis to year 140",
        value = vapply(
          years_present,
          function(target_year) {
            current_vec <- species_vector(total_ba[year == target_year], species[year == target_year])
            bray_curtis_two_vectors(baseline_vec, current_vec)
          },
          numeric(1)
        )
      )
    },
    by = .(run_id, landscape, aggregation, condition, replicate)
  ][, .(landscape, aggregation, condition, replicate, year, metric, value)]
), use.names = TRUE, fill = TRUE)

metric_levels <- c(
  "Landscape volume (m3)",
  "Landscape Shannon H'",
  "Conifer BA share (%)",
  "DBH Gini",
  "Bray-Curtis to year 140"
)

trajectory_long[, metric := factor(metric, levels = metric_levels)]
trajectory_long[, scenario := factor(
  condition_label(condition),
  levels = c("Control", "Constant", "Outbreak")
)]

trajectory_summary <- trajectory_long[, .(
  mean_value = mean(value, na.rm = TRUE),
  sd_value = sd(value, na.rm = TRUE),
  n = sum(!is.na(value))
), by = .(landscape, aggregation, year, metric, scenario)]

trajectory_summary[, se_value := fifelse(n > 1, sd_value / sqrt(n), 0)]
trajectory_summary[, ymin := mean_value - se_value]
trajectory_summary[, ymax := mean_value + se_value]

trajectory_collapsed <- trajectory_long[, .(
  mean_value = mean(value, na.rm = TRUE),
  sd_value = sd(value, na.rm = TRUE),
  n = sum(!is.na(value))
), by = .(aggregation, year, metric, scenario)]

trajectory_collapsed[, se_value := fifelse(n > 1, sd_value / sqrt(n), 0)]
trajectory_collapsed[, ymin := mean_value - se_value]
trajectory_collapsed[, ymax := mean_value + se_value]

trajectory_summary_plot <- trajectory_summary[n > 0]
trajectory_collapsed_plot <- trajectory_collapsed[n > 0]

fwrite(trajectory_summary_plot, file.path(TABLES_OUT, "scenario_recovery_summary.csv"))
fwrite(trajectory_collapsed_plot, file.path(TABLES_OUT, "scenario_recovery_collapsed_summary.csv"))

scenario_colors <- c(
  "Control" = "#4c78a8",
  "Constant" = "#f58518",
  "Outbreak" = "#54a24b"
)

common_subtitle <- paste(
  "Collapsed across landscapes and replicates;",
  "Bray-Curtis is distance to the year-140 species composition;",
  "structural metrics may be observed on a coarser time grid"
)

plot_collapsed <- ggplot(
  trajectory_collapsed_plot,
  aes(x = year, y = mean_value, color = scenario, fill = scenario)
) +
  geom_ribbon(aes(ymin = ymin, ymax = ymax), alpha = 0.12, linewidth = 0) +
  geom_line(linewidth = 0.85) +
  geom_point(
    data = trajectory_collapsed_plot[metric == "DBH Gini"],
    size = 0.7,
    show.legend = FALSE
  ) +
  geom_vline(xintercept = c(150, 160), linetype = "dashed", color = "grey50") +
  scale_color_manual(values = scenario_colors) +
  scale_fill_manual(values = scenario_colors) +
  scale_x_continuous(breaks = c(140, 150, 160, 180, 200, 220, 240, 250)) +
  facet_grid(metric ~ aggregation, scales = "free_y") +
  labs(
    title = "Scenario recovery trajectories by aggregation",
    subtitle = common_subtitle,
    x = "Year",
    y = NULL,
    color = "Scenario",
    fill = "Scenario"
  ) +
  theme_minimal(base_size = 10) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "scenario_recovery_collapsed.png"),
  plot = plot_collapsed,
  width = 16,
  height = 11.5,
  dpi = 300
)

for (agg_name in sort(unique(as.character(trajectory_summary_plot$aggregation)))) {
  agg_df <- trajectory_summary_plot[aggregation == agg_name]

  plot_agg <- ggplot(
    agg_df,
    aes(x = year, y = mean_value, color = scenario, fill = scenario)
  ) +
    geom_ribbon(aes(ymin = ymin, ymax = ymax), alpha = 0.12, linewidth = 0) +
    geom_line(linewidth = 0.85) +
    geom_point(
      data = agg_df[metric == "DBH Gini"],
      size = 0.7,
      show.legend = FALSE
    ) +
    geom_vline(xintercept = c(150, 160), linetype = "dashed", color = "grey50") +
    scale_color_manual(values = scenario_colors) +
    scale_fill_manual(values = scenario_colors) +
    scale_x_continuous(breaks = c(140, 150, 160, 180, 200, 220, 240, 250)) +
    facet_grid(metric ~ landscape, scales = "free_y") +
    labs(
      title = paste("Scenario recovery trajectories:", agg_name),
      subtitle = paste(
        "Colors show scenario; ribbons show mean +/- SE;",
        "DBH Gini is plotted only on observed structural years"
      ),
      x = "Year",
      y = NULL,
      color = "Scenario",
      fill = "Scenario"
    ) +
    theme_minimal(base_size = 10)

  ggsave(
    filename = file.path(FIGURES_OUT, paste0("scenario_recovery_", agg_name, ".png")),
    plot = plot_agg,
    width = 14,
    height = 11,
    dpi = 300
  )
}

message("=== Scenario recovery plots complete ===")
