// ----- START OF CORRECTED FILE: load_all_files.js -----

/**
 * =================================================================================
 * FILE: load_all_files.js
 * =================================================================================
 * DESCRIPTION:
 * This script is responsible for loading all SoCoABE JavaScript files in the
 * correct dependency order.
 * =================================================================================
 */

try {
    Globals.include(Globals.path('./abe/SOCO/soco_src/integration/namespaces.js'));
    // --- 1. Load Core Dependencies & Configuration ---
    Globals.include(Globals.path('./abe/abe-lib/ABE-library.js'));
    Globals.include(Globals.path('./abe/SOCO/config/socoabe_config.js'));
    Globals.include(Globals.path('./abe/SOCO/config/mega_STP.js'));

    // --- Load Tests for mega_STP ---
    // Globals.include(Globals.path('./abe/SOCO/tests/DIAGNOSTIC_test_loading.js')); // File does not exist
   // Globals.include(Globals.path('./abe/SOCO/tests/test_targetDBH_fallback.js'));

    // --- 2. Load Utilities ---
    // These have no dependencies on other SoCoABE modules.
    Globals.include(Globals.path('./abe/SOCO/soco_src/utils/soco_log.js'));  // Load logging utility first
    Globals.include(Globals.path('./abe/SOCO/soco_src/utils/distributions.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/utils/helpers.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/test_network_inspector.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/test_activity_history.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/console_network_tests.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/diagnose_monitoring.js'));
    // Globals.include(Globals.path('./abe/SOCO/soco_src/test/diagnose_agent_disappearance.js')); // File removed
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/trace_debug.js'));
  
    // --- 3. Load Core Cognitive Modules (in correct order) ---

    // Load Perception Module
    Globals.include(Globals.path('./abe/SOCO/soco_src/perception/observe.js')); // Creates the global 'Perception' object
    Globals.include(Globals.path('./abe/SOCO/soco_src/perception/get_iLand_data.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/perception/get_soco_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/perception/compute_derived_data.js'));
    //Globals.include(Globals.path('./abe/SOCO/soco_src/perception/aggregate_unit.js'));
    // Load Cognition Module
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/think.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/species/species_group.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/species/species_strategies.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/create_new_plan.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/select_activity.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/select_parameters.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/compute_schedule.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/decide_on_going.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/validate_activity.js'));
   // Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/ten_year_planner.js'));

    // Load Fixed STP Module (must be before cognition uses it)
    Globals.include(Globals.path('./abe/SOCO/soco_src/fixed_stp/fixed_stp.js'));

    // Load Action Module
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/act.js')); // Creates the global 'Action' object
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/clear_flags.js'));

    // Include all your 'prepare_flags' files here. They all depend on 'act.js'.
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/harvestclearcut_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/harvesttargetDBH_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/plenter_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/selectiveThinning_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/thinningfromBelow_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/tending_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/harvestshelterwood_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/planting_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/femelProgram_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/prepare_flags/salvage_flags.js'));


    // --- 4. Load Core Agent Classes ---
    // These classes may depend on the modules loaded above.
    Globals.include(Globals.path('./abe/SOCO/soco_src/utils/monitoring.js'));
   // Globals.include(Globals.path('./abe/SOCO/soco_src/utils/monitoring2.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/core/stand_data.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/core/network.js'));

    Globals.include(Globals.path('./abe/SOCO/soco_src/core/socoabe_agent.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/core/owner.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/core/institution.js'));
    
    // --- 5. Load Main Controller & Test Harness ---
    // These should be loaded last as they depend on everything else.
    Globals.include(Globals.path('./abe/SOCO/soco_src/integration/SOCO_main.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/test_runner.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/test_scenarii.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/test_harvest_volume_tracking.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/soco_inspector.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/test/test_salvage.js'));

    console.log("--- All required SoCoABE scripts loaded successfully in the correct order. ---");

} catch (e) {
    // This will catch any errors if a file path is wrong.
    console.error("CRITICAL ERROR during script loading in load_all_files.js: " + e.message);
    fmengine.abort("Failed to load a required script file.");
}
