#!/usr/bin/env Rscript
# =============================================================================
# 02_outcomes: Outcome Figures B1-B5 — OAT Quad Plots
#
# 5 figures:
#   B1  DBH Gini (structural complexity) — with behavioral_type lines
#   B2  Species evenness (Gini-based) — adjusted y-axis
#   B3  Large-tree density (n_large_trees, continuous) — species-aware
#   B4  Annual harvest rate — volumeThinning vs volumeSalvaged separated
#   B5  Conifer share (% BA)
#
# B6 (decision diversity) REMOVED — removal.csv activity labels unreliable
#
# Run:  Rscript analysis_batch/scripts/02_outcomes.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== 02_outcomes: Outcome Figures B1-B5 (OAT quads) ===\n")
d <- load_all_data()
print_data_summary(d)

# =============================================================================
# FIG B1: DBH Gini — OAT quad with behavioral_type lines
# =============================================================================
cat("  B1: DBH Gini (OAT quad)\n")

ss <- d$soco_state

if (nrow(ss) > 0 && "dbh_gini" %in% names(ss)) {
  make_dbh_gini_plot <- function(data, var, pal, lab = NULL, ...) {
    # Overall mean by OAT variable
    agg <- data %>%
      group_by(year, .data[[var]]) %>%
      summarise(mean_gini = mean(dbh_gini, na.rm = TRUE),
                sd_gini   = sd(dbh_gini, na.rm = TRUE),
                .groups = "drop")

    # Per behavioral_type mean (for type lines)
    agg_type <- data %>%
      group_by(year, .data[[var]], behavioral_type) %>%
      summarise(mean_gini = mean(dbh_gini, na.rm = TRUE),
                .groups = "drop")

    p <- ggplot() +
      # Thin lines per behavioral_type
      geom_line(data = agg_type,
                aes(x = year, y = mean_gini,
                    color = behavioral_type,
                    linetype = .data[[var]]),
                linewidth = 0.4, alpha = 0.6) +
      # Thick line for overall mean per OAT level
      geom_line(data = agg,
                aes(x = year, y = mean_gini,
                    linetype = .data[[var]]),
                linewidth = 1.0, color = "black") +
      scale_color_manual(values = btype_palette, labels = btype_labels) +
      labs(x = "Year", y = "DBH Gini (mean)",
           color = "Agent type", linetype = var) +
      theme_soco(base_size = 9)
    p
  }

  pB1 <- build_oat_quad(make_dbh_gini_plot, ss,
                         title = "DBH Gini — black = overall mean, colored = per agent type")
  save_fig(pB1, "fig_B1_dbh_gini_oat", width = 12, height = 14)
} else {
  cat("    (no soco_state or dbh_gini column — skipping)\n")
}

# =============================================================================
# FIG B2: Species Evenness (Gini) — OAT quad, adjusted y-axis
# =============================================================================
cat("  B2: Species Evenness (OAT quad)\n")

sp_gini <- d$sp_gini

if (nrow(sp_gini) > 0 && "species_evenness" %in% names(sp_gini)) {
  make_sp_evenness_plot <- function(data, var, pal, lab = NULL, ...) {
    agg <- data %>%
      group_by(year, .data[[var]]) %>%
      summarise(mean_evenness = mean(species_evenness, na.rm = TRUE),
                q25 = quantile(species_evenness, 0.25, na.rm = TRUE),
                q75 = quantile(species_evenness, 0.75, na.rm = TRUE),
                .groups = "drop")

    p <- ggplot(agg, aes(x = year, y = mean_evenness,
                          color = .data[[var]])) +
      geom_ribbon(aes(ymin = q25, ymax = q75,
                      fill = .data[[var]]),
                  alpha = 0.08, color = NA) +
      geom_line(linewidth = 0.7) +
      scale_color_manual(values = pal,
                         labels = if (!is.null(lab)) lab else waiver()) +
      scale_fill_manual(values = pal,
                        labels = if (!is.null(lab)) lab else waiver()) +
      coord_cartesian(ylim = c(0, 0.5)) +
      labs(x = "Year", y = "Species Evenness (mean, IQR)",
           color = var, fill = var) +
      theme_soco(base_size = 9)
    p
  }

  pB2 <- build_oat_quad(make_sp_evenness_plot, sp_gini,
                         title = "Species Evenness (1-Gini) — rapid early decline is natural succession, not BB")
  save_fig(pB2, "fig_B2_species_evenness_oat", width = 12, height = 14)
} else {
  cat("    (no sp_gini or species_evenness column — skipping)\n")
}

# =============================================================================
# FIG B3: Large-Tree Density — OAT quad (continuous n_large_trees)
# =============================================================================
cat("  B3: Large-tree density (OAT quad)\n")

if (nrow(ss) > 0 && "n_large_trees" %in% names(ss)) {
  make_largetree_plot <- function(data, var, pal, lab = NULL, ...) {
    agg <- data %>%
      group_by(year, .data[[var]]) %>%
      summarise(
        mean_lt = mean(n_large_trees, na.rm = TRUE),
        q25     = quantile(n_large_trees, 0.25, na.rm = TRUE),
        q75     = quantile(n_large_trees, 0.75, na.rm = TRUE),
        .groups = "drop"
      )

    p <- ggplot(agg, aes(x = year, y = mean_lt, color = .data[[var]])) +
      geom_ribbon(aes(ymin = q25, ymax = q75,
                      fill = .data[[var]]),
                  alpha = 0.08, color = NA) +
      geom_line(linewidth = 0.7) +
      scale_color_manual(values = pal,
                         labels = if (!is.null(lab)) lab else waiver()) +
      scale_fill_manual(values = pal,
                        labels = if (!is.null(lab)) lab else waiver()) +
      labs(x = "Year",
           y = "Large trees (n/ha, DBH >= 40cm, mean + IQR)",
           color = var, fill = var) +
      theme_soco(base_size = 9)
    p
  }

  pB3 <- build_oat_quad(make_largetree_plot, ss,
                         title = "Large-Tree Density (n trees with DBH >= 40cm)")
  save_fig(pB3, "fig_B3_largetree_density_oat", width = 12, height = 14)

  # --- B3b: Mean DBH and max_dbh by landscape (species-aware context) ---
  make_dbh_plot <- function(data, var, pal, lab = NULL, ...) {
    agg <- data %>%
      group_by(year, .data[[var]]) %>%
      summarise(
        mean_dbh = mean(mean_dbh, na.rm = TRUE),
        mean_max_dbh = mean(max_dbh, na.rm = TRUE),
        .groups = "drop"
      ) %>%
      pivot_longer(cols = c(mean_dbh, mean_max_dbh),
                   names_to = "metric",
                   values_to = "value") %>%
      mutate(metric = factor(metric,
                             levels = c("mean_dbh", "mean_max_dbh"),
                             labels = c("Mean DBH", "Mean max DBH")))

    p <- ggplot(agg, aes(x = year, y = value, color = .data[[var]])) +
      geom_line(linewidth = 0.7) +
      scale_color_manual(values = pal,
                         labels = if (!is.null(lab)) lab else waiver()) +
      facet_wrap(~metric, scales = "free_y") +
      labs(x = "Year", y = "DBH (cm)", color = var) +
      theme_soco(base_size = 9)
    p
  }

  pB3b <- build_oat_quad(make_dbh_plot, ss,
                          title = "DBH Metrics — Mean DBH and Mean max DBH")
  save_fig(pB3b, "fig_B3b_dbh_metrics_oat", width = 14, height = 14)

} else {
  cat("    (missing n_large_trees column — skipping)\n")
}

# =============================================================================
# FIG B4: Annual Harvest Rate — volumeThinning vs volumeSalvaged SEPARATED
#   volumeSalvaged == volumeDisturbed always (iLand C++ bug: no disturbanceCondition)
#   These must be shown separately — salvaged is already-dead timber
# =============================================================================
cat("  B4: Annual Harvest Rate (OAT quad)\n")

removal <- d$removal

if (nrow(removal) > 0) {
  make_harvest_plot <- function(data, var, pal, lab = NULL, ...) {
    harv <- data %>%
      mutate(
        vol_thinning = replace_na(volumeThinning, 0),
        vol_salvaged = replace_na(volumeSalvaged, 0)
      ) %>%
      group_by(year, .data[[var]]) %>%
      summarise(
        thinning = sum(vol_thinning, na.rm = TRUE),
        salvaged = sum(vol_salvaged, na.rm = TRUE),
        .groups = "drop"
      ) %>%
      pivot_longer(cols = c(thinning, salvaged),
                   names_to = "harvest_type",
                   values_to = "volume") %>%
      mutate(harvest_type = factor(harvest_type,
                                   levels = c("salvaged", "thinning"),
                                   labels = c("Salvaged (dead timber)", "Management harvest")))

    p <- ggplot(harv, aes(x = year, y = volume, fill = harvest_type)) +
      geom_area(alpha = 0.7, position = "stack") +
      facet_wrap(as.formula(paste("~", var)), ncol = 1, scales = "free_y") +
      scale_fill_manual(values = c("Management harvest" = "#1f77b4",
                                   "Salvaged (dead timber)" = "#bcbd22")) +
      labs(x = "Year",
           y = expression(Harvest ~ volume ~ (m^3)),
           fill = "Type") +
      theme_soco(base_size = 9)
    p
  }

  pB4 <- build_oat_quad(make_harvest_plot, removal,
                         title = "Annual Harvest — Management (volumeThinning) vs Salvaged (= volumeDisturbed, dead timber)")
  save_fig(pB4, "fig_B4_annual_harvest_oat", width = 12, height = 16)
} else {
  cat("    (no removal data — skipping)\n")
}

# =============================================================================
# FIG B5: Conifer Share — OAT quad
# =============================================================================
cat("  B5: Conifer Share (OAT quad)\n")

sp_land <- d$sp_land

if (nrow(sp_land) > 0) {
  make_conifer_plot <- function(data, var, pal, lab = NULL, ...) {
    con <- data %>%
      group_by(year, .data[[var]]) %>%
      summarise(
        conifer_ba = sum(total_ba[species %in% conifers], na.rm = TRUE),
        total_ba   = sum(total_ba, na.rm = TRUE),
        .groups = "drop"
      ) %>%
      mutate(conifer_pct = conifer_ba / total_ba * 100)

    p <- ggplot(con, aes(x = year, y = conifer_pct,
                          color = .data[[var]])) +
      geom_line(linewidth = 0.7) +
      geom_hline(yintercept = c(30, 70), linetype = "dashed",
                 color = "grey50", linewidth = 0.4) +
      scale_color_manual(values = pal,
                         labels = if (!is.null(lab)) lab else waiver()) +
      labs(x = "Year", y = "Conifer share (%)",
           color = var) +
      theme_soco(base_size = 9)
    p
  }

  pB5 <- build_oat_quad(make_conifer_plot, sp_land,
                         title = "Conifer Basal Area Share (%)")
  save_fig(pB5, "fig_B5_conifer_share_oat", width = 12, height = 14)
} else {
  cat("    (no sp_land data — skipping)\n")
}

# B6 REMOVED — removal.csv activity labels unreliable (72.6% mislabeled as "salvage")

cat("=== 02_outcomes complete (5 figures: B1-B5) ===\n")
