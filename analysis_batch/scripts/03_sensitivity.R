#!/usr/bin/env Rscript
# =============================================================================
# 03_sensitivity: OAT Sensitivity Ranking (Effect Sizes)
#
# For each outcome metric and each OAT arm, computes the relative effect size
# (range across arm levels / reference value) and plots a grouped bar chart.
#
# Produces: fig_C1_effect_sizes.png
#
# Run:  Rscript analysis_batch/scripts/03_sensitivity.R
# =============================================================================

source("analysis_batch/scripts/00_utils.R")

cat("=== 03: OAT Sensitivity Ranking ===\n")

# --- Load data ---
d <- load_all_data()
print_data_summary(d)

state   <- d$soco_state
sp_gini <- d$sp_gini
removal <- d$removal
sp_land <- d$sp_land

if (nrow(state) == 0)   stop("No soco_stand_state data.")
if (nrow(sp_gini) == 0)  stop("No stand_species_gini data.")
if (nrow(sp_land) == 0)  stop("No species_by_year data.")

# --- Configuration ---
ENDPOINT_YEARS <- 150:200
OAT_ARMS       <- c("aggregation", "landscape", "disturbance", "replicate")

# Reference levels (used for the denominator of relative effect size)
REF_LEVELS <- list(
  aggregation = "High",
  landscape   = "CL10",
  disturbance = "contbb",
  replicate   = "1"
)

# Arm color palette
arm_colors <- c(
  aggregation = "#e41a1c",
  landscape   = "#377eb8",
  disturbance = "#4daf4a",
  replicate   = "#ff7f00"
)

arm_labels <- c(
  aggregation = "Aggregation",
  landscape   = "Landscape",
  disturbance = "Disturbance",
  replicate   = "Replicate"
)

# =============================================================================
# METRIC DEFINITIONS
# =============================================================================
# Each metric function takes the full data list + an arm-filtered subset tag,
# and returns a single numeric value (endpoint summary for that filter).

cat("  Computing endpoint metrics per arm-level...\n")

# Helper: filter to endpoint years
endpoint <- function(df) {
  df %>% filter(year %in% ENDPOINT_YEARS)
}

# 1. Mean volume (m3/ha) — from soco_state
metric_mean_volume <- function(data_list, arm, level) {
  df <- oat_arm_filter(data_list$soco_state, arm)
  df <- df %>% filter(.data[[arm]] == level)
  df <- endpoint(df)
  if (nrow(df) == 0) return(NA_real_)
  mean(df$volume, na.rm = TRUE)
}

# 2. DBH Gini — from soco_state
metric_dbh_gini <- function(data_list, arm, level) {
  df <- oat_arm_filter(data_list$soco_state, arm)
  df <- df %>% filter(.data[[arm]] == level)
  df <- endpoint(df)
  if (nrow(df) == 0) return(NA_real_)
  mean(df$dbh_gini, na.rm = TRUE)
}

# 3. Species evenness — from sp_gini
metric_species_evenness <- function(data_list, arm, level) {
  df <- oat_arm_filter(data_list$sp_gini, arm)
  df <- df %>% filter(.data[[arm]] == level)
  df <- endpoint(df)
  if (nrow(df) == 0) return(NA_real_)
  mean(df$species_evenness, na.rm = TRUE)
}

# 4. Conifer share (conifer BA / total BA) — from sp_land
metric_conifer_share <- function(data_list, arm, level) {
  df <- oat_arm_filter(data_list$sp_land, arm)
  df <- df %>% filter(.data[[arm]] == level)
  df <- endpoint(df)
  if (nrow(df) == 0) return(NA_real_)
  total_ba <- sum(df$total_ba, na.rm = TRUE)
  if (total_ba == 0) return(NA_real_)
  conifer_ba <- df %>%
    filter(species %in% conifers) %>%
    summarise(ba = sum(total_ba, na.rm = TRUE)) %>%
    pull(ba)
  conifer_ba / total_ba
}

# 5. Annual harvest (total removals per year) — from removal
metric_annual_harvest <- function(data_list, arm, level) {
  df <- oat_arm_filter(data_list$removal, arm)
  df <- df %>% filter(.data[[arm]] == level)
  df <- endpoint(df)
  if (nrow(df) == 0) return(NA_real_)
  # Total harvest = thinning + final + salvaged, summed per year then averaged
  yearly <- df %>%
    mutate(total_harvest = volumeThinning + volumeFinal + volumeSalvaged) %>%
    group_by(year) %>%
    summarise(annual_total = sum(total_harvest, na.rm = TRUE), .groups = "drop")
  if (nrow(yearly) == 0) return(NA_real_)
  mean(yearly$annual_total, na.rm = TRUE)
}

# 6. Old-growth fraction — from soco_state
#    Fraction of stands with mean_dbh >= 40 AND n_large_trees >= 50
metric_oldgrowth <- function(data_list, arm, level) {
  df <- oat_arm_filter(data_list$soco_state, arm)
  df <- df %>% filter(.data[[arm]] == level)
  df <- endpoint(df)
  if (nrow(df) == 0) return(NA_real_)
  mean(df$mean_dbh >= 40 & df$n_large_trees >= 50, na.rm = TRUE)
}

# =============================================================================
# COMPUTE EFFECT SIZES
# =============================================================================

metric_fns <- list(
  "Mean volume"      = metric_mean_volume,
  "DBH Gini"         = metric_dbh_gini,
  "Species evenness"  = metric_species_evenness,
  "Conifer share"     = metric_conifer_share,
  "Annual harvest"    = metric_annual_harvest,
  "Old-growth frac."  = metric_oldgrowth
)

# For each arm and each metric, compute:
#   - value at each level of the arm
#   - reference value (at the reference level)
#   - effect_size = (max - min) / reference * 100

get_arm_levels <- function(data_list, arm) {
  # Use soco_state to identify available levels for the arm
  df <- oat_arm_filter(data_list$soco_state, arm)
  lvls <- sort(unique(as.character(df[[arm]])))
  lvls
}

results <- data.frame(
  metric      = character(),
  arm         = character(),
  effect_size = numeric(),
  stringsAsFactors = FALSE
)

for (arm in OAT_ARMS) {
  cat(sprintf("  Processing arm: %s\n", arm))
  levels_in_arm <- get_arm_levels(d, arm)
  cat(sprintf("    Levels: %s\n", paste(levels_in_arm, collapse = ", ")))

  for (metric_name in names(metric_fns)) {
    fn <- metric_fns[[metric_name]]

    # Compute value for each level
    values <- sapply(levels_in_arm, function(lvl) fn(d, arm, lvl))
    names(values) <- levels_in_arm

    # Reference value
    ref_lvl <- REF_LEVELS[[arm]]
    # For the replicate arm, ensure character matching
    ref_val <- values[as.character(ref_lvl)]

    # Handle edge cases
    if (is.na(ref_val) || ref_val == 0) {
      # Fall back to mean of available values as denominator
      ref_val <- mean(values, na.rm = TRUE)
    }

    if (is.na(ref_val) || ref_val == 0) {
      effect <- NA_real_
    } else {
      val_range <- max(values, na.rm = TRUE) - min(values, na.rm = TRUE)
      effect <- (val_range / abs(ref_val)) * 100
    }

    results <- rbind(results, data.frame(
      metric      = metric_name,
      arm         = arm,
      effect_size = effect,
      stringsAsFactors = FALSE
    ))

    cat(sprintf("    %s: range=%.4f, ref=%.4f, effect=%.1f%%\n",
                metric_name,
                max(values, na.rm = TRUE) - min(values, na.rm = TRUE),
                ref_val, effect))
  }
}

cat("  Effect size computation complete.\n")

# =============================================================================
# FIG C1: REMOVED — effect size normalization is misleading
#   (sensitive to baseline level; e.g. small ref values cause inflated %)
# =============================================================================

# Effect size table still computed above for reference — print to console
cat("\n  Effect size table (for reference, no figure produced):\n")
results$metric <- factor(results$metric, levels = names(metric_fns))
results$arm    <- factor(results$arm, levels = OAT_ARMS, labels = arm_labels)
print(results %>% arrange(metric, arm), row.names = FALSE)

cat("\n=== 03_sensitivity complete (C1 figure removed) ===\n")
