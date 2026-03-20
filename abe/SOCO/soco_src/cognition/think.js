// FILE: soco_src/cognition/think.js
// Paper 1: Reactive cognition — runs every year per stand.
// Handles: salvage priority, set-aside, ongoing sequences, actionability.

Cognition.think_reactive = function(stand_data_obj, agent) {

    // --- STEP 1: SET-ASIDE ---
    if (stand_data_obj.is_set_aside) {
        // Even set-aside stands incur extraction cost when C++ auto-salvages dead trees
        if (stand_data_obj.iLand_stand_data.needs_salvage) {
            fmengine.standId = stand_data_obj.stand_id;
            stand_data_obj.extraction_cost_pending = stand.flag('abe_disturbance_cost') || 0;
            stand.setFlag('abe_disturbance_cost', 0);
        }
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        stand_data_obj.activity.is_actionable = false;
        return stand_data_obj;
    }

    // --- STEP 2: DISTURBANCE DETECTED — deduct extraction cost, defer remnant to plan_decade ---
    if (stand_data_obj.iLand_stand_data.needs_salvage) {
        // Extraction cost already happened at C++ level. Mark for budget deduction.
        fmengine.standId = stand_data_obj.stand_id;
        stand_data_obj.extraction_cost_pending = stand.flag('abe_disturbance_cost') || 0;
        // Clear the flag so it's not double-counted
        stand.setFlag('abe_disturbance_cost', 0);

        // Mark for plan_decade PostDisturbance processing
        stand_data_obj.needs_post_disturbance = true;

        // Unblock — stand needs replanning at next plan_decade
        stand_data_obj.activity.blocked_until_phase = null;
        stand_data_obj.activity.blocked_since_year = -1;
        // Reset to idle — do NOT set up for immediate execution
        stand_data_obj.activity.chosen_Activity = 'none';
        stand_data_obj.activity.is_actionable = false;
        stand_data_obj.activity.is_Sequence = false;
        stand_data_obj.activity.target_year = -1;
        stand_data_obj.activity.parameters = {};

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
