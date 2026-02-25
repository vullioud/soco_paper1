Perception.observe_stand = function(stand_data_obj, agent) { // Changed to accept 'agent'
    try {
        stand_data_obj = Perception.get_iLand_data(stand_data_obj);  // first get raw data from iLand
        stand_data_obj = Perception.get_reassessment_flags(stand_data_obj); // check for reassessment only 
        stand_data_obj = Perception.update_history(stand_data_obj); // get the history flag from the socoabe act
        stand_data_obj = Perception.compute_derived_data(stand_data_obj, agent); // compute data

    } catch (e) {
        console.error(`    [OBSERVE-ERROR] A critical error occurred for stand ${stand_data_obj.stand_id}: ${e.message}`);
        console.error(`    Stack Trace: ${e.stack}`);
    }
    
   // console.log(`  [OBSERVE] Pipeline finished for stand ${stand_data_obj.stand_id}.`);
    return stand_data_obj;
};

