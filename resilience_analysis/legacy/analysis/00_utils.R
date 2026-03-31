# =============================================================================
# Shared utilities for resilience analysis (Paper 2)
#
# Source this file at the top of every analysis script:
#   source("resilience_analysis/legacy/analysis/00_utils.R")
# =============================================================================

library(ggplot2)
library(dplyr)
library(tidyr)
library(patchwork)
library(scales)

# --- Paths ---
RES_DIR  <- file.path("resilience_analysis", "legacy")
DATA_DIR <- file.path(RES_DIR, "data")
FIG_DIR  <- file.path(RES_DIR, "figures")
dir.create(FIG_DIR, showWarnings = FALSE, recursive = TRUE)

# --- Temporal windows ---
# Timeline: 0-100 warmup | 100-200 control (no BB) | 200-300 treatment (moderate BB)
DATA_START      <- 100   # first year tracked in output
BASELINE_START  <- 100
BASELINE_END    <- 199
OUTBREAK_START  <- 200
OUTBREAK_END    <- 300
RECOVERY_END    <- 300
RESISTANCE_END  <- 300  # search window for max impact (full treatment period)
BASELINE_SPECIES_YEAR <- 200  # nearest decadal point to BASELINE_END (species data is decadal)

# =============================================================================
# PALETTES (consistent with Paper 1)
# =============================================================================

btype_palette <- c(
  MF = "#377eb8", OP = "#e41a1c", TR = "#4daf4a",
  PA = "#ff7f00", EN = "#984ea3"
)
btype_labels <- c(
  MF = "State (MF)", OP = "Corporate (OP)", TR = "Traditional (TR)",
  PA = "Passive (PA)", EN = "Environmentalist (EN)"
)

agg_colors <- c(
  High = "#e41a1c", Random = "#377eb8", state_only = "#4daf4a",
  small_only = "#ff7f00", big_only = "#984ea3"
)
agg_labels <- c(
  High = "Mixed (clustered)", Random = "Mixed (random)",
  state_only = "State only", small_only = "Small private only",
  big_only = "Corporate only"
)

landscape_colors <- c(
  CL02 = "#e41a1c", CL06 = "#ff7f0e", CL07 = "#a65628",
  CL08 = "#377eb8", CL10 = "#2ca02c", CL11 = "#984ea3"
)

sp_palette <- c(
  piab = "#1b7837", fasy = "#a6611a", abal = "#018571", quro = "#dfc27d",
  lade = "#80cdc1", pisy = "#c2a5cf", psme = "#542788", frex = "#e08214",
  acps = "#b2df8a", pini = "#7b3294", qupe = "#bf812d", cabe = "#a6761d",
  Other = "#bdbdbd"
)
conifers <- c("piab", "abal", "lade", "pisy", "pini", "psme", "pice")

pathway_colors <- c(
  resilience    = "#2ca02c",
  reassembly    = "#1f77b4",
  restructuring = "#ff7f0e",
  replacement   = "#d62728",
  regime_shift  = "#7f7f7f"
)

climate_colors <- c(
  historical = "#333333",
  rcp_4_5    = "#f4a582",
  rcp_8_5    = "#ca0020"
)
climate_labels <- c(
  historical = "Historical",
  rcp_4_5    = "RCP 4.5",
  rcp_8_5    = "RCP 8.5"
)

# =============================================================================
# SHARED THEME
# =============================================================================

theme_resilience <- function(base_size = 11) {
  theme_minimal(base_size = base_size) +
    theme(
      legend.position = "bottom",
      strip.text = element_text(face = "bold"),
      panel.grid.minor = element_blank()
    )
}

# =============================================================================
# DATA LOADING
# =============================================================================

#' Load all resilience analysis CSVs from DATA_DIR.
#' Strips "matched_" prefix from aggregation column.
load_resilience_data <- function() {
  clean_agg <- function(x) gsub("^matched_", "", x)

  safe_read <- function(filename) {
    path <- file.path(DATA_DIR, filename)
    if (!file.exists(path) || file.info(path)$size < 10) return(data.frame())
    df <- read.csv(path, stringsAsFactors = FALSE)
    if ("aggregation" %in% names(df)) df$aggregation <- clean_agg(df$aggregation)
    df
  }

  list(
    landscape_metrics = safe_read("landscape_metrics.csv"),
    species_yearly    = safe_read("species_yearly.csv"),
    removal_summary   = safe_read("removal_summary.csv"),
    barkbeetle        = safe_read("barkbeetle_summary.csv"),
    baselines         = safe_read("baselines.csv"),
    baseline_species  = safe_read("baseline_species_vectors.csv"),
    resilience        = safe_read("resilience_summary.csv")
  )
}

# =============================================================================
# HELPERS
# =============================================================================

#' Save a ggplot as PNG to FIG_DIR
save_fig <- function(p, name, width = 12, height = 7, dpi = 300) {
  path <- file.path(FIG_DIR, paste0(name, ".png"))
  ggsave(path, p, width = width, height = height, dpi = dpi)
  cat(sprintf("  Saved: %s\n", path))
}

#' Add owner_group column
add_owner_group <- function(df) {
  df %>% mutate(owner_group = case_when(
    behavioral_type == "MF" ~ "State",
    behavioral_type == "OP" ~ "Corporate",
    behavioral_type %in% c("TR", "PA", "EN") ~ "Small private"
  ))
}
