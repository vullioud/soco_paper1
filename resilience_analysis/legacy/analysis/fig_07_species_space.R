#!/usr/bin/env Rscript
# =============================================================================
# Fig 07: Species Composition Space (Conifer Share × Evenness)
#   Each stand at endpoint (years 280-300) is a point in 2D space:
#     x = conifer share (% BA), y = Shannon H'
#   Color = behavioral_type, 50% confidence ellipses.
#   facet_grid(landscape ~ aggregation).
#
#   Data: output/_combined/stand_species_shares.csv (wide format, 1 row/stand/yr)
#         Uses data.table::fread for fast filtering of 14M+ row file.
#
# Run:  Rscript resilience_analysis/legacy/analysis/fig_07_species_space.R
# =============================================================================

source("resilience_analysis/legacy/analysis/00_utils.R")
library(data.table)

cat("=== Fig 07: Species Composition Space ===\n")

COMBINED <- file.path("output", "_combined")
ENDPOINT_START <- 280   # average over final 20 years

# =============================================================================
# 1. Load per-stand species shares — fast read, filter early
# =============================================================================

sp_path <- file.path(COMBINED, "stand_species_shares.csv")
if (!file.exists(sp_path)) stop("Missing: ", sp_path)

cat("  Loading stand_species_shares.csv (fread)...\n")
sp_dt <- fread(sp_path, stringsAsFactors = FALSE)

# Clean aggregation
if ("aggregation" %in% names(sp_dt))
  sp_dt[, aggregation := gsub("^matched_", "", aggregation)]

# Filter to outbreak runs, endpoint window
sp_dt <- sp_dt[grepl("outbreak", disturbance) & year >= ENDPOINT_START]

cat(sprintf("  Rows in endpoint window: %d\n", nrow(sp_dt)))
if (nrow(sp_dt) == 0) stop("No data after filter.")

sp_wide <- as.data.frame(sp_dt)
rm(sp_dt)

# =============================================================================
# 2. Compute conifer share and Shannon per row
# =============================================================================

conifer_cols <- intersect(names(sp_wide), conifers)
sp_wide$conifer_share <- rowSums(sp_wide[, conifer_cols, drop = FALSE], na.rm = TRUE)

meta_cols <- c("run_id", "landscape", "aggregation", "disturbance",
               "replicate", "year", "standid", "behavioral_type",
               "total_ba", "conifer_share", "climate")
sp_cols <- setdiff(names(sp_wide), meta_cols)

cat("  Computing Shannon H per stand-year...\n")
sp_mat <- as.matrix(sp_wide[, sp_cols, drop = FALSE])
sp_wide$shannon_H <- apply(sp_mat, 1, function(row) {
  p <- row[row > 0]
  if (length(p) == 0) return(0)
  -sum(p * log(p))
})

# =============================================================================
# 3. Average per stand over endpoint window
# =============================================================================

grp_vars <- c("landscape", "aggregation", "standid", "behavioral_type")
has_climate <- "climate" %in% names(sp_wide) &&
               length(unique(sp_wide$climate)) > 1
if (has_climate) grp_vars <- c(grp_vars, "climate")

stand_data <- sp_wide %>%
  group_by(across(all_of(grp_vars))) %>%
  summarise(
    conifer_pct  = mean(conifer_share, na.rm = TRUE) * 100,
    mean_shannon = mean(shannon_H, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  filter(!is.na(conifer_pct), !is.na(mean_shannon)) %>%
  mutate(
    behavioral_type = factor(behavioral_type,
      levels = c("MF", "OP", "TR", "PA", "EN")),
    aggregation = factor(aggregation, levels = names(agg_colors)),
    landscape   = factor(landscape, levels = sort(unique(landscape)))
  )

cat(sprintf("  Stands: %d | Landscapes: %s | Aggregations: %s\n",
            nrow(stand_data),
            paste(levels(stand_data$landscape), collapse = ", "),
            paste(levels(stand_data$aggregation), collapse = ", ")))

# =============================================================================
# 4. Plot
# =============================================================================

n_land <- length(unique(stand_data$landscape))
n_agg  <- length(unique(stand_data$aggregation))

if (has_climate) {
  stand_data$climate <- factor(stand_data$climate,
    levels = names(climate_colors))
  facet_formula <- landscape + climate ~ aggregation
  fig_height <- 3.5 * n_land * length(unique(stand_data$climate)) + 2
} else {
  facet_formula <- landscape ~ aggregation
  fig_height <- 3.5 * n_land + 2
}

p <- ggplot(stand_data,
            aes(x = conifer_pct, y = mean_shannon,
                color = behavioral_type)) +
  geom_point(alpha = 0.35, size = 1) +
  stat_ellipse(level = 0.5, linetype = "dashed", linewidth = 0.5) +
  scale_color_manual(values = btype_palette, labels = btype_labels) +
  facet_grid(facet_formula,
             labeller = if (has_climate)
               labeller(aggregation = agg_labels, climate = climate_labels)
             else
               labeller(aggregation = agg_labels)) +
  labs(
    title    = "Species Composition Space at Endpoint",
    subtitle = paste0("Years ", ENDPOINT_START, "-", RECOVERY_END,
                      " | 50% ellipses | rows = landscape, cols = aggregation"),
    x        = "Conifer share (% BA)",
    y        = "Shannon diversity (H')",
    color    = "Owner type"
  ) +
  theme_resilience(base_size = 9) +
  theme(legend.position  = "bottom",
        strip.text.x     = element_text(size = 7),
        strip.text.y     = element_text(size = 8, angle = 0))

save_fig(p, "fig_07_species_space",
         width  = 3.5 * n_agg + 2,
         height = fig_height)

cat("=== Fig 07 complete ===\n")
