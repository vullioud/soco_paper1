#!/usr/bin/env Rscript
# =============================================================================
# Fig D3: Salvage Budget Breakdown
#   Shows both what the budget actually charges (SoCoABE salvage_clearcut cost)
#   AND the "shadow" extraction volume from iLand (not charged to budget).
#
#   Panel A: iLand-level salvage volume over time by type (removal.csv)
#            This is the REAL cost of disturbance — but invisible to budget.
#   Panel B: Budget breakdown: salvage cost vs regular cost vs remaining
#            Per agent-decade, averaged by type. Shows what budget SEES.
#   Panel C: Deferral rate overlaid with budget utilization
#            Shows the link: when budget hits 100% → deferrals spike.
#
# Run:  Rscript analysis_batch/scripts/fig_D3_salvage_budget_breakdown.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig D3: Salvage Budget Breakdown ===\n")
d <- load_all_data()

REF_LANDSCAPE   <- "CL10"
REF_AGGREGATION <- "High"
REF_REPLICATE   <- 1

# =============================================================================
# PANEL A: iLand-level salvage volume by type and disturbance
# =============================================================================
cat("  Panel A: iLand salvage volume\n")

rem <- d$removal %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         replicate == REF_REPLICATE,
         volumeSalvaged > 0)

cat(sprintf("  Removal rows with salvage: %d\n", nrow(rem)))

# Aggregate salvage volume per (year, behavioral_type, disturbance)
# Use 10-year bins for readability
salvage_vol <- rem %>%
  mutate(year_bin = floor(year / 10) * 10 + 5) %>%
  group_by(year_bin, behavioral_type, disturbance) %>%
  summarise(
    total_salvaged = sum(volumeSalvaged, na.rm = TRUE),
    n_events = n(),
    .groups = "drop"
  ) %>%
  add_owner_group() %>%
  mutate(
    dist_label = factor(disturbance,
      levels = c("nod", "contbb", "bb"),
      labels = c(dist_labels["nod"], dist_labels["contbb"],
                 dist_labels["bb"]))
  )

p_a <- ggplot(salvage_vol,
              aes(x = year_bin, y = total_salvaged,
                  fill = behavioral_type)) +
  geom_col(position = "stack", width = 8) +
  scale_fill_manual(values = btype_palette,
                    labels = btype_labels) +
  scale_x_continuous(breaks = seq(0, 200, 50)) +
  facet_wrap(~dist_label, nrow = 1) +
  labs(
    x = NULL,
    y = expression(Salvaged ~ volume ~ (m^3 / ha)),
    title = "A. iLand-level salvage extraction (NOT charged to budget)",
    fill = "Type"
  ) +
  theme_soco(base_size = 10)


# =============================================================================
# PANEL B: Budget composition — salvage vs regular vs remaining
#   Uses soco_ml_activities to identify which budget spending was salvage.
# =============================================================================
cat("  Panel B: Budget composition\n")

bud <- d$decade_budget %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         replicate == REF_REPLICATE)

# Estimate salvage cost from ml_activities
# New cost: max(0, ENVELOPE - extraction_paid) + 3, ENVELOPE=8
ml_salv <- d$ml_activities %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         replicate == REF_REPLICATE,
         grepl("^salvage", activity_name)) %>%
  mutate(
    ext_paid = as.numeric(extraction_cost_paid),
    salvage_cost = pmax(0, 8 - ext_paid) + 3
  ) %>%
  group_by(agent_id, year, disturbance) %>%
  summarise(
    total_salvage_cost = sum(salvage_cost, na.rm = TRUE),
    .groups = "drop"
  )

bud_merged <- bud %>%
  left_join(ml_salv,
            by = c("agent_id", "year", "disturbance")) %>%
  mutate(
    total_salvage_cost = replace_na(total_salvage_cost, 0),
    salvage_spend = pmin(total_salvage_cost, budget_spent),
    regular_spend = pmax(budget_spent - salvage_spend, 0)
  ) %>%
  mutate(year_bin = floor(year / 10) * 10 + 5)

bud_agg <- bud_merged %>%
  group_by(year_bin, disturbance) %>%
  summarise(
    salvage   = mean(salvage_spend, na.rm = TRUE),
    regular   = mean(regular_spend, na.rm = TRUE),
    remaining = mean(budget_remaining, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  pivot_longer(cols = c(remaining, regular, salvage),
               names_to = "category",
               values_to = "points") %>%
  mutate(
    category = factor(category,
      levels = c("remaining", "regular", "salvage"),
      labels = c("Unspent", "Regular mgmt", "Salvage (replanting)")),
    dist_label = factor(disturbance,
      levels = c("nod", "contbb", "bb"),
      labels = c(dist_labels["nod"], dist_labels["contbb"],
                 dist_labels["bb"]))
  )

budget_pal <- c("Salvage (replanting)" = "#bcbd22",
                "Regular mgmt" = "#1f77b4",
                "Unspent" = "#cccccc")

p_b <- ggplot(bud_agg,
              aes(x = year_bin, y = points, fill = category)) +
  geom_col(position = "stack", width = 8) +
  scale_fill_manual(values = budget_pal) +
  scale_x_continuous(breaks = seq(0, 200, 50)) +
  facet_wrap(~dist_label, nrow = 1) +
  labs(
    x = NULL,
    y = "Budget points (mean per agent)",
    title = "B. Budget allocation (what the budget system SEES)",
    fill = "Category"
  ) +
  theme_soco(base_size = 10)


# =============================================================================
# PANEL C: Budget utilization % by behavioral type (1 line per type)
# =============================================================================
cat("  Panel C: Budget utilization by type\n")

# Budget utilization per (year_bin, disturbance, behavioral_type)
util_by_type <- bud_merged %>%
  filter(budget_total > 0) %>%
  group_by(year_bin, disturbance, behavioral_type) %>%
  summarise(
    mean_util = mean(budget_spent / budget_total * 100,
                     na.rm = TRUE),
    median_util = median(budget_spent / budget_total * 100,
                         na.rm = TRUE),
    n_agents = n(),
    .groups = "drop"
  ) %>%
  mutate(
    dist_label = factor(disturbance,
      levels = c("nod", "contbb", "bb"),
      labels = c(dist_labels["nod"], dist_labels["contbb"],
                 dist_labels["bb"]))
  )

p_c <- ggplot(util_by_type,
              aes(x = year_bin, y = median_util,
                  color = behavioral_type)) +
  geom_line(linewidth = 0.7, alpha = 0.8) +
  geom_point(size = 1.2) +
  geom_hline(yintercept = 100, linetype = "dashed",
             color = "grey40", linewidth = 0.3) +
  scale_color_manual(values = btype_palette,
                     labels = btype_labels) +
  scale_x_continuous(breaks = seq(0, 200, 50)) +
  scale_y_continuous(
    name = "Median utilization (%)",
    limits = c(0, NA)
  ) +
  facet_wrap(~dist_label, nrow = 1) +
  labs(
    x = "Year",
    title = "C. Median budget utilization by owner type | dashed = 100%",
    color = "Type"
  ) +
  theme_soco(base_size = 10)


# =============================================================================
# PANEL D: Budget utilization — disturbance-hit vs not-hit agents
# =============================================================================
cat("  Panel D: Disturbance-hit vs not-hit agents\n")

# Identify agents that were hit by disturbance (had salvage activity)
salvage_agents <- d$ml_activities %>%
  filter(landscape == REF_LANDSCAPE,
         aggregation == REF_AGGREGATION,
         replicate == REF_REPLICATE,
         grepl("^salvage", activity_name)) %>%
  distinct(agent_id, disturbance) %>%
  mutate(dist_hit = TRUE)

# Merge with budget data
bud_hit <- bud_merged %>%
  left_join(salvage_agents,
            by = c("agent_id", "disturbance")) %>%
  mutate(
    dist_hit = replace_na(dist_hit, FALSE),
    hit_label = ifelse(dist_hit,
                       "Disturbance-hit", "Not hit")
  ) %>%
  filter(budget_total > 0)

hit_util <- bud_hit %>%
  group_by(year_bin, disturbance, behavioral_type, hit_label) %>%
  summarise(
    median_util = median(budget_spent / budget_total * 100,
                         na.rm = TRUE),
    n_agents = n(),
    .groups = "drop"
  ) %>%
  mutate(
    dist_label = factor(disturbance,
      levels = c("nod", "contbb", "bb"),
      labels = c(dist_labels["nod"], dist_labels["contbb"],
                 dist_labels["bb"]))
  )

p_d <- ggplot(hit_util,
              aes(x = year_bin, y = median_util,
                  color = behavioral_type,
                  linetype = hit_label)) +
  geom_line(linewidth = 0.7, alpha = 0.8) +
  geom_point(size = 1.0) +
  geom_hline(yintercept = 100, linetype = "dashed",
             color = "grey40", linewidth = 0.3) +
  scale_color_manual(values = btype_palette,
                     labels = btype_labels) +
  scale_linetype_manual(values = c("Disturbance-hit" = "solid",
                                    "Not hit" = "dotted")) +
  scale_x_continuous(breaks = seq(0, 200, 50)) +
  scale_y_continuous(
    name = "Median utilization (%)",
    limits = c(0, NA)
  ) +
  facet_wrap(~dist_label, nrow = 1) +
  labs(
    x = "Year",
    title = "D. Budget utilization: disturbance-hit vs not-hit agents",
    color = "Type", linetype = NULL
  ) +
  theme_soco(base_size = 10)


# =============================================================================
# Combine
# =============================================================================

p_combined <- (p_a / p_b / p_c / p_d) +
  plot_layout(heights = c(1, 1, 1, 1)) +
  plot_annotation(
    title = "Salvage & Budget Diagnostic",
    subtitle = paste(
      REF_LANDSCAPE, "/", REF_AGGREGATION, "/ rep",
      REF_REPLICATE,
      "| Panel A = real extraction (free to budget)",
      "| Panel B = what budget charges",
      "| Panel C+D = utilization by type & disturbance exposure"
    )
  ) &
  theme(legend.position = "bottom")

save_fig(p_combined, "fig_D3_salvage_budget_breakdown",
         width = 16, height = 18)
cat("=== Fig D3 complete ===\n")
