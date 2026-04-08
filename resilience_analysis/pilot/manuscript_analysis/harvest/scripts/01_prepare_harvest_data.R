suppressPackageStartupMessages({
  library(data.table)
})

DATA_IN <- file.path("resilience_analysis", "pilot", "data", "removal_summary.csv")
OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "harvest")
DATA_OUT <- file.path(OUT_ROOT, "data")
MODELS_OUT <- file.path(OUT_ROOT, "models")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(DATA_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(DATA_OUT, "*.csv"))

normalize_aggregation <- function(x) {
  x <- as.character(x)
  needs_prefix <- !is.na(x) & nzchar(x) & !grepl("^matched_", x)
  x[needs_prefix] <- paste0("matched_", x[needs_prefix])
  x
}

message("=== Prepare harvest data ===")
message("This script prepares paired control-vs-treatment harvest tables.")
message("Input table: removal_summary.csv")
message("Outputs: outbreak_harvest.csv, chronic_harvest.csv, paired_harvest_yearly.csv")

removal_summary <- fread(DATA_IN)
removal_summary[, aggregation := normalize_aggregation(aggregation)]
removal_summary[, planned_harvest := vol_thinning + vol_final]
removal_summary[, total_extracted := vol_thinning + vol_final + vol_salvaged]

control_yearly <- removal_summary[
  condition == "control",
  .(
    control_run_id = run_id,
    cluster,
    landscape,
    aggregation,
    climate,
    replicate,
    year,
    control_vol_thinning = vol_thinning,
    control_vol_final = vol_final,
    control_vol_salvaged = vol_salvaged,
    control_vol_disturbed = vol_disturbed,
    control_planned_harvest = planned_harvest,
    control_total_extracted = total_extracted
  )
]

treatment_yearly <- removal_summary[
  condition %in% c("outbreak", "chronic"),
  .(
    treatment_run_id = run_id,
    cluster,
    landscape,
    aggregation,
    condition,
    climate,
    replicate,
    year,
    treatment_vol_thinning = vol_thinning,
    treatment_vol_final = vol_final,
    treatment_vol_salvaged = vol_salvaged,
    treatment_vol_disturbed = vol_disturbed,
    treatment_planned_harvest = planned_harvest,
    treatment_total_extracted = total_extracted
  )
]

paired_harvest_yearly <- merge(
  treatment_yearly,
  control_yearly,
  by = c("cluster", "landscape", "aggregation", "climate", "replicate", "year"),
  all.x = TRUE,
  sort = FALSE
)

paired_harvest_yearly[, pair_id := treatment_run_id]
paired_harvest_yearly[, init_uid := paste(landscape, replicate, sep = "_")]
paired_harvest_yearly[, `:=`(
  delta_planned_harvest = treatment_planned_harvest - control_planned_harvest,
  delta_salvage = treatment_vol_salvaged - control_vol_salvaged,
  delta_total_extracted = treatment_total_extracted - control_total_extracted
)]

setorder(paired_harvest_yearly, condition, landscape, aggregation, replicate, year)
fwrite(paired_harvest_yearly, file.path(DATA_OUT, "paired_harvest_yearly.csv"))

outbreak_harvest <- paired_harvest_yearly[
  condition == "outbreak",
  .(
    treatment_planned_pre_mean = mean(treatment_planned_harvest[year %in% 100:149], na.rm = TRUE),
    control_planned_pre_mean = mean(control_planned_harvest[year %in% 100:149], na.rm = TRUE),
    delta_planned_pre_mean = mean(delta_planned_harvest[year %in% 100:149], na.rm = TRUE),
    treatment_planned_post_mean = mean(treatment_planned_harvest[year %in% 161:250], na.rm = TRUE),
    control_planned_post_mean = mean(control_planned_harvest[year %in% 161:250], na.rm = TRUE),
    delta_planned_post_mean = mean(delta_planned_harvest[year %in% 161:250], na.rm = TRUE),
    did_planned_mean = mean(delta_planned_harvest[year %in% 161:250], na.rm = TRUE) -
      mean(delta_planned_harvest[year %in% 100:149], na.rm = TRUE),
    treatment_salvage_pulse_mean = mean(treatment_vol_salvaged[year %in% 150:160], na.rm = TRUE),
    control_salvage_pulse_mean = mean(control_vol_salvaged[year %in% 150:160], na.rm = TRUE),
    delta_salvage_pulse_mean = mean(delta_salvage[year %in% 150:160], na.rm = TRUE),
    treatment_salvage_post_mean = mean(treatment_vol_salvaged[year %in% 161:250], na.rm = TRUE),
    control_salvage_post_mean = mean(control_vol_salvaged[year %in% 161:250], na.rm = TRUE),
    delta_salvage_post_mean = mean(delta_salvage[year %in% 161:250], na.rm = TRUE)
  ),
  by = .(pair_id, landscape, aggregation, condition, replicate, init_uid)
]

setorder(outbreak_harvest, landscape, aggregation, replicate)
fwrite(outbreak_harvest, file.path(DATA_OUT, "outbreak_harvest.csv"))

chronic_harvest <- paired_harvest_yearly[
  condition == "chronic",
  .(
    treatment_planned_mean = mean(treatment_planned_harvest, na.rm = TRUE),
    control_planned_mean = mean(control_planned_harvest, na.rm = TRUE),
    delta_planned_mean = mean(delta_planned_harvest, na.rm = TRUE),
    treatment_salvage_mean = mean(treatment_vol_salvaged, na.rm = TRUE),
    control_salvage_mean = mean(control_vol_salvaged, na.rm = TRUE),
    delta_salvage_mean = mean(delta_salvage, na.rm = TRUE),
    treatment_total_mean = mean(treatment_total_extracted, na.rm = TRUE),
    control_total_mean = mean(control_total_extracted, na.rm = TRUE),
    delta_total_mean = mean(delta_total_extracted, na.rm = TRUE)
  ),
  by = .(pair_id, landscape, aggregation, condition, replicate, init_uid)
]

setorder(chronic_harvest, landscape, aggregation, replicate)
fwrite(chronic_harvest, file.path(DATA_OUT, "chronic_harvest.csv"))

message(sprintf("paired_harvest_yearly rows: %d", nrow(paired_harvest_yearly)))
message(sprintf("outbreak_harvest rows: %d", nrow(outbreak_harvest)))
message(sprintf("chronic_harvest rows: %d", nrow(chronic_harvest)))
message("=== Harvest data prepared ===")
