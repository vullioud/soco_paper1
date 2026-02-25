/**
 * =================================================================================
 * FILE: think.js (INSTRUMENTED WITH DETAILED LOGGING)
 * =================================================================================
 */
Cognition.think = function(stand_data_obj, agent) {

    // --- STEP 0: FIXED STP MODE (Bypass ALL cognition entirely) ---
    var fixed_stp_enabled = (typeof SoCoABE_CONFIG !== 'undefined' &&
                             SoCoABE_CONFIG.FIXED_STP &&
                             SoCoABE_CONFIG.FIXED_STP.ENABLED);

    if (fixed_stp_enabled) {
        // In FIXED_STP mode, ONLY execute activities explicitly defined in the JSON plan
        // ALL other stands get noManagement - no exceptions (no salvage, no sequences, nothing)

        if (FixedSTP.has_plan(stand_data_obj.stand_id)) {
            var fixed_activity = FixedSTP.get_current_activity(stand_data_obj.stand_id, Globals.year);

            if (fixed_activity) {
                // Handle R's toJSON which wraps in array: [{...}] -> {...}
                var args = fixed_activity.arguments;
                if (Array.isArray(args) && args.length > 0) {
                    args = args[0];
                }

                // Set activity directly - bypass select_activity + select_parameters
                stand_data_obj.activity.chosen_Activity = fixed_activity.activity;
                stand_data_obj.activity.target_year = Globals.year;
                stand_data_obj.activity.is_actionable = true;
                stand_data_obj.activity.is_Sequence = false;

                // Pass ALL arguments as parameters (universal)
                stand_data_obj.activity.parameters = args;

                // Also set species_profile if present (for prepare_flags compatibility)
                if (args && args.profile) {
                    stand_data_obj.species_profile = args.profile;
                }

                console.log("[FixedSTP] Year " + Globals.year + ", Stand " + stand_data_obj.stand_id +
                            ": " + fixed_activity.activity + " | args: " + JSON.stringify(args));

                return stand_data_obj;
            }
        }

        // FIXED_STP mode: No activity scheduled for this stand this year
        // This applies to BOTH:
        // - Stands WITH plans but no activity this year
        // - Stands WITHOUT plans (not in JSON at all)
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        stand_data_obj.activity.is_actionable = false;
        return stand_data_obj;
    }

    // --- STEP 0.5: CHECK FOR SALVAGE PRIORITY ---
    // Disturbance response takes priority over all other activities
    var needs_salvage = stand_data_obj.iLand_stand_data.needs_salvage;

    if (needs_salvage) {
        console.log(`[COGNITION] Stand ${stand_data_obj.stand_id}: SALVAGE PRIORITY - Disturbance detected, bypassing normal planning.`);

        // Set salvage as the chosen activity
        stand_data_obj.activity.chosen_Activity = 'salvage';
        stand_data_obj.activity.is_actionable = true;
        stand_data_obj.activity.is_Sequence = false;
        stand_data_obj.activity.target_year = Globals.year;

        // Parameters will be set by Action.prepare.salvage based on preference
        stand_data_obj.activity.parameters = {
            disturbance_severity: stand_data_obj.iLand_stand_data.disturbance_severity,
            disturbance_volume: stand_data_obj.iLand_stand_data.disturbance_volume
        };

        // Skip normal planning flow - go directly to validation
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

        // DEBUG: Log periodic planning at years ending in 9 or 0
        if ((Globals.year % 10 === 9 || Globals.year % 5 === 0) && is_periodic_planning_year) {
            console.log(`[DEBUG think] Year ${Globals.year}, Stand ${stand_data_obj.stand_id}, Agent planning_offset=${agent.planning_offset}: PERIODIC PLANNING TRIGGERED`);
        }

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