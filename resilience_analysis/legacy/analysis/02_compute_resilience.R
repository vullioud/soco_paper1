# =============================================================================
# 02_compute_resilience.R — Compute resilience indicators
#
# For each run_id, compute:
#   - Resistance (volume, BA)
#   - Recovery time (90%, 95%)
#   - Completeness (50yr post-outbreak, end-of-sim)
#   - Bray-Curtis compositional distance
#   - Conifer shift, Shannon shift
#   - Pathway classification
#
# Output: data/resilience_summary.csv
# =============================================================================

source("resilience_analysis/legacy/analysis/00_utils.R")
cat("=== Computing resilience indicators ===\n")

d <- load_resilience_data()
lm <- d$landscape_metrics
bl <- d$baselines
sp <- d$species_yearly
sp_bl <- d$baseline_species

if (nrow(lm) == 0 || nrow(bl) == 0) {
  stop("Missing data. Run 01_compute_baselines.R first.")
}

# --- Helper: rolling mean (simple, no external dependency) ---
rollmean_k <- function(x, k = 5) {
  n <- length(x)
  if (n < k) return(rep(NA, n))
  out <- rep(NA, n)
  for (i in k:n) {
    out[i] <- mean(x[(i - k + 1):i], na.rm = TRUE)
  }
  out
}

# --- Helper: Bray-Curtis distance ---
bray_curtis <- function(a, b) {
  sum(abs(a - b)) / sum(a + b)
}

# --- Compute per run ---
run_ids <- unique(bl$run_id)
results <- list()

for (rid in run_ids) {
  b <- bl %>% filter(run_id == rid)
  ts <- lm %>% filter(run_id == rid) %>% arrange(year)

  if (nrow(b) == 0 || nrow(ts) == 0) next

  # Time series subsets
  resistance_window <- ts %>% filter(year >= OUTBREAK_START, year <= RESISTANCE_END)
  recovery_window   <- ts %>% filter(year >= OUTBREAK_START, year <= RECOVERY_END)

  # --- Resistance ---
  min_vol <- min(resistance_window$total_volume, na.rm = TRUE)
  min_ba  <- min(resistance_window$total_ba, na.rm = TRUE)
  resistance_vol <- 1 - (b$bl_mean_volume - min_vol) / b$bl_mean_volume
  resistance_ba  <- 1 - (b$bl_mean_ba - min_ba) / b$bl_mean_ba
  max_loss_year <- resistance_window$year[which.min(resistance_window$total_volume)]

  # --- Recovery time ---
  rec_ts <- recovery_window %>% arrange(year)
  rec_ts$roll_vol <- rollmean_k(rec_ts$total_volume, k = 5)

  threshold_90 <- 0.90 * b$bl_mean_volume
  threshold_95 <- 0.95 * b$bl_mean_volume

  idx_90 <- which(rec_ts$roll_vol >= threshold_90 & rec_ts$year > OUTBREAK_END)
  idx_95 <- which(rec_ts$roll_vol >= threshold_95 & rec_ts$year > OUTBREAK_END)
  recovery_time_90 <- if (length(idx_90) > 0) rec_ts$year[idx_90[1]] - OUTBREAK_START else NA
  recovery_time_95 <- if (length(idx_95) > 0) rec_ts$year[idx_95[1]] - OUTBREAK_START else NA

  # --- Completeness ---
  # Milestone years relative to outbreak start
  milestone_mid <- OUTBREAK_START + 50
  milestone_end <- RECOVERY_END
  vol_mid <- ts %>% filter(year == milestone_mid) %>% pull(total_volume)
  vol_end <- ts %>% filter(year == milestone_end) %>% pull(total_volume)
  completeness_50  <- if (length(vol_mid) > 0) vol_mid / b$bl_mean_volume else NA
  completeness_100 <- if (length(vol_end) > 0) vol_end / b$bl_mean_volume else NA

  # --- Compositional change (Bray-Curtis) ---
  bc_mid <- NA; bc_end <- NA; conifer_shift <- NA; shannon_shift <- NA

  if (nrow(sp) > 0 && nrow(sp_bl) > 0) {
    sp_bl_rid <- sp_bl %>% filter(run_id == rid)
    sp_mid <- sp %>% filter(run_id == rid, year == milestone_mid)
    sp_end <- sp %>% filter(run_id == rid, year == milestone_end)

    if (nrow(sp_bl_rid) > 0) {
      # Align species vectors
      all_sp <- unique(c(sp_bl_rid$species,
                         sp_mid$species, sp_end$species))

      bl_vec  <- setNames(rep(0, length(all_sp)), all_sp)
      bl_vals <- setNames(sp_bl_rid$total_ba,
                          sp_bl_rid$species)
      bl_vec[names(bl_vals)] <- bl_vals

      if (nrow(sp_mid) > 0) {
        vmid <- setNames(rep(0, length(all_sp)), all_sp)
        vals <- setNames(sp_mid$total_ba, sp_mid$species)
        vmid[names(vals)] <- vals
        if (sum(bl_vec + vmid) > 0)
          bc_mid <- bray_curtis(bl_vec, vmid)
      }

      if (nrow(sp_end) > 0) {
        vend <- setNames(rep(0, length(all_sp)), all_sp)
        vals <- setNames(sp_end$total_ba, sp_end$species)
        vend[names(vals)] <- vals
        if (sum(bl_vec + vend) > 0)
          bc_end <- bray_curtis(bl_vec, vend)
      }
    }
  }

  # --- Conifer and Shannon shifts ---
  con_end <- ts %>%
    filter(year == RECOVERY_END) %>%
    pull(conifer_ba_pct) %>% as.numeric()
  sha_end <- ts %>%
    filter(year == RECOVERY_END) %>%
    pull(shannon_gamma) %>% as.numeric()
  if (length(con_end) > 0 && !is.na(con_end) &&
      !is.na(b$bl_mean_conifer))
    conifer_shift <- con_end - b$bl_mean_conifer
  if (length(sha_end) > 0 && !is.na(sha_end) &&
      !is.na(b$bl_mean_shannon))
    shannon_shift <- sha_end - b$bl_mean_shannon

  # --- Regime shift flag ---
  min_stems <- min(recovery_window$total_stems, na.rm = TRUE)
  regime_shift_flag <- as.integer(min_stems < 50)

  # --- Pathway classification ---
  vol_end_val <- if (length(vol_end) > 0) vol_end else NA
  ba_end <- ts %>%
    filter(year == RECOVERY_END) %>% pull(total_ba)
  ba_end_val <- if (length(ba_end) > 0) ba_end else NA

  structure_beyond <- FALSE
  if (!is.na(vol_end_val))
    structure_beyond <- (vol_end_val < b$bl_min_volume |
                         vol_end_val > b$bl_max_volume)
  if (!is.na(ba_end_val))
    structure_beyond <- structure_beyond |
      (ba_end_val < b$bl_min_ba | ba_end_val > b$bl_max_ba)

  composition_beyond <- FALSE
  if (!is.na(sha_end) && !is.na(b$bl_min_shannon))
    composition_beyond <- (sha_end < b$bl_min_shannon |
                           sha_end > b$bl_max_shannon)
  if (!is.na(con_end) && !is.na(b$bl_min_conifer))
    composition_beyond <- composition_beyond |
      (con_end < b$bl_min_conifer |
       con_end > b$bl_max_conifer)

  pathway <- if (regime_shift_flag == 1) {
    "regime_shift"
  } else if (structure_beyond && composition_beyond) {
    "replacement"
  } else if (structure_beyond) {
    "restructuring"
  } else if (composition_beyond) {
    "reassembly"
  } else {
    "resilience"
  }

  results[[rid]] <- data.frame(
    run_id = rid,
    landscape = b$landscape,
    aggregation = b$aggregation,
    climate = b$climate,
    replicate = b$replicate,
    resistance_volume = round(resistance_vol, 4),
    resistance_ba = round(resistance_ba, 4),
    max_loss_year = max_loss_year,
    recovery_time_90 = recovery_time_90,
    recovery_time_95 = recovery_time_95,
    completeness_50yr = round(completeness_50, 4),
    completeness_end = round(completeness_100, 4),
    bray_curtis_mid = round(bc_mid, 4),
    bray_curtis_end = round(bc_end, 4),
    conifer_shift = round(conifer_shift, 2),
    shannon_shift = round(shannon_shift, 4),
    regime_shift_flag = regime_shift_flag,
    pathway = pathway,
    stringsAsFactors = FALSE
  )
}

resilience <- bind_rows(results)
write.csv(resilience, file.path(DATA_DIR, "resilience_summary.csv"), row.names = FALSE)
cat(sprintf("  resilience_summary.csv: %d runs\n", nrow(resilience)))

# --- Quick summary ---
cat("\nPathway distribution:\n")
print(table(resilience$pathway))
cat(sprintf("\nMean resistance (volume): %.3f\n", mean(resilience$resistance_volume, na.rm = TRUE)))
cat(sprintf("Mean recovery time (90%%): %.1f years\n", mean(resilience$recovery_time_90, na.rm = TRUE)))
cat(sprintf("Regime shifts: %d / %d\n", sum(resilience$regime_shift_flag), nrow(resilience)))

cat("=== Resilience indicators complete ===\n")
