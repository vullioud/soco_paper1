// ----- Start of File: soco_src/action/prepare_flags/selectiveThinning_flags.js -----

/**
 * =================================================================================
 * FILE: selectiveThinning_flags.js
 * =================================================================================
 * DESCRIPTION:
 * Prepares parameters for Selective Thinning.
 * - Sets crop tree count and competitor count.
 * - Calculates removal fraction for sequences.
 * - Generates species selectivity using the active SpeciesStrategy.
 * =================================================================================
 */

Action.prepare.selectiveThinning = function(params, stand_data_obj) {
    
    // 1. Numerical Parameters
    stand.setFlag('abe_param_nTrees', params.nTrees || 80);
    stand.setFlag('abe_param_nCompetitors', params.nCompetitors || 2);
    
    // 2. Fraction to remove calculation (for multi-step sequences)
    var current_step = stand_data_obj.activity.sequence_current_step;
    var total_steps = stand_data_obj.activity.sequence_total_steps;
    var steps_remaining = total_steps - current_step;
    
    if (steps_remaining > 0) {
        // Example: 3 steps total.
        // Step 0: Rem=3. Fraction=1/3.
        // Step 1: Rem=2. Fraction=1/2.
        // Step 2: Rem=1. Fraction=1/1.
        var fraction_to_remove = 1 / steps_remaining;
        stand.setFlag('abe_param_fraction_to_remove', fraction_to_remove);
    } else {
        // Fallback for single step
        stand.setFlag('abe_param_fraction_to_remove', 1.0);
    }

    // 3. Species Selectivity via Strategy
    var agent = socoabe.institution.all_agents.find(function(a) { return a.id === stand_data_obj.agent_id; });
    var speciesSelectivity = SpeciesStrategies.execute(stand_data_obj, agent, 'thinning');
    
    stand.setFlag('abe_param_speciesSelectivity', speciesSelectivity);
    
};

Action.prepare.clear_selectiveThinning_flags = function() {
    
    var stand_id = -1;
    if (stand && stand.id > 0) stand_id = stand.id;
    
    // console.log(`[COGNITION] Stand ${stand_id}: Cleaning up selective thinning flags.`);
    
    stand.setFlag('abe_selective_thinning_initialized', null);
    stand.setFlag('abe_param_totalCompetitors', null);
    
    if (stand && stand.id > 0) {
        stand.trees.loadAll(); 
        stand.trees.resetMarks(); 
        // console.log(`[COGNITION] -> Cleared all crop/competitor marks.`);
    }
};