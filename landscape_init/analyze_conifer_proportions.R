# ==============================================================================
# Analyze conifer basal area proportion across all 12 BWI landscape clusters
# ==============================================================================

library(dplyr)
library(readr)

source_dir <- "init_german_landcape_rep"
cluster_ids <- c("02","03","04","05","06","07","08","10","11","12","13","14")

# Conifer genus prefixes (Picea, Pinus, Pseudotsuga, Larix, Abies)
conifer_prefixes <- c("pi", "ps", "la", "ab")
is_conifer <- function(sp) substr(sp, 1, 2) %in% conifer_prefixes

results <- lapply(cluster_ids, function(cl_id) {
  cl_name <- paste0("CLUSTER", cl_id)
  trees <- read_csv(file.path(source_dir, paste0("trees_", cl_name, ".csv")),
                    show_col_types = FALSE)

  trees <- trees %>%
    mutate(
      mean_dbh_m = (dbh_from + dbh_to) / 2 / 100,        # cm -> m
      ba         = count * pi * (mean_dbh_m / 2)^2,       # m2/ha
      is_conifer = is_conifer(species)
    )

  total_ba   <- sum(trees$ba)
  conifer_ba <- sum(trees$ba[trees$is_conifer])

  # Top conifer species by BA
  top_con <- trees %>%
    filter(is_conifer) %>%
    group_by(species) %>%
    summarise(ba = sum(ba), .groups = "drop") %>%
    slice_max(ba, n = 1)

  tibble(
    cluster     = cl_name,
    n_stands    = length(unique(trees$stand_id)),
    total_ba    = round(total_ba, 1),
    conifer_ba  = round(conifer_ba, 1),
    conifer_pct = round(conifer_ba / total_ba * 100, 1),
    top_conifer = if (nrow(top_con) > 0) top_con$species[1] else NA_character_
  )
})

conifer_table <- bind_rows(results) %>% arrange(desc(conifer_pct))

cat("\n=== Conifer BA proportion by cluster (all 12) ===\n\n")
print(as.data.frame(conifer_table), row.names = FALSE)

top5 <- conifer_table %>% slice_head(n = 5) %>% pull(cluster)
cat("\n>>> Top 5 conifer-heavy clusters:\n")
cat(paste(top5, collapse = ", "), "\n")
