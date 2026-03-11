    
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

    // Species Selectivity: WET dynamic mode reads pre-computed selectivity from think.js.
    // Static mode (or fallback) uses the condition-based THINNING_WEIGHTS table.
    var speciesSelectivity;
    if (SoCoABE_CONFIG.SPECIES_SELECTIVITY_MODE === 'wet_dynamic') {
        speciesSelectivity = stand.flag('speciesSelectivity');
    }
    if (!speciesSelectivity || typeof speciesSelectivity !== 'object' || Object.keys(speciesSelectivity).length === 0) {
        speciesSelectivity = SpeciesStrategies.execute(stand_data_obj, agent, 'tending');
    }

    // DIAGNOSTIC: Validate selectivity
    if (!speciesSelectivity || typeof speciesSelectivity !== 'object') {
        SoCoLog.warn(`[Action] Invalid speciesSelectivity for tending on stand ${stand_data_obj.stand_id}, using empty object`);
        speciesSelectivity = {};
    }

    stand.setFlag('abe_param_speciesSelectivity', speciesSelectivity);

};

// ----- End of File: soco_src/action/prepare_flags/tending_flags.js -----

  