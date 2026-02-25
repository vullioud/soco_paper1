library(tidyverse)
library(jsonlite)
library(ggplot2)
library(kableExtra)

# ==============================================================================
# 1. EXPORT FUNCTION (Unchanged)
# ==============================================================================
export_trait_json <- function(data, path) {
  dir_path <- dirname(path)
  if (!dir.exists(dir_path)) dir.create(dir_path, recursive = TRUE)

  json_tree <- data %>%
    group_by(type) %>%
    nest() %>%
    mutate(type_list = map(data, function(d) {
      list(
        preferences = list(
          distribution_function = "dirichlet",
          distribution_params = list(
            options = c("Production", "Biodiversity", "CO2"),
            alpha = c(d$pref_prod, d$pref_bio, d$pref_co2)
          )
        ),
        resources = list(
          distribution_function = "beta",
          distribution_params = list(alpha = d$res_alpha, beta = d$res_beta)
        ),
        riskTolerance = list(
          distribution_function = "beta",
          distribution_params = list(alpha = d$risk_alpha, beta = d$risk_beta)
        ),
        adherence = list(
          distribution_function = "beta",
          distribution_params = list(alpha = d$adhere_alpha, beta = d$adhere_beta)
        )
      )
    })) %>%
    select(type, type_list) %>%
    deframe()

  write_json(json_tree, path, auto_unbox = TRUE, pretty = TRUE)
  message(sprintf("✓ Exported Agent Traits JSON to %s", path))
}

# ==============================================================================
# 2. VISUALIZATION: PREFERENCES (Facet by Owner)
# ==============================================================================
sim_dirichlet_traits <- function(alpha_vec, n = 2000) {
  k <- length(alpha_vec)
  draws <- matrix(rgamma(n * k, shape = alpha_vec, scale = 1), nrow = n, byrow = TRUE)
  draws <- draws / rowSums(draws)
  as_tibble(draws, .name_repair = "minimal") %>%
    set_names(c("Production", "Biodiversity", "CO2"))
}

plot_type_preferences <- function(data) {

  sim_df <- data %>%
    rowwise() %>%
    mutate(
      alpha_vec = list(c(pref_prod, pref_bio, pref_co2)),
      sims = list(sim_dirichlet_traits(alpha_vec, n = 2000))
    ) %>%
    select(type, sims) %>%
    unnest(sims) %>%
    pivot_longer(cols = c("Production", "Biodiversity", "CO2"),
                 names_to = "Objective", values_to = "Weight")

  ggplot(sim_df, aes(x = Weight, fill = Objective, color = Objective)) +
    geom_density(alpha = 0.4, size = 0.8) +

    facet_wrap(~type, nrow = 1) +

    scale_x_continuous(labels = scales::percent, limits = c(0, 1), expand = c(0, 0)) +
    scale_y_continuous(expand = expansion(mult = c(0, 0.1))) +
    scale_fill_brewer(palette = "Set1") +
    scale_color_brewer(palette = "Set1") +

    theme_minimal(base_size = 14) +
    theme(
      legend.position = "top",
      panel.grid.minor = element_blank(),
      axis.text.y = element_blank(),
      axis.ticks.y = element_blank(),
      strip.text = element_text(face = "bold", size = 12)
    ) +
    labs(title = "Agent Preference Profiles",
         subtitle = "Density of objective weights per Behavioral Type",
         x = "Weight assigned to Objective",
         y = "Density")
}

# ==============================================================================
# 3. TABLE GENERATOR (Raw Alphas + Precision)
# ==============================================================================
generate_trait_table <- function(data) {
  data %>%
    rowwise() %>%
    mutate(Precision = pref_prod + pref_bio + pref_co2) %>%
    ungroup() %>%
    select(
      `Behavioral Type` = type,
      Production = pref_prod,
      Biodiversity = pref_bio,
      CO2 = pref_co2,
      Precision
    ) %>%
    kbl(caption = "Table: Agent Preference Alphas (Dirichlet) by Behavioral Type") %>%
    kable_styling(full_width = F, bootstrap_options = c("striped", "hover", "condensed")) %>%
    column_spec(1, bold = TRUE) %>%
    column_spec(5, bold = TRUE, border_left = TRUE, background = "#f9f9f9")
}