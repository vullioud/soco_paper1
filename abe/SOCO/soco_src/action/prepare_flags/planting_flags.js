
Action.prepare.planting = function(params, stand_data_obj, agent) {

    // 2. Execute Strategy — returns { species: [...], fractions: [...] }
    var result = SpeciesStrategies.execute(stand_data_obj, agent, 'planting');

    // 3. Extract Results & Set Defaults
    var planting_species_list = result.species;
    var planting_fractions_list = result.fractions;

    if (!planting_species_list || planting_species_list.length === 0) {
        planting_species_list = ['piab'];
        planting_fractions_list = [1.0];
        SoCoLog.warn('[Action] Warning: Strategy returned no species for planting. Defaulting to Spruce.');
    }

    // 4. Set Flags
    stand.setFlag('abe_param_planting_species', planting_species_list);
    stand.setFlag('abe_param_planting_fraction', planting_fractions_list);

};
