Action.prepare.clear_flags = function() {
    // This function is called by 'Action.trigger_activity' BEFORE a new action is set.

    // DEBUG: Log when clearing flags at years ending in 9 or 0
    var prev_activity = stand.flag('abe_last_activity');
    var prev_year = stand.flag('abe_last_activity_year');
    if (Globals.year % 10 === 9 || Globals.year % 10 === 0) {
        console.log(`[DEBUG clear_flags] Year ${Globals.year}, Stand ${stand.id}: CLEARING prev_activity=${prev_activity}, prev_year=${prev_year}`);
    }

    // --- 1. Consume the "Receipt" Flags ---
    // The agent has acknowledged the last completed action, so we clear the flags.
    // CRITICAL FIX: Only clear activity flags if they're from a PREVIOUS year.
    // Activities executed in the CURRENT year haven't been observed yet and should not be cleared.

    // Check if prev_year is a number (not null, undefined, or -1)
    var has_valid_year = (typeof prev_year === 'number' && prev_year >= 0);
    var is_current_year = (prev_year === Globals.year);

    if (has_valid_year && is_current_year) {
        // DEBUG: Log when we SKIP clearing because the activity is from the current year
        if (Globals.year % 10 === 9 || Globals.year % 10 === 0) {
            console.log(`[DEBUG clear_flags SKIPPED] Year ${Globals.year}, Stand ${stand.id}: NOT clearing because prev_year=${prev_year} equals current year`);
        }
        // Do NOT clear the receipt flags - they haven't been observed yet
    } else {
        // Clear normally - either no previous activity, or it's from a past year
        stand.setFlag('abe_need_reassessment', null);
        stand.setFlag('abe_last_activity', null);
        stand.setFlag('abe_last_activity_year', null);
    }

    // --- 2. Clear the "Command" Flag ---
    // Clear the command from the previous turn to prevent re-execution.
    stand.setFlag('abe_next_activity', null);

    // --- 3. Clear ALL Parameter Flags ---
    // This ensures a clean state for the new action's parameters.
    stand.setFlag('abe_param_execution_schedule', null);
    stand.setFlag('abe_param_preferenceFunction', null); // Added for clearcut
    stand.setFlag('abe_param_thinningShare', null);
    stand.setFlag('abe_param_nTrees', null);
    stand.setFlag('abe_param_nCompetitors', null);
    stand.setFlag('abe_param_times', null);
    stand.setFlag('abe_param_interval', null);
    stand.setFlag('abe_param_intensity', null);
    stand.setFlag('abe_param_species_profile', null);
    stand.setFlag('abe_param_plenterCurve', null);
    stand.setFlag('abe_param_dbhList', null);
    stand.setFlag('abe_param_nCompetitors', null);
    stand.setFlag('abe_param_speciesSelectivity', null);
    stand.setFlag('abe_param_fraction_to_remove', null);

};