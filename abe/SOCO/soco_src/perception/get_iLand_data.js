Perception.get_iLand_data = function(stand_data_obj) {
    fmengine.standId = stand_data_obj.stand_id;

    if (!stand || stand.id <= 0) {
        SoCoLog.warn('[Perception] Could not find valid iLand stand object for ID ' + stand_data_obj.stand_id);
        return stand_data_obj;
    }

    var data = stand_data_obj.iLand_stand_data;

    // --- Only populate fields declared in stand_data schema ---
    data.absolute_age_iLand   = stand.absoluteAge;
    data.volume               = stand.volume;
    data.basal_area           = stand.basalArea;
    data.needs_salvage        = stand.flag('abe_need_salvage') || false;
    data.disturbance_severity = stand.flag('abe_disturbance_severity') || 0;
    data.disturbance_volume   = stand.flag('abe_disturbance_volume') || 0;

    // Clear one-shot disturbance notification on iLand side
    // (side-effect only — value is NOT stored on stand_data)
    if (stand.flag('abe_disturbance_detected')) {
        stand.setFlag('abe_disturbance_detected', false);
    }

    return stand_data_obj;
};
