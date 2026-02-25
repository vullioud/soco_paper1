# Paper 1: Activity helper functions (flat type -> phase -> {options, alpha})

library(tidyverse)
library(jsonlite)
library(kableExtra)

# ==============================================================================
# 1. EXPORT FUNCTION — Flat hierarchy: type -> phase -> {options, alpha}
# ==============================================================================
export_activity_json <- function(data, path) {
  dir_path <- dirname(path)
  if (!dir.exists(dir_path)) dir.create(dir_path, recursive = TRUE)

  json_tree <- list()
  for (i in seq_len(nrow(data))) {
    row <- data[i, ]
    type <- row$type
    phase <- row$phase
    if (is.null(json_tree[[type]])) json_tree[[type]] <- list()
    json_tree[[type]][[phase]] <- list(
      options = row$options[[1]],
      alpha = row$alpha[[1]]
    )
  }

  write_json(json_tree, path, auto_unbox = TRUE, pretty = TRUE)
  message(sprintf("Exported activity distributions to %s", path))
}

# ==============================================================================
# 2. TABLE GENERATOR: Expected probabilities by type and phase
# ==============================================================================
generate_activity_table <- function(data, selected_phase, caption) {
  viz_data <- data %>%
    filter(phase == selected_phase) %>%
    rowwise() %>%
    mutate(
      probs = list(alpha / sum(alpha)),
      act_names = list(options)
    ) %>%
    ungroup()

  act_names <- viz_data$act_names[[1]]
  prob_mat <- do.call(rbind, viz_data$probs)
  colnames(prob_mat) <- act_names

  bind_cols(select(viz_data, type), as_tibble(prob_mat)) %>%
    kbl(caption = caption, digits = 2) %>%
    kable_styling(bootstrap_options = c("striped", "hover", "condensed"), font_size = 11)
}

# ==============================================================================
# 3. DENSITY PLOT: Dirichlet simulation by type
# ==============================================================================
simulate_dirichlet <- function(alpha_vec, n = 2000) {
  k <- length(alpha_vec)
  draws <- matrix(rgamma(n * k, shape = alpha_vec, scale = 1), nrow = n, byrow = TRUE)
  draws <- draws / rowSums(draws)
  as_tibble(draws, .name_repair = "minimal")
}

plot_activity_density <- function(data, selected_phase, n_sims = 2000) {
  plot_data <- data %>% filter(phase == selected_phase)
  if (nrow(plot_data) == 0) stop("No data for selected phase.")

  act_names <- plot_data$options[[1]]

  simulated_df <- plot_data %>%
    rowwise() %>%
    mutate(sims = list(simulate_dirichlet(alpha, n = n_sims))) %>%
    select(type, sims) %>%
    unnest(sims)

  col_indices <- 2:(1 + length(act_names))
  colnames(simulated_df)[col_indices] <- act_names

  long_df <- simulated_df %>%
    pivot_longer(cols = all_of(act_names), names_to = "Activity", values_to = "Probability")

  ggplot(long_df, aes(x = Probability, fill = type, color = type)) +
    geom_density(alpha = 0.4, size = 0.8) +
    facet_wrap(~ Activity, scales = "free_y", nrow = 1) +
    scale_x_continuous(limits = c(0, 1), labels = scales::percent, expand = c(0, 0)) +
    scale_y_continuous(expand = expansion(mult = c(0, 0.1))) +
    scale_fill_brewer(palette = "Set2") +
    scale_color_brewer(palette = "Set2") +
    theme_minimal(base_size = 14) +
    theme(
      axis.text.y = element_blank(),
      axis.ticks.y = element_blank(),
      panel.grid.minor = element_blank(),
      strip.text = element_text(face = "bold", size = 12),
      legend.position = "top"
    ) +
    labs(
      title = paste0("Activity Distributions: ", selected_phase),
      subtitle = "Dirichlet draws by Behavioral Type",
      x = "Selection Probability",
      y = "Density"
    )
}
