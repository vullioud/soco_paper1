# =============================================================================
# 04_models.R — Statistical models for resilience analysis
#
# 1. ANOVA: resistance_volume ~ landscape * aggregation
# 2. Linear model: recovery_time_90 ~ landscape * aggregation
# 3. Logistic: regime_shift ~ aggregation
# 4. Random Forest: pathway classification variable importance
# =============================================================================

source("resilience_analysis/legacy/analysis/00_utils.R")
cat("=== Running statistical models ===\n")

d <- load_resilience_data()
res <- d$resilience

if (nrow(res) < 10) stop("Insufficient data for statistical models.")

# =============================================================================
# 1. ANOVA: Resistance
# =============================================================================
cat("\n--- Model 1: Resistance (ANOVA) ---\n")

m1 <- aov(resistance_volume ~ landscape * aggregation * climate, data = res)
cat("ANOVA table:\n")
print(summary(m1))

# Effect sizes (eta-squared)
ss <- summary(m1)[[1]]
ss$eta_sq <- ss$`Sum Sq` / sum(ss$`Sum Sq`)
cat("\nEta-squared:\n")
eta_cols <- intersect(c("Df", "Sum Sq", "F value", "Pr(>F)", "eta_sq"), names(ss))
print(ss[, eta_cols])

# =============================================================================
# 2. Linear model: Recovery time
# =============================================================================
cat("\n--- Model 2: Recovery time (linear model) ---\n")

res_rec <- res %>% filter(!is.na(recovery_time_90))

if (nrow(res_rec) >= 10) {
  m2 <- lm(recovery_time_90 ~ landscape * aggregation * climate, data = res_rec)
  cat("Linear model summary:\n")
  print(summary(m2))
  cat(sprintf("\nR-squared: %.3f\n", summary(m2)$r.squared))
} else {
  cat("  SKIP: too few non-NA recovery times\n")
}

# =============================================================================
# 3. Logistic: Regime shift
# =============================================================================
cat("\n--- Model 3: Regime shift (logistic) ---\n")

if (sum(res$regime_shift_flag) > 0 && sum(res$regime_shift_flag) < nrow(res)) {
  m3 <- glm(regime_shift_flag ~ aggregation + climate, data = res, family = binomial)
  cat("Logistic regression:\n")
  print(summary(m3))
} else {
  cat("  SKIP: no variation in regime_shift_flag (all 0 or all 1)\n")
  # Fisher's exact test as fallback
  if (length(unique(res$aggregation)) > 1) {
    tab <- table(res$aggregation, res$regime_shift_flag)
    cat("\nContingency table:\n")
    print(tab)
    if (ncol(tab) == 2) {
      ft <- fisher.test(tab, simulate.p.value = TRUE)
      cat(sprintf("Fisher's exact p-value: %.4f\n", ft$p.value))
    }
  }
}

# =============================================================================
# 4. Random Forest: Pathway importance
# =============================================================================
cat("\n--- Model 4: RF variable importance ---\n")

if (requireNamespace("ranger", quietly = TRUE)) {
  rf_data <- res %>%
    select(pathway, resistance_volume, resistance_ba, recovery_time_90,
           completeness_end, bray_curtis_end, conifer_shift, shannon_shift,
           landscape, aggregation, climate) %>%
    mutate(pathway = as.factor(pathway),
           across(where(is.character), as.factor)) %>%
    filter(complete.cases(.))

  if (nrow(rf_data) >= 20) {
    rf <- ranger::ranger(pathway ~ ., data = rf_data,
                         importance = "impurity", num.trees = 1000)
    cat("RF OOB error rate:", round(rf$prediction.error, 3), "\n")
    cat("\nVariable importance:\n")
    imp <- sort(rf$variable.importance, decreasing = TRUE)
    print(round(imp, 3))
  } else {
    cat("  SKIP: too few complete cases for RF\n")
  }
} else {
  cat("  SKIP: ranger package not installed\n")
}

# =============================================================================
# Cox PH: Recovery as survival (censored if never reaches 90%)
# =============================================================================
cat("\n--- Model 5: Cox PH survival analysis ---\n")

if (requireNamespace("survival", quietly = TRUE)) {
  res_surv <- res %>%
    mutate(
      time = ifelse(is.na(recovery_time_90), RECOVERY_END - OUTBREAK_START, recovery_time_90),
      event = as.integer(!is.na(recovery_time_90))
    )

  if (sum(res_surv$event) >= 5) {
    cox <- survival::coxph(
      survival::Surv(time, event) ~ landscape + aggregation + climate,
      data = res_surv
    )
    cat("Cox PH model:\n")
    print(summary(cox))
  } else {
    cat("  SKIP: too few recovery events for Cox PH\n")
  }
} else {
  cat("  SKIP: survival package not installed\n")
}

cat("\n=== Models complete ===\n")
