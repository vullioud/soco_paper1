// =================================================================================
// FILE: soco_src/action/prepare_flags/salvage_flags.js
// =================================================================================
// DESCRIPTION:
// Prepares parameters for salvage operations after disturbance.
// Sets flags based on agent preference to determine salvage response type.
// =================================================================================

/**
 * Prepare salvage activity parameters based on agent preferences
 * @param {Object} params - Parameters from select_parameters
 * @param {Object} stand_data_obj - Stand data object with disturbance info
 */
Action.prepare.salvage = function(params, stand_data_obj) {
    var preference = stand_data_obj.preference_focus || 'Production';
    var severity = stand_data_obj.iLand_stand_data.disturbance_severity || 0;
    var severity_m3ha = stand.flag('abe_disturbance_severity_m3ha') || 0;

    console.log(`[Action] Preparing Salvage for stand ${stand.id}. Preference: ${preference}, Severity: ${(severity * 100).toFixed(1)}%`);

    // Determine salvage response based on preference and severity
    var salvage_type = 'salvage_harvest';  // Default
    var salvage_fraction = 1.0;
    var min_dbh = 10;
    var trigger_replant = false;

    // Severity thresholds
    var SEVERE_THRESHOLD = 0.6;    // >60% loss = severe
    var MODERATE_THRESHOLD = 0.3;  // >30% loss = moderate

    switch (preference) {
        case 'Production':
            // Production: Maximize salvage value, clearcut if severe
            if (severity >= SEVERE_THRESHOLD) {
                salvage_type = 'salvage_clearcut';
                trigger_replant = true;
            } else {
                salvage_type = 'salvage_harvest';
                salvage_fraction = 1.0;  // Salvage everything merchantable
                min_dbh = 7;  // Lower threshold for more recovery
            }
            break;

        case 'CO2':
            // CO2: Balance salvage with carbon storage in deadwood
            if (severity >= SEVERE_THRESHOLD) {
                salvage_type = 'salvage_clearcut';
                trigger_replant = true;
            } else if (severity >= MODERATE_THRESHOLD) {
                salvage_type = 'salvage_harvest';
                salvage_fraction = 0.7;  // Leave 30% as deadwood/carbon store
                min_dbh = 15;
            } else {
                // Minor disturbance - leave for natural carbon cycling
                salvage_type = 'salvage_leave';
            }
            break;

        case 'Biodiversity':
            // Biodiversity: Prioritize habitat, minimize intervention
            if (severity >= SEVERE_THRESHOLD + 0.2) {  // Higher threshold (80%)
                salvage_type = 'salvage_harvest';
                salvage_fraction = 0.5;  // Leave half as habitat
                min_dbh = 20;  // Only large merchantable trees
            } else {
                // Leave for natural processes - deadwood is valuable habitat
                salvage_type = 'salvage_leave';
            }
            break;

        default:
            // Unknown preference - default to moderate salvage
            salvage_type = 'salvage_harvest';
            salvage_fraction = 0.8;
            min_dbh = 10;
    }

    // Set flags for the salvage execution activity
    stand.setFlag('abe_param_salvage_type', salvage_type);
    stand.setFlag('abe_param_salvage_fraction', salvage_fraction);
    stand.setFlag('abe_param_salvage_min_dbh', min_dbh);
    stand.setFlag('abe_param_salvage_trigger_replant', trigger_replant);

    // Store the decision in stand_data for tracking
    stand_data_obj.iLand_stand_data.salvage_response = salvage_type;

    console.log(`  -> Salvage type: ${salvage_type}, Fraction: ${salvage_fraction}, Min DBH: ${min_dbh}`);

    return salvage_type;
};

/**
 * Clear salvage-related flags after operation completes
 */
Action.prepare.clear_salvage_flags = function() {
    stand.setFlag('abe_need_salvage', false);
    stand.setFlag('abe_param_salvage_type', null);
    stand.setFlag('abe_param_salvage_fraction', null);
    stand.setFlag('abe_param_salvage_min_dbh', null);
    stand.setFlag('abe_param_salvage_trigger_replant', null);

    // Note: We keep disturbance history flags for learning/tracking
    // abe_disturbance_year, abe_disturbance_volume, abe_disturbance_severity
    // These are valuable historical data
};
