#!/usr/bin/env Rscript
# =============================================================================
# 01_validation: Validation Figures (A1-A5)
#
# Produces 5 figures for the appendix / validation section:
#   A1  Activity timelines (volume + cognitive activity dots per stand)
#   A2  Deferral rate by disturbance (x = year, to 200)
#   A2b Deferral rate by agent type
#   A3  Budget allocation (salvage / regular / unspent)
#   A4  Decision heterogeneity (activity mix from cognitive decisions)
#   A5  Landscape status heatmap
#
# Run:  Rscript analysis_batch/scripts/01_validation.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== 01_validation: Validation Figures (A1-A5) ===\n")
d <- load_all_data()
print_data_summary(d)

# --- Reference scenario constants ---
REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"
REF_DISTURBANCE <- "contbb"
REF_REPLICATE   <- 1

# =============================================================================
# FIG A1: Activity Timelines
#   Volume line from soco_state + activity dots from soco_ml_activities
#   Uses COGNITIVE activity names (not removal.csv which is unreliable)
#   Filter: CL10, High, contbb, replicate 1
#   3 stands per behavioral_type (seed=123) -> 15 panels
# =============================================================================
cat("  A1: Activity timelines\n")

if (nrow(d$soco_state) > 0 && nrow(d$ml_activities) > 0) {

  state_ref <- d$soco_state %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           disturbance == REF_DISTURBANCE,
           replicate == REF_REPLICATE)

  ml_ref <- d$ml_activities %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           disturbance == REF_DISTURBANCE,
           replicate == REF_REPLICATE,
           activity_name != "none")

  if (nrow(state_ref) > 0) {

    # Sample 3 stands per type
    sel_a1 <- sample_stands(state_ref, n_per_type = 3, seed = 123)

    # Volume trajectory (decadal, from soco_state)
    vol_line <- state_ref %>%
      filter(stand_id %in% sel_a1) %>%
      select(stand_id, behavioral_type, year, volume) %>%
      mutate(stand_label = paste0(behavioral_type, " / ", stand_id))

    # Activity dots from cognitive decisions (ml_activities)
    act_dots <- ml_ref %>%
      filter(stand_id %in% sel_a1) %>%
      mutate(
        stand_label = paste0(behavioral_type, " / ", stand_id),
        is_salvage = grepl("^salvage", activity_name),
        # Use volume_t0 as y position (pre-activity volume)
        vol_y = as.numeric(volume_t0)
      )

    # Sequenced activities: mark sequence steps
    act_dots <- act_dots %>%
      mutate(
        seq_label = ifelse(is_sequence == 1,
                           paste0(activity_name, " [", sequence_step, "]"),
                           activity_name)
      )

    # Build consistent facet ordering by behavioral_type
    label_order <- vol_line %>%
      distinct(stand_label, behavioral_type) %>%
      arrange(factor(behavioral_type,
                     levels = c("MF", "OP", "TR", "PA", "EN")),
              stand_label) %>%
      pull(stand_label)

    vol_line$stand_label <- factor(vol_line$stand_label, levels = label_order)
    if (nrow(act_dots) > 0) {
      act_dots$stand_label <- factor(act_dots$stand_label, levels = label_order)
    }

    # Palette for activities present
    present_act <- unique(act_dots$activity_name)
    act_pal <- activity_colors[names(activity_colors) %in% present_act]
    for (a in setdiff(present_act, names(act_pal))) act_pal[a] <- "#999999"

    p_a1 <- ggplot(vol_line, aes(x = year, y = volume)) +
      geom_line(color = "grey50", linewidth = 0.5) +
      facet_wrap(~stand_label, ncol = 3, scales = "free_y") +
      labs(
        title = paste("Activity Timelines:", REF_LANDSCAPE, "/",
                      REF_AGGREGATION, "/", REF_DISTURBANCE,
                      "/ rep", REF_REPLICATE),
        subtitle = "3 stands per type | line = decadal volume, dots = cognitive activity decisions (soco_ml_activities)",
        x = "Year",
        y = expression(Volume ~ (m^3 / ha)),
        color = "Activity", shape = "Event type"
      ) +
      theme_soco() +
      guides(color = guide_legend(nrow = 2))

    if (nrow(act_dots) > 0) {
      p_a1 <- p_a1 +
        geom_point(
          data = act_dots %>% filter(!is_salvage),
          aes(x = year, y = vol_y, color = activity_name),
          shape = 16, size = 2.5
        ) +
        geom_point(
          data = act_dots %>% filter(is_salvage),
          aes(x = year, y = vol_y, color = activity_name),
          shape = 17, size = 3
        ) +
        scale_color_manual(values = act_pal)

      # Add sequence step annotations for sequenced activities
      seq_dots <- act_dots %>% filter(is_sequence == 1)
      if (nrow(seq_dots) > 0) {
        p_a1 <- p_a1 +
          geom_text(
            data = seq_dots,
            aes(x = year, y = vol_y, label = sequence_step),
            size = 2, vjust = -1.2, color = "grey30"
          )
      }
    }

    save_fig(p_a1, "fig_A1_activity_timelines", width = 14, height = 12)

  } else {
    cat("    (no soco_state rows for reference scenario -- skipping A1)\n")
  }
} else {
  cat("    (soco_state or ml_activities data missing -- skipping A1)\n")
}


# =============================================================================
# FIG A2: Deferral Rate by Disturbance
#   Filter: CL10, High, ALL 3 disturbance scenarios
#   X-axis: YEAR (not decade_step), to 200
#   From decade_snap: per (year, behavioral_type, disturbance)
#   deferral rate = n_deferred / n_managed * 100
# =============================================================================
cat("  A2: Deferral rate by disturbance\n")

if (nrow(d$decade_snap) > 0) {

  snap_a2 <- d$decade_snap %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION)

  if (nrow(snap_a2) > 0) {

    # Compute deferral rate per (year, behavioral_type, disturbance)
    managed_a2 <- snap_a2 %>%
      filter(status != "set_aside") %>%
      count(year, behavioral_type, disturbance, name = "n_managed")

    deferred_a2 <- snap_a2 %>%
      filter(status == "deferred") %>%
      count(year, behavioral_type, disturbance, name = "n_deferred")

    defer_rate_a2 <- left_join(managed_a2, deferred_a2,
      by = c("year", "behavioral_type", "disturbance"))
    defer_rate_a2$n_deferred[is.na(defer_rate_a2$n_deferred)] <- 0
    defer_rate_a2$pct <- defer_rate_a2$n_deferred /
      pmax(defer_rate_a2$n_managed, 1) * 100

    defer_rate_a2$behavioral_type <- factor(defer_rate_a2$behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN"))

    p_a2 <- ggplot(defer_rate_a2,
                   aes(x = year, y = pct, color = disturbance)) +
      geom_smooth(method = "loess", se = FALSE, span = 0.3,
                  linewidth = 0.8) +
      scale_color_manual(values = dist_colors, labels = dist_labels) +
      scale_x_continuous(limits = c(0, 200), breaks = seq(0, 200, 50)) +
      facet_wrap(~behavioral_type, nrow = 1) +
      labs(
        title = paste("Deferral Rate by Disturbance:",
                      REF_LANDSCAPE, "/", REF_AGGREGATION),
        x = "Year",
        y = "Deferred (%)",
        color = "Disturbance"
      ) +
      theme_soco()

    save_fig(p_a2, "fig_A2_deferral_disturbance", width = 16, height = 5)

    # --- A2b: Deferral rate by agent type (individual agents) ---
    # For reference scenario only, thin lines per agent, thick per type mean
    snap_ref <- snap_a2 %>%
      filter(disturbance == REF_DISTURBANCE)

    if (nrow(snap_ref) > 0) {
      # Per-agent deferral rate
      agent_managed <- snap_ref %>%
        filter(status != "set_aside") %>%
        count(year, agent_id, behavioral_type, name = "n_managed")

      agent_deferred <- snap_ref %>%
        filter(status == "deferred") %>%
        count(year, agent_id, behavioral_type, name = "n_deferred")

      agent_defer <- left_join(agent_managed, agent_deferred,
                               by = c("year", "agent_id", "behavioral_type"))
      agent_defer$n_deferred[is.na(agent_defer$n_deferred)] <- 0
      agent_defer$pct <- agent_defer$n_deferred /
        pmax(agent_defer$n_managed, 1) * 100

      agent_defer$behavioral_type <- factor(agent_defer$behavioral_type,
        levels = c("MF", "OP", "TR", "PA", "EN"))

      # Type mean
      type_mean <- agent_defer %>%
        group_by(year, behavioral_type) %>%
        summarise(pct = mean(pct, na.rm = TRUE), .groups = "drop")

      p_a2b <- ggplot() +
        geom_line(data = agent_defer,
                  aes(x = year, y = pct, group = agent_id),
                  alpha = 0.15, linewidth = 0.3, color = "grey50") +
        geom_smooth(data = type_mean,
                    aes(x = year, y = pct, color = behavioral_type),
                    method = "loess", se = FALSE, span = 0.3,
                    linewidth = 1.2) +
        scale_color_manual(values = btype_palette, labels = btype_labels) +
        scale_x_continuous(limits = c(0, 200), breaks = seq(0, 200, 50)) +
        facet_wrap(~behavioral_type, nrow = 1) +
        labs(
          title = paste("Deferral Rate by Agent:",
                        REF_LANDSCAPE, "/", REF_AGGREGATION, "/",
                        REF_DISTURBANCE),
          subtitle = "Thin lines = individual agents, thick = type mean",
          x = "Year",
          y = "Deferred (%)",
          color = "Type"
        ) +
        theme_soco() +
        theme(legend.position = "none")

      save_fig(p_a2b, "fig_A2b_deferral_by_agent", width = 16, height = 5)
    }

  } else {
    cat("    (no decade_snap rows for CL10/High -- skipping A2)\n")
  }
} else {
  cat("    (no decade_snap data -- skipping A2)\n")
}


# =============================================================================
# FIG A3: Budget Allocation -- Salvage / Regular / Unspent
#   Filter: CL10, High, contbb vs nod
#   Estimate salvage spending from ml_activities x activity_costs
#   facet_grid: disturbance (rows) x behavioral_type (cols)
# =============================================================================
cat("  A3: Budget allocation\n")

if (nrow(d$decade_budget) > 0 && nrow(d$decade_snap) > 0) {

  budget_a3 <- d$decade_budget %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           disturbance %in% c("contbb", "nod"))

  if (nrow(budget_a3) > 0 &&
      all(c("budget_spent", "budget_remaining") %in% names(budget_a3))) {

    # Estimate salvage spending from ml_activities
    # Activity costs (from activity_costs.json)
    salvage_costs <- c(salvage = 4, salvage_clearcut = 10, salvage_leave = 0)

    ml_salvage <- d$ml_activities %>%
      filter(landscape == REF_LANDSCAPE,
             aggregation == REF_AGGREGATION,
             disturbance %in% c("contbb", "nod"),
             grepl("^salvage", activity_name)) %>%
      mutate(salvage_cost = case_when(
        activity_name == "salvage_clearcut" ~ 10,
        activity_name == "salvage" ~ 4,
        TRUE ~ 0
      ))

    # Aggregate salvage cost per agent per year
    salvage_by_agent <- ml_salvage %>%
      group_by(agent_id, year, behavioral_type, disturbance) %>%
      summarise(total_salvage_cost = sum(salvage_cost, na.rm = TRUE),
                .groups = "drop")

    # Join budget with salvage cost
    budget_merged <- budget_a3 %>%
      left_join(salvage_by_agent,
                by = c("agent_id", "year", "behavioral_type", "disturbance"))
    budget_merged$total_salvage_cost[is.na(budget_merged$total_salvage_cost)] <- 0

    # Compute: salvage_spend, regular_spend, unspent
    budget_merged <- budget_merged %>%
      mutate(
        salvage_spend = pmin(total_salvage_cost, budget_spent),
        regular_spend = pmax(budget_spent - salvage_spend, 0)
      )

    # Aggregate: mean per (year, behavioral_type, disturbance)
    budget_agg <- budget_merged %>%
      group_by(year, behavioral_type, disturbance) %>%
      summarise(
        salvage    = mean(salvage_spend, na.rm = TRUE),
        regular    = mean(regular_spend, na.rm = TRUE),
        remaining  = mean(budget_remaining, na.rm = TRUE),
        .groups = "drop"
      )

    # Pivot to long for stacked bar
    budget_long <- budget_agg %>%
      pivot_longer(cols = c(remaining, regular, salvage),
                   names_to = "category",
                   values_to = "budget_points") %>%
      mutate(
        category = factor(category,
                          levels = c("remaining", "regular", "salvage"),
                          labels = c("Unspent", "Regular", "Salvage")),
        behavioral_type = factor(behavioral_type,
          levels = c("MF", "OP", "TR", "PA", "EN")),
        dist_label = factor(disturbance,
          levels = c("contbb", "nod"),
          labels = c(dist_labels["contbb"], dist_labels["nod"]))
      )

    budget_pal <- c(Salvage = "#bcbd22", Regular = "#1f77b4", Unspent = "#cccccc")

    p_a3 <- ggplot(budget_long,
                   aes(x = year, y = budget_points, fill = category)) +
      geom_col(position = "stack") +
      scale_fill_manual(values = budget_pal) +
      scale_x_continuous(breaks = seq(0, 200, 50)) +
      facet_grid(dist_label ~ behavioral_type) +
      labs(
        title = paste("Budget Allocation:",
                      REF_LANDSCAPE, "/", REF_AGGREGATION,
                      "| contbb vs nod"),
        subtitle = "Mean across agents per type | Salvage estimated from cognitive decisions x cost table",
        x = "Year",
        y = "Budget points",
        fill = "Category"
      ) +
      theme_soco() +
      theme(strip.text.y = element_text(angle = 0))

    save_fig(p_a3, "fig_A3_budget_allocation", width = 16, height = 8)

  } else {
    cat("    (budget data missing required columns -- skipping A3)\n")
  }
} else {
  cat("    (decade_budget or decade_snap data missing -- skipping A3)\n")
}


# =============================================================================
# FIG A4: Decision Heterogeneity
#   Uses COGNITIVE activity names from soco_ml_activities (not removal.csv)
#   Filter: CL10, High, contbb
#   Left panel: stacked bar of activity frequencies per behavioral_type
#   Right panel: per-agent Simpson D boxplot by type
# =============================================================================
cat("  A4: Decision heterogeneity\n")

if (nrow(d$ml_activities) > 0) {

  ml_a4 <- d$ml_activities %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           disturbance == REF_DISTURBANCE,
           activity_name != "none")

  if (nrow(ml_a4) > 0) {

    ml_a4$behavioral_type <- factor(ml_a4$behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN"))

    # --- Left panel: activity frequency (% of events per type) ---
    act_freq <- ml_a4 %>%
      count(behavioral_type, activity_name, name = "n") %>%
      group_by(behavioral_type) %>%
      mutate(pct = n / sum(n) * 100) %>%
      ungroup()

    # Palette for activities present
    present_act4 <- unique(act_freq$activity_name)
    act_pal4 <- activity_colors[names(activity_colors) %in% present_act4]
    for (a in setdiff(present_act4, names(act_pal4))) act_pal4[a] <- "#999999"

    p_left <- ggplot(act_freq,
                     aes(x = behavioral_type, y = pct,
                         fill = activity_name)) +
      geom_col(position = "stack") +
      scale_fill_manual(values = act_pal4) +
      labs(
        title = "Activity Mix (cognitive decisions)",
        x = "Behavioral type",
        y = "Events (%)",
        fill = "Activity"
      ) +
      theme_soco() +
      guides(fill = guide_legend(ncol = 2))

    # --- Right panel: Simpson D per agent, boxplot by type ---
    agent_div <- ml_a4 %>%
      count(replicate, behavioral_type, agent_id, activity_name,
            name = "n_events") %>%
      group_by(replicate, behavioral_type, agent_id) %>%
      mutate(
        total = sum(n_events),
        p_i   = n_events / total
      ) %>%
      summarise(
        simpson_d = 1 - sum(p_i^2),
        .groups = "drop"
      )

    p_right <- ggplot(agent_div,
                      aes(x = behavioral_type, y = simpson_d,
                          fill = behavioral_type)) +
      geom_boxplot(outlier.size = 1, outlier.alpha = 0.5) +
      scale_fill_manual(values = btype_palette) +
      labs(
        title = "Simpson's D (per agent)",
        x = "Behavioral type",
        y = "Simpson's D"
      ) +
      theme_soco() +
      theme(legend.position = "none")

    p_a4 <- p_left + p_right +
      plot_layout(widths = c(1.2, 1)) +
      plot_annotation(
        title = paste("Decision Heterogeneity:",
                      REF_LANDSCAPE, "/", REF_AGGREGATION, "/",
                      REF_DISTURBANCE),
        subtitle = "Based on cognitive activity decisions (soco_ml_activities)",
        caption = "Source: soco_ml_activities.csv (NOT removal.csv)"
      )

    save_fig(p_a4, "fig_A4_decision_heterogeneity", width = 14, height = 6)

  } else {
    cat("    (no ml_activities rows for reference scenario -- skipping A4)\n")
  }
} else {
  cat("    (ml_activities data missing -- skipping A4)\n")
}


# =============================================================================
# FIG A5: Landscape Status Heatmap
#   Filter: CL10, High, contbb, replicate 1
#   geom_tile: x=year, y=stand (ordered by behavioral_type), fill=status
# =============================================================================
cat("  A5: Landscape status heatmap\n")

if (nrow(d$decade_snap) > 0) {

  snap_a5 <- d$decade_snap %>%
    filter(landscape == REF_LANDSCAPE,
           aggregation == REF_AGGREGATION,
           disturbance == REF_DISTURBANCE,
           replicate == REF_REPLICATE)

  if (nrow(snap_a5) > 0) {

    # Filter out set_aside for the heatmap
    snap_a5 <- snap_a5 %>% filter(status != "set_aside")
    snap_a5$status <- factor(snap_a5$status,
      levels = c("committed", "ongoing", "blocked",
                 "deferred", "set_aside", "idle"))

    # Order stands by behavioral_type then stand_id
    stand_order_a5 <- snap_a5 %>%
      distinct(stand_id, behavioral_type) %>%
      arrange(factor(behavioral_type,
                     levels = c("MF", "OP", "TR", "PA", "EN")),
              stand_id) %>%
      mutate(stand_rank = row_number())

    df_heat <- snap_a5 %>%
      inner_join(stand_order_a5, by = c("stand_id", "behavioral_type"))

    # Type group boundaries for horizontal lines + labels
    type_bounds <- stand_order_a5 %>%
      group_by(behavioral_type) %>%
      summarise(
        ymin = min(stand_rank),
        ymax = max(stand_rank),
        ymid = mean(stand_rank),
        .groups = "drop"
      )

    p_a5 <- ggplot(df_heat,
                   aes(x = year, y = stand_rank, fill = status)) +
      geom_tile() +
      scale_fill_manual(values = status_colors, drop = FALSE) +
      scale_x_continuous(breaks = seq(0, 200, 50)) +
      geom_hline(data = type_bounds,
                 aes(yintercept = ymax + 0.5),
                 color = "black", linewidth = 0.5) +
      annotate("text", x = 0, y = type_bounds$ymid,
               label = type_bounds$behavioral_type,
               hjust = 1, size = 3, fontface = "bold") +
      labs(
        title = paste("Landscape Status Heatmap:",
                      REF_LANDSCAPE, "/", REF_AGGREGATION, "/",
                      REF_DISTURBANCE, "/ rep", REF_REPLICATE),
        subtitle = "All managed stands, ordered by behavioral type",
        x = "Year",
        y = "Stand (ordered by type)",
        fill = "Status"
      ) +
      theme_soco() +
      theme(
        axis.text.y  = element_blank(),
        axis.ticks.y = element_blank(),
        panel.grid   = element_blank()
      )

    save_fig(p_a5, "fig_A5_landscape_heatmap", width = 12, height = 10)

  } else {
    cat("    (no decade_snap rows for reference scenario -- skipping A5)\n")
  }
} else {
  cat("    (decade_snap data missing -- skipping A5)\n")
}

cat("=== 01_validation complete (A1-A5) ===\n")
