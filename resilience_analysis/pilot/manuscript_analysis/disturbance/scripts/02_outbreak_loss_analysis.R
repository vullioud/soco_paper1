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
DATA_IN <- file.path(OUT_ROOT, "data", "outbreak_loss.csv")
MODELS_OUT <- file.path(OUT_ROOT, "models")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(MODELS_OUT, "outbreak_loss_*.rds"))
unlink(file.path(TABLES_OUT, "outbreak_loss_*.csv"))
unlink(file.path(FIGURES_OUT, "outbreak_loss_*.png"))

message("=== Outbreak loss analysis ===")
message("This script asks whether aggregation changes the disturbance hit.")
message("Responses: peak_rel_vol, peak_gini, peak_conifer")
message("Repeated grouping term: init_uid = landscape + replicate")
message("Nested models per response:")
message("  1. null       = landscape + (1 | init_uid)")
message("  2. additive   = landscape + aggregation + (1 | init_uid)")
message("  3. interaction= landscape * aggregation + (1 | init_uid)")

outbreak_loss <- fread(DATA_IN)
outbreak_loss[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
outbreak_loss[, aggregation := stats::relevel(factor(aggregation), ref = "matched_High")]
outbreak_loss[, init_uid := factor(init_uid)]

model_comparison <- data.table()
anova_comparison <- data.table()
descriptive_summary <- data.table()
pairwise_tukey <- data.table()

# -----------------------------------------------------------------------------
# Response 1: peak_rel_vol
# -----------------------------------------------------------------------------
message("Fitting outbreak loss model set: peak_rel_vol")
outbreak_peak_rel_vol <- outbreak_loss[is.finite(peak_rel_vol)]

outbreak_peak_rel_vol_null <- lmer(
  peak_rel_vol ~ landscape + (1 | init_uid),
  data = outbreak_peak_rel_vol,
  REML = FALSE
)

outbreak_peak_rel_vol_additive <- lmer(
  peak_rel_vol ~ landscape + aggregation + (1 | init_uid),
  data = outbreak_peak_rel_vol,
  REML = FALSE
)

outbreak_peak_rel_vol_interaction <- lmer(
  peak_rel_vol ~ landscape * aggregation + (1 | init_uid),
  data = outbreak_peak_rel_vol,
  REML = FALSE
)

saveRDS(
  list(
    null = outbreak_peak_rel_vol_null,
    additive = outbreak_peak_rel_vol_additive,
    interaction = outbreak_peak_rel_vol_interaction,
    response = "peak_rel_vol",
    random_effect = "init_uid",
    analysis = "outbreak_loss"
  ),
  file.path(MODELS_OUT, "outbreak_loss_peak_rel_vol.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "outbreak_loss",
    response = "peak_rel_vol",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(outbreak_peak_rel_vol),
    aic = c(
      AIC(outbreak_peak_rel_vol_null),
      AIC(outbreak_peak_rel_vol_additive),
      AIC(outbreak_peak_rel_vol_interaction)
    ),
    bic = c(
      BIC(outbreak_peak_rel_vol_null),
      BIC(outbreak_peak_rel_vol_additive),
      BIC(outbreak_peak_rel_vol_interaction)
    ),
    logLik = c(
      as.numeric(logLik(outbreak_peak_rel_vol_null)),
      as.numeric(logLik(outbreak_peak_rel_vol_additive)),
      as.numeric(logLik(outbreak_peak_rel_vol_interaction))
    ),
    npar = c(
      attr(logLik(outbreak_peak_rel_vol_null), "df"),
      attr(logLik(outbreak_peak_rel_vol_additive), "df"),
      attr(logLik(outbreak_peak_rel_vol_interaction), "df")
    )
  ),
  fill = TRUE
)

outbreak_peak_rel_vol_anova <- as.data.table(anova(
  outbreak_peak_rel_vol_null,
  outbreak_peak_rel_vol_additive,
  outbreak_peak_rel_vol_interaction
), keep.rownames = "model_step")
outbreak_peak_rel_vol_anova[, `:=`(
  analysis = "outbreak_loss",
  response = "peak_rel_vol"
)]
anova_comparison <- rbind(anova_comparison, outbreak_peak_rel_vol_anova, fill = TRUE)

outbreak_peak_rel_vol_summary <- outbreak_peak_rel_vol[, .(
  mean = mean(peak_rel_vol, na.rm = TRUE),
  sd = sd(peak_rel_vol, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
outbreak_peak_rel_vol_summary[, se := sd / sqrt(n)]
outbreak_peak_rel_vol_summary[, ci_low := mean - 1.96 * se]
outbreak_peak_rel_vol_summary[, ci_high := mean + 1.96 * se]
outbreak_peak_rel_vol_summary[, `:=`(
  analysis = "outbreak_loss",
  response = "peak_rel_vol"
)]
descriptive_summary <- rbind(descriptive_summary, outbreak_peak_rel_vol_summary, fill = TRUE)

for (landscape_name in unique(as.character(outbreak_peak_rel_vol$landscape))) {
  outbreak_peak_rel_vol_landscape <- outbreak_peak_rel_vol[landscape == landscape_name]
  outbreak_peak_rel_vol_aov <- aov(
    peak_rel_vol ~ aggregation,
    data = outbreak_peak_rel_vol_landscape
  )
  outbreak_peak_rel_vol_tukey <- as.data.table(
    TukeyHSD(outbreak_peak_rel_vol_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  outbreak_peak_rel_vol_tukey[, `:=`(
    analysis = "outbreak_loss",
    response = "peak_rel_vol",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, outbreak_peak_rel_vol_tukey, fill = TRUE)
}

plot_peak_rel_vol_raw <- ggplot(
  outbreak_peak_rel_vol,
  aes(x = aggregation, y = peak_rel_vol)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#d7e3f4", color = "#2f5d8a") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#2f5d8a") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak hit: peak relative volume loss",
    subtitle = "More negative values indicate a stronger disturbance hit",
    x = "Aggregation",
    y = "Peak relative volume loss"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_loss_peak_rel_vol_raw.png"),
  plot = plot_peak_rel_vol_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_peak_rel_vol_summary <- ggplot(
  outbreak_peak_rel_vol_summary,
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
    title = "Outbreak hit: peak relative volume loss",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Peak relative volume loss"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_loss_peak_rel_vol_summary.png"),
  plot = plot_peak_rel_vol_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 2: peak_gini
# -----------------------------------------------------------------------------
message("Fitting outbreak loss model set: peak_gini")
outbreak_peak_gini <- outbreak_loss[is.finite(peak_gini)]

outbreak_peak_gini_null <- lmer(
  peak_gini ~ landscape + (1 | init_uid),
  data = outbreak_peak_gini,
  REML = FALSE
)

outbreak_peak_gini_additive <- lmer(
  peak_gini ~ landscape + aggregation + (1 | init_uid),
  data = outbreak_peak_gini,
  REML = FALSE
)

outbreak_peak_gini_interaction <- lmer(
  peak_gini ~ landscape * aggregation + (1 | init_uid),
  data = outbreak_peak_gini,
  REML = FALSE
)

saveRDS(
  list(
    null = outbreak_peak_gini_null,
    additive = outbreak_peak_gini_additive,
    interaction = outbreak_peak_gini_interaction,
    response = "peak_gini",
    random_effect = "init_uid",
    analysis = "outbreak_loss"
  ),
  file.path(MODELS_OUT, "outbreak_loss_peak_gini.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "outbreak_loss",
    response = "peak_gini",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(outbreak_peak_gini),
    aic = c(
      AIC(outbreak_peak_gini_null),
      AIC(outbreak_peak_gini_additive),
      AIC(outbreak_peak_gini_interaction)
    ),
    bic = c(
      BIC(outbreak_peak_gini_null),
      BIC(outbreak_peak_gini_additive),
      BIC(outbreak_peak_gini_interaction)
    ),
    logLik = c(
      as.numeric(logLik(outbreak_peak_gini_null)),
      as.numeric(logLik(outbreak_peak_gini_additive)),
      as.numeric(logLik(outbreak_peak_gini_interaction))
    ),
    npar = c(
      attr(logLik(outbreak_peak_gini_null), "df"),
      attr(logLik(outbreak_peak_gini_additive), "df"),
      attr(logLik(outbreak_peak_gini_interaction), "df")
    )
  ),
  fill = TRUE
)

outbreak_peak_gini_anova <- as.data.table(anova(
  outbreak_peak_gini_null,
  outbreak_peak_gini_additive,
  outbreak_peak_gini_interaction
), keep.rownames = "model_step")
outbreak_peak_gini_anova[, `:=`(
  analysis = "outbreak_loss",
  response = "peak_gini"
)]
anova_comparison <- rbind(anova_comparison, outbreak_peak_gini_anova, fill = TRUE)

outbreak_peak_gini_summary <- outbreak_peak_gini[, .(
  mean = mean(peak_gini, na.rm = TRUE),
  sd = sd(peak_gini, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
outbreak_peak_gini_summary[, se := sd / sqrt(n)]
outbreak_peak_gini_summary[, ci_low := mean - 1.96 * se]
outbreak_peak_gini_summary[, ci_high := mean + 1.96 * se]
outbreak_peak_gini_summary[, `:=`(
  analysis = "outbreak_loss",
  response = "peak_gini"
)]
descriptive_summary <- rbind(descriptive_summary, outbreak_peak_gini_summary, fill = TRUE)

for (landscape_name in unique(as.character(outbreak_peak_gini$landscape))) {
  outbreak_peak_gini_landscape <- outbreak_peak_gini[landscape == landscape_name]
  outbreak_peak_gini_aov <- aov(
    peak_gini ~ aggregation,
    data = outbreak_peak_gini_landscape
  )
  outbreak_peak_gini_tukey <- as.data.table(
    TukeyHSD(outbreak_peak_gini_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  outbreak_peak_gini_tukey[, `:=`(
    analysis = "outbreak_loss",
    response = "peak_gini",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, outbreak_peak_gini_tukey, fill = TRUE)
}

plot_peak_gini_raw <- ggplot(
  outbreak_peak_gini,
  aes(x = aggregation, y = peak_gini)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#f3d8d1", color = "#8a4b3c") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#8a4b3c") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak hit: peak Gini deviation",
    subtitle = "Larger absolute values indicate stronger structural deviation",
    x = "Aggregation",
    y = "Peak Gini deviation"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_loss_peak_gini_raw.png"),
  plot = plot_peak_gini_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_peak_gini_summary <- ggplot(
  outbreak_peak_gini_summary,
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
    title = "Outbreak hit: peak Gini deviation",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Peak Gini deviation"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_loss_peak_gini_summary.png"),
  plot = plot_peak_gini_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 3: peak_conifer
# -----------------------------------------------------------------------------
message("Fitting outbreak loss model set: peak_conifer")
outbreak_peak_conifer <- outbreak_loss[is.finite(peak_conifer)]

outbreak_peak_conifer_null <- lmer(
  peak_conifer ~ landscape + (1 | init_uid),
  data = outbreak_peak_conifer,
  REML = FALSE
)

outbreak_peak_conifer_additive <- lmer(
  peak_conifer ~ landscape + aggregation + (1 | init_uid),
  data = outbreak_peak_conifer,
  REML = FALSE
)

outbreak_peak_conifer_interaction <- lmer(
  peak_conifer ~ landscape * aggregation + (1 | init_uid),
  data = outbreak_peak_conifer,
  REML = FALSE
)

saveRDS(
  list(
    null = outbreak_peak_conifer_null,
    additive = outbreak_peak_conifer_additive,
    interaction = outbreak_peak_conifer_interaction,
    response = "peak_conifer",
    random_effect = "init_uid",
    analysis = "outbreak_loss"
  ),
  file.path(MODELS_OUT, "outbreak_loss_peak_conifer.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "outbreak_loss",
    response = "peak_conifer",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(outbreak_peak_conifer),
    aic = c(
      AIC(outbreak_peak_conifer_null),
      AIC(outbreak_peak_conifer_additive),
      AIC(outbreak_peak_conifer_interaction)
    ),
    bic = c(
      BIC(outbreak_peak_conifer_null),
      BIC(outbreak_peak_conifer_additive),
      BIC(outbreak_peak_conifer_interaction)
    ),
    logLik = c(
      as.numeric(logLik(outbreak_peak_conifer_null)),
      as.numeric(logLik(outbreak_peak_conifer_additive)),
      as.numeric(logLik(outbreak_peak_conifer_interaction))
    ),
    npar = c(
      attr(logLik(outbreak_peak_conifer_null), "df"),
      attr(logLik(outbreak_peak_conifer_additive), "df"),
      attr(logLik(outbreak_peak_conifer_interaction), "df")
    )
  ),
  fill = TRUE
)

outbreak_peak_conifer_anova <- as.data.table(anova(
  outbreak_peak_conifer_null,
  outbreak_peak_conifer_additive,
  outbreak_peak_conifer_interaction
), keep.rownames = "model_step")
outbreak_peak_conifer_anova[, `:=`(
  analysis = "outbreak_loss",
  response = "peak_conifer"
)]
anova_comparison <- rbind(anova_comparison, outbreak_peak_conifer_anova, fill = TRUE)

outbreak_peak_conifer_summary <- outbreak_peak_conifer[, .(
  mean = mean(peak_conifer, na.rm = TRUE),
  sd = sd(peak_conifer, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
outbreak_peak_conifer_summary[, se := sd / sqrt(n)]
outbreak_peak_conifer_summary[, ci_low := mean - 1.96 * se]
outbreak_peak_conifer_summary[, ci_high := mean + 1.96 * se]
outbreak_peak_conifer_summary[, `:=`(
  analysis = "outbreak_loss",
  response = "peak_conifer"
)]
descriptive_summary <- rbind(descriptive_summary, outbreak_peak_conifer_summary, fill = TRUE)

for (landscape_name in unique(as.character(outbreak_peak_conifer$landscape))) {
  outbreak_peak_conifer_landscape <- outbreak_peak_conifer[landscape == landscape_name]
  outbreak_peak_conifer_aov <- aov(
    peak_conifer ~ aggregation,
    data = outbreak_peak_conifer_landscape
  )
  outbreak_peak_conifer_tukey <- as.data.table(
    TukeyHSD(outbreak_peak_conifer_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  outbreak_peak_conifer_tukey[, `:=`(
    analysis = "outbreak_loss",
    response = "peak_conifer",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, outbreak_peak_conifer_tukey, fill = TRUE)
}

plot_peak_conifer_raw <- ggplot(
  outbreak_peak_conifer,
  aes(x = aggregation, y = peak_conifer)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#d6ecd2", color = "#3f6d38") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#3f6d38") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Outbreak hit: peak conifer deviation",
    subtitle = "More negative values indicate a stronger conifer loss",
    x = "Aggregation",
    y = "Peak conifer deviation"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_loss_peak_conifer_raw.png"),
  plot = plot_peak_conifer_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_peak_conifer_summary <- ggplot(
  outbreak_peak_conifer_summary,
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
    title = "Outbreak hit: peak conifer deviation",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Peak conifer deviation"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "outbreak_loss_peak_conifer_summary.png"),
  plot = plot_peak_conifer_summary,
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
  analysis_name = "outbreak_loss"
)

fwrite(
  model_comparison,
  file.path(TABLES_OUT, "outbreak_loss_model_comparison.csv")
)

fwrite(
  anova_comparison,
  file.path(TABLES_OUT, "outbreak_loss_anova_comparison.csv")
)

fwrite(
  descriptive_summary,
  file.path(TABLES_OUT, "outbreak_loss_descriptive_summary.csv")
)

fwrite(
  pairwise_tukey,
  file.path(TABLES_OUT, "outbreak_loss_pairwise_tukey.csv")
)

fwrite(
  parameter_ci,
  file.path(TABLES_OUT, "outbreak_loss_selected_model_parameter_ci.csv")
)

message("Saved outbreak loss model comparison table")
message("Saved outbreak loss anova comparison table")
message("Saved outbreak loss descriptive summary table")
message("Saved outbreak loss pairwise Tukey table")
message("Saved outbreak loss selected-model parameter CI table")
message("Saved outbreak loss raw and summary plots")
message("=== Outbreak loss analysis complete ===")
