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
        this.species_config_table = helpers.deepCopy(this.owner.species_config_table);
        this.age_class_table = helpers.deepCopy(this.owner.age_class_table);
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

        // Unit Data
        this.unit_data = [];
        this.my_unit = {
            unit_id: this.id + "_unit",
            history: []
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
        var guideline = this.owner.institution.guideline_distributions;
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

    assign_species_profiles() {
        if (!this.species_config_table) return;

        for (const stand_id in this.managed_stands_data) {
            const stand_data_obj = this.managed_stands_data[stand_id];

            if (stand_data_obj.species_profile === "none") {
                const strategy_weights = Distributions.sample(this.species_config_table);
                const chosen_strategy = Distributions.weighted_random_choice(strategy_weights);

                stand_data_obj.species_profile = chosen_strategy;
            }
        }
    }

    observe() {
        for (var i = 0; i < this.managed_stand_ids.length; i++) {
            var sid = this.managed_stand_ids[i];
            this.managed_stands_data[sid] = Perception.observe_stand(this.managed_stands_data[sid], this);
        }
    }

    handle_reactive_planting(current_year) {
        for (var stand_id in this.managed_stands_data) {
            var s = this.managed_stands_data[stand_id];
            if (s.iLand_stand_data.needs_planting) {
                var activity = Cognition.draw_activity(this, "Planting");
                if (activity !== "noManagement") {
                    s.activity.chosen_Activity = activity;
                    s.activity.target_year = current_year;
                    s.activity.is_actionable = true;
                    Cognition.select_parameters(s, this);
                }
                s.activity.decided_window = "Planting";
                s.iLand_stand_data.needs_planting = false;
            }
        }
    }

    handle_salvage_and_ongoing(current_year) {
        this.salvage_count_this_year = 0;
        for (var stand_id in this.managed_stands_data) {
            var s = this.managed_stands_data[stand_id];
            s = Cognition.think(s, this);
            this.managed_stands_data[stand_id] = s;

            if (s.activity.chosen_Activity === 'salvage' && s.activity.is_actionable) {
                this.salvage_count_this_year++;
            }
        }
    }

    execute_yearly(current_year) {
        var scheduled = [];
        for (var sid in this.managed_stands_data) {
            var s = this.managed_stands_data[sid];
            if (s.activity.target_year === current_year && s.activity.is_actionable) {
                scheduled.push(s);
            }
        }

        var capacity = Math.max(1, Math.ceil(
            this.resources * this.managed_stand_ids.length / 10
        ));
        capacity -= (this.salvage_count_this_year || 0) * 2;
        if (capacity < 0) capacity = 0;

        for (var i = 0; i < scheduled.length; i++) {
            var sd = scheduled[i];
            if (capacity > 0) {
                Action.trigger_activity(sd);
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
        // 1. Observe all stands
        this.observe();

        // 2. Initialization (first year)
        if (current_year === 1 || (!this.is_initialized && this.managed_stand_ids.length > 0)) {
            this.assign_species_profiles();
            this.is_initialized = true;
        }

        // 3. Log baseline
        var recording_start_year = SoCoLog.getRecordingStartYear();
        if (current_year === recording_start_year) {
            for (var stand_id in this.managed_stands_data) {
                Monitoring.log_ml_baseline(this.managed_stands_data[stand_id]);
            }
        }

        var no_intervention = (typeof SoCoABE_CONFIG !== 'undefined' &&
                               SoCoABE_CONFIG.NO_INTERVENTION === true);

        if (!no_intervention) {
            // 4. Handle reactive events (salvage, ongoing sequences)
            this.handle_salvage_and_ongoing(current_year);

            // 5. Handle reactive planting (post-harvest)
            this.handle_reactive_planting(current_year);

            // 6. Is this a planning year? (every 10 years)
            var is_planning_year = (current_year >= this.planning_offset &&
                (current_year - this.planning_offset) % 10 === 0);

            if (is_planning_year) {
                Cognition.plan_decade(this, current_year);
            }

            // 7. Execute this year's scheduled activities
            this.execute_yearly(current_year);
        }

        // 8. Monitor/log
        for (var sid in this.managed_stands_data) {
            Monitoring.snapshot(this, this.managed_stands_data[sid]);
            Monitoring.log_yearly_structure(this.managed_stands_data[sid]);
        }

        if (current_year % 10 === 0) {
            Monitoring.snapshot_unit(this, current_year);
        }
    }
};
this.socoabe_agent = socoabe_agent;
