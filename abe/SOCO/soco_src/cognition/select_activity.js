Cognition.select_activity = function(stand_data_obj, agent) {
    // Destructure needed data
    const { activity_class, structure_class } = stand_data_obj.classified; 
    const { last_satisfied_phase, last_activity } = stand_data_obj.history;
    const { preference_focus } = stand_data_obj;
   
    // --- GATEKEEPER: Phase Memory Check ---
    // Rule: If the stand is still in the same phase that was just satisfied by a "Package" activity,
    // prevent re-scheduling. Only "Continuous" activities (Plenter, TargetDBH) are allowed to repeat 
    // within the same phase.
    
    // List of MegaSTP IDs that are allowed to repeat within a phase.
    // These correspond to the IDs defined in mega_STP.js
    const continuous_activities = [
        'MegaSTP_Plenter',
        'MegaSTP_TargetDBH'
    ];
    
    // Logic:
    // 1. Is the current biological phase the same as the one we just finished?
    // 2. Was the last activity NOT a continuous one?
    if (activity_class === last_satisfied_phase && !continuous_activities.includes(last_activity)) {
        // console.log(`[Cognition] Stand ${stand_data_obj.stand_id}: Gatekeeper active. Phase '${activity_class}' satisfied by '${last_activity}'. Skipping.`);
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        return stand_data_obj;
    }

    let context_params_array = null;

    // Ensure we handle casing (e.g., "Thinning" -> "thinning") to match JSON keys
    const phase_key = activity_class ? activity_class.toLowerCase() : "unknown";

    // Debugging to verify the switch
    // console.log(`[Cognition] Selecting activity using Class: '${phase_key}' (Structure: ${structure_class})`);

    const specific_params = agent.activity_table?.[phase_key]?.[preference_focus]?.[structure_class];
    
    if (specific_params) {
        context_params_array = specific_params.distribution_params;
    } else {
        // 2. If not found, fall back and check for an 'any' structure class.
        const any_params = agent.activity_table?.[phase_key]?.[preference_focus]?.['any'];
        if (any_params) {
            context_params_array = any_params.distribution_params;
        }
    }

    if (!context_params_array || context_params_array.length === 0) {
        // console.log(`[Cognition] No activity found for ${phase_key}/${preference_focus}/${structure_class}. Defaulting to noManagement.`);
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        return stand_data_obj;
    }

    let dist_params = context_params_array[0];

    // ===== SOCIAL LEARNING: Incorporate neighbor activities =====
    const social_config = (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.SOCIAL_LEARNING)
        ? SoCoABE_CONFIG.SOCIAL_LEARNING
        : null;

    if (social_config && social_config.ENABLED &&
        social_config.ACTIVITY_LEARNING && social_config.ACTIVITY_LEARNING.enabled &&
        typeof NetworkModule !== 'undefined') {

        const network_type = social_config.NETWORK_TYPE || 'similarity';
        const learning_rate = social_config.ACTIVITY_LEARNING.learning_rate || 0.5;
        const time_window = social_config.ACTIVITY_LEARNING.time_window || 10;

        // Get observed neighbor activities
        const observed_activities = NetworkModule.screen_neighbor_activities(
            agent,
            stand_data_obj,
            network_type,
            time_window
        );

        if (observed_activities.length > 0) {
            // Make a deep copy to avoid modifying the original
            dist_params = helpers.deepCopy(dist_params);

            // Aggregate: count each base activity once per observation
            const activity_counts = {};
            for (const obs of observed_activities) {
                const base_activity = NetworkModule.map_to_base_activity(obs.activity);
                activity_counts[base_activity] = (activity_counts[base_activity] || 0) + 1;
            }

            // Add to alpha values
            for (const base_activity in activity_counts) {
                const idx = dist_params.options.indexOf(base_activity);
                if (idx !== -1) {
                    // Add learning_rate * count to the alpha value
                    dist_params.alpha[idx] += learning_rate * activity_counts[base_activity];
                }
            }
        }
    }

    const activity_weights = Distributions.sample({
        distribution_function: "dirichlet",
        distribution_params: dist_params
    });

    stand_data_obj.activity.chosen_Activity = Distributions.weighted_random_choice(activity_weights);

    return stand_data_obj;
};