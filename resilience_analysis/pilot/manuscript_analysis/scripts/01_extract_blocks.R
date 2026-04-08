suppressPackageStartupMessages({
  library(data.table)
  library(vegan)
})

ROOT_DIR    <- file.path("resilience_analysis", "pilot", "manuscript_analysis")
DATA_IN     <- file.path("resilience_analysis", "pilot", "data")
COMBINED_IN <- file.path("output", "pilot_resilience", "_combined")
DATA_OUT    <- file.path(ROOT_DIR, "data")
MODELS_OUT  <- file.path(ROOT_DIR, "models")
TABLES_OUT  <- file.path(ROOT_DIR, "tables")

GINI_BASELINE_YEAR <- 10
GINI_PRE_YEAR      <- 140
GINI_POST_YEAR     <- 250

dir.create(DATA_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)

normalize_aggregation <- function(x) {
  x <- as.character(x)
  needs_prefix <- !is.na(x) & nzchar(x) & !grepl("^matched_", x)
  x[needs_prefix] <- paste0("matched_", x[needs_prefix])
  x
}

safe_div <- function(num, den) {
  out <- rep(NA_real_, length(num))
  keep <- is.finite(num) & is.finite(den) & den != 0
  out[keep] <- num[keep] / den[keep]
  out
}

signed_max_abs <- function(x) {
  x <- x[is.finite(x)]
  if (!length(x)) {
    return(NA_real_)
  }
  x[which.max(abs(x))[1]]
}

sum_safe_ratio <- function(num, den) {
  ratio <- safe_div(num, den)
  if (all(is.na(ratio))) {
    return(NA_real_)
  }
  sum(ratio, na.rm = TRUE)
}

first_recovery_year <- function(treated, control, years, threshold = 0.95) {
  keep <- is.finite(treated) & is.finite(control) & control > 0
  if (!any(keep)) {
    return(NA_real_)
  }
  years_ok <- years[keep & treated >= threshold * control]
  if (!length(years_ok)) {
    return(NA_real_)
  }
  min(years_ok)
}

bray_curtis_two_vectors <- function(a, b) {
  if (is.null(a)) a <- numeric()
  if (is.null(b)) b <- numeric()
  species <- union(names(a), names(b))
  if (!length(species)) {
    return(NA_real_)
  }

  vec_a <- numeric(length(species))
  vec_b <- numeric(length(species))
  names(vec_a) <- species
  names(vec_b) <- species

  if (length(a)) vec_a[names(a)] <- a
  if (length(b)) vec_b[names(b)] <- b

  as.numeric(vegan::vegdist(rbind(vec_a, vec_b), method = "bray"))
}

species_vector <- function(values, species) {
  if (!length(values)) {
    return(NULL)
  }
  tapply(values, species, sum, na.rm = TRUE)
}

message("=== Manuscript block extraction ===")

# -----------------------------------------------------------------------------
# Step 1: verify conifer share availability
# -----------------------------------------------------------------------------
landscape_header <- names(fread(file.path(DATA_IN, "landscape_metrics.csv"), nrows = 0))
conifer_candidates <- c("conifer_ba_pct", "conifer_pct", "conifer_share", "conifer_fraction")
CONIFER_COL <- conifer_candidates[conifer_candidates %in% landscape_header][1]

if (is.na(CONIFER_COL) || !nzchar(CONIFER_COL)) {
  stop(
    "conifer share column missing - must compute from species_yearly.csv basal area; ",
    "stopping for manual decision"
  )
}

message(sprintf("Using conifer column: %s", CONIFER_COL))

# -----------------------------------------------------------------------------
# Step 2: build replicate_uid lookup
# -----------------------------------------------------------------------------
manifest <- fread(file.path(DATA_IN, "run_manifest.csv"))
manifest[, aggregation := normalize_aggregation(aggregation)]
manifest[, replicate_uid := paste(landscape, aggregation, condition, replicate, sep = "_")]

if (uniqueN(manifest$replicate_uid) != nrow(manifest)) {
  stop("replicate_uid is not unique in run_manifest.csv")
}

run_index <- manifest[, .(
  run_id,
  replicate_uid,
  landscape,
  aggregation,
  condition,
  replicate
)]

fwrite(run_index, file.path(DATA_OUT, "_run_index.csv"))
message(sprintf("Wrote run index: %d rows", nrow(run_index)))

# -----------------------------------------------------------------------------
# Load source tables once
# -----------------------------------------------------------------------------
landscape_metrics <- fread(file.path(DATA_IN, "landscape_metrics.csv"))
landscape_metrics[, aggregation := normalize_aggregation(aggregation)]

species_yearly <- fread(file.path(DATA_IN, "species_yearly.csv"))
species_yearly[, aggregation := normalize_aggregation(aggregation)]
species_yearly <- merge(
  species_yearly,
  run_index[, .(run_id, replicate_uid)],
  by = "run_id",
  all.x = TRUE,
  sort = FALSE
)

paired_landscape <- fread(file.path(DATA_IN, "paired_landscape_trajectories.csv"))
paired_landscape[, aggregation := normalize_aggregation(aggregation)]
paired_landscape[, `:=`(
  pair_id = treatment_run_id,
  replicate_uid = paste(landscape, aggregation, condition, replicate, sep = "_")
)]

paired_species <- fread(file.path(DATA_IN, "paired_species_yearly.csv"))
paired_species[, aggregation := normalize_aggregation(aggregation)]
pair_lookup <- unique(
  paired_landscape[, .(landscape, aggregation, condition, replicate, pair_id, replicate_uid)]
)
paired_species <- merge(
  paired_species,
  pair_lookup,
  by = c("landscape", "aggregation", "condition", "replicate"),
  all.x = TRUE,
  sort = FALSE
)

removal_summary <- fread(file.path(DATA_IN, "removal_summary.csv"))
removal_summary[, aggregation := normalize_aggregation(aggregation)]
removal_summary <- merge(
  removal_summary,
  run_index[, .(run_id, replicate_uid)],
  by = "run_id",
  all.x = TRUE,
  sort = FALSE
)

ml_activities <- fread(file.path(COMBINED_IN, "soco_ml_activities.csv"))
ml_activities[, aggregation := normalize_aggregation(aggregation)]
ml_activities <- merge(
  ml_activities,
  run_index[, .(run_id, replicate_uid)],
  by = "run_id",
  all.x = TRUE,
  sort = FALSE
)

if (all(is.na(landscape_metrics[year == GINI_BASELINE_YEAR, mean_dbh_gini])) ||
    all(is.na(landscape_metrics[year == GINI_PRE_YEAR, mean_dbh_gini]))) {
  warning(
    sprintf(
      "mean_dbh_gini is missing at year %s or %s in landscape_metrics.csv; ",
      GINI_BASELINE_YEAR, GINI_PRE_YEAR
    ),
    "block1 delta_gini will be incomplete under the current fallback definition"
  )
}

if (all(is.na(paired_landscape[year == GINI_PRE_YEAR, treatment_mean_dbh_gini])) &&
    all(is.na(paired_landscape[year == GINI_PRE_YEAR, control_mean_dbh_gini]))) {
  warning(
    sprintf(
      "mean_dbh_gini is missing at year %s in paired_landscape_trajectories.csv; ",
      GINI_PRE_YEAR
    ),
    "block4 did_gini will be incomplete under the current fallback definition"
  )
}

# -----------------------------------------------------------------------------
# Step 3: Block 1 table
# -----------------------------------------------------------------------------
block1_meta <- run_index[condition %in% c("control", "outbreak")]

block1_years <- landscape_metrics[
  condition %in% c("control", "outbreak") & year %in% c(1, 149),
  .(
    run_id,
    year,
    total_volume,
    mean_dbh_gini,
    conifer_value = get(CONIFER_COL)
  )
]

block1_gini_years <- landscape_metrics[
  condition %in% c("control", "outbreak") & year %in% c(GINI_BASELINE_YEAR, GINI_PRE_YEAR),
  .(
    run_id,
    year,
    mean_dbh_gini
  )
]

block1_wide <- dcast(
  block1_years,
  run_id ~ year,
  value.var = c("total_volume", "conifer_value")
)

block1_gini_wide <- dcast(
  block1_gini_years,
  run_id ~ year,
  value.var = "mean_dbh_gini"
)

block1_bc <- species_yearly[
  condition %in% c("control", "outbreak") & year %in% c(1, 149),
  {
    v1 <- species_vector(total_ba[year == 1], species[year == 1])
    v149 <- species_vector(total_ba[year == 149], species[year == 149])
    .(bc_1_149 = bray_curtis_two_vectors(v1, v149))
  },
  by = .(run_id, replicate_uid, landscape, aggregation, condition, replicate)
]

block1 <- merge(block1_meta, block1_wide, by = "run_id", all.x = TRUE, sort = FALSE)
block1 <- merge(block1, block1_gini_wide, by = "run_id", all.x = TRUE, sort = FALSE)
block1 <- merge(
  block1,
  block1_bc,
  by = c("run_id", "replicate_uid", "landscape", "aggregation", "condition", "replicate"),
  all.x = TRUE,
  sort = FALSE
)

block1[, `:=`(
  delta_vol = total_volume_149 - total_volume_1,
  delta_gini = get(sprintf("%s", GINI_PRE_YEAR)) - get(sprintf("%s", GINI_BASELINE_YEAR)),
  delta_conifer = conifer_value_149 - conifer_value_1
)]

block1 <- block1[, .(
  run_id, replicate_uid, landscape, aggregation, condition, replicate,
  delta_vol, delta_gini, delta_conifer, bc_1_149
)]

fwrite(block1, file.path(DATA_OUT, "block1_pre_disturbance.csv"))
message(sprintf("Wrote block1_pre_disturbance.csv: %d rows", nrow(block1)))

# -----------------------------------------------------------------------------
# Step 4: Block 2 table
# -----------------------------------------------------------------------------
block2 <- paired_landscape[, {
  year_keep <- if (condition[1] == "outbreak") {
    year >= 150 & year <= 170
  } else {
    year >= 1 & year <= 250
  }
  x <- .SD[year_keep]

  rel_vol <- safe_div(
    x$treatment_total_volume - x$control_total_volume,
    x$control_total_volume
  )
  gini_delta <- x$treatment_mean_dbh_gini - x$control_mean_dbh_gini
  rel_conifer <- safe_div(
    x$treatment_conifer_ba_pct - x$control_conifer_ba_pct,
    x$control_conifer_ba_pct
  )

  .(
    peak_rel_vol = if (all(is.na(rel_vol))) NA_real_ else min(rel_vol, na.rm = TRUE),
    peak_gini = signed_max_abs(gini_delta),
    peak_conifer = if (all(is.na(rel_conifer))) NA_real_ else min(rel_conifer, na.rm = TRUE)
  )
}, by = .(pair_id, replicate_uid, landscape, aggregation, condition, replicate)]

setorder(block2, condition, landscape, aggregation, replicate)
fwrite(block2, file.path(DATA_OUT, "block2_peak_loss.csv"))
message(sprintf("Wrote block2_peak_loss.csv: %d rows", nrow(block2)))

# -----------------------------------------------------------------------------
# Step 5: Block 3 table
# -----------------------------------------------------------------------------
# Legacy shared burden/recovery table.
# Sign convention here is control - treatment, so negative AUC means the
# treatment spent more time above the paired control than below it. The current
# chronic manuscript block uses dedicated chronic burden/end-state tables
# instead of these signed chronic recovery fields.
block3 <- paired_landscape[year >= 150 & year <= 250, {
  vol_gap <- control_total_volume - treatment_total_volume
  gini_gap <- control_mean_dbh_gini - treatment_mean_dbh_gini
  conifer_gap <- control_conifer_ba_pct - treatment_conifer_ba_pct

  vol_tstar <- first_recovery_year(treatment_total_volume, control_total_volume, year)
  conifer_tstar <- first_recovery_year(
    treatment_conifer_ba_pct,
    control_conifer_ba_pct,
    year
  )

  vol_limit <- if (is.na(vol_tstar)) 250 else vol_tstar
  gini_limit <- 250
  conifer_limit <- if (is.na(conifer_tstar)) 250 else conifer_tstar

  .(
    auc_vol_full = sum_safe_ratio(vol_gap, control_total_volume),
    auc_vol_trunc = sum_safe_ratio(
      vol_gap[year <= vol_limit],
      control_total_volume[year <= vol_limit]
    ),
    auc_gini_full = sum_safe_ratio(gini_gap, control_mean_dbh_gini),
    auc_gini_trunc = sum_safe_ratio(
      gini_gap[year <= gini_limit],
      control_mean_dbh_gini[year <= gini_limit]
    ),
    auc_conifer_full = sum_safe_ratio(conifer_gap, control_conifer_ba_pct),
    auc_conifer_trunc = sum_safe_ratio(
      conifer_gap[year <= conifer_limit],
      control_conifer_ba_pct[year <= conifer_limit]
    ),
    recovery_year_vol = if (is.na(vol_tstar)) NA_real_ else vol_tstar - 150,
    recovered_vol = !is.na(vol_tstar),
    time_to_recovery_or_censor_vol = if (is.na(vol_tstar)) 100 else vol_tstar - 150,
    recovery_year_conifer = if (is.na(conifer_tstar)) NA_real_ else conifer_tstar - 150,
    recovered_conifer = !is.na(conifer_tstar),
    time_to_recovery_or_censor_conifer = if (is.na(conifer_tstar)) 100 else conifer_tstar - 150
  )
}, by = .(pair_id, replicate_uid, landscape, aggregation, condition, replicate)]

setorder(block3, condition, landscape, aggregation, replicate)
fwrite(block3, file.path(DATA_OUT, "block3_auc_recovery.csv"))
message(sprintf("Wrote block3_auc_recovery.csv: %d rows", nrow(block3)))

# -----------------------------------------------------------------------------
# Step 6: Block 4 table
# -----------------------------------------------------------------------------
block4_years <- paired_landscape[
  year %in% c(149, 250, GINI_PRE_YEAR),
  .(
    pair_id,
    replicate_uid,
    landscape,
    aggregation,
    condition,
    replicate,
    year,
    treatment_total_volume,
    treatment_mean_dbh_gini,
    treatment_conifer_ba_pct,
    control_total_volume,
    control_mean_dbh_gini,
    control_conifer_ba_pct
  )
]

block4_wide <- dcast(
  block4_years,
  pair_id + replicate_uid + landscape + aggregation + condition + replicate ~ year,
  value.var = c(
    "treatment_total_volume",
    "treatment_mean_dbh_gini",
    "treatment_conifer_ba_pct",
    "control_total_volume",
    "control_mean_dbh_gini",
    "control_conifer_ba_pct"
  )
)

block4_bc <- paired_species[year %in% c(149, 250), {
  treated_149 <- species_vector(treatment_total_ba[year == 149], species[year == 149])
  treated_250 <- species_vector(treatment_total_ba[year == 250], species[year == 250])
  control_149 <- species_vector(control_total_ba[year == 149], species[year == 149])
  control_250 <- species_vector(control_total_ba[year == 250], species[year == 250])

  bc_treated <- bray_curtis_two_vectors(treated_149, treated_250)
  bc_control <- bray_curtis_two_vectors(control_149, control_250)

  .(
    bc_treated_149_250 = bc_treated,
    bc_control_149_250 = bc_control,
    delta_bc = bc_treated - bc_control
  )
}, by = .(pair_id, replicate_uid, landscape, aggregation, condition, replicate)]

block4 <- merge(
  block4_wide,
  block4_bc,
  by = c("pair_id", "replicate_uid", "landscape", "aggregation", "condition", "replicate"),
  all.x = TRUE,
  sort = FALSE
)

block4[, `:=`(
  did_vol = (treatment_total_volume_250 - treatment_total_volume_149) -
    (control_total_volume_250 - control_total_volume_149),
  did_gini = (treatment_mean_dbh_gini_250 - get(sprintf("treatment_mean_dbh_gini_%s", GINI_PRE_YEAR))) -
    (control_mean_dbh_gini_250 - get(sprintf("control_mean_dbh_gini_%s", GINI_PRE_YEAR))),
  did_conifer = (treatment_conifer_ba_pct_250 - treatment_conifer_ba_pct_149) -
    (control_conifer_ba_pct_250 - control_conifer_ba_pct_149)
)]

block4 <- block4[, .(
  pair_id, replicate_uid, landscape, aggregation, condition, replicate,
  did_vol, did_gini, did_conifer,
  bc_treated_149_250, bc_control_149_250, delta_bc
)]

setorder(block4, condition, landscape, aggregation, replicate)
fwrite(block4, file.path(DATA_OUT, "block4_endstate.csv"))
message(sprintf("Wrote block4_endstate.csv: %d rows", nrow(block4)))

# -----------------------------------------------------------------------------
# Step 7: Block 5 table
# -----------------------------------------------------------------------------
block5_snap <- landscape_metrics[
  year == 250,
  .(
    run_id,
    landscape,
    aggregation,
    condition,
    replicate,
    vol_250 = total_volume,
    gini_250 = mean_dbh_gini,
    conifer_250 = get(CONIFER_COL)
  )
]

block5 <- merge(block5_snap, run_index, by = c(
  "run_id", "landscape", "aggregation", "condition", "replicate"
), all.x = TRUE, sort = FALSE)

block5_bc <- species_yearly[
  year %in% c(1, 250),
  {
    v1 <- species_vector(total_ba[year == 1], species[year == 1])
    v250 <- species_vector(total_ba[year == 250], species[year == 250])
    .(bc_1_250 = bray_curtis_two_vectors(v1, v250))
  },
  by = .(run_id, replicate_uid, landscape, aggregation, condition, replicate)
]

block5 <- merge(
  block5,
  block5_bc,
  by = c("run_id", "replicate_uid", "landscape", "aggregation", "condition", "replicate"),
  all.x = TRUE,
  sort = FALSE
)

block5 <- block5[, .(
  run_id, replicate_uid, landscape, aggregation, condition, replicate,
  vol_250, gini_250, conifer_250, bc_1_250
)]

setorder(block5, condition, landscape, aggregation, replicate)
fwrite(block5, file.path(DATA_OUT, "block5_chronic.csv"))
message(sprintf("Wrote block5_chronic.csv: %d rows", nrow(block5)))

# -----------------------------------------------------------------------------
# Step 8: Block M harvest table
# -----------------------------------------------------------------------------
blockM_harvest <- removal_summary[, .(
  harvest_pre_mean = mean((vol_thinning + vol_final)[year %in% 100:149], na.rm = TRUE),
  harvest_post_mean = mean((vol_thinning + vol_final)[year %in% 161:250], na.rm = TRUE)
), by = .(run_id, replicate_uid, landscape, aggregation, condition, replicate)]

blockM_harvest[, delta_harvest := harvest_post_mean - harvest_pre_mean]

setorder(blockM_harvest, condition, landscape, aggregation, replicate)
fwrite(blockM_harvest, file.path(DATA_OUT, "block_M_harvest.csv"))
message(sprintf("Wrote block_M_harvest.csv: %d rows", nrow(blockM_harvest)))

# -----------------------------------------------------------------------------
# Step 9: Block M activities table
# -----------------------------------------------------------------------------
ml_activities[, period := fifelse(
  year >= 1 & year <= 149, "baseline",
  fifelse(year >= 150 & year <= 160, "pulse",
          fifelse(year >= 161 & year <= 250, "recovery", NA_character_))
)]

blockM_activities <- ml_activities[!is.na(period), .(
  n_events = .N
), by = .(
  run_id, replicate_uid, landscape, aggregation, condition, replicate, period, activity_name
)]

setorder(blockM_activities, condition, landscape, aggregation, replicate, period, activity_name)
fwrite(blockM_activities, file.path(DATA_OUT, "block_M_activities.csv"))
message(sprintf("Wrote block_M_activities.csv: %d rows", nrow(blockM_activities)))

message("=== Manuscript block extraction complete ===")
