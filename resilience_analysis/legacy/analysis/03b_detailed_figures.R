# =============================================================================
# 03b_detailed_figures.R — Detailed diagnostic figures for resilience analysis
#
# All figures faceted by landscape (rows) x aggregation (columns)
#
# Fig 8:  Structural phase distribution over time
# Fig 9:  Harvest activity breakdown (volume by activity type)
# Fig 10: Species composition trajectories (top species)
# Fig 11: Stand-level volume distributions (violin over time)
# Fig 12: Removal volume breakdown (thinning/final/salvage/disturbed)
# Fig 13: Harvest volume by behavioral type
# Fig 14: Landscape-level structural metrics over time
# Fig 15: Species diversity — Gini, Shannon, mean + CV by scenario
#
# =============================================================================

source("resilience_analysis/legacy/analysis/00_utils.R")
cat("=== Generating detailed figures ===\n")

# --- Load combined data directly ---
COMBINED <- file.path("output", "_combined")
clean_agg <- function(x) gsub("^matched_", "", x)

run_filter <- function(df) {
  df %>% filter(grepl("outbreak", disturbance))
}

# =============================================================================
# Fig 8: Structural phase distribution over time
# =============================================================================
cat("  Fig 8: Phase distribution...\n")

soco_state <- read.csv(file.path(COMBINED, "soco_stand_state.csv"),
                        stringsAsFactors = FALSE) %>%
  run_filter() %>%
  mutate(aggregation = clean_agg(aggregation))

phase_col <- intersect(c("active_phase", "structural_phase", "current_phase"),
                       names(soco_state))[1]

phase_colors <- c(
  Planting = "#2ca02c", Tending = "#98df8a",
  Thinning = "#1f77b4", Harvesting = "#d62728",
  "Set-aside" = "#8c564b"
)

state_phase <- soco_state %>%
  rename(phase = !!phase_col) %>%
  mutate(phase = ifelse(is_set_aside == 1, "Set-aside", phase))

phase_frac <- state_phase %>%
  filter(replicate == min(replicate)) %>%
  count(year, landscape, aggregation, behavioral_type, phase) %>%
  group_by(year, landscape, aggregation, behavioral_type) %>%
  mutate(frac = n / sum(n)) %>%
  ungroup() %>%
  mutate(
    phase = factor(phase,
      levels = c("Planting", "Tending", "Thinning", "Harvesting", "Set-aside")),
    behavioral_type = factor(behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN"))
  )

# One figure per landscape
for (ls in unique(phase_frac$landscape)) {
  pdata <- phase_frac %>% filter(landscape == ls)
  aggs <- unique(pdata$aggregation)

  p8 <- ggplot(pdata, aes(x = year, y = frac, fill = phase)) +
    geom_area(position = "fill", alpha = 0.85) +
    scale_fill_manual(values = phase_colors) +
    scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
    scale_y_continuous(labels = scales::percent_format()) +
    annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
             ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
    facet_grid(aggregation ~ behavioral_type) +
    labs(
      title = paste("Structural Phase Distribution —", ls),
      x = "Year", y = "Fraction of stands", fill = "Phase"
    ) +
    theme_resilience(base_size = 9)

  save_fig(p8, paste0("fig_08_phase_", ls),
           width = 16, height = 2 + length(aggs) * 2)
}


# =============================================================================
# Fig 9: Harvest activity breakdown
# =============================================================================
cat("  Fig 9: Harvest activity breakdown...\n")

removal <- read.csv(file.path(COMBINED, "removal.csv"),
                     stringsAsFactors = FALSE) %>%
  run_filter() %>%
  mutate(aggregation = clean_agg(aggregation))

removal_typed <- removal %>%
  mutate(
    act_group = case_when(
      grepl("^salvage", activity) ~ "Salvage",
      grepl("planting$", activity) & !grepl("salvage", activity) ~ "Planting",
      grepl("tending", activity) ~ "Tending",
      grepl("thin|fromBelow", activity, ignore.case = TRUE) ~ "Thinning",
      grepl("shelterwood|femel|clearcut|plenter|targetDBH", activity) ~ "Final harvest",
      TRUE ~ "Other"
    ),
    total_removed = volumeThinning + volumeFinal + volumeSalvaged
  )

act_pal <- c(
  "Salvage" = "#bcbd22", "Planting" = "#2ca02c",
  "Tending" = "#98df8a", "Thinning" = "#1f77b4",
  "Final harvest" = "#d62728", "Other" = "#cccccc"
)

harvest_agg <- removal_typed %>%
  mutate(year_bin = floor(year / 10) * 10 + 5) %>%
  group_by(year_bin, landscape, aggregation, act_group) %>%
  summarise(total_vol = sum(total_removed, na.rm = TRUE), .groups = "drop")

p9 <- ggplot(harvest_agg,
             aes(x = year_bin, y = total_vol, fill = act_group)) +
  geom_col(position = "stack", width = 8) +
  scale_fill_manual(values = act_pal) +
  scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  facet_grid(landscape ~ aggregation, scales = "free_y") +
  labs(
    title = "Harvest volume by activity type (10yr bins)",
    x = "Year", y = expression(Volume ~ removed ~ (m^3)),
    fill = "Activity"
  ) +
  theme_resilience(base_size = 9)

save_fig(p9, "fig_09_harvest_breakdown", width = 16, height = 14)


# =============================================================================
# Fig 10: Species composition trajectories
# =============================================================================
cat("  Fig 10: Species composition...\n")

sp_yr <- read.csv(file.path(COMBINED, "species_by_year.csv"),
                   stringsAsFactors = FALSE) %>%
  run_filter() %>%
  mutate(aggregation = clean_agg(aggregation))

top_sp <- sp_yr %>%
  group_by(species) %>%
  summarise(total = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
  slice_max(total, n = 10) %>%
  pull(species)

sp_plot <- sp_yr %>%
  mutate(species = ifelse(species %in% top_sp, species, "Other")) %>%
  group_by(year, landscape, aggregation, species) %>%
  summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
  group_by(year, landscape, aggregation) %>%
  mutate(share = total_ba / sum(total_ba) * 100) %>%
  ungroup()

sp_plot$species <- factor(sp_plot$species, levels = c(top_sp, "Other"))

p10 <- ggplot(sp_plot, aes(x = year, y = share, fill = species)) +
  geom_area(position = "stack", alpha = 0.85) +
  scale_fill_manual(values = sp_palette, na.value = "#bdbdbd") +
  scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  facet_grid(landscape ~ aggregation) +
  labs(
    title = "Species composition over time (BA share)",
    x = "Year", y = "BA share (%)", fill = "Species"
  ) +
  theme_resilience(base_size = 9)

save_fig(p10, "fig_10_species_composition", width = 16, height = 14)


# =============================================================================
# Fig 11: Stand-level volume distributions (violin)
# =============================================================================
cat("  Fig 11: Stand volume distributions...\n")

stand_vol <- read.csv(file.path(COMBINED, "stand_volume.csv"),
                       stringsAsFactors = FALSE) %>%
  run_filter() %>%
  mutate(aggregation = clean_agg(aggregation))

key_years <- seq(BASELINE_START, RECOVERY_END, by = 20)

sv_subset <- stand_vol %>%
  filter(year %in% key_years, replicate == 1) %>%
  mutate(year_f = factor(year))

# One figure per landscape
for (ls in unique(sv_subset$landscape)) {
  pdata <- sv_subset %>% filter(landscape == ls)

  p11 <- ggplot(pdata, aes(x = year_f, y = volume, fill = aggregation)) +
    geom_violin(alpha = 0.6, scale = "width", position = position_dodge(0.8)) +
    geom_boxplot(width = 0.15, alpha = 0.8, position = position_dodge(0.8),
                 outlier.size = 0.3) +
    scale_fill_manual(values = agg_colors, labels = agg_labels) +
    labs(
      title = paste("Stand-level volume distribution —", ls),
      x = "Year", y = expression(Volume ~ (m^3 / ha)), fill = "Scenario"
    ) +
    theme_resilience()

  save_fig(p11, paste0("fig_11_stand_vol_", ls), width = 14, height = 7)
}


# =============================================================================
# Fig 12: Removal volume breakdown
# =============================================================================
cat("  Fig 12: Removal breakdown...\n")

rem_landscape <- removal %>%
  group_by(year, landscape, aggregation, replicate) %>%
  summarise(
    thinning  = sum(volumeThinning, na.rm = TRUE),
    final     = sum(volumeFinal, na.rm = TRUE),
    salvaged  = sum(volumeSalvaged, na.rm = TRUE),
    disturbed = sum(volumeDisturbed, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  group_by(year, landscape, aggregation) %>%
  summarise(across(c(thinning, final, salvaged, disturbed), mean),
            .groups = "drop") %>%
  pivot_longer(cols = c(thinning, final, salvaged, disturbed),
               names_to = "removal_type", values_to = "volume") %>%
  mutate(removal_type = factor(removal_type,
    levels = c("thinning", "final", "salvaged", "disturbed"),
    labels = c("Thinning", "Final harvest", "Salvaged", "Disturbed (natural)")))

rem_pal <- c(
  "Thinning" = "#1f77b4", "Final harvest" = "#d62728",
  "Salvaged" = "#bcbd22", "Disturbed (natural)" = "#7f7f7f"
)

p12 <- ggplot(rem_landscape, aes(x = year, y = volume, fill = removal_type)) +
  geom_col(position = "stack", width = 1) +
  scale_fill_manual(values = rem_pal) +
  scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  facet_grid(landscape ~ aggregation, scales = "free_y") +
  labs(
    title = "Annual removal volume by type",
    x = "Year", y = expression(Volume ~ removed ~ (m^3)),
    fill = "Removal type"
  ) +
  theme_resilience(base_size = 9)

save_fig(p12, "fig_12_removal_breakdown", width = 16, height = 14)


# =============================================================================
# Fig 13: Harvest volume by behavioral type
# =============================================================================
cat("  Fig 13: Harvest by owner type...\n")

n_reps <- length(unique(removal$replicate))

harvest_by_type <- removal_typed %>%
  filter(total_removed > 0) %>%
  mutate(year_bin = floor(year / 10) * 10 + 5) %>%
  group_by(year_bin, landscape, aggregation, behavioral_type) %>%
  summarise(total_vol = sum(total_removed, na.rm = TRUE) / n_reps,
            .groups = "drop")

p13 <- ggplot(harvest_by_type,
              aes(x = year_bin, y = total_vol, fill = behavioral_type)) +
  geom_col(position = "stack", width = 8) +
  scale_fill_manual(values = btype_palette, labels = btype_labels) +
  scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  facet_grid(landscape ~ aggregation, scales = "free_y") +
  labs(
    title = "Harvest volume by owner type (10yr bins)",
    x = "Year", y = expression(Volume ~ removed ~ (m^3)),
    fill = "Owner type"
  ) +
  theme_resilience(base_size = 9)

save_fig(p13, "fig_13_harvest_by_owner", width = 16, height = 14)


# =============================================================================
# Fig 14: Landscape-level structural metrics over time
# =============================================================================
cat("  Fig 14: Structural metrics...\n")

struct_ts <- stand_vol %>%
  group_by(year, landscape, aggregation, replicate) %>%
  summarise(
    mean_vol   = mean(volume, na.rm = TRUE),
    mean_age   = mean(age, na.rm = TRUE),
    mean_dbh   = mean(dbh, na.rm = TRUE),
    mean_stems = mean(stems, na.rm = TRUE),
    cv_volume  = sd(volume, na.rm = TRUE) / mean(volume, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  group_by(year, landscape, aggregation) %>%
  summarise(across(c(mean_vol, mean_age, mean_dbh, mean_stems, cv_volume), mean),
            .groups = "drop")

p14a <- ggplot(struct_ts, aes(x = year, y = mean_vol, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = NULL, y = expression(Mean ~ vol ~ (m^3/ha)),
       title = "A) Mean stand volume") +
  theme_resilience(base_size = 9) + theme(legend.position = "none")

p14b <- ggplot(struct_ts, aes(x = year, y = mean_age, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = NULL, y = "Mean age (yr)", title = "B) Mean stand age") +
  theme_resilience(base_size = 9) + theme(legend.position = "none")

p14c <- ggplot(struct_ts, aes(x = year, y = cv_volume, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = "Year", y = "CV of volume",
       title = "C) Structural heterogeneity (CV)") +
  theme_resilience(base_size = 9)

p14 <- p14a / p14b / p14c +
  plot_layout(guides = "collect") +
  plot_annotation(title = "Landscape-level structural metrics over time") &
  theme(legend.position = "bottom") &
  scale_x_continuous(breaks = seq(0, RECOVERY_END, 50))

save_fig(p14, "fig_14_structural_metrics", width = 16, height = 12)


# =============================================================================
# Fig 15: Species & structural diversity — Shannon, DBH Gini, richness
# =============================================================================
cat("  Fig 15: Species & structural diversity...\n")

# --- Shannon (species) ---
shannon <- read.csv(file.path(COMBINED, "stand_shannon.csv"),
                     stringsAsFactors = FALSE) %>%
  run_filter() %>%
  mutate(aggregation = clean_agg(aggregation))

shan_ts <- shannon %>%
  group_by(year, landscape, aggregation, replicate) %>%
  summarise(
    mean_H    = mean(shannon_H, na.rm = TRUE),
    cv_H      = sd(shannon_H, na.rm = TRUE) / mean(shannon_H, na.rm = TRUE),
    mean_rich = mean(richness, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  group_by(year, landscape, aggregation) %>%
  summarise(across(c(mean_H, cv_H, mean_rich), mean), .groups = "drop")

# --- Structural DBH Gini (from soco_stand_state) ---
soco_state <- read.csv(file.path(COMBINED, "soco_stand_state.csv"),
                        stringsAsFactors = FALSE) %>%
  run_filter() %>%
  mutate(aggregation = clean_agg(aggregation))

dbh_ts <- soco_state %>%
  group_by(year, landscape, aggregation, replicate) %>%
  summarise(
    mean_dbh_gini = mean(dbh_gini, na.rm = TRUE),
    cv_dbh_gini   = sd(dbh_gini, na.rm = TRUE) /
                      mean(dbh_gini, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  group_by(year, landscape, aggregation) %>%
  summarise(across(c(mean_dbh_gini, cv_dbh_gini), mean), .groups = "drop")

# Panel A: Mean Shannon H by landscape
p15a <- ggplot(shan_ts, aes(x = year, y = mean_H, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = NULL, y = "Mean Shannon H'",
       title = "A) Mean stand-level species diversity (Shannon)") +
  theme_resilience(base_size = 9) + theme(legend.position = "none")

# Panel B: CV of Shannon H
p15b <- ggplot(shan_ts, aes(x = year, y = cv_H, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = NULL, y = "CV of Shannon H'",
       title = "B) CV of Shannon diversity across stands") +
  theme_resilience(base_size = 9) + theme(legend.position = "none")

# Panel C: Mean DBH Gini (structural diversity)
p15c <- ggplot(dbh_ts, aes(x = year, y = mean_dbh_gini, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = NULL, y = "Mean DBH Gini",
       title = "C) Mean stand-level structural diversity (DBH Gini)") +
  theme_resilience(base_size = 9) + theme(legend.position = "none")

# Panel D: CV of DBH Gini
p15d <- ggplot(dbh_ts, aes(x = year, y = cv_dbh_gini, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = NULL, y = "CV of DBH Gini",
       title = "D) CV of DBH Gini across stands") +
  theme_resilience(base_size = 9) + theme(legend.position = "none")

# --- Stand species shares for effective richness + dominance ---
sp_shares <- read.csv(file.path(COMBINED, "stand_species_shares.csv"),
                       stringsAsFactors = FALSE) %>%
  run_filter() %>%
  mutate(aggregation = clean_agg(aggregation))

# Species columns = everything after total_ba
sp_cols <- setdiff(names(sp_shares),
                   c("run_id", "landscape", "aggregation", "disturbance",
                     "replicate", "year", "standid", "behavioral_type", "total_ba"))

# Per stand: effective richness (species >= 5% share) and dominance ratio
sp_metrics <- sp_shares %>%
  rowwise() %>%
  mutate(
    eff_richness = sum(c_across(all_of(sp_cols)) >= 0.05, na.rm = TRUE),
    dom_share    = max(c_across(all_of(sp_cols)), na.rm = TRUE)
  ) %>%
  ungroup()

sp_ts <- sp_metrics %>%
  group_by(year, landscape, aggregation, replicate) %>%
  summarise(
    mean_eff_rich = mean(eff_richness, na.rm = TRUE),
    mean_dom      = mean(dom_share, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  group_by(year, landscape, aggregation) %>%
  summarise(across(c(mean_eff_rich, mean_dom), mean), .groups = "drop")

# Panel E: Effective species richness (>= 5% BA share)
p15e <- ggplot(sp_ts, aes(x = year, y = mean_eff_rich, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = NULL, y = "Effective richness",
       title = "E) Effective species richness (species >= 5% BA share)") +
  theme_resilience(base_size = 9) + theme(legend.position = "none")

# Panel F: Dominance ratio (top species BA share)
p15f <- ggplot(sp_ts, aes(x = year, y = mean_dom, color = aggregation)) +
  geom_line(linewidth = 0.5) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  facet_wrap(~landscape, nrow = 1, scales = "free_y") +
  labs(x = "Year", y = "Dominant species share",
       title = "F) Mean dominance ratio (max species BA / total BA)") +
  theme_resilience(base_size = 9)

p15 <- p15a / p15b / p15c / p15d / p15e / p15f +
  plot_layout(guides = "collect") +
  plot_annotation(title = "Species & structural diversity metrics over time") &
  theme(legend.position = "bottom") &
  scale_x_continuous(breaks = seq(0, RECOVERY_END, 50))

save_fig(p15, "fig_15_diversity_metrics", width = 16, height = 18)

cat("=== Detailed figures complete ===\n")
