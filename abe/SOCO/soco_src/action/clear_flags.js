Action.prepare.clear_flags = function() {
    // Clear previous flags to ensure clean state before a new action

    var prev_year = stand.flag('abe_last_activity_year');
    var has_valid_year = (typeof prev_year === 'number' && prev_year >= 0);
    var is_current_year = (prev_year === Globals.year);

    if (has_valid_year && is_current_year) {
        // Do NOT clear receipt flags - they haven't been observed yet
    } else {
        stand.setFlag('abe_need_reassessment', null);
        stand.setFlag('abe_last_activity', null);
        stand.setFlag('abe_last_activity_year', null);
    }

    // Clear command flag
    stand.setFlag('abe_next_activity', null);

    // Clear ALL parameter flags
    stand.setFlag('abe_param_execution_schedule', null);
    stand.setFlag('abe_param_preferenceFunction', null);
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
