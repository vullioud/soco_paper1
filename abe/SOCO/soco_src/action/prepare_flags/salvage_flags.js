// FILE: soco_src/action/prepare_flags/salvage_flags.js
// Paper 1: Salvage response by behavioral_type instead of preference_focus.

Action.prepare.salvage = function(params, stand_data_obj, agent) {
    var severity = stand_data_obj.iLand_stand_data.disturbance_severity || 0;
    var btype = agent ? agent.behavioral_type : 'TR';

    var response = { type: 'salvage_leave', fraction: 0, replant: false };

    switch (btype) {
        case 'MF':
            if (severity >= 0.6)      response = { type: 'salvage_clearcut', fraction: 1.0, replant: true };
            else if (severity >= 0.3) response = { type: 'salvage_harvest', fraction: 0.9, replant: false };
            else                      response = { type: 'salvage_harvest', fraction: 0.7, replant: false };
            break;
        case 'OP':
            if (severity >= 0.3)      response = { type: 'salvage_clearcut', fraction: 1.0, replant: true };
            else                      response = { type: 'salvage_harvest', fraction: 1.0, replant: false };
            break;
        case 'TR':
            if (severity >= 0.6)      response = { type: 'salvage_harvest', fraction: 0.6, replant: false };
            else                      response = { type: 'salvage_leave', fraction: 0, replant: false };
            break;
        case 'PA':
            response = { type: 'salvage_leave', fraction: 0, replant: false };
            break;
        case 'EN':
            if (severity >= 0.8)      response = { type: 'salvage_harvest', fraction: 0.3, replant: false };
            else                      response = { type: 'salvage_leave', fraction: 0, replant: false };
            break;
    }

    var salvage_type = response.type;
    var salvage_fraction = response.fraction || 1.0;
    var min_dbh = (salvage_type === 'salvage_clearcut') ? 0 : 10;

    stand.setFlag('abe_param_salvage_type', salvage_type);
    stand.setFlag('abe_param_salvage_fraction', salvage_fraction);
    stand.setFlag('abe_param_salvage_min_dbh', min_dbh);
    stand.setFlag('abe_param_salvage_trigger_replant', response.replant);

    return salvage_type;
};

Action.prepare.clear_salvage_flags = function() {
    stand.setFlag('abe_need_salvage', false);
    stand.setFlag('abe_param_salvage_type', null);
    stand.setFlag('abe_param_salvage_fraction', null);
    stand.setFlag('abe_param_salvage_min_dbh', null);
    stand.setFlag('abe_param_salvage_trigger_replant', null);
};
