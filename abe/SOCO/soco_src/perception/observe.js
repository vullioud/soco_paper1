Perception.observe_stand = function(stand_data_obj, agent) { // Changed to accept 'agent'
    try {
        stand_data_obj = Perception.get_iLand_data(stand_data_obj);
        stand_data_obj = Perception.update_history(stand_data_obj);
        stand_data_obj = Perception.compute_derived_data(stand_data_obj, agent);

    } catch (e) {
        SoCoLog.error(`[Observe] Critical error for stand ${stand_data_obj.stand_id}: ${e.message}`);
        SoCoLog.error(`[Observe] Stack: ${e.stack}`);
    }

    return stand_data_obj;
};

