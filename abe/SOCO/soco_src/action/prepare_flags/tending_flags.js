    
// ----- Start of File: soco_src/action/prepare_flags/tending_flags.js -----

/**
 * =================================================================================
 * FILE: tending_flags.js
 * =================================================================================
 * DESCRIPTION:
 * Prepares parameters for Tending.
 * - Sets intensity (static for now, could be dynamic).
 * - Generates species selectivity using the active SpeciesStrategy.
 * =================================================================================
 */

Action.prepare.tending = function(params, stand_data_obj) {

    // 1. Get Agent & Strategy
    var agent = socoabe.institution.all_agents.find(function(a) { return a.id === stand_data_obj.agent_id; });
    var strategyName = stand_data_obj.species_profile;

    // Fallback
    if (!strategyName || strategyName === "none") strategyName = "indiscriminate";

    // 2. Execute Strategy for 'tending'
    // Returns weights: { "quro": 1.0, "rest": 0.5 }
    var speciesSelectivity = SpeciesStrategies.execute(strategyName, stand_data_obj, agent, 'tending');

    // DIAGNOSTIC: Validate selectivity
    if (!speciesSelectivity || typeof speciesSelectivity !== 'object') {
        console.warn(`[Action] WARNING: Invalid speciesSelectivity for tending on stand ${stand_data_obj.stand_id}, using empty object`);
        speciesSelectivity = {};
    }

    // 3. Set Flag
    stand.setFlag('abe_param_speciesSelectivity', speciesSelectivity);

};

// ----- End of File: soco_src/action/prepare_flags/tending_flags.js -----

  