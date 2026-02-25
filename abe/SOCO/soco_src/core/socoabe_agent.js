// ----- Start of File: soco_src/core/socoabe_agent.js -----

// FILE: soco_src/core/socoabe_agent.js (FIXED)

class socoabe_agent {
    constructor(agent_id, owner, stand_ids) {
        this.id = agent_id;
        this.owner = owner;
        this.managed_stand_ids = stand_ids;
        this.managed_stands_data = {};

        // Load tables (Deep copies)
        this.trait_table = helpers.deepCopy(this.owner.trait_table);
        this.activity_table = helpers.deepCopy(this.owner.activity_table);
        this.species_config_table = helpers.deepCopy(this.owner.species_config_table);
        this.age_class_table = helpers.deepCopy(this.owner.age_class_table);
        this.parameter_table = helpers.deepCopy(this.owner.parameter_table);
        this.plenter_profiles_table = helpers.deepCopy(this.owner.plenter_profiles_table);
        this.targetDBH_profiles_table = helpers.deepCopy(this.owner.targetDBH_profiles_table);

        // Agent Traits
        this.preferences = {};
        this.resources = 0;
        this.risk_tolerance = 0;

        this.planning_offset = Math.floor(Math.random() * 10) + 5;
        this.is_initialized = false;

        // Unit Data
        this.unit_data = [];
        this.my_unit = {
            unit_id: this.id + "_unit",
            history: []
        };

        // Networks
        this.geo_network = [];
        this.similarity_network = [];

        this.init();
    }

    init() {
        this.sample_my_traits();
        this.initialize_managed_stands();
        this.load_geo_network();
        // Note: similarity_network is computed after all agents are initialized (in SOCO_main.js)
    }

    load_geo_network() {
        // Load geographical network from JSON (computed in R)
        const network_data = this.owner.agent_networks[this.id];

        if (network_data && network_data.geo_network) {
            this.geo_network = network_data.geo_network;

            if (this.geo_network.length > 0) {
                console.log(`[Agent ${this.id}] Loaded geographical network: ${this.geo_network.length} neighbors`);
            }
        } else {
            // No network data found (isolated agent or network file missing)
            this.geo_network = [];
        }
    }

    sample_my_traits() {
        const trait_configs = this.trait_table;
        if (!trait_configs) throw new Error(`Agent '${this.id}' has no trait_table.`);
        
        if (trait_configs.preferences) this.preferences = Distributions.sample(trait_configs.preferences);
        if (trait_configs.resources) this.resources = Distributions.sample(trait_configs.resources);
        if (trait_configs.riskTolerance) this.risk_tolerance = Distributions.sample(trait_configs.riskTolerance);
    }

   initialize_managed_stands() {
        this.managed_stand_ids.forEach(id => {
            const stand_data_obj = new stand_data(id, this);
            stand_data_obj.preference_focus = Distributions.weighted_random_choice(this.preferences);
            this.managed_stands_data[id] = stand_data_obj;
        });
    }

    assign_species_profiles() {
        if (!this.species_config_table) {
            console.warn(`[Agent ${this.id}] No species_config_table found.`);
            return;
        }

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

            // === DECISION TRACE (OPTIONAL) ===
            // Only trace if explicitly enabled AND this agent is selected
            if (typeof DecisionTrace !== 'undefined' &&
                DecisionTrace.enabled &&
                DecisionTrace.should_trace(this.id)) {

                const is_periodic_planning = (current_year >= this.planning_offset &&
                                             (current_year - this.planning_offset) % 10 === 0);

                const decision_context = {
                    is_periodic_planning: is_periodic_planning,
                    created_new_plan: false,  // Simplified - not tracking this for now
                    action_taken: false,
                    signal_fired: "none",
                    social_learning_applied: false
                };

                DecisionTrace.log_decision(this, stand_data_obj, decision_context);
            }

            if (stand_data_obj.activity.is_actionable && stand_data_obj.activity.target_year === current_year) {
                actionable_stands.push(stand_data_obj);
            }
        }
        return actionable_stands;
    }

    run_yearly_cycle(current_year) {
        const test_overrode_cycle = Test_Runner.run_for_agent(this, current_year);
        if (test_overrode_cycle) {
            return;
        }

        // DEBUG: Log cycle start at years ending in 0
        if (current_year % 10 === 0) {
            console.log(`[DEBUG run_yearly_cycle] Year ${current_year}, Agent ${this.id}: Starting yearly cycle. planning_offset=${this.planning_offset}`);
        }

        this.observe();
        this.perceive_unit();

        // --- FIX: Correct initialization logic ---
        var needs_init = (current_year === 1);
        if (!needs_init) {
             var first_id = this.managed_stand_ids[0];
             // Check if stands are uninitialized (e.g. added later or init failed)
             if (first_id && this.managed_stands_data[first_id].species_profile === "none") {
                 needs_init = true;
             }
        }

        if (needs_init) {
            this.assign_species_profiles();
        }

        // Log baseline data at the start of recording (after warming period ends)
        // This ensures baseline reflects the stabilized forest state, not the raw initialization
        var recording_start_year = SoCoLog.getRecordingStartYear();
        if (current_year === recording_start_year) {
            for (const stand_id in this.managed_stands_data) {
                Monitoring.log_ml_baseline(this.managed_stands_data[stand_id]);
            }
        }

        // Check if NO_INTERVENTION mode is enabled - skip decision making and actions
        var no_intervention = (typeof SoCoABE_CONFIG !== 'undefined' &&
                               SoCoABE_CONFIG.NO_INTERVENTION === true);

        if (!no_intervention) {
            let actionable_stands = this.cognitize(current_year);

            if (current_year % 10 === 0) {
                ten_year_planner.report_plan(this);
            }

            if (actionable_stands.length > 1) {
                actionable_stands.sort((a, b) => b.activity.utility_score - a.activity.utility_score);
            }

            if (actionable_stands.length > 0) {
                this.act(actionable_stands);
            }
        }

        for (const stand_id in this.managed_stands_data) {
            Monitoring.snapshot(this, this.managed_stands_data[stand_id]);
            // Log yearly structure for all stands every year
            Monitoring.log_yearly_structure(this.managed_stands_data[stand_id]);
        }

        if (current_year % 10 === 0) {
            Monitoring.snapshot_unit(this, current_year);
        }
    }

    // =========================================================================
    // NETWORK HELPER METHODS
    // =========================================================================

    /**
     * Get neighbor agents from the specified network type
     * @param {string} network_type - 'geo' or 'similarity'
     * @returns {Array<socoabe_agent>} Array of neighbor agent objects
     */
    get_network_neighbors(network_type = 'geo') {
        const network_ids = (network_type === 'geo') ? this.geo_network : this.similarity_network;

        if (!network_ids || network_ids.length === 0) {
            return [];
        }

        // Get all agents from institution
        const all_agents = this.owner.institution.all_agents;

        // Filter to neighbors
        const neighbors = all_agents.filter(agent => network_ids.includes(agent.id));

        return neighbors;
    }

    /**
     * Get summary statistics from network neighbors
     * Useful for social learning or comparative decision-making
     * @param {string} network_type - 'geo' or 'similarity'
     * @returns {Object} Summary statistics from neighbors
     */
    get_network_summary(network_type = 'geo') {
        const neighbors = this.get_network_neighbors(network_type);

        if (neighbors.length === 0) {
            return {
                count: 0,
                avg_resources: null,
                common_preferences: null
            };
        }

        // Calculate average resources
        const avg_resources = neighbors.reduce((sum, n) => sum + n.resources, 0) / neighbors.length;

        // Find most common preference focus across all neighbor stands
        const pref_counts = {};
        neighbors.forEach(neighbor => {
            for (const stand_id in neighbor.managed_stands_data) {
                const pref = neighbor.managed_stands_data[stand_id].preference_focus;
                pref_counts[pref] = (pref_counts[pref] || 0) + 1;
            }
        });

        const common_pref = Object.keys(pref_counts).reduce((a, b) =>
            pref_counts[a] > pref_counts[b] ? a : b, null);

        return {
            count: neighbors.length,
            avg_resources: avg_resources,
            common_preferences: common_pref,
            neighbor_ids: neighbors.map(n => n.id)
        };
    }
};
this.socoabe_agent = socoabe_agent;

