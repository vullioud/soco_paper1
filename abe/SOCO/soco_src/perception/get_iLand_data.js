// ----- Start of File: soco_src/perception/get_iLand_data.js -----

Perception.get_iLand_data = function(stand_data_obj) {
    fmengine.standId = stand_data_obj.stand_id;
    
    if (!stand || stand.id <= 0) {
        SoCoLog.warn(`[Perception] Could not find valid iLand stand object for ID ${stand_data_obj.stand_id}`);
        return stand_data_obj;
    }

    const data = stand_data_obj.iLand_stand_data;

    data.stand_age = stand.age;
    data.absolute_age_iLand = stand.absoluteAge;
    data.volume = stand.volume;
    data.basal_area = stand.basalArea;
    data.top_height = stand.topHeight;
    data.stems = stand.stems || 0;  // Trees per hectare
    data.species_count = stand.nspecies;
    data.year_of_observation = Globals.year;
    data.U = stand.U;
    data.thinning_intensity = stand.thinningIntensity;
    data.time_since_last_activity_iLand = stand.elapsed;
    data.last_activity_name_iLand = stand.lastActivity;

    // Harvest tracking
    data.last_harvest_volume = stand.flag('abe_last_harvest_volume') || 0;
    data.last_harvest_trees = stand.flag('abe_last_harvest_trees') || 0;
    data.last_harvest_year = stand.flag('abe_last_harvest_year') || -1;
    data.years_since_harvest = (data.last_harvest_year > 0)
        ? Globals.year - data.last_harvest_year
        : -1;
    data.rotation_total_harvest = stand.flag('abe_rotation_total_harvest') || 0;

    // Disturbance tracking (flags set by salvage activity's onAfterDisturbance callback)
    data.disturbance_detected = stand.flag('abe_disturbance_detected') || false;
    data.disturbance_year = stand.flag('abe_disturbance_year') || -1;
    data.disturbance_volume = stand.flag('abe_disturbance_volume') || 0;
    data.disturbance_severity = stand.flag('abe_disturbance_severity') || 0;
    data.years_since_disturbance = (data.disturbance_year > 0)
        ? Globals.year - data.disturbance_year
        : -1;
    data.needs_salvage = stand.flag('abe_need_salvage') || false;

    // Clear the disturbance_detected flag after reading (it's a one-time event notification)
    // But keep the historical data (disturbance_year, severity, etc.)
    if (data.disturbance_detected) {
        stand.setFlag('abe_disturbance_detected', false);
    }

    // NOTE: Dead wood tracking via DeadTreeList disabled due to crash (signal 11)
    // The loadFromStand() function causes segmentation fault in some iLand versions
    // To re-enable, uncomment and fix the underlying C++ code in fmdeadtreelist.cpp
    data.deadwood_volume_snags = 0;
    data.deadwood_volume_dwd = 0;

    return stand_data_obj;
};

