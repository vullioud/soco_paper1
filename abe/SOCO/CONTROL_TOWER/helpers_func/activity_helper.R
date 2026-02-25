
export_activity_json <- function(data, path = file.path("ODDSTUFF", "created_json_tables", "activity_distributions.json")) {
  
  # 1. Check if the directory exists, if not, create it
  dir_path <- dirname(path)
  if (!dir.exists(dir_path)) {
    dir.create(dir_path, recursive = TRUE)
    message(sprintf("Created directory: %s", dir_path))
  }
  
  # 2. Transform Data Structure
  json_tree <- data %>%
    # A. Parse the "1, 2, 3" string into numeric vector c(1, 2, 3)
    mutate(alpha_vec = map(vector_str, ~ as.numeric(str_split(.x, ",")[[1]]))) %>%
    
    # B. Nest data to process each row individually
    group_by(owner, phase, pref, struct) %>%
    nest() %>%
    
    # C. Create the specific object structure JS expects:
    #    JS: const dist_params = context_params_array[0];
    #    So we need an array (list) containing one object { options, alpha }
    mutate(dist_obj = pmap(list(phase, data), function(p, d) {
      list(
        distribution_params = list(
          list(
            options = act_orders[[p]],
            alpha = d$alpha_vec[[1]]
          )
        )
      )
    })) %>%
    select(-data) %>%
    
    # D. Reconstruct Hierarchy: Owner -> Phase -> Preference -> Structure
    group_by(owner, phase, pref) %>%
    summarise(struct_map = list(deframe(tibble(struct, dist_obj))), .groups="drop") %>%
    
    group_by(owner, phase) %>%
    summarise(pref_map = list(deframe(tibble(pref, struct_map))), .groups="drop") %>%
    
    group_by(owner) %>%
    summarise(phase_map = list(deframe(tibble(phase, pref_map))), .groups="drop") %>%
    
    deframe()
  
  # 3. Write File
  write_json(json_tree, path, auto_unbox = TRUE, pretty = TRUE)
  message(sprintf("✓ Exported JSON to %s", path))
}




################################################################################

generate_odd_table <- function(data, selected_phase, caption) {
  
  # Calculate expected probabilities (Alpha / Sum(Alpha))
  viz_data <- data %>%
    filter(phase == selected_phase) %>%
    mutate(alpha_vec = map(vector_str, ~ as.numeric(str_split(.x, ",")[[1]]))) %>%
    mutate(probs = map(alpha_vec, ~ .x / sum(.x))) %>%
    unnest_wider(probs, names_sep = "_")
  
  # Rename columns based on the activity order
  act_names <- act_orders[[selected_phase]]
  names(viz_data)[grep("probs_", names(viz_data))] <- act_names
  
  # Create a clean table
  # We group by Owner/Pref and show Structure logic if it varies, 
  # or collapse if "high/medium/low" are identical (for cleaner docs)
  
  viz_data %>%
    select(owner, pref, struct, all_of(act_names)) %>%
    arrange(owner, pref, struct) %>%
    kbl(caption = caption, digits = 2) %>%
    kable_styling(bootstrap_options = c("striped", "hover", "condensed"), font_size = 11) %>%
    collapse_rows(columns = 1:2, valign = "top")
}






# ==================================================================
# ODD TABLE GENERATOR: RAW ALPHAS (Fixed Order)
# ==============================================================================
library(kableExtra)
library(tidyr)
library(dplyr)
library(stringr)

generate_alpha_table <- function(data, selected_phase, caption) {
  
  # 1. Get Column Names for this phase
  act_names <- act_orders[[selected_phase]]
  
  # 2. Prepare Data
  viz_data <- data %>%
    filter(phase == selected_phase) %>%
    # Split the string "1, 5, 0" into distinct numeric columns
    separate(vector_str, into = act_names, sep = ",", convert = TRUE) %>%
    # Calculate Sum (Alpha_0) to show Precision
    rowwise() %>%
    mutate(Precision = sum(c_across(all_of(act_names)))) %>%
    ungroup() %>%
    # Select and Clean
    select(owner, pref, struct, all_of(act_names), Precision) %>%
    mutate(owner = str_to_title(owner))
  
  # 3. Create Table
  viz_data %>%
    kbl(caption = caption, align = "c") %>%
    
    # Styling
    kable_styling(bootstrap_options = c("striped", "hover", "condensed", "responsive"), 
                  font_size = 12, 
                  full_width = F) %>%
    
    # Header Styling
    add_header_above(c(" " = 3, "Activity Alphas (Weights)" = length(act_names), " " = 1)) %>%
    
    # --- FIX: Apply Column Spec BEFORE collapsing rows ---
    # Highlight the Precision column (last column)
    column_spec(ncol(viz_data), bold = TRUE, border_left = TRUE, background = "#f9f9f9") %>%
    
    # Grouping Rows (Must be last)
    collapse_rows(columns = 1:2, valign = "top")
}




###############################################################################
###############################################################################
###############################################################################

library(tidyverse)
library(ggplot2)

# (Keep the robust simulate_dirichlet function from before)
simulate_dirichlet <- function(alpha_vec, n = 2000) { # Increased N for smoother curves
  k <- length(alpha_vec)
  draws <- matrix(rgamma(n * k, shape = alpha_vec, scale = 1), nrow = n, byrow = TRUE)
  draws <- draws / rowSums(draws)
  df <- as.data.frame(draws)
  colnames(df) <- paste0("V", 1:k)
  return(as_tibble(df))
}

plot_activity_density <- function(data, 
                                  selected_phase, 
                                  filter_owner = NULL, 
                                  filter_pref = NULL, 
                                  filter_struct = NULL,
                                  n_sims = 2000) {
  
  # 1. PREPARE DATA
  act_names <- act_orders[[selected_phase]]
  
  plot_data <- data %>%
    filter(phase == selected_phase)
  
  if (!is.null(filter_owner))  plot_data <- plot_data %>% filter(owner %in% filter_owner)
  if (!is.null(filter_pref))   plot_data <- plot_data %>% filter(pref %in% filter_pref)
  if (!is.null(filter_struct)) plot_data <- plot_data %>% filter(struct %in% filter_struct)
  
  if (nrow(plot_data) == 0) stop("No data found for the selected filters.")
  
  simulated_df <- plot_data %>%
    mutate(alpha_vec = map(vector_str, ~ as.numeric(str_split(.x, ",")[[1]]))) %>%
    mutate(sims = map(alpha_vec, ~ simulate_dirichlet(.x, n = n_sims))) %>%
    select(owner, pref, struct, sims) %>%
    unnest(sims) 
  
  # Rename V1...Vk to Activity names
  col_indices <- 4:(3 + length(act_names))
  colnames(simulated_df)[col_indices] <- act_names
  
  long_df <- simulated_df %>%
    pivot_longer(cols = all_of(act_names), names_to = "Activity", values_to = "Probability")
  
  # 2. PLOTTING
  # ---------------------------------------------------------
  title_str <- paste0("Decision Uncertainty: ", str_to_title(selected_phase))
  
  g <- ggplot(long_df, aes(x = Probability, fill = owner, color = owner)) +
    
    # DENSITY PLOT
    # alpha = transparency allows seeing overlaps
    geom_density(alpha = 0.4, size = 0.8) +
    
    scale_x_continuous(limits = c(0, 1), labels = scales::percent, expand = c(0, 0)) +
    scale_y_continuous(expand = expansion(mult = c(0, 0.1))) + # Give top some room
    scale_fill_brewer(palette = "Set2") +
    scale_color_brewer(palette = "Set2") +
    
    theme_minimal(base_size = 14) +
    theme(
      axis.text.y = element_blank(), # Density values aren't usually meaningful to readers
      axis.ticks.y = element_blank(),
      panel.grid.minor = element_blank(),
      panel.grid.major.y = element_blank(),
      strip.text = element_text(face = "bold", size = 12),
      legend.position = "top"
    ) +
    labs(title = title_str, 
         subtitle = paste0("Probability distributions for ", paste(filter_pref, collapse="/"), " - ", paste(filter_struct, collapse="/")),
         x = "Probability of Selection", 
         y = "Density (Likelihood)")
  
  
  
  
  # 3. FACETING STRATEGY
  # ---------------------------------------------------------
  # We ALWAYS facet by Activity to separate the curves.
  # We add secondary facets based on what varies (Pref or Struct).
  
  facets <- "Activity" # Primary facet
  
  # If we have multiple preferences, add them to rows
  if (is.null(filter_pref) || length(unique(long_df$pref)) > 1) {
    g <- g + facet_grid(pref ~ Activity, scales = "free_y")
  } 
  # If we have multiple structures, add them to rows
  else if (is.null(filter_struct) || length(unique(long_df$struct)) > 1) {
    g <- g + facet_grid(struct ~ Activity, scales = "free_y")
  } 
  # Default: Just wrap by Activity
  else {
    g <- g + facet_wrap(~ Activity, scales = "free_y", nrow = 1)
  }
  
  return(g)
}



