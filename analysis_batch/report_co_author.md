# SoCoABE: Model Description and Experimental Design

*Working document for co-author review — March 2026*

---

## Document structure

This document describes SoCoABE (Social-Cognitive Agent-Based Engine), a behavioural agent layer coupled to the iLand forest landscape simulator. **Part 1** covers the model itself: who the agents are (Section 2), how they make decisions (Section 3), how species composition is regulated (Section 4), and what assumptions underpin the design (Section 5). Section 6 collects open questions for co-author review before committing to the final experimental design. **Parts 2 and 3** continue in the companion document ([`report_co_author_preliminary_results.md`](report_co_author_preliminary_results.md)) with the exploratory experimental setup, diagnostics, and preliminary results.

Technical details on code architecture, signal dispatch, configuration files, and monitoring outputs are in **Supplement S1**.

---

## PART 1: THE MODEL

---

### 1. Overview

SoCoABE investigates how the diversity of forest management — arising from heterogeneous ownership, goals, and capacities — shapes forest ecosystem trajectories in a time of increasing disturbance. The central question is: **does behavioural heterogeneity among forest owners affect landscape-level forest structure, species composition, and resilience to disturbance over centennial time scales, and if so, how?**

The model couples a behavioural agent layer to iLand (Seidl et al. 2012, Rammer & Seidl 2015), a process-based forest landscape simulator that handles tree-level growth, mortality, regeneration, and disturbance. SoCoABE replaces iLand's standard stand treatment programmes (STPs) with a single universal "Mega-STP" controlled by cognitively heterogeneous forest-owner agents. Each agent perceives its stands through iLand's biophysical outputs, forms budget-constrained decadal management plans, and executes silvicultural activities by dispatching signals back to iLand through the Mega-STP. iLand then handles the actual tree-level selection and removal.

The model is organised in three hierarchical layers:

- **Institution** — holds landscape-level information: silvicultural guidelines (WET reference compositions, see Section 4), the Mega-STP activity catalogue, and global parameters. In Paper 1, a single institution governs the entire landscape.
- **Type** — defines the meta-distributions over agent traits and activity preferences. Five behavioural types (Section 2) encode different management philosophies. Each type specifies the shape of the distributions from which individual agents sample their traits.
- **Agent** — the decision-making unit. Each agent owns a set of forest stands (a management unit), draws individual traits from its type's distributions at initialization, and executes a yearly cognitive cycle of observation, planning, and action (Section 3).

The coupling runs for 200 simulated years on a 400-stand landscape (4 km × 4 km, 1600 ha). Five ownership scenarios test different spatial configurations of owner types. Bark beetle disturbance is applied as a continuous background pressure or disabled entirely to isolate the interaction between management heterogeneity and disturbance.

---

### 2. Behavioural Types and Trait Architecture

The diversity of forest management is the core subject of SoCoABE. This section describes who the agents are — what distinguishes them, how their traits are drawn, and how those traits translate into different management behaviour. The mechanistic detail of *how* decisions are made follows in Section 3.

#### 2.1 The Five Behavioural Types

The typology draws on Sotirov et al.'s empirical classification of Central European forest owners. Five types capture the main axes of variation observed in ownership surveys: management intensity (from professional to passive), goal orientation (production vs. biodiversity vs. multifunctional), and institutional embeddedness (adherence to state silvicultural guidelines).

| Code | Label | Owner pool | Characterisation |
|---|---|---|---|
| **MF** | Multifunctional | State (100%) | Balanced production/biodiversity/carbon goals. High resources, professional staff, strong guideline adherence. Benchmark for "good practice" management. |
| **OP** | Output-oriented Private | Large private (100%) | Production-focused, well-resourced, low guideline adherence. Favours intensive harvesting and conifer monocultures. |
| **TR** | Traditional | Small private (40%) | Production-leaning but moderately engaged. Limited resources, moderate guideline adherence. |
| **PA** | Passive | Small private (30%) | Minimal engagement. Very low resources and adherence. 80% of stands permanently set aside — effectively unmanaged. |
| **EN** | Environmentalist | Small private (30%) | Biodiversity-focused, moderate resources, relatively high guideline adherence. Favours continuous-cover forestry and species diversification. |

The mapping between types and owner pools is fixed: all State forest stands are managed by MF agents, all Large private stands by OP agents, and Small private stands are randomly assigned to TR, PA, or EN at the proportions above.

#### 2.2 Ownership Structure

The landscape is divided among three owner pools with fixed area shares:

| Owner pool | Area share | Behavioural type(s) | Agent sizing (ZTP λ) | Max stands/agent | Typical agent count |
|---|---|---|---|---|---|
| State | 30% (120 stands) | MF | 10 | 42 | ~12 |
| Large private | 25% (100 stands) | OP | 15 | 60 | ~7 |
| Small private | 45% (180 stands) | TR 40%, PA 30%, EN 30% | 5 | 20 | ~34 |

Agents are assigned multiple stands via Zero-Truncated Poisson (ZTP) draws. State agents manage ~10 stands on average (large management units); small private agents manage ~5 stands (fragmented ownership). Agent counts are stable across replicates (small private: 34–39, state: ~12, large private: 7–8).

#### 2.3 Trait Architecture

At initialization, each agent draws three trait values from its type-specific distributions. Traits remain fixed for the agent's lifetime (no learning or adaptation in this version).

**Preferences** (Dirichlet, 3 dimensions: Production / Biodiversity / CO₂ storage) — express the agent's management goals. Not directly consumed by the decision engine in Paper 1 but determine the agent's "identity" and will drive goal-weighted utility in Paper 2.

**Resources** (Beta distribution, 0–1) — directly multiplies the agent's decadal budget (see Section 3.3). Higher resources = more management capacity per decade.

**Adherence** (Beta distribution, 0–1) — controls how much the agent's activity preferences are pulled toward the institutional guideline (Section 2.5). High adherence = converges toward MF-like management; low adherence = follows own type's preferences.

| Type | Preferences (Dirichlet α: P/B/C) | Resources (Beta a, b) | E[Res] | Adherence (Beta a, b) | E[Adh] |
|---|---|---|---|---|---|
| MF | [3, 6, 5] | (8, 2) | 0.80 | (9, 1) | 0.90 |
| OP | [8, 1, 3] | (7, 3) | 0.70 | (4, 6) | 0.40 |
| TR | [3, 4, 2] | (3, 7) | 0.30 | (3, 7) | 0.30 |
| PA | [1, 3, 1] | (1, 9) | 0.10 | (1, 9) | 0.10 |
| EN | [1, 9, 3] | (5, 5) | 0.50 | (6, 4) | 0.60 |

*Interpretation example:* An MF agent with E[Resources] = 0.80 managing 50 stands gets a decadal budget of ~400 points. A PA agent managing the same stands gets ~50 points. This budget constrains how many stands can be actively managed per decade (Section 3.3).

[FIGURE: Panels showing Beta/Dirichlet density curves for each trait, one curve per type, with expected values marked]

#### 2.4 Set-Aside Rates

At initialization, each stand has an independent Bernoulli draw determining whether it is permanently set aside from management. Set-aside stands receive `noManagement` every year from SOCO's planning system. However, when disturbance strikes, iLand's C++ engine still auto-extracts dead stems from set-aside stands (because all stands share the same Mega-STP). The extraction cost (8-pt envelope × severity) is charged to the agent's budget as a forced tax, but no remnant management decision is made — the stand recovers via natural regeneration only.

| Type | MF | OP | TR | PA | EN |
|---|---|---|---|---|---|
| Set-aside probability | 0.03 | 0.02 | 0.15 | 0.80 | 0.35 |

PA agents set aside 80% of their stands — a permanent allocation consistent with the observation that passive owners tend to simply not intervene. EN agents set aside 35%, reflecting a deliberate conservation choice. On managed stands, disturbance triggers the full salvage pipeline (extraction cost + remnant decision). On set-aside stands, dead stems are still physically extracted by iLand's C++ engine and the extraction cost is charged, but no remnant management (clearcut/leave) decision is made.

#### 2.5 Activity Preferences

Each type has Dirichlet alpha vectors per management phase that control which silvicultural activities are drawn when the agent plans a stand. In a Dirichlet distribution, the alpha values control the expected probability of each option: higher values mean higher expected share, and the ratio between alphas matters more than their magnitude. For example, alphas of [4, 1] give ~80%/20% expected probabilities; [8, 2] give the same expected shares but with less variance (more consistent draws across agents of the same type).

The effective alpha vector is a blend of the agent's type-specific preferences and the institutional guideline (= MF's distribution), weighted by the agent's adherence trait:

> **α_effective** = **adherence** × **α_guideline** + (1 − **adherence**) × **α_type**

High-adherence agents (MF: E[adherence] = 0.9) converge toward the guideline; low-adherence agents (PA: E[adherence] = 0.1) follow their own preferences almost exclusively.

**Harvesting phase** (7 options — activities described in Section 3.5):

| Activity | MF | OP | TR | PA | EN |
|---|---|---|---|---|---|
| shelterwood_planting | 3 | 2 | 2 | — | 1 |
| shelterwood_no_planting | 1 | 1 | 3 | — | 0.5 |
| targetDBH | 3 | 1 | 1 | 3 | 3 |
| clearcut_planting | 0.5 | 4 | 1 | — | 0.5 |
| plenter_harvest | 3 | 0.5 | 0.5 | 2 | 3 |
| femel_planting | 4 | 1 | 1 | — | 4 |
| femel_no_planting | 1 | 0.5 | 1 | — | 1 |

PA agents only have targetDBH and plenter_harvest available — no clearcut, no shelterwood, no femel. MF and EN favour femel and plenter (continuous-cover forestry). OP strongly favours clearcut (production-maximising).

**Thinning phase** (4 options):

| Activity | MF | OP | TR | PA | EN |
|---|---|---|---|---|---|
| selectiveThinning | 4 | 2 | 2 | 1 | 3 |
| thinningFromBelow | 3 | 5 | 3 | 1 | 1 |
| plenter_thinning | 2 | 0.5 | 0.5 | 1 | 2 |
| noManagement | 0.5 | 1 | 2 | 5 | 1 |

PA agents overwhelmingly draw noManagement in thinning (α = 5 vs 1 for active options). OP agents strongly prefer thinningFromBelow (production-oriented).

**Tending phase** (2 options):

| Activity | MF | OP | TR | PA | EN |
|---|---|---|---|---|---|
| tending | 8 | 5 | 4 | 1 | 6 |
| noManagement | 1 | 3 | 4 | 8 | 2 |

**Planting phase** (2 options):

| Activity | MF | OP | TR | PA | EN |
|---|---|---|---|---|---|
| planting | 7 | 6 | 3 | 1 | 5 |
| noManagement | 1 | 2 | 4 | 8 | 2 |

#### 2.6 Disturbance Response

Disturbance response operates in two phases: an immediate **extraction phase** handled automatically by iLand's C++ engine, and a deferred **remnant management decision** handled by the agent in the next decadal planning cycle.

**Phase 1 — Extraction (automatic).** When bark beetle or wind kills trees on a managed stand, iLand's C++ salvage routine automatically removes 100% of dead stems. This reflects the phytosanitary obligation in Central European forestry law: dead bark beetle timber must be extracted to limit spread. The extraction is not a management choice — it is a forced cost imposed on the agent. An 8-point "disturbance envelope" charges the agent proportional to severity:

> **extraction_cost** = round(8 × severity_fraction)

where severity_fraction = killed volume / (killed + surviving volume), both in m³/ha. This cost is deducted immediately from the agent's budget as a forced tax (Section 3.3).

**Phase 2 — Remnant management (deferred).** After extraction, the agent must decide what to do with the surviving trees. This decision is deferred to the next `plan_decade` cycle (Section 3.3, Step 2.5), where it competes for budget alongside regular management. The agent draws between two options via a severity-modulated weighted random choice:

- **salvage_clearcut**: remove all surviving trees, replant next year. 2-step sequence. Cost: max(0, 8 − extraction_cost) + 3 planting points. The total cost for extraction + clearcut + planting is always 11 points regardless of severity — only the split between extraction and remnant clearing changes.
- **salvage_leave**: no further intervention. Cost: 0 points. Stand re-enters normal planning with surviving trees intact.

The draw weights are type-specific and modulated by severity. Higher severity increases the clearcut weight:

> **P(clearcut)** = (w_cc × severity) / (w_cc × severity + w_lv)

| Type | w_cc (clearcut base weight) | w_lv (leave base weight) | Behaviour |
|---|---|---|---|
| MF | 6.0 | 1.5 | Strong clearcut bias at moderate-to-high severity |
| OP | 8.0 | 1.0 | Very strong clearcut bias — production-oriented cleanup |
| TR | 1.5 | 4.0 | Mostly leave — limited resources for salvage operations |
| PA | 0.1 | 6.0 | Almost always leave — minimal engagement |
| EN | 0.5 | 6.0 | Strong leave bias — favours natural regeneration |

*Example:* At 50% severity, an OP agent draws clearcut with probability 8.0×0.5 / (8.0×0.5 + 1.0) = 80%. At 10% severity, the probability drops to 44%. A PA agent at 50% severity draws clearcut with only 0.8% probability.

The deferred decision creates an important temporal dynamic: extraction costs are paid in the year of disturbance, but the remnant decision waits until the next planning cycle. This means a severe bark beetle wave first depletes budget through extraction taxes, then further constrains the agent when remnant decisions come due — a two-wave budget shock.

#### 2.7 Species-Related Differentiation

Types also differ in how they regulate species composition (thinning selectivity, target harvest diameters, planting species mix, plenter equilibrium curves). These mechanisms are consolidated in Section 4.

---

### 3. Agent Decision-Making

#### 3.1 The Cognitive Cycle

Every simulation year, each agent executes a four-stage loop over all its managed stands:

**Observe.** The agent reads each stand's current biophysical state from iLand: volume (m³/ha), basal area (m²/ha), top height (m), mean DBH (cm), stem count (N/ha), and age (yr). Disturbance flags (salvage needed, severity, damaged volume) are read as one-shot signals — cleared immediately after reading. The structural phase engine (Section 3.2) classifies each stand into one of four management phases. The WET classifier (Section 4) assigns a forest development type based on current species composition. The phase determines *what kind of management* the stand needs (plant, tend, thin, or harvest); the WET type determines *which species to favour or suppress* during that management.

**React (every year).** A per-stand reactive layer fires in strict priority order:

1. *Set-aside check* — stands marked `is_set_aside` are excluded from SOCO's management pipeline. If the stand was disturbed, the extraction cost is still deducted (forced tax — C++ auto-extracted the dead trees), but no remnant decision is made and the function returns immediately.
2. *Disturbance detection* — if iLand flags a managed stand as needing salvage, the extraction cost is transferred from the stand flag to the agent's budget as a forced tax (Section 2.6). The stand is marked for post-disturbance remnant management but no activity is assigned yet — the remnant decision is deferred to the next decadal planning cycle (Section 3.3, Step 2.5). Any ongoing sequence on the stand is interrupted.
3. *Ongoing sequences* — for stands with active multi-step activities (shelterwood, femel, selective thinning, salvage_clearcut), the timeline pointer advances.
4. *Actionability* — a stand is marked actionable only when its scheduled target year equals the current simulation year.

**Plan (every 10 years).** The agent runs a budget-constrained decadal planner (Section 3.3). Each agent has a staggered planning offset drawn uniformly from 5–14 years at initialization, preventing artificial synchronization of landscape-level management pulses.

**Act (every year).** Actionable stands are sorted by utility score (descending) and executed. The appropriate signal is dispatched to the Mega-STP, which delegates to iLand's tree-level harvest routines.

[FIGURE: Cognitive cycle flowchart — Observe → React → [every 10 yr: Plan Decade] → Act. Disturbance detection in React deducts extraction cost; remnant decision (clearcut/leave) is processed in Plan Decade Step 2.5]

#### 3.2 Structural Phase Classification

SoCoABE classifies stands into management phases based on structural metrics rather than rotation age. Disturbance resets stand structure but not calendar age — a 120-year-old spruce stand devastated by bark beetle is structurally in the Planting phase regardless of its age. An age-based fallback engine exists but is not used in Paper 1.

**Phase assignment.** Rules are evaluated in priority order — earlier rules take precedence:

| Phase | Rule | Default threshold |
|---|---|---|
| **Planting** | volume < planting_max_volume | 10 m³/ha |
| **Tending** | stems > tending_stem_threshold | 1050 stems/ha (species-specific) |
| **Harvesting** | mean_dbh ≥ harvest_min_dbh OR top_height ≥ harvest_entry_top_height | 35 cm / 32 m (species-specific) |
| **Thinning** | Everything else | — |

The priority order ensures catastrophic volume loss always triggers Planting, dense regeneration triggers Tending, maturity triggers Harvesting. Thinning is the residual phase. Tending is purely density-driven (stem count), reflecting that tending is needed when regeneration is dense enough to cause competition.

**Asymmetric transition thresholds.** To prevent noise-driven phase oscillation, the engine uses stricter thresholds for backward transitions than for forward ones. A `last_completed_phase` anchor tracks the most recently completed management activity. Forward transitions are always accepted; backward transitions require crossing stricter regression thresholds (e.g., forward to Harvesting at mean_dbh ≥ 35 cm, regression from Harvesting to Thinning at mean_dbh < 25 cm). If neither threshold is crossed, the phase holds at the anchor.

Salvage does not directly change the phase — it removes trees, which changes stand metrics. The phase engine re-evaluates the following year. A severe salvage clearcut typically drops volume below 10 m³/ha, causing reclassification to Planting.

**Species-specific thresholds.** The stand's dominant species (highest basal area share) determines which thresholds apply. Loosely parameterised from WET 2024:

| Species | Tend. stems | Regr. tend. | Harvest min DBH | Harvest top H | Regr. thin. DBH | FF tend | FF thin | FF harv |
|---|---|---|---|---|---|---|---|---|
| default | 1050 | 1800 | 35 | 32 | 25 | 35 | 45 | 70 |
| piab (spruce) | 1150 | 2000 | 50 | 32 | 35 | 25 | 35 | 60 |
| fasy (beech) | 1050 | 1700 | 55 | 35 | 38 | 40 | 50 | 80 |
| quro/qupe (oak) | 950 | 1700 | 70 | 35 | 45 | 50 | 65 | 110 |
| psme (Douglas fir) | 850 | 1500 | 50 | 38 | 35 | 25 | 35 | 60 |
| pisy (Scots pine) | 950 | 1700 | 45 | 28 | 30 | 30 | 40 | 65 |
| abal (silver fir) | 1250 | 2000 | 50 | 35 | 35 | 30 | 40 | 70 |
| lade (larch) | 850 | 1500 | 45 | 30 | 30 | 25 | 35 | 55 |

All planting_max_volume = 10 m³/ha. FF = force-forward timeout (years): a safety net that unblocks stands stuck in a phase beyond this duration. The harvest_min_dbh values align with WET 2024 Zieldurchmesser (WET 2024, Anhang Tabelle 8).

#### 3.3 Budget System and Decadal Planning

The decadal planner allocates a finite budget across stands. The budget is an abstraction over money, labour, and attention — it creates emergent trade-offs without requiring empirical cost data.

**Budget computation:** B = floor(resources × N_all_stands × PPS), where PPS = 3 points per stand per decade, and `N_all_stands` includes set-aside stands. Positive carryover capped at 2× base; negative carryover (debt) floors budget at 0.5× base.

**Planning sequence:**

*Step 1 — Ongoing commitments.* Stands in multi-step sequences are pre-committed. Costs deducted first.

*Step 2 — Harvest selection.* Sustained-yield cap: harvest_target = ceil(N_all_stands / 8 × HARVEST_INTENSITY). The multiplier controls how many stands enter the harvest queue per decade, not rotation length:

| Type | MF | OP | TR | EN | PA |
|---|---|---|---|---|---|
| HARVEST_INTENSITY | 1.0 | 1.2 | 0.6 | 0.3 | 0.3 |

Candidates sorted by mean DBH (descending). For each: draw activity from Dirichlet, look up parameters, build schedule, check cost. If unaffordable, defer (deferral counter increments, boosting priority next decade).

*Step 2.5 — Post-disturbance remnant management.* Stands flagged for post-disturbance processing (Section 2.6) are evaluated before the unified queue. For each, a severity-modulated weighted draw determines clearcut vs. leave. If clearcut is drawn, the cost (8 − extraction_paid + 3) is checked against remaining budget. If affordable, the salvage_clearcut + planting sequence is committed. If not, the stand is deferred to the next decade. If leave is drawn, the stand returns to normal planning at zero cost. This step has implicit priority over regular management because it executes before Step 3.

*Step 3 — Unified priority queue.* Remaining candidates (Planting, Tending, Thinning) scored by:

> **score** = phase_weight × 10 + urgency + deferral_count × 10 + structural_bonus + time_bonus

Type-specific phase weights:

| Type | Planting | Tending | Thinning | Harvesting |
|---|---|---|---|---|
| MF | 1.0 | 1.2 | 1.5 | 1.0 |
| OP | 1.0 | 0.8 | 1.0 | 1.5 |
| TR | 1.0 | 1.0 | 1.0 | 1.0 |
| PA | 0.5 | 0.5 | 0.5 | 0.5 |
| EN | 1.2 | 1.5 | 1.3 | 0.5 |

Urgency is phase-specific (empty stands most urgent for planting; dense stands for thinning; tall thickets for tending). Deferral count (+10 per decade skipped) ensures repeatedly deferred stands eventually get managed. If noManagement is drawn, the stand is blocked at zero cost.

#### 3.4 Activity Costs

| Activity | Cost (budget points) | Notes |
|---|---|---|
| clearcut_planting | 13 (10 + 3) | 2-step: clearcut then planting |
| shelterwood_planting | 9 (1 + 2 + 3 + 3) | 4-step |
| shelterwood_no_planting | 6 (1 + 2 + 3) | 3-step |
| femel_planting | 9 (1 + 2 + 3 + 3) | 4-step |
| femel_no_planting | 6 (1 + 2 + 3) | 3-step |
| selectiveThinning | 5 (1 + 2 + 2) | 3-step |
| thinningFromBelow | 2 | Single-shot |
| targetDBH | 2 | Single-shot (repeated 5-yr intervals) |
| plenter_harvest / thinning | 2 | Single-shot (repeated 5-yr intervals) |
| tending | 2 | Single-shot |
| planting | 3 | Single-shot |
| disturbance extraction | round(8 × severity) | Forced tax; 0–8 points depending on severity (Section 2.6) |
| salvage_clearcut | max(0, 8 − extraction) + 3 | 2-step: remnant clearcut then planting. Total always 11 with extraction. |
| salvage_leave / noManagement | 0 | No remnant intervention; only extraction cost applies |

For sequenced activities, the full decade cost is checked before committing. Disturbance extraction costs are deducted immediately (not deferred to planning), so they reduce the budget available for all other activities in the same decade.

#### 3.5 Silvicultural Activities

Species-specific parameters (targetDBH thresholds, plenter curves, planting species) are in Section 4.

**Clearcut** (`clearcut_planting`): Removes all trees (dbh > 0), followed by planting the next year. Used mainly by OP agents.

**Shelterwood** (`shelterwood_planting`, `shelterwood_no_planting`): 3–4 step sequence at 8-year intervals. Step 1 selects 40 seed trees ranked by height (tallest retained as dominant seed trees). Steps 2–3 remove successive fractions of the remaining overstorey. The `_planting` variant adds a planting step. Parameters identical across types (nTrees: 40, nCompetitors: 1000, interval: 8 yr, times: 3).

**Femel / Gap shelterwood** (`femel_planting`, `femel_no_planting`): 3-step gap-expansion at 10-year intervals. Parameters identical across types (initial_size: 3 cells, growth_width: 2 cells/step, times: 3).

**Target-diameter harvest** (`targetDBH`): Removes individual trees exceeding species-specific DBH thresholds (Section 4.2). 5 interventions at 5-year intervals. A volume-cap safeguard prevents over-harvest: if removal would exceed 40% of standing basal area, the system falls back to removing the largest trees until 20% of standing volume is harvested.

**Selection system / Plenter** (`plenter_harvest`, `plenter_thinning`): Maintains a target stem-density curve (Section 4.3). 10 interventions at 5-year intervals. Same mechanics for harvest and thinning phases.

**Selective / crop-tree thinning** (`selectiveThinning`): Step 1 selects 80 crop trees/ha. Step 2+ removes 4 competitors per crop tree. 5 interventions at 5-year intervals. Parameters identical across types.

**Thinning from below** (`thinningFromBelow`): Removes a share of smallest stems. 5 interventions at 5-year intervals. Removal share: MF 0.15, OP 0.25, TR/PA/EN 0.10.

**Tending** (`tending`): Stem-density reduction. Intensity 10, interval 2 years, 3 repetitions. Identical across types.

**Planting** (`planting`): Type-specific species mix (Section 4.4).

---

### 4. Species Composition Regulation

All species-related management decisions are consolidated here.

#### 4.1 WET Classification and Selectivity

Each stand is classified annually into a Forest Development Type (WET) based on current species basal-area shares (oaks → qusp, maples → acsp):

| WET code | Type name | Trigger rule |
|---|---|---|
| d | Douglas fir mixed | psme ≥ 30% |
| t | Fir mixed | abal ≥ 25% AND abal ≥ piab |
| f | Spruce mixed | piab ≥ 30% AND total conifer ≥ 50% |
| k | Pine mixed | pisy ≥ 30% |
| e | Oak mixed | qusp ≥ 30% |
| b | Beech mixed | fasy ≥ 30% |
| h | Broadleaf mixed | broadleaf ≥ 70% AND fasy < 30% |
| fallback | — | conifer ≥ broadleaf → f, else → b |

The classification is dynamic — it updates annually as composition shifts.

Each WET type defines a reference composition loosely derived from WET 2024 guidelines:

| WET | Primary | Secondary | Tertiary | Minor |
|---|---|---|---|---|
| b (beech) | fasy 60% | qusp 15% | acsp 10% | piab 10%, rest 5% |
| e (oak) | qusp 55% | fasy 15% | cabe 10% | tico 10%, rest 10% |
| f (spruce) | piab 50% | fasy 25% | abal 10% | psme 10%, rest 5% |
| t (fir) | abal 35% | fasy 25% | piab 15% | qusp 15%, rest 10% |
| d (Douglas) | psme 55% | fasy 25% | acsp 10% | rest 10% |
| k (pine) | pisy 60% | fasy 15% | abal 10% | qusp 10%, rest 5% |
| h (broadleaf) | acsp 25% | frex 20% | qusp 20% | fasy 15%, rest 20% |

**Owner-specific target computation.** Each type adjusts the WET reference using concentration `c` and intensity:

> **target[sp]** = **ref[sp]** + **c** × (**current[sp]** − **ref[sp]**)

Floored at 0.02, normalised. Then converted to selectivity:

> **sel[sp]** = 0.5 − (**current[sp]** − **target[sp]**) × **intensity** × 2.0

Clamped to [0.05, 0.95]. Centred at 0.5 (iLand's neutral selectivity). Over-represented species get sel < 0.5 (removed preferentially); under-represented get sel > 0.5 (protected).

| Type | c | intensity | Effect |
|---|---|---|---|
| MF | 0.0 | 0.9 | Targets WET reference exactly, strong application |
| EN | −0.2 | 0.5 | Pushes beyond WET toward greater diversity |
| TR | 0.7 | 0.3 | Anchors to current composition, light application |
| OP | 1.3 | 0.6 | Reinforces current dominant species |
| PA | 0.0 | 0.0 | No species regulation (selectivity always neutral) |

#### 4.2 Target-Diameter Harvest Thresholds

Values loosely calibrated against WET 2024 Zieldurchmesser (Anhang Tabelle 8):

| Species | MF | OP | TR | PA | EN | WET 2024 ref. |
|---|---|---|---|---|---|---|
| fasy (beech) | 65 | 55 | 60 | — | 70 | 50–60 |
| piab (spruce) | 45 | 40 | 45 | — | 40 | 50 |
| quro/qupe (oak) | 75 | 65 | 70 | — | 80 | ≥70 (Wertholz) |
| psme (Douglas fir) | 65 | 55 | — | — | — | 50 |
| pisy (Scots pine) | 45 | 40 | — | — | — | ≥45 |
| abal (silver fir) | 45 | 40 | 45 | — | 50 | 50 |
| lade (larch) | 65 | 55 | — | — | — | ≥45 |
| frex (ash) | 60 | — | — | — | — | — |
| acps (maple) | 60 | — | — | — | — | ≥50 |
| rest (all others) | 50 | 45 | 50 | 50 | 55 | — |

"—" = `rest` threshold applies. PA uses only rest = 50 cm for all species. MF's piab/abal at 45 cm are slightly below WET standard (50 cm), reflecting pragmatic production pressure.

#### 4.3 Plenter Equilibrium Curves

Stems/ha by 5-cm DBH class:

| DBH (cm) | MF | OP | TR | PA | EN |
|---|---|---|---|---|---|
| 10 | 350 | 300 | 350 | 350 | 400 |
| 15 | 220 | 200 | 220 | 220 | 250 |
| 20 | 150 | 140 | 150 | 150 | 170 |
| 25 | 105 | 100 | 105 | 105 | 120 |
| 30 | 80 | 70 | 80 | 80 | 90 |
| 35 | 50 | 45 | 50 | 50 | 60 |
| 40 | 40 | 35 | 40 | 40 | 50 |
| 45 | 25 | 20 | 25 | 25 | 30 |
| 50 | 20 | 15 | 20 | 20 | 25 |

EN maintains higher densities (more trees retained). OP maintains lower targets (more removal). MF, TR, and PA share the same curve.

#### 4.4 Planting Species Selection

| Type | N species | Dominant species (weights) | Strategy |
|---|---|---|---|
| MF | 3 | fasy 0.25, abal 0.20, piab 0.12, psme 0.12, qupe 0.12, frex 0.10, acps 0.09 | Diverse, guideline-aligned |
| OP | 1 | piab 0.40, psme 0.30, abal 0.10, pisy 0.10, fasy 0.05, qupe 0.05 | Conifer monoculture |
| TR | 2 | fasy 0.35, abal 0.30, qupe 0.12, piab 0.08, frex 0.10, acps 0.05 | Conservative broadleaf-fir mix |
| PA | — | No planting (null) | Natural regeneration only |
| EN | 3 | qupe 0.35, fasy 0.30, abal 0.20, frex 0.10, acps 0.05 | Broadleaf-heavy, biodiversity-oriented |

Planting interacts with WET selectivity: MF plants diverse AND thins toward WET targets; OP plants monocultures AND reinforces dominants. These mechanisms compound.

---

### 5. Key Assumptions and Simplifications

**No social interaction.** Agents decide independently. No observation of neighbours, imitation, or coordination. Planned for Paper 2.

**No learning or adaptation.** Traits fixed at initialization. Planned for Paper 3.

**No land market.** Ownership structure fixed for the entire simulation.

**Spatially heterogeneous site conditions.** Soil properties and climate vary across the landscape, inherited from BWI source data during initialization. Climate data comes from the ICHEC-EC-EARTH historical model; for the 200-year simulation, iLand randomly resamples years from a 25-year historical window (1981–2005) using a pre-shuffled sampling list. There is no climate change trend — interannual variability is preserved but no directional warming is applied. Latitude: 48.78° N.

**Budget as abstraction.** Budget points do not correspond to EUR. The ratios and type-specific differences matter, not absolute values.

**Institutional guideline = MF.** High-adherence agents converge toward state forestry practice.

**WET as soft steering.** Reference compositions influence selectivity but are not enforced as hard constraints.

**Set-aside ≈ passive non-intervention + forced extraction.** No planned management (no tending, thinning, or harvesting). After a disturbance event, iLand's C++ engine still auto-extracts all dead stems from set-aside stands (they share the same Mega-STP, so `onAfterDisturbance` fires). The extraction cost (8-pt envelope × severity) is charged to the agent's budget as a forced tax — extraction is physical work regardless of management philosophy. However, no remnant management decision (clearcut/leave) is made — the stand recovers via natural regeneration only.

**100% dead-tree extraction (phytosanitary obligation).** On managed stands, iLand's C++ engine automatically removes all dead stems before SOCO gets control. The agent cannot choose partial extraction — this is a hard constraint of the iLand ABE architecture. Agent differentiation occurs through the post-disturbance remnant decision (clearcut vs. leave).

**No wind as controlled treatment.** Wind is configured in iLand but not toggled by SoCoABE. If wind events occur, affected managed stands trigger the same disturbance response pipeline as bark beetle.

**No browsing, no fire.** These modules are disabled.


### 6. Open Questions for Co-Authors about the model 

#### Model logic
- Does the cognitive cycle capture essential decision-making at the right abstraction level?
- Is structural phase classification preferable to age-based for this question?
- Is the budget system a reasonable abstraction? Are cost ratios plausible (disturbance envelope 8 + planting 3 = 11 for full salvage clearcut vs. tending 2)?
- **Should set-aside stands keep C++ auto-extraction of dead trees?** Currently iLand removes dead stems from set-aside stands automatically (phytosanitary obligation applies to all stands sharing the Mega-STP), but SOCO charges no budget and makes no remnant decision. An alternative would disable extraction on set-aside stands entirely (by checking set-aside status in `onAfterDisturbance` and skipping the C++ salvage). Which assumption better reflects real-world passive ownership — dead wood left in place, or mandatory extraction even on unmanaged land?

#### Parameters
- Are trait distributions and activity preferences plausible given Sotirov? Is PA's 80% set-aside too extreme?
- Are targetDBH thresholds reasonable vs. WET 2024? MF's piab at 45 cm is below WET standard (50 cm).
- Are plenter curves reasonable? MF/TR/PA share the same curve — should TR differ?
- Are shelterwood/femel parameters (identical across types) a defensible simplification?
- Are planting species mixes plausible? OP planting almost exclusively conifers — realistic?

#### Species regulation
- Is WET selectivity too strong or too weak? It steers every thinning and harvest.
- OP plants monocultures AND reinforces them via selectivity. Is this double-stacking excessive?

#### Assumptions
- Is 200 years sufficient? Some oak rotations are 150+ years.
- Is random resampling of a 25-year climate window appropriate for 200-year runs?
- Is "no social interaction" acceptable for Paper 1?

---

## Parts 2 & 3: Experimental Design and Preliminary Results

The exploratory experimental setup (OAT design, landscape/ownership/disturbance branches) and all preliminary result figures are in the companion document:

> **[`co_author_report/report_co_author_preliminary_results.md`](co_author_report/report_co_author_preliminary_results.md)**

That document covers:
- Section 7: OAT design overview and the 11-run table
- Section 8: The four experimental branches (landscape, ownership, disturbance, replicates)
- Section 9: Model validation diagnostics (activity timelines, decision heterogeneity, phase agreement, budget diagnostics)
- Section 10: Exploratory outcomes (phase distribution, ridge plots, disturbance recovery, structural complexity, harvest, landscape heterogeneity, species composition)
- Section 11: Known issues and limitations

---

## Open Questions for Co-Authors

The exploratory runs and preliminary results (see companion document) are intended to ground the following decisions. We ask co-authors to review the figures and model description and weigh in on the questions below.

#### About the experimental design

1. **Which axis should we prioritize?** The OAT results suggest landscape initialization and disturbance drive the largest variance in Volume and Species diversity, while aggregation drives Landscape heterogeneity. Should the final experiment be a factorial cross of the top two axes?

2. **How many replicates?** The replicate arm shows low variance relative to treatment effects. Is 3-5 replicates sufficient?

3. **Is the OAT sufficient for publication, or do we need a full factorial?** An 11-run OAT characterizes main effects but misses interactions (e.g., does ownership matter more or less under disturbance than without?). A full 5 x 3 x 3 factorial with 3 replicates = 135 runs. Is this justified?

4. **Should we add a no-management baseline?** Currently the closest is small_only (which includes PA with 80% set-aside), but it still has TR and EN agents actively managing 20-65% of their stands. A clean no-intervention control would help isolate the management signal from natural forest dynamics.

5. **Is 200 years sufficient?** Some oak rotations are 150+ years. Beech rotations reach 120-160 years. Two full rotation cycles may be needed to see stable compositional trajectories. Should we extend to 300 years for the final experiment?

#### About the model

6. **Is PA's 80% set-aside too extreme?** It means passive owners effectively remove 80% of their stands from the managed landscape permanently. This dominates the small_only scenario. Should we reduce set-aside (e.g., to 50%) or allow set-aside stands to be reactivated over time?

7. **Should set-aside stands keep C++ auto-extraction?** Currently iLand auto-extracts dead stems from set-aside stands (phytosanitary obligation), but SOCO charges no budget and makes no remnant decision. An alternative would suppress extraction on set-aside stands entirely (check set-aside in `onAfterDisturbance`), leaving dead wood in place. Which is more realistic?

8. **Are the activity preferences well calibrated?** Do the Dirichlet alpha vectors (Section 2.5) produce activity frequencies that match empirical observations of Central European forest management?

9. **Is the WET selectivity mechanism too strong or too weak?** It steers every thinning and harvest operation via species-specific removal probabilities.

10. **Are shelterwood and femel parameters (identical across types) a defensible simplification?** Currently all types use the same gap sizes, intervals, and step counts. Only the *probability* of choosing these activities differs.

#### About the analysis

11. **Which outcome metrics matter most for the paper's message?** We propose: DBH Gini (structure), species evenness (composition), annual harvest rate (management intensity), and deferral rate (budget pressure). Should we add carbon stocks, regeneration density, or other ecosystem service indicators?

12. **Is species evenness (1 - Gini) preferable to Shannon H' for this paper?** Shannon combines richness and evenness and is sensitive to stand age and post-disturbance dynamics. The species Gini isolates evenness and is more robust. But Shannon is more widely used in the forestry literature.

13. **Stand-level or landscape-level metrics?** Most metrics above are stand-level (averaged across stands). Should we add landscape-level indicators (beta diversity, spatial heterogeneity of stand types, patch-size distributions)?

---

