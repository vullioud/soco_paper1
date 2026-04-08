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

DATA_IN <- file.path("resilience_analysis", "pilot", "data")
OUT_ROOT <- file.path("resilience_analysis", "pilot", "manuscript_analysis", "pre-disturbance")
DATA_OUT <- file.path(OUT_ROOT, "data")
MODELS_OUT <- file.path(OUT_ROOT, "models")
TABLES_OUT <- file.path(OUT_ROOT, "tables")
FIGURES_OUT <- file.path(OUT_ROOT, "figures")

dir.create(DATA_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(MODELS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(TABLES_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(FIGURES_OUT, recursive = TRUE, showWarnings = FALSE)

# Clean previously generated pre-disturbance outputs so each run reflects the
# current script state only.
unlink(file.path(DATA_OUT, "*.csv"))
unlink(file.path(MODELS_OUT, "*.rds"))
unlink(file.path(TABLES_OUT, "*.csv"))
unlink(file.path(FIGURES_OUT, "*.png"))

message("=== Pre-disturbance analysis ===")
message("This script analyses two pre-disturbance questions:")
message("  1. What landscape state do management types produce by year 140?")
message("  2. How much do they change the landscape from year 10 to year 140?")
message("Responses included: volume, DBH Gini, conifer share")
message("Bray-Curtis is excluded here because the focus is management state and management-driven change.")
message("Repeated grouping term: init_uid = landscape + replicate")
message("Nested models per response:")
message("  1. null       = condition + landscape + (1 | init_uid)")
message("  2. additive   = condition + landscape + aggregation + (1 | init_uid)")
message("  3. interaction= condition + landscape * aggregation + (1 | init_uid)")
message("Exploratory management-vs-management contrasts are added via Tukey HSD within each landscape.")

# -----------------------------------------------------------------------------
# Build the year-140 pre-disturbance state dataset
# Only control and outbreak are used because chronic is disturbed from year 1.
# -----------------------------------------------------------------------------
landscape_metrics <- fread(file.path(DATA_IN, "landscape_metrics.csv"))

pre_disturbance_140 <- landscape_metrics[
  year == 140 & condition %in% c("control", "outbreak"),
  .(
    run_id,
    landscape,
    aggregation,
    condition,
    replicate,
    volume_140 = total_volume,
    gini_140 = mean_dbh_gini,
    conifer_140 = conifer_ba_pct
  )
]

pre_disturbance_140[, init_uid := paste(landscape, replicate, sep = "_")]
pre_disturbance_140[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
pre_disturbance_140[, aggregation := stats::relevel(factor(aggregation), ref = "matched_High")]
pre_disturbance_140[, condition := stats::relevel(factor(condition), ref = "control")]
pre_disturbance_140[, init_uid := factor(init_uid)]

fwrite(
  pre_disturbance_140,
  file.path(DATA_OUT, "pre_disturbance_snapshot_140.csv")
)

# -----------------------------------------------------------------------------
# Build the pre-disturbance change dataset: year 10 -> year 140
# -----------------------------------------------------------------------------
pre_disturbance_change <- landscape_metrics[
  year %in% c(10, 140) & condition %in% c("control", "outbreak"),
  .(
    run_id,
    landscape,
    aggregation,
    condition,
    replicate,
    year,
    total_volume,
    mean_dbh_gini,
    conifer_ba_pct
  )
]

pre_disturbance_change_wide <- dcast(
  pre_disturbance_change,
  run_id + landscape + aggregation + condition + replicate ~ year,
  value.var = c("total_volume", "mean_dbh_gini", "conifer_ba_pct")
)

pre_disturbance_change_wide[, delta_volume_10_140 := total_volume_140 - total_volume_10]
pre_disturbance_change_wide[, delta_gini_10_140 := mean_dbh_gini_140 - mean_dbh_gini_10]
pre_disturbance_change_wide[, delta_conifer_10_140 := conifer_ba_pct_140 - conifer_ba_pct_10]
pre_disturbance_change_wide[, init_uid := paste(landscape, replicate, sep = "_")]
pre_disturbance_change_wide[, landscape := stats::relevel(factor(landscape), ref = "CL02")]
pre_disturbance_change_wide[, aggregation := stats::relevel(factor(aggregation), ref = "matched_High")]
pre_disturbance_change_wide[, condition := stats::relevel(factor(condition), ref = "control")]
pre_disturbance_change_wide[, init_uid := factor(init_uid)]

fwrite(
  pre_disturbance_change_wide,
  file.path(DATA_OUT, "pre_disturbance_change_10_140.csv")
)

model_comparison <- data.table()
anova_comparison <- data.table()
descriptive_summary <- data.table()
pairwise_tukey <- data.table()

# -----------------------------------------------------------------------------
# Response 1: volume_140
# -----------------------------------------------------------------------------
message("Fitting pre-disturbance model set: volume_140")
pre_disturbance_volume_140 <- pre_disturbance_140[is.finite(volume_140)]

pre_disturbance_volume_140_null <- lmer(
  volume_140 ~ condition + landscape + (1 | init_uid),
  data = pre_disturbance_volume_140,
  REML = FALSE
)

pre_disturbance_volume_140_additive <- lmer(
  volume_140 ~ condition + landscape + aggregation + (1 | init_uid),
  data = pre_disturbance_volume_140,
  REML = FALSE
)

pre_disturbance_volume_140_interaction <- lmer(
  volume_140 ~ condition + landscape * aggregation + (1 | init_uid),
  data = pre_disturbance_volume_140,
  REML = FALSE
)

saveRDS(
  list(
    null = pre_disturbance_volume_140_null,
    additive = pre_disturbance_volume_140_additive,
    interaction = pre_disturbance_volume_140_interaction,
    response = "volume_140",
    random_effect = "init_uid"
  ),
  file.path(MODELS_OUT, "pre_disturbance_volume_140.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    response = "volume_140",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(pre_disturbance_volume_140),
    aic = c(
      AIC(pre_disturbance_volume_140_null),
      AIC(pre_disturbance_volume_140_additive),
      AIC(pre_disturbance_volume_140_interaction)
    ),
    bic = c(
      BIC(pre_disturbance_volume_140_null),
      BIC(pre_disturbance_volume_140_additive),
      BIC(pre_disturbance_volume_140_interaction)
    ),
    logLik = c(
      as.numeric(logLik(pre_disturbance_volume_140_null)),
      as.numeric(logLik(pre_disturbance_volume_140_additive)),
      as.numeric(logLik(pre_disturbance_volume_140_interaction))
    ),
    npar = c(
      attr(logLik(pre_disturbance_volume_140_null), "df"),
      attr(logLik(pre_disturbance_volume_140_additive), "df"),
      attr(logLik(pre_disturbance_volume_140_interaction), "df")
    )
  ),
  fill = TRUE
)

pre_disturbance_volume_140_anova <- as.data.table(anova(
  pre_disturbance_volume_140_null,
  pre_disturbance_volume_140_additive,
  pre_disturbance_volume_140_interaction
), keep.rownames = "model_step")
pre_disturbance_volume_140_anova[, response := "volume_140"]
anova_comparison <- rbind(anova_comparison, pre_disturbance_volume_140_anova, fill = TRUE)

pre_disturbance_volume_140_summary <- pre_disturbance_volume_140[, .(
  mean = mean(volume_140, na.rm = TRUE),
  sd = sd(volume_140, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation, condition)]
pre_disturbance_volume_140_summary[, se := sd / sqrt(n)]
pre_disturbance_volume_140_summary[, ci_low := mean - 1.96 * se]
pre_disturbance_volume_140_summary[, ci_high := mean + 1.96 * se]
pre_disturbance_volume_140_summary[, analysis := "state_140"]
pre_disturbance_volume_140_summary[, response := "volume_140"]
descriptive_summary <- rbind(descriptive_summary, pre_disturbance_volume_140_summary, fill = TRUE)

for (landscape_name in unique(as.character(pre_disturbance_volume_140$landscape))) {
  pre_disturbance_volume_140_landscape <- pre_disturbance_volume_140[landscape == landscape_name]
  pre_disturbance_volume_140_aov <- aov(
    volume_140 ~ condition + aggregation,
    data = pre_disturbance_volume_140_landscape
  )
  pre_disturbance_volume_140_tukey <- as.data.table(
    TukeyHSD(pre_disturbance_volume_140_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  pre_disturbance_volume_140_tukey[, `:=`(
    analysis = "state_140",
    response = "volume_140",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, pre_disturbance_volume_140_tukey, fill = TRUE)
}

plot_volume_140_raw <- ggplot(
  pre_disturbance_volume_140,
  aes(x = aggregation, y = volume_140, color = condition)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.25, position = position_dodge(width = 0.75)) +
  geom_jitter(width = 0.15, alpha = 0.55, size = 1.6) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance state at year 140: volume",
    subtitle = "Management-to-management comparison by landscape",
    x = "Aggregation",
    y = "Total volume at year 140"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_volume_140_raw.png"),
  plot = plot_volume_140_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_volume_140_summary <- ggplot(
  pre_disturbance_volume_140_summary,
  aes(x = aggregation, y = mean, color = condition, group = condition)
) +
  geom_point(position = position_dodge(width = 0.35), size = 2.4) +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    position = position_dodge(width = 0.35),
    width = 0.18
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance state at year 140: volume",
    subtitle = "Mean and 95% interval by management and landscape",
    x = "Aggregation",
    y = "Total volume at year 140"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_volume_140_summary.png"),
  plot = plot_volume_140_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 2: gini_140
# -----------------------------------------------------------------------------
message("Fitting pre-disturbance model set: gini_140")
pre_disturbance_gini_140 <- pre_disturbance_140[is.finite(gini_140)]

pre_disturbance_gini_140_null <- lmer(
  gini_140 ~ condition + landscape + (1 | init_uid),
  data = pre_disturbance_gini_140,
  REML = FALSE
)

pre_disturbance_gini_140_additive <- lmer(
  gini_140 ~ condition + landscape + aggregation + (1 | init_uid),
  data = pre_disturbance_gini_140,
  REML = FALSE
)

pre_disturbance_gini_140_interaction <- lmer(
  gini_140 ~ condition + landscape * aggregation + (1 | init_uid),
  data = pre_disturbance_gini_140,
  REML = FALSE
)

saveRDS(
  list(
    null = pre_disturbance_gini_140_null,
    additive = pre_disturbance_gini_140_additive,
    interaction = pre_disturbance_gini_140_interaction,
    response = "gini_140",
    random_effect = "init_uid"
  ),
  file.path(MODELS_OUT, "pre_disturbance_gini_140.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    response = "gini_140",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(pre_disturbance_gini_140),
    aic = c(
      AIC(pre_disturbance_gini_140_null),
      AIC(pre_disturbance_gini_140_additive),
      AIC(pre_disturbance_gini_140_interaction)
    ),
    bic = c(
      BIC(pre_disturbance_gini_140_null),
      BIC(pre_disturbance_gini_140_additive),
      BIC(pre_disturbance_gini_140_interaction)
    ),
    logLik = c(
      as.numeric(logLik(pre_disturbance_gini_140_null)),
      as.numeric(logLik(pre_disturbance_gini_140_additive)),
      as.numeric(logLik(pre_disturbance_gini_140_interaction))
    ),
    npar = c(
      attr(logLik(pre_disturbance_gini_140_null), "df"),
      attr(logLik(pre_disturbance_gini_140_additive), "df"),
      attr(logLik(pre_disturbance_gini_140_interaction), "df")
    )
  ),
  fill = TRUE
)

pre_disturbance_gini_140_anova <- as.data.table(anova(
  pre_disturbance_gini_140_null,
  pre_disturbance_gini_140_additive,
  pre_disturbance_gini_140_interaction
), keep.rownames = "model_step")
pre_disturbance_gini_140_anova[, response := "gini_140"]
anova_comparison <- rbind(anova_comparison, pre_disturbance_gini_140_anova, fill = TRUE)

pre_disturbance_gini_140_summary <- pre_disturbance_gini_140[, .(
  mean = mean(gini_140, na.rm = TRUE),
  sd = sd(gini_140, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation, condition)]
pre_disturbance_gini_140_summary[, se := sd / sqrt(n)]
pre_disturbance_gini_140_summary[, ci_low := mean - 1.96 * se]
pre_disturbance_gini_140_summary[, ci_high := mean + 1.96 * se]
pre_disturbance_gini_140_summary[, analysis := "state_140"]
pre_disturbance_gini_140_summary[, response := "gini_140"]
descriptive_summary <- rbind(descriptive_summary, pre_disturbance_gini_140_summary, fill = TRUE)

for (landscape_name in unique(as.character(pre_disturbance_gini_140$landscape))) {
  pre_disturbance_gini_140_landscape <- pre_disturbance_gini_140[landscape == landscape_name]
  pre_disturbance_gini_140_aov <- aov(
    gini_140 ~ condition + aggregation,
    data = pre_disturbance_gini_140_landscape
  )
  pre_disturbance_gini_140_tukey <- as.data.table(
    TukeyHSD(pre_disturbance_gini_140_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  pre_disturbance_gini_140_tukey[, `:=`(
    analysis = "state_140",
    response = "gini_140",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, pre_disturbance_gini_140_tukey, fill = TRUE)
}

plot_gini_140_raw <- ggplot(
  pre_disturbance_gini_140,
  aes(x = aggregation, y = gini_140, color = condition)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.25, position = position_dodge(width = 0.75)) +
  geom_jitter(width = 0.15, alpha = 0.55, size = 1.6) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance state at year 140: DBH Gini",
    subtitle = "Management-to-management comparison by landscape",
    x = "Aggregation",
    y = "DBH Gini at year 140"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_gini_140_raw.png"),
  plot = plot_gini_140_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_gini_140_summary <- ggplot(
  pre_disturbance_gini_140_summary,
  aes(x = aggregation, y = mean, color = condition, group = condition)
) +
  geom_point(position = position_dodge(width = 0.35), size = 2.4) +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    position = position_dodge(width = 0.35),
    width = 0.18
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance state at year 140: DBH Gini",
    subtitle = "Mean and 95% interval by management and landscape",
    x = "Aggregation",
    y = "DBH Gini at year 140"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_gini_140_summary.png"),
  plot = plot_gini_140_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 3: conifer_140
# -----------------------------------------------------------------------------
message("Fitting pre-disturbance model set: conifer_140")
pre_disturbance_conifer_140 <- pre_disturbance_140[is.finite(conifer_140)]

pre_disturbance_conifer_140_null <- lmer(
  conifer_140 ~ condition + landscape + (1 | init_uid),
  data = pre_disturbance_conifer_140,
  REML = FALSE
)

pre_disturbance_conifer_140_additive <- lmer(
  conifer_140 ~ condition + landscape + aggregation + (1 | init_uid),
  data = pre_disturbance_conifer_140,
  REML = FALSE
)

pre_disturbance_conifer_140_interaction <- lmer(
  conifer_140 ~ condition + landscape * aggregation + (1 | init_uid),
  data = pre_disturbance_conifer_140,
  REML = FALSE
)

saveRDS(
  list(
    null = pre_disturbance_conifer_140_null,
    additive = pre_disturbance_conifer_140_additive,
    interaction = pre_disturbance_conifer_140_interaction,
    response = "conifer_140",
    random_effect = "init_uid"
  ),
  file.path(MODELS_OUT, "pre_disturbance_conifer_140.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    response = "conifer_140",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(pre_disturbance_conifer_140),
    aic = c(
      AIC(pre_disturbance_conifer_140_null),
      AIC(pre_disturbance_conifer_140_additive),
      AIC(pre_disturbance_conifer_140_interaction)
    ),
    bic = c(
      BIC(pre_disturbance_conifer_140_null),
      BIC(pre_disturbance_conifer_140_additive),
      BIC(pre_disturbance_conifer_140_interaction)
    ),
    logLik = c(
      as.numeric(logLik(pre_disturbance_conifer_140_null)),
      as.numeric(logLik(pre_disturbance_conifer_140_additive)),
      as.numeric(logLik(pre_disturbance_conifer_140_interaction))
    ),
    npar = c(
      attr(logLik(pre_disturbance_conifer_140_null), "df"),
      attr(logLik(pre_disturbance_conifer_140_additive), "df"),
      attr(logLik(pre_disturbance_conifer_140_interaction), "df")
    )
  ),
  fill = TRUE
)

pre_disturbance_conifer_140_anova <- as.data.table(anova(
  pre_disturbance_conifer_140_null,
  pre_disturbance_conifer_140_additive,
  pre_disturbance_conifer_140_interaction
), keep.rownames = "model_step")
pre_disturbance_conifer_140_anova[, response := "conifer_140"]
anova_comparison <- rbind(anova_comparison, pre_disturbance_conifer_140_anova, fill = TRUE)

pre_disturbance_conifer_140_summary <- pre_disturbance_conifer_140[, .(
  mean = mean(conifer_140, na.rm = TRUE),
  sd = sd(conifer_140, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation, condition)]
pre_disturbance_conifer_140_summary[, se := sd / sqrt(n)]
pre_disturbance_conifer_140_summary[, ci_low := mean - 1.96 * se]
pre_disturbance_conifer_140_summary[, ci_high := mean + 1.96 * se]
pre_disturbance_conifer_140_summary[, analysis := "state_140"]
pre_disturbance_conifer_140_summary[, response := "conifer_140"]
descriptive_summary <- rbind(descriptive_summary, pre_disturbance_conifer_140_summary, fill = TRUE)

for (landscape_name in unique(as.character(pre_disturbance_conifer_140$landscape))) {
  pre_disturbance_conifer_140_landscape <- pre_disturbance_conifer_140[landscape == landscape_name]
  pre_disturbance_conifer_140_aov <- aov(
    conifer_140 ~ condition + aggregation,
    data = pre_disturbance_conifer_140_landscape
  )
  pre_disturbance_conifer_140_tukey <- as.data.table(
    TukeyHSD(pre_disturbance_conifer_140_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  pre_disturbance_conifer_140_tukey[, `:=`(
    analysis = "state_140",
    response = "conifer_140",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, pre_disturbance_conifer_140_tukey, fill = TRUE)
}

plot_conifer_140_raw <- ggplot(
  pre_disturbance_conifer_140,
  aes(x = aggregation, y = conifer_140, color = condition)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.25, position = position_dodge(width = 0.75)) +
  geom_jitter(width = 0.15, alpha = 0.55, size = 1.6) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance state at year 140: conifer share",
    subtitle = "Management-to-management comparison by landscape",
    x = "Aggregation",
    y = "Conifer share at year 140"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_conifer_140_raw.png"),
  plot = plot_conifer_140_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_conifer_140_summary <- ggplot(
  pre_disturbance_conifer_140_summary,
  aes(x = aggregation, y = mean, color = condition, group = condition)
) +
  geom_point(position = position_dodge(width = 0.35), size = 2.4) +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    position = position_dodge(width = 0.35),
    width = 0.18
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance state at year 140: conifer share",
    subtitle = "Mean and 95% interval by management and landscape",
    x = "Aggregation",
    y = "Conifer share at year 140"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_conifer_140_summary.png"),
  plot = plot_conifer_140_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 4: delta_volume_10_140
# -----------------------------------------------------------------------------
message("Fitting pre-disturbance model set: delta_volume_10_140")
pre_disturbance_delta_volume_10_140 <- pre_disturbance_change_wide[is.finite(delta_volume_10_140)]

pre_disturbance_delta_volume_10_140_null <- lmer(
  delta_volume_10_140 ~ condition + landscape + (1 | init_uid),
  data = pre_disturbance_delta_volume_10_140,
  REML = FALSE
)

pre_disturbance_delta_volume_10_140_additive <- lmer(
  delta_volume_10_140 ~ condition + landscape + aggregation + (1 | init_uid),
  data = pre_disturbance_delta_volume_10_140,
  REML = FALSE
)

pre_disturbance_delta_volume_10_140_interaction <- lmer(
  delta_volume_10_140 ~ condition + landscape * aggregation + (1 | init_uid),
  data = pre_disturbance_delta_volume_10_140,
  REML = FALSE
)

saveRDS(
  list(
    null = pre_disturbance_delta_volume_10_140_null,
    additive = pre_disturbance_delta_volume_10_140_additive,
    interaction = pre_disturbance_delta_volume_10_140_interaction,
    response = "delta_volume_10_140",
    random_effect = "init_uid"
  ),
  file.path(MODELS_OUT, "pre_disturbance_delta_volume_10_140.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    response = "delta_volume_10_140",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(pre_disturbance_delta_volume_10_140),
    aic = c(
      AIC(pre_disturbance_delta_volume_10_140_null),
      AIC(pre_disturbance_delta_volume_10_140_additive),
      AIC(pre_disturbance_delta_volume_10_140_interaction)
    ),
    bic = c(
      BIC(pre_disturbance_delta_volume_10_140_null),
      BIC(pre_disturbance_delta_volume_10_140_additive),
      BIC(pre_disturbance_delta_volume_10_140_interaction)
    ),
    logLik = c(
      as.numeric(logLik(pre_disturbance_delta_volume_10_140_null)),
      as.numeric(logLik(pre_disturbance_delta_volume_10_140_additive)),
      as.numeric(logLik(pre_disturbance_delta_volume_10_140_interaction))
    ),
    npar = c(
      attr(logLik(pre_disturbance_delta_volume_10_140_null), "df"),
      attr(logLik(pre_disturbance_delta_volume_10_140_additive), "df"),
      attr(logLik(pre_disturbance_delta_volume_10_140_interaction), "df")
    )
  ),
  fill = TRUE
)

pre_disturbance_delta_volume_10_140_anova <- as.data.table(anova(
  pre_disturbance_delta_volume_10_140_null,
  pre_disturbance_delta_volume_10_140_additive,
  pre_disturbance_delta_volume_10_140_interaction
), keep.rownames = "model_step")
pre_disturbance_delta_volume_10_140_anova[, response := "delta_volume_10_140"]
anova_comparison <- rbind(anova_comparison, pre_disturbance_delta_volume_10_140_anova, fill = TRUE)

pre_disturbance_delta_volume_10_140_summary <- pre_disturbance_delta_volume_10_140[, .(
  mean = mean(delta_volume_10_140, na.rm = TRUE),
  sd = sd(delta_volume_10_140, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation, condition)]
pre_disturbance_delta_volume_10_140_summary[, se := sd / sqrt(n)]
pre_disturbance_delta_volume_10_140_summary[, ci_low := mean - 1.96 * se]
pre_disturbance_delta_volume_10_140_summary[, ci_high := mean + 1.96 * se]
pre_disturbance_delta_volume_10_140_summary[, analysis := "change_10_140"]
pre_disturbance_delta_volume_10_140_summary[, response := "delta_volume_10_140"]
descriptive_summary <- rbind(descriptive_summary, pre_disturbance_delta_volume_10_140_summary, fill = TRUE)

for (landscape_name in unique(as.character(pre_disturbance_delta_volume_10_140$landscape))) {
  pre_disturbance_delta_volume_10_140_landscape <- pre_disturbance_delta_volume_10_140[landscape == landscape_name]
  pre_disturbance_delta_volume_10_140_aov <- aov(
    delta_volume_10_140 ~ condition + aggregation,
    data = pre_disturbance_delta_volume_10_140_landscape
  )
  pre_disturbance_delta_volume_10_140_tukey <- as.data.table(
    TukeyHSD(pre_disturbance_delta_volume_10_140_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  pre_disturbance_delta_volume_10_140_tukey[, `:=`(
    analysis = "change_10_140",
    response = "delta_volume_10_140",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, pre_disturbance_delta_volume_10_140_tukey, fill = TRUE)
}

plot_delta_volume_10_140_raw <- ggplot(
  pre_disturbance_delta_volume_10_140,
  aes(x = aggregation, y = delta_volume_10_140, color = condition)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.25, position = position_dodge(width = 0.75)) +
  geom_jitter(width = 0.15, alpha = 0.55, size = 1.6) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance change from year 10 to 140: volume",
    subtitle = "Does management change the landscape differently?",
    x = "Aggregation",
    y = "Delta volume (year 140 - year 10)"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_delta_volume_10_140_raw.png"),
  plot = plot_delta_volume_10_140_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_delta_volume_10_140_summary <- ggplot(
  pre_disturbance_delta_volume_10_140_summary,
  aes(x = aggregation, y = mean, color = condition, group = condition)
) +
  geom_point(position = position_dodge(width = 0.35), size = 2.4) +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    position = position_dodge(width = 0.35),
    width = 0.18
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance change from year 10 to 140: volume",
    subtitle = "Mean and 95% interval by management and landscape",
    x = "Aggregation",
    y = "Delta volume (year 140 - year 10)"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_delta_volume_10_140_summary.png"),
  plot = plot_delta_volume_10_140_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 5: delta_gini_10_140
# -----------------------------------------------------------------------------
message("Fitting pre-disturbance model set: delta_gini_10_140")
pre_disturbance_delta_gini_10_140 <- pre_disturbance_change_wide[is.finite(delta_gini_10_140)]

pre_disturbance_delta_gini_10_140_null <- lmer(
  delta_gini_10_140 ~ condition + landscape + (1 | init_uid),
  data = pre_disturbance_delta_gini_10_140,
  REML = FALSE
)

pre_disturbance_delta_gini_10_140_additive <- lmer(
  delta_gini_10_140 ~ condition + landscape + aggregation + (1 | init_uid),
  data = pre_disturbance_delta_gini_10_140,
  REML = FALSE
)

pre_disturbance_delta_gini_10_140_interaction <- lmer(
  delta_gini_10_140 ~ condition + landscape * aggregation + (1 | init_uid),
  data = pre_disturbance_delta_gini_10_140,
  REML = FALSE
)

saveRDS(
  list(
    null = pre_disturbance_delta_gini_10_140_null,
    additive = pre_disturbance_delta_gini_10_140_additive,
    interaction = pre_disturbance_delta_gini_10_140_interaction,
    response = "delta_gini_10_140",
    random_effect = "init_uid"
  ),
  file.path(MODELS_OUT, "pre_disturbance_delta_gini_10_140.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    response = "delta_gini_10_140",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(pre_disturbance_delta_gini_10_140),
    aic = c(
      AIC(pre_disturbance_delta_gini_10_140_null),
      AIC(pre_disturbance_delta_gini_10_140_additive),
      AIC(pre_disturbance_delta_gini_10_140_interaction)
    ),
    bic = c(
      BIC(pre_disturbance_delta_gini_10_140_null),
      BIC(pre_disturbance_delta_gini_10_140_additive),
      BIC(pre_disturbance_delta_gini_10_140_interaction)
    ),
    logLik = c(
      as.numeric(logLik(pre_disturbance_delta_gini_10_140_null)),
      as.numeric(logLik(pre_disturbance_delta_gini_10_140_additive)),
      as.numeric(logLik(pre_disturbance_delta_gini_10_140_interaction))
    ),
    npar = c(
      attr(logLik(pre_disturbance_delta_gini_10_140_null), "df"),
      attr(logLik(pre_disturbance_delta_gini_10_140_additive), "df"),
      attr(logLik(pre_disturbance_delta_gini_10_140_interaction), "df")
    )
  ),
  fill = TRUE
)

pre_disturbance_delta_gini_10_140_anova <- as.data.table(anova(
  pre_disturbance_delta_gini_10_140_null,
  pre_disturbance_delta_gini_10_140_additive,
  pre_disturbance_delta_gini_10_140_interaction
), keep.rownames = "model_step")
pre_disturbance_delta_gini_10_140_anova[, response := "delta_gini_10_140"]
anova_comparison <- rbind(anova_comparison, pre_disturbance_delta_gini_10_140_anova, fill = TRUE)

pre_disturbance_delta_gini_10_140_summary <- pre_disturbance_delta_gini_10_140[, .(
  mean = mean(delta_gini_10_140, na.rm = TRUE),
  sd = sd(delta_gini_10_140, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation, condition)]
pre_disturbance_delta_gini_10_140_summary[, se := sd / sqrt(n)]
pre_disturbance_delta_gini_10_140_summary[, ci_low := mean - 1.96 * se]
pre_disturbance_delta_gini_10_140_summary[, ci_high := mean + 1.96 * se]
pre_disturbance_delta_gini_10_140_summary[, analysis := "change_10_140"]
pre_disturbance_delta_gini_10_140_summary[, response := "delta_gini_10_140"]
descriptive_summary <- rbind(descriptive_summary, pre_disturbance_delta_gini_10_140_summary, fill = TRUE)

for (landscape_name in unique(as.character(pre_disturbance_delta_gini_10_140$landscape))) {
  pre_disturbance_delta_gini_10_140_landscape <- pre_disturbance_delta_gini_10_140[landscape == landscape_name]
  pre_disturbance_delta_gini_10_140_aov <- aov(
    delta_gini_10_140 ~ condition + aggregation,
    data = pre_disturbance_delta_gini_10_140_landscape
  )
  pre_disturbance_delta_gini_10_140_tukey <- as.data.table(
    TukeyHSD(pre_disturbance_delta_gini_10_140_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  pre_disturbance_delta_gini_10_140_tukey[, `:=`(
    analysis = "change_10_140",
    response = "delta_gini_10_140",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, pre_disturbance_delta_gini_10_140_tukey, fill = TRUE)
}

plot_delta_gini_10_140_raw <- ggplot(
  pre_disturbance_delta_gini_10_140,
  aes(x = aggregation, y = delta_gini_10_140, color = condition)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.25, position = position_dodge(width = 0.75)) +
  geom_jitter(width = 0.15, alpha = 0.55, size = 1.6) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance change from year 10 to 140: DBH Gini",
    subtitle = "Does management change structure differently?",
    x = "Aggregation",
    y = "Delta Gini (year 140 - year 10)"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_delta_gini_10_140_raw.png"),
  plot = plot_delta_gini_10_140_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_delta_gini_10_140_summary <- ggplot(
  pre_disturbance_delta_gini_10_140_summary,
  aes(x = aggregation, y = mean, color = condition, group = condition)
) +
  geom_point(position = position_dodge(width = 0.35), size = 2.4) +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    position = position_dodge(width = 0.35),
    width = 0.18
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance change from year 10 to 140: DBH Gini",
    subtitle = "Mean and 95% interval by management and landscape",
    x = "Aggregation",
    y = "Delta Gini (year 140 - year 10)"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_delta_gini_10_140_summary.png"),
  plot = plot_delta_gini_10_140_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Response 6: delta_conifer_10_140
# -----------------------------------------------------------------------------
message("Fitting pre-disturbance model set: delta_conifer_10_140")
pre_disturbance_delta_conifer_10_140 <- pre_disturbance_change_wide[is.finite(delta_conifer_10_140)]

pre_disturbance_delta_conifer_10_140_null <- lmer(
  delta_conifer_10_140 ~ condition + landscape + (1 | init_uid),
  data = pre_disturbance_delta_conifer_10_140,
  REML = FALSE
)

pre_disturbance_delta_conifer_10_140_additive <- lmer(
  delta_conifer_10_140 ~ condition + landscape + aggregation + (1 | init_uid),
  data = pre_disturbance_delta_conifer_10_140,
  REML = FALSE
)

pre_disturbance_delta_conifer_10_140_interaction <- lmer(
  delta_conifer_10_140 ~ condition + landscape * aggregation + (1 | init_uid),
  data = pre_disturbance_delta_conifer_10_140,
  REML = FALSE
)

saveRDS(
  list(
    null = pre_disturbance_delta_conifer_10_140_null,
    additive = pre_disturbance_delta_conifer_10_140_additive,
    interaction = pre_disturbance_delta_conifer_10_140_interaction,
    response = "delta_conifer_10_140",
    random_effect = "init_uid"
  ),
  file.path(MODELS_OUT, "pre_disturbance_delta_conifer_10_140.rds")
)

model_comparison <- rbind(
  model_comparison,
  data.table(
    response = "delta_conifer_10_140",
    model = c("null", "additive", "interaction"),
    n_obs = nrow(pre_disturbance_delta_conifer_10_140),
    aic = c(
      AIC(pre_disturbance_delta_conifer_10_140_null),
      AIC(pre_disturbance_delta_conifer_10_140_additive),
      AIC(pre_disturbance_delta_conifer_10_140_interaction)
    ),
    bic = c(
      BIC(pre_disturbance_delta_conifer_10_140_null),
      BIC(pre_disturbance_delta_conifer_10_140_additive),
      BIC(pre_disturbance_delta_conifer_10_140_interaction)
    ),
    logLik = c(
      as.numeric(logLik(pre_disturbance_delta_conifer_10_140_null)),
      as.numeric(logLik(pre_disturbance_delta_conifer_10_140_additive)),
      as.numeric(logLik(pre_disturbance_delta_conifer_10_140_interaction))
    ),
    npar = c(
      attr(logLik(pre_disturbance_delta_conifer_10_140_null), "df"),
      attr(logLik(pre_disturbance_delta_conifer_10_140_additive), "df"),
      attr(logLik(pre_disturbance_delta_conifer_10_140_interaction), "df")
    )
  ),
  fill = TRUE
)

pre_disturbance_delta_conifer_10_140_anova <- as.data.table(anova(
  pre_disturbance_delta_conifer_10_140_null,
  pre_disturbance_delta_conifer_10_140_additive,
  pre_disturbance_delta_conifer_10_140_interaction
), keep.rownames = "model_step")
pre_disturbance_delta_conifer_10_140_anova[, response := "delta_conifer_10_140"]
anova_comparison <- rbind(anova_comparison, pre_disturbance_delta_conifer_10_140_anova, fill = TRUE)

pre_disturbance_delta_conifer_10_140_summary <- pre_disturbance_delta_conifer_10_140[, .(
  mean = mean(delta_conifer_10_140, na.rm = TRUE),
  sd = sd(delta_conifer_10_140, na.rm = TRUE),
  n = .N
), by = .(landscape, aggregation, condition)]
pre_disturbance_delta_conifer_10_140_summary[, se := sd / sqrt(n)]
pre_disturbance_delta_conifer_10_140_summary[, ci_low := mean - 1.96 * se]
pre_disturbance_delta_conifer_10_140_summary[, ci_high := mean + 1.96 * se]
pre_disturbance_delta_conifer_10_140_summary[, analysis := "change_10_140"]
pre_disturbance_delta_conifer_10_140_summary[, response := "delta_conifer_10_140"]
descriptive_summary <- rbind(descriptive_summary, pre_disturbance_delta_conifer_10_140_summary, fill = TRUE)

for (landscape_name in unique(as.character(pre_disturbance_delta_conifer_10_140$landscape))) {
  pre_disturbance_delta_conifer_10_140_landscape <- pre_disturbance_delta_conifer_10_140[landscape == landscape_name]
  pre_disturbance_delta_conifer_10_140_aov <- aov(
    delta_conifer_10_140 ~ condition + aggregation,
    data = pre_disturbance_delta_conifer_10_140_landscape
  )
  pre_disturbance_delta_conifer_10_140_tukey <- as.data.table(
    TukeyHSD(pre_disturbance_delta_conifer_10_140_aov, which = "aggregation")$aggregation,
    keep.rownames = "contrast"
  )
  pre_disturbance_delta_conifer_10_140_tukey[, `:=`(
    analysis = "change_10_140",
    response = "delta_conifer_10_140",
    landscape = landscape_name
  )]
  pairwise_tukey <- rbind(pairwise_tukey, pre_disturbance_delta_conifer_10_140_tukey, fill = TRUE)
}

plot_delta_conifer_10_140_raw <- ggplot(
  pre_disturbance_delta_conifer_10_140,
  aes(x = aggregation, y = delta_conifer_10_140, color = condition)
) +
  geom_boxplot(outlier.shape = NA, alpha = 0.25, position = position_dodge(width = 0.75)) +
  geom_jitter(width = 0.15, alpha = 0.55, size = 1.6) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance change from year 10 to 140: conifer share",
    subtitle = "Does management change composition differently?",
    x = "Aggregation",
    y = "Delta conifer share (year 140 - year 10)"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_delta_conifer_10_140_raw.png"),
  plot = plot_delta_conifer_10_140_raw,
  width = 12,
  height = 7,
  dpi = 300
)

plot_delta_conifer_10_140_summary <- ggplot(
  pre_disturbance_delta_conifer_10_140_summary,
  aes(x = aggregation, y = mean, color = condition, group = condition)
) +
  geom_point(position = position_dodge(width = 0.35), size = 2.4) +
  geom_errorbar(
    aes(ymin = ci_low, ymax = ci_high),
    position = position_dodge(width = 0.35),
    width = 0.18
  ) +
  facet_wrap(~ landscape, scales = "free_y") +
  labs(
    title = "Pre-disturbance change from year 10 to 140: conifer share",
    subtitle = "Mean and 95% interval by management and landscape",
    x = "Aggregation",
    y = "Delta conifer share (year 140 - year 10)"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    legend.position = "bottom",
    axis.text.x = element_text(angle = 30, hjust = 1)
  )

ggsave(
  filename = file.path(FIGURES_OUT, "pre_disturbance_delta_conifer_10_140_summary.png"),
  plot = plot_delta_conifer_10_140_summary,
  width = 12,
  height = 7,
  dpi = 300
)

# -----------------------------------------------------------------------------
# Final output tables
# -----------------------------------------------------------------------------
model_comparison[, model := factor(model, levels = c("null", "additive", "interaction"))]
model_comparison[, analysis := fifelse(
  grepl("^delta_", response),
  "change_10_140",
  "state_140"
)]
setorder(model_comparison, response, model)
model_comparison[, delta_aic_vs_null := aic - aic[model == "null"], by = response]
model_comparison[, delta_logLik_vs_null := logLik - logLik[model == "null"], by = response]

anova_comparison[, analysis := fifelse(
  grepl("^delta_", response),
  "change_10_140",
  "state_140"
)]

setorder(descriptive_summary, response, landscape, aggregation, condition)
setorder(pairwise_tukey, response, landscape, contrast)

parameter_ci <- rbindlist(
  list(
    extract_selected_model_parameter_ci(
      model_comparison = model_comparison[analysis == "state_140"],
      models_dir = MODELS_OUT,
      analysis_name = "state_140"
    ),
    extract_selected_model_parameter_ci(
      model_comparison = model_comparison[analysis == "change_10_140"],
      models_dir = MODELS_OUT,
      analysis_name = "change_10_140"
    )
  ),
  use.names = TRUE,
  fill = TRUE
)

fwrite(
  model_comparison,
  file.path(TABLES_OUT, "pre_disturbance_model_comparison.csv")
)

fwrite(
  anova_comparison,
  file.path(TABLES_OUT, "pre_disturbance_anova_comparison.csv")
)

fwrite(
  descriptive_summary,
  file.path(TABLES_OUT, "pre_disturbance_descriptive_summary.csv")
)

fwrite(
  pairwise_tukey,
  file.path(TABLES_OUT, "pre_disturbance_pairwise_tukey.csv")
)

fwrite(
  parameter_ci,
  file.path(TABLES_OUT, "pre_disturbance_selected_model_parameter_ci.csv")
)

message("Saved pre-disturbance snapshot dataset")
message("Saved pre-disturbance model comparison table")
message("Saved pre-disturbance anova comparison table")
message("Saved pre-disturbance descriptive summary table")
message("Saved pre-disturbance pairwise Tukey table")
message("Saved pre-disturbance selected-model parameter CI table")
message("Saved pre-disturbance raw and summary plots")
message("=== Pre-disturbance analysis complete ===")
