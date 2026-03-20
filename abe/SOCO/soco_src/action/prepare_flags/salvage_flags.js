// FILE: soco_src/action/prepare_flags/salvage_flags.js
// Post-disturbance remnant decision is made in plan_decade (Step 3.5).
// This prepare function reads the already-set flags for act.js signal routing.

Action.prepare.salvage = function(params, stand_data_obj, agent) {
    // Decision was made in plan_decade. Read the flag.
    var salvage_type = stand.flag('abe_param_salvage_type') || 'salvage_leave';
    return salvage_type;
};

Action.prepare.clear_salvage_flags = function() {
    stand.setFlag('abe_need_salvage', false);
    stand.setFlag('abe_param_salvage_type', null);
    stand.setFlag('abe_param_salvage_trigger_replant', null);
};
