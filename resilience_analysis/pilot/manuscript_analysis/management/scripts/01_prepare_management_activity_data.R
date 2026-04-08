suppressPackageStartupMessages({
  library(data.table)
})

RUN_INDEX_IN <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "data", "_run_index.csv")
ACTIVITY_IN <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "data", "block_M_activities.csv")
OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "management")
DATA_OUT <- file.path(OUT_ROOT, "data")

dir.create(DATA_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(DATA_OUT, "*.csv"))

message("=== Prepare management activity data ===")
message("This script builds zero-filled run-level activity tables.")

run_index <- fread(RUN_INDEX_IN)
activities <- fread(ACTIVITY_IN)

all_periods <- data.table(period = c("baseline", "pulse", "recovery"))
all_activities <- data.table(activity_name = sort(unique(as.character(activities$activity_name))))

run_period_grid <- CJ(
  run_id = run_index$run_id,
  period = all_periods$period,
  activity_name = all_activities$activity_name,
  unique = TRUE
)

run_period_grid <- merge(
  run_period_grid,
  run_index,
  by = "run_id",
  all.x = TRUE,
  sort = FALSE
)

activity_run_period <- merge(
  run_period_grid,
  activities,
  by = c("run_id", "replicate_uid", "landscape", "aggregation", "condition", "replicate", "period", "activity_name"),
  all.x = TRUE,
  sort = FALSE
)

activity_run_period[is.na(n_events), n_events := 0]
activity_run_period[, init_uid := paste(landscape, replicate, sep = "_")]
activity_run_period[, is_active := activity_name != "none"]
activity_run_period[, is_salvage_related := activity_name %in% c("salvage_clearcut", "salvage_leave")]
activity_run_period[, is_planting_related := activity_name %in% c(
  "clearcut_planting",
  "shelterwood_planting",
  "femel_planting",
  "planting"
)]
activity_run_period[, is_regeneration_decision := activity_name %in% c(
  "clearcut_planting",
  "shelterwood_planting",
  "shelterwood_no_planting",
  "femel_planting",
  "femel_no_planting",
  "planting"
)]

setorder(activity_run_period, condition, landscape, aggregation, replicate, period, activity_name)
fwrite(activity_run_period, file.path(DATA_OUT, "management_activity_run_period.csv"))

activity_post <- activity_run_period[
  period %in% c("pulse", "recovery"),
  .(
    n_events = sum(n_events),
    is_active = first(is_active),
    is_salvage_related = first(is_salvage_related),
    is_planting_related = first(is_planting_related),
    is_regeneration_decision = first(is_regeneration_decision)
  ),
  by = .(run_id, replicate_uid, landscape, aggregation, condition, replicate, init_uid, activity_name)
]
activity_post[, period := "post_disturbance"]

activity_run_window <- rbindlist(
  list(
    activity_run_period,
    activity_post
  ),
  use.names = TRUE,
  fill = TRUE
)

setorder(activity_run_window, condition, landscape, aggregation, replicate, period, activity_name)
fwrite(activity_run_window, file.path(DATA_OUT, "management_activity_run_window.csv"))

message(sprintf("management_activity_run_period rows: %d", nrow(activity_run_period)))
message(sprintf("management_activity_run_window rows: %d", nrow(activity_run_window)))
message("=== Management activity data prepared ===")
