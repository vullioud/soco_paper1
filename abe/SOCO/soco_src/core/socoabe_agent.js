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

        this.planning_offset = Math.floor(Math.random() * 10) + 5;
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
            var own = this.activity_table[phase].alpha;
            var guide = guideline[phase];
            if (!guide || !guide.alpha) continue;

            var blended = [];
            for (var i = 0; i < own.length; i++) {
                blended.push((1 - adherence) * own[i] + adherence * (guide.alpha[i] || 0));
            }
            this.activity_table[phase].alpha = blended;
        }
    }

    sample_my_traits() {
        const trait_configs = this.trait_table;
        if (!trait_configs) throw new Error(`Agent '${this.id}' has no trait_table for behavioral_type '${this.behavioral_type}'.`);

        if (trait_configs.preferences) this.preferences = Distributions.sample(trait_configs.preferences);
        if (trait_configs.resources) this.resources = Distributions.sample(trait_configs.resources);
        if (trait_configs.riskTolerance) this.risk_tolerance = Distributions.sample(trait_configs.riskTolerance);
        if (trait_configs.adherence) this.adherence = Distributions.sample(trait_configs.adherence);
    }

    initialize_managed_stands() {
        var set_aside_rate = (SoCoABE_CONFIG.SET_ASIDE_RATES &&
                              SoCoABE_CONFIG.SET_ASIDE_RATES[this.behavioral_type]) || 0;

        this.managed_stand_ids.forEach(id => {
            const stand_data_obj = new stand_data(id, this);

            // Step 1: Bernoulli draw for set-aside
            stand_data_obj.is_set_aside = (Math.random() < set_aside_rate);

            // Step 2: Preference focus (3-dim: Production/Biodiversity/CO2)
            if (!stand_data_obj.is_set_aside) {
                stand_data_obj.preference_focus = Distributions.weighted_random_choice(this.preferences);
            } else {
                stand_data_obj.preference_focus = "SetAside";
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
        this.unit_state.salvage_count_this_year = 0;
        for (var stand_id in this.managed_stands_data) {
            var s = this.managed_stands_data[stand_id];
            s = Cognition.think_reactive(s, this);
            this.managed_stands_data[stand_id] = s;

            // Deduct extraction cost (forced tax from 14-pt envelope, off-budget)
            if (s.extraction_cost_pending && s.extraction_cost_pending > 0) {
                this.unit_state.budget_spent = (this.unit_state.budget_spent || 0) + s.extraction_cost_pending;
                this.unit_state.budget_remaining = (this.unit_state.budget_remaining || 0) - s.extraction_cost_pending;
                SoCoLog.debug('[SALVAGE] Stand ' + stand_id + ': extraction cost ' +
                              s.extraction_cost_pending + ' pts deducted (forced tax).');
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
