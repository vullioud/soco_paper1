#!/usr/bin/env Rscript
# =============================================================================
# 05_budget_diagnostics: Budget Utilization & Stand Status
#
# Two figures:
#   D1  Budget utilization rate (% spent) by disturbance x owner group
#       Shows whether budget is binding or slack over time.
#   D2  Stand status composition over time by disturbance x owner group
#       Decomposes: committed, ongoing, deferred, blocked, set_aside, idle.
#
# Run:  Rscript analysis_batch/scripts/05_budget_diagnostics.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== 05_budget_diagnostics ===\n")
d <- load_all_data()
print_data_summary(d)

REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"

# =============================================================================
# FIG D1: Budget Utilization Rate (% spent) over time
#   Smoothed with rolling mean (20-year window) to absorb decade-offset jitter.
#   Facet: owner_group (cols) x disturbance (rows)
#   Dashed line at 100% = fully binding
# =============================================================================
cat("  D1: Budget utilization rate\n")

if (nrow(d$decade_budget) > 0) {

  bud <- d$decade_budget %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           replicate == 1) %>%
    filter(budget_total > 0) %>%
    mutate(pct_used = budget_spent / budget_total * 100) %>%
    add_owner_group()

  if (nrow(bud) > 0) {

    # Aggregate per (year, owner_group, disturbance) — use 20-year bins
    bud <- bud %>%
      mutate(year_bin = floor(year / 20) * 20 + 10)  # center of 20-yr window

    bud_agg <- bud %>%
      group_by(year_bin, owner_group, disturbance) %>%
      summarise(
        mean_pct  = mean(pct_used, na.rm = TRUE),
        p25_pct   = quantile(pct_used, 0.25, na.rm = TRUE),
        p75_pct   = quantile(pct_used, 0.75, na.rm = TRUE),
        n_obs     = n(),
        .groups = "drop"
      ) %>%
      filter(n_obs >= 3) %>%
      mutate(
        owner_group = factor(owner_group,
          levels = c("State", "Corporate", "Small private")),
        dist_label = factor(disturbance,
          levels = c("nod", "contbb", "bb"),
          labels = c(dist_labels["nod"], dist_labels["contbb"], dist_labels["bb"]))
      )

    p_d1 <- ggplot(bud_agg,
                   aes(x = year_bin, y = mean_pct)) +
      geom_ribbon(aes(ymin = p25_pct, ymax = p75_pct), alpha = 0.15, fill = "steelblue") +
      geom_line(color = "steelblue", linewidth = 0.8) +
      geom_point(color = "steelblue", size = 1.2) +
      geom_hline(yintercept = 100, linetype = "dashed", color = "grey40", linewidth = 0.4) +
      scale_x_continuous(breaks = seq(0, 200, 50)) +
      scale_y_continuous(limits = c(0, NA)) +
      facet_grid(dist_label ~ owner_group, scales = "free_y") +
      labs(
        title = paste("Budget Utilization Rate:",
                      REF_LANDSCAPE, "/", REF_AGGREGATION),
        subtitle = "20-year bins | dot = mean % spent | ribbon = IQR across agents | dashed = 100% (fully binding)",
        x = "Year",
        y = "Budget utilization (%)"
      ) +
      theme_soco() +
      theme(strip.text.y = element_text(angle = 0))

    save_fig(p_d1, "fig_D1_budget_utilization", width = 12, height = 8)

  } else {
    cat("    (no budget data after filtering -- skipping D1)\n")
  }
} else {
  cat("    (decade_budget missing -- skipping D1)\n")
}


# =============================================================================
# FIG D2: Stand Status Composition over time
#   From decade_snap: per (year_bin, disturbance, owner_group), compute fraction
#   of stands in each status. Stacked bar chart, 20-year bins.
#   Facet: disturbance (rows) x owner_group (cols)
# =============================================================================
cat("  D2: Stand status composition\n")

if (nrow(d$decade_snap) > 0) {

  snap <- d$decade_snap %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           replicate == 1) %>%
    add_owner_group() %>%
    mutate(year_bin = floor(year / 20) * 20 + 10)

  if (nrow(snap) > 0 && "status" %in% names(snap)) {

    # Count per (year_bin, disturbance, owner_group, status)
    status_counts <- snap %>%
      count(year_bin, disturbance, owner_group, status) %>%
      group_by(year_bin, disturbance, owner_group) %>%
      mutate(frac = n / sum(n)) %>%
      ungroup() %>%
      mutate(
        status = factor(status,
          levels = c("committed", "ongoing", "deferred", "blocked", "set_aside", "idle")),
        owner_group = factor(owner_group,
          levels = c("State", "Corporate", "Small private")),
        dist_label = factor(disturbance,
          levels = c("nod", "contbb", "bb"),
          labels = c(dist_labels["nod"], dist_labels["contbb"], dist_labels["bb"]))
      )

    status_labels <- c(
      committed = "Committed (new)",
      ongoing   = "Ongoing (sequence)",
      deferred  = "Deferred",
      blocked   = "Blocked (phase wait)",
      set_aside = "Set aside",
      idle      = "Idle"
    )

    p_d2 <- ggplot(status_counts,
                   aes(x = year_bin, y = frac, fill = status)) +
      geom_col(position = "stack", width = 16) +
      scale_fill_manual(values = status_colors, labels = status_labels) +
      scale_x_continuous(breaks = seq(0, 200, 50)) +
      scale_y_continuous(labels = percent_format()) +
      facet_grid(dist_label ~ owner_group) +
      labs(
        title = paste("Stand Planning Status:",
                      REF_LANDSCAPE, "/", REF_AGGREGATION),
        subtitle = "20-year bins | fraction of stands by planning status | rep 1",
        x = "Year",
        y = "Fraction of stands",
        fill = "Status"
      ) +
      theme_soco() +
      theme(strip.text.y = element_text(angle = 0))

    save_fig(p_d2, "fig_D2_stand_status_composition", width = 12, height = 8)

  } else {
    cat("    (decade_snap missing status column -- skipping D2)\n")
  }
} else {
  cat("    (decade_snap missing -- skipping D2)\n")
}

cat("=== 05_budget_diagnostics complete ===\n")
