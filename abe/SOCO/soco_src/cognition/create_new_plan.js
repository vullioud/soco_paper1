/**
 * =================================================================================
 * FILE: [New, to be placed in cognition folder, e.g., create_new_plan.js]
 * =================================================================================
 * DESCRIPTION:
 * This function encapsulates the complete pipeline for generating a brand new
 * management plan for a stand from scratch.
 * =================================================================================
 */
Cognition.create_new_plan = function(stand_data_obj, agent) {
    // console.log(`[COGNITION] Stand ${stand_data_obj.stand_id}: Creating a new plan.`);

    // The three core steps of new plan creation.
    stand_data_obj = Cognition.select_activity(stand_data_obj, agent);
    stand_data_obj = Cognition.select_parameters(stand_data_obj, agent);
    stand_data_obj = Cognition.compute_schedule(stand_data_obj);

    return stand_data_obj;
};