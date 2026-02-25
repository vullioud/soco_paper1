/**
 * =================================================================================
 * FILE: update_ongoing_sequence.js (INSTRUMENTED WITH LOGGING)
 * =================================================================================
 */
Cognition.update_ongoing_sequence = function(stand_data_obj) {
    var activity = stand_data_obj.activity;
    var current_year = Globals.year;

    if (!activity.is_Sequence) {
        return stand_data_obj;
    }

    // --- 1. PROBABILISTIC ABANDONMENT ---
    var start_prob = 0.000;
    var end_prob = 0.000;
    var progress = activity.sequence_total_steps > 1 ? (activity.sequence_current_step / (activity.sequence_total_steps - 1)) : 0;
    var probability_to_abandon = start_prob + (end_prob - start_prob) * progress;
    var random_draw = Math.random();

    if (random_draw < probability_to_abandon) {
        // --- PATH 1: Abandon the sequence ---
        if (activity.chosen_Activity === 'selectiveThinning') {
            fmengine.standId = stand_data_obj.stand_id; // Set context before clearing
            Action.prepare.clear_selectiveThinning_flags();
        } else if (activity.chosen_Activity === 'shelterwood') {
            fmengine.standId = stand_data_obj.stand_id; // Set context before clearing
            Action.prepare.clear_shelterwood_flags();
        }  else if (activity.chosen_Activity === 'femel') { // <--- ADDED
            fmengine.standId = stand_data_obj.stand_id; 
            Action.prepare.clear_femel_flags();
        }


        activity.chosen_Activity = 'noManagement';
        activity.parameters = {};
        activity.timeline = [];
        activity.is_Sequence = false;
        activity.sequence_total_steps = 0;
        activity.sequence_current_step = 0;
        activity.target_year = -1;
        return stand_data_obj;
    } else {
        // --- PATH 2: Continue the sequence ---
    }

    // --- 2. SYNCHRONIZE WITH THE TIMELINE ---
    var next_target_year = -1;
    var next_step_index = -1;

    for (var i = 0; i < activity.timeline.length; i++) {
        if (activity.timeline[i] >= current_year) {
            next_target_year = activity.timeline[i];
            next_step_index = i;
            break;
        }
    }

    // clean stand marks
    if (next_target_year !== -1) {
        activity.target_year = next_target_year;
        activity.sequence_current_step = next_step_index;
    } else {
        if (activity.chosen_Activity === 'selectiveThinning') {
            fmengine.standId = stand_data_obj.stand_id; // Set context before clearing
            Action.prepare.clear_selectiveThinning_flags();
        } else if (activity.chosen_Activity === 'shelterwood') {
            fmengine.standId = stand_data_obj.stand_id; // Set context before clearing
            Action.prepare.clear_shelterwood_flags();
        }  else if (activity.chosen_Activity === 'femel') { // <--- ADDED
            fmengine.standId = stand_data_obj.stand_id; 
            Action.prepare.clear_femel_flags();
        }

        
        activity.chosen_Activity = 'noManagement';
        activity.parameters = {};
        activity.timeline = [];
        activity.is_Sequence = false;
        activity.sequence_total_steps = 0;
        activity.sequence_current_step = 0;
        activity.target_year = -1;
    }
    
    return stand_data_obj;
};