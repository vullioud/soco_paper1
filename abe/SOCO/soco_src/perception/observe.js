Perception.observe_stand = function(stand_data_obj, agent) { // Changed to accept 'agent'
    try {
        stand_data_obj = Perception.get_iLand_data(stand_data_obj);
        stand_data_obj = Perception.update_history(stand_data_obj);
        stand_data_obj = Perception.compute_derived_data(stand_data_obj, agent);

        // WET classification (annual, after species vector is built)
        if (SoCoABE_CONFIG.SPECIES_SELECTIVITY_MODE === 'wet_dynamic') {
            var wet_type = WetClassifier.classifyWET(stand_data_obj);
            stand_data_obj.wet_type = wet_type;
            stand.setFlag('wet_type', wet_type);
        }

    } catch (e) {
        SoCoLog.error(`[Observe] Critical error for stand ${stand_data_obj.stand_id}: ${e.message}`);
        SoCoLog.error(`[Observe] Stack: ${e.stack}`);
    }

    return stand_data_obj;
};

