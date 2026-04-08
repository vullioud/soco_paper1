suppressPackageStartupMessages({
  library(data.table)
  library(ggplot2)
  library(lme4)
})

source(file.path(
  "resilience_analysis",
  "pilot",
  "manuscript_analysis",
  "scripts",
  "model_ci_helpers.R"
))

OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "harvest")
DATA_IN <- file.path(OUT_ROOT, "data", "chronic_harvest.csv")
MODELS_OUT <- file.path(OUT_ROOT, "models")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(MODELS_OUT, "chronic_harvest_*.rds"))
unlink(file.path(TABLES_OUT, "chronic_harvest_*.csv"))
unlink(file.path(FIGURES_OUT, "chronic_harvest_*.png"))

message("=== Constant disturbance harvest analysis ===")
message("This script compares chronic harvest levels against paired controls.")

chronic_harvest <- fread(DATA_IN)
chronic_harvest[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
chronic_harvest[, aggregation := stats::relevel(factor(aggregation), ref = "matched_High")]
chronic_harvest[, init_uid := factor(init_uid)]

response_map <- data.table(
  response = c("delta_planned_mean", "delta_salvage_mean", "delta_total_mean"),
  title = c(
    "Constant disturbance planned harvest: treatment-control gap",
    "Constant disturbance salvage: treatment-control gap",
    "Constant disturbance total extracted volume: treatment-control gap"
  ),
  ylab = c(
    "Planned harvest gap (2-250)",
    "Salvage gap (2-250)",
    "Total extracted gap (2-250)"
  ),
  stem = c("delta_planned_mean", "delta_salvage_mean", "delta_total_mean")
)

model_comparison <- data.table()
anova_comparison <- data.table()
descriptive_summary <- data.table()
pairwise_tukey <- data.table()

for (i in seq_len(nrow(response_map))) {
  response <- response_map$response[i]
  plot_title <- response_map$title[i]
  ylab <- response_map$ylab[i]
  stem <- response_map$stem[i]

  message(sprintf("Fitting constant harvest model set: %s", response))
  dat <- chronic_harvest[is.finite(get(response))]

  null_formula <- as.formula(sprintf("%s ~ landscape + (1 | init_uid)", response))
  additive_formula <- as.formula(sprintf("%s ~ landscape + aggregation + (1 | init_uid)", response))
  interaction_formula <- as.formula(sprintf("%s ~ landscape * aggregation + (1 | init_uid)", response))

  m_null <- lmer(null_formula, data = dat, REML = FALSE)
  m_additive <- lmer(additive_formula, data = dat, REML = FALSE)
  m_interaction <- lmer(interaction_formula, data = dat, REML = FALSE)

  saveRDS(
    list(
      null = m_null,
      additive = m_additive,
      interaction = m_interaction,
      response = response,
      random_effect = "init_uid",
      analysis = "chronic_harvest"
    ),
    file.path(MODELS_OUT, sprintf("chronic_harvest_%s.rds", stem))
  )

  model_comparison <- rbind(
    model_comparison,
    data.table(
      analysis = "chronic_harvest",
      response = response,
      model = c("null", "additive", "interaction"),
      n_obs = nrow(dat),
      aic = c(AIC(m_null), AIC(m_additive), AIC(m_interaction)),
      bic = c(BIC(m_null), BIC(m_additive), BIC(m_interaction)),
      logLik = c(as.numeric(logLik(m_null)), as.numeric(logLik(m_additive)), as.numeric(logLik(m_interaction))),
      npar = c(attr(logLik(m_null), "df"), attr(logLik(m_additive), "df"), attr(logLik(m_interaction), "df"))
    ),
    fill = TRUE
  )

  anova_dt <- as.data.table(anova(m_null, m_additive, m_interaction), keep.rownames = "model_step")
  anova_dt[, `:=`(analysis = "chronic_harvest", response = response)]
  anova_comparison <- rbind(anova_comparison, anova_dt, fill = TRUE)

  summary_dt <- dat[, .(
    mean = mean(get(response), na.rm = TRUE),
    sd = sd(get(response), na.rm = TRUE),
    n = .N
  ), by = .(landscape, aggregation)]
  summary_dt[, se := sd / sqrt(n)]
  summary_dt[, ci_low := mean - 1.96 * se]
  summary_dt[, ci_high := mean + 1.96 * se]
  summary_dt[, `:=`(analysis = "chronic_harvest", response = response)]
  descriptive_summary <- rbind(descriptive_summary, summary_dt, fill = TRUE)

  for (landscape_name in unique(as.character(dat$landscape))) {
    dat_land <- dat[landscape == landscape_name]
    tuk <- as.data.table(TukeyHSD(aov(as.formula(sprintf("%s ~ aggregation", response)), data = dat_land), which = "aggregation")$aggregation, keep.rownames = "contrast")
    tuk[, `:=`(analysis = "chronic_harvest", response = response, landscape = landscape_name)]
    pairwise_tukey <- rbind(pairwise_tukey, tuk, fill = TRUE)
  }

  raw_plot <- ggplot(dat, aes(x = aggregation, y = get(response))) +
    geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#ebe3d5", color = "#6b4f3b") +
    geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#6b4f3b") +
    facet_wrap(~ landscape, scales = "free_y") +
    labs(title = plot_title, x = "Aggregation", y = ylab) +
    theme_minimal(base_size = 11) +
    theme(axis.text.x = element_text(angle = 30, hjust = 1))

  ggsave(file.path(FIGURES_OUT, sprintf("chronic_harvest_%s_raw.png", stem)), raw_plot, width = 12, height = 7, dpi = 300)

  summary_plot <- ggplot(summary_dt, aes(x = aggregation, y = mean)) +
    geom_point(size = 2.4, color = "#6b4f3b") +
    geom_errorbar(aes(ymin = ci_low, ymax = ci_high), width = 0.18, color = "#6b4f3b") +
    facet_wrap(~ landscape, scales = "free_y") +
    labs(title = plot_title, subtitle = "Mean and 95% interval by landscape", x = "Aggregation", y = ylab) +
    theme_minimal(base_size = 11) +
    theme(axis.text.x = element_text(angle = 30, hjust = 1))

  ggsave(file.path(FIGURES_OUT, sprintf("chronic_harvest_%s_summary.png", stem)), summary_plot, width = 12, height = 7, dpi = 300)
}

model_comparison[, model := factor(model, levels = c("null", "additive", "interaction"))]
setorder(model_comparison, response, model)
model_comparison[, delta_aic_vs_null := aic - aic[model == "null"], by = response]
model_comparison[, delta_logLik_vs_null := logLik - logLik[model == "null"], by = response]

setorder(descriptive_summary, response, landscape, aggregation)
setorder(pairwise_tukey, response, landscape, contrast)

parameter_ci <- extract_selected_model_parameter_ci(
  model_comparison = model_comparison,
  models_dir = MODELS_OUT,
  analysis_name = "chronic_harvest"
)

fwrite(model_comparison, file.path(TABLES_OUT, "chronic_harvest_model_comparison.csv"))
fwrite(anova_comparison, file.path(TABLES_OUT, "chronic_harvest_anova_comparison.csv"))
fwrite(descriptive_summary, file.path(TABLES_OUT, "chronic_harvest_descriptive_summary.csv"))
fwrite(pairwise_tukey, file.path(TABLES_OUT, "chronic_harvest_pairwise_tukey.csv"))
fwrite(parameter_ci, file.path(TABLES_OUT, "chronic_harvest_selected_model_parameter_ci.csv"))

message("Saved chronic harvest selected-model parameter CI table")
message("=== Constant disturbance harvest analysis complete ===")
