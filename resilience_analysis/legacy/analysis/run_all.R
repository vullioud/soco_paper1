# =============================================================================
# run_all.R — Master script for resilience analysis pipeline
#
# Usage: Rscript resilience_analysis/legacy/analysis/run_all.R
# =============================================================================

cat("============================================================\n")
cat("  RESILIENCE ANALYSIS PIPELINE — Paper 2\n")
cat("============================================================\n\n")

# Set working directory to project root
if (!file.exists("resilience_analysis/legacy/analysis/00_utils.R")) {
  # Try to find project root
  candidates <- c(".", "..", "../..")
  found <- FALSE
  for (d in candidates) {
    if (file.exists(file.path(d, "resilience_analysis/legacy/analysis/00_utils.R"))) {
      setwd(d)
      found <- TRUE
      break
    }
  }
  if (!found) stop("Cannot find project root. Run from project directory.")
}

t0 <- proc.time()

cat("Step 1/5: Computing baselines...\n")
source("resilience_analysis/legacy/analysis/01_compute_baselines.R")

cat("\nStep 2/5: Computing resilience indicators...\n")
source("resilience_analysis/legacy/analysis/02_compute_resilience.R")

cat("\nStep 3/5: Generating figures...\n")
source("resilience_analysis/legacy/analysis/03_figures.R")

cat("\nStep 4/5: Generating detailed diagnostic figures...\n")
source("resilience_analysis/legacy/analysis/03b_detailed_figures.R")

cat("\nStep 5/5: Running statistical models...\n")
source("resilience_analysis/legacy/analysis/04_models.R")

elapsed <- (proc.time() - t0)["elapsed"]
cat(sprintf("\n============================================================\n"))
cat(sprintf("  PIPELINE COMPLETE (%.1f seconds)\n", elapsed))
cat(sprintf("  Data:    resilience_analysis/legacy/data/\n"))
cat(sprintf("  Figures: resilience_analysis/legacy/figures/\n"))
cat(sprintf("============================================================\n"))
