// FILE: soco_src/action/prepare_flags/salvage_flags.js
// Post-disturbance remnant decision is made in plan_decade (Step 3.5).
// This prepare function sets the remnant-clearcut signal for act.js routing.

Action.prepare.salvage = function(params, stand_data_obj, agent) {
    // Only the remnant clearcut is an executable post-salvage activity.
    stand.setFlag('abe_param_salvage_type', 'salvage_clearcut');
    return 'salvage_clearcut';
};

Action.prepare.clear_salvage_flags = function() {
    stand.setFlag('abe_need_salvage', false);
    stand.setFlag('abe_param_salvage_type', null);
    stand.setFlag('abe_param_salvage_trigger_replant', null);
};
