
Action.prepare.planting = function(params, stand_data_obj) {
    
    // 1. Get the Agent
    var agent = socoabe.institution.all_agents.find(function(a) { return a.id === stand_data_obj.agent_id; });
    
    // 2. Get the Strategy Name from the Stand Data
    var strategyName = stand_data_obj.species_profile; 
    // Fallback if not set
    if (!strategyName || strategyName === "none") strategyName = "indiscriminate";

    // 3. Execute Strategy
    // This returns { species: [...], fractions: [...] }
    var result = SpeciesStrategies.execute(strategyName, stand_data_obj, agent, 'planting');

    // 4. Extract Results & Set Defaults
    var planting_species_list = result.species;
    var planting_fractions_list = result.fractions;

    if (!planting_species_list || planting_species_list.length === 0) {
        planting_species_list = ['piab'];
        planting_fractions_list = [1.0];
        console.warn(`[Action] Warning: Strategy '${strategyName}' returned no species for planting. Defaulting to Spruce.`);
    }

    // 5. Set Flags
    stand.setFlag('abe_param_planting_species', planting_species_list);
    stand.setFlag('abe_param_planting_fraction', planting_fractions_list);
    
};