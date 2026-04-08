suppressPackageStartupMessages({
  library(data.table)
  library(ggplot2)
})

OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "management")
DATA_IN <- file.path(OUT_ROOT, "data", "management_activity_run_window.csv")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(TABLES_OUT, "*.csv"))
unlink(file.path(FIGURES_OUT, "*.png"))

message("=== Management activity analysis ===")
message("This script summarizes realized activity distributions and outbreak post-disturbance decisions.")

activity_dt <- fread(DATA_IN)
activity_dt[, landscape := factor(landscape)]
activity_dt[, aggregation := factor(aggregation)]
activity_dt[, period := factor(period, levels = c("baseline", "pulse", "recovery", "post_disturbance"))]

activity_distribution_all <- activity_dt[, .(
  total_events = sum(n_events),
  mean_per_run = mean(n_events),
  n_runs = .N
), by = .(condition, aggregation, period, activity_name)]
activity_distribution_all[, share_of_all_events := {
  denom <- sum(total_events)
  if (denom > 0) total_events / denom else rep(NA_real_, .N)
}, by = .(condition, aggregation, period)]

activity_distribution_active <- activity_dt[
  is_active == TRUE,
  .(
    total_events = sum(n_events),
    mean_per_run = mean(n_events),
    n_runs = .N
  ),
  by = .(condition, aggregation, period, activity_name)
]
activity_distribution_active[, share_of_active_events := {
  denom <- sum(total_events)
  if (denom > 0) total_events / denom else rep(NA_real_, .N)
}, by = .(condition, aggregation, period)]

outbreak_post_activity_distribution <- activity_distribution_active[
  condition == "outbreak" & period %in% c("pulse", "recovery", "post_disturbance")
]

outbreak_post_regeneration <- activity_dt[
  condition == "outbreak" &
    period %in% c("pulse", "recovery", "post_disturbance") &
    is_regeneration_decision == TRUE,
  .(
    total_events = sum(n_events),
    mean_per_run = mean(n_events),
    n_runs = .N
  ),
  by = .(aggregation, period, activity_name)
]
outbreak_post_regeneration[, share_within_regeneration := {
  denom <- sum(total_events)
  if (denom > 0) total_events / denom else rep(NA_real_, .N)
}, by = .(aggregation, period)]

outbreak_post_planting_totals <- activity_dt[
  condition == "outbreak" &
    period %in% c("pulse", "recovery", "post_disturbance"),
  .(
    total_planting_events = sum(n_events[is_planting_related == TRUE]),
    mean_planting_events_per_run = sum(n_events[is_planting_related == TRUE]) / uniqueN(run_id),
    total_salvage_events = sum(n_events[is_salvage_related == TRUE]),
    mean_salvage_events_per_run = sum(n_events[is_salvage_related == TRUE]) / uniqueN(run_id),
    total_active_events = sum(n_events[is_active == TRUE]),
    mean_active_events_per_run = sum(n_events[is_active == TRUE]) / uniqueN(run_id),
    n_runs = uniqueN(run_id)
  ),
  by = .(aggregation, period)
]

outbreak_post_planting_runlevel <- activity_dt[
  condition == "outbreak" &
    period %in% c("pulse", "recovery", "post_disturbance"),
  .(
    planting_events = sum(n_events[is_planting_related == TRUE]),
    salvage_events = sum(n_events[is_salvage_related == TRUE]),
    active_events = sum(n_events[is_active == TRUE])
  ),
  by = .(aggregation, period, run_id, landscape, replicate_uid, replicate)
]

fwrite(activity_distribution_all, file.path(TABLES_OUT, "management_activity_distribution_all.csv"))
fwrite(activity_distribution_active, file.path(TABLES_OUT, "management_activity_distribution_active.csv"))
fwrite(outbreak_post_activity_distribution, file.path(TABLES_OUT, "outbreak_post_activity_distribution.csv"))
fwrite(outbreak_post_regeneration, file.path(TABLES_OUT, "outbreak_post_regeneration_distribution.csv"))
fwrite(outbreak_post_planting_totals, file.path(TABLES_OUT, "outbreak_post_planting_totals.csv"))
fwrite(outbreak_post_planting_runlevel, file.path(TABLES_OUT, "outbreak_post_planting_runlevel.csv"))

outbreak_post_plot <- copy(outbreak_post_activity_distribution[period == "post_disturbance"])
outbreak_post_plot[, activity_name := reorder(activity_name, -mean_per_run)]

plot_outbreak_post_share <- ggplot(
  outbreak_post_plot,
  aes(x = aggregation, y = share_of_active_events, fill = activity_name)
) +
  geom_col(position = "fill", width = 0.82) +
  scale_y_continuous(labels = function(x) paste0(round(x * 100), "%")) +
  labs(
    title = "Outbreak post-disturbance activity mix",
    subtitle = "Active activities only; pulse and recovery combined",
    x = "Aggregation",
    y = "Share of active events",
    fill = "Activity"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_post_activity_mix_active.png"),
  plot = plot_outbreak_post_share,
  width = 13,
  height = 7,
  dpi = 300
)

outbreak_post_heatmap <- copy(outbreak_post_plot)
outbreak_post_heatmap[, activity_name := reorder(activity_name, mean_per_run)]

plot_outbreak_post_heatmap <- ggplot(
  outbreak_post_heatmap,
  aes(x = aggregation, y = activity_name, fill = mean_per_run)
) +
  geom_tile(color = "white", linewidth = 0.2) +
  scale_fill_gradient(low = "#f2efe8", high = "#3e5f73") +
  labs(
    title = "Outbreak post-disturbance activity intensity",
    subtitle = "Mean active events per run; pulse and recovery combined",
    x = "Aggregation",
    y = "Activity",
    fill = "Mean per run"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_post_activity_heatmap.png"),
  plot = plot_outbreak_post_heatmap,
  width = 12,
  height = 8,
  dpi = 300
)

planting_plot_dt <- copy(outbreak_post_planting_totals)

plot_outbreak_post_planting <- ggplot(
  planting_plot_dt,
  aes(x = aggregation, y = mean_planting_events_per_run, fill = period)
) +
  geom_col(position = position_dodge(width = 0.75), width = 0.68) +
  labs(
    title = "Outbreak planting activity after disturbance",
    subtitle = "Planting-related activities: clearcut_planting, shelterwood_planting, femel_planting, planting",
    x = "Aggregation",
    y = "Mean planting events per run",
    fill = "Window"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_post_planting_totals.png"),
  plot = plot_outbreak_post_planting,
  width = 12,
  height = 7,
  dpi = 300
)

plot_outbreak_post_planting_runs <- ggplot(
  outbreak_post_planting_runlevel,
  aes(x = aggregation, y = planting_events, color = period)
) +
  geom_jitter(width = 0.16, height = 0, alpha = 0.55, size = 1.4) +
  stat_summary(
    aes(group = period),
    fun = mean,
    geom = "point",
    position = position_dodge(width = 0.55),
    size = 3.0,
    shape = 18,
    color = "black"
  ) +
  facet_wrap(~ period, ncol = 1, scales = "free_y") +
  labs(
    title = "Outbreak planting activity after disturbance",
    subtitle = "Dots show individual runs; black diamonds show aggregation means",
    x = "Aggregation",
    y = "Planting events per run",
    color = "Window"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_post_planting_per_run.png"),
  plot = plot_outbreak_post_planting_runs,
  width = 12,
  height = 8,
  dpi = 300
)

regeneration_plot_dt <- copy(outbreak_post_regeneration[period == "post_disturbance"])
regeneration_plot_dt[, activity_name := reorder(activity_name, -mean_per_run)]

plot_outbreak_regeneration <- ggplot(
  regeneration_plot_dt,
  aes(x = aggregation, y = mean_per_run, fill = activity_name)
) +
  geom_col(position = "stack", width = 0.82) +
  labs(
    title = "Outbreak regeneration decisions after disturbance",
    subtitle = "Raw regeneration-related activity labels; pulse and recovery combined",
    x = "Aggregation",
    y = "Mean events per run",
    fill = "Regeneration activity"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_post_regeneration_decisions.png"),
  plot = plot_outbreak_regeneration,
  width = 12,
  height = 7,
  dpi = 300
)

message("Saved management distribution tables")
message("Saved outbreak post-disturbance activity plots")
message("=== Management activity analysis complete ===")
