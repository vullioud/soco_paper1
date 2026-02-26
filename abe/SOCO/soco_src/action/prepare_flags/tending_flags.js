    
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

Action.prepare.tending = function(params, stand_data_obj, agent) {
    var speciesSelectivity = SpeciesStrategies.execute(stand_data_obj, agent, 'tending');

    // DIAGNOSTIC: Validate selectivity
    if (!speciesSelectivity || typeof speciesSelectivity !== 'object') {
        SoCoLog.warn(`[Action] Invalid speciesSelectivity for tending on stand ${stand_data_obj.stand_id}, using empty object`);
        speciesSelectivity = {};
    }

    // 3. Set Flag
    stand.setFlag('abe_param_speciesSelectivity', speciesSelectivity);

};

// ----- End of File: soco_src/action/prepare_flags/tending_flags.js -----

  