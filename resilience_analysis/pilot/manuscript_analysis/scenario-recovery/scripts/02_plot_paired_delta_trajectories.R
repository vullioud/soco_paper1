suppressPackageStartupMessages({
  library(data.table)
  library(ggplot2)
})

PAIRED_LANDSCAPE_IN <- file.path("resilience_analysis", "pilot", "data", "paired_landscape_trajectories.csv")
PAIRED_SPECIES_IN <- file.path("resilience_analysis", "pilot", "data", "paired_species_yearly.csv")
OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "scenario-recovery")
DATA_OUT <- file.path(OUT_ROOT, "data")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(DATA_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

normalize_aggregation <- function(x) {
  x <- as.character(x)
  needs_prefix <- !is.na(x) & nzchar(x) & !grepl("^matched_", x)
  x[needs_prefix] <- paste0("matched_", x[needs_prefix])
  x
}

aggregation_label <- function(x) {
  out <- as.character(x)
  out[out == "matched_High"] <- "High"
  out[out == "matched_Random"] <- "Random"
  out[out == "matched_big_only"] <- "Big only"
  out[out == "matched_small_only"] <- "Small only"
  out[out == "matched_state_only"] <- "State only"
  out
}

condition_label <- function(x) {
  out <- as.character(x)
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

agg_colors <- c(
  "High" = "#1b9e77",
  "Random" = "#7570b3",
  "Big only" = "#d95f02",
  "Small only" = "#e7298a",
  "State only" = "#66a61e"
)

message("=== Scenario paired delta trajectories ===")
message("This script creates fig_M1-style collapsed treatment-minus-control trajectories with all runs shown faintly.")

paired_landscape <- fread(PAIRED_LANDSCAPE_IN)
paired_landscape[, aggregation := normalize_aggregation(aggregation)]
paired_landscape <- paired_landscape[condition %in% c("outbreak", "chronic")]
paired_landscape[, condition_plot := factor(
  condition_label(condition),
  levels = c("Outbreak", "Constant")
)]
paired_landscape[, aggregation_plot := factor(
  aggregation_label(aggregation),
  levels = c("High", "Random", "Big only", "Small only", "State only")
)]
paired_landscape[, run_uid := paste(landscape, aggregation, condition, replicate, sep = "_")]

delta_runs <- rbindlist(list(
  paired_landscape[, .(
    run_uid, landscape, aggregation, aggregation_plot, condition, condition_plot, replicate, year,
    metric = "Volume delta (m3)",
    value = delta_total_volume
  )],
  paired_landscape[, .(
    run_uid, landscape, aggregation, aggregation_plot, condition, condition_plot, replicate, year,
    metric = "DBH Gini delta",
    value = delta_mean_dbh_gini
  )],
  paired_landscape[, .(
    run_uid, landscape, aggregation, aggregation_plot, condition, condition_plot, replicate, year,
    metric = "Conifer share delta (pp)",
    value = delta_conifer_ba_pct
  )]
), use.names = TRUE, fill = TRUE)

metric_levels <- c("Volume delta (m3)", "DBH Gini delta", "Conifer share delta (pp)")
delta_runs[, metric := factor(metric, levels = metric_levels)]

delta_summary <- delta_runs[, .(
  mean_value = mean(value, na.rm = TRUE),
  sd_value = sd(value, na.rm = TRUE),
  n = sum(!is.na(value))
), by = .(aggregation_plot, condition_plot, year, metric)]

delta_summary[, se_value := fifelse(n > 1, sd_value / sqrt(n), 0)]
delta_summary[, ymin := mean_value - se_value]
delta_summary[, ymax := mean_value + se_value]
delta_summary_plot <- delta_summary[n > 0]

fwrite(delta_runs, file.path(DATA_OUT, "scenario_paired_delta_runs.csv"))
fwrite(delta_summary_plot, file.path(TABLES_OUT, "scenario_paired_delta_summary.csv"))

paired_species <- fread(PAIRED_SPECIES_IN)
paired_species[, aggregation := normalize_aggregation(aggregation)]
paired_species <- paired_species[condition %in% c("outbreak", "chronic")]
paired_species[, condition_plot := factor(
  condition_label(condition),
  levels = c("Outbreak", "Constant")
)]
paired_species[, aggregation_plot := factor(
  aggregation_label(aggregation),
  levels = c("High", "Random", "Big only", "Small only", "State only")
)]
paired_species[, run_uid := paste(landscape, aggregation, condition, replicate, sep = "_")]

paired_bray_runs <- paired_species[, .(
  metric = "Bray-Curtis to paired control",
  value = bray_curtis_two_vectors(
    species_vector(treatment_total_ba, species),
    species_vector(control_total_ba, species)
  )
), by = .(run_uid, landscape, aggregation, aggregation_plot, condition, condition_plot, replicate, year)]

paired_bray_summary <- paired_bray_runs[, .(
  mean_value = mean(value, na.rm = TRUE),
  sd_value = sd(value, na.rm = TRUE),
  n = sum(!is.na(value))
), by = .(aggregation_plot, condition_plot, year, metric)]

paired_bray_summary[, se_value := fifelse(n > 1, sd_value / sqrt(n), 0)]
paired_bray_summary[, ymin := mean_value - se_value]
paired_bray_summary[, ymax := mean_value + se_value]
paired_bray_summary_plot <- paired_bray_summary[n > 0]

fwrite(paired_bray_runs, file.path(DATA_OUT, "scenario_paired_bray_runs.csv"))
fwrite(paired_bray_summary_plot, file.path(TABLES_OUT, "scenario_paired_bray_summary.csv"))

make_delta_plot <- function(metric_name, file_name, title_text) {
  runs_metric <- delta_runs[metric == metric_name & is.finite(value)]
  summary_metric <- delta_summary_plot[metric == metric_name]
  sparse_metric <- identical(as.character(metric_name), "DBH Gini delta")

  p <- ggplot(summary_metric, aes(x = year, y = mean_value, color = aggregation_plot, fill = aggregation_plot)) +
    geom_hline(yintercept = 0, linewidth = 0.3, color = "grey45") +
    geom_line(
      data = runs_metric,
      aes(x = year, y = value, group = run_uid, color = aggregation_plot),
      alpha = 0.10,
      linewidth = 0.25,
      inherit.aes = FALSE,
      show.legend = FALSE
    ) +
    geom_ribbon(aes(ymin = ymin, ymax = ymax), alpha = 0.12, linewidth = 0) +
    geom_line(linewidth = 0.9) +
    geom_vline(xintercept = c(150, 160), linetype = "dashed", color = "grey50") +
    scale_color_manual(values = agg_colors, drop = FALSE) +
    scale_fill_manual(values = agg_colors, drop = FALSE) +
    scale_x_continuous(breaks = c(1, 10, 50, 100, 150, 160, 200, 240, 250)) +
    facet_wrap(~ condition_plot, ncol = 1, scales = "free_y") +
    labs(
      title = title_text,
      subtitle = if (sparse_metric) {
        "Treatment minus paired control; faint lines are runs, bold lines are means, ribbons are +/- SE; Gini is shown on observed structural years only"
      } else {
        "Treatment minus paired control; faint lines are runs, bold lines are means, ribbons are +/- SE"
      },
      x = "Year",
      y = NULL,
      color = "Aggregation",
      fill = "Aggregation"
    ) +
    theme_minimal(base_size = 11)

  if (sparse_metric) {
    p <- p + geom_point(size = 0.8, show.legend = FALSE)
  }

  ggsave(
    filename = file.path(FIGURES_OUT, file_name),
    plot = p,
    width = 11,
    height = 9.3,
    dpi = 300
  )
}

overview_plot <- ggplot(delta_summary_plot, aes(x = year, y = mean_value, color = aggregation_plot, fill = aggregation_plot)) +
  geom_hline(yintercept = 0, linewidth = 0.3, color = "grey45") +
  geom_line(
    data = delta_runs[is.finite(value)],
    aes(x = year, y = value, group = run_uid, color = aggregation_plot),
    alpha = 0.08,
    linewidth = 0.22,
    inherit.aes = FALSE,
    show.legend = FALSE
  ) +
  geom_ribbon(aes(ymin = ymin, ymax = ymax), alpha = 0.10, linewidth = 0) +
  geom_line(linewidth = 0.85) +
  geom_point(
    data = delta_summary_plot[metric == "DBH Gini delta"],
    size = 0.65,
    show.legend = FALSE
  ) +
  geom_vline(xintercept = c(150, 160), linetype = "dashed", color = "grey50") +
  scale_color_manual(values = agg_colors, drop = FALSE) +
  scale_fill_manual(values = agg_colors, drop = FALSE) +
  scale_x_continuous(breaks = c(1, 10, 50, 100, 150, 160, 200, 240, 250)) +
  facet_grid(metric ~ condition_plot, scales = "free_y") +
  labs(
    title = "Collapsed paired delta trajectories",
    subtitle = "Treatment minus paired control across outbreak and constant disturbance; Gini is plotted on observed structural years only",
    x = "Year",
    y = NULL,
    color = "Aggregation",
    fill = "Aggregation"
  ) +
  theme_minimal(base_size = 10) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "scenario_paired_delta_overview.png"),
  plot = overview_plot,
  width = 14,
  height = 10,
  dpi = 300
)

paired_bray_plot <- ggplot(
  paired_bray_summary_plot,
  aes(x = year, y = mean_value, color = aggregation_plot, fill = aggregation_plot)
) +
  geom_hline(yintercept = 0, linewidth = 0.3, color = "grey45") +
  geom_line(
    data = paired_bray_runs[is.finite(value)],
    aes(x = year, y = value, group = run_uid, color = aggregation_plot),
    alpha = 0.10,
    linewidth = 0.25,
    inherit.aes = FALSE,
    show.legend = FALSE
  ) +
  geom_ribbon(aes(ymin = ymin, ymax = ymax), alpha = 0.12, linewidth = 0) +
  geom_line(linewidth = 0.9) +
  geom_vline(xintercept = c(150, 160), linetype = "dashed", color = "grey50") +
  scale_color_manual(values = agg_colors, drop = FALSE) +
  scale_fill_manual(values = agg_colors, drop = FALSE) +
  scale_x_continuous(breaks = c(1, 10, 50, 100, 150, 160, 200, 240, 250)) +
  facet_wrap(~ condition_plot, ncol = 1, scales = "free_y") +
  labs(
    title = "Collapsed paired Bray-Curtis trajectories",
    subtitle = "Bray-Curtis distance between treatment and paired control species BA vectors; lower is more compositionally similar",
    x = "Year",
    y = NULL,
    color = "Aggregation",
    fill = "Aggregation"
  ) +
  theme_minimal(base_size = 11)

ggsave(
  filename = file.path(FIGURES_OUT, "scenario_paired_bray.png"),
  plot = paired_bray_plot,
  width = 11,
  height = 7.8,
  dpi = 300
)

make_delta_plot("Volume delta (m3)", "scenario_paired_delta_volume.png", "Collapsed paired volume trajectories")
make_delta_plot("DBH Gini delta", "scenario_paired_delta_gini.png", "Collapsed paired DBH Gini trajectories")
make_delta_plot("Conifer share delta (pp)", "scenario_paired_delta_conifer.png", "Collapsed paired conifer-share trajectories")

message("=== Scenario paired delta trajectories complete ===")
