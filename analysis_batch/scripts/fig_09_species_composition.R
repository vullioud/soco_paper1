#!/usr/bin/env Rscript
# =============================================================================
# Fig 09: Species Composition Over Time
#   Stacked area: basal area share (%) per species across time.
#   Top 10 species colored, rest lumped as "Other".
#   4-row OAT layout (aggregation, landscape, disturbance, replicate arms).
#
# Run:  Rscript analysis_batch/scripts/fig_09_species_composition.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 09: Species Composition ===\n")
d <- load_all_data()

N_SPECIES <- 10

# --- Identify top N species across all data ---
top_sp <- d$sp_land %>%
  group_by(species) %>%
  summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
  arrange(desc(total_ba)) %>%
  slice_head(n = N_SPECIES) %>%
  pull(species)

cat(sprintf("  Top %d species: %s\n", N_SPECIES,
            paste(top_sp, collapse = ", ")))

# --- Prepare data: lump minor species, compute share ---
sp_data <- d$sp_land %>%
  mutate(
    species = ifelse(species %in% top_sp, species, "Other")
  ) %>%
  group_by(landscape, aggregation, disturbance, replicate,
           year, species) %>%
  summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
  # Compute share within each (scenario, year)
  group_by(landscape, aggregation, disturbance, replicate, year) %>%
  mutate(share = total_ba / sum(total_ba) * 100) %>%
  ungroup() %>%
  mutate(
    species = factor(species,
      levels = c(rev(top_sp), "Other"))
  )

# --- Build palette for top 10 + Other ---
pal <- sp_palette[c(top_sp, "Other")]
# Fill any missing with grey
pal[is.na(pal)] <- "#bdbdbd"

# Labels
sp_labs <- species_labels[top_sp]
sp_labs[is.na(sp_labs)] <- top_sp[is.na(sp_labs)]
sp_labs <- c(sp_labs, Other = "Other")

# --- Plot function for build_oat_quad ---
sp_plot_fn <- function(data, var, pal_arm, lab, ...) {
  # Average share across replicates within this arm
  avg <- data %>%
    group_by(year, species, !!sym(var)) %>%
    summarise(share = mean(share, na.rm = TRUE), .groups = "drop") %>%
    filter(!is.na(share), share > 0)

  p <- ggplot(avg, aes(x = year, y = share, fill = species)) +
    geom_area(position = "stack", alpha = 0.85) +
    scale_fill_manual(values = pal, labels = sp_labs, drop = FALSE) +
    scale_x_continuous(breaks = seq(0, 200, 50)) +
    coord_cartesian(ylim = c(0, 100)) +
    facet_wrap(as.formula(paste("~", var)), nrow = 1) +
    labs(x = "Year", y = "Basal area share (%)", fill = "Species") +
    theme_soco(base_size = 9) +
    theme(legend.position = "none")

  p
}

# --- Build OAT quad ---
p_combined <- build_oat_quad(sp_plot_fn, sp_data,
  title = "Species Composition Over Time (% Basal Area)")

# Override legend: show it only at the bottom of the combined plot
p_combined <- p_combined &
  theme(legend.position = "bottom") &
  guides(fill = guide_legend(nrow = 2))

save_fig(p_combined, "fig_09_species_composition",
         width = 16, height = 16)
cat("=== Fig 09 complete ===\n")
