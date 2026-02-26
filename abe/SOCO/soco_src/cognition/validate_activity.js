// ----- Start of File: soco_src/cognition/validate_activity.js -----

/**
 * =================================================================================
 * FILE: validate_activity.js (With Sequence Preservation)
 * =================================================================================
 * DESCRIPTION:
 * Validates the feasibility of the plan and calculates a utility score
 * to prioritize execution.
 * 
 * FIX: Now preserves ongoing sequences even if the next step is outside
 * the 10-year planning horizon.
 * =================================================================================
 */

Cognition.validate_activity = function(stand_data_obj) {
    var activity = stand_data_obj.activity;
    var current_year = Globals.year;
    var planning_horizon = 9; 

    // --- Step 1: Handle no-ops ---
    if (activity.chosen_Activity === 'noManagement' || activity.target_year === -1) {
        activity.is_actionable = false;
        activity.scheduling_priority = 'none';
        activity.utility_score = 0; // Default score
        return stand_data_obj;
    }

    var target_year = activity.target_year;

    // --- Step 2: Validate Timing ---
    var is_within_window = (target_year >= current_year && target_year <= current_year + planning_horizon);

    if (is_within_window) {
        // --- PATH 1: Valid Actionable Plan ---
        activity.scheduling_priority = 'high';
        activity.is_actionable = true;
        
        // --- Step 3: Calculate Utility Score ---
        var score = 0;
        var act_name = activity.chosen_Activity;
        var vol = stand_data_obj.iLand_stand_data.volume;
        var ba = stand_data_obj.iLand_stand_data.basal_area;
        var soco_age = stand_data_obj.iLand_stand_data.absolute_age_iLand;

        if (act_name === 'clearcut' || act_name === 'shelterwood' || act_name === 'targetDBH' || act_name === 'plenter_harvest') {
            // Harvesting: Prioritize high volume
            score = vol;
        } else if (act_name === 'thinningFromBelow' || act_name === 'selectiveThinning' || act_name === 'tending' || act_name === 'plenter_thinning') {
            // Tending/Thinning: Prioritize high density
            score = ba;
        } else if (act_name === 'planting') {
            // Planting: Critical urgency for empty stands. 
            // Score = 100 base + inverse of age (younger = higher priority, max at age 0/1)
            score = 100 + (soco_age <= 0.1 ? 100 : 10 / soco_age); 
        }
        
        activity.utility_score = score;

    } else {
        // --- PATH 2: Outside Horizon ---
        
        // FIX: If it is an ongoing sequence with a target in the future (e.g. Year 15),
        // we must PRESERVE it, not reset it.
        if (activity.is_Sequence && target_year > current_year) {
            // Preserve the plan, but mark as not actionable this year
            activity.is_actionable = false;
            activity.scheduling_priority = 'none';
            activity.utility_score = 0;
        } else {
            // Invalid plan (in the past, or non-sequence too far ahead) -> Reset
            activity.chosen_Activity = 'noManagement';
            activity.parameters = {};
            activity.timeline = [];
            activity.is_Sequence = false;
            activity.sequence_total_steps = 0;
            activity.sequence_current_step = 0;
            activity.target_year = -1;
            activity.is_actionable = false;
            activity.scheduling_priority = 'none';
            activity.utility_score = 0;
        }
    }

    return stand_data_obj;
};
