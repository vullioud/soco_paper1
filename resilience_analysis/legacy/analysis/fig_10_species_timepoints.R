#!/usr/bin/env Rscript
# =============================================================================
# Fig 10: Species Composition at Three Timepoints
#
#   Stacked bar of BA share per species at:
#     yr 100 — start of data window (post-warmup initial state)
#     yr 200 — pre-BB baseline (nearest decadal point before outbreak)
#     yr 300 — end of simulation (post-BB)
#
#   Two outputs:
#     fig_10_species_timepoints.png — all landscapes, ref aggregation (High)
#     fig_10_species_by_agg.png    — all aggregations for each landscape
#
#   Data: resilience_analysis/data/species_yearly.csv
#
# Run:  Rscript resilience_analysis/legacy/analysis/fig_10_species_timepoints.R
# =============================================================================

source("resilience_analysis/legacy/analysis/00_utils.R")

cat("=== Fig 10: Species Composition at Three Timepoints ===\n")

N_SPECIES   <- 10
TIMEPOINTS  <- c(100, BASELINE_SPECIES_YEAR, 300)
TP_LABELS   <- c("Year 100\n(init)",
                  paste0("Year ", BASELINE_SPECIES_YEAR, "\n(pre-BB)"),
                  "Year 300\n(post-BB)")

d <- load_resilience_data()
sp <- d$species_yearly

if (nrow(sp) == 0) stop("No species_yearly data. Run extract_resilience_data.py first.")

cat(sprintf("  Rows: %d | Landscapes: %s\n",
            nrow(sp), paste(sort(unique(sp$landscape)), collapse = ", ")))

# Handle climate if present
has_climate <- "climate" %in% names(sp) && length(unique(sp$climate)) > 1

# =============================================================================
# 1. Filter to timepoints, average across replicates
# =============================================================================

sp_tp <- sp %>%
  filter(year %in% TIMEPOINTS) %>%
  mutate(timepoint = factor(
    paste0("Year ", year, "\n(",
           setNames(c("init", "pre-BB", "post-BB"),
                    as.character(TIMEPOINTS))[as.character(year)],
           ")"),
    levels = TP_LABELS
  ))

# Group vars for aggregation
grp_base <- c("landscape", "aggregation", "timepoint", "species")
if (has_climate) grp_base <- c(grp_base, "climate")

# Average BA across replicates
sp_avg <- sp_tp %>%
  group_by(across(all_of(grp_base))) %>%
  summarise(total_ba = mean(total_ba, na.rm = TRUE), .groups = "drop")

# =============================================================================
# 2. Top species
# =============================================================================

top_sp <- sp_avg %>%
  group_by(species) %>%
  summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
  arrange(desc(total_ba)) %>%
  slice_head(n = N_SPECIES) %>%
  pull(species)

cat(sprintf("  Top %d: %s\n", N_SPECIES, paste(top_sp, collapse = ", ")))

# =============================================================================
# 3. Compute shares
# =============================================================================

compute_shares <- function(df, group_vars) {
  df %>%
    mutate(species = ifelse(species %in% top_sp, species, "Other")) %>%
    group_by(across(all_of(c(group_vars, "species")))) %>%
    summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
    group_by(across(all_of(group_vars))) %>%
    mutate(share = total_ba / sum(total_ba) * 100) %>%
    ungroup() %>%
    mutate(species = factor(species, levels = c(rev(top_sp), "Other")))
}

# Palette
pal <- sp_palette[c(top_sp, "Other")]
pal[is.na(pal)] <- "#bdbdbd"

species_labs <- c(
  piab = "Norway spruce", fasy = "European beech", abal = "Silver fir",
  quro = "Sessile oak", lade = "Larch", pisy = "Scots pine",
  psme = "Douglas fir", frex = "Ash", acps = "Sycamore maple",
  pini = "Weymouth pine", qupe = "Pedunculate oak", cabe = "Hornbeam",
  potr = "Aspen", Other = "Other"
)
sp_labs <- species_labs[c(top_sp, "Other")]
sp_labs[is.na(sp_labs)] <- c(top_sp, "Other")[is.na(sp_labs)]

# =============================================================================
# 4. Figure A: All landscapes × 3 timepoints (ref aggregation = High)
# =============================================================================

cat("  Building fig_10 (all landscapes, High aggregation)...\n")

ref_grp <- c("landscape", "timepoint")
if (has_climate) ref_grp <- c(ref_grp, "climate")

plot_a <- sp_avg %>%
  filter(aggregation == "High") %>%
  compute_shares(ref_grp)

if (has_climate) {
  plot_a$climate <- factor(plot_a$climate, levels = names(climate_colors))
  p_a <- ggplot(plot_a, aes(x = timepoint, y = share, fill = species)) +
    geom_col(position = "stack", width = 0.75) +
    scale_fill_manual(values = pal, labels = sp_labs) +
    facet_grid(climate ~ landscape,
               labeller = labeller(climate = climate_labels)) +
    labs(
      title    = "Species Composition at Three Timepoints (High aggregation)",
      subtitle = "Mean across replicates | BA share (%)",
      x = NULL, y = "BA share (%)", fill = "Species"
    ) +
    theme_resilience() +
    theme(legend.position = "right",
          axis.text.x = element_text(angle = 45, hjust = 1)) +
    guides(fill = guide_legend(reverse = TRUE))
} else {
  p_a <- ggplot(plot_a, aes(x = timepoint, y = share, fill = species)) +
    geom_col(position = "stack", width = 0.75) +
    scale_fill_manual(values = pal, labels = sp_labs) +
    facet_wrap(~landscape, nrow = 1) +
    labs(
      title    = "Species Composition at Three Timepoints (High aggregation)",
      subtitle = "Mean across replicates | BA share (%)",
      x = NULL, y = "BA share (%)", fill = "Species"
    ) +
    theme_resilience() +
    theme(legend.position = "right",
          axis.text.x = element_text(angle = 45, hjust = 1)) +
    guides(fill = guide_legend(reverse = TRUE))
}

save_fig(p_a, "fig_10_species_timepoints", width = 16, height = 7)

# =============================================================================
# 5. Figure B: All aggregations × 3 timepoints, per landscape
# =============================================================================

cat("  Building fig_10 by aggregation (per landscape)...\n")

agg_grp <- c("landscape", "aggregation", "timepoint")
if (has_climate) agg_grp <- c(agg_grp, "climate")

plot_b <- sp_avg %>% compute_shares(agg_grp)

plot_b$aggregation <- factor(plot_b$aggregation, levels = names(agg_colors))

if (has_climate) {
  plot_b$climate <- factor(plot_b$climate, levels = names(climate_colors))
  facet_form <- landscape + climate ~ timepoint
  fig_h <- 3 * length(unique(plot_b$landscape)) *
           length(unique(plot_b$climate)) + 2
} else {
  facet_form <- landscape ~ timepoint
  fig_h <- 3 * length(unique(plot_b$landscape)) + 2
}

p_b <- ggplot(plot_b, aes(x = aggregation, y = share, fill = species)) +
  geom_col(position = "stack", width = 0.75) +
  scale_fill_manual(values = pal, labels = sp_labs) +
  scale_x_discrete(labels = agg_labels) +
  facet_grid(facet_form,
             labeller = if (has_climate)
               labeller(climate = climate_labels)
             else
               label_value) +
  labs(
    title    = "Species Composition by Aggregation at Three Timepoints",
    subtitle = "Mean across replicates | BA share (%)",
    x = NULL, y = "BA share (%)", fill = "Species"
  ) +
  theme_resilience(base_size = 9) +
  theme(legend.position = "right",
        axis.text.x = element_text(angle = 45, hjust = 1, size = 7),
        strip.text.y = element_text(angle = 0, size = 8)) +
  guides(fill = guide_legend(reverse = TRUE))

save_fig(p_b, "fig_10_species_by_agg", width = 16, height = fig_h)

cat("=== Fig 10 complete ===\n")
