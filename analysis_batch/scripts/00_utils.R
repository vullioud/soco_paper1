# =============================================================================
# Shared utilities for SoCoABE batch analysis
#
# Source this file at the top of every analysis script:
#   source("analysis_batch/scripts/00_utils.R")
# =============================================================================

library(ggplot2)
library(dplyr)
library(tidyr)
library(patchwork)
library(scales)

# --- Paths ---
DATA_DIR <- "analysis_batch/data"
FIG_DIR  <- "analysis_batch/co_author_report/figures"
dir.create(FIG_DIR, showWarnings = FALSE, recursive = TRUE)

# --- Simulation scope ---
MAX_YEAR <- 200  # truncate data to this year for consistency

# =============================================================================
# PALETTES
# =============================================================================

# Behavioral types (5 agent archetypes)
btype_palette <- c(
  MF = "#377eb8",   # State (blue)
  OP = "#e41a1c",   # Corporate (red)
  TR = "#4daf4a",   # Traditional (green)
  PA = "#ff7f00",   # Passive (orange)
  EN = "#984ea3"    # Environmentalist (purple)
)
btype_labels <- c(
  MF = "State (MF)",
  OP = "Corporate (OP)",
  TR = "Traditional (TR)",
  PA = "Passive (PA)",
  EN = "Environmentalist (EN)"
)

# Ownership aggregations
agg_colors <- c(
  High       = "#e41a1c",
  Random     = "#377eb8",
  state_only = "#4daf4a",
  small_only = "#ff7f00",
  big_only   = "#984ea3"
)
agg_labels <- c(
  High       = "Mixed (clustered)",
  Random     = "Mixed (random)",
  state_only = "State only",
  small_only = "Small private only",
  big_only   = "Corporate only"
)

# Landscapes
landscape_colors <- c(CL05 = "#e41a1c", CL10 = "#377eb8", CL14 = "#4daf4a")

# Disturbance scenarios
dist_colors <- c(contbb = "#d62728", bb = "#ff7f0e", nod = "#2ca02c")
dist_labels <- c(contbb = "Constant moderate BB", bb = "BB spike yr100", nod = "No disturbance")

# Species
sp_palette <- c(
  piab = "#1b7837", fasy = "#a6611a", abal = "#018571", quro = "#dfc27d",
  lade = "#80cdc1", pisy = "#c2a5cf", psme = "#542788", frex = "#e08214",
  acps = "#b2df8a", pini = "#7b3294", qupe = "#bf812d", poni = "#e7298a",
  potr = "#66a61e", cabe = "#a6761d", Other = "#bdbdbd"
)
species_labels <- c(
  piab = "Norway spruce", fasy = "European beech", abal = "Silver fir",
  quro = "Sessile oak",   lade = "Larch",          pisy = "Scots pine",
  psme = "Douglas fir",   frex = "Ash",            acps = "Sycamore maple",
  pini = "Weymouth pine", qupe = "Pedunculate oak",poni = "Black pine",
  potr = "Aspen",         cabe = "Hornbeam"
)
conifers <- c("piab", "abal", "lade", "pisy", "pini", "psme", "pice")

# Structural phases
phase_colors <- c(
  Planting   = "#e41a1c",
  Tending    = "#ff7f00",
  Thinning   = "#4daf4a",
  Harvesting = "#377eb8"
)

# Planning status colors (decade planning diagnostics)
status_colors <- c(
  committed  = "#2ca02c",
  ongoing    = "#1f77b4",
  blocked    = "#ff9896",
  deferred   = "#d62728",
  set_aside  = "#8c564b",
  idle       = "#cccccc"
)

# Activity colors (management activities)
activity_colors <- c(
  planting               = "#2ca02c",
  tending                = "#98df8a",
  selectiveThinning      = "#1f77b4",
  thinningFromBelow      = "#aec7e8",
  fromBelow              = "#aec7e8",
  shelterwood            = "#ff7f0e",
  shelterwood_planting   = "#ffbb78",
  shelterwood_no_planting = "#c49c04",
  targetDBH              = "#d62728",
  clearcut               = "#8c564b",
  clearcut_planting      = "#c49c94",
  femel                  = "#e377c2",
  femel_planting         = "#f7b6d2",
  femel_no_planting      = "#c5b0d5",
  plenter_harvest        = "#9467bd",
  plenter_thinning       = "#17becf",
  noManagement           = "#cccccc",
  none                   = "#f0f0f0",
  salvage                = "#bcbd22",
  salvage_clearcut       = "#8c6d31"
)

# Owner groups (pooled behavioral types → ownership categories)
owner_group_colors <- c(
  State            = "#377eb8",
  Corporate        = "#e41a1c",
  "Small private"  = "#ff7f00"
)
owner_group_labels <- c(
  State            = "State (MF)",
  Corporate        = "Corporate (OP)",
  "Small private"  = "Small priv. (TR+PA+EN)"
)

# Replicate colors
rep_colors <- c("1" = "#e41a1c", "2" = "#377eb8", "3" = "#4daf4a")

# =============================================================================
# SHARED THEME
# =============================================================================

theme_soco <- function(base_size = 11) {
  theme_minimal(base_size = base_size) +
    theme(legend.position = "bottom",
          strip.text = element_text(face = "bold"))
}

# =============================================================================
# DATA LOADING
# =============================================================================

#' Read soco_ml_activities (uses pre-cleaned CSV without JSON columns)
read_ml_activities <- function() {
  path <- file.path(DATA_DIR, "soco_ml_activities_clean.csv")
  if (!file.exists(path) || file.info(path)$size < 10) return(data.frame())
  df <- read.csv(path, stringsAsFactors = FALSE)
  clean_agg <- function(x) gsub("^matched_", "", x)
  if ("aggregation" %in% names(df)) df$aggregation <- clean_agg(df$aggregation)
  if ("year" %in% names(df)) df <- df[df$year <= MAX_YEAR, ]
  df
}

#' Load all analysis CSVs from DATA_DIR.
#' Strips "matched_" prefix from aggregation column.
#' Returns a named list of data frames.
load_all_data <- function() {
  clean_agg <- function(x) gsub("^matched_", "", x)

  safe_read <- function(filename, ...) {
    path <- file.path(DATA_DIR, filename)
    if (!file.exists(path) || file.info(path)$size < 10) return(data.frame())
    df <- tryCatch(
      read.csv(path, stringsAsFactors = FALSE, ...),
      error = function(e) {
        # Fallback: read with fill=TRUE for CSVs with embedded commas in JSON fields
        read.csv(path, stringsAsFactors = FALSE, fill = TRUE, ...)
      }
    )
    if ("aggregation" %in% names(df)) df$aggregation <- clean_agg(df$aggregation)
    if ("year" %in% names(df)) df <- df[df$year <= MAX_YEAR, ]
    df
  }

  list(
    stand_vol  = safe_read("stand_volume.csv"),
    sp_land    = safe_read("species_by_year.csv"),
    sp_type    = safe_read("species_by_year_type.csv"),
    bb         = safe_read("barkbeetle_yearly.csv"),
    removal    = safe_read("removal.csv"),
    shannon    = safe_read("stand_shannon.csv"),
    sp_gini    = safe_read("stand_species_gini.csv"),
    land_div   = safe_read("landscape_diversity.csv"),
    soco_state = safe_read("soco_stand_state.csv"),
    ml_activities = read_ml_activities(),
    decade_snap   = safe_read("soco_decade_snapshot.csv"),
    decade_budget = safe_read("soco_decade_budget.csv")
  )
}

# =============================================================================
# HELPERS
# =============================================================================

#' Sample stands stratified by behavioral type
sample_stands <- function(data, n_per_type = 8, seed = 42) {
  set.seed(seed)
  data %>%
    distinct(stand_id, behavioral_type) %>%
    group_by(behavioral_type) %>%
    slice_sample(n = n_per_type) %>%
    ungroup() %>%
    pull(stand_id)
}

#' Compute decade_step per agent (normalize offset planning years)
add_decade_step <- function(snap) {
  agent_years <- snap %>%
    distinct(agent_id, year) %>%
    arrange(agent_id, year) %>%
    group_by(agent_id) %>%
    mutate(decade_step = row_number()) %>%
    ungroup()
  left_join(snap, agent_years, by = c("agent_id", "year"))
}

#' Select top N species by total basal area, return ordered vector with "Other"
get_top_species <- function(sp_data, n = 6) {
  top <- sp_data %>%
    group_by(species) %>%
    summarise(total_ba = sum(total_ba, na.rm = TRUE), .groups = "drop") %>%
    arrange(desc(total_ba)) %>%
    slice_head(n = n) %>%
    pull(species)
  c(top, "Other")
}

#' Save a ggplot as PNG to FIG_DIR
save_fig <- function(p, name, width = 12, height = 7, dpi = 300) {
  path <- file.path(FIG_DIR, paste0(name, ".png"))
  ggsave(path, p, width = width, height = height, dpi = dpi)
  cat(sprintf("  Saved: %s\n", path))
}

#' Add owner_group column (MF→State, OP→Corporate, TR/PA/EN→Small private)
add_owner_group <- function(df) {
  df %>% mutate(owner_group = case_when(
    behavioral_type == "MF" ~ "State",
    behavioral_type == "OP" ~ "Corporate",
    behavioral_type %in% c("TR", "PA", "EN") ~ "Small private"
  ))
}

#' Filter data to a single OAT arm
oat_arm_filter <- function(df, arm) {
  switch(arm,
    aggregation = df %>% filter(landscape == "CL10", disturbance == "contbb"),
    landscape   = df %>% filter(aggregation == "High", disturbance == "contbb"),
    disturbance = df %>% filter(landscape == "CL10", aggregation == "High"),
    replicate   = df %>% filter(landscape == "CL10", aggregation == "High",
                                 disturbance == "contbb")
  )
}

#' OAT arm labels for plot titles
oat_arm_titles <- c(
  aggregation = "Aggregation arm (CL10, contbb)",
  landscape   = "Landscape arm (High, contbb)",
  disturbance = "Disturbance arm (CL10, High)",
  replicate   = "Replicate arm (CL10, High, contbb)"
)

#' Build a 4-row OAT quad from a plot-building function.
#' plot_fn(data, var, pal, lab, ...) should return a ggplot.
#'   var  = column name to map to color/facet (string)
#'   pal  = named color vector
#'   lab  = named label vector (optional, NULL for no relabelling)
build_oat_quad <- function(plot_fn, data, title = "", ...) {
  arms <- c("aggregation", "landscape", "disturbance", "replicate")
  pals <- list(agg_colors, landscape_colors, dist_colors, rep_colors)
  labs <- list(agg_labels, NULL, dist_labels, NULL)
  vars <- c("aggregation", "landscape", "disturbance", "replicate")

  plots <- lapply(seq_along(arms), function(i) {
    d <- oat_arm_filter(data, arms[i])
    if (arms[i] == "replicate") d$replicate <- factor(d$replicate)
    plot_fn(d, var = vars[i], pal = pals[[i]], lab = labs[[i]], ...) +
      ggtitle(oat_arm_titles[arms[i]])
  })

  wrap_plots(plots, ncol = 1) +
    plot_annotation(title = title) &
    theme(legend.position = "bottom")
}

#' Print dataset summary
print_data_summary <- function(d) {
  cat(sprintf("  stand_vol:  %d rows\n", nrow(d$stand_vol)))
  cat(sprintf("  sp_land:    %d rows\n", nrow(d$sp_land)))
  cat(sprintf("  removal:    %d rows\n", nrow(d$removal)))
  cat(sprintf("  soco_state: %d rows\n", nrow(d$soco_state)))
  cat(sprintf("  decade_snap: %d rows\n", nrow(d$decade_snap)))
  cat(sprintf("  ml_activities: %d rows\n", nrow(d$ml_activities)))
  cat(sprintf("  decade_budget: %d rows\n", nrow(d$decade_budget)))
  if (nrow(d$stand_vol) > 0) {
    cat(sprintf("  Landscapes:    %s\n", paste(sort(unique(d$stand_vol$landscape)), collapse = ", ")))
    cat(sprintf("  Aggregations:  %s\n", paste(sort(unique(d$stand_vol$aggregation)), collapse = ", ")))
    if ("disturbance" %in% names(d$stand_vol))
      cat(sprintf("  Disturbances:  %s\n", paste(sort(unique(d$stand_vol$disturbance)), collapse = ", ")))
  }
}
