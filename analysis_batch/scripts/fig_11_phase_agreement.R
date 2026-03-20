#!/usr/bin/env Rscript
# =============================================================================
# Fig 11: Phase Agreement — Age-Based vs Structural Classification
#   Left: Confusion matrix (all years pooled, managed stands only)
#   Right: Agreement % over time, one line per behavioral type
#
# Run:  Rscript analysis_batch/scripts/fig_11_phase_agreement.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 11: Phase Agreement ===\n")
d <- load_all_data()

REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"
REF_DISTURBANCE <- "contbb"
REF_REPLICATE   <- 1

# --- Filter reference scenario, managed stands only ---
state <- d$soco_state %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         disturbance == REF_DISTURBANCE,
         replicate == REF_REPLICATE,
         is_set_aside == 0)

cat(sprintf("  Rows: %d | Overall agreement: %.1f%%\n",
            nrow(state),
            mean(state$phase_match, na.rm = TRUE) * 100))

phase_levels <- c("Planting", "Tending", "Thinning", "Harvesting")

state <- state %>%
  mutate(
    age_phase = factor(age_phase, levels = phase_levels),
    structural_phase = factor(structural_phase, levels = phase_levels)
  ) %>%
  filter(!is.na(age_phase), !is.na(structural_phase))

# =============================================================================
# Panel A: Confusion matrix
# =============================================================================
confusion <- state %>%
  count(age_phase, structural_phase) %>%
  group_by(age_phase) %>%
  mutate(pct = n / sum(n) * 100) %>%
  ungroup()

p_a <- ggplot(confusion,
              aes(x = structural_phase, y = age_phase, fill = pct)) +
  geom_tile(color = "white", linewidth = 0.8) +
  geom_text(aes(label = sprintf("%.0f%%", pct)), size = 4) +
  scale_fill_gradient(low = "white", high = "steelblue",
                      name = "% of\nage-phase") +
  labs(
    title = "A. Phase confusion matrix (all years)",
    subtitle = "Rows = age-based | Columns = structural",
    x = "Structural phase", y = "Age-based phase"
  ) +
  theme_soco(base_size = 10) +
  theme(panel.grid = element_blank())

# =============================================================================
# Panel B: Agreement over time by behavioral type
# =============================================================================
agreement_by_type <- state %>%
  group_by(year, behavioral_type) %>%
  summarise(
    pct_match = mean(phase_match, na.rm = TRUE) * 100,
    .groups = "drop"
  )

p_b <- ggplot(agreement_by_type,
              aes(x = year, y = pct_match,
                  color = behavioral_type)) +
  geom_line(linewidth = 0.6, alpha = 0.8) +
  geom_hline(yintercept = 100, linetype = "dashed",
             color = "grey60", linewidth = 0.3) +
  scale_color_manual(values = btype_palette,
                     labels = btype_labels) +
  scale_x_continuous(breaks = seq(0, 200, 50)) +
  scale_y_continuous(limits = c(0, 100)) +
  labs(
    title = "B. Phase agreement over time by owner type",
    subtitle = "% of managed stands where age-phase = structural-phase",
    x = "Year", y = "Agreement (%)",
    color = "Type"
  ) +
  theme_soco(base_size = 10)

# =============================================================================
# Combine
# =============================================================================
p_combined <- (p_a | p_b) +
  plot_layout(widths = c(1, 1.5)) +
  plot_annotation(
    title = "Phase Classification: Age-Based vs Structural",
    subtitle = paste(REF_LANDSCAPE, "/", REF_AGGREGATION, "/",
                     REF_DISTURBANCE, "/ rep", REF_REPLICATE,
                     "| set-aside excluded")
  ) &
  theme(legend.position = "bottom")

save_fig(p_combined, "fig_11_phase_agreement", width = 16, height = 7)
cat("=== Fig 11 complete ===\n")
