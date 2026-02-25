// FILE: soco_src/core/stand_data.js

class stand_data {
    constructor(stand_id, agent) { // Changed signature to accept the agent object
        // --- I. IDENTIFIERS & FIXED TRAITS ---
        this.stand_id = stand_id;
        this.agent_id = agent.id;
        this.owner_type = agent.owner ? agent.owner.type : 'unknown';
        this.behavioral_type = agent.behavioral_type || 'unknown';
        this.preference_focus = "none";

        // --- II. PERCEPTION DATA ---
        this.iLand_stand_data = {
            absolute_age_soco: 0,
            absolute_age_iLand: 0,
            stand_age: 0,
            basal_area: 0,
            volume: 0,
            top_height: 0,
            stems: 0,
            species_count: 0,
            U: 0,
            year_of_observation: -1,
            needs_reassessment: false,

            // Harvest tracking
            last_harvest_volume: 0,
            last_harvest_trees: 0,
            last_harvest_year: -1,
            years_since_harvest: -1,
            rotation_total_harvest: 0,

            // Disturbance tracking
            disturbance_detected: false,
            disturbance_year: -1,
            disturbance_volume: 0,
            disturbance_severity: 0,
            years_since_disturbance: -1,
            needs_salvage: false,
            salvage_response: 'none',  // 'none', 'salvage_only', 'clearcut', 'leave'

            // Dead wood tracking (snags + downed dead wood)
            deadwood_volume_snags: 0,    // Standing dead trees (m³)
            deadwood_volume_dwd: 0,      // Downed dead wood (m³)
            needs_planting: false        // Set by final harvest actions
        };
        this.classified = {
            age_class: 'unknown',
            structure_class: 'unknown',
            species_dominance: 'unknown'
        };
        this.history = {
            last_activity: 'none',
            last_activity_Year: -1,
            time_since_last_activity: -1,
            last_satisfied_phase: 'none',
            target_species: [],

            // Harvest events list (separate from activity_history)
            harvest_events: []
        };

        // --- III. AGENT'S PLAN ---
        this.activity = {
            chosen_Activity: 'noManagement',
            parameters: {},
            target_year: -1,
            is_actionable: false,
            is_Sequence: false,
            timeline: [],
            sequence_total_steps: 0,
            sequence_current_step: 0,
            sequence_sub_activity: 'none',
            decided_window: 'none',
            planned_phase: 'none',
            defer_count: 0
        };

        // --- IV. MONITORING SNAPSHOT ---
        this.monitoringSnapshot = null;
        this.is_monitoring_candidate = false; 
        
        // --- V. DATA LOGS ---
        // These were missing and are required by Monitoring.snapshot
        this.detailed_history = [];

        // Activity history log for social learning
        // Stores sequence of past activities with context
        this.activity_history = {
            log: [],  // Array of activity records
            max_length: 20,  // Keep last 20 activities

            /**
             * Add activity to history log
             */
            add_entry: function(year, activity, params, context) {
                this.log.push({
                    year: year,
                    activity: activity,
                    parameters: params,
                    context: context
                });

                // Keep only recent history
                if (this.log.length > this.max_length) {
                    this.log.shift();  // Remove oldest
                }
            },

            /**
             * Get activities from recent years
             */
            get_recent: function(years_back) {
                const cutoff_year = Globals.year - years_back;
                return this.log.filter(entry => entry.year >= cutoff_year);
            },

            /**
             * Get activities matching specific context
             */
            get_by_context: function(age_class, structure_class) {
                return this.log.filter(entry =>
                    entry.context.age_class === age_class &&
                    entry.context.structure_class === structure_class
                );
            }
        };
    }

    /**
     * Helper: Extract species composition from iLand stand
     * Returns object like {piab: 0.65, fasy: 0.35}
     */
    get_species_composition() {
        fmengine.standId = this.stand_id;
        if (!stand || stand.id <= 0) return {};

        const composition = {};
        const total_ba = stand.basalArea;

        if (total_ba > 0) {
            for (let i = 0; i < stand.nspecies; i++) {
                const species_id = stand.speciesId(i);
                const species_ba = stand.speciesBasalArea(i);
                const share = species_ba / total_ba;

                // Only include species with >1% share
                if (share > 0.01) {
                    composition[species_id] = Number(share.toFixed(3));
                }
            }
        }

        return composition;
    }
}
this.stand_data = stand_data;