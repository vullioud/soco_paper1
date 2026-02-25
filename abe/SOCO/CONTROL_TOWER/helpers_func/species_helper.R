library(tidyverse)
library(jsonlite)
library(ggplot2)
library(kableExtra)

# ==============================================================================
# 1. EXPORT FUNCTION (Unchanged)
# ==============================================================================
export_species_json <- function(data, path) {
  dir_path <- dirname(path)
  if (!dir.exists(dir_path)) dir.create(dir_path, recursive = TRUE)
  
  strategies <- c("indiscriminate", "standardizer", "resilience", "ecologist", "experimenter")
  
  json_tree <- data %>%
    group_by(owner) %>%
    nest() %>%
    mutate(dist_obj = map(data, function(d) {
      list(
        distribution_function = "dirichlet",
        distribution_params = list(
          options = strategies,
          alpha = as.numeric(d[strategies])
        )
      )
    })) %>%
    select(owner, dist_obj) %>%
    deframe()
  
  write_json(json_tree, path, auto_unbox = TRUE, pretty = TRUE)
  message(sprintf("✓ Exported Species Config JSON to %s", path))
}

# ==============================================================================
# 2. VISUALIZATION FUNCTION (Facet by Owner)
# ==============================================================================
sim_dirichlet_species <- function(alpha_vec, n = 2000) {
  k <- length(alpha_vec)
  draws <- matrix(rgamma(n * k, shape = alpha_vec, scale = 1), nrow = n, byrow = TRUE)
  draws <- draws / rowSums(draws)
  strategies <- c("Indiscriminate", "Standardizer", "Resilience", "Ecologist", "Experimenter")
  as_tibble(draws, .name_repair = "minimal") %>% set_names(strategies)
}

plot_species_strategies <- function(data) {
  
  strategies <- c("indiscriminate", "standardizer", "resilience", "ecologist", "experimenter")
  
  sim_df <- data %>%
    rowwise() %>%
    mutate(
      alpha_vec = list(c_across(all_of(strategies))),
      sims = list(sim_dirichlet_species(alpha_vec, n = 2000))
    ) %>%
    select(owner, sims) %>%
    unnest(sims) %>%
    pivot_longer(cols = -owner, names_to = "Strategy", values_to = "Probability") %>%
    mutate(owner = str_to_title(owner))
  
  # CHANGED: Facet by Owner, Fill by Strategy
  ggplot(sim_df, aes(x = Probability, fill = Strategy, color = Strategy)) +
    geom_density(alpha = 0.4, size = 0.8) +
    
    facet_wrap(~owner, nrow = 1) +
    
    scale_x_continuous(labels = scales::percent, limits = c(0, 1), expand = c(0, 0)) +
    scale_y_continuous(expand = expansion(mult = c(0, 0.1))) +
    scale_fill_brewer(palette = "Set2") +
    scale_color_brewer(palette = "Set2") +
    
    theme_minimal(base_size = 14) +
    theme(
      legend.position = "top",
      panel.grid.minor = element_blank(),
      axis.text.y = element_blank(),
      axis.ticks.y = element_blank(),
      strip.text = element_text(face = "bold", size = 12)
    ) +
    labs(title = "Species Strategy Allocation",
         subtitle = "Probability density of selecting a strategy per Owner Type",
         x = "Probability", y = "Density")
}

# ==============================================================================
# 3. TABLE GENERATOR (Raw Alphas + Precision)
# ==============================================================================
generate_species_table <- function(data) {
  strategies <- c("indiscriminate", "standardizer", "resilience", "ecologist", "experimenter")
  
  data %>%
    mutate(owner = str_to_title(owner)) %>%
    # Calculate Precision
    rowwise() %>%
    mutate(Precision = sum(c_across(all_of(strategies)))) %>%
    ungroup() %>%
    select(
      `Owner Type` = owner, 
      all_of(strategies), 
      Precision
    ) %>%
    kbl(caption = "Table 10: Species Strategy Alphas") %>%
    kable_styling(full_width = F, bootstrap_options = c("striped", "hover", "condensed")) %>%
    column_spec(1, bold = TRUE) %>%
    # Highlight Precision (last column)
    column_spec(length(strategies) + 2, bold = TRUE, border_left = TRUE, background = "#f9f9f9")
}