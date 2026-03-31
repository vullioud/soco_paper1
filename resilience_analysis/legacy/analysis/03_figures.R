# =============================================================================
# 03_figures.R — Resilience analysis figures
#
# Fig 2: Pre-disturbance state
# Fig 3: Recovery trajectories (KEY figure)
# Fig 4: Resistance & recovery boxplots
# Fig 5: Compositional trajectories
# Fig 6: Variable importance (RF)
# Fig 7: Salvage response
# =============================================================================

source("resilience_analysis/legacy/analysis/00_utils.R")
cat("=== Generating figures ===\n")

d <- load_resilience_data()
lm  <- d$landscape_metrics
bl  <- d$baselines
res <- d$resilience
rem <- d$removal_summary
# species_yearly not loaded here — pre-computed metrics in resilience_summary used instead

if (nrow(lm) == 0 || nrow(res) == 0) {
  stop("Missing data. Run 01 and 02 scripts first.")
}

# ============================================================================
# Fig 2: Pre-disturbance state at year 199
# ============================================================================
cat("  Fig 2: Pre-disturbance state...\n")

pre <- lm %>% filter(year == BASELINE_END)

p2a <- ggplot(pre, aes(x = aggregation, y = total_volume, fill = aggregation)) +
  geom_boxplot(alpha = 0.7) +
  facet_wrap(~landscape, nrow = 1) +
  scale_fill_manual(values = agg_colors, labels = agg_labels) +
  labs(x = NULL, y = "Total volume (m3)",
       title = paste0("A) Standing volume at year ", BASELINE_END)) +
  theme_resilience() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

p2b <- ggplot(pre, aes(x = aggregation, y = cv_volume, fill = aggregation)) +
  geom_boxplot(alpha = 0.7) +
  facet_wrap(~landscape, nrow = 1) +
  scale_fill_manual(values = agg_colors, labels = agg_labels) +
  labs(x = NULL, y = "CV of stand volume",
       title = paste0("B) Structural heterogeneity at year ", BASELINE_END)) +
  theme_resilience() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

p2 <- p2a / p2b + plot_layout(guides = "collect") &
  theme(legend.position = "bottom")
save_fig(p2, "fig_02_pre_disturbance", width = 14, height = 10)

# ============================================================================
# Fig 3: Recovery trajectories (KEY figure)
# ============================================================================
cat("  Fig 3: Recovery trajectories...\n")

# Merge baseline mean for reference lines
lm_bl <- lm %>%
  left_join(bl %>% select(run_id, bl_mean_volume), by = "run_id")

# Mean trajectory per aggregation × landscape
mean_traj <- lm_bl %>%
  group_by(landscape, aggregation, year) %>%
  summarise(
    mean_vol = mean(total_volume, na.rm = TRUE),
    bl_ref   = mean(bl_mean_volume, na.rm = TRUE),
    .groups  = "drop"
  )

p3 <- ggplot() +
  # Individual replicates as thin lines
  geom_line(data = lm_bl, aes(x = year, y = total_volume, group = run_id),
            alpha = 0.15, linewidth = 0.3, color = "grey60") +
  # Mean trajectory
  geom_line(data = mean_traj, aes(x = year, y = mean_vol, color = aggregation),
            linewidth = 1) +
  # Baseline reference
  geom_hline(data = mean_traj %>% distinct(landscape, aggregation, bl_ref),
             aes(yintercept = bl_ref, color = aggregation),
             linetype = "dashed", alpha = 0.5) +
  # Outbreak window
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  facet_grid(landscape + climate ~ aggregation, scales = "free_y",
             labeller = labeller(climate = climate_labels)) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  labs(x = "Year", y = "Total volume (m3)",
       title = "Recovery trajectories by ownership scenario, landscape, and climate") +
  theme_resilience() +
  theme(legend.position = "none")

save_fig(p3, "fig_03_recovery_trajectories", width = 16, height = 18)

# ============================================================================
# Fig 4: Resistance & recovery boxplots
# ============================================================================
cat("  Fig 4: Resistance & recovery...\n")

p4a <- ggplot(res, aes(x = aggregation, y = resistance_volume, fill = aggregation)) +
  geom_boxplot(alpha = 0.7) +
  facet_grid(climate ~ landscape, labeller = labeller(climate = climate_labels)) +
  scale_fill_manual(values = agg_colors, labels = agg_labels) +
  geom_hline(yintercept = 1, linetype = "dashed", color = "grey50") +
  labs(x = NULL, y = "Resistance (volume)", title = "A) Resistance") +
  theme_resilience() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

# Recovery time only meaningful if sim extends past treatment period.
# With BB 200-300 and sim ending at 300, use completeness_end instead
# (volume at yr 300 / baseline = cumulative impact measure).
if (any(!is.na(res$recovery_time_90))) {
  p4b <- ggplot(res %>% filter(!is.na(recovery_time_90)),
                aes(x = aggregation, y = recovery_time_90, fill = aggregation)) +
    geom_boxplot(alpha = 0.7) +
    facet_wrap(~landscape, nrow = 1) +
    scale_fill_manual(values = agg_colors, labels = agg_labels) +
    labs(x = NULL, y = "Recovery time to 90% (years)", title = "B) Recovery time") +
    theme_resilience() +
    theme(axis.text.x = element_text(angle = 45, hjust = 1))
} else {
  p4b <- ggplot(res, aes(x = aggregation, y = completeness_end, fill = aggregation)) +
    geom_boxplot(alpha = 0.7) +
    facet_wrap(~landscape, nrow = 1) +
    scale_fill_manual(values = agg_colors, labels = agg_labels) +
    geom_hline(yintercept = 1, linetype = "dashed", color = "grey50") +
    labs(x = NULL, y = paste0("Volume remaining at yr ", RECOVERY_END, " (fraction of baseline)"),
         title = "B) Cumulative BB impact (completeness at end)") +
    theme_resilience() +
    theme(axis.text.x = element_text(angle = 45, hjust = 1))
}

# Pathway proportions
pathway_prop <- res %>%
  group_by(aggregation, landscape) %>%
  count(pathway) %>%
  mutate(prop = n / sum(n)) %>%
  ungroup()

p4c <- ggplot(pathway_prop, aes(x = aggregation, y = prop, fill = pathway)) +
  geom_col(position = "stack") +
  facet_wrap(~landscape, nrow = 1) +
  scale_fill_manual(values = pathway_colors) +
  labs(x = NULL, y = "Proportion", title = "C) Recovery pathways") +
  theme_resilience() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

p4 <- p4a / p4b / p4c + plot_layout(guides = "collect") &
  theme(legend.position = "bottom")
save_fig(p4, "fig_04_resistance_recovery", width = 14, height = 14)

# ============================================================================
# Fig 5: Compositional trajectories
# ============================================================================
cat("  Fig 5: Compositional change...\n")

p5a <- ggplot(lm %>% filter(!is.na(conifer_ba_pct)),
              aes(x = year, y = as.numeric(conifer_ba_pct),
                  color = aggregation, group = run_id)) +
  geom_line(alpha = 0.5, linewidth = 0.4) +
  annotate("rect", xmin = OUTBREAK_START, xmax = OUTBREAK_END,
           ymin = -Inf, ymax = Inf, fill = "red", alpha = 0.08) +
  facet_wrap(~landscape, nrow = 1) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  labs(x = "Year", y = "Conifer BA (%)", title = "A) Conifer share over time") +
  theme_resilience()

p5b <- ggplot(res, aes(x = resistance_volume, y = bray_curtis_end,
                        color = aggregation, shape = landscape)) +
  geom_point(alpha = 0.7, size = 2.5) +
  scale_color_manual(values = agg_colors, labels = agg_labels) +
  labs(x = "Resistance (volume)",
       y = paste0("Bray-Curtis (yr ", RECOVERY_END, " vs baseline)"),
       title = "B) Resistance vs compositional change") +
  theme_resilience()

p5 <- p5a / p5b + plot_layout(guides = "collect") &
  theme(legend.position = "bottom")
save_fig(p5, "fig_05_compositional_change", width = 14, height = 10)

# ============================================================================
# Fig 6: Variable importance (RF)
# ============================================================================
cat("  Fig 6: Variable importance...\n")

if (requireNamespace("ranger", quietly = TRUE) && nrow(res) >= 20) {
  rf_data <- res %>%
    select(resistance_volume, landscape, aggregation, climate) %>%
    mutate(across(where(is.character), as.factor)) %>%
    filter(complete.cases(.))

  if (nrow(rf_data) >= 10) {
    rf_fit <- ranger::ranger(resistance_volume ~ ., data = rf_data,
                             importance = "impurity", num.trees = 500)
    imp <- data.frame(
      variable = names(rf_fit$variable.importance),
      importance = rf_fit$variable.importance
    ) %>% arrange(desc(importance))

    p6 <- ggplot(imp, aes(x = reorder(variable, importance), y = importance)) +
      geom_col(fill = "#377eb8", alpha = 0.8) +
      coord_flip() +
      labs(x = NULL, y = "Importance (impurity)",
           title = "Variable importance for resistance (RF)") +
      theme_resilience()
    save_fig(p6, "fig_06_variable_importance", width = 8, height = 5)
  }
} else {
  cat("    SKIP: ranger not installed or insufficient data\n")
}

# ============================================================================
# Fig 7: Salvage response
# ============================================================================
cat("  Fig 7: Salvage response...\n")

if (nrow(rem) > 0) {
  salvage <- rem %>%
    filter(year >= OUTBREAK_START, year <= RECOVERY_END) %>%
    group_by(run_id, landscape, aggregation) %>%
    summarise(cum_salvage = sum(vol_salvaged, na.rm = TRUE), .groups = "drop")

  p7 <- ggplot(salvage, aes(x = aggregation, y = cum_salvage, fill = aggregation)) +
    geom_violin(alpha = 0.7, draw_quantiles = c(0.25, 0.5, 0.75)) +
    geom_jitter(width = 0.1, size = 1, alpha = 0.4) +
    facet_wrap(~landscape, nrow = 1) +
    scale_fill_manual(values = agg_colors, labels = agg_labels) +
    labs(x = NULL,
         y = paste0("Cumulative salvage volume (m3, yr ",
                    OUTBREAK_START, "-", RECOVERY_END, ")"),
         title = "Salvage response during and after outbreak") +
    theme_resilience() +
    theme(axis.text.x = element_text(angle = 45, hjust = 1))
  save_fig(p7, "fig_07_salvage_response", width = 12, height = 6)
} else {
  cat("    SKIP: no removal data\n")
}

cat("=== Figures complete ===\n")
