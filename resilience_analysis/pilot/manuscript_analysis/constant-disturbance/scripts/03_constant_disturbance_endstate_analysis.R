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

OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "constant-disturbance")
DATA_IN <- file.path(OUT_ROOT, "data", "constant_disturbance_endstate.csv")
MODELS_OUT <- file.path(OUT_ROOT, "models")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

unlink(file.path(MODELS_OUT, "constant_disturbance_endstate_*.rds"))
unlink(file.path(TABLES_OUT, "constant_disturbance_endstate_*.csv"))
unlink(file.path(FIGURES_OUT, "constant_disturbance_endstate_*.png"))

message("=== Constant disturbance end-state analysis ===")
message("This script asks whether aggregation changes year-250 chronic divergence.")
message("Responses: delta_vol_250, delta_gini_250, delta_conifer_250")
message("Repeated grouping term: init_uid = landscape + replicate")
message("Nested models per response:")
message("  1. null       = landscape + (1 | init_uid)")
message("  2. additive   = landscape + aggregation + (1 | init_uid)")
message("  3. interaction= landscape * aggregation + (1 | init_uid)")

constant_endstate <- fread(DATA_IN)
constant_endstate[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
constant_endstate[, aggregation := stats::relevel(factor(aggregation), ref = "matched_High")]
constant_endstate[, init_uid := factor(init_uid)]

model_comparison <- data.table()
anova_comparison <- data.table()
descriptive_summary <- data.table()
pairwise_tukey <- data.table()

# -----------------------------------------------------------------------------
# Response 1: delta_vol_250
# -----------------------------------------------------------------------------
message("Fitting constant disturbance end-state model set: delta_vol_250")
constant_endstate_vol <- constant_endstate[is.finite(delta_vol_250)]

constant_endstate_vol_null <- lmer(
  delta_vol_250 ~ landscape + (1 | init_uid),
  data = constant_endstate_vol,
  REML = FALSE
)

constant_endstate_vol_additive <- lmer(
  delta_vol_250 ~ landscape + aggregation + (1 | init_uid),
  data = constant_endstate_vol,
  REML = FALSE
)

constant_endstate_vol_interaction <- lmer(
  delta_vol_250 ~ landscape * aggregation + (1 | init_uid),
  data = constant_endstate_vol,
  REML = FALSE
)

saveRDS(
  list(
    null = constant_endstate_vol_null,
    additive = constant_endstate_vol_additive,
    interaction = constant_endstate_vol_interaction,
    response = "delta_vol_250",
    random_effect = "init_uid",
    analysis = "constant_disturbance_endstate"
  ),
  file.path(MODELS_OUT, "constant_disturbance_endstate_delta_vol_250.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "constant_disturbance_endstate",
    response = "delta_vol_250",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(constant_endstate_vol),
    aic = c(
      AIC(constant_endstate_vol_null),
      AIC(constant_endstate_vol_additive),
      AIC(constant_endstate_vol_interaction)
    ),
    bic = c(
      BIC(constant_endstate_vol_null),
      BIC(constant_endstate_vol_additive),
      BIC(constant_endstate_vol_interaction)
    ),
    logLik = c(
      as.numeric(logLik(constant_endstate_vol_null)),
      as.numeric(logLik(constant_endstate_vol_additive)),
      as.numeric(logLik(constant_endstate_vol_interaction))
    ),
    npar = c(
      attr(logLik(constant_endstate_vol_null), "df"),
      attr(logLik(constant_endstate_vol_additive), "df"),
      attr(logLik(constant_endstate_vol_interaction), "df")
    )
  ),
  fill = TRUE
)

constant_endstate_vol_anova <- as.data.table(anova(
  constant_endstate_vol_null,
  constant_endstate_vol_additive,
  constant_endstate_vol_interaction
), keep.rownames = "model_step")
constant_endstate_vol_anova[, `:=`(
  analysis = "constant_disturbance_endstate",
  response = "delta_vol_250"
)]
anova_comparison <- rbind(anova_comparison, constant_endstate_vol_anova, fill = TRUE)

constant_endstate_vol_summary <- constant_endstate_vol[, .(
  mean = mean(delta_vol_250, na.rm = TRUE),
  sd = sd(delta_vol_250, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
constant_endstate_vol_summary[, se := sd / sqrt(n)]
constant_endstate_vol_summary[, ci_low := mean - 1.96 * se]
constant_endstate_vol_summary[, ci_high := mean + 1.96 * se]
constant_endstate_vol_summary[, `:=`(
  analysis = "constant_disturbance_endstate",
  response = "delta_vol_250"
)]
descriptive_summary <- rbind(descriptive_summary, constant_endstate_vol_summary, fill = TRUE)

for (landscape_name in unique(as.character(constant_endstate_vol$landscape))) {
  constant_endstate_vol_landscape <- constant_endstate_vol[landscape == landscape_name]
  constant_endstate_vol_aov <- aov(
    delta_vol_250 ~ aggregation,
    data = constant_endstate_vol_landscape
  )
  constant_endstate_vol_tukey <- as.data.table(
    TukeyHSD(constant_endstate_vol_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  constant_endstate_vol_tukey[, `:=`(
    analysis = "constant_disturbance_endstate",
    response = "delta_vol_250",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, constant_endstate_vol_tukey, fill = TRUE)
}

plot_delta_vol_raw <- ggplot(
  constant_endstate_vol,
  aes(x = aggregation, y = delta_vol_250)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#d7e3f4", color = "#2f5d8a") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#2f5d8a") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Constant disturbance end-state: year-250 volume delta",
    subtitle = "Treatment minus paired control at year 250",
    x = "Aggregation",
    y = "Volume delta at year 250"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "constant_disturbance_endstate_delta_vol_250_raw.png"),
  plot = plot_delta_vol_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_delta_vol_summary <- ggplot(
  constant_endstate_vol_summary,
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
    title = "Constant disturbance end-state: year-250 volume delta",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Volume delta at year 250"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "constant_disturbance_endstate_delta_vol_250_summary.png"),
  plot = plot_delta_vol_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 2: delta_gini_250
# -----------------------------------------------------------------------------
message("Fitting constant disturbance end-state model set: delta_gini_250")
constant_endstate_gini <- constant_endstate[is.finite(delta_gini_250)]

constant_endstate_gini_null <- lmer(
  delta_gini_250 ~ landscape + (1 | init_uid),
  data = constant_endstate_gini,
  REML = FALSE
)

constant_endstate_gini_additive <- lmer(
  delta_gini_250 ~ landscape + aggregation + (1 | init_uid),
  data = constant_endstate_gini,
  REML = FALSE
)

constant_endstate_gini_interaction <- lmer(
  delta_gini_250 ~ landscape * aggregation + (1 | init_uid),
  data = constant_endstate_gini,
  REML = FALSE
)

saveRDS(
  list(
    null = constant_endstate_gini_null,
    additive = constant_endstate_gini_additive,
    interaction = constant_endstate_gini_interaction,
    response = "delta_gini_250",
    random_effect = "init_uid",
    analysis = "constant_disturbance_endstate"
  ),
  file.path(MODELS_OUT, "constant_disturbance_endstate_delta_gini_250.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "constant_disturbance_endstate",
    response = "delta_gini_250",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(constant_endstate_gini),
    aic = c(
      AIC(constant_endstate_gini_null),
      AIC(constant_endstate_gini_additive),
      AIC(constant_endstate_gini_interaction)
    ),
    bic = c(
      BIC(constant_endstate_gini_null),
      BIC(constant_endstate_gini_additive),
      BIC(constant_endstate_gini_interaction)
    ),
    logLik = c(
      as.numeric(logLik(constant_endstate_gini_null)),
      as.numeric(logLik(constant_endstate_gini_additive)),
      as.numeric(logLik(constant_endstate_gini_interaction))
    ),
    npar = c(
      attr(logLik(constant_endstate_gini_null), "df"),
      attr(logLik(constant_endstate_gini_additive), "df"),
      attr(logLik(constant_endstate_gini_interaction), "df")
    )
  ),
  fill = TRUE
)

constant_endstate_gini_anova <- as.data.table(anova(
  constant_endstate_gini_null,
  constant_endstate_gini_additive,
  constant_endstate_gini_interaction
), keep.rownames = "model_step")
constant_endstate_gini_anova[, `:=`(
  analysis = "constant_disturbance_endstate",
  response = "delta_gini_250"
)]
anova_comparison <- rbind(anova_comparison, constant_endstate_gini_anova, fill = TRUE)

constant_endstate_gini_summary <- constant_endstate_gini[, .(
  mean = mean(delta_gini_250, na.rm = TRUE),
  sd = sd(delta_gini_250, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
constant_endstate_gini_summary[, se := sd / sqrt(n)]
constant_endstate_gini_summary[, ci_low := mean - 1.96 * se]
constant_endstate_gini_summary[, ci_high := mean + 1.96 * se]
constant_endstate_gini_summary[, `:=`(
  analysis = "constant_disturbance_endstate",
  response = "delta_gini_250"
)]
descriptive_summary <- rbind(descriptive_summary, constant_endstate_gini_summary, fill = TRUE)

for (landscape_name in unique(as.character(constant_endstate_gini$landscape))) {
  constant_endstate_gini_landscape <- constant_endstate_gini[landscape == landscape_name]
  constant_endstate_gini_aov <- aov(
    delta_gini_250 ~ aggregation,
    data = constant_endstate_gini_landscape
  )
  constant_endstate_gini_tukey <- as.data.table(
    TukeyHSD(constant_endstate_gini_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  constant_endstate_gini_tukey[, `:=`(
    analysis = "constant_disturbance_endstate",
    response = "delta_gini_250",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, constant_endstate_gini_tukey, fill = TRUE)
}

plot_delta_gini_raw <- ggplot(
  constant_endstate_gini,
  aes(x = aggregation, y = delta_gini_250)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#f3d8d1", color = "#8a4b3c") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#8a4b3c") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Constant disturbance end-state: year-250 Gini delta",
    subtitle = "Treatment minus paired control at year 250",
    x = "Aggregation",
    y = "Gini delta at year 250"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "constant_disturbance_endstate_delta_gini_250_raw.png"),
  plot = plot_delta_gini_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_delta_gini_summary <- ggplot(
  constant_endstate_gini_summary,
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
    title = "Constant disturbance end-state: year-250 Gini delta",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Gini delta at year 250"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "constant_disturbance_endstate_delta_gini_250_summary.png"),
  plot = plot_delta_gini_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 3: delta_conifer_250
# -----------------------------------------------------------------------------
message("Fitting constant disturbance end-state model set: delta_conifer_250")
constant_endstate_conifer <- constant_endstate[is.finite(delta_conifer_250)]

constant_endstate_conifer_null <- lmer(
  delta_conifer_250 ~ landscape + (1 | init_uid),
  data = constant_endstate_conifer,
  REML = FALSE
)

constant_endstate_conifer_additive <- lmer(
  delta_conifer_250 ~ landscape + aggregation + (1 | init_uid),
  data = constant_endstate_conifer,
  REML = FALSE
)

constant_endstate_conifer_interaction <- lmer(
  delta_conifer_250 ~ landscape * aggregation + (1 | init_uid),
  data = constant_endstate_conifer,
  REML = FALSE
)

saveRDS(
  list(
    null = constant_endstate_conifer_null,
    additive = constant_endstate_conifer_additive,
    interaction = constant_endstate_conifer_interaction,
    response = "delta_conifer_250",
    random_effect = "init_uid",
    analysis = "constant_disturbance_endstate"
  ),
  file.path(MODELS_OUT, "constant_disturbance_endstate_delta_conifer_250.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    analysis = "constant_disturbance_endstate",
    response = "delta_conifer_250",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(constant_endstate_conifer),
    aic = c(
      AIC(constant_endstate_conifer_null),
      AIC(constant_endstate_conifer_additive),
      AIC(constant_endstate_conifer_interaction)
    ),
    bic = c(
      BIC(constant_endstate_conifer_null),
      BIC(constant_endstate_conifer_additive),
      BIC(constant_endstate_conifer_interaction)
    ),
    logLik = c(
      as.numeric(logLik(constant_endstate_conifer_null)),
      as.numeric(logLik(constant_endstate_conifer_additive)),
      as.numeric(logLik(constant_endstate_conifer_interaction))
    ),
    npar = c(
      attr(logLik(constant_endstate_conifer_null), "df"),
      attr(logLik(constant_endstate_conifer_additive), "df"),
      attr(logLik(constant_endstate_conifer_interaction), "df")
    )
  ),
  fill = TRUE
)

constant_endstate_conifer_anova <- as.data.table(anova(
  constant_endstate_conifer_null,
  constant_endstate_conifer_additive,
  constant_endstate_conifer_interaction
), keep.rownames = "model_step")
constant_endstate_conifer_anova[, `:=`(
  analysis = "constant_disturbance_endstate",
  response = "delta_conifer_250"
)]
anova_comparison <- rbind(anova_comparison, constant_endstate_conifer_anova, fill = TRUE)

constant_endstate_conifer_summary <- constant_endstate_conifer[, .(
  mean = mean(delta_conifer_250, na.rm = TRUE),
  sd = sd(delta_conifer_250, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation)]
constant_endstate_conifer_summary[, se := sd / sqrt(n)]
constant_endstate_conifer_summary[, ci_low := mean - 1.96 * se]
constant_endstate_conifer_summary[, ci_high := mean + 1.96 * se]
constant_endstate_conifer_summary[, `:=`(
  analysis = "constant_disturbance_endstate",
  response = "delta_conifer_250"
)]
descriptive_summary <- rbind(descriptive_summary, constant_endstate_conifer_summary, fill = TRUE)

for (landscape_name in unique(as.character(constant_endstate_conifer$landscape))) {
  constant_endstate_conifer_landscape <- constant_endstate_conifer[landscape == landscape_name]
  constant_endstate_conifer_aov <- aov(
    delta_conifer_250 ~ aggregation,
    data = constant_endstate_conifer_landscape
  )
  constant_endstate_conifer_tukey <- as.data.table(
    TukeyHSD(constant_endstate_conifer_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  constant_endstate_conifer_tukey[, `:=`(
    analysis = "constant_disturbance_endstate",
    response = "delta_conifer_250",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, constant_endstate_conifer_tukey, fill = TRUE)
}

plot_delta_conifer_raw <- ggplot(
  constant_endstate_conifer,
  aes(x = aggregation, y = delta_conifer_250)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.3, fill = "#d6ecd2", color = "#3f6d38") +
  geom_jitter(width = 0.15, alpha = 0.6, size = 1.6, color = "#3f6d38") +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Constant disturbance end-state: year-250 conifer delta",
    subtitle = "Treatment minus paired control at year 250",
    x = "Aggregation",
    y = "Conifer delta at year 250"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "constant_disturbance_endstate_delta_conifer_250_raw.png"),
  plot = plot_delta_conifer_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_delta_conifer_summary <- ggplot(
  constant_endstate_conifer_summary,
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
    title = "Constant disturbance end-state: year-250 conifer delta",
    subtitle = "Mean and 95% interval by landscape",
    x = "Aggregation",
    y = "Conifer delta at year 250"
  ) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))

ggsave(
  filename = file.path(FIGURES_OUT, "constant_disturbance_endstate_delta_conifer_250_summary.png"),
  plot = plot_delta_conifer_summary,
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
  analysis_name = "constant_disturbance_endstate"
)

fwrite(
  model_comparison,
  file.path(TABLES_OUT, "constant_disturbance_endstate_model_comparison.csv")
)

fwrite(
  anova_comparison,
  file.path(TABLES_OUT, "constant_disturbance_endstate_anova_comparison.csv")
)

fwrite(
  descriptive_summary,
  file.path(TABLES_OUT, "constant_disturbance_endstate_descriptive_summary.csv")
)

fwrite(
  pairwise_tukey,
  file.path(TABLES_OUT, "constant_disturbance_endstate_pairwise_tukey.csv")
)

fwrite(
  parameter_ci,
  file.path(TABLES_OUT, "constant_disturbance_endstate_selected_model_parameter_ci.csv")
)

message("Saved constant disturbance end-state model comparison table")
message("Saved constant disturbance end-state anova comparison table")
message("Saved constant disturbance end-state descriptive summary table")
message("Saved constant disturbance end-state pairwise Tukey table")
message("Saved constant disturbance end-state selected-model parameter CI table")
message("Saved constant disturbance end-state raw and summary plots")
message("=== Constant disturbance end-state analysis complete ===")
