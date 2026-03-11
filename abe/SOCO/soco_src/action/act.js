/**
 * =================================================================================
 * FILE: act.js
 * =================================================================================
 * DESCRIPTION:
 * Triggers the execution of an activity on a specific stand.
 * Paper 1 version: Removed FixedSTP advance_step, cleaned debug logs.
 * =================================================================================
 */

Action.trigger_activity = function(stand_data_obj, agent) {
    // 1. Set context to the correct stand
    fmengine.standId = stand_data_obj.stand_id;
    if (!stand || stand.id <= 0) {
        SoCoLog.error(`[Action] Could not get valid stand object for ID ${stand_data_obj.stand_id}`);
        return;
    }

    // 1.5. LOG ML TRAINING DATA - Capture pre-activity state BEFORE execution
    Monitoring.log_ml_activity(stand_data_obj, agent);

    // 2. Clear previous flags to ensure clean state
    Action.prepare.clear_flags();

    const cognitive_activity_name = stand_data_obj.activity.chosen_Activity;
    let execution_activity_name = cognitive_activity_name;

    // Resolve compound harvest+planting names for dispatch routing.
    var includes_planting = cognitive_activity_name.indexOf('_planting') > -1
                         && cognitive_activity_name.indexOf('_no_planting') === -1;
    var base_cognitive_name = cognitive_activity_name
        .replace('_planting', '').replace('_no_planting', '');

    // --- 3. MAPPING LOGIC ---
    // Map cognitive activity name to execution activity name.
    // Use base name (without _planting/_no_planting suffix) for harvest activities.
    if (base_cognitive_name === 'plenter_harvest' || base_cognitive_name === 'plenter_thinning') {
        execution_activity_name = 'plenter';
    }
    else if (base_cognitive_name === 'fromBelow' || base_cognitive_name === 'thinningFromBelow') {
        execution_activity_name = 'thinningFromBelow';
    }
    else if (base_cognitive_name === 'tending') {
        execution_activity_name = 'tending';
    }
    else if (base_cognitive_name === 'shelterwood') {
        execution_activity_name = 'shelterwood';
    }
    else if (base_cognitive_name === 'planting') {
        execution_activity_name = 'planting';
    }
    else if (base_cognitive_name === 'femel') {
        execution_activity_name = 'femel';
    }
    else if (base_cognitive_name === 'clearcut') {
        execution_activity_name = 'clearcut';
    }
    else if (base_cognitive_name === 'salvage' ||
             base_cognitive_name === 'salvage_harvest' ||
             base_cognitive_name === 'salvage_clearcut' ||
             base_cognitive_name === 'salvage_leave') {
        execution_activity_name = 'salvage';
    }

    // --- 4. PREPARE FLAGS ---
    var prepare_function = Action.prepare[execution_activity_name];

    if (typeof prepare_function === 'function') {
        prepare_function(stand_data_obj.activity.parameters, stand_data_obj, agent);
    } else {
        SoCoLog.warn(`[Action] No prepare function found for '${execution_activity_name}' (from '${cognitive_activity_name}')`);
    }

    // --- 5. SIGNAL DETERMINATION ---
    var signal_name = '';

    // Logic A: Selective Thinning (State Machine via Flag)
    if (execution_activity_name === 'selectiveThinning') {
        var is_initialized = stand.flag('abe_selective_thinning_initialized');
        signal_name = (is_initialized === true) ? 'do_selectiveThinning_remove' : 'do_selectiveThinning_select';
    }
    // Logic B: Shelterwood (State Machine via Flag + Step Index)
    // For _planting variants: last step = planting, second-to-last = final harvest.
    // For _no_planting or bare: last step = final harvest.
    else if (execution_activity_name === 'shelterwood') {
        var current_step = stand_data_obj.activity.sequence_current_step;
        var total_steps = stand_data_obj.activity.sequence_total_steps;
        var is_initialized = stand.flag('abe_shelterwood_initialized');

        // Planting step: always the very last step of _planting variant
        if (includes_planting && current_step >= total_steps - 1) {
            signal_name = 'do_planting';
            execution_activity_name = 'planting';  // so prepare_flags calls Action.prepare.planting()
        }
        // Final harvest: last step (no planting) or second-to-last (with planting)
        else if (current_step >= total_steps - 1 ||
                 (includes_planting && current_step >= total_steps - 2)) {
            signal_name = 'do_shelterwood_final';
        }
        else if (!is_initialized) {
            signal_name = 'do_shelterwood_select';
        }
        else {
            signal_name = 'do_shelterwood_remove';
        }
    }
    // Logic C: Femel (State Machine via Flag + Step Index)
    // Same _planting logic as shelterwood.
    else if (execution_activity_name === 'femel') {
        var current_step = stand_data_obj.activity.sequence_current_step;
        var total_steps = stand_data_obj.activity.sequence_total_steps;
        var is_initialized = stand.flag('abe_femel_initialized');

        // Planting step
        if (includes_planting && current_step >= total_steps - 1) {
            signal_name = 'do_planting';
            execution_activity_name = 'planting';
        }
        // Final harvest
        else if (current_step >= total_steps - 1 ||
                 (includes_planting && current_step >= total_steps - 2)) {
            signal_name = 'do_femel_final';
        }
        else if (!is_initialized) {
            signal_name = 'do_femel_select';
        }
        else {
            signal_name = 'do_femel_step';
        }
    }
    // Logic C2: Clearcut (now a sequence for _planting variant)
    else if (execution_activity_name === 'clearcut') {
        var current_step = stand_data_obj.activity.sequence_current_step;

        if (includes_planting && current_step >= 1) {
            signal_name = 'do_planting';
            execution_activity_name = 'planting';
        } else {
            signal_name = 'do_clearcut';
        }
    }
    // Logic D: Salvage
    else if (execution_activity_name === 'salvage') {
        var salvage_type = stand.flag('abe_param_salvage_type') || 'salvage_harvest';
        signal_name = 'do_' + salvage_type;
    }
    // Logic E: Standard Activities
    else {
        signal_name = 'do_' + execution_activity_name;
    }

    // --- 6. FIRE SIGNAL ---
    if (signal_name) {
        stand.stp.signal(signal_name);
    } else {
        SoCoLog.error(`[Action] No signal name determined for activity '${execution_activity_name}' on stand ${stand.id}`);
    }
};
