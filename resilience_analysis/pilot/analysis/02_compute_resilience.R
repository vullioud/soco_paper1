# =============================================================================
# Compute pilot resilience indicators for outbreak runs, paired to control runs
# =============================================================================

source("resilience_analysis/pilot/analysis/00_utils.R")
cat("=== Computing pilot resilience indicators ===\n")

d <- load_pilot_data()
lm <- d$landscape_metrics
bl <- d$baselines
sp <- d$species_yearly
sp_bl <- d$baseline_species

if (nrow(lm) == 0 || nrow(bl) == 0) {
  stop("Missing data. Run 01_compute_baselines_pilot.R first.")
}

rollmean_k <- function(x, k = 5) {
  n <- length(x)
  if (n < k) return(rep(NA, n))
  out <- rep(NA, n)
  for (i in k:n) out[i] <- mean(x[(i - k + 1):i], na.rm = TRUE)
  out
}

bray_curtis <- function(a, b) {
  sum(abs(a - b)) / sum(a + b)
}

outbreak_bl <- bl %>% filter(condition == "outbreak")
control_bl <- bl %>%
  filter(condition == "control") %>%
  select(cluster, aggregation, climate, replicate,
         control_run_id = run_id, control_bl_mean_volume = bl_mean_volume)

results <- list()

for (i in seq_len(nrow(outbreak_bl))) {
  b <- outbreak_bl[i, ]
  ts <- lm %>% filter(run_id == b$run_id) %>% arrange(year)
  if (nrow(ts) == 0) next

  control_match <- control_bl %>%
    filter(cluster == b$cluster,
           aggregation == b$aggregation,
           climate == b$climate,
           replicate == b$replicate)

  resistance_window <- ts %>% filter(year >= OUTBREAK_START, year <= RESISTANCE_END)
  recovery_window <- ts %>% filter(year >= OUTBREAK_START, year <= RECOVERY_END)

  min_vol <- min(resistance_window$total_volume, na.rm = TRUE)
  min_ba  <- min(resistance_window$total_ba, na.rm = TRUE)
  resistance_vol <- 1 - (b$bl_mean_volume - min_vol) / b$bl_mean_volume
  resistance_ba  <- 1 - (b$bl_mean_ba - min_ba) / b$bl_mean_ba
  max_loss_year <- resistance_window$year[which.min(resistance_window$total_volume)]

  rec_ts <- recovery_window %>% arrange(year)
  rec_ts$roll_vol <- rollmean_k(rec_ts$total_volume, k = 5)
  threshold_90 <- 0.90 * b$bl_mean_volume
  threshold_95 <- 0.95 * b$bl_mean_volume
  idx_90 <- which(rec_ts$roll_vol >= threshold_90 & rec_ts$year > OUTBREAK_END)
  idx_95 <- which(rec_ts$roll_vol >= threshold_95 & rec_ts$year > OUTBREAK_END)
  recovery_time_90 <- if (length(idx_90) > 0) rec_ts$year[idx_90[1]] - OUTBREAK_START else NA
  recovery_time_95 <- if (length(idx_95) > 0) rec_ts$year[idx_95[1]] - OUTBREAK_START else NA

  milestone_mid <- OUTBREAK_START + 50
  milestone_end <- RECOVERY_END
  vol_mid <- ts %>% filter(year == milestone_mid) %>% pull(total_volume)
  vol_end <- ts %>% filter(year == milestone_end) %>% pull(total_volume)
  completeness_50 <- if (length(vol_mid) > 0) vol_mid / b$bl_mean_volume else NA
  completeness_end <- if (length(vol_end) > 0) vol_end / b$bl_mean_volume else NA

  bc_mid <- NA
  bc_end <- NA
  if (nrow(sp) > 0 && nrow(sp_bl) > 0) {
    sp_bl_rid <- sp_bl %>% filter(run_id == b$run_id)
    sp_mid <- sp %>% filter(run_id == b$run_id, year == milestone_mid)
    sp_end <- sp %>% filter(run_id == b$run_id, year == milestone_end)

    if (nrow(sp_bl_rid) > 0) {
      all_sp <- unique(c(sp_bl_rid$species, sp_mid$species, sp_end$species))
      bl_vec <- setNames(rep(0, length(all_sp)), all_sp)
      bl_vals <- setNames(sp_bl_rid$total_ba, sp_bl_rid$species)
      bl_vec[names(bl_vals)] <- bl_vals

      if (nrow(sp_mid) > 0) {
        vmid <- setNames(rep(0, length(all_sp)), all_sp)
        vals <- setNames(sp_mid$total_ba, sp_mid$species)
        vmid[names(vals)] <- vals
        if (sum(bl_vec + vmid) > 0) bc_mid <- bray_curtis(bl_vec, vmid)
      }

      if (nrow(sp_end) > 0) {
        vend <- setNames(rep(0, length(all_sp)), all_sp)
        vals <- setNames(sp_end$total_ba, sp_end$species)
        vend[names(vals)] <- vals
        if (sum(bl_vec + vend) > 0) bc_end <- bray_curtis(bl_vec, vend)
      }
    }
  }

  con_end <- ts %>% filter(year == RECOVERY_END) %>% pull(conifer_ba_pct) %>% as.numeric()
  sha_end <- ts %>% filter(year == RECOVERY_END) %>% pull(shannon_gamma) %>% as.numeric()
  conifer_shift <- if (length(con_end) > 0) con_end - b$bl_mean_conifer else NA
  shannon_shift <- if (length(sha_end) > 0) sha_end - b$bl_mean_shannon else NA

  results[[b$run_id]] <- data.frame(
    run_id = b$run_id,
    control_run_id = if (nrow(control_match) > 0) control_match$control_run_id[1] else NA,
    cluster = b$cluster,
    landscape = b$landscape,
    aggregation = b$aggregation,
    condition = b$condition,
    climate = b$climate,
    replicate = b$replicate,
    resistance_volume = round(resistance_vol, 4),
    resistance_ba = round(resistance_ba, 4),
    max_loss_year = max_loss_year,
    recovery_time_90 = recovery_time_90,
    recovery_time_95 = recovery_time_95,
    completeness_50yr = round(completeness_50, 4),
    completeness_end = round(completeness_end, 4),
    bray_curtis_mid = round(bc_mid, 4),
    bray_curtis_end = round(bc_end, 4),
    conifer_shift = round(conifer_shift, 2),
    shannon_shift = round(shannon_shift, 4),
    stringsAsFactors = FALSE
  )
}

resilience <- bind_rows(results)
write.csv(resilience, file.path(DATA_DIR, "resilience_summary.csv"), row.names = FALSE)
cat(sprintf("  resilience_summary.csv: %d outbreak runs\n", nrow(resilience)))
cat("=== Pilot resilience indicators complete ===\n")
