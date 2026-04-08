suppressPackageStartupMessages({
  library(data.table)
  library(survival)
})

OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "disturbance")
DATA_IN <- file.path(OUT_ROOT, "data", "outbreak_auc.csv")
MODELS_OUT <- file.path(OUT_ROOT, "models")
TABLES_OUT <- file.path(OUT_ROOT, "tables")

dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(MODELS_OUT, "outbreak_recovery_time_*.rds"))
unlink(file.path(TABLES_OUT, "outbreak_recovery_time_*.csv"))

message("=== Outbreak recovery-time analysis ===")
message("This script tests whether aggregation changes time to full volume recovery.")
message("The response is right-censored at year 250 for runs that never return to control.")
message("Model family: Cox proportional hazards with cluster-robust SE on init_uid.")
message("Nested models per response:")
message("  1. null       = landscape")
message("  2. additive   = landscape + aggregation")
message("  3. interaction= landscape * aggregation")

outbreak_auc <- fread(DATA_IN)
outbreak_auc <- outbreak_auc[is.finite(time_to_recovery_or_censor_vol)]
outbreak_auc[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
outbreak_auc[, aggregation := stats::relevel(factor(aggregation), ref = "matched_High")]
outbreak_auc[, init_uid := factor(init_uid)]
outbreak_auc[, recovered_vol := as.integer(recovered_vol)]

response_name <- "time_to_recovery_vol"
analysis_name <- "outbreak_recovery_time"

recovery_time_null <- coxph(
  Surv(time_to_recovery_or_censor_vol, recovered_vol) ~ landscape,
  data = outbreak_auc,
  ties = "efron",
  cluster = init_uid,
  robust = TRUE,
  model = TRUE
)

recovery_time_additive <- coxph(
  Surv(time_to_recovery_or_censor_vol, recovered_vol) ~ landscape + aggregation,
  data = outbreak_auc,
  ties = "efron",
  cluster = init_uid,
  robust = TRUE,
  model = TRUE
)

recovery_time_interaction <- coxph(
  Surv(time_to_recovery_or_censor_vol, recovered_vol) ~ landscape * aggregation,
  data = outbreak_auc,
  ties = "efron",
  cluster = init_uid,
  robust = TRUE,
  model = TRUE
)

saveRDS(
  list(
    null = recovery_time_null,
    additive = recovery_time_additive,
    interaction = recovery_time_interaction,
    response = response_name,
    cluster = "init_uid",
    analysis = analysis_name,
    family = "coxph"
  ),
  file.path(MODELS_OUT, "outbreak_recovery_time_vol.rds")
)

model_comparison <- data.table(
  analysis = analysis_name,
  response = response_name,
  model = c("null", "additive", "interaction"),
  n_obs = nrow(outbreak_auc),
  aic = c(
    AIC(recovery_time_null),
    AIC(recovery_time_additive),
    AIC(recovery_time_interaction)
  ),
  bic = c(
    BIC(recovery_time_null),
    BIC(recovery_time_additive),
    BIC(recovery_time_interaction)
  ),
  logLik = c(
    as.numeric(logLik(recovery_time_null)),
    as.numeric(logLik(recovery_time_additive)),
    as.numeric(logLik(recovery_time_interaction))
  ),
  npar = c(
    attr(logLik(recovery_time_null), "df"),
    attr(logLik(recovery_time_additive), "df"),
    attr(logLik(recovery_time_interaction), "df")
  )
)

model_comparison[, model := factor(model, levels = c("null", "additive", "interaction"))]
setorder(model_comparison, response, model)
model_comparison[, delta_aic_vs_null := aic - aic[model == "null"], by = response]
model_comparison[, delta_logLik_vs_null := logLik - logLik[model == "null"], by = response]

descriptive_summary <- outbreak_auc[, .(
  n = .N,
  recovered_n = sum(recovered_vol, na.rm = TRUE),
  censored_n = sum(1L - recovered_vol, na.rm = TRUE),
  recovery_fraction = mean(recovered_vol, na.rm = TRUE),
  mean_time_or_censor = mean(time_to_recovery_or_censor_vol, na.rm = TRUE),
  median_time_or_censor = stats::median(time_to_recovery_or_censor_vol, na.rm = TRUE),
  mean_time_recovered = if (sum(recovered_vol, na.rm = TRUE) == 0) {
    NA_real_
  } else {
    mean(recovery_year_vol[recovered_vol == 1], na.rm = TRUE)
  },
  min_time_recovered = if (sum(recovered_vol, na.rm = TRUE) == 0) {
    NA_real_
  } else {
    min(recovery_year_vol[recovered_vol == 1], na.rm = TRUE)
  },
  max_time_recovered = if (sum(recovered_vol, na.rm = TRUE) == 0) {
    NA_real_
  } else {
    max(recovery_year_vol[recovered_vol == 1], na.rm = TRUE)
  }
), by = .(landscape, aggregation)]
descriptive_summary[, `:=`(
  analysis = analysis_name,
  response = response_name
)]
setorder(descriptive_summary, response, landscape, aggregation)

get_reference_level <- function(model, var_name) {
  model_frame <- model.frame(model)
  if (!var_name %in% names(model_frame) || !is.factor(model_frame[[var_name]])) {
    return(NA_character_)
  }
  levels(model_frame[[var_name]])[[1]]
}

build_parameter_ci <- function(model, selected_model_value) {
  estimates <- stats::coef(model)
  std_errors <- sqrt(diag(as.matrix(stats::vcov(model))))
  ci_low <- estimates - 1.96 * std_errors
  ci_high <- estimates + 1.96 * std_errors

  data.table(
    analysis = analysis_name,
    response = response_name,
    selected_model = selected_model_value,
    term = names(estimates),
    estimate = unname(estimates),
    ci_low = unname(ci_low),
    ci_high = unname(ci_high),
    hazard_ratio = unname(exp(estimates)),
    hazard_ratio_ci_low = unname(exp(ci_low)),
    hazard_ratio_ci_high = unname(exp(ci_high)),
    ci_method = "wald",
    reference_landscape = get_reference_level(model, "landscape"),
    reference_aggregation = get_reference_level(model, "aggregation")
  )
}

selected_model_row <- model_comparison[which.min(aic)]
selected_model_name <- as.character(selected_model_row$model[[1]])
selected_model_fit <- switch(
  selected_model_name,
  null = recovery_time_null,
  additive = recovery_time_additive,
  interaction = recovery_time_interaction
)

parameter_ci <- build_parameter_ci(
  model = selected_model_fit,
  selected_model_value = selected_model_name
)

fwrite(
  model_comparison,
  file.path(TABLES_OUT, "outbreak_recovery_time_model_comparison.csv")
)

fwrite(
  descriptive_summary,
  file.path(TABLES_OUT, "outbreak_recovery_time_descriptive_summary.csv")
)

fwrite(
  parameter_ci,
  file.path(TABLES_OUT, "outbreak_recovery_time_selected_model_parameter_ci.csv")
)

message("Saved outbreak recovery-time model comparison table")
message("Saved outbreak recovery-time descriptive summary table")
message("Saved outbreak recovery-time selected-model parameter CI table")
message("=== Outbreak recovery-time analysis complete ===")
