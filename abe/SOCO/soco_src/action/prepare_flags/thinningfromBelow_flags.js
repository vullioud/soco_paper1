    
// ----- Start of File: soco_src/action/prepare_flags/thinningfromBelow_flags.js -----

/**
 * =================================================================================
 * FILE: thinningfromBelow_flags.js
 * =================================================================================
 * DESCRIPTION:
 * Prepares parameters for Thinning From Below.
 * - Sets removal share.
 * - Generates species selectivity using the active SpeciesStrategy.
 * =================================================================================
 */

Action.prepare.thinningFromBelow = function(params, stand_data_obj) {

    // 1. Thinning Share (Volume fraction)
    var share = params.thinningShare !== undefined ? params.thinningShare : 0.2;

    // DIAGNOSTIC: Validate share type
    if (typeof share !== 'number' || isNaN(share)) {
        SoCoLog.warn(`[Action] Invalid thinningShare type for stand ${stand_data_obj.stand_id}: ${typeof share}, value=${share}. Using default 0.2`);
        share = 0.2;
    }

    // Safety clamp
    if (share < 0) share = 0;
    if (share > 1) share = 1;

    stand.setFlag('abe_param_thinningShare', share);

    // 2. Species Selectivity via Strategy
    var agent = socoabe.institution.all_agents.find(function(a) { return a.id === stand_data_obj.agent_id; });
    var speciesSelectivity = SpeciesStrategies.execute(stand_data_obj, agent, 'thinning');

    // DIAGNOSTIC: Validate selectivity
    if (!speciesSelectivity || typeof speciesSelectivity !== 'object') {
        SoCoLog.warn(`[Action] Invalid speciesSelectivity for stand ${stand_data_obj.stand_id}, using empty object`);
        speciesSelectivity = {};
    }

    stand.setFlag('abe_param_speciesSelectivity', speciesSelectivity);

};


  