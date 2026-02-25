Perception.update_history = function(stand_data_obj) {
    fmengine.standId = stand_data_obj.stand_id;
    if (!stand || stand.id <= 0) return stand_data_obj;

    const history = stand_data_obj.history;

    const last_activity_flag = stand.flag('abe_last_activity');
    const last_activity_year_flag = stand.flag('abe_last_activity_year');

    // Log activity IMMEDIATELY when flag is detected
    if (last_activity_flag !== null && typeof last_activity_flag !== 'undefined' && last_activity_year_flag !== null && last_activity_year_flag !== -1) {
        Monitoring.log_activity_immediate(last_activity_year_flag, stand_data_obj.stand_id, stand_data_obj.agent_id, last_activity_flag);
    }

    // Update general history if a new activity was flagged
    if (last_activity_flag !== null && typeof last_activity_flag !== 'undefined' && last_activity_year_flag === (Globals.year - 1)) {
        history.last_activity = last_activity_flag;
        history.last_activity_Year = last_activity_year_flag;

        // Map Activity to Phase
        let satisfied_phase = 'none';

        if (last_activity_flag === 'MegaSTP_Planting') {
            satisfied_phase = 'Planting';
        } else if (last_activity_flag === 'MegaSTP_Tending') {
            satisfied_phase = 'Tending';
        } else if (last_activity_flag === 'MegaSTP_ThinningFromBelow' ||
                   last_activity_flag === 'MegaSTP_SelectiveThinning_Remove') {
            satisfied_phase = 'Thinning';
        } else if (last_activity_flag === 'MegaSTP_Clearcut' ||
                   last_activity_flag === 'MegaSTP_Shelterwood_Final' ||
                   last_activity_flag === 'MegaSTP_TargetDBH' ||
                   last_activity_flag === 'MegaSTP_Plenter') {
            satisfied_phase = 'Harvesting';
        }

        if (satisfied_phase !== 'none') {
            history.last_satisfied_phase = satisfied_phase;
        }

        // Add to activity history log
        if (stand_data_obj.activity_history && stand_data_obj.activity_history.add_entry) {
            const activity_context = {
                age: stand_data_obj.iLand_stand_data.stand_age,
                structure_class: stand_data_obj.classified.structure_class,
                age_class: stand_data_obj.classified.age_class,
                preference_focus: stand_data_obj.preference_focus,
                volume_before: stand_data_obj.iLand_stand_data.volume,
                basal_area_before: stand_data_obj.iLand_stand_data.basal_area,
                volume_removed: stand.flag('abe_last_harvest_volume') || 0,
                trees_removed: stand.flag('abe_last_harvest_trees') || 0,
                species_composition: stand_data_obj.get_species_composition()
            };

            const activity_params = stand_data_obj.activity.parameters || {};

            stand_data_obj.activity_history.add_entry(
                last_activity_year_flag,
                last_activity_flag,
                activity_params,
                activity_context
            );
        }

        // Track harvest events
        const volume_removed = stand.flag('abe_last_harvest_volume') || 0;
        if (volume_removed > 0) {
            history.harvest_events.push({
                year: last_activity_year_flag,
                activity: last_activity_flag,
                volume_removed: volume_removed,
                trees_removed: stand.flag('abe_last_harvest_trees') || 0,
                volume_remaining: stand_data_obj.iLand_stand_data.volume
            });

            if (history.harvest_events.length > 20) {
                history.harvest_events.shift();
            }

            const current_total = stand.flag('abe_rotation_total_harvest') || 0;
            stand.setFlag('abe_rotation_total_harvest', current_total + volume_removed);
        }
    }

    return stand_data_obj;
};

Perception.get_reassessment_flags = function(stand_data_obj) {
    fmengine.standId = stand_data_obj.stand_id;
    if (!stand || stand.id <= 0) return stand_data_obj;

    var needs_reassessment = stand.flag('abe_need_reassessment');
    stand_data_obj.iLand_stand_data.needs_reassessment = (needs_reassessment === true);

    return stand_data_obj;
};
