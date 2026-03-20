#!/usr/bin/env Rscript
# =============================================================================
# Fig 01: Stand Management Biographies
#   15 panels (5 types × 3 stands). Volume line + activity dots.
#   Sequence activities split into components (e.g. shelterwood vs planting).
#
# Run:  Rscript analysis_batch/scripts/fig_01_stand_biographies.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 01: Stand Management Biographies ===\n")
d <- load_all_data()

REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"
REF_DISTURBANCE <- "contbb"
REF_REPLICATE   <- 1

# --- Filter to reference scenario ---
state_ref <- d$soco_state %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         disturbance == REF_DISTURBANCE,
         replicate == REF_REPLICATE)
cat(sprintf("  soco_state ref rows: %d\n", nrow(state_ref)))

ml_ref <- d$ml_activities %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         disturbance == REF_DISTURBANCE,
         replicate == REF_REPLICATE,
         activity_name != "none")
cat(sprintf("  ml_activities ref rows (non-none): %d\n", nrow(ml_ref)))

stopifnot(nrow(state_ref) > 0)

# --- Sample 3 stands per type ---
set.seed(123)
sampled <- state_ref %>%
  distinct(stand_id, behavioral_type) %>%
  group_by(behavioral_type) %>%
  slice_sample(n = 3) %>%
  ungroup()
cat(sprintf("  Sampled %d stands\n", nrow(sampled)))

# --- Volume trajectories ---
vol_data <- state_ref %>%
  semi_join(sampled, by = c("stand_id", "behavioral_type")) %>%
  mutate(
    behavioral_type = factor(behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN")),
    panel_label = paste0(behavioral_type, " / stand_", stand_id)
  )

label_order <- vol_data %>%
  distinct(behavioral_type, stand_id, panel_label) %>%
  arrange(behavioral_type, stand_id) %>%
  pull(panel_label)
vol_data$panel_label <- factor(vol_data$panel_label, levels = label_order)

# --- Activity dots: split sequence phases ---
# e.g. "shelterwood_planting" → base="shelterwood", suffix="planting"
# Keep the full name for coloring — the activity_colors palette already
# has distinct entries for shelterwood vs shelterwood_planting vs planting etc.
act_data <- ml_ref %>%
  semi_join(sampled, by = c("stand_id", "behavioral_type")) %>%
  mutate(
    behavioral_type = factor(behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN")),
    panel_label = paste0(behavioral_type, " / stand_", stand_id),
    is_salvage = grepl("^salvage", activity_name)
  )
act_data$panel_label <- factor(act_data$panel_label, levels = label_order)

# Merge volume at activity year for y positioning
act_data <- act_data %>%
  left_join(
    vol_data %>% select(stand_id, year, volume),
    by = c("stand_id", "year")
  )

# --- Build palette ---
all_acts <- unique(act_data$activity_name)
act_pal <- activity_colors[names(activity_colors) %in% all_acts]
for (a in setdiff(all_acts, names(act_pal))) act_pal[a] <- "#999999"

# =============================================================================
# PLOT: Volume + activity dots only (no harvest bar panel)
# =============================================================================

p <- ggplot(vol_data, aes(x = year, y = volume)) +
  geom_line(color = "grey50", linewidth = 0.4) +
  facet_wrap(~panel_label, ncol = 3, scales = "free_y") +
  scale_x_continuous(breaks = seq(0, 200, 50)) +
  labs(x = "Year", y = expression(Volume ~ (m^3 / ha)), color = "Activity") +
  theme_soco(base_size = 10) +
  theme(strip.text = element_text(size = 8))

if (nrow(act_data) > 0) {
  p <- p +
    geom_point(
      data = act_data %>% filter(!is_salvage),
      aes(x = year, y = volume, color = activity_name),
      shape = 16, size = 3, alpha = 0.85
    ) +
    geom_point(
      data = act_data %>% filter(is_salvage),
      aes(x = year, y = volume, color = activity_name),
      shape = 17, size = 3.5, alpha = 0.85
    ) +
    scale_color_manual(values = act_pal) +
    guides(color = guide_legend(nrow = 2, override.aes = list(size = 4)))
}

p <- p +
  plot_annotation(
    title = "Stand Management Biographies",
    subtitle = paste(REF_LANDSCAPE, "/", REF_AGGREGATION, "/",
                     REF_DISTURBANCE, "/ rep", REF_REPLICATE,
                     "| 3 stands per type | triangles = salvage")
  )

save_fig(p, "fig_01_stand_biographies", width = 16, height = 16)
cat("=== Fig 01 complete ===\n")
