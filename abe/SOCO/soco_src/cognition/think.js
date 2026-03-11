// FILE: soco_src/cognition/think.js
// Paper 1: Reactive cognition — runs every year per stand.
// Handles: salvage priority, set-aside, ongoing sequences, actionability.

Cognition.think_reactive = function(stand_data_obj, agent) {

    // --- STEP 1: SET-ASIDE ---
    if (stand_data_obj.is_set_aside) {
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        stand_data_obj.activity.is_actionable = false;
        return stand_data_obj;
    }

    // --- STEP 2: SALVAGE PRIORITY ---
    if (stand_data_obj.iLand_stand_data.needs_salvage) {
        stand_data_obj.activity.chosen_Activity = 'salvage';
        stand_data_obj.activity.is_actionable = true;
        stand_data_obj.activity.is_Sequence = false;
        stand_data_obj.activity.target_year = Globals.year;

        stand_data_obj.activity.parameters = {
            disturbance_severity: stand_data_obj.iLand_stand_data.disturbance_severity,
            disturbance_volume: stand_data_obj.iLand_stand_data.disturbance_volume
        };

        // Unblock — post-salvage needs replanning
        stand_data_obj.activity.blocked_until_phase = null;
        stand_data_obj.activity.blocked_since_year = -1;
        stand_data_obj.activity.utility_score = 1000;  // Always first
        return stand_data_obj;
    }

    // --- STEP 3: UPDATE ONGOING SEQUENCE ---
    stand_data_obj = Cognition.update_ongoing_sequence(stand_data_obj);

    // --- STEP 4: SET ACTIONABILITY FOR THIS YEAR ---
    if (stand_data_obj.activity.target_year === Globals.year &&
        stand_data_obj.activity.chosen_Activity !== 'none' &&
        stand_data_obj.activity.chosen_Activity !== 'noManagement') {
        stand_data_obj.activity.is_actionable = true;
    } else {
        stand_data_obj.activity.is_actionable = false;
    }

    // --- STEP 5: DYNAMIC SPECIES SELECTIVITY ---
    if (SoCoABE_CONFIG.SPECIES_SELECTIVITY_MODE === 'wet_dynamic') {
        var sel = WetSelectivity.computeSpeciesSelectivity(stand_data_obj, agent);
        if (sel && Object.keys(sel).length > 0) {
            fmengine.standId = stand_data_obj.stand_id;
            stand.setFlag('speciesSelectivity', sel);
        }
    }

    return stand_data_obj;
};
