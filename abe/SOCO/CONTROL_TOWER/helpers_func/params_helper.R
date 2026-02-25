library(tidyverse)
library(jsonlite)
library(kableExtra)

# ==============================================================================
# 1. EXPORT FUNCTION (Fixed Array Wrapper & "all" Key)
# ==============================================================================
export_params_json <- function(data, path) {
  
  # Ensure directory exists
  dir_path <- dirname(path)
  if (!dir.exists(dir_path)) dir.create(dir_path, recursive = TRUE)
  
  # Process Data
  json_tree <- data %>%
    mutate(distribution_params = pmap(list(func, mean, sd, lambda, alpha, beta, shape, scale, profile), 
                                      function(f, m, s, l, a, b, sh, sc, prof) {
                                        
                                        # Logic: Return a LIST containing a LIST to force JSON Array format [ { ... } ]
                                        # This matches the "working" version structure.
                                        
                                        if (is.na(f)) return(list())
                                        
                                        if (f == "normal")  return(list(list(mean = m, sd = s)))
                                        if (f == "poisson") return(list(list(lambda = l)))
                                        if (f == "beta")    return(list(list(alpha = a, beta = b)))
                                        if (f == "gamma")   return(list(list(shape = sh, scale = sc)))
                                        if (f == "lookup")  return(list(list(profile_name = prof)))
                                        
                                        return(list()) # Fallback
                                      })) %>%
    
    # Create the object structure
    mutate(final_obj = map2(func, distribution_params, ~ list(
      distribution_function = .x,
      distribution_params = .y
    ))) %>%
    
    # Nesting Hierarchy: Activity -> Preference -> ParamName
    select(activity, param_name, pref, final_obj) %>%
    
    group_by(activity, pref) %>%
    summarise(param_map = list(deframe(tibble(param_name, final_obj))), .groups="drop") %>%
    
    group_by(activity) %>%
    summarise(pref_map = list(deframe(tibble(pref, param_map))), .groups="drop") %>%
    
    deframe()
  
  # CRITICAL FIX: Wrap everything in the "all" key
  final_output <- list(all = json_tree)
  
  write_json(final_output, path, auto_unbox = TRUE, pretty = TRUE)
  message(sprintf("✓ Exported Params JSON to %s", path))
}

# ==============================================================================
# 2. VISUALIZATION FUNCTION (Unchanged)
# ==============================================================================
generate_params_table <- function(data, caption = "Parameter Distributions") {
  
  formatted <- data %>%
    rowwise() %>%
    mutate(Value = case_when(
      func == "normal"  ~ paste0("**", mean, "**", " (σ=", sd, ")"),
      func == "poisson" ~ paste0("λ=", lambda),
      func == "beta"    ~ paste0("Beta(", alpha, ",", beta, ")"),
      func == "gamma"   ~ paste0("Gamma(", shape, ",", scale, ")"),
      func == "lookup"  ~ paste0("*", profile, "*"),
      TRUE              ~ "-"
    )) %>%
    ungroup() %>%
    mutate(Distribution = str_to_title(func))
  
  wide_table <- formatted %>%
    select(any_of(c("activity", "param_name", "Distribution", "pref", "Value"))) %>%
    pivot_wider(names_from = pref, values_from = Value) %>%
    arrange(activity, param_name) %>%
    rename(Activity = activity, Parameter = param_name)
  
  wide_table %>%
    kbl(caption = caption, escape = F) %>%
    kable_styling(bootstrap_options = c("striped", "hover", "condensed"), 
                  font_size = 12, full_width = F) %>%
    column_spec(1, bold = TRUE) %>%
    collapse_rows(columns = 1:2, valign = "top") 
}