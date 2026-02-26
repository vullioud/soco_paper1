// ----- Start of File: soco_src/action/prepare_flags/harvestshelterwood_flags.js -----

/**
 * =================================================================================
 * FILE: harvestshelterwood_flags.js
 * =================================================================================
 * DESCRIPTION:
 * Prepares parameters for Shelterwood sequence.
 * - Sets N seed trees and competitors.
 * - Calculates removal fraction for the gradual opening of the canopy.
 * - Sets species selectivity to favor specific seed trees.
 * =================================================================================
 */

Action.prepare.shelterwood = function(params, stand_data_obj, agent) {
    
    // 1. Numerical Parameters
    stand.setFlag('abe_param_nTrees', params.nTrees || 40); 
    stand.setFlag('abe_param_nCompetitors', params.nCompetitors || 1000); // High number to mark all non-seed trees
    
    // 2. Dynamic Removal Fraction
    // Logic: If we have 3 steps (Select, Remove, Final), we want to remove competitors gradually.
    // 'sequence_total_steps' includes Select(0), Remove(1), Final(2).
    var current_step = stand_data_obj.activity.sequence_current_step;
    var total_steps = stand_data_obj.activity.sequence_total_steps;
    
    // Final step is clearcut. Steps before that are removals.
    // Steps remaining *before* final harvest:
    var final_step_index = total_steps - 1;
    var removal_events_remaining = final_step_index - current_step;

    var fraction = 1.0; 
    if (removal_events_remaining > 0) {
        // e.g. 2 removal events left -> take 50% now.
        fraction = 1.0 / removal_events_remaining;
    }
    
    // Safety clamp
    if (fraction > 1.0) fraction = 1.0;
    if (fraction < 0.0) fraction = 0.0;
    
    stand.setFlag('abe_param_fraction_to_remove', fraction);

    // 3. Species Selectivity via Strategy
    var speciesSelectivity = SpeciesStrategies.execute(stand_data_obj, agent, 'shelterwood');
    
    stand.setFlag('abe_param_speciesSelectivity', speciesSelectivity);
    
};

Action.prepare.clear_shelterwood_flags = function() {
    var stand_id = -1;
    if (stand && stand.id > 0) stand_id = stand.id;

    stand.setFlag('abe_shelterwood_initialized', null);
    stand.setFlag('abe_param_totalCompetitors', null);
    
    if (stand && stand.id > 0) {
        stand.trees.loadAll();
        stand.trees.resetMarks(); 
    }
};
