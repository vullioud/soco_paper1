#!/usr/bin/env Rscript
# =============================================================================
# Fig 02: Phase Distribution Over Time by Type
#   Stacked area: fraction of stands in each structural phase per year.
#   5 facets (one per behavioral type). Reference scenario only.
#
# Run:  Rscript analysis_batch/scripts/fig_02_phase_distribution.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 02: Phase Distribution ===\n")
d <- load_all_data()

REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"
REF_DISTURBANCE <- "contbb"
REF_REPLICATE   <- 1

# --- Determine phase column ---
phase_col <- intersect(c("active_phase", "structural_phase", "current_phase"),
                       names(d$soco_state))[1]
cat(sprintf("  Using phase column: %s\n", phase_col))
stopifnot(!is.na(phase_col))

# --- Filter ---
state_ref <- d$soco_state %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         disturbance == REF_DISTURBANCE,
         replicate == REF_REPLICATE) %>%
  rename(phase = !!phase_col)

cat(sprintf("  Rows: %d | Phases: %s\n", nrow(state_ref),
            paste(sort(unique(state_ref$phase)), collapse = ", ")))

# --- Handle set-aside stands ---
if ("is_set_aside" %in% names(state_ref)) {
  state_ref <- state_ref %>%
    mutate(phase = ifelse(is_set_aside == 1, "Set-aside", phase))
  phase_pal <- c(phase_colors, "Set-aside" = "#8c564b")
  phase_levs <- c("Planting", "Tending", "Thinning", "Harvesting", "Set-aside")
} else {
  phase_pal <- phase_colors
  phase_levs <- c("Planting", "Tending", "Thinning", "Harvesting")
}

# --- Compute fractions ---
phase_frac <- state_ref %>%
  count(year, behavioral_type, phase) %>%
  group_by(year, behavioral_type) %>%
  mutate(frac = n / sum(n)) %>%
  ungroup() %>%
  mutate(
    phase = factor(phase, levels = phase_levs),
    behavioral_type = factor(behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN"),
      labels = btype_labels[c("MF", "OP", "TR", "PA", "EN")])
  )

# --- Plot ---
p <- ggplot(phase_frac, aes(x = year, y = frac, fill = phase)) +
  geom_area(position = "stack", alpha = 0.85) +
  scale_fill_manual(values = phase_pal) +
  scale_x_continuous(breaks = seq(0, 200, 50)) +
  scale_y_continuous(labels = scales::percent_format()) +
  facet_wrap(~behavioral_type, nrow = 1) +
  labs(
    title = "Structural Phase Distribution Over Time",
    subtitle = paste(REF_LANDSCAPE, "/", REF_AGGREGATION, "/",
                     REF_DISTURBANCE, "/ rep", REF_REPLICATE,
                     "| fraction of stands per type"),
    x = "Year",
    y = "Fraction of stands",
    fill = "Phase"
  ) +
  theme_soco()

save_fig(p, "fig_02_phase_distribution", width = 14, height = 6)
cat("=== Fig 02 complete ===\n")
