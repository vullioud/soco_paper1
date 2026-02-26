// FILE: soco_src/core/stand_data.js

class stand_data {
    constructor(stand_id, agent) {

        // --- I. IDENTIFIERS ---
        this.stand_id         = stand_id;
        this.preference_focus = "none";   // set at init; used in planning logic

        // --- II. PERCEPTION ---
        this.iLand_stand_data = {
            absolute_age_iLand:   0,
            volume:               0,
            basal_area:           0,
            needs_salvage:        false,
            disturbance_severity: 0,
            disturbance_volume:   0
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
            chosen_Activity:       'noManagement',
            parameters:            {},
            target_year:           -1,
            is_actionable:         false,
            is_Sequence:           false,
            timeline:              [],
            sequence_total_steps:  0,
            sequence_current_step: 0,
            sequence_sub_activity: 'none',
            decided_window:        'none',
            planned_phase:         'none',
            defer_count:           0
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