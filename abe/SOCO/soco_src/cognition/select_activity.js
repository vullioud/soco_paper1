// FILE: soco_src/cognition/select_activity.js
// Paper 1: Flat lookup by phase from agent.activity_table[phase].

Cognition.select_activity = function(stand_data_obj, agent) {
    const { activity_class } = stand_data_obj.classified;
    const { last_satisfied_phase, last_activity } = stand_data_obj.history;

    var continuous_activities = ['MegaSTP_Plenter', 'MegaSTP_TargetDBH'];

    if (activity_class === last_satisfied_phase && !continuous_activities.includes(last_activity)) {
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        return stand_data_obj;
    }

    var phase_key = activity_class || "unknown";
    var params = agent.activity_table[phase_key];

    if (!params || !params.options || !params.alpha) {
        stand_data_obj.activity.chosen_Activity = 'noManagement';
        return stand_data_obj;
    }

    var activity_weights = Distributions.sample({
        distribution_function: "dirichlet",
        distribution_params: params
    });

    stand_data_obj.activity.chosen_Activity = Distributions.weighted_random_choice(activity_weights);

    return stand_data_obj;
};
