#!/usr/bin/env Rscript
# =============================================================================
# Fig 10: Initial Species Distribution by Landscape (Year 1)
#   Stacked bar showing BA share per species for CL05, CL10, CL14.
#   Top 10 species + Other.
#
# Run:  Rscript analysis_batch/scripts/fig_10_initial_species.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== Fig 10: Initial Species Distribution ===\n")
d <- load_all_data()

N_SPECIES <- 10

# --- Year 1, one run per landscape (High/contbb/rep1) ---
sp_yr1 <- d$sp_land %>%
  filter(year == 1,
         aggregation == "High",
         disturbance == "contbb",
         replicate == 1)

cat(sprintf("  Landscapes: %s\n",
            paste(sort(unique(sp_yr1$landscape)), collapse = ", ")))

# --- Top 10 species across all 3 landscapes at year 1 ---
top_sp <- sp_yr1 %>%
  group_by(species) %>%
  summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
  arrange(desc(total_ba)) %>%
  slice_head(n = N_SPECIES) %>%
  pull(species)

cat(sprintf("  Top %d: %s\n", N_SPECIES,
            paste(top_sp, collapse = ", ")))

# --- Lump + compute share ---
plot_data <- sp_yr1 %>%
  mutate(species = ifelse(species %in% top_sp, species, "Other")) %>%
  group_by(landscape, species) %>%
  summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
  group_by(landscape) %>%
  mutate(share = total_ba / sum(total_ba) * 100) %>%
  ungroup() %>%
  mutate(
    species = factor(species, levels = c(rev(top_sp), "Other")),
    landscape = factor(landscape,
      levels = names(landscape_colors))
  )

# --- Palette ---
pal <- sp_palette[c(top_sp, "Other")]
pal[is.na(pal)] <- "#bdbdbd"

sp_labs <- species_labels[top_sp]
sp_labs[is.na(sp_labs)] <- top_sp[is.na(sp_labs)]
sp_labs <- c(sp_labs, Other = "Other")

# --- Plot ---
p <- ggplot(plot_data,
            aes(x = landscape, y = share, fill = species)) +
  geom_col(position = "stack", width = 0.7) +
  scale_fill_manual(values = pal, labels = sp_labs) +
  labs(
    title = "Initial Species Composition (Year 1)",
    subtitle = "Basal area share (%) | High aggregation, contbb, rep 1",
    x = "Landscape",
    y = "Basal area share (%)",
    fill = "Species"
  ) +
  theme_soco() +
  theme(legend.position = "right") +
  guides(fill = guide_legend(reverse = TRUE))

save_fig(p, "fig_10_initial_species", width = 10, height = 7)
cat("=== Fig 10 complete ===\n")
