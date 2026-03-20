# SoCoABE Analysis — Figure Guide

All figures are saved to `analysis_batch/co_author_report/figures/`.
All scripts source `analysis_batch/scripts/00_utils.R` for shared palettes, themes, and data loading.

Reference scenario: CL10 / High / contbb / replicate 1 (unless otherwise noted).

---

## Scripts and their figures

### 01_validation.R — Agent-level validation

Verifies that the cognitive decision pipeline produces expected behavior patterns.

| Figure | Name | Description |
|--------|------|-------------|
| A1 | `fig_A1_activity_timelines` | 15 panels (3 stands × 5 types). Volume trajectory (grey line) with colored dots for each cognitive activity decision. From `soco_stand_state` (volume) and `soco_ml_activities` (decisions). Filter: reference scenario. |
| A2 | `fig_A2_deferral_disturbance` | Deferral rate (% of managed stands deferred per decade) over time. Compares 3 disturbance scenarios (contbb, bb, nod). Filter: CL10, High, all disturbances. |
| A2b | `fig_A2b_deferral_by_agent` | Same as A2 but faceted by behavioral type. Shows whether deferral rates differ across owner types. |
| A3 | `fig_A3_budget_allocation` | Stacked bar: budget split into Salvage / Regular / Unspent per agent-decade. Faceted by disturbance (rows) × behavioral type (cols). Salvage spending estimated from `soco_ml_activities` × cost table. Filter: CL10, High, contbb vs nod. |
| A4 | `fig_A4_decision_heterogeneity` | Activity mix per behavioral type (stacked bars showing fraction of each activity chosen). From `soco_ml_activities`. Filter: reference scenario. |
| A5 | `fig_A5_landscape_heatmap` | Spatial heatmap of mean volume per stand over the simulation. From `soco_stand_state`. Filter: reference scenario. |

### 02_outcomes.R — OAT outcome metrics

Each figure uses the `build_oat_quad()` helper to produce a 4-row layout (one row per OAT arm: aggregation, landscape, disturbance, replicate). Lines show mean across stands per type per year.

| Figure | Name | Description |
|--------|------|-------------|
| B1 | `fig_B1_dbh_gini_oat` | Mean DBH Gini over time by behavioral type. From `soco_stand_state`. Higher = more structural complexity. |
| B2 | `fig_B2_species_evenness_oat` | Mean species evenness (1 - Gini) over time by type. From `stand_species_gini`. |
| B3 | `fig_B3_largetree_density_oat` | Mean large tree density (n/ha) over time by type. From `soco_stand_state`. |
| B3b | `fig_B3b_dbh_metrics_oat` | Additional DBH metrics (mean DBH, max DBH) over time by type. From `soco_stand_state`. |
| B4 | `fig_B4_annual_harvest_oat` | Annual harvest volume (thinning + final cut) over time by type. From `removal.csv`, filtered to rows with `volumeThinning > 0 | volumeFinal > 0 | volumeSalvaged > 0` (excludes disturbance-only rows). |
| B5 | `fig_B5_conifer_share_oat` | Conifer share (% BA) over time by type. From `species_by_year_type`. Conifers: piab, abal, lade, pisy, pini, psme, pice. |

### 03_sensitivity.R — OAT sensitivity ranking

Computes relative effect sizes (range / reference) for endpoint metrics across each OAT arm. No figure output — produces a summary printed to console (previously `fig_C1_effect_sizes.png`).

### 04_ownership_maps.R — Spatial ownership layout

| Figure | Name | Description |
|--------|------|-------------|
| — | `fig_ownership_maps` | Map of stand ownership for each aggregation scenario. Shows spatial clustering patterns. From the agent table CSVs in `abe/SOCO/stand_files/`. |

### 05_budget_diagnostics.R — Budget utilization and stand status

| Figure | Name | Description |
|--------|------|-------------|
| D1 | `fig_D1_budget_utilization` | Budget utilization rate (% spent) over time. 20-year bins. Faceted by disturbance (rows) × owner group (cols: State, Corporate, Small private). Ribbon = IQR across agents. Dashed line = 100% (fully binding). From `soco_decade_budget`. Filter: CL10, High, rep 1. |
| D2 | `fig_D2_stand_status_composition` | Stand planning status composition over time. Stacked bars: committed, ongoing, deferred, blocked, set-aside, idle. 20-year bins. Faceted by disturbance × owner group. From `soco_decade_snapshot`. Filter: CL10, High, rep 1. |

---

### fig_01_stand_biographies.R — Stand management biographies

| Figure | Name | Description |
|--------|------|-------------|
| 01 | `fig_01_stand_biographies` | 15 panels (5 types × 3 stands, seed=123). Volume trajectory (grey line) with colored activity dots. Dot color = activity name (each sequence phase is a distinct color, e.g. shelterwood vs shelterwood_planting). Triangles = salvage events. From `soco_stand_state` (volume) and `soco_ml_activities` (decisions). Filter: reference scenario. |

### fig_02_phase_distribution.R — Structural phase distribution

| Figure | Name | Description |
|--------|------|-------------|
| 02 | `fig_02_phase_distribution` | Stacked area: fraction of stands in each structural phase (Planting, Tending, Thinning, Harvesting, Set-aside) per year. 5 facets (one per behavioral type). Uses `active_phase` from `soco_stand_state`. Set-aside stands shown as a separate category. Filter: reference scenario. |

### fig_03_ridge_by_phase.R — Phase-conditioned ridge plots

| Figure | Name | Description |
|--------|------|-------------|
| 03 | `fig_03_ridge_by_phase` | Ridge plots (ggridges): within each structural phase, compare stand-state distributions across types. 4 metrics × 4 phases = 16 panels. Metrics: DBH Gini, Volume, Large trees (n/ha), Height layers. Set-aside stands excluded. From `soco_stand_state`. Filter: reference scenario, years 100-200. |

### fig_04_disturbance_recovery.R — Post-disturbance recovery

Two figures from the same script:

| Figure | Name | Description |
|--------|------|-------------|
| 04 | `fig_04_disturbance_recovery` | **Full devastation** — stands where volume dropped below 10 m³/ha (from >50). 3 panels: (A) Volume recovery with cohort lines colored by type + mean smooth, (B) Shannon H' recovery, (C) Activity dots during recovery. From `soco_stand_state`, `stand_shannon`, `soco_ml_activities`. Filter: CL10, High, contbb+bb, rep 1. Reset detection: vol < 10 AND previous year vol > 50. 298 resets found (mostly MF and OP stands). |
| 04b | `fig_04b_partial_salvage_recovery` | **Partial salvage** — stands that had a salvage_clearcut event but volume stayed above 10 m³/ha (disturbance damaged part of the stand). Same 3-panel layout as fig_04. 65 stands. Fewer EN/PA stands since they rarely get salvaged. |

### fig_06_landscape_heterogeneity.R — Landscape heterogeneity

| Figure | Name | Description |
|--------|------|-------------|
| 06 | `fig_06_landscape_heterogeneity` | 4 panels: Mean Volume, Volume CV, Mean DBH Gini, DBH Gini CV across all stands per year. Lines colored by aggregation scenario. CV = sd/mean across stands (measures landscape heterogeneity). From `soco_stand_state`. Filter: CL10, contbb, rep 1, all 5 aggregation scenarios. |

### fig_07_species_space.R — Species composition space

| Figure | Name | Description |
|--------|------|-------------|
| 07 | `fig_07_species_space` | Scatterplot: x = conifer share (% BA), y = Shannon H'. One point per stand, averaged over years 180-200. Color = behavioral type. 50% concentration ellipses per type. Conifer share is computed at type-level from `species_by_year_type` (jittered to spread points). Shannon per stand from `stand_shannon`. Filter: reference scenario. Note: conifer share will improve when per-stand species BA extraction is available. |

### fig_08_sensitivity.R — Sensitivity summary

| Figure | Name | Description |
|--------|------|-------------|
| 08 | `fig_08_sensitivity` | Heatmap: CV of endpoint metrics (years 150-200) across scenarios within each OAT arm. Rows = metrics (Volume, Structural complexity, Large trees, Landscape heterogeneity, Species diversity). Columns = arms (Aggregation, Landscape, Disturbance). Darker = more sensitive. From `soco_stand_state` + `stand_shannon`. |
| 08 bars | `fig_08_sensitivity_bars` | Same data as heatmap but as grouped bar chart for easier comparison. |

### fig_09_species_composition.R — Species composition over time

| Figure | Name | Description |
|--------|------|-------------|
| 09 | `fig_09_species_composition` | Stacked area: BA share (%) of top 10 species + Other over 200 years. 4-row OAT layout. From `species_by_year`. |

### fig_10_initial_species.R — Initial species distribution

| Figure | Name | Description |
|--------|------|-------------|
| 10 | `fig_10_initial_species` | Stacked bar: BA share (%) at Year 1 for CL05, CL10, CL14. Top 10 species. From `species_by_year`. Filter: High, contbb, rep 1. |

### fig_11_phase_agreement.R — Phase classification agreement

| Figure | Name | Description |
|--------|------|-------------|
| 11 | `fig_11_phase_agreement` | Left: confusion matrix (age-phase vs structural-phase, all years). Right: agreement % over time by behavioral type. From `soco_stand_state` (age_phase, structural_phase, phase_match). Filter: reference scenario, set-aside excluded. |

---

## Data files used

| File | Source | Key columns |
|------|--------|-------------|
| `soco_stand_state.csv` | SoCoABE annual output | stand_id, year, behavioral_type, volume, basal_area, dbh_gini, n_large_trees, active_phase, is_set_aside |
| `soco_ml_activities_clean.csv` | SoCoABE cognitive decisions (cleaned, no JSON) | stand_id, year, activity_name, behavioral_type, salvage_fraction, extraction_cost_paid |
| `soco_decade_snapshot.csv` | SoCoABE decade planning snapshot | stand_id, year, status (committed/ongoing/deferred/blocked/set_aside/idle), current_phase, pile_cost |
| `soco_decade_budget.csv` | SoCoABE decade budget summary | agent_id, year, behavioral_type, budget_total, budget_spent, budget_remaining, n_managed |
| `removal.csv` | iLand harvest/disturbance output | standid, year, activity, volumeThinning, volumeFinal, volumeSalvaged, volumeDisturbed |
| `stand_shannon.csv` | Extracted from iLand SQLite | standid, year, shannon_H, simpson_1D, richness, total_ba |
| `stand_species_gini.csv` | Extracted from iLand SQLite | standid, year, species_evenness |
| `species_by_year_type.csv` | Extracted from iLand SQLite | species, behavioral_type, year, total_ba, n_stands |

## Important data filters

- **removal.csv**: Always filter `volumeThinning > 0 | volumeFinal > 0 | volumeSalvaged > 0` to exclude disturbance-only rows (iLand writes a row whenever `disturbedTimber > 0`, even without harvest).
- **Set-aside stands**: ~80% of PA stands are set-aside. Either exclude them (fig_03) or show as separate category (fig_02). Check `is_set_aside` column in `soco_stand_state`.
- **Endpoint metrics**: Use years 150-200 (fig_08) or 180-200 (fig_07) to avoid transient initialization effects.
