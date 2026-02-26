# ==============================================================================
# CREATE DIVERSE INIT FILES
# ==============================================================================
# Generates coherent tree/sapling/env initialization from BWI source data.
# Fixes: env 4-row structure, tree-sapling coherence, per-seed variation.
#
# Two modes:
#   "random"  — age-stratified independent sampling (warmup initialization)
#   "matched" — card-dealing across owner types (experimental initialization)
# ==============================================================================

library(dplyr)
library(readr)

# --- 6.1 Grid cell map ---
# Returns data.frame with 4 rows per stand (one per RU cell in the 2x2 block).
build_grid_cell_map <- function(n_stands = 400L,
                                n_per_row = 20L,
                                cells_per_stand = 2L) {
  rows <- vector("list", n_stands * cells_per_stand^2)
  idx <- 1L
  for (sid in seq_len(n_stands)) {
    col_block <- (sid - 1L) %% n_per_row        # 0-indexed column
    row_block <- (sid - 1L) %/% n_per_row        # 0-indexed row
    for (dy in 0:(cells_per_stand - 1L)) {
      for (dx in 0:(cells_per_stand - 1L)) {
        rows[[idx]] <- data.frame(
          stand_id = sid,
          x_cell   = col_block * cells_per_stand + dx,
          y_cell   = row_block * cells_per_stand + dy
        )
        idx <- idx + 1L
      }
    }
  }
  bind_rows(rows)
}


# --- 6.2 Summarise env by stand ---
# Reduces multi-row env to one representative row per source stand.
summarise_env_by_stand <- function(env_df) {
  env_df %>%
    group_by(id) %>%
    summarise(
      soilDepth          = median(model.site.soilDepth, na.rm = TRUE),
      pctSand            = median(model.site.pctSand, na.rm = TRUE),
      pctClay            = median(model.site.pctClay, na.rm = TRUE),
      pctSilt            = median(model.site.pctSilt, na.rm = TRUE),
      availableNitrogen  = median(model.site.availableNitrogen, na.rm = TRUE),
      climate_table      = first(model.climate.tableName),
      .groups = "drop"
    )
}


# --- 6.3 Build coherent pool ---
# Returns character vector of source stand IDs present in trees AND env.
build_coherent_pool <- function(src_trees, src_saps, src_env,
                                named_species = NULL) {
  tree_ids <- unique(as.character(src_trees$stand_id))
  env_ids  <- unique(as.character(src_env$id))
  sap_ids  <- unique(as.character(src_saps$stand_id))

  pool <- intersect(tree_ids, env_ids)

  message(sprintf("  Source trees: %d stands", length(tree_ids)))
  message(sprintf("  Source env:   %d stands", length(env_ids)))
  message(sprintf("  Source saps:  %d stands", length(sap_ids)))
  message(sprintf("  Coherent pool (trees AND env): %d stands", length(pool)))
  message(sprintf("  Full coherent (trees AND saps AND env): %d stands",
                  length(intersect(pool, sap_ids))))

  # Species coverage diagnostics
  if (!is.null(named_species) && length(named_species) > 0) {
    pool_trees <- src_trees %>% filter(as.character(stand_id) %in% pool)
    total_stems <- sum(pool_trees$count)
    named_stems <- pool_trees %>%
      filter(species %in% named_species) %>%
      summarise(s = sum(count)) %>%
      pull(s)

    # Per-stand coverage
    stand_cov <- pool_trees %>%
      group_by(stand_id) %>%
      summarise(
        total = sum(count),
        named = sum(count[species %in% named_species]),
        .groups = "drop"
      ) %>%
      mutate(pct = named / total * 100)

    message(sprintf("  Species coverage: %.1f%% of stems in named species",
                    named_stems / total_stems * 100))
    message(sprintf("  Stands with >80%% named: %d (%.0f%%)",
                    sum(stand_cov$pct > 80),
                    sum(stand_cov$pct > 80) / nrow(stand_cov) * 100))
  }

  pool
}


# --- 6.4 Age-stratified sampling ---
# Samples n stand IDs from pool using age-stratified proportional sampling.
age_stratified_sample <- function(pool_ids, src_trees, n, seed) {

  # Compute mean age per source stand
  stand_ages <- src_trees %>%
    filter(as.character(stand_id) %in% pool_ids) %>%
    group_by(stand_id) %>%
    summarise(mean_age = weighted.mean(age, count), .groups = "drop") %>%
    mutate(
      stand_id = as.character(stand_id),
      age_class = cut(mean_age,
                      breaks = c(-Inf, 20, 40, 60, 80, 100, Inf),
                      labels = c("0-20", "20-40", "40-60", "60-80", "80-100", "100+"),
                      right = TRUE)
    )

  # Proportional allocation
  class_counts <- stand_ages %>%
    count(age_class, .drop = FALSE) %>%
    mutate(target = floor(n * n / sum(n)))

  # Fix: target proportional to class size
  class_counts <- stand_ages %>%
    count(age_class, .drop = FALSE) %>%
    mutate(
      prop   = n / sum(n),
      target = floor(prop * !!n)
    )

  # Residual correction to hit exactly n
  deficit <- n - sum(class_counts$target)
  if (deficit > 0) {
    # Give residuals to largest classes first
    ord <- order(class_counts$n, decreasing = TRUE)
    for (i in seq_len(deficit)) {
      class_counts$target[ord[((i - 1) %% nrow(class_counts)) + 1]] <-
        class_counts$target[ord[((i - 1) %% nrow(class_counts)) + 1]] + 1L
    }
  }

  set.seed(seed)
  sampled <- character(0)

  for (i in seq_len(nrow(class_counts))) {
    cls       <- class_counts$age_class[i]
    needed    <- class_counts$target[i]
    available <- stand_ages$stand_id[stand_ages$age_class == cls]
    if (needed == 0 || length(available) == 0) next
    replace_flag <- needed > length(available)
    drawn <- sample(available, size = needed, replace = replace_flag)
    sampled <- c(sampled, drawn)
  }

  sampled
}


# --- 6.5 Random sampling ---
sample_random <- function(pool_ids, owner_map, src_trees, n, seed) {
  sampled_src <- age_stratified_sample(pool_ids, src_trees, n, seed)
  data.frame(
    new_id    = seq_len(n),
    source_id = sampled_src,
    age_class = NA_character_,
    sampling_mode = "random",
    stringsAsFactors = FALSE
  )
}


# --- 6.6 Matched sampling (card-dealing) ---
sample_matched <- function(pool_ids, owner_map, src_trees, seed) {

  # Separate owner queues sorted by stand_id
  small_ids <- sort(owner_map$stand_id[owner_map$owner_type == "small"])
  state_ids <- sort(owner_map$stand_id[owner_map$owner_type == "state"])
  big_ids   <- sort(owner_map$stand_id[owner_map$owner_type == "big"])

  set.seed(seed)
  shuffled_pool <- sample(pool_ids)

  n_matched <- min(length(small_ids), length(state_ids), length(big_ids))

  mapping_rows <- list()
  idx <- 1L

  # Matched rounds
  for (i in seq_len(n_matched)) {
    src <- shuffled_pool[i]
    mapping_rows[[idx]] <- data.frame(
      new_id = small_ids[i], source_id = src,
      owner_type = "small", sampling_mode = "matched",
      stringsAsFactors = FALSE)
    idx <- idx + 1L
    mapping_rows[[idx]] <- data.frame(
      new_id = state_ids[i], source_id = src,
      owner_type = "state", sampling_mode = "matched",
      stringsAsFactors = FALSE)
    idx <- idx + 1L
    mapping_rows[[idx]] <- data.frame(
      new_id = big_ids[i], source_id = src,
      owner_type = "big", sampling_mode = "matched",
      stringsAsFactors = FALSE)
    idx <- idx + 1L
  }

  # Fill remainder from remaining pool
  pool_cursor <- n_matched + 1L
  pool_len    <- length(shuffled_pool)

  fill_queue <- function(ids, type, start_i) {
    if (start_i > length(ids)) return(list())
    out <- list()
    for (j in start_i:length(ids)) {
      if (pool_cursor > pool_len) pool_cursor <<- 1L  # wrap
      src <- shuffled_pool[pool_cursor]
      pool_cursor <<- pool_cursor + 1L
      out[[length(out) + 1]] <- data.frame(
        new_id = ids[j], source_id = src,
        owner_type = type, sampling_mode = "random_fill",
        stringsAsFactors = FALSE)
    }
    out
  }

  mapping_rows <- c(mapping_rows,
                    fill_queue(small_ids, "small", n_matched + 1L),
                    fill_queue(state_ids, "state", n_matched + 1L),
                    fill_queue(big_ids,   "big",   n_matched + 1L))

  bind_rows(mapping_rows)
}


# --- 6.7 Assemble output ---
# Recodes source stand data to new grid stand IDs.
assemble_output <- function(mapping, src_trees, src_saps,
                            src_env_summary, grid_cells) {

  # Pre-split sources by stand_id for fast lookup
  tree_split <- split(src_trees, src_trees$stand_id)
  sap_split  <- split(src_saps, src_saps$stand_id)

  tree_out <- vector("list", nrow(mapping))
  sap_out  <- vector("list", nrow(mapping))
  env_out  <- vector("list", nrow(mapping))

  for (r in seq_len(nrow(mapping))) {
    new_id <- mapping$new_id[r]
    src_id <- mapping$source_id[r]
    src_key <- as.character(src_id)

    # Trees
    t <- tree_split[[src_key]]
    if (!is.null(t) && nrow(t) > 0) {
      t$stand_id    <- new_id
      t$bwi_plot_id <- sprintf("%d/1", new_id)
      tree_out[[r]] <- t
    }

    # Saplings (may be NULL)
    s <- sap_split[[src_key]]
    if (!is.null(s) && nrow(s) > 0) {
      s$stand_id    <- new_id
      s$bwi_plot_id <- sprintf("%d/1", new_id)
      sap_out[[r]] <- s
    }

    # Env: expand summary row to 4 RU cells using grid_cells
    env_row <- src_env_summary %>% filter(as.character(id) == src_key)
    if (nrow(env_row) > 0) {
      cells <- grid_cells %>% filter(stand_id == new_id)
      env_out[[r]] <- data.frame(
        id                            = new_id,
        x                             = cells$x_cell,
        y                             = cells$y_cell,
        model.site.soilDepth          = env_row$soilDepth,
        model.site.pctSand            = env_row$pctSand,
        model.site.pctClay            = env_row$pctClay,
        model.site.pctSilt            = env_row$pctSilt,
        model.site.availableNitrogen  = env_row$availableNitrogen,
        model.climate.tableName       = env_row$climate_table,
        stringsAsFactors = FALSE
      )
    }
  }

  list(
    trees    = bind_rows(tree_out),
    saplings = bind_rows(sap_out),
    env      = bind_rows(env_out)
  )
}


# --- 6.8 Validate and report ---
validate_and_report <- function(trees, saplings, env, mapping,
                                n_stands, n_ru_per_stand,
                                named_species = NULL) {
  errors <- 0L

  # Check all stands have trees
  tree_stands <- length(unique(trees$stand_id))
  if (tree_stands != n_stands) {
    message(sprintf("  ERROR: Expected %d tree stands, got %d", n_stands, tree_stands))
    errors <- errors + 1L
  } else {
    message(sprintf("  OK: %d tree stands", tree_stands))
  }

  # Check env row count
  expected_env <- n_stands * n_ru_per_stand
  if (nrow(env) != expected_env) {
    message(sprintf("  ERROR: Expected %d env rows, got %d", expected_env, nrow(env)))
    errors <- errors + 1L
  } else {
    message(sprintf("  OK: %d env rows (%d per stand)", nrow(env), n_ru_per_stand))
  }

  # Check env x,y range
  x_range <- range(env$x)
  y_range <- range(env$y)
  if (x_range[1] < 0 || x_range[2] > 39 || y_range[1] < 0 || y_range[2] > 39) {
    message(sprintf("  ERROR: env x/y out of [0,39]: x=[%d,%d] y=[%d,%d]",
                    x_range[1], x_range[2], y_range[1], y_range[2]))
    errors <- errors + 1L
  } else {
    message(sprintf("  OK: env coords x=[%d,%d] y=[%d,%d]",
                    x_range[1], x_range[2], y_range[1], y_range[2]))
  }

  # Check no NA in soil
  na_count <- sum(is.na(env$model.site.soilDepth) | is.na(env$model.site.pctSand))
  if (na_count > 0) {
    message(sprintf("  ERROR: %d NA values in env soil columns", na_count))
    errors <- errors + 1L
  }

  # Age distribution
  stand_ages <- trees %>%
    group_by(stand_id) %>%
    summarise(mean_age = weighted.mean(age, count), .groups = "drop")
  message(sprintf("  Age: min=%.0f  median=%.0f  max=%.0f",
                  min(stand_ages$mean_age), median(stand_ages$mean_age),
                  max(stand_ages$mean_age)))

  # Age class counts
  stand_ages <- stand_ages %>%
    mutate(age_class = cut(mean_age,
                           breaks = c(-Inf, 20, 40, 60, 80, 100, Inf),
                           labels = c("0-20", "20-40", "40-60", "60-80", "80-100", "100+"),
                           right = TRUE))
  class_tbl <- table(stand_ages$age_class)
  message("  Age classes: ", paste(names(class_tbl), class_tbl, sep = "=", collapse = ", "))

  # Species composition
  sp_counts <- trees %>%
    group_by(species) %>%
    summarise(stems = sum(count), .groups = "drop") %>%
    arrange(desc(stems)) %>%
    mutate(pct = stems / sum(stems) * 100)
  top <- head(sp_counts, 8)
  message("  Top species: ", paste(sprintf("%s(%.1f%%)", top$species, top$pct), collapse = ", "))

  # Sapling coverage
  sap_stands <- length(unique(saplings$stand_id))
  message(sprintf("  Saplings: %d stands (%.0f%%)", sap_stands,
                  sap_stands / n_stands * 100))

  # Named species coverage
  if (!is.null(named_species)) {
    total <- sum(trees$count)
    named <- trees %>% filter(species %in% named_species) %>% summarise(s = sum(count)) %>% pull(s)
    message(sprintf("  Named species coverage: %.1f%%", named / total * 100))
  }

  # Matched mode: per-owner-type age comparison
  if ("owner_type" %in% names(mapping)) {
    age_by_type <- stand_ages %>%
      left_join(mapping %>% select(new_id, owner_type), by = c("stand_id" = "new_id")) %>%
      group_by(owner_type) %>%
      summarise(mean_age = mean(mean_age), .groups = "drop")
    message("  Per-type mean age: ",
            paste(sprintf("%s=%.1f", age_by_type$owner_type, age_by_type$mean_age),
                  collapse = ", "))
  }

  if (errors > 0) {
    warning(sprintf("Validation found %d error(s)!", errors))
  } else {
    message("  Validation PASSED")
  }

  invisible(errors)
}


# ==============================================================================
# MAIN ENTRY POINT
# ==============================================================================

create_diverse_init_files <- function(
    seed,
    mode,
    owner_map         = NULL,
    n_stands          = 400L,
    n_cells_per_dim   = 40L,
    cells_per_stand   = 2L,
    source_tree_csv,
    source_sapling_csv,
    source_env_csv,
    output_dir,
    age_stratify      = TRUE,
    named_species     = c("piab","psme","fasy","qupe","abal",
                          "bepe","potr","lade",
                          "pisy","frex","acps","quro")
) {
  message(sprintf("\n=== create_diverse_init: seed=%d, mode=%s ===", seed, mode))

  stopifnot(mode %in% c("random", "matched"))
  if (mode == "matched" && is.null(owner_map)) {
    stop("owner_map is required for matched mode")
  }

  # Load source data
  message("Loading source data...")
  src_trees <- read_csv(source_tree_csv, show_col_types = FALSE)
  src_saps  <- read_csv(source_sapling_csv, show_col_types = FALSE)
  src_env   <- read_csv(source_env_csv, show_col_types = FALSE)

  # Build coherent pool
  message("Building coherent pool...")
  pool_ids <- build_coherent_pool(src_trees, src_saps, src_env, named_species)

  # Summarise env
  src_env_summary <- summarise_env_by_stand(src_env)

  # Build grid cell map
  n_per_row <- n_cells_per_dim / cells_per_stand
  grid_cells <- build_grid_cell_map(n_stands, n_per_row, cells_per_stand)

  # Sample
  message(sprintf("Sampling (mode=%s, seed=%d)...", mode, seed))
  if (mode == "random") {
    mapping <- sample_random(pool_ids, owner_map, src_trees, n_stands, seed)
  } else {
    mapping <- sample_matched(pool_ids, owner_map, src_trees, seed)
  }

  # Assemble output
  message("Assembling output files...")
  out <- assemble_output(mapping, src_trees, src_saps, src_env_summary, grid_cells)

  # Validate
  message("Validating...")
  n_ru <- cells_per_stand^2
  validate_and_report(out$trees, out$saplings, out$env, mapping,
                      n_stands, n_ru, named_species)

  # Write files
  rep_dir <- file.path(output_dir,
                       sprintf("rep_%03d", seed))
  if (!dir.exists(rep_dir)) dir.create(rep_dir, recursive = TRUE)

  tree_file <- file.path(rep_dir, sprintf("tree2_diverse_seed%d.csv", seed))
  sap_file  <- file.path(rep_dir, sprintf("sapling2_diverse_seed%d.csv", seed))
  env_file  <- file.path(rep_dir, sprintf("env_file_diverse_seed%d.csv", seed))
  map_file  <- file.path(rep_dir, sprintf("stand_mapping_seed%d.csv", seed))

  write_csv(out$trees,    tree_file)
  write_csv(out$saplings, sap_file)
  write_csv(out$env,      env_file)
  write_csv(mapping,      map_file)

  message(sprintf("  Written to: %s", rep_dir))
  message(sprintf("    trees:    %d rows", nrow(out$trees)))
  message(sprintf("    saplings: %d rows", nrow(out$saplings)))
  message(sprintf("    env:      %d rows", nrow(out$env)))

  invisible(list(trees = out$trees, saplings = out$saplings,
                 env = out$env, mapping = mapping))
}


# ==============================================================================
# CONVENIENCE WRAPPER: Generate all replicates
# ==============================================================================

generate_all_replicates <- function(
    seeds,
    mode,
    output_dir,
    owner_map = NULL,
    ...
) {
  message(sprintf("\n%s", strrep("=", 60)))
  message(sprintf("Generating %d replicates (mode=%s)", length(seeds), mode))
  message(sprintf("Output: %s", output_dir))
  message(strrep("=", 60))

  for (s in seeds) {
    create_diverse_init_files(
      seed       = s,
      mode       = mode,
      owner_map  = owner_map,
      output_dir = output_dir,
      ...
    )
  }

  message(sprintf("\nDone: %d replicates in %s", length(seeds), output_dir))
}
