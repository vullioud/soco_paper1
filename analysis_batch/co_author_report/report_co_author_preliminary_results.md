# SoCoABE: Exploratory Design and Preliminary Results

*Companion to [`report_co_author.md`](../report_co_author.md) (model description, Sections 1-6). Read that document first for model mechanics, trait architecture, and silvicultural details. This document continues with the exploratory experimental setup (Part 2) and diagnostic/outcome figures (Part 3).*

> **Status**: Preliminary OAT results (11 runs, 200 sim-years each).
> **Date**: March 2026
> **Data**: `output/_combined/` -- all CSVs merged across runs.
> **Figures**: `analysis_batch/co_author_report/figures/`

---

## PART 2: EXPLORATORY EXPERIMENTAL DESIGN

### 7. Overview and the One-At-a-Time (OAT) Approach

Before committing to a computationally expensive full-factorial design, we conducted an exploratory batch of **11 simulations**. The goals are twofold: (1) validate that the cognitive mechanisms, budget constraints, and silvicultural dispatch operate correctly; and (2) identify which experimental axes -- ownership composition, landscape initialization, disturbance regime -- drive the most variance in forest outcomes, and thus which factors to prioritize in a proper factorial design.

We used a **One-At-a-Time (OAT) sensitivity design**. A single **Reference Run** represents the center point in our parameter space:

> **Reference**: CL10 (Mixed landscape) / High (Clustered ownership) / contbb (Continuous bark beetle) / Replicate 1.

From this reference, we branch along four axes, changing one variable at a time while holding others constant.

| Run | Landscape | Aggregation | Disturbance | Replicate | OAT Arm |
|-----|-----------|-------------|-------------|-----------|---------|
| 1 | CL10 | High | contbb | 1 | **Reference** |
| 2 | CL10 | High | contbb | 2 | Replicate |
| 3 | CL10 | High | contbb | 3 | Replicate |
| 4 | CL10 | High | bb | 1 | Disturbance |
| 5 | CL10 | High | nod | 1 | Disturbance |
| 6 | CL10 | Random | contbb | 1 | Aggregation |
| 7 | CL10 | state_only | contbb | 1 | Aggregation |
| 8 | CL10 | big_only | contbb | 1 | Aggregation |
| 9 | CL10 | small_only | contbb | 1 | Aggregation |
| 10 | CL05 | High | contbb | 1 | Landscape |
| 11 | CL14 | High | contbb | 1 | Landscape |

### Key model parameters for this batch

| Parameter | Value | Description |
|-----------|-------|-------------|
| `POINTS_PER_STAND_PER_DECADE` | 3 | Budget = `resources x n_stands x PPS` |
| `MAX_CARRYOVER_FACTOR` | 2.0 | Unspent budget carries over (capped at 2x base) |
| `ALLOW_DEBT` | true | Agents can overshoot budget |
| `MAX_DEBT_FACTOR` | 0.5 | Floor = base x (1 - 0.5) = 50% of base budget |
| `DISTURBANCE_ENVELOPE` | 8 | Max extraction cost charged per salvage event |
| Simulation length | 200 years | |
| Landscape size | 400 stands (20x20 grid, 4 ha each) | 1600 ha total |

---

### 8. The Four Experimental Branches

#### 8.1 The Landscape Branch

To test the model's sensitivity to initial forest conditions, we run the model on three distinct 1600 ha (4 x 4 km) virtual landscapes. Each consists of a 20 x 20 grid of 4-hectare stands. Initial tree populations, soils, and climate data are derived from German National Forest Inventory (BWI) cluster data.

- **CL05** -- Lowland broadleaf/pine mix. No Norway spruce. Dominated by ash (16%), Scots pine (15%), pedunculate oak (12%), with ~35% spread across minor species.
- **CL10** -- Transitional montane mix. Norway spruce dominant (62%), with European beech (10%) and Scots pine (6%). **(Reference)**
- **CL14** -- Intermediate montane. Norway spruce (32%), European beech (20%), Scots pine (17%), with silver fir (5%) -- a more balanced conifer-broadleaf mix.

![Initial species composition](figures/fig_10_initial_species.png)
*Fig. 10 -- Initial species composition (% basal area) for the three landscapes at Year 1. Top 10 species shown; remaining grouped as "Other". CL05 has no spruce and high diversity; CL10 is spruce-dominated; CL14 is intermediate.*

#### 8.2 The Ownership Aggregation Branch

To test how the spatial arrangement and composition of agent types affect landscape outcomes, we varied the **ownership allocation table** across the 400 stands. The initial forest data (trees, saplings, soil) is identical across these runs; only the agent assigned to each stand changes.

- **High** -- All 5 behavioural types present. Ownership parcels are spatially clustered (high spatial autocorrelation). **(Reference)**
- **Random** -- All 5 types present, but stands are assigned randomly (highly fragmented ownership).
- **state_only** -- 100% of stands managed by MF (State) agents.
- **big_only** -- 100% of stands managed by OP (Corporate) agents.
- **small_only** -- 100% of stands managed by small private owners (a mix of TR, PA, EN drawn from the configured split: 40% TR, 30% PA, 30% EN).

![Ownership maps](figures/fig_ownership_maps.png)
*Fig. Ownership -- 20 x 20 stand grids colored by behavioural type for each aggregation scenario. "High" shows spatially clustered blocks; "Random" shows fragmented assignment; the three "X_only" scenarios are uniform.*

#### 8.3 The Disturbance Branch

Bark beetle dynamics are driven by iLand's process-based bark beetle module. We test three scenarios that vary the timing and intensity of disturbance pressure:

- **contbb** (Continuous) -- Constant, moderate bark beetle pressure from Year 0. Represents a "new normal" of chronic disturbance. **(Reference)**
- **bb** (Spike) -- A quiescent period allows forests to mature, followed by a transient outbreak probability spike around Year 100. Tests the system's response to an acute disturbance shock.
- **nod** (No Disturbance) -- Background infestation probability set near zero, effectively disabling bark beetle mortality. Serves as a pure management baseline.

#### 8.4 The Replicate Branch

To quantify stochastic initialization noise, the reference scenario is run with three different random seeds (Rep 1, 2, 3). These seeds alter the spatial allocation of initial trees to stands and the random draws for agent traits (resources, risk tolerance, adherence -- sampled within each type's configured distribution). This allows us to measure baseline variance against treatment effects.

---

### Metrics and Aggregation Levels

The following metrics are used throughout the analysis. Unless otherwise noted, values are computed **per stand per year** from iLand and SoCoABE outputs, then aggregated as described.

| Metric | Source | Definition | Unit |
|--------|--------|------------|------|
| **Volume** | `soco_stand_state` | Total standing timber volume per stand | m3/ha |
| **DBH Gini** | `soco_stand_state` | Gini coefficient of the diameter-at-breast-height distribution across all trees in a stand. Higher values = greater structural complexity (uneven-aged, multi-layered). Range: 0 (identical trees) to ~0.7. | -- |
| **Large tree density** | `soco_stand_state` | Count of trees with DBH > 40 cm, per hectare | n/ha |
| **Height layers** | `soco_stand_state` | Number of distinct canopy height layers detected in the stand | count |
| **Shannon H'** | `stand_shannon` | Shannon diversity index over tree species basal area shares per stand. Higher = more even species mix. | nats |
| **Species evenness** | `stand_species_gini` | 1 - Gini coefficient of species BA shares. 1.0 = perfectly even; 0 = monoculture. | -- |
| **Conifer share** | `species_by_year_type` | Fraction of total basal area from conifer species (piab, abal, lade, pisy, pini, psme, pice). Currently available at the behavioral-type level, not per stand (see Known Issues). | % |
| **Budget utilization** | `soco_decade_budget` | `budget_spent / budget_total x 100`. Computed per agent per decade. Values > 100% indicate the agent entered debt (see model description Section 3.3). | % |
| **Deferral rate** | `soco_decade_snapshot` | Fraction of managed stands with status = "deferred" out of all actively managed stands per decade | % |
| **Coefficient of Variation (CV)** | Derived | `sd / mean` across all 400 stands at a given year. Measures landscape-level spatial heterogeneity. Higher CV = more variation between stands. | -- |

**Aggregation conventions in OAT Quad plots**: Each row of a Quad figure filters to one OAT arm (e.g., the "Disturbance arm" row holds landscape=CL10 and aggregation=High constant while varying disturbance). Within each panel, lines show the **mean across all stands** of a given behavioural type at each year. Where replicates exist, values are averaged across replicates.

**Time binning**: Budget and planning diagnostics use 10- or 20-year bins to smooth decadal planning cycles.

---

## PART 3: PRELIMINARY RESULTS & DIAGNOSTICS

The following figures present the raw outputs from the exploratory OAT batch. They are intended to verify model mechanics and visualize structural and compositional trajectories. Interpretations and conclusions are intentionally kept brief for co-author review.

---

### 9. Model Validation (Sanity Checks)

This section verifies that the cognitive decision pipeline, budget constraints, and decadal planning produce expected behaviour patterns.

#### Fig. A1 -- Activity Timelines

![Activity timelines](figures/fig_A1_activity_timelines.png)
*15 panels tracking the volume trajectory (grey line, m3/ha) of 3 randomly sampled stands for each of the 5 behavioural types over 200 years. Colored dots mark the year a cognitive activity decision was executed. Dot color encodes the specific activity (e.g., shelterwood, clearcut_planting, selectiveThinning). Triangles denote salvage extraction events triggered by bark beetle disturbance. Filter: reference scenario (CL10 / High / contbb / rep 1). Source: `soco_stand_state` (volume) + `soco_ml_activities` (decisions).*

Key observations:
- MF and OP stands show regular harvest-regeneration cycles (volume ramps up, sharp drops at final cuts).
- PA stands show minimal intervention -- long periods of volume growth with few or no activity dots.
- EN stands show selective thinning and plenter management (gradual volume adjustments without clear-cuts).
- Salvage triangles cluster around disturbance events, particularly visible in stands where volume drops sharply.

#### Fig. A4 -- Decision Heterogeneity

![Decision heterogeneity](figures/fig_A4_decision_heterogeneity.png)
*Left panel: Stacked bar chart showing the relative frequency (%) of specific activity choices across all simulation years, grouped by behavioural type. Right panel: Boxplot of Simpson's Diversity Index (D) calculated over the activity portfolio of each individual agent. Higher D = more diverse management repertoire. Filter: reference scenario. Source: `soco_ml_activities`.*

Key observations:
- MF agents use predominantly clearcut_planting and shelterwood sequences -- classic even-aged silviculture.
- EN agents are dominated by selectiveThinning and plenter management -- continuous-cover approaches.
- PA agents have very few activity events overall (most stands are idle or set-aside).
- Simpson's D is highest for TR and EN agents, reflecting broader activity repertoires.

#### Fig. 11 -- Phase Classification Agreement

![Phase agreement](figures/fig_11_phase_agreement.png)
*Left: Confusion matrix comparing age-based vs. structural phase assignment across all managed stands and years. Rows = age-based phase; columns = structural phase. Cell values = % of the age-based phase that maps to each structural phase. Right: Agreement rate (%) over time, one line per behavioural type. Filter: reference scenario, set-aside excluded. Overall agreement: 69%. Source: `soco_stand_state` (columns `age_phase`, `structural_phase`, `phase_match`).*

Key observations:
- Harvesting and Planting phases show high agreement (86% and 78% respectively) -- stands that are structurally mature or recently devastated are consistently classified by both methods.
- Tending shows the most disagreement (only 54% match): many stands that are "Tending-age" are structurally already in Thinning (27%) or even Planting (17%). This reflects that structural development can outpace or lag behind calendar age depending on site quality and disturbance history.
- Agreement increases over time (from ~50% to ~75%) as the forest converges toward a management-driven structural equilibrium where age and structure become more aligned.

#### Fig. D2 -- Stand Status Composition

![Stand status composition](figures/fig_D2_stand_status_composition.png)
*Stacked bar charts tracking the fraction of stands in different planning states -- Committed (scheduled this decade), Ongoing (multi-year activity in progress), Deferred (planned but postponed), Blocked (cannot proceed), Set-aside (permanently unmanaged), Idle (no plan needed) -- over 200 years. 20-year bins. Faceted by disturbance scenario (rows) x owner group (columns: State, Corporate, Small Private). Filter: CL10, High, rep 1. Source: `soco_decade_snapshot`.*

Key observations:
- Set-aside stands (dark band) are almost exclusively from Small Private agents -- ~80% of PA stands are set-aside by design.
- Deferred stands increase after Year 100 in the bb-spike scenario, especially for Small Private owners, reflecting budget pressure from post-disturbance salvage costs.
- State and Corporate agents maintain most stands in Committed/Ongoing status throughout.

#### Fig. D3 -- Budget & Salvage Diagnostics

![Salvage budget breakdown](figures/fig_D3_salvage_budget_breakdown.png)
*4-panel diagnostic. **Panel A**: Total salvage volume extracted by iLand's automatic disturbance handler (m3/ha), stacked by behavioural type and faceted by disturbance scenario. This extraction is handled automatically by iLand's C++ engine before SoCoABE gets control -- it is NOT a cognitive decision. **Panel B**: Mean budget allocation per agent-decade, split into Salvage replanting cost / Regular management cost / Unspent, faceted by disturbance scenario. **Panel C**: Median budget utilization (%) over time, one line per behavioural type. Dashed line = 100%. Values above 100% indicate debt usage: the `ALLOW_DEBT` mechanism lets agents overshoot their base budget by up to 50% (i.e., budget floor = base x 0.5), carrying the negative balance forward as reduced budget next decade. **Panel D**: Same as Panel C but splitting agents into disturbance-hit (solid) vs. not-hit (dotted). Filter: CL10, High, rep 1. Source: `soco_decade_budget` + `soco_ml_activities`.*

Key observations:
- Panel A: Salvage volume is negligible under contbb but spikes dramatically after Year 100 in the bb scenario. The nod scenario has zero salvage by design.
- Panel B: Under nod, most budget is spent on regular management with substantial unspent surplus. Under bb, salvage replanting costs (yellow) consume a visible share after Year 100.
- Panel C: PA agents (orange) consistently exceed 100% utilization even in the no-disturbance scenario. This is structural: PA agents have very low resources (E[resources]=0.10), so a PA agent managing 6 stands gets `budget = floor(0.10 x 6 x 3) = 1 point`. Any single activity costs at least 2 points (tending, thinning) or 3+ (planting, sequences), so the agent enters debt on the first action. The debt mechanism caps the deficit at 50% of base budget and carries it forward, creating a chronic overshoot pattern.
- Panel D: In disturbance scenarios, hit agents show slightly higher utilization than non-hit agents of the same type, but the dominant pattern is type-driven (resource level), not disturbance-driven.

---

### 10. Exploratory Outcomes

This section presents the biophysical outcomes -- forest structure, species composition, and harvest flows -- across the experimental branches.

#### Fig. 02 -- Phase Distribution Over Time

![Phase distribution](figures/fig_02_phase_distribution.png)
*Stacked area charts showing the fraction of stands classified into each structural phase -- Planting (recently regenerated), Tending (young stand care), Thinning (mid-rotation stand improvement), Harvesting (mature, approaching or in final cut), and Set-aside (permanently unmanaged) -- across the 200-year reference run. One facet per behavioural type. Phases are assigned by SoCoABE based on stand structural metrics (volume, DBH, stem density, top height -- see model description Section 3.2). Filter: reference scenario. Source: `soco_stand_state`.*

Key observations:
- MF and OP show regular cycling through phases -- stands move from Planting to Tending to Thinning to Harvesting and back.
- PA is dominated by Set-aside (grey), with the remaining managed stands largely stuck in Thinning/Harvesting (mature, uncut).
- EN shows a persistent mix of Thinning and Harvesting phases, consistent with continuous-cover management that avoids clear-felling.

#### Fig. 03 -- Ridge Plots by Phase

![Ridge plots by phase](figures/fig_03_ridge_by_phase.png)
*16-panel grid of density ridge plots (ggridges). Columns = the four structural phases (Planting, Tending, Thinning, Harvesting); rows = four structural metrics (DBH Gini, Volume m3/ha, Large trees n/ha, Height layers). Within each panel, density curves are colored by behavioural type. Evaluated over years 100-200 to avoid transient initialization effects, excluding set-aside stands. Filter: reference scenario. Source: `soco_stand_state`.*

Key observations:
- Within each phase, distributions overlap substantially across types -- the structural phase assignment groups stands by structural similarity regardless of owner type. This validates the phase engine as a meaningful classification.
- In the Harvesting phase, EN stands tend toward higher DBH Gini and more large trees than MF/OP stands, reflecting their preference for selective rather than clear-cut harvesting.
- Volume distributions in the Thinning phase are widest, reflecting the broad range of stand conditions captured by this mid-rotation phase.

#### Fig. 04 -- Disturbance Recovery

![Disturbance recovery](figures/fig_04_disturbance_recovery.png)
*3-panel tracking plot for stands that suffered "full devastation" -- defined as volume dropping from >50 to <10 m3/ha in a single step (bark beetle kill followed by salvage clearcut). **Panel A**: Volume recovery trajectories over the 80 years following the reset event. Thin lines = individual stand cohorts colored by behavioural type (alpha=0.2); bold lines = mean per type. **Panel B**: Shannon H' recovery over the same window. **Panel C**: Scatter of management activities executed during recovery, colored by activity type. Filter: CL10, High, contbb+bb, rep 1. N = 298 reset events detected. Source: `soco_stand_state` + `stand_shannon` + `soco_ml_activities`.*

Key observations:
- Volume recovery is broadly similar across types for the first 30-40 years (driven by the same iLand growth processes), but diverges thereafter as management choices differ.
- Shannon diversity tends to be higher for EN-managed stands during recovery, consistent with their mixed-species planting preferences.
- MF and OP stands show concentrated planting activity immediately after reset, while PA stands show fewer interventions during recovery.

#### Fig. B1 -- Structural Complexity (DBH Gini) -- OAT Quad

![DBH Gini OAT](figures/fig_B1_dbh_gini_oat.png)
*4-panel OAT Quad. Each panel = one experimental arm. Lines show the mean DBH Gini across all stands per behavioural type per year. Higher DBH Gini = more structural complexity (uneven diameter distribution). The aggregation arm compares the 5 ownership scenarios; the landscape arm compares CL05/CL10/CL14; the disturbance arm compares contbb/bb/nod; the replicate arm shows 3 replicates. Source: `soco_stand_state`.*

Key observations:
- EN agents consistently maintain higher structural complexity than other types across all arms.
- The landscape arm shows the largest differences: CL05 starts with very different structural conditions.
- Disturbance (bb spike) causes a temporary dip in Gini around Year 100 as bark beetle selectively kills large conifers, then recovery.
- Replicates track each other closely, suggesting low initialization noise for this metric.

#### Fig. B4 -- Annual Harvest -- OAT Quad

![Harvest OAT](figures/fig_B4_annual_harvest_oat.png)
*4-panel OAT Quad. Stacked area showing total annual harvest volume (m3/yr) across the landscape, split into Management Harvest (blue, planned thinning + final cuts) and Salvaged (yellow/green, dead timber automatically extracted by iLand following disturbance). Faceted by scenario within each arm. From `removal.csv`, excluding disturbance-only rows (rows where volume was disturbed but not extracted by management).*

Key observations:
- Management harvest volume is relatively stable at ~2000-4000 m3/yr across most scenarios.
- The bb-spike scenario shows a dramatic salvage spike at Year 100, dwarfing regular management harvest.
- The state_only scenario shows the highest regular harvest volumes, consistent with MF agents' intensive management style.
- CL05 shows lower harvest volumes overall, reflecting its lower initial stocking and different species composition.

#### Fig. 06 -- Landscape Heterogeneity

![Landscape heterogeneity](figures/fig_06_landscape_heterogeneity.png)
*4 panels comparing the 5 aggregation scenarios for the reference landscape (CL10, contbb, rep 1). Top row: landscape-wide Mean Volume and Mean DBH Gini (averaged across all 400 stands per year). Bottom row: Coefficient of Variation (CV = sd/mean across stands) for Volume and DBH Gini. Higher CV = greater spatial heterogeneity between stands. Source: `soco_stand_state`.*

Key observations:
- Mean volume and mean DBH Gini converge across aggregation scenarios over time -- the landscape average is similar regardless of ownership arrangement.
- However, **Volume CV** diverges: the "High" (clustered) scenario maintains higher spatial heterogeneity than "Random" or the uniform scenarios. Spatially clustered ownership creates landscape-level structural mosaics because adjacent stands under the same owner are managed synchronously.
- The uniform scenarios (state_only, big_only, small_only) show the lowest CV, as all stands are managed under the same philosophy.

#### Fig. 07 -- Species Composition Space

![Species space](figures/fig_07_species_space.png)
*2D scatterplot of endpoint stand states (averaged over years 180-200). X-axis: Conifer share (% of basal area). Y-axis: Shannon Diversity (H'). Each point = one stand, colored by managing agent's behavioural type. Ellipses = 50% concentration area per type. Filter: reference scenario. Shannon H' is computed per stand from `stand_shannon`. Conifer share is computed at the behavioral-type level from `species_by_year_type` (per-stand species BA is not currently extracted from iLand's output database -- see Known Issues). Source: `stand_shannon` + `species_by_year_type`.*

Key observations:
- EN stands cluster toward lower conifer share and higher Shannon diversity -- consistent with their preference for mixed-species, broadleaf-promoting management.
- MF and OP stands have higher conifer share, reflecting continued spruce-oriented management.
- PA stands show wide spread -- their passive management leads to diverse outcomes depending on initial stand composition and disturbance history.

#### Fig. 09 -- Species Composition Over Time

![Species composition](figures/fig_09_species_composition.png)
*Stacked area charts showing basal area share (%) of the top 10 species + "Other" over 200 years. 4-row OAT layout (one row per arm). Within each arm, panels show different scenarios. Species: Norway spruce (piab), European beech (fasy), Silver fir (abal), Scots pine (pisy), Pedunculate oak (qupe), Sycamore maple (acps), Sessile oak (quro), Ash (frex), Douglas fir (psme), Hornbeam (cabe). Source: `species_by_year`.*

Key observations:
- Norway spruce dominates throughout in CL10 and CL14, but its share gradually declines as beech and fir expand -- a realistic succession pattern driven by shade-tolerant species replacing pioneer conifers.
- CL05 is the outlier: no spruce, dominated by ash and pine, with high species diversity from the start.
- The bb-spike scenario shows a visible dip in spruce share after Year 100 (bark beetle preferentially kills spruce), with beech and fir filling the gap.
- Aggregation and replicate arms show minimal species-level differences -- species composition is driven primarily by landscape initialization and disturbance, not by ownership.

---

### 11. Known Issues and Limitations

1. **TargetDBH on even-aged stands produces near-clearcuts.** When a stand is classified in the Harvesting phase and the agent draws `targetDBH`, the activity removes all trees exceeding the species-specific target diameter. In even-aged stands where most trees have reached the target simultaneously, this can remove nearly the entire canopy -- functionally equivalent to a clearcut. A volume-cap safeguard limits removal to 40% of standing basal area (falling back to 20% volume removal), but this still produces heavy harvests. This explains the sharp volume drops visible in MF/OP stands during the Harvesting phase (Fig. A1) and contributes to the volume floor patterns in stand biographies.

2. **Salvage extraction bypasses the cognitive pipeline.** iLand's C++ engine automatically extracts 100% of dead stems from all stands (managed and set-aside) via the `onAfterDisturbance` handler in the Mega-STP. This extraction happens before SoCoABE gets control -- the agent cannot choose partial extraction, delay it, or skip it. The extraction cost is then charged to the agent's budget as a forced tax. The agent's only real decision is the *remnant* management: clearcut the survivors and replant, or leave them. This design reflects the phytosanitary obligation in Central European forestry law but limits agent differentiation in disturbance response to the post-extraction decision only.

3. **Budget overshoot by low-resource agents.** PA agents (E[resources] = 0.10) consistently exceed 100% budget utilization because their budgets are extremely small (often 1-3 points) while even the cheapest activity costs 2 points (thinning, tending). The mechanism: `budget = floor(0.10 x 6 stands x 3 PPS) = 1 point`. Agent draws tending (cost=2) -> budget goes to -1. Next decade: `base=1, carryover=-1, ALLOW_DEBT=true` -> `budget = max(1 + (-1), floor(1 x 0.5)) = max(0, 0) = 0`. The floor ensures a minimum budget of `base x 0.5 = 0`, so the agent can still act but immediately goes back into debt. This creates a chronic overshoot cycle visible in Panel C of Fig. D3. This is arguably realistic -- passive owners lack resources but still perform minimal management -- but means PA agents are never truly budget-constrained in the way MF/OP agents could be during disturbance peaks.

4. **Conifer share at type level, not per stand.** The current post-processing pipeline extracts species composition aggregated by behavioral type (`species_by_year_type`), not per individual stand. This means conifer share in Fig. 07 is identical for all stands of the same type (jittered for visualization). Per-stand species BA extraction from iLand's SQLite output database would improve this figure and enable true stand-level species-composition analysis.
