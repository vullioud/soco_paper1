cat("============================================================\n")
cat("  PILOT RESILIENCE ANALYSIS PIPELINE\n")
cat("============================================================\n\n")

args <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("^--file=", args, value = TRUE)
if (length(file_arg) > 0) {
  script_dir <- dirname(normalizePath(sub("^--file=", "", file_arg[1])))
  setwd(normalizePath(file.path(script_dir, "..", "..", "..")))
}

if (!file.exists("resilience_analysis/pilot/analysis/00_utils.R")) {
  stop("Cannot find project root. Run from project directory.")
}

t0 <- proc.time()

cat("Step 1/2: Computing pilot baselines...\n")
source("resilience_analysis/pilot/analysis/01_compute_baselines.R")

cat("\nStep 2/2: Computing pilot resilience indicators...\n")
source("resilience_analysis/pilot/analysis/02_compute_resilience.R")

elapsed <- (proc.time() - t0)["elapsed"]
cat(sprintf("\n============================================================\n"))
cat(sprintf("  PILOT PIPELINE COMPLETE (%.1f seconds)\n", elapsed))
cat(sprintf("  Data:    resilience_analysis/pilot/data/\n"))
cat(sprintf("  Figures: resilience_analysis/pilot/figures/\n"))
cat(sprintf("============================================================\n"))
