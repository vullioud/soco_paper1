// FILE: soco_src/cognition/select_parameters.js
// Paper 1: Simplified lookup by [activity][behavioral_type]. Fixed values from abe-lib.

Cognition.select_parameters = function(stand_data_obj, agent) {
    var activity_name = stand_data_obj.activity.chosen_Activity;
    var params_for_type = agent.parameter_table[activity_name]
        && agent.parameter_table[activity_name][agent.behavioral_type];

    if (!params_for_type) {
        stand_data_obj.activity.parameters = {};
        return stand_data_obj;
    }

    // Direct copy — values are fixed, no sampling needed
    var params = {};
    for (var key in params_for_type) {
        params[key] = params_for_type[key];
    }

    // Attach species profile from stand data
    params.species_profile = stand_data_obj.species_profile;

    stand_data_obj.activity.parameters = params;
    return stand_data_obj;
};
