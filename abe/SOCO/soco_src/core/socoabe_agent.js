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
        this.parameter_table = helpers.deepCopy(this.owner.parameter_table);
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

    act(scheduled_stands) {
        for (var i = 0; i < scheduled_stands.length; i++) {
            var stand_data_obj = scheduled_stands[i];
            if (stand_data_obj.activity.target_year === Globals.year) {
                Action.trigger_activity(stand_data_obj);
            }
        }
    }

    observe() {
        for (const stand_id of this.managed_stand_ids) {
            this.managed_stands_data[stand_id] = Perception.observe_stand(this.managed_stands_data[stand_id], this);
        }
    }

    perceive_unit() {
        this.unit_data = [];
        for (const stand_id in this.managed_stands_data) {
            const s = this.managed_stands_data[stand_id];

            this.unit_data.push({
                stand_id: s.stand_id,
                is_active: s.activity.is_Sequence,
                needs_reassessment: s.iLand_stand_data.needs_reassessment,
                preference: s.preference_focus,
                age: s.iLand_stand_data.stand_age,
                soco_age: s.iLand_stand_data.absolute_age_soco,
                volume: s.iLand_stand_data.volume,
                basal_area: s.iLand_stand_data.basal_area,
                structure_class: s.classified.structure_class,
                age_class: s.classified.age_class
            });
        }
    }

    cognitize(current_year) {
        const actionable_stands = [];
        for (const stand_id in this.managed_stands_data) {
            let stand_data_obj = this.managed_stands_data[stand_id];
            stand_data_obj = Cognition.think(stand_data_obj, this);

            this.managed_stands_data[stand_id] = stand_data_obj;

            if (stand_data_obj.activity.is_actionable && stand_data_obj.activity.target_year === current_year) {
                actionable_stands.push(stand_data_obj);
            }
        }
        return actionable_stands;
    }

    run_yearly_cycle(current_year) {
        this.observe();
        this.perceive_unit();

        // Initialization logic
        var needs_init = (current_year === 1);
        if (!needs_init) {
             var first_id = this.managed_stand_ids[0];
             if (first_id && this.managed_stands_data[first_id].species_profile === "none") {
                 needs_init = true;
             }
        }

        if (needs_init) {
            this.assign_species_profiles();
        }

        // Log baseline data at the start of recording
        var recording_start_year = SoCoLog.getRecordingStartYear();
        if (current_year === recording_start_year) {
            for (const stand_id in this.managed_stands_data) {
                Monitoring.log_ml_baseline(this.managed_stands_data[stand_id]);
            }
        }

        var no_intervention = (typeof SoCoABE_CONFIG !== 'undefined' &&
                               SoCoABE_CONFIG.NO_INTERVENTION === true);

        if (!no_intervention) {
            let actionable_stands = this.cognitize(current_year);

            if (actionable_stands.length > 1) {
                actionable_stands.sort((a, b) => b.activity.utility_score - a.activity.utility_score);
            }

            if (actionable_stands.length > 0) {
                this.act(actionable_stands);
            }
        }

        for (const stand_id in this.managed_stands_data) {
            Monitoring.snapshot(this, this.managed_stands_data[stand_id]);
            Monitoring.log_yearly_structure(this.managed_stands_data[stand_id]);
        }

        if (current_year % 10 === 0) {
            Monitoring.snapshot_unit(this, current_year);
        }
    }
};
this.socoabe_agent = socoabe_agent;
