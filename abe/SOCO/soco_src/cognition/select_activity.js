// FILE: soco_src/cognition/select_activity.js
// Paper 1 version: Removed social learning code.

Cognition.select_activity = function(stand_data_obj, agent) {
    const { activity_class, structure_class } = stand_data_obj.classified;
    const { last_satisfied_phase, last_activity } = stand_data_obj.history;
    const { preference_focus } = stand_data_obj;

    // --- GATEKEEPER: Phase Memory Check ---
    const continuous_activities = [
        'MegaSTP_Plenter',
        'MegaSTP_TargetDBH'
    ];

    if (activity_class === last_satisfied_phase && !continuous_activities.includes(last_activity)) {
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        return stand_data_obj;
    }

    let context_params_array = null;

    const phase_key = activity_class ? activity_class.toLowerCase() : "unknown";

    const specific_params = agent.activity_table?.[phase_key]?.[preference_focus]?.[structure_class];

    if (specific_params) {
        context_params_array = specific_params.distribution_params;
    } else {
        const any_params = agent.activity_table?.[phase_key]?.[preference_focus]?.['any'];
        if (any_params) {
            context_params_array = any_params.distribution_params;
        }
    }

    if (!context_params_array || context_params_array.length === 0) {
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        return stand_data_obj;
    }

    let dist_params = context_params_array[0];

    const activity_weights = Distributions.sample({
        distribution_function: "dirichlet",
        distribution_params: dist_params
    });

    stand_data_obj.activity.chosen_Activity = Distributions.weighted_random_choice(activity_weights);

    return stand_data_obj;
};
