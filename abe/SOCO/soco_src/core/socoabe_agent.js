// FILE: soco_src/core/socoabe_agent.js
// Paper 1: Added behavioral_type, adherence, trait lookup by behavioral_type.

class socoabe_agent {
    constructor(agent_id, owner, stand_ids) {
        this.id = agent_id;
        this.owner = owner;
        this.managed_stand_ids = stand_ids;
        this.managed_stands_data = {};

        // Assign behavioral type FIRST (determines which trait table to use)
        this.behavioral_type = this._assign_behavioral_type();

        // Load trait table by behavioral_type (not owner_type)
        this.trait_table = helpers.deepCopy(this.owner.all_trait_tables[this.behavioral_type]);

        // Activity table keyed by behavioral_type (flat: type → phase → {options, alpha})
        this.activity_table = helpers.deepCopy(this.owner.all_activity_tables[this.behavioral_type]);
        this.parameter_table = helpers.deepCopy(this.owner.all_parameter_tables);
        this.plenter_profiles_table = helpers.deepCopy(this.owner.plenter_profiles_table);
        this.targetDBH_profiles_table = helpers.deepCopy(this.owner.targetDBH_profiles_table);

        // Agent Traits
        this.preferences = {};
        this.resources = 0;
        this.risk_tolerance = 0;
        this.adherence = 0;

        this.planning_offset = this._is_modal_stp()
            ? Math.floor(this._deterministic_unit_interval(this.id + ':planning_offset') * 10) + 5
            : Math.floor(Math.random() * 10) + 5;
        this.is_initialized = false;

        this.unit_state = {
            work_pile:                   [],  // ordered list of {stand_id, activity, target_year, cost, source, priority}
            budget_total:                0,   // computed at plan_decade
            budget_spent:                0,   // tracked during plan_decade
            harvest_commits_this_decade: 0,   // reset at start of each plan_decade call
            salvage_count_this_year:     0,   // counted in handle_salvage_and_ongoing
            decade_outcomes:             []   // Paper 2 landing zone
        };

        this.init();
    }

    _assign_behavioral_type() {
        if (this.owner.type === 'state') return 'MF';
        if (this.owner.type === 'big') return 'OP';
        // small: deterministic draw from split using agent ID hash
        // (ensures same agent always gets same type across runs)
        // Uses FNV-1a hash for better distribution of sequential IDs
        const split = SoCoABE_CONFIG.SMALL_PRIVATE_SPLIT;
        var hash = 2166136261;  // FNV offset basis (32-bit)
        for (var i = 0; i < this.id.length; i++) {
            hash ^= this.id.charCodeAt(i);
            hash = Math.imul(hash, 16777619) | 0;  // FNV prime
        }
        // Extra mixing: xorshift to break remaining patterns
        hash ^= hash >>> 16;
        hash = Math.imul(hash, 0x45d9f3b) | 0;
        hash ^= hash >>> 16;
        const r = (Math.abs(hash) % 10000) / 10000;
        let cumulative = 0;
        for (const type in split) {
            cumulative += split[type];
            if (r < cumulative) return type;
        }
        return 'TR';  // fallback
    }

    _is_modal_stp() {
        return typeof SoCoABE_CONFIG !== 'undefined' &&
               SoCoABE_CONFIG.MANAGEMENT_MODE === 'soco_modal_stp';
    }

    _deterministic_unit_interval(key) {
        var hash = 2166136261;
        var text = String(key);
        for (var i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619) | 0;
        }
        hash ^= hash >>> 16;
        hash = Math.imul(hash, 0x45d9f3b) | 0;
        hash ^= hash >>> 16;
        return (hash >>> 0) / 4294967296;
    }

    _argmax_choice(weights_object) {
        var best_key = null;
        var best_value = -Infinity;
        for (var key in weights_object) {
            if (!weights_object.hasOwnProperty(key)) continue;
            var value = Number(weights_object[key]) || 0;
            if (best_key === null || value > best_value) {
                best_key = key;
                best_value = value;
            }
        }
        return best_key || 'undefined';
    }

    _distribution_mean(distObj) {
        if (!distObj || !distObj.distribution_function || !distObj.distribution_params) return null;
        var params = distObj.distribution_params;
        if (distObj.distribution_function === 'dirichlet') {
            var options = params.options || [];
            var alpha = params.alpha || [];
            var total = 0;
            for (var i = 0; i < alpha.length; i++) total += Number(alpha[i]) || 0;
            var out = {};
            for (var j = 0; j < options.length; j++) {
                out[options[j]] = total > 0 ? ((Number(alpha[j]) || 0) / total) : (1 / Math.max(1, options.length));
            }
            return out;
        }
        if (distObj.distribution_function === 'beta') {
            var a = Number(params.alpha) || 0;
            var b = Number(params.beta) || 0;
            return (a + b) > 0 ? a / (a + b) : 0.5;
        }
        if (distObj.distribution_function === 'normal') {
            return Number(params.mean) || 0;
        }
        if (distObj.distribution_function === 'poisson') {
            return Number(params.lambda) || 0;
        }
        if (distObj.distribution_function === 'gamma') {
            return (Number(params.shape) || 0) * (Number(params.scale) || 1);
        }
        return Distributions.sample(distObj);
    }

    init() {
        this.sample_my_traits();
        this.apply_guideline_blend();
        this.initialize_managed_stands();
    }

    apply_guideline_blend() {
        var adherence = this.adherence;
        var guideline = this.owner.institution.guideline;
        if (!guideline || !this.activity_table) return;

        for (var phase in this.activity_table) {
            var own_dist = this.activity_table[phase];
            var own = own_dist.alpha;
            var guide = guideline[phase];
            if (!guide || !guide.alpha || !own_dist.options) continue;

            var guide_by_name = {};
            var guide_by_base = {};
            var guide_has_variants_by_base = {};
            for (var g = 0; g < guide.options.length; g++) {
                var guide_name = guide.options[g];
                var guide_base = Cognition.normalize_activity_name(guide_name);
                var guide_alpha = guide.alpha[g] || 0;
                guide_by_name[guide_name] = guide_alpha;
                guide_by_base[guide_base] = (guide_by_base[guide_base] || 0) + guide_alpha;
                if (guide_name !== guide_base) {
                    guide_has_variants_by_base[guide_base] = true;
                }
            }

            var own_alpha_by_base = {};
            var own_count_by_base = {};
            for (var oi = 0; oi < own_dist.options.length; oi++) {
                var own_base = Cognition.normalize_activity_name(own_dist.options[oi]);
                own_alpha_by_base[own_base] = (own_alpha_by_base[own_base] || 0) + (own[oi] || 0);
                own_count_by_base[own_base] = (own_count_by_base[own_base] || 0) + 1;
            }

            var blended = [];
            for (var i = 0; i < own.length; i++) {
                var option_name = own_dist.options[i];
                var normalized = Cognition.normalize_activity_name(option_name);
                var guide_alpha = 0;

                if (guide_by_name.hasOwnProperty(option_name)) {
                    guide_alpha = guide_by_name[option_name];
                } else if (
                    guide_by_base.hasOwnProperty(normalized) &&
                    !guide_has_variants_by_base[normalized]
                ) {
                    var own_base_total = own_alpha_by_base[normalized] || 0;
                    var split = own_base_total > 0
                        ? (own[i] || 0) / own_base_total
                        : 1 / Math.max(1, own_count_by_base[normalized] || 0);
                    guide_alpha = guide_by_base[normalized] * split;
                }

                blended.push((1 - adherence) * own[i] + adherence * guide_alpha);
            }
            own_dist.alpha = blended;
        }
    }

    sample_my_traits() {
        const trait_configs = this.trait_table;
        if (!trait_configs) throw new Error(`Agent '${this.id}' has no trait_table for behavioral_type '${this.behavioral_type}'.`);

        if (this._is_modal_stp()) {
            if (trait_configs.preferences) this.preferences = this._distribution_mean(trait_configs.preferences);
            if (trait_configs.resources) this.resources = this._distribution_mean(trait_configs.resources);
            if (trait_configs.riskTolerance) this.risk_tolerance = this._distribution_mean(trait_configs.riskTolerance);
            if (trait_configs.adherence) this.adherence = this._distribution_mean(trait_configs.adherence);
            return;
        }

        if (trait_configs.preferences) this.preferences = Distributions.sample(trait_configs.preferences);
        if (trait_configs.resources) this.resources = Distributions.sample(trait_configs.resources);
        if (trait_configs.riskTolerance) this.risk_tolerance = Distributions.sample(trait_configs.riskTolerance);
        if (trait_configs.adherence) this.adherence = Distributions.sample(trait_configs.adherence);
    }

    initialize_managed_stands() {
        var set_aside_rate = (SoCoABE_CONFIG.SET_ASIDE_RATES &&
                              SoCoABE_CONFIG.SET_ASIDE_RATES[this.behavioral_type]) || 0;
        var reserve_mode = SoCoABE_CONFIG.RESERVE_MODE || 'legacy';
        var strict_reserve = (reserve_mode === 'strict_reserve');

        this.managed_stand_ids.forEach(id => {
            const stand_data_obj = new stand_data(id, this);

            // Step 1: Bernoulli draw for set-aside
            stand_data_obj.is_set_aside = this._is_modal_stp()
                ? (this._deterministic_unit_interval(this.id + ':' + id + ':set_aside') < set_aside_rate)
                : (Math.random() < set_aside_rate);

            // Step 2: Preference focus (3-dim: Production/Biodiversity/CO2)
            if (!stand_data_obj.is_set_aside) {
                stand_data_obj.preference_focus = this._is_modal_stp()
                    ? this._argmax_choice(this.preferences)
                    : Distributions.weighted_random_choice(this.preferences);
            } else {
                stand_data_obj.preference_focus = "SetAside";
                if (strict_reserve) {
                    fmengine.standId = id;
                    stand.setSTP(SoCoABE_CONFIG.RESERVE_STP_NAME);
                    stand.setFlag('abe_strict_reserve', true);
                }
            }

            this.managed_stands_data[id] = stand_data_obj;
        });
    }

    observe() {
        for (var i = 0; i < this.managed_stand_ids.length; i++) {
            var sid = this.managed_stand_ids[i];
            this.managed_stands_data[sid] = Perception.observe_stand(this.managed_stands_data[sid], this);
        }
    }

    handle_salvage_and_ongoing(current_year) {
        var budget_mode = SoCoABE_CONFIG.BUDGET_MODE || 'legacy';
        var budget_free = (budget_mode === 'budget_free' || budget_mode === 'budget_free_no_cap');
        this.unit_state.salvage_count_this_year = 0;
        for (var stand_id in this.managed_stands_data) {
            var s = this.managed_stands_data[stand_id];
            s = Cognition.think_reactive(s, this);
            this.managed_stands_data[stand_id] = s;

            // Deduct extraction cost (forced tax from 14-pt envelope, off-budget)
            if (s.extraction_cost_pending && s.extraction_cost_pending > 0) {
                if (!budget_free) {
                    this.unit_state.budget_spent = (this.unit_state.budget_spent || 0) + s.extraction_cost_pending;
                    this.unit_state.budget_remaining = (this.unit_state.budget_remaining || 0) - s.extraction_cost_pending;
                    SoCoLog.debug('[SALVAGE] Stand ' + stand_id + ': extraction cost ' +
                                  s.extraction_cost_pending + ' pts deducted (forced tax).');
                } else {
                    SoCoLog.debug('[SALVAGE] Stand ' + stand_id + ': extraction cost ' +
                                  s.extraction_cost_pending + ' pts ignored (' + budget_mode + ').');
                }
                this.unit_state.salvage_count_this_year++;
                s.extraction_cost_pending = 0;
            }
        }
    }

    execute_yearly(current_year) {
        var scheduled = [];
        for (var sid in this.managed_stands_data) {
            var s = this.managed_stands_data[sid];
            if (s.activity.target_year === current_year && s.activity.is_actionable) {
                s = Cognition.validate_activity(s);
                scheduled.push(s);
            }
        }

        // Sort by utility_score descending so high-value stands execute first
        scheduled.sort(function(a, b) {
            return (b.activity.utility_score || 0) - (a.activity.utility_score || 0);
        });

        for (var i = 0; i < scheduled.length; i++) {
            Action.trigger_activity(scheduled[i], this);

            // Post-execution cleanup for single-shot (non-sequence) activities.
            // Sequences are handled by update_ongoing_sequence in think_reactive.
            // Salvage_clearcut is set up as a sequence by plan_decade, so it skips this block.
            var act = scheduled[i].activity;
            if (!act.is_Sequence) {
                // Record completed phase for hysteresis anchor
                var completed_phase = Cognition.Phases.classify(scheduled[i]);
                act.last_completed_phase = completed_phase;

                // Block until next phase (same logic as sequence completion)
                var is_CCF = (act.chosen_Activity === 'targetDBH' ||
                              act.chosen_Activity === 'plenter_harvest' ||
                              act.chosen_Activity === 'plenter_thinning');

                if (is_CCF) {
                    act.blocked_until_phase = null;
                    act.blocked_since_year = -1;
                } else {
                    var next_phase_map = {
                        "Planting": "Tending", "Tending": "Thinning",
                        "Thinning": "Harvesting", "Harvesting": "Tending"
                    };
                    act.blocked_until_phase = next_phase_map[completed_phase] || "Tending";
                    act.blocked_since_year = current_year;
                }

                // Reset activity state (plan consumed)
                act.chosen_Activity = 'none';
                act.parameters = {};
                act.target_year = -1;
                act.is_actionable = false;
            }
        }
    }

    run_yearly_cycle(current_year) {
        // ── COGNITIVE ARCHITECTURE ────────────────────────────────────────────────
        // Two distinct modes run each year:
        //
        //   REACTIVE  (per-stand, every year):
        //     think_reactive()            — salvage priority + ongoing sequence continuation
        //
        //   PROACTIVE (unit-level, every 10 years):
        //     plan_decade()               — portfolio planning, sustained yield, activity draw
        //
        // Extension points:
        //   Paper 2: social observation → call observe_social() before plan_decade()
        //   Paper 3: guideline dynamics → institution.update_guidelines() before agents run
        // ─────────────────────────────────────────────────────────────────────────

        // 1. Observe all stands
        this.observe();

        // 1b. Log stand state (every year, all stands — structural phase monitoring)
        for (var _sid in this.managed_stands_data) {
            Monitoring.log_stand_state(this.managed_stands_data[_sid], this);
        }

        // 2. Initialization (first year)
        if (current_year === 1 || (!this.is_initialized && this.managed_stand_ids.length > 0)) {
            this.is_initialized = true;
        }

        // 3. Log baseline (pass agent for identity fields — Task 0.10)
        var recording_start_year = SoCoLog.getRecordingStartYear();
        if (current_year === recording_start_year) {
            for (var stand_id in this.managed_stands_data) {
                Monitoring.log_ml_baseline(this.managed_stands_data[stand_id], this);
            }
        }

        var no_intervention = (typeof SoCoABE_CONFIG !== 'undefined' &&
                               SoCoABE_CONFIG.NO_INTERVENTION === true);

        if (!no_intervention) {
            // 4. Handle reactive events (salvage, ongoing sequences)
            this.handle_salvage_and_ongoing(current_year);

            // 5. Is this a planning year? (every 10 years)
            var is_planning_year = (current_year >= this.planning_offset &&
                (current_year - this.planning_offset) % 10 === 0);

            if (is_planning_year) {
                Cognition.plan_decade(this, current_year);
            }

            // 7. Execute this year's scheduled activities
            this.execute_yearly(current_year);
        }

    }
};
this.socoabe_agent = socoabe_agent;
