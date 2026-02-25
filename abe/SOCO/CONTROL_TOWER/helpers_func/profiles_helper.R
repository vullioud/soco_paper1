library(tidyverse)
library(jsonlite)
library(ggplot2)
library(kableExtra)

# ==============================================================================
# 1. EXPORT FUNCTION
# ==============================================================================
export_profile_json <- function(data, key_col, value_col, path) {
  dir_path <- dirname(path)
  if (!dir.exists(dir_path)) dir.create(dir_path, recursive = TRUE)
  
  json_tree <- data %>%
    group_by(profile_name) %>%
    # Use as.list() to force JSON Object output {"species": val}
    summarise(map = list(as.list(deframe(tibble(!!sym(key_col), !!sym(value_col))))), .groups="drop") %>%
    deframe()
  
  # Wrap in "all" for the agent loader
  final_output <- list(all = json_tree)
  
  write_json(final_output, path, auto_unbox = TRUE, pretty = TRUE)
  message(sprintf("✓ Exported Profile JSON to %s", path))
}

# ==============================================================================
# 2. PLOTS & TABLES (Visualization)
# ==============================================================================

# --- A. TARGET DBH ---
plot_target_dbh <- function(data) {
  ggplot(data, aes(x = species, y = dbh_threshold, fill = profile_name)) +
    geom_col(position = position_dodge(width = 0.8), width = 0.7) +
    coord_flip() +
    scale_fill_brewer(palette = "Set2") +
    labs(title = "Target DBH Thresholds", x = NULL, y = "DBH (cm)") +
    theme_minimal(base_size = 14) +
    theme(legend.position = "top", panel.grid.major.y = element_blank())
}

generate_target_dbh_table <- function(data) {
  data %>%
    pivot_wider(names_from = profile_name, values_from = dbh_threshold) %>%
    kbl(caption = "Target DBH Profiles") %>%
    kable_styling(bootstrap_options = c("striped", "condensed"), full_width = F)
}

# --- B. PLENTER ---
plot_plenter_curves <- function(data) {
  # Convert DBH class string to numeric for plotting
  plot_data <- data %>%
    mutate(dbh = as.numeric(dbh_class))
  
  ggplot(plot_data, aes(x = dbh, y = stem_count, color = profile_name)) +
    geom_line(size = 1.2) +
    geom_point(size = 2) +
    scale_color_brewer(palette = "Dark2") +
    labs(title = "Plenter Equilibrium Curves", x = "DBH Class (cm)", y = "N/ha") +
    theme_minimal(base_size = 14) +
    theme(legend.position = "top")
}

generate_plenter_table <- function(data) {
  data %>%
    mutate(dbh_num = as.numeric(dbh_class)) %>%
    arrange(dbh_num) %>%
    select(-dbh_num) %>%
    pivot_wider(names_from = profile_name, values_from = stem_count) %>%
    kbl(caption = "Plenter Target Curves (N/ha)") %>%
    kable_styling(bootstrap_options = c("striped", "condensed"), full_width = F)
}