// ----- START OF FILE: load_all_files.js -----

/**
 * =================================================================================
 * FILE: load_all_files.js
 * =================================================================================
 * DESCRIPTION:
 * This script is responsible for loading all SoCoABE JavaScript files in the
 * correct dependency order.
 * Paper 1 version: Removed test harness, FixedSTP, and NetworkModule.
 * =================================================================================
 */

try {
    Globals.include(Globals.path('./abe/SOCO/soco_src/integration/namespaces.js'));
    // --- 1. Load Core Dependencies & Configuration ---
    Globals.include(Globals.path('./abe/abe-lib/ABE-library.js'));
    Globals.include(Globals.path('./abe/SOCO/config/socoabe_config.js'));
    Globals.include(Globals.path('./abe/SOCO/config/mega_STP.js'));

    // --- 2. Load Utilities ---
    Globals.include(Globals.path('./abe/SOCO/soco_src/utils/soco_log.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/utils/distributions.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/utils/helpers.js'));

    // --- 3. Load Core Cognitive Modules (in correct order) ---

    // Load Perception Module
    Globals.include(Globals.path('./abe/SOCO/soco_src/perception/observe.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/perception/get_iLand_data.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/perception/get_soco_flags.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/perception/compute_derived_data.js'));

    // Load Cognition Module
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/decision_windows.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/think.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/species/species_group.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/species/condition_classifier.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/species/species_strategies.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/select_activity.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/select_parameters.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/plan_decade.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/decide_on_going.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/cognition/validate_activity.js'));

    // Load Action Module
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/act.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/action/clear_flags.js'));

    // Include all prepare_flags files
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
    Globals.include(Globals.path('./abe/SOCO/soco_src/utils/monitoring.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/core/stand_data.js'));

    Globals.include(Globals.path('./abe/SOCO/soco_src/core/socoabe_agent.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/core/owner.js'));
    Globals.include(Globals.path('./abe/SOCO/soco_src/core/institution.js'));

    // --- 5. Load Main Controller ---
    Globals.include(Globals.path('./abe/SOCO/soco_src/integration/SOCO_main.js'));


} catch (e) {
    console.error("CRITICAL ERROR during script loading in load_all_files.js: " + e.message);
    fmengine.abort("Failed to load a required script file.");
}
