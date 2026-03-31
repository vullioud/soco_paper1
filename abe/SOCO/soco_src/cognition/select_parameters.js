// FILE: soco_src/cognition/select_parameters.js
// Paper 1: Simplified lookup by [activity][behavioral_type]. Fixed values from abe-lib.

Cognition.select_parameters = function(stand_data_obj, agent) {
    var activity_name = stand_data_obj.activity.chosen_Activity;

    // Resolve compound harvest+planting names to base activity for parameter lookup.
    // parameter_distributions.json is keyed by base name (shelterwood, femel, etc.).
    var base_activity = activity_name
        .replace('_planting', '').replace('_no_planting', '');

    var params_for_type = agent.parameter_table[base_activity]
        && agent.parameter_table[base_activity][agent.behavioral_type];

    if (!params_for_type) {
        stand_data_obj.activity.parameters = {};
        return stand_data_obj;
    }

    // Direct copy — values are fixed, no sampling needed
    var params = {};
    for (var key in params_for_type) {
        params[key] = params_for_type[key];
    }

    // Budget stretch: widen interval for budget-constrained agents.
    // Poor agents do the same silviculture, just less frequently.
    var budget_cfg = SoCoABE_CONFIG.BUDGET || {};
    var stretch_cfg = budget_cfg.BUDGET_STRETCH;
    if (stretch_cfg && params.interval && agent.resources > 0) {
        var pps = budget_cfg.POINTS_PER_STAND_PER_DECADE || 3;
        var pressure = agent.resources * pps;
        var stretch = Math.min(
            stretch_cfg.MAX_STRETCH || 3.0,
            Math.max(1.0, (stretch_cfg.REFERENCE_PRESSURE || 2.0) / pressure)
        );
        if (stretch > 1.0) {
            params.interval = Math.round(params.interval * stretch);
        }
    }

    stand_data_obj.activity.parameters = params;
    return stand_data_obj;
};
