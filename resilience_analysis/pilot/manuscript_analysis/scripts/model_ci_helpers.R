extract_selected_model_parameter_ci <- function(
  model_comparison,
  models_dir,
  analysis_name
) {
  model_files <- list.files(models_dir, pattern = "\\.rds$", full.names = TRUE)
  ci_tables <- list()

  get_reference_level <- function(model, var_name) {
    model_frame <- model.frame(model)
    if (!var_name %in% names(model_frame) || !is.factor(model_frame[[var_name]])) {
      return(NA_character_)
    }
    levels(model_frame[[var_name]])[[1]]
  }

  build_ci_table <- function(model, analysis_value, response_value, selected_model_value) {
    estimates <- lme4::fixef(model)
    std_errors <- sqrt(diag(as.matrix(vcov(model))))
    ci_matrix <- cbind(
      `2.5 %` = estimates - 1.96 * std_errors,
      `97.5 %` = estimates + 1.96 * std_errors
    )
    ci_method <- "wald"

    data.table::data.table(
      analysis = analysis_value,
      response = response_value,
      selected_model = selected_model_value,
      term = names(estimates),
      estimate = unname(estimates),
      ci_low = ci_matrix[, 1],
      ci_high = ci_matrix[, 2],
      ci_method = ci_method,
      reference_landscape = get_reference_level(model, "landscape"),
      reference_aggregation = get_reference_level(model, "aggregation"),
      reference_condition = get_reference_level(model, "condition")
    )
  }

  for (model_file in model_files) {
    model_bundle <- readRDS(model_file)
    bundle_analysis <- model_bundle$analysis
    if (!is.null(bundle_analysis) && !identical(bundle_analysis, analysis_name)) {
      next
    }

    response_value <- model_bundle$response
    response_rows <- model_comparison[response == response_value]
    if (!nrow(response_rows)) {
      next
    }

    selected_row <- response_rows[which.min(aic)]
    selected_model_value <- as.character(selected_row$model[[1]])
    selected_fit <- model_bundle[[selected_model_value]]

    ci_tables[[length(ci_tables) + 1L]] <- build_ci_table(
      model = selected_fit,
      analysis_value = if (is.null(bundle_analysis)) analysis_name else bundle_analysis,
      response_value = response_value,
      selected_model_value = selected_model_value
    )
  }

  if (!length(ci_tables)) {
    return(data.table::data.table())
  }

  out <- data.table::rbindlist(ci_tables, use.names = TRUE, fill = TRUE)
  data.table::setorder(out, response, selected_model, term)
  out
}
