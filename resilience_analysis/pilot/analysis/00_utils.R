# =============================================================================
# Shared utilities for the pilot resilience analysis
# =============================================================================

library(ggplot2)
library(dplyr)
library(tidyr)
library(patchwork)
library(scales)

RES_DIR  <- file.path("resilience_analysis", "pilot")
DATA_DIR <- file.path(RES_DIR, "data")
FIG_DIR  <- file.path(RES_DIR, "figures")
dir.create(FIG_DIR, showWarnings = FALSE, recursive = TRUE)

DATA_START      <- 1
BASELINE_START  <- 1
BASELINE_END    <- 149
OUTBREAK_START  <- 150
OUTBREAK_END    <- 160
RECOVERY_START  <- 161
RECOVERY_END    <- 250
RESISTANCE_END  <- 250
BASELINE_SPECIES_YEAR <- 150

agg_colors <- c(
  High = "#e41a1c", state_only = "#4daf4a",
  small_only = "#ff7f00", big_only = "#984ea3"
)

climate_colors <- c(
  historical = "#333333",
  rcp_8_5    = "#ca0020"
)

theme_resilience <- function(base_size = 11) {
  theme_minimal(base_size = base_size) +
    theme(
      legend.position = "bottom",
      strip.text = element_text(face = "bold"),
      panel.grid.minor = element_blank()
    )
}

load_pilot_data <- function() {
  clean_agg <- function(x) gsub("^matched_", "", x)

  safe_read <- function(filename) {
    path <- file.path(DATA_DIR, filename)
    if (!file.exists(path) || file.info(path)$size < 10) return(data.frame())
    df <- read.csv(path, stringsAsFactors = FALSE)
    if ("aggregation" %in% names(df)) df$aggregation <- clean_agg(df$aggregation)
    df
  }

  list(
    run_manifest      = safe_read("run_manifest.csv"),
    landscape_metrics = safe_read("landscape_metrics.csv"),
    species_yearly    = safe_read("species_yearly.csv"),
    removal_summary   = safe_read("removal_summary.csv"),
    barkbeetle        = safe_read("barkbeetle_summary.csv"),
    baselines         = safe_read("baselines.csv"),
    baseline_species  = safe_read("baseline_species_vectors.csv"),
    resilience        = safe_read("resilience_summary.csv")
  )
}

save_fig <- function(p, name, width = 12, height = 7, dpi = 300) {
  path <- file.path(FIG_DIR, paste0(name, ".png"))
  ggsave(path, p, width = width, height = height, dpi = dpi)
  cat(sprintf("  Saved: %s\n", path))
}
