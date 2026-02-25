library(tidyverse)
library(jsonlite)
library(ggplot2)

# ==============================================================================
# 1. CORE CALCULATION LOGIC (Gamma Mixture)
# ==============================================================================
calculate_age_probabilities <- function(params, age_max = 250) {
  
  # Prepare stages dataframe
  stages <- params %>%
    mutate(shape = (mean / sd)^2,
           scale = (sd^2) / mean)
  
  age_seq <- seq(0, age_max, by = 1)
  
  # Compute Gamma PDFs for each stage
  pdfs <- sapply(1:nrow(stages), function(i) {
    dgamma(age_seq, shape = stages$shape[i], scale = stages$scale[i])
  })
  
  # Normalize rows to sum to 1 (Mixture Probabilities)
  # Handle division by zero if all PDFs are effectively 0 (unlikely with Gamma)
  row_sums <- rowSums(pdfs)
  probs <- pdfs / ifelse(row_sums == 0, 1, row_sums)
  
  # Convert to Tidy Tibble
  probs_df <- as_tibble(probs, .name_repair = "minimal")
  colnames(probs_df) <- stages$stage
  
  result <- probs_df %>%
    mutate(age = age_seq) %>%
    select(age, everything()) %>%
    # Rounding for cleaner JSON/Display
    mutate(across(-age, ~ round(., 4)))
  
  # Fix Age 0 edge case (copy Age 1 probabilities)
  result[1, -1] <- result[2, -1]
  
  return(result)
}

# ==============================================================================
# 2. EXPORT FUNCTION
# ==============================================================================
export_age_json <- function(data, path) {
  dir_path <- dirname(path)
  if (!dir.exists(dir_path)) dir.create(dir_path, recursive = TRUE)
  
  # Wrap in "all" key as expected by the JS model
  # The data is already an array of objects (tibble), so no extra processing needed
  final_output <- list(all = data)
  
  write_json(final_output, path, auto_unbox = TRUE, pretty = TRUE)
  message(sprintf("✓ Exported Age Class JSON to %s", path))
}

# ==============================================================================
# 3. VISUALIZATION FUNCTION (GGPlot)
# ==============================================================================
plot_age_classes <- function(data) {
  
  long_df <- data %>%
    pivot_longer(cols = -age, names_to = "Stage", values_to = "Probability") %>%
    mutate(Stage = factor(Stage, levels = c("Planting", "Tending", "Thinning", "Harvesting")))
  
  ggplot(long_df, aes(x = age, y = Probability, color = Stage, fill = Stage)) +
    geom_area(alpha = 0.4, position = "identity") + # Area plot shows overlaps well
    geom_line(size = 1) +
    
    scale_color_manual(values = c("Planting" = "forestgreen", 
                                  "Tending" = "goldenrod", 
                                  "Thinning" = "steelblue", 
                                  "Harvesting" = "firebrick")) +
    scale_fill_manual(values = c("Planting" = "forestgreen", 
                                 "Tending" = "goldenrod", 
                                 "Thinning" = "steelblue", 
                                 "Harvesting" = "firebrick")) +
    
    labs(title = "Probabilistic Development Phases",
         subtitle = "Gamma Mixture Model classification by Stand Age",
         x = "Stand Age (Years)",
         y = "Probability of Classification") +
    
    theme_minimal(base_size = 14) +
    theme(legend.position = "top")
}