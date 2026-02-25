# Paper 1 — Implementation Plan for Claude Code

This is the final specification. Each block is a self-contained implementation task.

---

## KEY PRINCIPLES (apply everywhere)

1. **Decision ≠ Action.** A decision is taken at the 10-year planning step. The decision can be "do something" or "do nothing." Either way, the stand is LOCKED until the next decision window opens. A "do nothing" decision is still a decision — the stand doesn't get reconsidered next cycle.

2. **Decision windows have gaps (limbo).** Between windows, no decisions are taken and no actions happen. The stand grows.

3. **Once decided, bound until next window.** If you decide "thin" at age 35, the stand is locked through the rest of the thinning window (until age 70) AND through the limbo gap (71-79). It becomes a candidate again only when it enters the harvesting window (age 80+). Exception: CCF activities are ongoing sequences that repeat within the same window.

4. **No special cases for CCF.** TargetDBH and plenter are just ongoing sequences that happen to live in the harvesting (or thinning) window. When the sequence completes, the stand re-enters the pool for the current window. The sustained yield cap prevents mass switching.

---

## BLOCK 0: Project Scaffold

**Task**: Create clean `paper1/` folder from current model.

**Steps**:
1. Create folder structure: `paper1/soco_src/{integration, cognition, perception, action, core, utils}`, `paper1/CONTROL_TOWER/`, `paper1/config/`
2. Copy all JS source files from current `soco_src/`
3. Copy R scripts from `CONTROL_TOWER/` (grid creation, traits, activities, export helpers)
4. Copy config templates from `config/`
5. Remove from copied files:
   - `Test_Runner`, `Test_Scenarios`, `test_*.js` files
   - `DecisionTrace` module and all references
   - `FixedSTP` mode and all references
   - `NetworkModule` and social learning code in `select_parameters.js`
   - Debug `console.log` statements (keep error/warning logs)
6. Verify the cleaned model still runs

**Test**: Run the cleaned model. Output should be identical to current model (minus debug logs).

**Files touched**: All copied files (removal of dead code only, no logic changes)

---

## BLOCK 1: Sotirov Behavioral Types + Traits

**Task**: Add `behavioral_type` to agents. Create 5 trait profiles.

**Steps**:

1. **`socoabe_config.js`** — Add:
   ```javascript
   SMALL_PRIVATE_SPLIT: { TR: 0.40, PA: 0.30, EN: 0.30 },
   BEHAVIORAL_TYPES: ["MF", "OP", "TR", "PA", "EN"]
   ```

2. **`socoabe_agent.js`** — In constructor, after `this.owner = owner`:
   ```javascript
   this.behavioral_type = this._assign_behavioral_type();
   ```
   New method:
   ```javascript
   _assign_behavioral_type() {
       if (this.owner.type === 'state') return 'MF';
       if (this.owner.type === 'big') return 'OP';
       // small: draw from split
       const split = SoCoABE_CONFIG.SMALL_PRIVATE_SPLIT;
       const r = Math.random();
       let cumulative = 0;
       for (const type in split) {
           cumulative += split[type];
           if (r < cumulative) return type;
       }
       return 'TR';  // fallback
   }
   ```

3. **`traits.R`** — Replace 3-owner trait table with 5-type table:
   ```
   type | pref_prod | pref_bio | pref_co2 | pref_nomgmt | res_α | res_β | adhere_α | adhere_β
   MF   | 3         | 6        | 5        | 0.5         | 8     | 3     | 9        | 1
   OP   | 8         | 1        | 3        | 0.5         | 9     | 2     | 4        | 6
   TR   | 3         | 4        | 2        | 2           | 3     | 6     | 3        | 7
   PA   | 1         | 2        | 1        | 8           | 1     | 9     | 1        | 9
   EN   | 1         | 9        | 3        | 5           | 4     | 5     | 6        | 4
   ```

4. **`owner.js`** — When loading tables for agents, key by `behavioral_type` instead of `owner_type` for: `trait_table`, `activity_table`, `parameter_table`, `species_config_table`. Keep `owner_type` for structural properties (stand allocation, network).

5. **`sample_my_traits()`** in `socoabe_agent.js` — Add adherence sampling:
   ```javascript
   if (trait_configs.adherence) this.adherence = Distributions.sample(trait_configs.adherence);
   ```

6. **Monitoring** — Add `behavioral_type` to all log outputs alongside `owner_type`.

**Test**: Run model. Log each agent's `behavioral_type`. Verify: all state→MF, all big→OP, small→mix of TR/PA/EN at roughly 40/30/30. Verify trait draws differ by type (MF high resources, PA low resources).

---

## BLOCK 2: NoManagement Preference Dimension

**Task**: Extend Dirichlet preference from 3 to 4 dimensions.

**Steps**:

1. **Trait export (R)**: Preference vector becomes `[Production, Biodiversity, CO2, NoManagement]` with alpha values from Block 1 trait table.

2. **`socoabe_agent.js` → `initialize_managed_stands()`**: No code change — `Distributions.weighted_random_choice(this.preferences)` already handles N categories. When result is `"NoManagement"`, it's stored as `preference_focus`.

3. **`think.js`** — After salvage check (Step 0.5), before Step 1:
   ```javascript
   // Step 0.6: NoManagement preference
   if (stand_data_obj.preference_focus === 'NoManagement') {
       stand_data_obj.activity.chosen_Activity = 'noManagement';
       stand_data_obj.activity.is_actionable = false;
       return stand_data_obj;
   }
   ```

4. **`salvage_flags.js`**: Salvage path is ABOVE the preference check, so salvage still fires on NoManagement stands. Use `behavioral_type` for salvage response (Block 8).

**Test**: Run model. Count `preference_focus` values per type. PA should have ~80% NoManagement. MF ~3%. OP ~4%.

---

## BLOCK 3: Simplified Activity Distributions

**Task**: 20 alpha vectors total: `[behavioral_type][phase]`.

**Steps**:

1. **`activities_paper1.R`** — New R script defining 20 rows:
   ```
   type  | phase      | options                                                    | alpha
   MF    | Harvesting | [shelterwood, targetDBH, clearcut, plenter, femel, noMgmt] | [4, 3, 0, 3, 5, 0]
   MF    | Thinning   | [selectiveThinning, fromBelow, plenter_thinning, noMgmt]   | [5, 3, 2, 0]
   MF    | Tending    | [tending, noMgmt]                                          | [8, 2]
   MF    | Planting   | [planting, noMgmt]                                         | [9, 1]
   OP    | Harvesting | ...                                                        | [2, 2, 7, 0, 1, 0]
   OP    | Thinning   | ...                                                        | [3, 6, 0, 1]
   OP    | Tending    | ...                                                        | [6, 4]
   OP    | Planting   | ...                                                        | [9, 1]
   TR    | Harvesting | ...                                                        | [2, 1, 0, 0, 1, 6]
   TR    | Thinning   | ...                                                        | [3, 2, 0, 5]
   TR    | Tending    | ...                                                        | [3, 7]
   TR    | Planting   | ...                                                        | [3, 7]
   PA    | Harvesting | ...                                                        | [0, 0, 0, 0, 0, 10]
   PA    | Thinning   | ...                                                        | [0, 0, 0, 10]
   PA    | Tending    | ...                                                        | [0, 10]
   PA    | Planting   | ...                                                        | [0, 10]
   EN    | Harvesting | ...                                                        | [0, 3, 0, 3, 0, 6]
   EN    | Thinning   | ...                                                        | [0, 0, 2, 8]
   EN    | Tending    | ...                                                        | [0, 10]
   EN    | Planting   | ...                                                        | [1, 9]
   ```
   These are the **own_ideal** distributions (pre-guideline blend).

2. **JSON export**: Change hierarchy from `owner → phase → pref → struct → {options, alpha}` to `type → phase → {options, alpha}`. Flat structure.

3. **`select_activity.js`** — Simplify lookup:
   ```javascript
   // OLD: agent.activity_table?.[phase_key]?.[preference_focus]?.[structure_class]
   // NEW:
   const params = agent.activity_table[phase_key];
   ```
   Remove all preference_focus and structure_class branching. The Dirichlet draw logic stays identical.

**Test**: Run model. Log activity choices per type. MF: mostly femel/shelterwood. OP: clearcut dominant. PA: 100% noMgmt. EN: mostly noMgmt with some targetDBH/plenter.

---

## BLOCK 4: Guideline Blend

**Task**: Blend agent's own_ideal with institutional guideline in JS.

**Steps**:

1. **`socoabe_config.js`** — Add guideline distributions:
   ```javascript
   GUIDELINE: {
       Harvesting: { options: [...], alpha: [4, 3, 0, 3, 5, 0] },
       Thinning:   { options: [...], alpha: [5, 3, 2, 0] },
       Tending:    { options: [...], alpha: [8, 2] },
       Planting:   { options: [...], alpha: [9, 1] }
   }
   ```
   For Paper 1: guideline = MF own_ideal. Identical vectors.

2. **`institution.js`** — Store guideline on institution object:
   ```javascript
   this.guideline_distributions = SoCoABE_CONFIG.GUIDELINE;
   ```

3. **`socoabe_agent.js`** — New method called from `init()`, after `sample_my_traits()` and after loading activity_table:
   ```javascript
   apply_guideline_blend() {
       const adherence = this.adherence;
       const guideline = this.owner.institution.guideline_distributions;
       
       for (const phase in this.activity_table) {
           const own = this.activity_table[phase].alpha;  // own_ideal (deep copied)
           const guide = guideline[phase].alpha;
           
           // Blend: effective = (1-a) × own + a × guideline
           const effective = own.map((v, i) => (1 - adherence) * v + adherence * (guide[i] || 0));
           this.activity_table[phase].alpha = effective;
       }
   }
   ```
   Note: For MF agents where own = guideline, the blend is identity. That's correct.

4. **Future-proofing**: The guideline lives on institution. In Paper 2+, changing `institution.guideline_distributions` and calling `apply_guideline_blend()` on all agents updates everyone.

**Test**: Log effective alpha vectors for several agents of each type. MF agents: identical to guideline (blend is no-op). OP agents: clearcut alpha reduced, femel/shelterwood increased relative to own_ideal. Verify adherence values: MF ~0.9, OP ~0.4, TR ~0.3, PA ~0.1, EN ~0.6.

---

## BLOCK 5: Parameters from abe-lib

**Task**: Simplify parameter distributions. Fix most values to abe-lib defaults.

**Steps**:

1. **Audit abe-lib**: Read the iLand abe-lib source (MegaSTP definitions in `mega_STP.js` and equivalent) to extract default values for:
   - `interval` and `times` for each activity (shelterwood, femel, targetDBH, plenter, fromBelow, selectiveThinning, tending)
   - Default `ntrees`, `ncompetitors`, `thinningShare`, `intensity`

2. **`parameters_paper1.R`** — New parameter table keyed by `[activity][behavioral_type]`:
   - **shelterwood**: ntrees = 40 (fixed for all types), interval + times from abe-lib
   - **femel**: initial_size = 3, growth_width = 2 (fixed), interval + times from abe-lib
   - **targetDBH**: dbhListProfile per behavioral_type, interval + times from abe-lib
   - **plenter**: plenterCurve per behavioral_type, interval + times from abe-lib
   - **fromBelow**: thinningShare fixed, interval + times from abe-lib
   - **selectiveThinning**: ntrees fixed, ncompetitors fixed, interval + times from abe-lib
   - **tending**: intensity fixed

3. **Remove `execution_schedule`** from all parameter distributions. Timing is handled by Block 6.

4. **`select_parameters.js`** — Simplify lookup from `[activity][preference_focus]` to `[activity][behavioral_type]`:
   ```javascript
   const params_for_type = agent.parameter_table?.[activity_name]?.[agent.behavioral_type];
   ```
   Remove preference_focus branching. Remove social learning code (already removed in Block 0).

5. **Species profiles** (targetDBH dbhListProfile, plenter plenterCurve): Key by behavioral_type, not structure_class.

**Test**: Verify parameters load correctly per type. Verify abe-lib defaults are used for interval/times. Verify no `execution_schedule` draws occur.

---

## BLOCK 6: 10-Year Unit Planning + Yearly Execution

**Task**: Replace `compute_schedule.js` and per-stand planning with unit-level 10-year planning.

This is the largest block. It replaces the core decision loop.

### Step 6.1: Decision Windows

New utility function (new file `soco_src/cognition/decision_windows.js`):

```javascript
function get_decision_window(age) {
    if (age >= 0 && age <= 5)   return "Planting";
    if (age >= 10 && age <= 20) return "Tending";
    if (age >= 30 && age <= 70) return "Thinning";
    if (age >= 80)              return "Harvesting";
    return "limbo";
}
```

### Step 6.2: Stand Status

```javascript
function classify_stand_status(stand_data, current_year) {
    const age = stand_data.iLand_stand_data.absolute_age_soco;
    const window = get_decision_window(age);
    const is_ongoing = stand_data.activity.is_Sequence;
    const decided_window = stand_data.activity.decided_window;
    
    // Ongoing sequence: keep going
    if (is_ongoing) return "ongoing";
    
    // Already decided for this window: locked
    if (decided_window === window) return "locked";
    
    // In limbo: nothing to do
    if (window === "limbo") return "limbo";
    
    // In a decision window and not yet decided: candidate
    return "candidate";
}
```

The key field is `decided_window`. When a decision is taken (whether "do something" or "do nothing"), set:
```javascript
stand_data.activity.decided_window = current_window;
```
This locks the stand. When the stand ages into a NEW window (different string), `decided_window !== window` → candidate again.

### Step 6.3: Plan Decade (replaces compute_schedule + part of think.js)

New file `soco_src/cognition/plan_decade.js`:

```javascript
Cognition.plan_decade = function(agent, current_year) {
    
    const mandatory = [];       // planting, tending: must decide
    const harvest_pool = [];    // harvesting candidates
    const thinning_pool = [];   // thinning candidates
    
    for (const stand_id in agent.managed_stands_data) {
        const s = agent.managed_stands_data[stand_id];
        const status = classify_stand_status(s, current_year);
        
        if (status !== "candidate") continue;
        
        const window = get_decision_window(s.iLand_stand_data.absolute_age_soco);
        
        switch (window) {
            case "Planting":
            case "Tending":
                mandatory.push(s);
                break;
            case "Thinning":
                thinning_pool.push(s);
                break;
            case "Harvesting":
                harvest_pool.push(s);
                break;
        }
    }
    
    // --- MANDATORY: Planting + Tending ---
    // Decision MUST be taken. Draw activity: could be "do it" or "noMgmt"
    for (const s of mandatory) {
        const window = get_decision_window(s.iLand_stand_data.absolute_age_soco);
        const activity = Cognition.draw_activity(agent, window);
        
        if (activity === "noManagement") {
            // Decision: do nothing. Stand is STILL locked for this window.
            s.activity.chosen_Activity = "noManagement";
            s.activity.is_actionable = false;
        } else {
            s.activity.chosen_Activity = activity;
            s.activity.target_year = current_year + 1 + Math.floor(Math.random() * 3);
            s.activity.is_actionable = true;
        }
        s.activity.decided_window = window;  // LOCK
        s.activity.planned_phase = window;
    }
    
    // --- HARVESTING: Sustained yield ---
    const HARVEST_INTENSITY = { MF: 1.0, OP: 1.2, TR: 0.6, EN: 0.2, PA: 0.0 };
    const rotation_decades = 8;
    const harvest_target = Math.ceil(
        agent.managed_stand_ids.length / rotation_decades *
        (HARVEST_INTENSITY[agent.behavioral_type] || 0)
    );
    
    // Rank by volume (highest first)
    harvest_pool.sort((a, b) =>
        b.iLand_stand_data.volume - a.iLand_stand_data.volume
    );
    
    let harvest_count = 0;
    for (const s of harvest_pool) {
        if (harvest_count >= harvest_target) {
            // Postpone: do NOT set decided_window. 
            // Stand remains a candidate next cycle.
            break;
        }
        
        const activity = Cognition.draw_activity(agent, "Harvesting");
        
        if (activity === "noManagement") {
            // Decision: do nothing this window
            s.activity.chosen_Activity = "noManagement";
            s.activity.is_actionable = false;
            s.activity.decided_window = "Harvesting";  // LOCK
            continue;  // don't count toward target
        }
        
        s.activity.chosen_Activity = activity;
        s.activity.target_year = current_year + 2 + Math.floor(Math.random() * 8);
        s.activity.is_actionable = true;
        s.activity.decided_window = "Harvesting";  // LOCK
        s.activity.planned_phase = "Harvesting";
        harvest_count++;
    }
    
    // --- THINNING ---
    // Rank by basal area (densest first)
    thinning_pool.sort((a, b) =>
        b.iLand_stand_data.basal_area - a.iLand_stand_data.basal_area
    );
    
    for (const s of thinning_pool) {
        const activity = Cognition.draw_activity(agent, "Thinning");
        
        if (activity === "noManagement") {
            s.activity.chosen_Activity = "noManagement";
            s.activity.is_actionable = false;
        } else {
            s.activity.chosen_Activity = activity;
            s.activity.target_year = current_year + 1 + Math.floor(Math.random() * 9);
            s.activity.is_actionable = true;
        }
        s.activity.decided_window = "Thinning";  // LOCK
        s.activity.planned_phase = "Thinning";
    }
};

// Helper: draw activity from agent's blended distribution for a given phase
Cognition.draw_activity = function(agent, phase) {
    const dist = agent.activity_table[phase];
    if (!dist) return "noManagement";
    return Distributions.dirichlet_draw_choice(dist.options, dist.alpha);
};
```

### Step 6.4: Reactive Planting (post-harvest)

In the action execution for final harvests (clearcut, shelterwood_final, femel_final), set a flag:
```javascript
stand.setFlag('needs_planting', true);
```

Each year, before the regular plan check:
```javascript
// In run_yearly_cycle, before plan check:
for (const stand_id in this.managed_stands_data) {
    const s = this.managed_stands_data[stand_id];
    if (s.iLand_stand_data.needs_planting) {
        // Reactive planting — bypass 10-year plan
        const activity = Cognition.draw_activity(this, "Planting");
        if (activity !== "noManagement") {
            s.activity.chosen_Activity = activity;
            s.activity.target_year = Globals.year;
            s.activity.is_actionable = true;
        }
        s.activity.decided_window = "Planting";
        // Clear the flag after decision
        s.iLand_stand_data.needs_planting = false;
    }
}
```

### Step 6.5: Yearly Execution with Resources

```javascript
agent.execute_yearly(current_year) {
    
    // Collect all stands scheduled for this year
    const scheduled = [];
    for (const sid in this.managed_stands_data) {
        const s = this.managed_stands_data[sid];
        if (s.activity.target_year === current_year && s.activity.is_actionable) {
            scheduled.push(s);
        }
    }
    
    // Yearly resource budget
    let capacity = Math.max(1, Math.ceil(
        this.resources * this.managed_stand_ids.length / 10
    ));
    capacity -= this.salvage_count_this_year * 2;
    
    // Execute or defer
    for (const s of scheduled) {
        if (capacity > 0) {
            Action.trigger_activity(s);
            capacity--;
        } else {
            // Defer by 1 year
            s.activity.target_year += 1;
            s.activity.defer_count = (s.activity.defer_count || 0) + 1;
            if (s.activity.defer_count > 3) {
                // Give up. Stand stays locked (decided_window set).
                // Activity cancelled but decision stands.
                s.activity.chosen_Activity = "noManagement";
                s.activity.is_actionable = false;
                s.activity.defer_count = 0;
            }
        }
    }
}
```

### Step 6.6: Integration with run_yearly_cycle

Rewrite `run_yearly_cycle()`:
```javascript
run_yearly_cycle(current_year) {
    
    // 1. Observe all stands
    this.observe();
    
    // 2. Handle reactive events (salvage already in observe/think, post-harvest planting)
    this.handle_reactive_planting(current_year);
    
    // 3. Is this a planning year? (every 10 years)
    const is_planning_year = (current_year >= this.planning_offset &&
        (current_year - this.planning_offset) % 10 === 0);
    
    if (is_planning_year) {
        Cognition.plan_decade(this, current_year);
    }
    
    // 4. Execute this year's scheduled activities
    this.execute_yearly(current_year);
    
    // 5. Monitor/log
    for (const stand_id in this.managed_stands_data) {
        Monitoring.snapshot(this, this.managed_stands_data[stand_id]);
        Monitoring.log_yearly_structure(this.managed_stands_data[stand_id]);
    }
}
```

### Step 6.7: Remove old modules
- Delete `compute_schedule.js`
- Remove `execution_schedule` from all parameter tables
- Remove probabilistic age classification (`age_class_table`)
- Remove `create_new_plan()` from `think.js` (replaced by plan_decade)
- Simplify `think.js` to only handle: salvage check → NoMgmt preference check → ongoing sequence update → return

### Files created:
- `soco_src/cognition/decision_windows.js` (new)
- `soco_src/cognition/plan_decade.js` (new)

### Files modified:
- `socoabe_agent.js` (run_yearly_cycle rewritten)
- `think.js` (simplified, planning logic removed)

### Files removed:
- `compute_schedule.js`

**Test**: 
- Run model 100 years. Verify no stand gets two activities in the same window.
- Verify planting/tending decisions happen for all stands entering those windows.
- Verify harvest count per decade ≈ sustained yield target.
- Verify CCF sequences run and complete normally, then stands re-enter harvest pool.
- Verify post-harvest planting fires within 1-2 years of harvest.
- Trigger bark beetle: verify salvage consumes resources and defers regular activities.

---

## BLOCK 7: Species Strategies

**Task**: Condition-dependent thinning weights + weighted planting draw.

### Step 7.1: Condition Classification

New file `soco_src/cognition/species/condition_classifier.js`:

```javascript
function classify_stand_condition(stand_data) {
    const dom = stand_data.classified.dominant_species;
    if (!dom || dom.length === 0) return "pioneer";
    
    const CONIFERS = ['piab', 'abal', 'psme', 'lade', 'pisy', 'pini'];
    let conifer_share = 0;
    dom.forEach(s => { if (CONIFERS.includes(s.id)) conifer_share += s.share; });
    
    if (conifer_share > 0.7) return "conifer_dominated";
    if (conifer_share < 0.3) return "broadleaf_dominated";
    return "mixed";
}
```

### Step 7.2: Thinning/Tending Weights Config

In `socoabe_config.js`:

```javascript
THINNING_WEIGHTS: {
    MF: {
        conifer_dominated:   { piab: 0.8, psme: 1.0, fasy: 1.5, qupe: 1.3, abal: 1.2, rest: 0.9 },
        broadleaf_dominated: { fasy: 1.2, qupe: 1.2, abal: 1.5, piab: 1.0, rest: 0.8 },
        mixed:               { rest: 1.0 },  // protect rarity handled below
        pioneer:             { bepe: 0.3, potr: 0.3, rest: 0.8 }
    },
    OP: {
        conifer_dominated:   { piab: 1.5, psme: 1.3, lade: 1.1, fasy: 0.3, rest: 0.5 },
        broadleaf_dominated: { fasy: 1.2, qupe: 1.3, rest: 0.5 },
        mixed:               { piab: 1.2, psme: 1.3, fasy: 1.0, rest: 0.8 },
        pioneer:             { rest: 0.5 }
    },
    TR: {
        conifer_dominated:   { fasy: 1.1, abal: 1.1, rest: 1.0 },
        broadleaf_dominated: { fasy: 1.1, abal: 1.1, rest: 1.0 },
        mixed:               { rest: 1.0 },
        pioneer:             { rest: 1.0 }
    },
    EN: {
        conifer_dominated:   { piab: 0.5, psme: 0.6, fasy: 2.0, qupe: 2.0, abal: 1.5, rest: 1.0 },
        broadleaf_dominated: { rest: 1.0 },
        mixed:               { rest: 1.0 },
        pioneer:             { rest: 1.0 }
    }
    // PA: never thins
}
```

For mixed stands: add rarity protection rule — any species < 10% share gets weight × 1.5.

### Step 7.3: Planting Config

```javascript
PLANTING_CONFIG: {
    MF: { n_species: 3, weights: { piab: 0.15, psme: 0.15, fasy: 0.30, qupe: 0.15, abal: 0.25 } },
    OP: { n_species: 1, weights: { piab: 0.45, psme: 0.35, fasy: 0.05, qupe: 0.05, abal: 0.10 } },
    TR: { n_species: 2, weights: { piab: 0.10, fasy: 0.40, qupe: 0.15, abal: 0.35 } },
    PA: null,
    EN: { n_species: 3, weights: { fasy: 0.35, qupe: 0.40, abal: 0.25 } }
}
```

OP draws 1 species (usually monoculture spruce). MF draws 3 (diverse mix). EN draws 3 broadleaf.

### Step 7.4: Refactor species_strategies.js

Replace the 5 named strategies (standardizer, ecologist, etc.) with:

```javascript
SpeciesStrategies.get_thinning_weights = function(behavioral_type, stand_data) {
    if (behavioral_type === 'PA') return { rest: 1.0 };
    const condition = classify_stand_condition(stand_data);
    const weights = SoCoABE_CONFIG.THINNING_WEIGHTS[behavioral_type][condition];
    
    // Apply rarity protection for mixed stands
    if (condition === "mixed") {
        const dom = stand_data.classified.dominant_species;
        dom.forEach(s => {
            if (s.share < 0.10) {
                weights[s.id] = (weights[s.id] || 1.0) * 1.5;
            }
        });
    }
    
    return weights;
};

SpeciesStrategies.get_planting_mix = function(behavioral_type) {
    const config = SoCoABE_CONFIG.PLANTING_CONFIG[behavioral_type];
    if (!config) return { species: ['fasy'], fractions: [1.0] };
    
    // Draw n_species from weights (without replacement)
    const species = [];
    const pool = Object.entries(config.weights);
    for (let i = 0; i < config.n_species && pool.length > 0; i++) {
        const drawn = weighted_draw_without_replacement(pool);
        species.push(drawn);
    }
    
    // Equal fractions among drawn species
    const frac = 1.0 / species.length;
    return {
        species: species,
        fractions: species.map(() => frac)
    };
};
```

### Step 7.5: Connect to flag preparation

In thinning flag files (`selectiveThinning_flags.js`, `fromBelow_flags.js`): call `SpeciesStrategies.get_thinning_weights()` and pass weights to the MegaSTP via stand flags.

In planting flags: call `SpeciesStrategies.get_planting_mix()` and set species/fractions flags.

**Test**: Run 50 years. Compare species composition trajectories per type. OP stands should trend toward conifer dominance. EN stands should trend toward broadleaf. MF should maintain or increase mixture.

---

## BLOCK 8: Salvage by Behavioral Type

**Task**: Switch salvage response from preference_focus to behavioral_type.

**Steps**:

1. **`salvage_flags.js`** — Replace `preference` switch with `behavioral_type` switch:
   ```javascript
   switch (agent.behavioral_type) {
       case 'MF':
           // Professional: sanitize per WET protocol
           if (severity >= 0.6) response = { type: 'salvage_clearcut', replant: true };
           else if (severity >= 0.3) response = { type: 'salvage_harvest', fraction: 0.9, replant: false };
           else response = { type: 'salvage_harvest', fraction: 0.7, replant: false };
           break;
       case 'OP':
           // Maximum recovery
           if (severity >= 0.3) response = { type: 'salvage_clearcut', replant: true };
           else response = { type: 'salvage_harvest', fraction: 1.0, replant: false };
           break;
       case 'TR':
           // Limited
           if (severity >= 0.6) response = { type: 'salvage_harvest', fraction: 0.6, replant: false };
           else response = { type: 'salvage_leave' };
           break;
       case 'PA':
           response = { type: 'salvage_leave' };
           break;
       case 'EN':
           // Ecological opportunity: deadwood = habitat
           if (severity >= 0.8) response = { type: 'salvage_harvest', fraction: 0.3, replant: false };
           else response = { type: 'salvage_leave' };
           break;
   }
   ```

2. Post-salvage replanting: when `replant: true`, set `needs_planting = true` → reactive planting system (Block 6.4) picks it up. Uses Block 7 planting config for species selection.

3. Salvage cost: 2 resource slots per salvage event in yearly execution (Block 6.5).

**Test**: Trigger bark beetle. Verify salvage response per type. MF/OP clear and replant. PA/EN leave deadwood. TR partial harvest if severe.

---

## BLOCK 9: Static ES Demand + Guideline Config

**Task**: Add metadata config for post-processing and future extensibility.

**Steps**:

1. **`socoabe_config.js`**:
   ```javascript
   ES_DEMAND: { Production: 0.4, Biodiversity: 0.3, CO2: 0.3 },
   
   GUIDELINE: {
       period: { start: 0, end: 999 },  // one period for Paper 1
       Harvesting: { options: [...], alpha: [4, 3, 0, 3, 5, 0] },
       Thinning:   { options: [...], alpha: [5, 3, 2, 0] },
       Tending:    { options: [...], alpha: [8, 2] },
       Planting:   { options: [...], alpha: [9, 1] }
   }
   ```

2. Guideline stored on institution object (already done in Block 4).

3. No runtime effect in Paper 1. ES_DEMAND used in post-processing only.

**Test**: Verify config loads without errors.

---

## BUILD ORDER

```
BLOCK 0  (scaffold)
   ↓
BLOCK 1  (types + traits)
   ↓
BLOCK 2 + BLOCK 3  (NoMgmt pref + activity distributions)  [parallel]
   ↓
BLOCK 4  (guideline blend)
   ↓
BLOCK 5  (parameters from abe-lib)
   ↓
BLOCK 6  (10-year planning — largest block)
   ↓
BLOCK 7 + BLOCK 8  (species + salvage)  [parallel]
   ↓
BLOCK 9  (config metadata)
```

Each block: implement → test → commit. Don't start the next block until the current one passes its tests.

---

## POST-CLEANUP STATUS

All BLOCKs (0-9) implemented. Cleanup phases (0-8) applied:

**Architecture changes:**
- No CONTROL_TOWER. JSON files in `config/tables/` are authoritative. No R→JSON pipeline.
- `landscape_init/` holds grid/spatial R scripts only (re-run when changing spatial layout).
- Species strategies (THINNING_WEIGHTS, PLANTING_CONFIG) loaded from `config/tables/species/species_strategies.json`.
- All distributions documented via DATA_SOURCES registry in `socoabe_config.js`.
- Each JSON table file has a `_comment` header describing what it parameterises.

**Dead code removed:**
- `species_config_table`, `age_class_table`, `species_profile` pathways deleted.
- `select_activity.js`, `set_flags.js`, `compute_schedule.js` deleted.
- Probabilistic age classification replaced with deterministic cutoffs.

**Logging:**
- All console.log/warn/error routed through `SoCoLog` (master switch + per-category).
- Categories: activities, agent_cycles, perception, decisions.
- All commented-out debug logs removed.

**File organization:**
- `femelProgram_flags.js` renamed to `femel_flags.js`.
- `species_group.js` renamed to `species_groups.js`.
- `load_all_files.js` paths verified against filesystem.

---

## FILES REMOVED
- `compute_schedule.js`
- `age_class_table` (probabilistic age classification)
- All test scenario files
- Decision trace module
- Fixed STP mode
- Network/social learning module

## FILES CREATED
- `soco_src/cognition/decision_windows.js`
- `soco_src/cognition/plan_decade.js`
- `soco_src/cognition/species/condition_classifier.js`
- `CONTROL_TOWER/activities_paper1.R`
- `CONTROL_TOWER/parameters_paper1.R`

## FILES SIGNIFICANTLY MODIFIED
- `socoabe_agent.js` (behavioral_type, new run_yearly_cycle, guideline blend)
- `think.js` (simplified: salvage + NoMgmt + ongoing only)
- `select_activity.js` (simplified lookup)
- `select_parameters.js` (simplified lookup, no execution_schedule)
- `salvage_flags.js` (behavioral_type switch)
- `species_strategies.js` (replaced with config-driven lookup)
- `socoabe_config.js` (all new config sections)
- `institution.js` (guideline storage)
- `owner.js` (table lookup by behavioral_type)
- `traits.R` (5-type table)
- Monitoring files (add behavioral_type to logs)