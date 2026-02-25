library(terra)
library(dplyr)
library(ggplot2)
library(actuar) 
library(patchwork)
library(purrr)
library(readr)
library(kableExtra)

# ==============================================================================
# 1. SPATIAL CLUSTERING (Gaussian Random Field)
# ==============================================================================
cluster_stands_by_clustering <- function(stand_id_r, props=c(1,1,1), cluster=0.5, seed=1) {
  stopifnot(length(props) == 3, cluster >= 0, cluster <= 1)
  
  rs <- if (inherits(stand_id_r, "SpatRaster")) stand_id_r else rast(stand_id_r)
  v   <- values(rs)[,1]
  ids <- sort(unique(v[!is.na(v)]))
  if (length(ids) < 3) stop("Need at least 3 stands.")
  
  cellA <- prod(res(rs))
  cnt   <- as.numeric(tabulate(match(v, ids), nbins = length(ids)))
  A     <- cnt * cellA
  
  sv <- terra::as.polygons(rs, dissolve = TRUE)
  sv <- terra::subset(sv, !is.na(values(sv)[,1]))
  names(sv) <- "id"
  ids <- values(sv)$id
  A   <- A[match(ids, ids)] # Align A
  xy  <- terra::crds(terra::centroids(sv))
  
  D <- as.matrix(dist(xy))
  min_dist <- min(D[D > 0])
  max_dist <- max(D)
  mean_dist <- mean(D)
  
  if (cluster == 0) {
    sigma <- min_dist * 0.1 
  } else if (cluster <= 0.3) {
    sigma <- min_dist * 0.1 + (mean_dist * 0.5 - min_dist * 0.1) * (cluster / 0.3)
  } else if (cluster <= 0.7) {
    sigma <- mean_dist * 0.5 + (mean_dist * 2 - mean_dist * 0.5) * ((cluster - 0.3) / 0.4)
  } else {
    sigma <- mean_dist * 2 + (max_dist * 0.8 - mean_dist * 2) * ((cluster - 0.7) / 0.3)
  }
  
  W <- exp(- (D^2) / (2 * sigma^2))
  diag(W) <- 1
  W <- W / pmax(rowSums(W), 1e-12)
  
  set.seed(seed)
  z <- rnorm(nrow(W))
  score <- as.numeric(W %*% z)
  
  props <- props / sum(props)
  totA <- sum(A)
  targetA <- props * totA
  remainingA <- targetA
  assigned <- integer(length(ids))
  
  set.seed(seed)
  J_same <- 0.0001 * (1/cluster) 
  if(cluster == 0) J_same <- 100 
  
  ranks <- lapply(1:3, function(k) order(score + rnorm(length(score), sd=J_same), decreasing = TRUE))
  
  for (k in 1:3) {
    for (i in ranks[[k]]) {
      if (assigned[i] == 0L && remainingA[k] > 0) {
        assigned[i] <- k
        remainingA[k] <- remainingA[k] - A[i]
        if (remainingA[k] <= 0) break
      }
    }
  }
  
  if (any(assigned == 0L)) {
    area_by_class <- tapply(A, assigned, sum, default = 0)[1:3]
    deficit <- targetA - ifelse(is.na(area_by_class), 0, area_by_class)
    fillk <- if (all(deficit <= 0 | is.na(deficit))) which.max(props) else which.max(deficit)
    assigned[assigned == 0L] <- fillk
  }
  
  data.frame(
    stand_id = ids,
    group_id = assigned,
    owner_type  = factor(assigned, levels = 1:3, labels = c("small","state","big")),
    stringsAsFactors = FALSE
  )
}

# ==============================================================================
# 2. AGENT ALLOCATION
# ==============================================================================
distribute_stands_to_agents <- function(stand_ids, owner_type, owner_params, shuffled) {
  n_stands <- length(stand_ids)
  if (n_stands == 0) return(list())
  
  params <- owner_params[[owner_type]]
  if (shuffled) shuffled_stands <- sample(stand_ids) else shuffled_stands <- stand_ids
  
  agent_assignments <- list()
  current_index <- 1
  
  while (current_index <= n_stands) {
    n_for_agent <- rztpois(1, params$lambda)
    if (!is.null(params$max_stands)) n_for_agent <- min(n_for_agent, params$max_stands)
    n_for_agent <- min(n_for_agent, n_stands - current_index + 1)
    
    if (n_for_agent > 0) {
      agent_stands <- shuffled_stands[current_index:(current_index + n_for_agent - 1)]
      agent_assignments[[length(agent_assignments) + 1]] <- agent_stands
      current_index <- current_index + n_for_agent
    } else {
      break
    }
  }
  
  if (current_index <= n_stands) {
    leftover_stands <- shuffled_stands[current_index:n_stands]
    for (i in seq_along(leftover_stands)) {
      agent_idx <- ((i - 1) %% length(agent_assignments)) + 1
      agent_assignments[[agent_idx]] <- c(agent_assignments[[agent_idx]], leftover_stands[i])
    }
  }
  return(agent_assignments)
}

assign_agents_to_stands <- function(owner_table, distribution_params, shuffled = FALSE) {
  result_table <- owner_table
  result_table$agent_id <- NA_character_
  
  for (owner_type in unique(owner_table$owner_type)) {
    owner_stands <- owner_table$stand_id[owner_table$owner_type == owner_type]
    if (length(owner_stands) > 0) {
      agent_assignments <- distribute_stands_to_agents(owner_stands, owner_type, distribution_params, shuffled)
      for (i in seq_along(agent_assignments)) {
        agent_id <- paste0(owner_type, "_agent_", i)
        result_table$agent_id[result_table$stand_id %in% agent_assignments[[i]]] <- agent_id
      }
    }
  }
  
  unique_agents <- unique(na.omit(result_table$agent_id))
  agent_to_number <- setNames(seq_along(unique_agents), unique_agents)
  result_table$agent_numeric <- agent_to_number[result_table$agent_id]
  
  result_table %>%
    mutate(agentType = "socoabe_controller") %>%
    rename(id = stand_id, agent = agent_id, unit = agent_numeric) %>%
    select(-group_id)
}

# ==============================================================================
# 3. EXPORT FUNCTION (SIMPLIFIED)
# ==============================================================================
# Removes inner shuffle loop. Takes single 'shuffled' boolean.
export_agent_tables <- function(landscape_owner_list,
                                owner_params,
                                shuffled = FALSE, # <--- Single Boolean Argument
                                prefix = "agent_table",
                                out_dir) {
  
  if(!dir.exists(out_dir)) dir.create(out_dir, recursive = TRUE)
  
  # Iterate over landscapes (Random, Low, High...)
  imap_dfr(landscape_owner_list, function(owner_tbl, lname) {
    
    # 1. Assign agents
    agent_table <- assign_agents_to_stands(
      owner_table = owner_tbl, 
      distribution_params = owner_params, 
      shuffled = shuffled
    )
    
    # 2. Final format
    final <- agent_table %>%
      mutate(unit = paste0("unit_", unit)) %>%
      dplyr::select(-agentType) 
    
    # 3. Filename (Matches original convention: agent_table_Name_shuffled-false.csv)
    safe_lname <- gsub("[^A-Za-z0-9_-]+", "_", lname)
    filename <- sprintf("%s_%s_shuffled-%s.csv", prefix, safe_lname, tolower(as.character(shuffled)))
    file_path <- file.path(out_dir, filename)
    
    # 4. Write
    readr::write_csv(final, file = file_path)
    
    # Log
    tibble(landscape = lname, shuffled = shuffled, file = file_path)
  })
}
# ==============================================================================
# 4. VISUALIZATION FUNCTIONS
# ==============================================================================
plot_owner_raster_gg <- function(tbl, stand_raster, title = "") {
  r <- if (inherits(stand_raster, "SpatRaster")) stand_raster else terra::rast(stand_raster)
  lut <- tbl %>% select(stand_id, owner_type) %>% distinct()
  df <- as.data.frame(r, xy = TRUE)
  colnames(df)[3] <- "stand_id"
  df <- df %>% left_join(lut, by = "stand_id") %>% filter(!is.na(owner_type))
  owner_colors <- c("small" = "#2E8B57", "big" = "#FFB347", "state" = "#461111")
  
  ggplot(df, aes(x = x, y = y, fill = owner_type)) +
    geom_raster() +
    scale_fill_manual(values = owner_colors, name = "Owner") +
    coord_equal() +
    theme_void() +
    theme(legend.position = "none", plot.title = element_text(hjust = 0.5, size=10)) +
    ggtitle(title)
}

plot_agent_size_distribution <- function(params, n_sim = 2000) {
  sim_data <- data.frame()
  for (owner in names(params)) {
    lambda <- params[[owner]]$lambda
    max_s <- params[[owner]]$max_stands
    sims <- rztpois(n_sim, lambda)
    sims <- pmin(sims, max_s)
    sim_data <- rbind(sim_data, data.frame(owner = owner, n_stands = sims))
  }
  ggplot(sim_data, aes(x = n_stands, fill = owner)) +
    geom_histogram(binwidth = 1, alpha = 0.8, position = "identity") +
    facet_wrap(~owner, ncol = 1, scales = "free_y") +
    labs(title = "Agent Size Distribution", subtitle = "Zero-Truncated Poisson (ZTP)", x = "Number of Stands", y = "Count") +
    scale_fill_manual(values = c("small" = "steelblue", "state" = "darkgreen", "big" = "orange")) +
    theme_minimal()
}

generate_agent_summary_table <- function(agent_table) {
  stats <- agent_table %>%
    group_by(owner_type, agent) %>%
    summarise(n_stands = n(), .groups = 'drop') %>%
    group_by(owner_type) %>%
    summarise(
      `Total Agents` = n(),
      `Total Stands` = sum(n_stands),
      `Mean Size` = round(mean(n_stands), 1),
      `Min Size` = min(n_stands),
      `Max Size` = max(n_stands)
    ) %>%
    rename(Owner = owner_type) %>%
    mutate(Owner = str_to_title(Owner))

  stats %>%
    kbl(caption = "Realized Agent Population Statistics") %>%
    kable_styling(bootstrap_options = c("striped", "hover", "condensed"), full_width = F) %>%
    column_spec(1, bold = TRUE)
}

# ==============================================================================
# 5. GEOGRAPHICAL NETWORK COMPUTATION
# ==============================================================================

#' Compute Geographical Networks for Agents
#'
#' For each agent, identifies neighboring agents whose stands are spatially adjacent.
#' Uses raster adjacency to find all stands within 1 cell distance.
#'
#' @param agent_table Data frame with columns: id (stand_id), agent (agent_id)
#' @param stand_raster SpatRaster where cell values are stand IDs
#' @param directions Number of directions for adjacency (4, 8, or 16). Default 8 (queen's case)
#' @return Named list where each agent_id maps to a vector of neighboring agent_ids
#'
#' @examples
#' networks <- compute_geographical_networks(agent_table, stand_raster)
#' networks$big_agent_1  # Returns character vector of neighbor agent IDs
compute_geographical_networks <- function(agent_table, stand_raster, directions = 8) {

  # Validate inputs
  if (!inherits(stand_raster, "SpatRaster")) {
    stand_raster <- terra::rast(stand_raster)
  }

  if (!all(c("id", "agent") %in% names(agent_table))) {
    stop("agent_table must have columns 'id' (stand_id) and 'agent' (agent_id)")
  }

  # Create lookup: stand_id -> agent_id
  stand_to_agent <- setNames(agent_table$agent, agent_table$id)

  # Get unique agents
  unique_agents <- unique(agent_table$agent)

  message(sprintf("Computing geographical networks for %d agents...", length(unique_agents)))

  # Initialize network list
  networks <- list()

  # For each agent, find neighbors
  for (agent_id in unique_agents) {

    # Get this agent's stands
    my_stand_ids <- agent_table$id[agent_table$agent == agent_id]

    if (length(my_stand_ids) == 0) {
      networks[[agent_id]] <- character(0)
      next
    }

    # Find all adjacent cells to my stands
    # Strategy: Use terra::adjacent() with raster cells

    # Convert stand IDs to cell indices
    all_values <- terra::values(stand_raster, mat = FALSE)
    my_cells <- which(all_values %in% my_stand_ids)

    if (length(my_cells) == 0) {
      networks[[agent_id]] <- character(0)
      next
    }

    # Get adjacent cells (this returns a matrix with columns [from, to])
    adjacent_cells <- terra::adjacent(stand_raster, cells = my_cells,
                                      directions = directions, pairs = TRUE)

    if (is.null(adjacent_cells) || nrow(adjacent_cells) == 0) {
      networks[[agent_id]] <- character(0)
      next
    }

    # Get stand IDs of adjacent cells
    adjacent_stand_ids <- all_values[adjacent_cells[, 2]]
    adjacent_stand_ids <- unique(adjacent_stand_ids[!is.na(adjacent_stand_ids)])

    # Exclude my own stands
    neighbor_stand_ids <- setdiff(adjacent_stand_ids, my_stand_ids)

    # Map to agent IDs
    neighbor_agent_ids <- unique(stand_to_agent[as.character(neighbor_stand_ids)])
    neighbor_agent_ids <- neighbor_agent_ids[!is.na(neighbor_agent_ids)]

    # Store
    networks[[agent_id]] <- as.character(neighbor_agent_ids)
  }

  message(sprintf("  -> Computed networks for %d agents", length(networks)))
  message(sprintf("  -> Average network size: %.1f neighbors",
                  mean(sapply(networks, length))))

  return(networks)
}

#' Export Agent Networks to JSON
#'
#' Exports geographical (and optionally similarity) networks to JSON format.
#' Creates a file that can be loaded by the SOCO model.
#'
#' @param geo_networks Named list from compute_geographical_networks()
#' @param sim_networks Optional named list for similarity networks (future use)
#' @param path Output file path (JSON)
#'
#' @examples
#' export_agent_networks(geo_networks, path = "agent_networks.json")
export_agent_networks <- function(geo_networks, sim_networks = NULL, path) {

  # Build JSON structure
  network_data <- list()

  for (agent_id in names(geo_networks)) {
    network_data[[agent_id]] <- list(
      geo_network = geo_networks[[agent_id]],
      similarity_network = if (!is.null(sim_networks) && agent_id %in% names(sim_networks)) {
        sim_networks[[agent_id]]
      } else {
        character(0)
      }
    )
  }

  # Ensure directory exists
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)

  # Export
  json_str <- jsonlite::toJSON(network_data, pretty = TRUE, auto_unbox = FALSE)
  writeLines(json_str, path)

  message(sprintf("Networks exported to: %s", path))

  return(invisible(network_data))
}
