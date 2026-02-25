/**
 * =================================================================================
 * FILE: think.js
 * Paper 1 version: Removed FixedSTP mode, cleaned debug logs.
 * =================================================================================
 */
Cognition.think = function(stand_data_obj, agent) {

    // --- STEP 0.5: CHECK FOR SALVAGE PRIORITY ---
    var needs_salvage = stand_data_obj.iLand_stand_data.needs_salvage;

    if (needs_salvage) {
        stand_data_obj.activity.chosen_Activity = 'salvage';
        stand_data_obj.activity.is_actionable = true;
        stand_data_obj.activity.is_Sequence = false;
        stand_data_obj.activity.target_year = Globals.year;

        stand_data_obj.activity.parameters = {
            disturbance_severity: stand_data_obj.iLand_stand_data.disturbance_severity,
            disturbance_volume: stand_data_obj.iLand_stand_data.disturbance_volume
        };

        stand_data_obj = Cognition.validate_activity(stand_data_obj);
        return stand_data_obj;
    }

    // --- STEP 1: UPDATE ONGOING SEQUENCE (if any) ---
    stand_data_obj = Cognition.update_ongoing_sequence(stand_data_obj);

    var is_ongoing = stand_data_obj.activity.is_Sequence;
    var needs_new_plan = false;

    // --- STEP 2: DETERMINE IF NEW PLAN NEEDED ---
    if (!is_ongoing) {
        var needs_reassessment_flag = stand_data_obj.iLand_stand_data.needs_reassessment;
        var is_periodic_planning_year = (Globals.year >= agent.planning_offset && (Globals.year - agent.planning_offset) % 15 === 0);

        if (needs_reassessment_flag || is_periodic_planning_year) {
            needs_new_plan = true;
        }
    }

    // --- STEP 3: CREATE NEW PLAN (if required) ---
    if (needs_new_plan) {
        stand_data_obj = Cognition.create_new_plan(stand_data_obj, agent);
    }

    // --- STEP 4: VALIDATE ACTIVITY ---
    stand_data_obj = Cognition.validate_activity(stand_data_obj);
    return stand_data_obj;
};
