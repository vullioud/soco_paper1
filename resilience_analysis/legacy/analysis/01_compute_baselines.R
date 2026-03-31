# =============================================================================
# 01_compute_baselines.R — Compute pre-disturbance baseline statistics
#
# For each run_id, over the BASELINE_START-BASELINE_END window:
#   - Mean, SD, min, max for key metrics
#   - Species BA vector at BASELINE_SPECIES_YEAR (for Bray-Curtis)
#
# Output: data/baselines.csv, data/baseline_species_vectors.csv
# =============================================================================

source("resilience_analysis/legacy/analysis/00_utils.R")
cat("=== Computing baselines ===\n")

d <- load_resilience_data()
lm <- d$landscape_metrics
sp <- d$species_yearly

if (nrow(lm) == 0) stop("No landscape_metrics data found. Run extract_resilience_data.py first.")

# --- Baseline period ---
bl <- lm %>% filter(year >= BASELINE_START, year <= BASELINE_END)

baselines <- bl %>%
  group_by(run_id, landscape, aggregation, climate, replicate) %>%
  summarise(
    bl_mean_volume    = mean(total_volume, na.rm = TRUE),
    bl_sd_volume      = sd(total_volume, na.rm = TRUE),
    bl_min_volume     = min(total_volume, na.rm = TRUE),
    bl_max_volume     = max(total_volume, na.rm = TRUE),
    bl_mean_ba        = mean(total_ba, na.rm = TRUE),
    bl_sd_ba          = sd(total_ba, na.rm = TRUE),
    bl_min_ba         = min(total_ba, na.rm = TRUE),
    bl_max_ba         = max(total_ba, na.rm = TRUE),
    bl_mean_stems     = mean(total_stems, na.rm = TRUE),
    bl_min_stems      = min(total_stems, na.rm = TRUE),
    bl_mean_shannon   = mean(as.numeric(shannon_gamma), na.rm = TRUE),
    bl_sd_shannon     = sd(as.numeric(shannon_gamma), na.rm = TRUE),
    bl_min_shannon    = min(as.numeric(shannon_gamma), na.rm = TRUE),
    bl_max_shannon    = max(as.numeric(shannon_gamma), na.rm = TRUE),
    bl_mean_conifer   = mean(as.numeric(conifer_ba_pct), na.rm = TRUE),
    bl_sd_conifer     = sd(as.numeric(conifer_ba_pct), na.rm = TRUE),
    bl_min_conifer    = min(as.numeric(conifer_ba_pct), na.rm = TRUE),
    bl_max_conifer    = max(as.numeric(conifer_ba_pct), na.rm = TRUE),
    bl_mean_cv_vol    = mean(cv_volume, na.rm = TRUE),
    bl_mean_gini      = mean(as.numeric(mean_dbh_gini), na.rm = TRUE),
    bl_mean_layers    = mean(as.numeric(mean_n_height_layers), na.rm = TRUE),
    .groups = "drop"
  )

# --- Species vector at BASELINE_SPECIES_YEAR (for Bray-Curtis) ---
if (nrow(sp) > 0) {
  sp_baseline <- sp %>%
    filter(year == BASELINE_SPECIES_YEAR) %>%
    select(run_id, landscape, aggregation, climate, replicate, species, total_ba)

  write.csv(sp_baseline, file.path(DATA_DIR, "baseline_species_vectors.csv"),
            row.names = FALSE)
  cat(sprintf("  baseline_species_vectors.csv: %d rows\n", nrow(sp_baseline)))
} else {
  cat("  WARNING: No species_yearly data, skipping baseline species vectors\n")
}

write.csv(baselines, file.path(DATA_DIR, "baselines.csv"), row.names = FALSE)
cat(sprintf("  baselines.csv: %d runs\n", nrow(baselines)))
cat("=== Baselines complete ===\n")
