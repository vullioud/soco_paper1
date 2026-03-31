# ============================================================
# Quick check: Volume over time, faceted by climate scenario
# Reads stand_volume_fixed.csv (pre-normalized with awk)
# ============================================================

library(data.table)
library(ggplot2)

project_dir  <- "C:/Users/cv1055/Documents/SOCO_paper1"
combined_dir <- file.path(project_dir, "output", "_combined")
fig_dir      <- file.path(
  project_dir, "resilience_analysis", "figures"
)
dir.create(fig_dir, showWarnings = FALSE, recursive = TRUE)

# --- Read normalized file ---
sv <- fread(
  file.path(combined_dir, "stand_volume_fixed.csv"),
  select = c("run_id", "landscape", "climate",
             "year", "area", "volume")
)
cat(sprintf("Loaded %s rows\n",
            format(nrow(sv), big.mark = ",")))

# --- Map short climate labels ---
sv[climate == "hist",  climate := "Historical"]
sv[climate == "rcp45", climate := "RCP 4.5"]
sv[climate == "rcp85", climate := "RCP 8.5"]

# --- Aggregate: landscape-level volume per run x year ---
lv <- sv[, .(total_volume = sum(volume * area,
                                na.rm = TRUE)),
         by = .(run_id, landscape, climate, year)]

cat(sprintf("Landscape-level: %s combos\n",
            format(nrow(lv), big.mark = ",")))
cat("Runs per climate:\n")
print(lv[, uniqueN(run_id), by = climate])

# --- Mean trajectory per climate ---
mt <- lv[, .(
  mean_vol = mean(total_volume, na.rm = TRUE),
  sd_vol   = sd(total_volume, na.rm = TRUE),
  n        = .N
), by = .(climate, year)]
mt[, se := sd_vol / sqrt(n)]

# --- Plot ---
p <- ggplot() +
  geom_line(
    data = lv,
    aes(x = year, y = total_volume, group = run_id),
    alpha = 0.15, linewidth = 0.3, color = "grey50"
  ) +
  geom_ribbon(
    data = mt,
    aes(x = year,
        ymin = mean_vol - sd_vol,
        ymax = mean_vol + sd_vol),
    fill = "#377eb8", alpha = 0.2
  ) +
  geom_line(
    data = mt,
    aes(x = year, y = mean_vol),
    color = "#377eb8", linewidth = 1.2
  ) +
  annotate(
    "rect",
    xmin = 150, xmax = 160,
    ymin = -Inf, ymax = Inf,
    fill = "red", alpha = 0.1
  ) +
  facet_wrap(~ climate, nrow = 1) +
  labs(
    x = "Simulation year",
    y = "Total landscape volume (m\u00b3)",
    title = "Volume trajectories by climate scenario",
    subtitle = paste(
      "Thin lines = individual runs,",
      "blue = mean \u00b1 SD,",
      "red band = BB outbreak"
    )
  ) +
  theme_minimal(base_size = 12) +
  theme(
    strip.text = element_text(
      face = "bold", size = 13
    )
  )

out_path <- file.path(
  fig_dir, "quick_climate_check.png"
)
ggsave(out_path, p,
       width = 14, height = 5, dpi = 200)
cat(sprintf("\nSaved: %s\n", out_path))