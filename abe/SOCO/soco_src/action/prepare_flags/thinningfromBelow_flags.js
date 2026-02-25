    
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
        console.warn(`[Action] WARNING: Invalid thinningShare type for stand ${stand_data_obj.stand_id}: ${typeof share}, value=${share}. Using default 0.2`);
        share = 0.2;
    }

    // Safety clamp
    if (share < 0) share = 0;
    if (share > 1) share = 1;

    stand.setFlag('abe_param_thinningShare', share);

    // 2. Species Selectivity via Strategy (NEW LOGIC)
    var agent = socoabe.institution.all_agents.find(function(a) { return a.id === stand_data_obj.agent_id; });

    // Get strategy name (e.g., "economic")
    var strategyName = stand_data_obj.species_profile;

    // Execute Strategy for 'thinning'
    // Returns { "piab": 0.1, "rest": 1.0 } etc.
    var speciesSelectivity = SpeciesStrategies.execute(strategyName, stand_data_obj, agent, 'thinning');

    // DIAGNOSTIC: Validate selectivity
    if (!speciesSelectivity || typeof speciesSelectivity !== 'object') {
        console.warn(`[Action] WARNING: Invalid speciesSelectivity for stand ${stand_data_obj.stand_id}, using empty object (no selectivity)`);
        speciesSelectivity = {};
    }

    stand.setFlag('abe_param_speciesSelectivity', speciesSelectivity);

    console.log(`[Action] Prepared ThinningFromBelow for stand ${stand_data_obj.stand_id} (${strategyName}). Share=${(share * 100).toFixed(1)}%. Selectivity: ${JSON.stringify(speciesSelectivity)}`);

    // DIAGNOSTIC: Verify flags were set correctly
    var verifyShare = stand.flag('abe_param_thinningShare');
    var verifySelectivity = stand.flag('abe_param_speciesSelectivity');
    console.log(`[DEBUG] Flags verification - Share: ${verifyShare}, Selectivity: ${JSON.stringify(verifySelectivity)}`);
};


  