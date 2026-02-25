// FILE: soco_src/cognition/think.js
// Paper 1: Simplified to salvage + NoMgmt + ongoing sequence only.
// Planning logic moved to plan_decade.js.

Cognition.think = function(stand_data_obj, agent) {

    // --- STEP 0.5: CHECK FOR SALVAGE PRIORITY ---
    if (stand_data_obj.iLand_stand_data.needs_salvage) {
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

    // --- STEP 0.6: NoManagement preference ---
    if (stand_data_obj.preference_focus === 'NoManagement') {
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        stand_data_obj.activity.is_actionable = false;
        return stand_data_obj;
    }

    // --- STEP 1: UPDATE ONGOING SEQUENCE (if any) ---
    stand_data_obj = Cognition.update_ongoing_sequence(stand_data_obj);

    // --- STEP 2: VALIDATE ---
    stand_data_obj = Cognition.validate_activity(stand_data_obj);
    return stand_data_obj;
};
