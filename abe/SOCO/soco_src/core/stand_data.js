// FILE: soco_src/core/stand_data.js

class stand_data {
    constructor(stand_id, agent) {

        // --- I. IDENTIFIERS ---
        this.stand_id         = stand_id;
        this.is_set_aside     = false;    // drawn at init from SET_ASIDE_RATES
        this.preference_focus = "none";   // Production | Biodiversity | CO2 (no NoManagement)

        // --- I.b DISTURBANCE STATE ---
        this.needs_post_disturbance  = false;  // set by think_reactive, consumed by plan_decade
        this.extraction_cost_pending = 0;      // set by think_reactive, consumed by handle_salvage

        // --- II. PERCEPTION ---
        this.iLand_stand_data = {
            absolute_age_iLand:   0,
            volume:               0,
            basal_area:           0,
            top_height:           0,
            mean_dbh:             0,
            stems:                0,
            needs_salvage:              false,
            disturbance_severity:       0,
            disturbance_volume:         0,
            disturbance_cost:           0,
            actual_salvage_volume_m3ha: 0,
            deadwood_retained_m3ha:     0,
            // Structural diversity metrics (computed from tree list)
            dbh_sd:           0,
            dbh_gini:         0,
            n_large_trees:    0,
            n_height_layers:  0,
            height_sd:        0,
            max_dbh:          0
        };

        // --- III. CLASSIFICATION ---
        this.classified = {
            dominant_species: []    // [{id, share}...] for ConditionClassifier only
        };

        // --- IV. HISTORY ---
        this.history = {
            last_activity:      'none',
            last_activity_Year: -1
        };

        // --- V. PLAN STATE ---
        this.activity = {
            chosen_Activity:       'none',   // 'none' = no plan yet (NOT noManagement)
            parameters:            {},
            target_year:           -1,
            is_actionable:         false,
            is_Sequence:           false,
            timeline:              [],
            sequence_total_steps:  0,
            sequence_current_step: 0,
            sequence_sub_activity: 'none',

            // Phase lifecycle
            blocked_until_phase:   null,     // null = available for planning. Phase name = waiting for structural transition.
            blocked_since_year:    -1,       // year the block was set (-1 if not blocked). For force-forward timeout.
            last_completed_phase:  'none',   // which phase was most recently completed? For monitoring/debugging.

            // Queue tracking
            carryover_count:       0,        // decades deferred (priority bump)

            // Utility (execution ordering within a year)
            utility_score:         0
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