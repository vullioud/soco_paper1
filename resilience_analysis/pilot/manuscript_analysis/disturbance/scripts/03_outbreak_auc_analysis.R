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

OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "disturbance")
DATA_IN <- file.path(OUT_ROOT, "data", "outbreak_auc.csv")
MODELS_OUT <- file.path(OUT_ROOT, "models")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(MODELS_OUT, "outbreak_auc_*.rds"))
unlink(file.path(TABLES_OUT, "outbreak_auc_*.csv"))
unlink(file.path(FIGURES_OUT, "outbreak_auc_*.png"))

message("=== Outbreak AUC analysis ===")
message("This script asks whether aggregation changes the post-disturbance burden.")
message("Responses: auc_vol_trunc, auc_gini_trunc, auc_conifer_trunc")
message("Repeated grouping term: init_uid = landscape + replicate")
message("Nested models per response:")
message("  1. null       = landscape + (1 | init_uid)")
message("  2. additive   = landscape + aggregation + (1 | init_uid)")
message("  3. interaction= landscape * aggregation + (1 | init_uid)")

outbreak_auc <- fread(DATA_IN)
outbreak_auc[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
outbreak_auc[, aggregation := stats::relevel(factor(aggregation), ref = "matched_High")]
outbreak_auc[, init_uid := factor(init_uid)]

model_comparison <- data.table()
anova_comparison <- data.table()
descriptive_summary <- data.table()
pairwise_tukey <- data.table()

# -----------------------------------------------------------------------------
# Response 1: auc_vol_trunc
# -----------------------------------------------------------------------------
message("Fitting outbreak AUC model set: auc_vol_trunc")
outbreak_auc_vol <- outbreak_auc[is.finite(auc_vol_trunc)]

outbreak_auc_vol_null <- lmer(
  auc_vol_trunc ~ landscape + (1 | init_uid),
  data = outbreak_auc_vol,
  REML = FALSE
)

outbreak_auc_vol_additive <- lmer(
  auc_vol_trunc ~ landscape + aggregation + (1 | init_uid),
  data = outbreak_auc_vol,
  REML = FALSE
)

outbreak_auc_vol_interaction <- lmer(
  auc_vol_trunc ~ landscape * aggregation + (1 | init_uid),
  data = outbreak_auc_vol,
  REML = FALSE
)

saveRDS(
  list(
    null = outbreak_auc_vol_null,
    additive = outbreak_auc_vol_additive,
    interaction = outbreak_auc_vol_interaction,
    response = "auc_vol_trunc",
    random_effect = "init_uid",
    analysis = "outbreak_auc"
  ),
  file.path(MODELS_OUT, "outbreak_auc_vol_trunc.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "outbreak_auc",
    response = "auc_vol_trunc",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(outbreak_auc_vol),
    aic = c(
      AIC(outbreak_auc_vol_null),
      AIC(outbreak_auc_vol_additive),
      AIC(outbreak_auc_vol_interaction)
    ),
    bic = c(
      BIC(outbreak_auc_vol_null),
      BIC(outbreak_auc_vol_additive),
      BIC(outbreak_auc_vol_interaction)
    ),
    logLik = c(
      as.numeric(logLik(outbreak_auc_vol_null)),
      as.numeric(logLik(outbreak_auc_vol_additive)),
      as.numeric(logLik(outbreak_auc_vol_interaction))
    ),
    npar = c(
      attr(logLik(outbreak_auc_vol_null), "df"),
      attr(logLik(outbreak_auc_vol_additive), "df"),
      attr(logLik(outbreak_auc_vol_interaction), "df")
    )
  ),
  fill = TRUE
)

outbreak_auc_vol_anova <- as.data.table(anova(
  outbreak_auc_vol_null,
  outbreak_auc_vol_additive,
  outbreak_auc_vol_interaction
), keep.rownames = "model_step")
outbreak_auc_vol_anova[, `:=`(
  analysis = "outbreak_auc",
  response = "auc_vol_trunc"
)]
anova_comparison <- rbind(anova_comparison, outbreak_auc_vol_anova, fill = TRUE)

outbreak_auc_vol_summary <- outbreak_auc_vol[, .(
  mean = mean(auc_vol_trunc, na.rm = TRUE),
  sd = sd(auc_vol_trunc, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
outbreak_auc_vol_summary[, se := sd / sqrt(n)]
outbreak_auc_vol_summary[, ci_low := mean - 1.96 * se]
outbreak_auc_vol_summary[, ci_high := mean + 1.96 * se]
outbreak_auc_vol_summary[, `:=`(
  analysis = "outbreak_auc",
  response = "auc_vol_trunc"
)]
descriptive_summary <- rbind(descriptive_summary, outbreak_auc_vol_summary, fill = TRUE)

for (landscape_name in unique(as.character(outbreak_auc_vol$landscape))) {
  outbreak_auc_vol_landscape <- outbreak_auc_vol[landscape == landscape_name]
  outbreak_auc_vol_aov <- aov(
    auc_vol_trunc ~ aggregation,
    data = outbreak_auc_vol_landscape
  )
  outbreak_auc_vol_tukey <- as.data.table(
    TukeyHSD(outbreak_auc_vol_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  outbreak_auc_vol_tukey[, `:=`(
    analysis = "outbreak_auc",
    response = "auc_vol_trunc",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, outbreak_auc_vol_tukey, fill = TRUE)
}

plot_auc_vol_raw <- ggplot(
  outbreak_auc_vol,
  aes(x = aggregation, y = auc_vol_trunc)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#d7e3f4", color = "#2f5d8a") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#2f5d8a") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak burden: truncated volume AUC",
    subtitle = "Cumulative treatment-control divergence until recovery or censoring",
    x = "Aggregation",
    y = "Truncated volume AUC"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_auc_vol_trunc_raw.png"),
  plot = plot_auc_vol_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_auc_vol_summary <- ggplot(
  outbreak_auc_vol_summary,
  aes(x = aggregation, y = mean)
) +
  geom_point(size = 2.4, color = "#2f5d8a") +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    width = 0.18,
    color = "#2f5d8a"
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak burden: truncated volume AUC",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Truncated volume AUC"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_auc_vol_trunc_summary.png"),
  plot = plot_auc_vol_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 2: auc_gini_trunc
# -----------------------------------------------------------------------------
message("Fitting outbreak AUC model set: auc_gini_trunc")
outbreak_auc_gini <- outbreak_auc[is.finite(auc_gini_trunc)]

outbreak_auc_gini_null <- lmer(
  auc_gini_trunc ~ landscape + (1 | init_uid),
  data = outbreak_auc_gini,
  REML = FALSE
)

outbreak_auc_gini_additive <- lmer(
  auc_gini_trunc ~ landscape + aggregation + (1 | init_uid),
  data = outbreak_auc_gini,
  REML = FALSE
)

outbreak_auc_gini_interaction <- lmer(
  auc_gini_trunc ~ landscape * aggregation + (1 | init_uid),
  data = outbreak_auc_gini,
  REML = FALSE
)

saveRDS(
  list(
    null = outbreak_auc_gini_null,
    additive = outbreak_auc_gini_additive,
    interaction = outbreak_auc_gini_interaction,
    response = "auc_gini_trunc",
    random_effect = "init_uid",
    analysis = "outbreak_auc"
  ),
  file.path(MODELS_OUT, "outbreak_auc_gini_trunc.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "outbreak_auc",
    response = "auc_gini_trunc",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(outbreak_auc_gini),
    aic = c(
      AIC(outbreak_auc_gini_null),
      AIC(outbreak_auc_gini_additive),
      AIC(outbreak_auc_gini_interaction)
    ),
    bic = c(
      BIC(outbreak_auc_gini_null),
      BIC(outbreak_auc_gini_additive),
      BIC(outbreak_auc_gini_interaction)
    ),
    logLik = c(
      as.numeric(logLik(outbreak_auc_gini_null)),
      as.numeric(logLik(outbreak_auc_gini_additive)),
      as.numeric(logLik(outbreak_auc_gini_interaction))
    ),
    npar = c(
      attr(logLik(outbreak_auc_gini_null), "df"),
      attr(logLik(outbreak_auc_gini_additive), "df"),
      attr(logLik(outbreak_auc_gini_interaction), "df")
    )
  ),
  fill = TRUE
)

outbreak_auc_gini_anova <- as.data.table(anova(
  outbreak_auc_gini_null,
  outbreak_auc_gini_additive,
  outbreak_auc_gini_interaction
), keep.rownames = "model_step")
outbreak_auc_gini_anova[, `:=`(
  analysis = "outbreak_auc",
  response = "auc_gini_trunc"
)]
anova_comparison <- rbind(anova_comparison, outbreak_auc_gini_anova, fill = TRUE)

outbreak_auc_gini_summary <- outbreak_auc_gini[, .(
  mean = mean(auc_gini_trunc, na.rm = TRUE),
  sd = sd(auc_gini_trunc, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
outbreak_auc_gini_summary[, se := sd / sqrt(n)]
outbreak_auc_gini_summary[, ci_low := mean - 1.96 * se]
outbreak_auc_gini_summary[, ci_high := mean + 1.96 * se]
outbreak_auc_gini_summary[, `:=`(
  analysis = "outbreak_auc",
  response = "auc_gini_trunc"
)]
descriptive_summary <- rbind(descriptive_summary, outbreak_auc_gini_summary, fill = TRUE)

for (landscape_name in unique(as.character(outbreak_auc_gini$landscape))) {
  outbreak_auc_gini_landscape <- outbreak_auc_gini[landscape == landscape_name]
  outbreak_auc_gini_aov <- aov(
    auc_gini_trunc ~ aggregation,
    data = outbreak_auc_gini_landscape
  )
  outbreak_auc_gini_tukey <- as.data.table(
    TukeyHSD(outbreak_auc_gini_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  outbreak_auc_gini_tukey[, `:=`(
    analysis = "outbreak_auc",
    response = "auc_gini_trunc",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, outbreak_auc_gini_tukey, fill = TRUE)
}

plot_auc_gini_raw <- ggplot(
  outbreak_auc_gini,
  aes(x = aggregation, y = auc_gini_trunc)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#f3d8d1", color = "#8a4b3c") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#8a4b3c") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak burden: truncated Gini AUC",
    subtitle = "Cumulative structural deviation until recovery or censoring",
    x = "Aggregation",
    y = "Truncated Gini AUC"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_auc_gini_trunc_raw.png"),
  plot = plot_auc_gini_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_auc_gini_summary <- ggplot(
  outbreak_auc_gini_summary,
  aes(x = aggregation, y = mean)
) +
  geom_point(size = 2.4, color = "#8a4b3c") +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    width = 0.18,
    color = "#8a4b3c"
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak burden: truncated Gini AUC",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Truncated Gini AUC"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_auc_gini_trunc_summary.png"),
  plot = plot_auc_gini_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 3: auc_conifer_trunc
# -----------------------------------------------------------------------------
message("Fitting outbreak AUC model set: auc_conifer_trunc")
outbreak_auc_conifer <- outbreak_auc[is.finite(auc_conifer_trunc)]

outbreak_auc_conifer_null <- lmer(
  auc_conifer_trunc ~ landscape + (1 | init_uid),
  data = outbreak_auc_conifer,
  REML = FALSE
)

outbreak_auc_conifer_additive <- lmer(
  auc_conifer_trunc ~ landscape + aggregation + (1 | init_uid),
  data = outbreak_auc_conifer,
  REML = FALSE
)

outbreak_auc_conifer_interaction <- lmer(
  auc_conifer_trunc ~ landscape * aggregation + (1 | init_uid),
  data = outbreak_auc_conifer,
  REML = FALSE
)

saveRDS(
  list(
    null = outbreak_auc_conifer_null,
    additive = outbreak_auc_conifer_additive,
    interaction = outbreak_auc_conifer_interaction,
    response = "auc_conifer_trunc",
    random_effect = "init_uid",
    analysis = "outbreak_auc"
  ),
  file.path(MODELS_OUT, "outbreak_auc_conifer_trunc.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "outbreak_auc",
    response = "auc_conifer_trunc",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(outbreak_auc_conifer),
    aic = c(
      AIC(outbreak_auc_conifer_null),
      AIC(outbreak_auc_conifer_additive),
      AIC(outbreak_auc_conifer_interaction)
    ),
    bic = c(
      BIC(outbreak_auc_conifer_null),
      BIC(outbreak_auc_conifer_additive),
      BIC(outbreak_auc_conifer_interaction)
    ),
    logLik = c(
      as.numeric(logLik(outbreak_auc_conifer_null)),
      as.numeric(logLik(outbreak_auc_conifer_additive)),
      as.numeric(logLik(outbreak_auc_conifer_interaction))
    ),
    npar = c(
      attr(logLik(outbreak_auc_conifer_null), "df"),
      attr(logLik(outbreak_auc_conifer_additive), "df"),
      attr(logLik(outbreak_auc_conifer_interaction), "df")
    )
  ),
  fill = TRUE
)

outbreak_auc_conifer_anova <- as.data.table(anova(
  outbreak_auc_conifer_null,
  outbreak_auc_conifer_additive,
  outbreak_auc_conifer_interaction
), keep.rownames = "model_step")
outbreak_auc_conifer_anova[, `:=`(
  analysis = "outbreak_auc",
  response = "auc_conifer_trunc"
)]
anova_comparison <- rbind(anova_comparison, outbreak_auc_conifer_anova, fill = TRUE)

outbreak_auc_conifer_summary <- outbreak_auc_conifer[, .(
  mean = mean(auc_conifer_trunc, na.rm = TRUE),
  sd = sd(auc_conifer_trunc, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
outbreak_auc_conifer_summary[, se := sd / sqrt(n)]
outbreak_auc_conifer_summary[, ci_low := mean - 1.96 * se]
outbreak_auc_conifer_summary[, ci_high := mean + 1.96 * se]
outbreak_auc_conifer_summary[, `:=`(
  analysis = "outbreak_auc",
  response = "auc_conifer_trunc"
)]
descriptive_summary <- rbind(descriptive_summary, outbreak_auc_conifer_summary, fill = TRUE)

for (landscape_name in unique(as.character(outbreak_auc_conifer$landscape))) {
  outbreak_auc_conifer_landscape <- outbreak_auc_conifer[landscape == landscape_name]
  outbreak_auc_conifer_aov <- aov(
    auc_conifer_trunc ~ aggregation,
    data = outbreak_auc_conifer_landscape
  )
  outbreak_auc_conifer_tukey <- as.data.table(
    TukeyHSD(outbreak_auc_conifer_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  outbreak_auc_conifer_tukey[, `:=`(
    analysis = "outbreak_auc",
    response = "auc_conifer_trunc",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, outbreak_auc_conifer_tukey, fill = TRUE)
}

plot_auc_conifer_raw <- ggplot(
  outbreak_auc_conifer,
  aes(x = aggregation, y = auc_conifer_trunc)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#d6ecd2", color = "#3f6d38") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#3f6d38") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak burden: truncated conifer AUC",
    subtitle = "Cumulative compositional deviation until recovery or censoring",
    x = "Aggregation",
    y = "Truncated conifer AUC"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_auc_conifer_trunc_raw.png"),
  plot = plot_auc_conifer_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_auc_conifer_summary <- ggplot(
  outbreak_auc_conifer_summary,
  aes(x = aggregation, y = mean)
) +
  geom_point(size = 2.4, color = "#3f6d38") +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    width = 0.18,
    color = "#3f6d38"
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak burden: truncated conifer AUC",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Truncated conifer AUC"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_auc_conifer_trunc_summary.png"),
  plot = plot_auc_conifer_summary,
  width = 12,
  height = 7,
  dpi = 300
)

model_comparison[, model := factor(model, levels = c("null", "additive", "interaction"))]
setorder(model_comparison, response, model)
model_comparison[, delta_aic_vs_null := aic - aic[model == "null"], by = response]
model_comparison[, delta_logLik_vs_null := logLik - logLik[model == "null"], by = response]

setorder(descriptive_summary, response, landscape, aggregation)
setorder(pairwise_tukey, response, landscape, contrast)

parameter_ci <- extract_selected_model_parameter_ci(
  model_comparison = model_comparison,
  models_dir = MODELS_OUT,
  analysis_name = "outbreak_auc"
)

fwrite(
  model_comparison,
  file.path(TABLES_OUT, "outbreak_auc_model_comparison.csv")
)

fwrite(
  anova_comparison,
  file.path(TABLES_OUT, "outbreak_auc_anova_comparison.csv")
)

fwrite(
  descriptive_summary,
  file.path(TABLES_OUT, "outbreak_auc_descriptive_summary.csv")
)

fwrite(
  pairwise_tukey,
  file.path(TABLES_OUT, "outbreak_auc_pairwise_tukey.csv")
)

fwrite(
  parameter_ci,
  file.path(TABLES_OUT, "outbreak_auc_selected_model_parameter_ci.csv")
)

message("Saved outbreak AUC model comparison table")
message("Saved outbreak AUC anova comparison table")
message("Saved outbreak AUC descriptive summary table")
message("Saved outbreak AUC pairwise Tukey table")
message("Saved outbreak AUC selected-model parameter CI table")
message("Saved outbreak AUC raw and summary plots")
message("=== Outbreak AUC analysis complete ===")
