// FILE: soco_src/cognition/select_parameters.js
// Paper 1 version: Removed social learning code.

Cognition.select_parameters = function(stand_data_obj, agent) {
    const activity_name = stand_data_obj.activity.chosen_Activity;
    const preference = stand_data_obj.preference_focus;
    const params_for_preference = agent.parameter_table?.[activity_name]?.[preference];

    if (!params_for_preference) {
        stand_data_obj.activity.parameters = {};
        return stand_data_obj;
    }

    // Sample base parameters from agent's distribution
    const base_params = {};
    for (const param_name in params_for_preference) {
        const dist_config = params_for_preference[param_name];
        let sampled_value;

        // Unbox wrapped distribution_params if necessary
        let params_to_sample = dist_config.distribution_params;
        if (Array.isArray(params_to_sample)) {
            params_to_sample = params_to_sample[0];
        }

        if (dist_config.distribution_function === "lookup") {
            const profile_name = params_to_sample.profile_name;

            if (param_name === "species_profile") {
                sampled_value = stand_data_obj.species_profile;
            } else if (param_name === "plenterCurve") {
                sampled_value = agent.plenter_profiles_table[profile_name];
            } else if (param_name === "dbhListProfile") {
                sampled_value = agent.targetDBH_profiles_table[profile_name];
            }
        } else {
            const sampler_config = {
                distribution_function: dist_config.distribution_function,
                distribution_params: params_to_sample
            };
            sampled_value = Distributions.sample(sampler_config);
        }

        base_params[param_name] = (sampled_value !== null && typeof sampled_value !== 'undefined') ? sampled_value : 0;
    }

    stand_data_obj.activity.parameters = base_params;

    if (activity_name === 'planting' && typeof stand_data_obj.activity.parameters.execution_schedule === 'undefined') {
        stand_data_obj.activity.parameters.execution_schedule = 2;
    }

    return stand_data_obj;
};
