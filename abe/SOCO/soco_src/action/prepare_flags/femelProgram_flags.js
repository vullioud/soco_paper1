// ----- Start of File: soco_src/action/prepare_flags/femel_flags.js -----

/**
 * =================================================================================
 * FILE: femel_flags.js
 * =================================================================================
 * DESCRIPTION:
 * Prepares parameters for Femel (Gap) management.
 * - Sets initial gap size and growth width.
 * - Handles cleanup of spatial patch objects.
 * =================================================================================
 */

Action.prepare.femel = function(params, stand_data_obj) {

    // 1. Initial Size (Number of gaps / Radius factor)
    // Ensure minimum of 1 to prevent empty patches
    var initial_size = params.initial_size || 1;
    if (initial_size < 1) initial_size = 1;
    stand.setFlag('abe_param_femel_initial_size', initial_size);

    // 2. Growth Width (Rings to add)
    // Ensure minimum of 1 to prevent zero expansion
    var growth_width = params.growth_width || 1;
    if (growth_width < 1) growth_width = 1;
    stand.setFlag('abe_param_femel_growth_width', growth_width);

};

Action.prepare.clear_femel_flags = function() {
    // console.log(`[COGNITION] Stand ${stand.id}: Cleaning up Femel flags and patches.`);
    
    stand.setFlag('abe_femel_initialized', null);
    stand.setFlag('abe_femel_current_ring', null);
    
    // Clear spatial patches if they exist
    if (stand && stand.id > 0) {
        // We need to check if patches object is valid, though iLand usually handles this
        stand.patches.clear();
        stand.patches.updateGrid();
    }
};

// ----- End of File: soco_src/action/prepare_flags/femel_flags.js -----