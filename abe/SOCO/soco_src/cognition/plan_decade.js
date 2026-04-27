// FILE: soco_src/cognition/plan_decade.js
// Paper 1: Budget-constrained 10-year planning with priority queue.
//
// Architecture:
//   1. Compute budget (resources × ALL stands × points_per_stand)
//   2. Inventory ongoing sequence commitments (pre-committed cost)
//   3. Select harvests (sustained yield cap → budget check)
//   4. Fill remaining budget: unified priority queue (all non-harvest phases)
//   5. Build sorted work pile for yearly execution
//
// Budget counts ALL stands including set-aside. This means agents with
// more set-aside get proportionally more budget per managed stand —
// a meaningful tradeoff between conservation and management intensity.

Cognition.plan_decade = function(agent, current_year) {

    var cost_table = SoCoABE_CONFIG.ACTIVITY_COSTS || {};
    var priority_weights = (SoCoABE_CONFIG.PRIORITY_WEIGHTS &&
                            SoCoABE_CONFIG.PRIORITY_WEIGHTS[agent.behavioral_type]) || {};
    var budget_config = SoCoABE_CONFIG.BUDGET || { POINTS_PER_STAND_PER_DECADE: 10 };
    var reserve_mode = SoCoABE_CONFIG.RESERVE_MODE || 'legacy';
    var budget_mode = SoCoABE_CONFIG.BUDGET_MODE || 'legacy';
    var modal_stp = SoCoABE_CONFIG.MANAGEMENT_MODE === 'soco_modal_stp';
    var strict_reserve = (reserve_mode === 'strict_reserve');
    var budget_free = (budget_mode === 'budget_free' || budget_mode === 'budget_free_no_cap');
    var budget_free_no_cap = (budget_mode === 'budget_free_no_cap');

    // ===== STEP 0: COMPUTE BUDGET WITH CARRYOVER =====
    // Budget is on ALL stands (including set-aside)
    var n_all_stands = agent.managed_stand_ids.length;
    var n_budget_stands = n_all_stands;
    if (strict_reserve) {
        n_budget_stands = 0;
        for (var sid_count in agent.managed_stands_data) {
            if (!agent.managed_stands_data[sid_count].is_set_aside) n_budget_stands++;
        }
    }
    var base_budget = Math.floor(
        agent.resources * n_budget_stands * budget_config.POINTS_PER_STAND_PER_DECADE
    );

    // Carryover from previous decade (can be negative if debt allowed)
    var carryover = budget_free ? 0 : (agent.unit_state.budget_remaining || 0);
    var budget;

    if (budget_free) {
        budget = base_budget;
    } else if (carryover >= 0) {
        // Positive carryover: cap at MAX_CARRYOVER_FACTOR × base
        var max_carry = base_budget * (budget_config.MAX_CARRYOVER_FACTOR || 2.0);
        budget = base_budget + Math.min(carryover, max_carry);
    } else if (budget_config.ALLOW_DEBT) {
        // Negative carryover (debt): reduce budget but floor at (1 - MAX_DEBT_FACTOR) × base
        var floor = base_budget * (1.0 - (budget_config.MAX_DEBT_FACTOR || 0.5));
        budget = Math.max(base_budget + carryover, Math.floor(floor));
    } else {
        // No debt: ignore negative carryover
        budget = base_budget;
    }

    agent.unit_state.budget_total = budget;
    agent.unit_state.budget_spent = 0;
    agent.unit_state.work_pile = [];
    agent.unit_state.harvest_commits_this_decade = 0;

    // ===== STEP 1: INVENTORY ONGOING COMMITMENTS =====
    // Ongoing sequences have steps landing in this decade. They are pre-committed.
    var ongoing_cost = 0;
    function budget_cost(activity_name, raw_cost) {
        if (budget_free && activity_name === 'salvage_clearcut') return 0;
        return raw_cost;
    }

    for (var sid in agent.managed_stands_data) {
        var s = agent.managed_stands_data[sid];
        if (s.is_set_aside) continue;
        if (!s.activity.is_Sequence) continue;

        // Count steps landing in [current_year, current_year + 9]
        var ongoing_includes_planting = s.activity.chosen_Activity.indexOf('_planting') > -1
                                     && s.activity.chosen_Activity.indexOf('_no_planting') === -1;
        var ongoing_base = Cognition.normalize_activity_name(s.activity.chosen_Activity);
        var ongoing_cost_entry = cost_table[s.activity.chosen_Activity]
                              || cost_table[ongoing_base] || 2;
        var ongoing_total_steps = s.activity.timeline.length;

        for (var t = 0; t < s.activity.timeline.length; t++) {
            var ty = s.activity.timeline[t];
            if (ty >= current_year && ty < current_year + 10) {
                var this_step_cost_raw = Cognition._step_cost(
                    ongoing_cost_entry, t, ongoing_total_steps, ongoing_includes_planting
                );
                var this_step_cost = budget_cost(s.activity.chosen_Activity, this_step_cost_raw);
                ongoing_cost += this_step_cost;

                agent.unit_state.work_pile.push({
                    stand_id:    s.stand_id,
                    activity:    s.activity.chosen_Activity,
                    target_year: ty,
                    cost:        this_step_cost,
                    source:      'ongoing',
                    priority:    50  // ongoing gets moderate-high base priority
                });
            }
        }
    }

    var remaining_budget = budget_free ? Number.POSITIVE_INFINITY : Math.max(0, budget - ongoing_cost);
    agent.unit_state.budget_spent = ongoing_cost;

    // ===== STEP 2: CLASSIFY CANDIDATE STANDS =====
    var harvest_candidates = [];
    var thinning_candidates = [];
    var tending_candidates = [];
    var planting_candidates = [];

    for (var sid2 in agent.managed_stands_data) {
        var s2 = agent.managed_stands_data[sid2];
        if (s2.is_set_aside) continue;
        if (s2.activity.is_Sequence) continue;  // handled in step 1
        if (s2.needs_post_disturbance) continue;  // handled by PostDisturbance before ordinary replanning

        // Blocked stands: check if structural transition or force-forward unlocks them
        if (s2.activity.blocked_until_phase) {
            var unblocked = Cognition.Phases.check_unblock(s2);
            if (!unblocked) continue;  // still blocked — skip
            // If unblocked: fall through to classification below
        }

        var phase = Cognition.Phases.classify(s2);

        // Already has a committed activity for this phase? Skip.
        if (s2.activity.chosen_Activity !== 'none' &&
            s2.activity.chosen_Activity !== 'noManagement') continue;

        // Can we start new activities in this phase? (age engine only; structural always returns true)
        if (!Cognition.Phases.can_start(s2, phase)) continue;

        switch (phase) {
            case "Planting":   planting_candidates.push(s2); break;
            case "Tending":    tending_candidates.push(s2); break;
            case "Thinning":   thinning_candidates.push(s2); break;
            case "Harvesting": harvest_candidates.push(s2); break;
        }
    }

    // ===== STEP 3: HARVEST SELECTION (sustained yield cap + budget) =====
    var harvest_intensity = (SoCoABE_CONFIG.HARVEST_INTENSITY &&
                             SoCoABE_CONFIG.HARVEST_INTENSITY[agent.behavioral_type]) || 0.5;
    var rotation_decades = SoCoABE_CONFIG.HARVEST_ROTATION_DECADES || 8;
    var harvest_target = Math.ceil(n_budget_stands / rotation_decades * harvest_intensity);
    var salvage_severity_equivalent = 0;

    // Disturbance under Option B already places salvaged deadwood on the market.
    // Reduce ordinary harvest capacity by the summed severity across disturbed stands.
    for (var sid_hq in agent.managed_stands_data) {
        var hq = agent.managed_stands_data[sid_hq];
        if (!hq.needs_post_disturbance) continue;
        if (hq.is_set_aside) continue;

        salvage_severity_equivalent += Math.max(0, hq.iLand_stand_data.disturbance_severity || 0);
    }

    var effective_harvest_target = budget_free_no_cap
        ? harvest_candidates.length
        : Math.max(0, harvest_target - salvage_severity_equivalent);

    // Sort harvest candidates (engine-specific: age=volume, structural=DBH)
    Cognition.Phases.sort_harvest(harvest_candidates);

    var harvest_selected = 0;
    for (var h = 0; h < harvest_candidates.length; h++) {
        // HARD CAP: sustained yield limit
        if (!budget_free_no_cap && (harvest_selected + 1) > effective_harvest_target) break;

        var hs = harvest_candidates[h];

        // Draw activity (no noManagement in Harvesting Dirichlet)
        var hact = Cognition.draw_activity(agent, "Harvesting");

        // Set up activity for cost estimation
        hs.activity.chosen_Activity = hact;
        Cognition.select_parameters(hs, agent);
        Cognition.build_schedule(hs, current_year);

        // Estimate cost: only for steps landing in THIS decade
        var h_decade_cost = Cognition._estimate_decade_cost(hs, current_year, cost_table);

        // Budget check: this decade
        if (!budget_free && h_decade_cost > remaining_budget) {
            // Can't afford — defer, DON'T consume harvest_target slot
            hs.activity.chosen_Activity = 'none';
            hs.activity.is_actionable = false;
            hs.activity.carryover_count = (hs.activity.carryover_count || 0) + 1;
            continue;
        }

        // Full-sequence affordability: can the agent sustain future ongoing costs?
        if (!budget_free && !Cognition._can_afford_sequence(hs, base_budget, cost_table)) {
            hs.activity.chosen_Activity = 'none';
            hs.activity.is_actionable = false;
            hs.activity.carryover_count = (hs.activity.carryover_count || 0) + 1;
            SoCoLog.debug('[PLAN-DECADE] Sequence too expensive for sustained income: ' +
                          hs.stand_id + ' act=' + hact +
                          ' totalCost=' + Cognition._estimate_total_cost(hs, cost_table) +
                          ' baseBudget=' + base_budget);
            continue;
        }

        // Commit harvest
        if (!budget_free) remaining_budget -= h_decade_cost;
        agent.unit_state.budget_spent += h_decade_cost;
        harvest_selected++;
        agent.unit_state.harvest_commits_this_decade = harvest_selected;
        hs.activity.is_actionable = true;
        hs.activity.carryover_count = 0;

        // Add to work pile
        Cognition._add_to_work_pile(agent, hs, current_year, cost_table, priority_weights, "Harvesting");

        if (Monitoring.isDecadeLogEnabled()) {
            Monitoring.log_decade_decision(agent, current_year, "Harvesting", hs, h, true);
        }
    }

    // Mark remaining harvest candidates as deferred (NOT noManagement)
    for (var h2 = 0; h2 < harvest_candidates.length; h2++) {
        var unsel = harvest_candidates[h2];
        if (unsel.activity.chosen_Activity === 'none') {
            unsel.activity.carryover_count = (unsel.activity.carryover_count || 0) + 1;
            if (Monitoring.isDecadeLogEnabled()) {
                Monitoring.log_decade_decision(agent, current_year, "Harvesting", unsel, h2, false);
            }
        }
    }

    // ===== STEP 3.5: POST-DISTURBANCE REMNANT MANAGEMENT =====
    // Stands hit by disturbance since last plan_decade. Extraction cost already deducted.
    // Severity-modulated Dirichlet draw: clearcut+replant vs leave.
    // Processed before the unified queue (high priority).
    var DISTURBANCE_ENVELOPE = budget_config.DISTURBANCE_ENVELOPE || 8;
    var pd_weight_table = SoCoABE_CONFIG.POST_DISTURBANCE_WEIGHTS || {};
    var pd_base_weights = pd_weight_table[agent.behavioral_type] ||
                          { salvage_clearcut: 1.0, salvage_leave: 3.0 };

    for (var sid_pd in agent.managed_stands_data) {
        var pd = agent.managed_stands_data[sid_pd];
        if (!pd.needs_post_disturbance) continue;
        if (pd.is_set_aside) { pd.needs_post_disturbance = false; continue; }

        var pd_severity = pd.iLand_stand_data.disturbance_severity || 0;

        // Severity-modulated draw: mild disturbance biases toward leave
        var w_cc = (pd_base_weights.salvage_clearcut || 0) * pd_severity;
        var w_lv = pd_base_weights.salvage_leave || 1.0;
        var w_total = w_cc + w_lv;
        if (w_total <= 0) w_total = 1;
        var pd_draw = modal_stp
            ? (w_cc >= w_lv ? 'salvage_clearcut' : 'salvage_leave')
            : Distributions.weighted_random_choice({
                salvage_clearcut: w_cc / w_total,
                salvage_leave: w_lv / w_total
            });

        SoCoLog.debug('[PLAN-DECADE PostDisturbance] stand=' + sid_pd +
                      ' severity=' + pd_severity.toFixed(2) +
                      ' P(clearcut)=' + (w_cc / w_total * 100).toFixed(1) + '%' +
                      ' -> ' + pd_draw);

        pd.needs_post_disturbance = false;
        pd.activity.parameters = {};
        pd.activity.timeline = [];
        pd.activity.sequence_current_step = 0;
        pd.activity.sequence_total_steps = 0;
        pd.activity.includes_planting = false;

        if (pd_draw === 'salvage_leave') {
            // Free remnant decision. Keep it explicit in decade decisions only;
            // no iLand activity is executed for leave.
            fmengine.standId = pd.stand_id;
            pd.activity.chosen_Activity = 'salvage_leave';
            pd.activity.is_actionable = false;
            if (Monitoring.isDecadeLogEnabled()) {
                Monitoring.log_decade_decision(agent, current_year, "PostDisturbance", pd, 0, true);
            }
            pd.activity.chosen_Activity = 'none';
            pd.activity.is_actionable = false;
            pd.activity.is_Sequence = false;
            pd.activity.timeline = [];
            pd.activity.sequence_current_step = 0;
            pd.activity.sequence_total_steps = 0;
            pd.activity.includes_planting = false;
            pd.activity.target_year = -1;
            pd.activity.parameters = {};
            stand.setFlag('abe_param_salvage_type', null);
            stand.setFlag('abe_param_salvage_trigger_replant', null);
            stand.setFlag('abe_need_reassessment', true);
            continue;
        }

        // salvage_clearcut: compute cost = (envelope - extraction_paid) + planting
        fmengine.standId = pd.stand_id;
        var extraction_paid = stand.flag('abe_extraction_cost_paid') || 0;
        var clearcut_cost_raw = Math.max(0, DISTURBANCE_ENVELOPE - extraction_paid) + 3;
        var clearcut_cost = budget_cost('salvage_clearcut', clearcut_cost_raw);

        if (!budget_free && clearcut_cost > remaining_budget) {
            // Can't afford — defer to next decade. Re-set flag.
            pd.needs_post_disturbance = true;
            pd.activity.chosen_Activity = 'none';
            pd.activity.is_actionable = false;
            pd.activity.carryover_count = (pd.activity.carryover_count || 0) + 1;
            SoCoLog.debug('  -> Cannot afford clearcut (' + clearcut_cost +
                          ' > ' + remaining_budget + '). Deferred.');
            if (Monitoring.isDecadeLogEnabled()) {
                Monitoring.log_decade_decision(agent, current_year, "PostDisturbance", pd, 0, false);
            }
            continue;
        }

        // Commit clearcut + planting sequence
        if (!budget_free) remaining_budget -= clearcut_cost;
        agent.unit_state.budget_spent += clearcut_cost;

        pd.activity.chosen_Activity = 'salvage_clearcut';
        pd.activity.is_Sequence = true;
        pd.activity.sequence_current_step = 0;
        pd.activity.sequence_total_steps = 2;
        pd.activity.timeline = [current_year, current_year + 1];
        pd.activity.includes_planting = true;
        pd.activity.target_year = current_year;
        pd.activity.is_actionable = true;
        pd.activity.carryover_count = 0;

        // Set flags for act.js signal routing
        stand.setFlag('abe_param_salvage_type', 'salvage_clearcut');
        stand.setFlag('abe_param_salvage_trigger_replant', true);

        Cognition._add_to_work_pile(agent, pd, current_year, cost_table, priority_weights, "PostDisturbance");

        SoCoLog.debug('  -> Committed clearcut+plant, cost=' + clearcut_cost +
                      (budget_free ? ' (budget_free; raw=' + clearcut_cost_raw + ')' : '') +
                      ' (envelope=' + DISTURBANCE_ENVELOPE +
                      ' - extraction=' + extraction_paid + ' + plant=3)');

        if (Monitoring.isDecadeLogEnabled()) {
            Monitoring.log_decade_decision(agent, current_year, "PostDisturbance", pd, 0, true);
        }
    }

    // ===== STEP 4: UNIFIED PRIORITY QUEUE (non-harvest) =====
    // Pool all non-harvest candidates, score, sort, process in priority order.
    // This lets phase_weights (type-specific) determine inter-phase budget allocation
    // emergently rather than hardcoding processing order.

    var unified_candidates = [];

    for (var ti = 0; ti < thinning_candidates.length; ti++) {
        unified_candidates.push({ stand: thinning_candidates[ti], phase: "Thinning" });
    }
    for (var te = 0; te < tending_candidates.length; te++) {
        unified_candidates.push({ stand: tending_candidates[te], phase: "Tending" });
    }
    for (var pl = 0; pl < planting_candidates.length; pl++) {
        unified_candidates.push({ stand: planting_candidates[pl], phase: "Planting" });
    }

    // Score each candidate
    for (var u = 0; u < unified_candidates.length; u++) {
        var uc = unified_candidates[u];
        var uc_phase = uc.phase;
        var uc_stand = uc.stand;

        var pw = priority_weights[uc_phase] || 1.0;
        var co = (uc_stand.activity.carryover_count || 0) * 10;
        var bonus = Cognition.Phases.priority_bonus(uc_stand, uc_phase);

        // Engine-specific urgency (same logic as _add_to_work_pile)
        var uc_urgency;
        if (SoCoABE_CONFIG.PHASE_ENGINE === "structural") {
            var ud = uc_stand.iLand_stand_data;
            var uT = Cognition.StructuralPhase._get_thresholds(uc_stand);
            if (uc_phase === "Planting") {
                uc_urgency = Math.max(0, (uT.planting_max_volume - ud.volume)) * 1.0;
            } else if (uc_phase === "Tending") {
                uc_urgency = ud.top_height * 0.5;
            } else {
                uc_urgency = ud.basal_area * 0.2;
            }
        } else {
            var uc_age = uc_stand.iLand_stand_data.absolute_age_iLand;
            var uc_P = SoCoABE_CONFIG.PHASES;
            var uc_end = (uc_P[uc_phase] && uc_P[uc_phase].end) || 999;
            var uc_yr = Math.max(1, uc_end - uc_age);
            uc_urgency = 10 / uc_yr;
        }

        // Time since last managed: longer-unmanaged stands get priority boost.
        // history.last_activity_Year persists in stand_data across years.
        // Never-managed stands (last_activity_Year = -1) get moderate default boost.
        var last_managed_yr = uc_stand.history.last_activity_Year;
        var time_bonus = (last_managed_yr > 0)
            ? Math.min((current_year - last_managed_yr) * 0.5, 30)
            : 15;

        uc.score = pw * 10 + uc_urgency + co + bonus + time_bonus;
    }

    // Sort descending by score
    unified_candidates.sort(function(a, b) {
        return b.score - a.score;
    });

    // Process in priority order
    for (var ui = 0; ui < unified_candidates.length; ui++) {
        var item = unified_candidates[ui];
        var s = item.stand;
        var uph = item.phase;

        // Draw activity from Dirichlet
        var act = Cognition.draw_activity(agent, uph);

        if (act === "noManagement") {
            s.activity.chosen_Activity = 'noManagement';
            s.activity.is_actionable = false;
            // Block until next phase (noManagement = deliberate inaction for this phase)
            var noMgmt_next = {
                "Planting": "Tending", "Tending": "Thinning",
                "Thinning": "Harvesting", "Harvesting": "Tending"
            };
            s.activity.blocked_until_phase = noMgmt_next[uph] || "Tending";
            s.activity.blocked_since_year = current_year;
            s.activity.last_completed_phase = uph;
            if (Monitoring.isDecadeLogEnabled()) {
                Monitoring.log_decade_decision(agent, current_year, uph, s, ui, false);
            }
            continue;
        }

        // Real activity — set up and estimate cost
        s.activity.chosen_Activity = act;
        Cognition.select_parameters(s, agent);
        Cognition.build_schedule(s, current_year);
        var decade_cost = Cognition._estimate_decade_cost(s, current_year, cost_table);

        if (!budget_free && decade_cost > remaining_budget) {
            // Can't afford — defer
            s.activity.chosen_Activity = 'none';
            s.activity.is_actionable = false;
            s.activity.carryover_count = (s.activity.carryover_count || 0) + 1;
            if (Monitoring.isDecadeLogEnabled()) {
                Monitoring.log_decade_decision(agent, current_year, uph, s, ui, false);
            }
            continue;
        }

        // Full-sequence affordability: can the agent sustain future ongoing costs?
        if (!budget_free && !Cognition._can_afford_sequence(s, base_budget, cost_table)) {
            s.activity.chosen_Activity = 'none';
            s.activity.is_actionable = false;
            s.activity.carryover_count = (s.activity.carryover_count || 0) + 1;
            SoCoLog.debug('[PLAN-DECADE] Sequence too expensive for sustained income: ' +
                          s.stand_id + ' act=' + act +
                          ' totalCost=' + Cognition._estimate_total_cost(s, cost_table) +
                          ' baseBudget=' + base_budget);
            if (Monitoring.isDecadeLogEnabled()) {
                Monitoring.log_decade_decision(agent, current_year, uph, s, ui, false);
            }
            continue;
        }

        // Commit
        if (!budget_free) remaining_budget -= decade_cost;
        agent.unit_state.budget_spent += decade_cost;
        s.activity.is_actionable = true;
        s.activity.carryover_count = 0;

        Cognition._add_to_work_pile(agent, s, current_year, cost_table, priority_weights, uph);

        if (Monitoring.isDecadeLogEnabled()) {
            Monitoring.log_decade_decision(agent, current_year, uph, s, ui, true);
        }
    }

    // Store remaining budget for carryover to next decade
    agent.unit_state.budget_remaining = budget - agent.unit_state.budget_spent;

    // ===== STEP 5: SORT WORK PILE =====
    agent.unit_state.work_pile.sort(function(a, b) {
        if (a.target_year !== b.target_year) return a.target_year - b.target_year;
        return b.priority - a.priority;
    });

    // Log budget summary + full stand snapshot
    if (Monitoring.isDecadeLogEnabled()) {
        Monitoring.log_decade_budget(agent, current_year, n_all_stands,
            budget, ongoing_cost, agent.unit_state.budget_spent,
            harvest_selected, harvest_target, effective_harvest_target,
            salvage_severity_equivalent);
        Monitoring.log_decade_snapshot(agent, current_year);
    }
};


// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════


/**
 * Resolve cost for a specific step within a (possibly sequenced) activity.
 * cost_entry: number (scalar) or object { steps: [...], final: N, planting: N }.
 * step_index: 0-based index of the current step.
 * total_steps: total steps in timeline.
 * includes_planting: true if last step is a planting step.
 */
Cognition._step_cost = function(cost_entry, step_index, total_steps, includes_planting) {
    // Scalar entry (single-shot activities like tending, targetDBH)
    if (typeof cost_entry === 'number') return cost_entry;

    var is_last = (step_index >= total_steps - 1);
    var is_final_harvest = includes_planting
        ? (step_index === total_steps - 2)
        : is_last;

    // Planting step (last step of _planting variant)
    if (is_last && includes_planting) {
        return cost_entry.planting || 3;
    }
    // Final harvest step
    if (is_final_harvest) {
        return cost_entry.final || 3;
    }
    // Intermediate steps: index into steps array, clamp to last entry
    var arr = cost_entry.steps || [2];
    return arr[Math.min(step_index, arr.length - 1)];
};


/**
 * Estimate cost of an activity for THIS decade only.
 * Uses step-indexed costs for sequenced activities.
 */
Cognition._estimate_decade_cost = function(stand_data_obj, current_year, cost_table) {
    var act = stand_data_obj.activity;
    var includes_planting = act.chosen_Activity.indexOf('_planting') > -1
                         && act.chosen_Activity.indexOf('_no_planting') === -1;

    // Resolve cost entry: try full name first, then base name, then default.
    var base_activity = act.chosen_Activity
        ? Cognition.normalize_activity_name(act.chosen_Activity)
        : '';
    var cost_entry = cost_table[act.chosen_Activity] || cost_table[base_activity] || 2;

    if (!act.is_Sequence || !act.timeline || act.timeline.length === 0) {
        return Cognition._step_cost(cost_entry, 0, 1, includes_planting);
    }

    var total = 0;
    var total_steps = act.timeline.length;
    for (var i = 0; i < total_steps; i++) {
        var ty = act.timeline[i];
        if (ty >= current_year && ty < current_year + 10) {
            total += Cognition._step_cost(cost_entry, i, total_steps, includes_planting);
        }
    }
    return Math.max(1, total);
};


/**
 * Estimate TOTAL cost of an activity across ALL decades (full sequence lifetime).
 * Used to gate commitments: don't start a sequence the agent can't sustain.
 */
Cognition._estimate_total_cost = function(stand_data_obj, cost_table) {
    var act = stand_data_obj.activity;
    var includes_planting = act.chosen_Activity.indexOf('_planting') > -1
                         && act.chosen_Activity.indexOf('_no_planting') === -1;
    var base_activity = act.chosen_Activity
        ? Cognition.normalize_activity_name(act.chosen_Activity)
        : '';
    var cost_entry = cost_table[act.chosen_Activity] || cost_table[base_activity] || 2;

    if (!act.is_Sequence || !act.timeline || act.timeline.length === 0) {
        return Cognition._step_cost(cost_entry, 0, 1, includes_planting);
    }

    var total = 0;
    var total_steps = act.timeline.length;
    for (var i = 0; i < total_steps; i++) {
        total += Cognition._step_cost(cost_entry, i, total_steps, includes_planting);
    }
    return total;
};


/**
 * Check whether an agent can sustain a multi-decade sequence.
 * Compares total sequence cost against projected base-budget income
 * over the sequence's span. Returns true if affordable or single-shot.
 *
 * base_budget: the agent's raw per-decade budget (resources × n_stands × PPS),
 *              excluding carryover — this is the stable income projection.
 */
Cognition._can_afford_sequence = function(stand_data_obj, base_budget, cost_table) {
    var act = stand_data_obj.activity;
    if (!act.is_Sequence || !act.timeline || act.timeline.length <= 1) {
        return true;  // single-shot — no future burden
    }

    var total_cost = Cognition._estimate_total_cost(stand_data_obj, cost_table);
    var first_year = act.timeline[0];
    var last_year  = act.timeline[act.timeline.length - 1];
    var span_decades = Math.ceil((last_year - first_year) / 10) + 1;

    // Total cost must fit within projected income over the sequence's duration.
    // This ensures ongoing_cost in future decades stays within budget on average.
    return total_cost <= base_budget * span_decades;
};


/**
 * Add stand's scheduled steps to the agent's work pile.
 * Priority = phase_weight × base + urgency + carryover + volume/BA bonus.
 */
Cognition._add_to_work_pile = function(agent, stand_data_obj, current_year, cost_table, priority_weights, assigned_phase) {
    var act = stand_data_obj.activity;
    var phase = assigned_phase || Cognition.Phases.classify(stand_data_obj);
    var budget_mode = SoCoABE_CONFIG.BUDGET_MODE || 'legacy';
    var budget_free = (budget_mode === 'budget_free' || budget_mode === 'budget_free_no_cap');
    // Priority components
    var phase_weight = priority_weights[phase] || 1.0;
    var carryover_bonus = (act.carryover_count || 0) * 10;

    // Urgency: engine-specific
    var urgency;
    if (SoCoABE_CONFIG.PHASE_ENGINE === "structural") {
        // Structural engine: urgency from metrics, not age deadlines
        var d = stand_data_obj.iLand_stand_data;
        var T_urg = Cognition.StructuralPhase._get_thresholds(stand_data_obj);
        if (phase === "Harvesting") {
            // How far past harvest threshold -> higher urgency
            urgency = Math.max(0, d.mean_dbh - T_urg.harvest_min_dbh) * 0.3;
        } else if (phase === "Planting") {
            // Emptier = more urgent
            urgency = Math.max(0, (T_urg.planting_max_volume - d.volume)) * 1.0;
        } else if (phase === "Tending") {
            // Taller thicket = more competitive = more urgent to tend
            urgency = d.top_height * 0.5;
        } else {
            // Thinning: denser = more urgent
            urgency = d.basal_area * 0.2;
        }
    } else {
        // Age engine: closeness to phase deadline
        var age = stand_data_obj.iLand_stand_data.absolute_age_iLand;
        var P = SoCoABE_CONFIG.PHASES;
        var phase_end = (P[phase] && P[phase].end) || 999;
        var years_remaining = Math.max(1, phase_end - age);
        urgency = 10 / years_remaining;
    }

    var base_priority = phase_weight * 10 + urgency + carryover_bonus;

    // Phase-specific priority bonus (engine-specific metrics)
    base_priority += Cognition.Phases.priority_bonus(stand_data_obj, phase);

    var wp_includes_planting = act.chosen_Activity.indexOf('_planting') > -1
                            && act.chosen_Activity.indexOf('_no_planting') === -1;
    var wp_base = Cognition.normalize_activity_name(act.chosen_Activity);
    var wp_cost_entry = cost_table[act.chosen_Activity] || cost_table[wp_base] || 2;

    if (act.is_Sequence && act.timeline && act.timeline.length > 0) {
        var wp_total_steps = act.timeline.length;
        for (var t = 0; t < act.timeline.length; t++) {
            var ty = act.timeline[t];
            if (ty >= current_year && ty < current_year + 10) {
                var this_step_cost = Cognition._step_cost(
                    wp_cost_entry, t, wp_total_steps, wp_includes_planting
                );
                if (budget_free && act.chosen_Activity === 'salvage_clearcut') this_step_cost = 0;
                agent.unit_state.work_pile.push({
                    stand_id:    stand_data_obj.stand_id,
                    activity:    act.chosen_Activity,
                    target_year: ty,
                    cost:        this_step_cost,
                    source:      'new',
                    priority:    base_priority
                });
            }
        }
    } else {
        var ss_cost = Cognition._step_cost(wp_cost_entry, 0, 1, wp_includes_planting);
        if (budget_free && act.chosen_Activity === 'salvage_clearcut') ss_cost = 0;
        agent.unit_state.work_pile.push({
            stand_id:    stand_data_obj.stand_id,
            activity:    act.chosen_Activity,
            target_year: act.target_year,
            cost:        ss_cost,
            source:      'new',
            priority:    base_priority
        });
    }
};


// draw_activity — returns activity name from agent's blended Dirichlet for a phase
Cognition.draw_activity = function(agent, phase) {
    var dist = agent.activity_table[phase];
    if (!dist || !dist.options || !dist.alpha) return "noManagement";

    if (SoCoABE_CONFIG.MANAGEMENT_MODE === 'soco_modal_stp') {
        var best_idx = 0;
        var best_alpha = -Infinity;
        for (var i = 0; i < dist.options.length; i++) {
            var alpha = Number(dist.alpha[i]) || 0;
            if (alpha > best_alpha) {
                best_alpha = alpha;
                best_idx = i;
            }
        }
        return dist.options[best_idx] || "noManagement";
    }

    var weights = Distributions.sample({
        distribution_function: "dirichlet",
        distribution_params: dist
    });
    return Distributions.weighted_random_choice(weights);
};
