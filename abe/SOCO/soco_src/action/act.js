/**
 * =================================================================================
 * FILE: act.js
 * =================================================================================
 * DESCRIPTION:
 * Triggers the execution of an activity on a specific stand.
 * Paper 1 version: Removed FixedSTP advance_step, cleaned debug logs.
 * =================================================================================
 */

Action.trigger_activity = function(stand_data_obj) {
    // 1. Set context to the correct stand
    fmengine.standId = stand_data_obj.stand_id;
    if (!stand || stand.id <= 0) {
        console.error(`[Action] ERROR: Could not get valid stand object for ID ${stand_data_obj.stand_id}`);
        return;
    }

    // 1.5. LOG ML TRAINING DATA - Capture pre-activity state BEFORE execution
    Monitoring.log_ml_activity(stand_data_obj);

    // 2. Clear previous flags to ensure clean state
    Action.prepare.clear_flags();

    const cognitive_activity_name = stand_data_obj.activity.chosen_Activity;
    let execution_activity_name = cognitive_activity_name;

    // --- 3. MAPPING LOGIC ---
    if (cognitive_activity_name === 'plenter_harvest' || cognitive_activity_name === 'plenter_thinning') {
        execution_activity_name = 'plenter';
    }
    else if (cognitive_activity_name === 'fromBelow' || cognitive_activity_name === 'thinningFromBelow') {
        execution_activity_name = 'thinningFromBelow';
    }
    else if (cognitive_activity_name === 'tending') {
        execution_activity_name = 'tending';
    }
    else if (cognitive_activity_name === 'shelterwood') {
        execution_activity_name = 'shelterwood';
    }
    else if (cognitive_activity_name === 'planting') {
        execution_activity_name = 'planting';
    }
    else if (cognitive_activity_name === 'femel') {
        execution_activity_name = 'femel';
    }
    else if (cognitive_activity_name === 'salvage' ||
             cognitive_activity_name === 'salvage_harvest' ||
             cognitive_activity_name === 'salvage_clearcut' ||
             cognitive_activity_name === 'salvage_leave') {
        execution_activity_name = 'salvage';
    }

    // --- 4. PREPARE FLAGS ---
    var prepare_function = Action.prepare[execution_activity_name];

    if (typeof prepare_function === 'function') {
        prepare_function(stand_data_obj.activity.parameters, stand_data_obj);
    } else {
        console.warn(`[Action] Warning: No prepare function found for '${execution_activity_name}' (Mapped from '${cognitive_activity_name}')`);
    }

    // --- 5. SIGNAL DETERMINATION ---
    var signal_name = '';

    // Logic A: Selective Thinning (State Machine via Flag)
    if (execution_activity_name === 'selectiveThinning') {
        var is_initialized = stand.flag('abe_selective_thinning_initialized');
        signal_name = (is_initialized === true) ? 'do_selectiveThinning_remove' : 'do_selectiveThinning_select';
    }
    // Logic B: Shelterwood (State Machine via Flag + Step Index)
    else if (execution_activity_name === 'shelterwood') {
        var current_step = stand_data_obj.activity.sequence_current_step;
        var total_steps = stand_data_obj.activity.sequence_total_steps;
        var is_initialized = stand.flag('abe_shelterwood_initialized');

        if (current_step >= total_steps - 1) {
            signal_name = 'do_shelterwood_final';
        }
        else if (!is_initialized) {
            signal_name = 'do_shelterwood_select';
        }
        else {
            signal_name = 'do_shelterwood_remove';
        }
    }
    // Logic C: Femel
    else if (execution_activity_name === 'femel') {
        var current_step = stand_data_obj.activity.sequence_current_step;
        var total_steps = stand_data_obj.activity.sequence_total_steps;
        var is_initialized = stand.flag('abe_femel_initialized');

        if (current_step >= total_steps - 1) {
            signal_name = 'do_femel_final';
        }
        else if (!is_initialized) {
            signal_name = 'do_femel_select';
        }
        else {
            signal_name = 'do_femel_step';
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
        console.error(`[Action] ERROR: No signal name determined for activity '${execution_activity_name}' on stand ${stand.id}!`);
    }
};
