// FILE: soco_src/cognition/decide_on_going.js
// Manages ongoing multi-step sequences. On completion: sets blocked_until_phase.
// CCF activities (targetDBH, plenter) don't block — they re-draw.

Cognition.update_ongoing_sequence = function(stand_data_obj) {
    var activity = stand_data_obj.activity;
    var current_year = Globals.year;

    if (!activity.is_Sequence) {
        return stand_data_obj;
    }

    // --- SYNCHRONIZE WITH TIMELINE ---
    var next_target_year = -1;
    var next_step_index = -1;

    for (var i = 0; i < activity.timeline.length; i++) {
        if (activity.timeline[i] >= current_year) {
            next_target_year = activity.timeline[i];
            next_step_index = i;
            break;
        }
    }

    if (next_target_year !== -1) {
        // Sequence continues — update target
        activity.target_year = next_target_year;
        activity.sequence_current_step = next_step_index;
    } else {
        // --- SEQUENCE COMPLETE ---

        // Clean activity-specific iLand flags
        if (activity.chosen_Activity === 'selectiveThinning') {
            fmengine.standId = stand_data_obj.stand_id;
            Action.prepare.clear_selectiveThinning_flags();
        } else if (activity.chosen_Activity === 'shelterwood') {
            fmengine.standId = stand_data_obj.stand_id;
            Action.prepare.clear_shelterwood_flags();
        } else if (activity.chosen_Activity === 'femel') {
            fmengine.standId = stand_data_obj.stand_id;
            Action.prepare.clear_femel_flags();
        }

        // Record what phase was completed (for hysteresis anchor + monitoring)
        var completed_phase = Cognition.Phases.classify(stand_data_obj);
        activity.last_completed_phase = completed_phase;

        // CCF activities: DON'T block (re-draw next plan_decade)
        var is_CCF = (activity.chosen_Activity === 'targetDBH' ||
                      activity.chosen_Activity === 'plenter_harvest' ||
                      activity.chosen_Activity === 'plenter_thinning');

        if (is_CCF) {
            activity.blocked_until_phase = null;
            activity.blocked_since_year = -1;
        } else {
            // Block until next phase in lifecycle
            var next_phase_map = {
                "Planting":   "Tending",
                "Tending":    "Thinning",
                "Thinning":   "Harvesting",
                "Harvesting": "Tending"
            };
            activity.blocked_until_phase = next_phase_map[completed_phase] || "Tending";
            activity.blocked_since_year = current_year;
        }

        // Reset activity state (plan consumed)
        activity.chosen_Activity = 'none';
        activity.parameters = {};
        activity.timeline = [];
        activity.is_Sequence = false;
        activity.sequence_total_steps = 0;
        activity.sequence_current_step = 0;
        activity.target_year = -1;
        activity.is_actionable = false;
    }

    return stand_data_obj;
};
