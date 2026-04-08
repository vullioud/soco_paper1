suppressPackageStartupMessages({
  library(data.table)
  library(ggplot2)
  library(lme4)
  library(survival)
})

OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "clustering-effect")
MODELS_OUT <- file.path(OUT_ROOT, "models")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

PRE_DIST_IN <- file.path(
  "resilience_analysis", "pilot", "manuscript_analysis",
  "pre-disturbance", "data", "pre_disturbance_snapshot_140.csv"
)
OUTBREAK_LOSS_IN <- file.path(
  "resilience_analysis", "pilot", "manuscript_analysis",
  "disturbance", "data", "outbreak_loss.csv"
)
OUTBREAK_AUC_IN <- file.path(
  "resilience_analysis", "pilot", "manuscript_analysis",
  "disturbance", "data", "outbreak_auc.csv"
)
CHRONIC_ENDSTATE_IN <- file.path(
  "resilience_analysis", "pilot", "manuscript_analysis",
  "constant-disturbance", "data", "constant_disturbance_endstate.csv"
)

dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(MODELS_OUT, "clustering_effect_*.rds"))
unlink(file.path(TABLES_OUT, "clustering_effect_*.csv"))
unlink(file.path(FIGURES_OUT, "clustering_effect_*.png"))

message("=== Clustering-effect analysis ===")
message("This block checks whether the two mixed aggregations differ once owner composition is held constant.")
message("Representative responses: year-140 volume, year-140 conifer share, peak outbreak loss,")
message("truncated outbreak AUC, censored recovery time, and year-250 chronic end-state volume.")
message("Diagnostic outputs include mixed-only LRT tables, robust Cox term tests, and")
message("plots showing raw mixed-only distributions plus the position of mixed means")
message("relative to the homogeneous-treatment span.")

homogeneous_levels <- c("matched_big_only", "matched_state_only", "matched_small_only")
mixed_levels <- c("matched_High", "matched_Random")
all_levels <- c(homogeneous_levels, mixed_levels)
aggregation_labels <- c(
  matched_big_only = "productivist",
  matched_state_only = "multifunctionalist",
  matched_small_only = "small-private",
  matched_High = "clustered mixed",
  matched_Random = "random mixed",
  mixed_mean = "mixed mean"
)
response_labels <- c(
  volume_140 = "Year-140 standing volume",
  conifer_140 = "Year-140 conifer share",
  peak_rel_vol = "Peak outbreak volume loss",
  auc_vol_trunc = "Outbreak recovery burden (AUC)",
  time_to_recovery_vol = "Time to full volume recovery",
  delta_vol_250 = "Chronic year-250 volume delta"
)
response_order <- names(response_labels)
landscape_levels <- c("CL02", "CL06", "CL08", "CL10")

get_reference_level <- function(model, var_name) {
  model_frame <- model.frame(model)
  if (!var_name %in% names(model_frame) || !is.factor(model_frame[[var_name]])) {
    return(NA_character_)
  }
  levels(model_frame[[var_name]])[[1]]
}

build_wald_parameter_ci <- function(model, model_type, response_name, selected_model_value, analysis_block) {
  if (identical(model_type, "lmer")) {
    estimates <- lme4::fixef(model)
    std_errors <- sqrt(diag(as.matrix(stats::vcov(model))))
    return(data.table(
      analysis = "clustering_effect",
      analysis_block = analysis_block,
      response = response_name,
      selected_model = selected_model_value,
      model_family = model_type,
      term = names(estimates),
      estimate = unname(estimates),
      ci_low = unname(estimates - 1.96 * std_errors),
      ci_high = unname(estimates + 1.96 * std_errors),
      ci_method = "wald",
      estimate_scale = "response",
      reference_landscape = get_reference_level(model, "landscape"),
      reference_mixed_arrangement = get_reference_level(model, "mixed_arrangement"),
      reference_condition = get_reference_level(model, "condition")
    ))
  }

  estimates <- stats::coef(model)
  std_errors <- sqrt(diag(as.matrix(stats::vcov(model))))
  ci_low <- estimates - 1.96 * std_errors
  ci_high <- estimates + 1.96 * std_errors

  data.table(
    analysis = "clustering_effect",
    analysis_block = analysis_block,
    response = response_name,
    selected_model = selected_model_value,
    model_family = model_type,
    term = names(estimates),
    estimate = unname(estimates),
    ci_low = unname(ci_low),
    ci_high = unname(ci_high),
    ci_method = "wald",
    estimate_scale = "log_hazard",
    hazard_ratio = unname(exp(estimates)),
    hazard_ratio_ci_low = unname(exp(ci_low)),
    hazard_ratio_ci_high = unname(exp(ci_high)),
    reference_landscape = get_reference_level(model, "landscape"),
    reference_mixed_arrangement = get_reference_level(model, "mixed_arrangement"),
    reference_condition = get_reference_level(model, "condition")
  )
}

build_midway_summary <- function(data_full, value_col, response_name, analysis_block) {
  means_all <- data_full[
    is.finite(get(value_col)),
    .(mean_value = mean(get(value_col), na.rm = TRUE)),
    by = .(landscape, aggregation)
  ]

  homogeneous_span <- means_all[
    aggregation %in% homogeneous_levels,
    .(
      homogeneous_min = min(mean_value, na.rm = TRUE),
      homogeneous_max = max(mean_value, na.rm = TRUE),
      homogeneous_mean = mean(mean_value, na.rm = TRUE)
    ),
    by = landscape
  ]

  mixed_means <- means_all[aggregation %in% mixed_levels]
  mixed_mean_combined <- mixed_means[
    ,
    .(mean_value = mean(mean_value, na.rm = TRUE)),
    by = landscape
  ]
  mixed_mean_combined[, aggregation := "mixed_mean"]

  out <- rbind(mixed_means, mixed_mean_combined, fill = TRUE)
  out <- merge(out, homogeneous_span, by = "landscape", all.x = TRUE, sort = FALSE)
  out[, within_homogeneous_range := mean_value >= homogeneous_min & mean_value <= homogeneous_max]
  out[, distance_from_homogeneous_mean := mean_value - homogeneous_mean]
  out[, position_fraction := fifelse(
    homogeneous_max == homogeneous_min,
    NA_real_,
    (mean_value - homogeneous_min) / (homogeneous_max - homogeneous_min)
  )]
  out[, `:=`(
    analysis = "clustering_effect",
    analysis_block = analysis_block,
    response = response_name
  )]
  setcolorder(out, c(
    "analysis", "analysis_block", "response", "landscape", "aggregation",
    "mean_value", "homogeneous_min", "homogeneous_max", "homogeneous_mean",
    "within_homogeneous_range", "distance_from_homogeneous_mean", "position_fraction"
  ))
  out[]
}

fit_mixed_only_lmer <- function(data_full, value_col, response_name, analysis_block, include_condition = FALSE) {
  data_full <- copy(data_full)
  data_full <- data_full[is.finite(get(value_col))]
  data_full[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
  data_full[, init_uid := factor(init_uid)]
  if (include_condition) {
    data_full[, condition := stats::relevel(factor(condition), ref = "control")]
  }

  data_mixed <- data_full[aggregation %in% mixed_levels]
  data_mixed[, mixed_arrangement := fifelse(aggregation == "matched_High", "clustered", "random")]
  data_mixed[, mixed_arrangement := stats::relevel(factor(mixed_arrangement), ref = "clustered")]

  null_rhs <- if (include_condition) {
    "condition + landscape + (1 | init_uid)"
  } else {
    "landscape + (1 | init_uid)"
  }
  additive_rhs <- if (include_condition) {
    "condition + landscape + mixed_arrangement + (1 | init_uid)"
  } else {
    "landscape + mixed_arrangement + (1 | init_uid)"
  }
  interaction_rhs <- if (include_condition) {
    "condition + landscape * mixed_arrangement + (1 | init_uid)"
  } else {
    "landscape * mixed_arrangement + (1 | init_uid)"
  }

  list(
    full_data = data_full,
    mixed_data = data_mixed,
    response = response_name,
    response_label = response_labels[[response_name]],
    analysis_block = analysis_block,
    model_family = "lmer",
    value_col = value_col,
    status_col = NA_character_,
    include_condition = include_condition,
    models = list(
      null = lmer(stats::as.formula(sprintf("%s ~ %s", value_col, null_rhs)), data = data_mixed, REML = FALSE),
      additive = lmer(stats::as.formula(sprintf("%s ~ %s", value_col, additive_rhs)), data = data_mixed, REML = FALSE),
      interaction = lmer(stats::as.formula(sprintf("%s ~ %s", value_col, interaction_rhs)), data = data_mixed, REML = FALSE)
    )
  )
}

fit_mixed_only_cox <- function(data_full, time_col, status_col, response_name, analysis_block) {
  data_full <- copy(data_full)
  data_full <- data_full[is.finite(get(time_col))]
  data_full[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
  data_full[, init_uid := factor(init_uid)]
  data_full[, (status_col) := as.integer(get(status_col))]

  data_mixed <- data_full[aggregation %in% mixed_levels]
  data_mixed[, mixed_arrangement := fifelse(aggregation == "matched_High", "clustered", "random")]
  data_mixed[, mixed_arrangement := stats::relevel(factor(mixed_arrangement), ref = "clustered")]

  list(
    full_data = data_full,
    mixed_data = data_mixed,
    response = response_name,
    response_label = response_labels[[response_name]],
    analysis_block = analysis_block,
    model_family = "coxph",
    value_col = time_col,
    status_col = status_col,
    include_condition = FALSE,
    models = list(
      null = coxph(
        stats::as.formula(sprintf("Surv(%s, %s) ~ landscape", time_col, status_col)),
        data = data_mixed,
        ties = "efron",
        cluster = init_uid,
        robust = TRUE,
        model = TRUE
      ),
      additive = coxph(
        stats::as.formula(sprintf("Surv(%s, %s) ~ landscape + mixed_arrangement", time_col, status_col)),
        data = data_mixed,
        ties = "efron",
        cluster = init_uid,
        robust = TRUE,
        model = TRUE
      ),
      interaction = coxph(
        stats::as.formula(sprintf("Surv(%s, %s) ~ landscape * mixed_arrangement", time_col, status_col)),
        data = data_mixed,
        ties = "efron",
        cluster = init_uid,
        robust = TRUE,
        model = TRUE
      )
    ),
    lrt_models = list(
      null = coxph(
        stats::as.formula(sprintf("Surv(%s, %s) ~ landscape", time_col, status_col)),
        data = data_mixed,
        ties = "efron",
        model = TRUE
      ),
      additive = coxph(
        stats::as.formula(sprintf("Surv(%s, %s) ~ landscape + mixed_arrangement", time_col, status_col)),
        data = data_mixed,
        ties = "efron",
        model = TRUE
      ),
      interaction = coxph(
        stats::as.formula(sprintf("Surv(%s, %s) ~ landscape * mixed_arrangement", time_col, status_col)),
        data = data_mixed,
        ties = "efron",
        model = TRUE
      )
    )
  )
}

extract_lrt_tests <- function(fit_obj) {
  model_family <- fit_obj$model_family
  analysis_block <- fit_obj$analysis_block
  response_name <- fit_obj$response

  lrt_table <- if (identical(model_family, "lmer")) {
    as.data.table(anova(
      fit_obj$models$null,
      fit_obj$models$additive,
      fit_obj$models$interaction
    ), keep.rownames = "model_step")
  } else {
    as.data.table(anova(
      fit_obj$lrt_models$null,
      fit_obj$lrt_models$additive,
      fit_obj$lrt_models$interaction,
      test = "Chisq"
    ), keep.rownames = "model_step")
  }

  p_col <- if ("Pr(>Chisq)" %in% names(lrt_table)) {
    "Pr(>Chisq)"
  } else if ("Pr(>|Chi|)" %in% names(lrt_table)) {
    "Pr(>|Chi|)"
  } else {
    NA_character_
  }

  lrt_table[, `:=`(
    analysis = "clustering_effect",
    analysis_block = analysis_block,
    response = response_name,
    model_family = model_family
  )]

  out <- data.table()

  if (nrow(lrt_table) >= 2) {
    out <- rbind(
      out,
      data.table(
        analysis = "clustering_effect",
        analysis_block = analysis_block,
        response = response_name,
        model_family = model_family,
        test_label = "add_main_effect",
        from_model = "null",
        to_model = "additive",
        term = "mixed_arrangement",
        statistic = lrt_table[2][["Chisq"]],
        df = lrt_table[2][["Df"]],
        p_value = if (is.na(p_col)) NA_real_ else lrt_table[2][[p_col]],
        test_basis = if (identical(model_family, "lmer")) "likelihood_ratio" else "likelihood_ratio_unclustered"
      ),
      fill = TRUE
    )
  }

  if (nrow(lrt_table) >= 3) {
    out <- rbind(
      out,
      data.table(
        analysis = "clustering_effect",
        analysis_block = analysis_block,
        response = response_name,
        model_family = model_family,
        test_label = "add_landscape_interaction",
        from_model = "additive",
        to_model = "interaction",
        term = "landscape:mixed_arrangement",
        statistic = lrt_table[3][["Chisq"]],
        df = lrt_table[3][["Df"]],
        p_value = if (is.na(p_col)) NA_real_ else lrt_table[3][[p_col]],
        test_basis = if (identical(model_family, "lmer")) "likelihood_ratio" else "likelihood_ratio_unclustered"
      ),
      fill = TRUE
    )
  }

  out[]
}

extract_term_tests <- function(fit_obj, selected_model_name) {
  model_family <- fit_obj$model_family
  analysis_block <- fit_obj$analysis_block
  response_name <- fit_obj$response

  if (identical(model_family, "lmer")) {
    additive_drop <- as.data.table(drop1(fit_obj$models$additive, test = "Chisq"), keep.rownames = "term")
    interaction_drop <- as.data.table(drop1(fit_obj$models$interaction, test = "Chisq"), keep.rownames = "term")

    out <- rbind(
      additive_drop[term == "mixed_arrangement", .(
        analysis = "clustering_effect",
        analysis_block = analysis_block,
        response = response_name,
        model_family = model_family,
        selected_model = selected_model_name,
        test_label = "main_effect_drop1",
        term,
        statistic = LRT,
        df = npar,
        p_value = `Pr(Chi)`,
        test_basis = "drop1_likelihood_ratio"
      )],
      interaction_drop[term == "landscape:mixed_arrangement", .(
        analysis = "clustering_effect",
        analysis_block = analysis_block,
        response = response_name,
        model_family = model_family,
        selected_model = selected_model_name,
        test_label = "interaction_drop1",
        term,
        statistic = LRT,
        df = npar,
        p_value = `Pr(Chi)`,
        test_basis = "drop1_likelihood_ratio"
      )],
      fill = TRUE
    )
    return(out[])
  }

  selected_fit <- fit_obj$models[[selected_model_name]]
  coef_dt <- as.data.table(summary(selected_fit)$coefficients, keep.rownames = "term")
  coef_dt <- coef_dt[grepl("mixed_arrangement", term)]
  if (!nrow(coef_dt)) {
    return(data.table())
  }

  coef_dt[, `:=`(
    analysis = "clustering_effect",
    analysis_block = analysis_block,
    response = response_name,
    model_family = model_family,
    selected_model = selected_model_name,
    test_label = fifelse(
      grepl(":", term, fixed = TRUE),
      "robust_wald_interaction_term",
      "robust_wald_main_term"
    ),
    statistic = z,
    df = 1,
    p_value = `Pr(>|z|)`,
    test_basis = "robust_wald"
  )]

  coef_dt[, .(
    analysis,
    analysis_block,
    response,
    model_family,
    selected_model,
    test_label,
    term,
    estimate = coef,
    robust_se = `robust se`,
    statistic,
    df,
    p_value,
    test_basis
  )]
}

build_plot_data <- function(fit_obj) {
  dt <- copy(fit_obj$mixed_data)
  dt[, value := get(fit_obj$value_col)]
  dt[, response := fit_obj$response]
  dt[, response_label := fit_obj$response_label]
  dt[, landscape := factor(as.character(landscape), levels = landscape_levels)]
  dt[, mixed_arrangement := factor(as.character(mixed_arrangement), levels = c("clustered", "random"))]
  if (identical(fit_obj$model_family, "coxph")) {
    dt[, recovery_status := fifelse(get(fit_obj$status_col) == 1L, "recovered", "censored")]
  } else {
    dt[, recovery_status := "observed"]
  }
  dt[, .(
    analysis_block = fit_obj$analysis_block,
    response,
    response_label,
    landscape,
    mixed_arrangement,
    value,
    recovery_status
  )]
}

build_corner_case_data <- function(false_cases, fit_lookup) {
  out <- data.table()

  for (i in seq_len(nrow(false_cases))) {
    case_row <- false_cases[i]
    fit_key <- sprintf("%s__%s", case_row$analysis_block, case_row$response)
    fit_obj <- fit_lookup[[fit_key]]
    if (is.null(fit_obj)) {
      next
    }

    value_col <- fit_obj$value_col
    case_dt <- copy(fit_obj$full_data)
    case_dt <- case_dt[
      is.finite(get(value_col)) &
        landscape == case_row$landscape &
        aggregation %in% all_levels
    ]

    case_dt[, aggregation := factor(
      aggregation,
      levels = c("matched_big_only", "matched_state_only", "matched_small_only", "matched_High", "matched_Random"),
      labels = c("productivist", "multifunctionalist", "small-private", "clustered mixed", "random mixed")
    )]
    case_dt[, corner_label := sprintf("%s - %s", case_row$landscape, response_labels[[case_row$response]])]
    case_dt[, response_label := response_labels[[case_row$response]]]
    case_dt[, value := get(value_col)]

    out <- rbind(
      out,
      case_dt[, .(corner_label, aggregation, value, response_label)],
      fill = TRUE
    )
  }

  out[]
}

pre_disturbance <- fread(PRE_DIST_IN)
outbreak_loss <- fread(OUTBREAK_LOSS_IN)
outbreak_auc <- fread(OUTBREAK_AUC_IN)
chronic_endstate <- fread(CHRONIC_ENDSTATE_IN)

fits <- list(
  fit_mixed_only_lmer(
    data_full = pre_disturbance,
    value_col = "volume_140",
    response_name = "volume_140",
    analysis_block = "pre_disturbance_state_140",
    include_condition = TRUE
  ),
  fit_mixed_only_lmer(
    data_full = pre_disturbance,
    value_col = "conifer_140",
    response_name = "conifer_140",
    analysis_block = "pre_disturbance_state_140",
    include_condition = TRUE
  ),
  fit_mixed_only_lmer(
    data_full = outbreak_loss,
    value_col = "peak_rel_vol",
    response_name = "peak_rel_vol",
    analysis_block = "outbreak_loss"
  ),
  fit_mixed_only_lmer(
    data_full = outbreak_auc,
    value_col = "auc_vol_trunc",
    response_name = "auc_vol_trunc",
    analysis_block = "outbreak_recovery_auc"
  ),
  fit_mixed_only_cox(
    data_full = outbreak_auc,
    time_col = "time_to_recovery_or_censor_vol",
    status_col = "recovered_vol",
    response_name = "time_to_recovery_vol",
    analysis_block = "outbreak_recovery_time"
  ),
  fit_mixed_only_lmer(
    data_full = chronic_endstate,
    value_col = "delta_vol_250",
    response_name = "delta_vol_250",
    analysis_block = "constant_disturbance_endstate"
  )
)

fit_lookup <- setNames(
  fits,
  vapply(fits, function(x) sprintf("%s__%s", x$analysis_block, x$response), character(1))
)

model_comparison <- data.table()
parameter_ci <- data.table()
midway_summary <- data.table()
lrt_tests <- data.table()
term_tests <- data.table()
mixed_plot_data <- data.table()

for (fit_obj in fits) {
  response_name <- fit_obj$response
  analysis_block <- fit_obj$analysis_block
  model_family <- fit_obj$model_family
  model_bundle <- fit_obj$models

  saveRDS(
    list(
      null = model_bundle$null,
      additive = model_bundle$additive,
      interaction = model_bundle$interaction,
      response = response_name,
      analysis = "clustering_effect",
      analysis_block = analysis_block,
      model_family = model_family
    ),
    file.path(MODELS_OUT, sprintf("clustering_effect_%s.rds", response_name))
  )

  model_rows <- data.table(
    analysis = "clustering_effect",
    analysis_block = analysis_block,
    response = response_name,
    model_family = model_family,
    model = c("null", "additive", "interaction"),
    n_obs = nrow(fit_obj$mixed_data),
    aic = c(
      AIC(model_bundle$null),
      AIC(model_bundle$additive),
      AIC(model_bundle$interaction)
    ),
    bic = c(
      BIC(model_bundle$null),
      BIC(model_bundle$additive),
      BIC(model_bundle$interaction)
    ),
    logLik = c(
      as.numeric(logLik(model_bundle$null)),
      as.numeric(logLik(model_bundle$additive)),
      as.numeric(logLik(model_bundle$interaction))
    ),
    npar = c(
      attr(logLik(model_bundle$null), "df"),
      attr(logLik(model_bundle$additive), "df"),
      attr(logLik(model_bundle$interaction), "df")
    )
  )
  model_rows[, model := factor(model, levels = c("null", "additive", "interaction"))]
  setorder(model_rows, response, model)
  model_rows[, delta_aic_vs_null := aic - aic[model == "null"], by = response]
  model_rows[, delta_logLik_vs_null := logLik - logLik[model == "null"], by = response]
  model_comparison <- rbind(model_comparison, model_rows, fill = TRUE)

  selected_model_row <- model_rows[which.min(aic)]
  selected_model_name <- as.character(selected_model_row$model[[1]])
  selected_model_fit <- model_bundle[[selected_model_name]]

  parameter_ci <- rbind(
    parameter_ci,
    build_wald_parameter_ci(
      model = selected_model_fit,
      model_type = model_family,
      response_name = response_name,
      selected_model_value = selected_model_name,
      analysis_block = analysis_block
    ),
    fill = TRUE
  )

  lrt_tests <- rbind(lrt_tests, extract_lrt_tests(fit_obj), fill = TRUE)
  term_tests <- rbind(term_tests, extract_term_tests(fit_obj, selected_model_name), fill = TRUE)
  mixed_plot_data <- rbind(mixed_plot_data, build_plot_data(fit_obj), fill = TRUE)

  if (!identical(response_name, "time_to_recovery_vol")) {
    midway_summary <- rbind(
      midway_summary,
      build_midway_summary(
        data_full = fit_obj$full_data,
        value_col = fit_obj$value_col,
        response_name = response_name,
        analysis_block = analysis_block
      ),
      fill = TRUE
    )
  }
}

midway_summary[, response_label := factor(response_labels[response], levels = unname(response_labels))]
midway_summary[, landscape := factor(as.character(landscape), levels = landscape_levels)]
midway_summary[, aggregation_label := factor(
  aggregation_labels[aggregation],
  levels = c("productivist", "multifunctionalist", "small-private", "clustered mixed", "random mixed", "mixed mean")
)]

mixed_plot_data[, response_label := factor(response_label, levels = unname(response_labels))]
mixed_plot_data[, landscape := factor(as.character(landscape), levels = landscape_levels)]

setorder(model_comparison, response, model)
setorder(parameter_ci, response, term)
setorder(midway_summary, response, landscape, aggregation)
setorder(lrt_tests, response, test_label)
setorder(term_tests, response, test_label, term)

fwrite(
  model_comparison,
  file.path(TABLES_OUT, "clustering_effect_model_comparison.csv")
)

fwrite(
  parameter_ci,
  file.path(TABLES_OUT, "clustering_effect_selected_model_parameter_ci.csv")
)

fwrite(
  midway_summary,
  file.path(TABLES_OUT, "clustering_effect_midway_summary.csv")
)

fwrite(
  lrt_tests,
  file.path(TABLES_OUT, "clustering_effect_lrt_tests.csv")
)

fwrite(
  term_tests,
  file.path(TABLES_OUT, "clustering_effect_term_tests.csv")
)

mixed_plot_non_time <- mixed_plot_data[response != "time_to_recovery_vol"]
plot_mixed_only <- ggplot(
  mixed_plot_non_time,
  aes(x = mixed_arrangement, y = value, color = mixed_arrangement)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.25, width = 0.55) +
  geom_jitter(width = 0.12, alpha = 0.65, size = 1.5) +
  facet_grid(response_label ~ landscape, scales = "free_y") +
  scale_color_manual(values = c(clustered = "#2f5d8a", random = "#b35c1e")) +
  labs(
    title = "Clustering effect: mixed-only raw distributions",
    subtitle = "Clustered versus random ownership, shown only within the two mixed treatments",
    x = "Mixed arrangement",
    y = "Response value"
  ) +
  theme_minimal(base_size = 11) +
  theme(legend.position = "none")

ggsave(
  filename = file.path(FIGURES_OUT, "clustering_effect_mixed_only_overview.png"),
  plot = plot_mixed_only,
  width = 12,
  height = 13,
  dpi = 300
)

recovery_plot_data <- mixed_plot_data[response == "time_to_recovery_vol"]
plot_recovery_time <- ggplot(
  recovery_plot_data,
  aes(x = mixed_arrangement, y = value, color = recovery_status)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.2, width = 0.55) +
  geom_jitter(width = 0.12, alpha = 0.8, size = 1.8) +
  facet_wrap(~ landscape, nrow = 1) +
  scale_color_manual(values = c(recovered = "#2f8f46", censored = "#c23b22")) +
  labs(
    title = "Clustering effect: censored recovery times",
    subtitle = "Points at 100 years are right-censored runs that did not recover by year 250",
    x = "Mixed arrangement",
    y = "Time to recovery or censor (years)"
  ) +
  theme_minimal(base_size = 11)

ggsave(
  filename = file.path(FIGURES_OUT, "clustering_effect_recovery_time.png"),
  plot = plot_recovery_time,
  width = 12,
  height = 4.5,
  dpi = 300
)

span_plot_data <- midway_summary[aggregation %in% c("matched_High", "matched_Random", "mixed_mean")]
plot_midway <- ggplot() +
  geom_segment(
    data = unique(span_plot_data[, .(response_label, landscape, homogeneous_min, homogeneous_max)]),
    aes(
      x = homogeneous_min,
      xend = homogeneous_max,
      y = landscape,
      yend = landscape
    ),
    linewidth = 2.2,
    color = "#c7c7c7"
  ) +
  geom_point(
    data = span_plot_data,
    aes(x = mean_value, y = landscape, color = aggregation_label, shape = aggregation_label),
    size = 3
  ) +
  facet_wrap(~ response_label, scales = "free_x", ncol = 2) +
  scale_color_manual(values = c(
    "clustered mixed" = "#2f5d8a",
    "random mixed" = "#b35c1e",
    "mixed mean" = "#111111"
  )) +
  scale_shape_manual(values = c(
    "clustered mixed" = 16,
    "random mixed" = 17,
    "mixed mean" = 18
  )) +
  labs(
    title = "Clustering effect: mixed means against the homogeneous span",
    subtitle = "Grey line = range spanned by productivist, multifunctionalist, and small-private means",
    x = "Mean response value",
    y = "Landscape",
    color = NULL,
    shape = NULL
  ) +
  theme_minimal(base_size = 11)

ggsave(
  filename = file.path(FIGURES_OUT, "clustering_effect_midway_overview.png"),
  plot = plot_midway,
  width = 13,
  height = 8.5,
  dpi = 300
)

false_cases <- midway_summary[aggregation == "mixed_mean" & !within_homogeneous_range]
corner_case_data <- build_corner_case_data(false_cases, fit_lookup)

if (nrow(corner_case_data)) {
  plot_corner_cases <- ggplot(
    corner_case_data,
    aes(x = aggregation, y = value, color = aggregation)
  ) +
    geom_boxplot(outlier.shape = NA, alpha = 0.25, width = 0.6) +
    geom_jitter(width = 0.12, alpha = 0.75, size = 1.6) +
    facet_wrap(~ corner_label, scales = "free_y") +
    scale_color_manual(values = c(
      "productivist" = "#1b9e77",
      "multifunctionalist" = "#7570b3",
      "small-private" = "#d95f02",
      "clustered mixed" = "#2f5d8a",
      "random mixed" = "#b35c1e"
    )) +
    labs(
      title = "Clustering effect: corner cases where the combined mixed mean falls outside the homogeneous span",
      x = "Aggregation",
      y = "Response value"
    ) +
    theme_minimal(base_size = 11) +
    theme(axis.text.x = element_text(angle = 25, hjust = 1), legend.position = "none")

  ggsave(
    filename = file.path(FIGURES_OUT, "clustering_effect_corner_cases.png"),
    plot = plot_corner_cases,
    width = 12,
    height = 5.5,
    dpi = 300
  )
}

message("Saved clustering-effect model comparison table")
message("Saved clustering-effect selected-model parameter CI table")
message("Saved clustering-effect midway summary table")
message("Saved clustering-effect likelihood-ratio test table")
message("Saved clustering-effect focal term-test table")
message("Saved clustering-effect overview figures")
message("=== Clustering-effect analysis complete ===")
