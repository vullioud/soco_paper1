suppressPackageStartupMessages({
  library(data.table)
})

MANUSCRIPT_DATA_IN <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "data")
PILOT_DATA_IN <- file.path("resilience_analysis", "pilot", "data")
OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "disturbance")
DATA_OUT <- file.path(OUT_ROOT, "data")

dir.create(DATA_OUT, recursive = TRUE, showWarnings = FALSE)

message("=== Prepare outbreak disturbance data ===")
message("This script prepares the paired outbreak-only disturbance tables.")
message("Input tables: block2_peak_loss.csv and paired_landscape_trajectories.csv")
message("Output tables: outbreak_loss.csv and outbreak_auc.csv")

block2 <- fread(file.path(MANUSCRIPT_DATA_IN, "block2_peak_loss.csv"))
paired_landscape <- fread(file.path(PILOT_DATA_IN, "paired_landscape_trajectories.csv"))

normalize_aggregation <- function(x) {
  x <- as.character(x)
  needs_prefix <- !is.na(x) & nzchar(x) & !grepl("^matched_", x)
  x[needs_prefix] <- paste0("matched_", x[needs_prefix])
  x
}

first_full_recovery_year <- function(delta, years, start_year = 160) {
  keep <- is.finite(delta) & is.finite(years) & years > start_year
  years_ok <- years[keep & delta >= 0]
  if (!length(years_ok)) {
    return(NA_real_)
  }
  min(years_ok)
}

outbreak_loss <- block2[
  condition == "outbreak",
  .(
    pair_id,
    replicate_uid,
    landscape,
    aggregation,
    condition,
    replicate,
    peak_rel_vol,
    peak_gini,
    peak_conifer
  )
]

outbreak_loss[, init_uid := paste(landscape, replicate, sep = "_")]
outbreak_loss[, analysis := "outbreak_loss"]
outbreak_loss[, landscape := factor(landscape)]
outbreak_loss[, aggregation := factor(aggregation)]
outbreak_loss[, init_uid := factor(init_uid)]

setorder(outbreak_loss, landscape, aggregation, replicate)

fwrite(
  outbreak_loss,
  file.path(DATA_OUT, "outbreak_loss.csv")
)

paired_landscape[, aggregation := normalize_aggregation(aggregation)]
paired_landscape[, pair_id := treatment_run_id]
paired_landscape[, replicate_uid := paste(landscape, aggregation, condition, replicate, sep = "_")]

outbreak_auc <- paired_landscape[
  condition == "outbreak" & year >= 161 & year <= 250,
  {
    vol_delta <- treatment_total_volume - control_total_volume
    conifer_delta <- treatment_conifer_ba_pct - control_conifer_ba_pct
    gini_delta <- treatment_mean_dbh_gini - control_mean_dbh_gini

    vol_tstar <- first_full_recovery_year(vol_delta, year, start_year = 160)
    conifer_tstar <- first_full_recovery_year(conifer_delta, year, start_year = 160)

    vol_window_trunc <- if (is.na(vol_tstar)) {
      year >= 161 & year <= 250
    } else {
      year >= 161 & year < vol_tstar
    }

    conifer_window_trunc <- if (is.na(conifer_tstar)) {
      year >= 161 & year <= 250
    } else {
      year >= 161 & year < conifer_tstar
    }

    gini_window <- year >= 161 & year <= 250

    .(
      auc_vol_trunc = sum(pmax(control_total_volume[vol_window_trunc] - treatment_total_volume[vol_window_trunc], 0), na.rm = TRUE),
      auc_gini_trunc = sum(abs(gini_delta[gini_window]), na.rm = TRUE),
      auc_conifer_trunc = sum(pmax(control_conifer_ba_pct[conifer_window_trunc] - treatment_conifer_ba_pct[conifer_window_trunc], 0), na.rm = TRUE),
      auc_vol_full = sum(pmax(control_total_volume - treatment_total_volume, 0), na.rm = TRUE),
      auc_gini_full = sum(abs(gini_delta), na.rm = TRUE),
      auc_conifer_full = sum(pmax(control_conifer_ba_pct - treatment_conifer_ba_pct, 0), na.rm = TRUE),
      recovery_year_vol = if (is.na(vol_tstar)) NA_real_ else vol_tstar - 150,
      recovered_vol = !is.na(vol_tstar),
      time_to_recovery_or_censor_vol = if (is.na(vol_tstar)) 100 else vol_tstar - 150,
      recovery_year_conifer = if (is.na(conifer_tstar)) NA_real_ else conifer_tstar - 150,
      recovered_conifer = !is.na(conifer_tstar),
      time_to_recovery_or_censor_conifer = if (is.na(conifer_tstar)) 100 else conifer_tstar - 150
    )
  },
  by = .(pair_id, replicate_uid, landscape, aggregation, condition, replicate)
]

outbreak_auc[, init_uid := paste(landscape, replicate, sep = "_")]
outbreak_auc[, analysis := "outbreak_auc"]
outbreak_auc[, landscape := factor(landscape)]
outbreak_auc[, aggregation := factor(aggregation)]
outbreak_auc[, init_uid := factor(init_uid)]

setorder(outbreak_auc, landscape, aggregation, replicate)

fwrite(
  outbreak_auc,
  file.path(DATA_OUT, "outbreak_auc.csv")
)

message(sprintf("outbreak_loss rows: %d", nrow(outbreak_loss)))
message(sprintf("outbreak_auc rows: %d", nrow(outbreak_auc)))
message("=== Outbreak disturbance data prepared ===")
