#!/usr/bin/env Rscript
# =============================================================================
# Fig 04: Post-Disturbance Recovery (full devastation: vol < 10)
# Fig 04b: Partial salvage recovery (salvage event but vol stays > 10)
#
#   3 panels each:
#     A. Volume recovery (cohort lines colored by type + mean smooth)
#     B. Shannon diversity during recovery
#     C. Activity events during recovery
#
# Run:  Rscript analysis_batch/scripts/fig_04_disturbance_recovery.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 04: Disturbance Recovery ===\n")
d <- load_all_data()

REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"
REF_REPLICATE   <- 1

# =============================================================================
# STEP 1: Identify resets and partial salvage events
# =============================================================================

state <- d$soco_state %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         replicate == REF_REPLICATE,
         disturbance %in% c("contbb", "bb")) %>%
  arrange(disturbance, stand_id, year)

cat(sprintf("  State rows: %d\n", nrow(state)))

# --- Full resets: volume drops below 10 from above 50 ---
resets_full <- state %>%
  group_by(disturbance, stand_id) %>%
  mutate(vol_prev = lag(volume, default = NA)) %>%
  ungroup() %>%
  filter(!is.na(vol_prev), volume < 10, vol_prev > 50) %>%
  select(disturbance, stand_id, behavioral_type,
         reset_year = year) %>%
  group_by(disturbance, stand_id) %>%
  slice_min(reset_year, n = 1) %>%
  ungroup()

cat(sprintf("  Full resets (vol<10): %d\n", nrow(resets_full)))

# --- Partial salvage: stands with salvage_clearcut but vol stays > 10 ---
ml_salvage <- d$ml_activities %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         replicate == REF_REPLICATE,
         disturbance %in% c("contbb", "bb"),
         grepl("^salvage", activity_name))

# Find stands that had salvage but never dropped below 10
full_reset_ids <- resets_full %>%
  distinct(disturbance, stand_id)

partial_salvage <- ml_salvage %>%
  anti_join(full_reset_ids,
            by = c("disturbance", "stand_id")) %>%
  select(disturbance, stand_id, behavioral_type,
         reset_year = year) %>%
  group_by(disturbance, stand_id) %>%
  slice_min(reset_year, n = 1) %>%
  ungroup()

cat(sprintf("  Partial salvage (vol>10): %d\n", nrow(partial_salvage)))

# =============================================================================
# Helper: build recovery figure from a reset table
# =============================================================================

build_recovery_fig <- function(resets, state, d, title_prefix,
                               fig_name) {

  if (nrow(resets) < 3) {
    cat(sprintf("  Too few resets for %s — skipping\n", fig_name))
    return(invisible(NULL))
  }

  cat(sprintf("  Building %s (%d resets)\n", fig_name, nrow(resets)))

  # Recovery trajectories
  recovery <- state %>%
    inner_join(resets,
               by = c("disturbance", "stand_id",
                       "behavioral_type")) %>%
    filter(year >= reset_year) %>%
    mutate(years_since = year - reset_year) %>%
    filter(years_since <= 80)

  recovery$behavioral_type <- factor(
    recovery$behavioral_type,
    levels = c("MF", "OP", "TR", "PA", "EN"))
  recovery$cohort <- paste(recovery$disturbance,
                           recovery$stand_id, sep = "_")

  # --- Panel A: Volume ---
  vol_agg <- recovery %>%
    group_by(years_since, behavioral_type) %>%
    summarise(
      mean_vol = mean(volume, na.rm = TRUE),
      se_vol   = sd(volume, na.rm = TRUE) / sqrt(n()),
      .groups = "drop"
    )

  p_a <- ggplot() +
    geom_line(
      data = recovery,
      aes(x = years_since, y = volume, group = cohort,
          color = behavioral_type),
      linewidth = 0.2, alpha = 0.2
    ) +
    geom_ribbon(
      data = vol_agg,
      aes(x = years_since,
          ymin = mean_vol - se_vol,
          ymax = mean_vol + se_vol,
          fill = behavioral_type),
      alpha = 0.25
    ) +
    geom_line(
      data = vol_agg,
      aes(x = years_since, y = mean_vol,
          color = behavioral_type),
      linewidth = 1
    ) +
    scale_color_manual(values = btype_palette) +
    scale_fill_manual(values = btype_palette) +
    labs(x = NULL,
         y = expression(Volume ~ (m^3 / ha)),
         title = "A. Volume Recovery",
         color = "Type", fill = "Type") +
    theme_soco(base_size = 10)

  # --- Panel B: Shannon ---
  p_b <- NULL
  if (nrow(d$shannon) > 0) {
    shan <- d$shannon %>%
      filter(landscape == REF_LANDSCAPE,
             aggregation == REF_AGGREGATION,
             replicate == REF_REPLICATE,
             disturbance %in% c("contbb", "bb")) %>%
      rename(stand_id = standid)

    shan_rec <- shan %>%
      inner_join(resets,
                 by = c("disturbance", "stand_id",
                        "behavioral_type")) %>%
      filter(year >= reset_year) %>%
      mutate(years_since = year - reset_year) %>%
      filter(years_since <= 80)

    shan_rec$behavioral_type <- factor(
      shan_rec$behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN"))

    shan_agg <- shan_rec %>%
      group_by(years_since, behavioral_type) %>%
      summarise(
        mean_s = mean(shannon_H, na.rm = TRUE),
        se_s   = sd(shannon_H, na.rm = TRUE) / sqrt(n()),
        .groups = "drop"
      )

    p_b <- ggplot(shan_agg,
                  aes(x = years_since, y = mean_s,
                      color = behavioral_type,
                      fill = behavioral_type)) +
      geom_ribbon(aes(ymin = mean_s - se_s,
                      ymax = mean_s + se_s), alpha = 0.2) +
      geom_line(linewidth = 0.9) +
      scale_color_manual(values = btype_palette) +
      scale_fill_manual(values = btype_palette) +
      labs(x = NULL, y = "Shannon H'",
           title = "B. Species Diversity Recovery") +
      theme_soco(base_size = 10)
  }

  # --- Panel C: Activities ---
  ml <- d$ml_activities %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           replicate == REF_REPLICATE,
           disturbance %in% c("contbb", "bb"),
           activity_name != "none")

  ml_rec <- ml %>%
    inner_join(resets,
               by = c("disturbance", "stand_id",
                      "behavioral_type")) %>%
    filter(year >= reset_year) %>%
    mutate(years_since = year - reset_year) %>%
    filter(years_since <= 80)

  ml_rec$behavioral_type <- factor(
    ml_rec$behavioral_type,
    levels = c("MF", "OP", "TR", "PA", "EN"))

  ml_rec <- ml_rec %>%
    mutate(act_group = case_when(
      grepl("^salvage", activity_name) ~ "salvage",
      grepl("planting$", activity_name) ~ "planting",
      grepl("tending", activity_name) ~ "tending",
      grepl("thin|fromBelow", activity_name,
            ignore.case = TRUE) ~ "thinning",
      grepl("shelterwood|femel|clearcut|plenter|targetDBH",
            activity_name) ~ "harvest",
      TRUE ~ "other"
    ))

  act_pal <- c(salvage = "#bcbd22", planting = "#2ca02c",
               tending = "#98df8a", thinning = "#1f77b4",
               harvest = "#d62728", other = "#cccccc")

  p_c <- ggplot(ml_rec,
                aes(x = years_since, y = behavioral_type,
                    color = act_group)) +
    geom_jitter(height = 0.25, width = 0.3,
                size = 1.5, alpha = 0.6) +
    scale_color_manual(values = act_pal) +
    labs(x = "Years since disturbance event",
         y = NULL,
         title = "C. Management Activities During Recovery",
         color = "Activity") +
    theme_soco(base_size = 10)

  # --- Combine ---
  panels <- if (!is.null(p_b)) {
    (p_a / p_b / p_c) +
      plot_layout(heights = c(2, 2, 1.5))
  } else {
    (p_a / p_c) +
      plot_layout(heights = c(2, 1.5))
  }

  panels <- panels +
    plot_layout(guides = "collect") +
    plot_annotation(
      title = paste(title_prefix, "— Recovery by Owner Type"),
      subtitle = paste(
        REF_LANDSCAPE, "/", REF_AGGREGATION,
        "| contbb + bb | rep", REF_REPLICATE,
        sprintf("| %d stands", nrow(resets))
      )
    ) &
    theme(legend.position = "bottom")

  save_fig(panels, fig_name, width = 14, height = 16)
}

# =============================================================================
# Generate both figures
# =============================================================================

build_recovery_fig(
  resets_full, state, d,
  "Full Devastation (vol < 10)",
  "fig_04_disturbance_recovery"
)

build_recovery_fig(
  partial_salvage, state, d,
  "Partial Salvage (vol > 10)",
  "fig_04b_partial_salvage_recovery"
)

cat("=== Fig 04 complete ===\n")
