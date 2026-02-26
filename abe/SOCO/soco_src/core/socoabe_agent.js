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
            harvest_commits_this_decade: 0,   // reset at start of each plan_decade call
            resource_used_this_year:     0,   // reset at start of execute_yearly each year
            salvage_count_this_year:     0,   // counted in handle_salvage_and_ongoing
            decade_outcomes:             []   // Paper 2 landing zone
        };

        this.init();
    }

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
        this.managed_stand_ids.forEach(id => {
            const stand_data_obj = new stand_data(id, this);
            stand_data_obj.preference_focus = Distributions.weighted_random_choice(this.preferences);
            this.managed_stands_data[id] = stand_data_obj;
        });
    }

    observe() {
        for (var i = 0; i < this.managed_stand_ids.length; i++) {
            var sid = this.managed_stand_ids[i];
            this.managed_stands_data[sid] = Perception.observe_stand(this.managed_stands_data[sid], this);
        }
    }

    handle_mandatory_planting(current_year) {
        for (var stand_id in this.managed_stands_data) {
            var s = this.managed_stands_data[stand_id];
            var age = s.iLand_stand_data.absolute_age_iLand;

            if (Cognition.get_decision_window(age) !== "Planting") continue;
            if (s.activity.decided_window === "Planting") continue;
            if (s.activity.is_Sequence) continue;
            if (s.preference_focus === 'NoManagement') continue;

            // Stand-level reactive decision — bypasses portfolio logic
            var activity = Cognition.draw_activity(this, "Planting");
            s.activity.chosen_Activity = activity || "noManagement";
            s.activity.is_actionable   = (activity && activity !== "noManagement");
            s.activity.target_year     = s.activity.is_actionable ? current_year + 1 : -1;
            s.activity.decided_window  = "Planting";
            if (s.activity.is_actionable) Cognition.select_parameters(s, this);
        }
    }

    handle_salvage_and_ongoing(current_year) {
        this.unit_state.salvage_count_this_year = 0;
        for (var stand_id in this.managed_stands_data) {
            var s = this.managed_stands_data[stand_id];
            s = Cognition.think_reactive(s, this);
            this.managed_stands_data[stand_id] = s;

            if (s.activity.chosen_Activity === 'salvage' && s.activity.is_actionable) {
                this.unit_state.salvage_count_this_year++;
            }
        }
    }

    execute_yearly(current_year) {
        this.unit_state.resource_used_this_year = 0;
        var scheduled = [];
        for (var sid in this.managed_stands_data) {
            var s = this.managed_stands_data[sid];
            if (s.activity.target_year === current_year && s.activity.is_actionable) {
                scheduled.push(s);
            }
        }

        // Sort by utility_score descending so high-value stands execute first
        scheduled.sort(function(a, b) {
            return (b.activity.utility_score || 0) - (a.activity.utility_score || 0);
        });

        var capacity = Math.max(1, Math.ceil(
            this.resources * this.managed_stand_ids.length / 10
        ));
        capacity -= (this.unit_state.salvage_count_this_year || 0) * 2;
        if (capacity < 0) capacity = 0;

        for (var i = 0; i < scheduled.length; i++) {
            var sd = scheduled[i];
            if (capacity > 0) {
                Action.trigger_activity(sd, this);
                capacity--;
            } else {
                sd.activity.target_year += 1;
                sd.activity.defer_count = (sd.activity.defer_count || 0) + 1;
                if (sd.activity.defer_count > 3) {
                    sd.activity.chosen_Activity = "noManagement";
                    sd.activity.is_actionable = false;
                    sd.activity.defer_count = 0;
                }
            }
        }
    }

    run_yearly_cycle(current_year) {
        // ── COGNITIVE ARCHITECTURE ────────────────────────────────────────────────
        // Two distinct modes run each year:
        //
        //   REACTIVE  (per-stand, every year):
        //     think_reactive()            — salvage priority + ongoing sequence continuation
        //     handle_mandatory_planting() — post-harvest young stands, observation-driven
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

            // 5. Handle mandatory planting (observation-driven)
            this.handle_mandatory_planting(current_year);

            // 6. Is this a planning year? (every 10 years)
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
