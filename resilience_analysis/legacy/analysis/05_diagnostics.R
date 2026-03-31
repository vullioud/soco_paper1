# =============================================================================
# 05_diagnostics.R — Diagnostic figures for resilience pilot validation
#
# Ported from analysis_batch diagnostics + BB-specific validation plots.
# These figures validate that the simulation pipeline works correctly:
#
# D1: Full volume timeline (all years, all scenarios)
# D2: BB event timeline (killed volume, infested area per year)
# D3: Budget utilization rate by aggregation x owner type
# D4: Stand planning status by aggregation x owner type
# D5: Removal breakdown (thinning/final/salvage/disturbed) over time
# D6: Conifer share over time (BB susceptibility proxy)
#
# Run:  Rscript resilience_analysis/legacy/analysis/05_diagnostics.R
# =============================================================================

source("resilience_analysis/legacy/analysis/00_utils.R")
cat("=== Generating diagnostic figures ===\n")

COMBINED <- file.path("output", "_combined")
clean_agg <- function(x) gsub("^matched_", "", x)

run_filter <- function(df) {
  df %>% filter(grepl("outbreak", disturbance))
}

# =============================================================================
# D1: Full volume timeline — ALL years, ALL scenarios
#   Validates that: different landscapes diverge, different aggregation
#   scenarios differ, and BB outbreak produces a visible volume drop.
# =============================================================================
cat("  D1: Full volume timeline...\n")

stand_vol_file <- file.path(COMBINED, "stand_volume.csv")
if (file.exists(stand_vol_file)) {
  sv <- read.csv(stand_vol_file, stringsAsFactors = FALSE) %>%
    run_filter() %>%
    mutate(aggregation = clean_agg(aggregation))

  vol_ts <- sv %>%
    group_by(year, landscape, aggregation) %>%
    summarise(
      mean_vol = mean(volume, na.rm = TRUE),
      total_vol = sum(volume, na.rm = TRUE),
      .groups = "drop"
    )

  p_d1 <- ggplot(vol_ts, aes(x = year, y = mean_vol,
                              color = aggregation)) +
    geom_line(linewidth = 0.6) +
    annotate("rect",
             xmin = OUTBREAK_START, xmax = OUTBREAK_END,
             ymin = -Inf, ymax = Inf,
             fill = "red", alpha = 0.08) +
    geom_vline(xintercept = OUTBREAK_START,
               linetype = "dashed", color = "red", alpha = 0.4) +
    scale_color_manual(values = agg_colors, labels = agg_labels) +
    scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
    facet_wrap(~landscape, nrow = 1, scales = "free_y") +
    labs(
      title = "D1: Mean stand volume over full simulation",
      subtitle = paste0("Red band = outbreak window (yr ",
                        OUTBREAK_START, "-", OUTBREAK_END, ")"),
      x = "Year",
      y = expression(Mean ~ volume ~ (m^3 / ha)),
      color = "Scenario"
    ) +
    theme_resilience()

  save_fig(p_d1, "fig_D1_volume_timeline", width = 16, height = 6)
} else {
  cat("    SKIP: stand_volume.csv not found\n")
}


# =============================================================================
# D2: BB event timeline — killed volume & infested area per year
#   Validates that: BB is OFF during years 0-149, spikes during 150-210,
#   and drops to baseline after 211.
# =============================================================================
cat("  D2: BB event timeline...\n")

d <- load_resilience_data()
bb <- d$barkbeetle

if (nrow(bb) > 0) {
  bb_ts <- bb %>%
    group_by(year, landscape, aggregation) %>%
    summarise(
      mean_killed_vol = mean(killedVolume, na.rm = TRUE),
      mean_infested   = mean(infestedArea_ha, na.rm = TRUE),
      mean_bg_act     = mean(backgroundActivation_ha, na.rm = TRUE),
      .groups = "drop"
    )

  p_d2a <- ggplot(bb_ts, aes(x = year, y = mean_killed_vol,
                              color = aggregation)) +
    geom_line(linewidth = 0.5) +
    annotate("rect",
             xmin = OUTBREAK_START, xmax = OUTBREAK_END,
             ymin = -Inf, ymax = Inf,
             fill = "red", alpha = 0.08) +
    scale_color_manual(values = agg_colors, labels = agg_labels) +
    scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
    facet_wrap(~landscape, nrow = 1, scales = "free_y") +
    labs(x = NULL, y = "Killed volume (m3)",
         title = "A) BB killed volume per year") +
    theme_resilience(base_size = 9) +
    theme(legend.position = "none")

  p_d2b <- ggplot(bb_ts, aes(x = year, y = mean_infested,
                              color = aggregation)) +
    geom_line(linewidth = 0.5) +
    annotate("rect",
             xmin = OUTBREAK_START, xmax = OUTBREAK_END,
             ymin = -Inf, ymax = Inf,
             fill = "red", alpha = 0.08) +
    scale_color_manual(values = agg_colors, labels = agg_labels) +
    scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
    facet_wrap(~landscape, nrow = 1, scales = "free_y") +
    labs(x = NULL, y = "Infested area (ha)",
         title = "B) BB infested area per year") +
    theme_resilience(base_size = 9) +
    theme(legend.position = "none")

  p_d2c <- ggplot(bb_ts, aes(x = year, y = mean_bg_act,
                              color = aggregation)) +
    geom_line(linewidth = 0.5) +
    annotate("rect",
             xmin = OUTBREAK_START, xmax = OUTBREAK_END,
             ymin = -Inf, ymax = Inf,
             fill = "red", alpha = 0.08) +
    scale_color_manual(values = agg_colors, labels = agg_labels) +
    scale_x_continuous(breaks = seq(0, RECOVERY_END, 50)) +
    facet_wrap(~landscape, nrow = 1, scales = "free_y") +
    labs(x = "Year", y = "Background activation (ha)",
         title = "C) BB background activation per year") +
    theme_resilience(base_size = 9)

  p_d2 <- p_d2a / p_d2b / p_d2c +
    plot_layout(guides = "collect") +
    plot_annotation(
      title = "D2: Bark Beetle Event Timeline",
      subtitle = paste0("BB OFF yr 0-", OUTBREAK_START - 1,
                        " | Outbreak yr ", OUTBREAK_START,
                        "-", OUTBREAK_END,
                        " (prob 0.01) | Baseline yr ",
                        OUTBREAK_END + 1, "+")
    ) &
    theme(legend.position = "bottom")

  save_fig(p_d2, "fig_D2_bb_timeline", width = 16, height = 12)
} else {
  cat("    SKIP: no barkbeetle data\n")
}


# =============================================================================
# D3: Budget utilization rate by aggregation
#   From soco_decade_budget.csv — % budget spent per owner group over time.
# =============================================================================
cat("  D3: Budget utilization...\n")

bud_file <- file.path(COMBINED, "soco_decade_budget.csv")
if (file.exists(bud_file)) {
  bud_raw <- read.csv(bud_file, stringsAsFactors = FALSE) %>%
    run_filter() %>%
    mutate(aggregation = clean_agg(aggregation))

  if (nrow(bud_raw) > 0 &&
      all(c("budget_total", "budget_spent") %in% names(bud_raw))) {

    bud <- bud_raw %>%
      filter(budget_total > 0) %>%
      mutate(pct_used = budget_spent / budget_total * 100) %>%
      add_owner_group() %>%
      mutate(year_bin = floor(year / 20) * 20 + 10)

    bud_agg <- bud %>%
      group_by(year_bin, owner_group, landscape, aggregation) %>%
      summarise(
        mean_pct = mean(pct_used, na.rm = TRUE),
        p25_pct  = quantile(pct_used, 0.25, na.rm = TRUE),
        p75_pct  = quantile(pct_used, 0.75, na.rm = TRUE),
        .groups  = "drop"
      ) %>%
      filter(!is.na(owner_group))

    if (nrow(bud_agg) > 0) {
      p_d3 <- ggplot(bud_agg,
                     aes(x = year_bin, y = mean_pct)) +
        geom_ribbon(aes(ymin = p25_pct, ymax = p75_pct),
                    alpha = 0.15, fill = "steelblue") +
        geom_line(color = "steelblue", linewidth = 0.8) +
        geom_hline(yintercept = 100, linetype = "dashed",
                   color = "grey40", linewidth = 0.4) +
        annotate("rect",
                 xmin = OUTBREAK_START, xmax = OUTBREAK_END,
                 ymin = -Inf, ymax = Inf,
                 fill = "red", alpha = 0.08) +
        scale_x_continuous(
          breaks = seq(0, RECOVERY_END, 50)) +
        scale_y_continuous(limits = c(0, NA)) +
        facet_grid(aggregation ~ owner_group) +
        labs(
          title = "D3: Budget Utilization Rate (20yr bins)",
          subtitle = "Dashed line = 100% (fully binding)",
          x = "Year", y = "Budget utilization (%)"
        ) +
        theme_resilience(base_size = 9) +
        theme(strip.text.y = element_text(angle = 0))

      save_fig(p_d3, "fig_D3_budget_utilization",
               width = 14, height = 12)
    }
  }
} else {
  cat("    SKIP: soco_decade_budget.csv not found\n")
}


# =============================================================================
# D4: Stand planning status by aggregation
#   From soco_decade_snapshot.csv — fraction committed/ongoing/deferred/etc.
# =============================================================================
cat("  D4: Stand planning status...\n")

snap_file <- file.path(COMBINED, "soco_decade_snapshot.csv")
if (file.exists(snap_file)) {
  snap <- read.csv(snap_file, stringsAsFactors = FALSE) %>%
    run_filter() %>%
    mutate(aggregation = clean_agg(aggregation))

  if (nrow(snap) > 0 && "status" %in% names(snap)) {
    snap <- snap %>%
      add_owner_group() %>%
      mutate(year_bin = floor(year / 20) * 20 + 10)

    status_counts <- snap %>%
      count(year_bin, landscape, aggregation,
            owner_group, status) %>%
      group_by(year_bin, landscape, aggregation,
               owner_group) %>%
      mutate(frac = n / sum(n)) %>%
      ungroup() %>%
      filter(!is.na(owner_group)) %>%
      mutate(status = factor(status,
        levels = c("committed", "ongoing", "deferred",
                   "blocked", "set_aside", "idle")))

    status_colors_local <- c(
      committed  = "#2ca02c", ongoing  = "#1f77b4",
      blocked    = "#ff9896", deferred = "#d62728",
      set_aside  = "#8c564b", idle     = "#cccccc"
    )

    for (ls in unique(status_counts$landscape)) {
      pdata <- status_counts %>% filter(landscape == ls)

      p_d4 <- ggplot(pdata,
                     aes(x = year_bin, y = frac,
                         fill = status)) +
        geom_col(position = "stack", width = 16) +
        scale_fill_manual(values = status_colors_local) +
        scale_x_continuous(
          breaks = seq(0, RECOVERY_END, 50)) +
        scale_y_continuous(
          labels = scales::percent_format()) +
        annotate("rect",
                 xmin = OUTBREAK_START, xmax = OUTBREAK_END,
                 ymin = -Inf, ymax = Inf,
                 fill = "red", alpha = 0.08) +
        facet_grid(aggregation ~ owner_group) +
        labs(
          title = paste("D4: Stand Planning Status —", ls),
          subtitle = "20yr bins | fraction by planning status",
          x = "Year", y = "Fraction of stands",
          fill = "Status"
        ) +
        theme_resilience(base_size = 9) +
        theme(strip.text.y = element_text(angle = 0))

      save_fig(p_d4,
               paste0("fig_D4_stand_status_", ls),
               width = 14, height = 12)
    }
  }
} else {
  cat("    SKIP: soco_decade_snapshot.csv not found\n")
}


# =============================================================================
# D5: Removal breakdown over full simulation
# =============================================================================
cat("  D5: Removal breakdown...\n")

rem <- d$removal_summary
if (nrow(rem) > 0) {
  rem_long <- rem %>%
    pivot_longer(
      cols = c(vol_thinning, vol_final,
               vol_salvaged, vol_disturbed),
      names_to = "removal_type",
      values_to = "volume"
    ) %>%
    mutate(removal_type = factor(removal_type,
      levels = c("vol_thinning", "vol_final",
                 "vol_salvaged", "vol_disturbed"),
      labels = c("Thinning", "Final harvest",
                 "Salvaged", "Disturbed")))

  rem_agg <- rem_long %>%
    mutate(year_bin = floor(year / 10) * 10 + 5) %>%
    group_by(year_bin, landscape, aggregation,
             removal_type) %>%
    summarise(
      total_vol = sum(volume, na.rm = TRUE),
      .groups = "drop"
    )

  p_d5 <- ggplot(rem_agg,
                 aes(x = year_bin, y = total_vol,
                     fill = removal_type)) +
    geom_col(position = "stack", width = 8) +
    scale_fill_brewer(palette = "Set2") +
    scale_x_continuous(
      breaks = seq(0, RECOVERY_END, 50)) +
    annotate("rect",
             xmin = OUTBREAK_START, xmax = OUTBREAK_END,
             ymin = -Inf, ymax = Inf,
             fill = "red", alpha = 0.08) +
    facet_grid(landscape ~ aggregation, scales = "free_y") +
    labs(
      title = "D5: Removal Volume Breakdown (10yr bins)",
      x = "Year",
      y = expression(Volume ~ removed ~ (m^3)),
      fill = "Type"
    ) +
    theme_resilience(base_size = 9)

  save_fig(p_d5, "fig_D5_removal_breakdown",
           width = 16, height = 14)
} else {
  cat("    SKIP: no removal data\n")
}


# =============================================================================
# D6: Conifer share over time (BB susceptibility proxy)
# =============================================================================
cat("  D6: Conifer share over time...\n")

lm <- d$landscape_metrics
if (nrow(lm) > 0 && "conifer_ba_pct" %in% names(lm)) {
  p_d6 <- ggplot(lm,
                 aes(x = year,
                     y = as.numeric(conifer_ba_pct),
                     color = aggregation)) +
    geom_line(aes(group = run_id), linewidth = 0.5) +
    annotate("rect",
             xmin = OUTBREAK_START, xmax = OUTBREAK_END,
             ymin = -Inf, ymax = Inf,
             fill = "red", alpha = 0.08) +
    scale_color_manual(values = agg_colors,
                       labels = agg_labels) +
    scale_x_continuous(
      breaks = seq(0, RECOVERY_END, 50)) +
    facet_wrap(~landscape, nrow = 1, scales = "free_y") +
    labs(
      title = "D6: Conifer BA Share Over Time",
      subtitle = "Proxy for BB susceptibility",
      x = "Year", y = "Conifer BA (%)",
      color = "Scenario"
    ) +
    theme_resilience()

  save_fig(p_d6, "fig_D6_conifer_share",
           width = 16, height = 6)
} else {
  cat("    SKIP: no conifer data\n")
}

cat("=== Diagnostic figures complete ===\n")
