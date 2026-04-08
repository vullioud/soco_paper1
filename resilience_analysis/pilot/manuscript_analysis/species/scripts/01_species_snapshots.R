suppressPackageStartupMessages({
  library(data.table)
  library(ggplot2)
})

DATA_IN <- file.path("resilience_analysis", "pilot", "data", "species_yearly.csv")
OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "species")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(TABLES_OUT, "*.csv"))
unlink(file.path(FIGURES_OUT, "*.png"))

normalize_aggregation <- function(x) {
  x <- as.character(x)
  needs_prefix <- !is.na(x) & nzchar(x) & !grepl("^matched_", x)
  x[needs_prefix] <- paste0("matched_", x[needs_prefix])
  x
}

message("=== Species snapshots ===")
message("This script creates simplified species snapshots with one shared baseline bar and one final bar per aggregation.")

species_yearly <- fread(DATA_IN)
species_yearly[, aggregation := normalize_aggregation(aggregation)]
species_yearly <- species_yearly[
  condition %in% c("control", "chronic", "outbreak") &
    year %in% c(10, 240)
]

species_yearly[, total_ba_sum := sum(total_ba, na.rm = TRUE), by = .(run_id, year)]
species_yearly[, ba_share := fifelse(total_ba_sum > 0, total_ba / total_ba_sum * 100, NA_real_)]

baseline_summary <- species_yearly[
  year == 10,
  .(
    mean_ba_share = mean(ba_share, na.rm = TRUE),
    sd_ba_share = sd(ba_share, na.rm = TRUE),
    n = sum(!is.na(ba_share))
  ),
  by = .(landscape, species)
]
baseline_summary[, bar_group := "start_y10"]
baseline_summary[, aggregation := "start_y10"]
baseline_summary[, year := 10L]

final_summary <- species_yearly[
  year == 240,
  .(
    mean_ba_share = mean(ba_share, na.rm = TRUE),
    sd_ba_share = sd(ba_share, na.rm = TRUE),
    n = sum(!is.na(ba_share))
  ),
  by = .(landscape, aggregation, species)
]
final_summary[, bar_group := aggregation]
final_summary[, year := 240L]

species_summary <- rbindlist(
  list(
    baseline_summary[, .(landscape, aggregation, bar_group, year, species, mean_ba_share, sd_ba_share, n)],
    final_summary[, .(landscape, aggregation, bar_group, year, species, mean_ba_share, sd_ba_share, n)]
  ),
  use.names = TRUE,
  fill = TRUE
)

top_species <- species_summary[, .(
  total_signal = sum(mean_ba_share, na.rm = TRUE)
), by = species][order(-total_signal)][1:8]

plot_df <- copy(species_summary)
plot_df[!species %in% top_species$species, species := "Other"]
plot_df <- plot_df[, .(
  mean_ba_share = sum(mean_ba_share, na.rm = TRUE)
), by = .(landscape, aggregation, bar_group, year, species)]

bar_levels <- c(
  "start_y10",
  "matched_High",
  "matched_Random",
  "matched_big_only",
  "matched_small_only",
  "matched_state_only"
)

bar_labels <- c(
  start_y10 = "Start",
  matched_High = "High",
  matched_Random = "Random",
  matched_big_only = "Big only",
  matched_small_only = "Small only",
  matched_state_only = "State only"
)

plot_df <- plot_df[bar_group %in% bar_levels]
plot_df[, bar_group := factor(bar_group, levels = bar_levels, labels = unname(bar_labels[bar_levels]))]
plot_df[, species := factor(species, levels = c(top_species$species, "Other"))]

fwrite(species_summary, file.path(TABLES_OUT, "species_snapshot_summary.csv"))
fwrite(top_species, file.path(TABLES_OUT, "species_snapshot_top_species.csv"))
fwrite(plot_df, file.path(TABLES_OUT, "species_snapshot_plot_data.csv"))

species_levels <- levels(plot_df$species)
species_palette <- setNames(
  grDevices::hcl.colors(length(species_levels), "Dynamic"),
  species_levels
)

overview_plot <- ggplot(
  plot_df,
  aes(x = bar_group, y = mean_ba_share, fill = species)
) +
  geom_col(position = "stack", width = 0.82) +
  facet_wrap(~ landscape, ncol = 2) +
  scale_fill_manual(values = species_palette, drop = FALSE) +
  labs(
    title = "Species composition: shared start and final aggregation snapshots",
    subtitle = "Start = year 10 mean across all runs; final = year 240 mean by aggregation",
    x = NULL,
    y = "Mean BA share (%)",
    fill = "Species"
  ) +
  theme_minimal(base_size = 10) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "species_snapshots_overview.png"),
  plot = overview_plot,
  width = 14,
  height = 10,
  dpi = 300
)

condition_plot_data <- function(target_condition) {
  baseline_cond <- species_yearly[
    year == 10 & condition == target_condition,
    .(
      mean_ba_share = mean(ba_share, na.rm = TRUE)
    ),
    by = .(landscape, species)
  ]
  baseline_cond[, `:=`(
    aggregation = "start_y10",
    bar_group = "start_y10",
    year = 10L,
    condition = target_condition
  )]

  final_cond <- species_yearly[
    year == 240 & condition == target_condition,
    .(
      mean_ba_share = mean(ba_share, na.rm = TRUE)
    ),
    by = .(landscape, aggregation, species)
  ]
  final_cond[, `:=`(
    bar_group = aggregation,
    year = 240L,
    condition = target_condition
  )]

  cond_df <- rbindlist(
    list(
      baseline_cond[, .(landscape, aggregation, bar_group, year, condition, species, mean_ba_share)],
      final_cond[, .(landscape, aggregation, bar_group, year, condition, species, mean_ba_share)]
    ),
    use.names = TRUE,
    fill = TRUE
  )

  cond_df[!species %in% top_species$species, species := "Other"]
  cond_df <- cond_df[, .(
    mean_ba_share = sum(mean_ba_share, na.rm = TRUE)
  ), by = .(landscape, aggregation, bar_group, year, condition, species)]
  cond_df <- cond_df[bar_group %in% bar_levels]
  cond_df[, bar_group := factor(bar_group, levels = bar_levels, labels = unname(bar_labels[bar_levels]))]
  cond_df[, species := factor(species, levels = c(top_species$species, "Other"))]
  cond_df
}

chronic_plot_df <- condition_plot_data("chronic")
control_plot_df <- condition_plot_data("control")
outbreak_plot_df <- condition_plot_data("outbreak")

fwrite(chronic_plot_df, file.path(TABLES_OUT, "species_snapshot_plot_data_chronic.csv"))
fwrite(control_plot_df, file.path(TABLES_OUT, "species_snapshot_plot_data_control.csv"))
fwrite(outbreak_plot_df, file.path(TABLES_OUT, "species_snapshot_plot_data_outbreak.csv"))

plot_control <- ggplot(
  control_plot_df,
  aes(x = bar_group, y = mean_ba_share, fill = species)
) +
  geom_col(position = "stack", width = 0.82) +
  facet_wrap(~ landscape, ncol = 2) +
  scale_fill_manual(values = species_palette, drop = FALSE) +
  labs(
    title = "Species composition snapshots: control runs only",
    subtitle = "Start = year 10 mean across control runs only; final = year 240 mean by aggregation",
    x = NULL,
    y = "Mean BA share (%)",
    fill = "Species"
  ) +
  theme_minimal(base_size = 10) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "species_snapshots_control.png"),
  plot = plot_control,
  width = 14,
  height = 10,
  dpi = 300
)

plot_chronic <- ggplot(
  chronic_plot_df,
  aes(x = bar_group, y = mean_ba_share, fill = species)
) +
  geom_col(position = "stack", width = 0.82) +
  facet_wrap(~ landscape, ncol = 2) +
  scale_fill_manual(values = species_palette, drop = FALSE) +
  labs(
    title = "Species composition snapshots: constant disturbance runs only",
    subtitle = "Start = year 10 mean across chronic runs only; final = year 240 mean by aggregation",
    x = NULL,
    y = "Mean BA share (%)",
    fill = "Species"
  ) +
  theme_minimal(base_size = 10) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "species_snapshots_chronic.png"),
  plot = plot_chronic,
  width = 14,
  height = 10,
  dpi = 300
)

plot_outbreak <- ggplot(
  outbreak_plot_df,
  aes(x = bar_group, y = mean_ba_share, fill = species)
) +
  geom_col(position = "stack", width = 0.82) +
  facet_wrap(~ landscape, ncol = 2) +
  scale_fill_manual(values = species_palette, drop = FALSE) +
  labs(
    title = "Species composition snapshots: outbreak runs only",
    subtitle = "Start = year 10 mean across outbreak runs only; final = year 240 mean by aggregation",
    x = NULL,
    y = "Mean BA share (%)",
    fill = "Species"
  ) +
  theme_minimal(base_size = 10) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "species_snapshots_outbreak.png"),
  plot = plot_outbreak,
  width = 14,
  height = 10,
  dpi = 300
)

for (landscape_name in sort(unique(as.character(plot_df$landscape)))) {
  land_df <- plot_df[landscape == landscape_name]

  plot_land <- ggplot(
    land_df,
    aes(x = bar_group, y = mean_ba_share, fill = species)
  ) +
    geom_col(position = "stack", width = 0.82) +
    scale_fill_manual(values = species_palette, drop = FALSE) +
    labs(
      title = paste("Species composition snapshots:", landscape_name),
      subtitle = "Start = year 10 mean across all runs; final = year 240 mean by aggregation",
      x = NULL,
      y = "Mean BA share (%)",
      fill = "Species"
    ) +
    theme_minimal(base_size = 11) +
    theme(axis.text.x = element_text(angle = 30, hjust = 1))

  ggsave(
    filename = file.path(FIGURES_OUT, paste0("species_snapshots_", landscape_name, ".png")),
    plot = plot_land,
    width = 11,
    height = 8,
    dpi = 300
  )
}

message("=== Species snapshots complete ===")
