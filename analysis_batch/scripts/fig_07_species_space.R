#!/usr/bin/env Rscript
# =============================================================================
# Fig 07: Species Composition Space (Conifer Share × Evenness)
#   Each stand at endpoint (years 180–200) is a point in 2D space.
#   x = conifer share (% BA in conifers), y = species evenness (1 - Gini or Shannon).
#   Color = behavioral_type. Ellipses show type clustering.
#
# Run:  Rscript analysis_batch/scripts/fig_07_species_space.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 07: Species Composition Space ===\n")
d <- load_all_data()

REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"
REF_DISTURBANCE <- "contbb"
REF_REPLICATE   <- 1

# =============================================================================
# Conifer share per stand at endpoint
# From species_by_year_type: aggregate per stand (need per-stand species data)
# Fallback: use species_by_year_type (aggregated by type) — coarser but available
# Better: use stand_shannon which has total_ba per stand, cross with species data
# =============================================================================

# --- Try stand-level approach using stand_shannon for evenness ---
shan <- d$shannon %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         disturbance == REF_DISTURBANCE,
         replicate == REF_REPLICATE,
         year >= 180) %>%
  rename(stand_id = standid) %>%
  group_by(stand_id, behavioral_type) %>%
  summarise(
    mean_shannon = mean(shannon_H, na.rm = TRUE),
    mean_evenness = mean(simpson_1D, na.rm = TRUE),
    .groups = "drop"
  )

cat(sprintf("  Shannon endpoint stands: %d\n", nrow(shan)))

# --- Conifer share: from species_by_year_type (per type, not per stand) ---
# This is the coarser fallback. If stand_species_ba existed we'd use that.
sp_type <- d$sp_type %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         disturbance == REF_DISTURBANCE,
         replicate == REF_REPLICATE,
         year >= 180)

if (nrow(sp_type) > 0 && "species" %in% names(sp_type)) {

  # Compute conifer share per type (landscape-level, not per stand)
  conifer_by_type <- sp_type %>%
    mutate(is_conifer = species %in% conifers) %>%
    group_by(behavioral_type, is_conifer) %>%
    summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
    group_by(behavioral_type) %>%
    mutate(conifer_share = total_ba / sum(total_ba)) %>%
    filter(is_conifer) %>%
    select(behavioral_type, type_conifer_share = conifer_share)

  cat(sprintf("  Conifer share by type computed (%d types)\n",
              nrow(conifer_by_type)))

  # --- Try per-stand approach from stand_species_gini ---
  gini <- d$sp_gini %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           disturbance == REF_DISTURBANCE,
           replicate == REF_REPLICATE,
           year >= 180) %>%
    rename(stand_id = standid) %>%
    group_by(stand_id, behavioral_type) %>%
    summarise(mean_evenness_gini = mean(species_evenness, na.rm = TRUE),
              .groups = "drop")

  # Merge shannon + gini
  stand_data <- shan %>%
    left_join(gini, by = c("stand_id", "behavioral_type")) %>%
    left_join(conifer_by_type, by = "behavioral_type") %>%
    filter(!is.na(type_conifer_share))

  # Add jitter to conifer_share since it's at type level
  set.seed(42)
  stand_data <- stand_data %>%
    mutate(
      conifer_pct = type_conifer_share * 100 +
        rnorm(n(), 0, 3),  # small jitter to spread points
      conifer_pct = pmax(0, pmin(100, conifer_pct)),
      behavioral_type = factor(behavioral_type,
        levels = c("MF", "OP", "TR", "PA", "EN"))
    )

  cat(sprintf("  Final stand data: %d rows\n", nrow(stand_data)))

  # --- Plot ---
  p <- ggplot(stand_data,
              aes(x = conifer_pct, y = mean_shannon,
                  color = behavioral_type)) +
    geom_point(alpha = 0.5, size = 2) +
    stat_ellipse(level = 0.5, linetype = "dashed", linewidth = 0.6) +
    scale_color_manual(values = btype_palette, labels = btype_labels) +
    labs(
      title = "Species Composition Space at Endpoint (years 180-200)",
      subtitle = paste(REF_LANDSCAPE, "/", REF_AGGREGATION, "/",
                       REF_DISTURBANCE, "/ rep", REF_REPLICATE,
                       "\nConifer share jittered (type-level data) | Shannon per stand"),
      x = "Conifer share (% BA)",
      y = "Shannon diversity (H')",
      color = "Owner type"
    ) +
    theme_soco() +
    theme(legend.position = "right")

  save_fig(p, "fig_07_species_space", width = 10, height = 8)

} else {
  cat("  species_by_year_type not available — skipping Fig 07\n")
}

cat("=== Fig 07 complete ===\n")
