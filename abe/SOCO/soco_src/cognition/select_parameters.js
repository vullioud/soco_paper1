// ----- Start of File: soco_src/cognition/select_parameters.js -----

Cognition.select_parameters = function(stand_data_obj, agent) {
    const activity_name = stand_data_obj.activity.chosen_Activity;
    const preference = stand_data_obj.preference_focus;
    const params_for_preference = agent.parameter_table?.[activity_name]?.[preference];

    if (!params_for_preference) {
        stand_data_obj.activity.parameters = {};
        return stand_data_obj;
    }

    // ===== STEP 1: Sample base parameters from agent's distribution =====
    const base_params = {};
    for (const param_name in params_for_preference) {
        const dist_config = params_for_preference[param_name];
        let sampled_value;

        // --- THIS IS THE ROBUSTNESS FIX ---
        // Check if distribution_params is an array and unbox it if necessary.
        let params_to_sample = dist_config.distribution_params;
        if (Array.isArray(params_to_sample)) {
            params_to_sample = params_to_sample[0];
        }
        // ---------------------------------

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
            // Create a new object to pass to the sampler
            const sampler_config = {
                distribution_function: dist_config.distribution_function,
                distribution_params: params_to_sample
            };
            sampled_value = Distributions.sample(sampler_config);
        }

        base_params[param_name] = (sampled_value !== null && typeof sampled_value !== 'undefined') ? sampled_value : 0;
    }

    // ===== STEP 2: SOCIAL LEARNING FOR PARAMETERS (CONFIG-CONTROLLED) =====
    let final_params = base_params;

    // Check if parameter-level social learning is enabled
    const social_config = (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.SOCIAL_LEARNING)
        ? SoCoABE_CONFIG.SOCIAL_LEARNING
        : null;

    if (social_config && social_config.ENABLED &&
        social_config.PARAMETER_LEARNING && social_config.PARAMETER_LEARNING.enabled &&
        typeof NetworkModule !== 'undefined') {

        try {
            const network_type = social_config.NETWORK_TYPE || 'similarity';
            const time_window = social_config.PARAMETER_LEARNING.time_window || 10;
            const noise_factor = social_config.PARAMETER_LEARNING.noise_factor || 0.1;

            // Learn parameters from neighbors who used this activity
            final_params = NetworkModule.learn_parameters_from_neighbors(
                agent,
                stand_data_obj,
                activity_name,
                base_params,
                network_type,
                time_window,
                noise_factor
            );

        } catch (e) {
            // If social learning fails, fall back to base parameters
            console.error(`[Parameter Learning] Failed for agent ${agent.id}, stand ${stand_data_obj.stand_id}: ${e.message}`);
            final_params = base_params;
        }
    }

    stand_data_obj.activity.parameters = final_params;

    if (activity_name === 'planting' && typeof stand_data_obj.activity.parameters.execution_schedule === 'undefined') {
        // console.log(`[Cognition] Defaulting execution_schedule to 1 for planting (Stand ${stand_data_obj.stand_id})`);
        stand_data_obj.activity.parameters.execution_schedule = 2;
    }

    return stand_data_obj;
};

