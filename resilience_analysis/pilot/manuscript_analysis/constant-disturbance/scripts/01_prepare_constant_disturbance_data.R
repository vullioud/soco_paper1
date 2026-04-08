suppressPackageStartupMessages({
  library(data.table)
})

PILOT_DATA_IN <- file.path("resilience_analysis", "pilot", "data")
OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "constant-disturbance")
DATA_OUT <- file.path(OUT_ROOT, "data")

dir.create(DATA_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(DATA_OUT, "constant_disturbance_*.csv"))

message("=== Prepare constant disturbance data ===")
message("This script prepares the paired chronic-only disturbance tables.")
message("Input table: paired_landscape_trajectories.csv")
message("Output tables: constant_disturbance_burden.csv and constant_disturbance_endstate.csv")

paired_landscape <- fread(file.path(PILOT_DATA_IN, "paired_landscape_trajectories.csv"))

paired_landscape[, aggregation := as.character(aggregation)]
paired_landscape[
  !is.na(aggregation) & nzchar(aggregation) & !grepl("^matched_", aggregation),
  aggregation := paste0("matched_", aggregation)
]

paired_landscape[, pair_id := treatment_run_id]
paired_landscape[, replicate_uid := paste(landscape, aggregation, condition, replicate, sep = "_")]
paired_landscape[, init_uid := paste(landscape, replicate, sep = "_")]

constant_burden <- paired_landscape[
  condition == "chronic",
  .(
    auc_vol_signed_1_250 = sum(treatment_total_volume - control_total_volume, na.rm = TRUE),
    auc_gini_signed_1_250 = sum(treatment_mean_dbh_gini - control_mean_dbh_gini, na.rm = TRUE),
    auc_conifer_signed_1_250 = sum(treatment_conifer_ba_pct - control_conifer_ba_pct, na.rm = TRUE)
  ),
  by = .(pair_id, replicate_uid, landscape, aggregation, condition, replicate, init_uid)
]

constant_burden[, analysis := "constant_disturbance_burden"]
constant_burden[, landscape := factor(landscape)]
constant_burden[, aggregation := factor(aggregation)]
constant_burden[, init_uid := factor(init_uid)]

setorder(constant_burden, landscape, aggregation, replicate)

fwrite(
  constant_burden,
  file.path(DATA_OUT, "constant_disturbance_burden.csv")
)

constant_endstate <- paired_landscape[
  condition == "chronic" & year == 250,
  .(
    pair_id,
    replicate_uid,
    landscape,
    aggregation,
    condition,
    replicate,
    init_uid,
    delta_vol_250 = treatment_total_volume - control_total_volume,
    delta_gini_250 = treatment_mean_dbh_gini - control_mean_dbh_gini,
    delta_conifer_250 = treatment_conifer_ba_pct - control_conifer_ba_pct
  )
]

constant_endstate[, analysis := "constant_disturbance_endstate"]
constant_endstate[, landscape := factor(landscape)]
constant_endstate[, aggregation := factor(aggregation)]
constant_endstate[, init_uid := factor(init_uid)]

setorder(constant_endstate, landscape, aggregation, replicate)

fwrite(
  constant_endstate,
  file.path(DATA_OUT, "constant_disturbance_endstate.csv")
)

message(sprintf("constant_disturbance_burden rows: %d", nrow(constant_burden)))
message(sprintf("constant_disturbance_endstate rows: %d", nrow(constant_endstate)))
message("=== Constant disturbance data prepared ===")
