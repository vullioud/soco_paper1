// FILE: soco_src/cognition/decision_windows.js
// Phase-based stand lifecycle. Age → phase → activity.

Cognition.get_phase = function(age) {
    var P = SoCoABE_CONFIG.PHASES;
    if (age >= P.Harvesting.start) return "Harvesting";
    if (age >= P.Thinning.start)   return "Thinning";
    if (age >= P.Tending.start)    return "Tending";
    return "Planting";
};

// Alias for backward compat (used by monitoring)
Cognition.get_decision_window = Cognition.get_phase;

Cognition.can_start_new_activity = function(age, phase) {
    var P = SoCoABE_CONFIG.PHASES;
    var phase_config = P[phase];
    if (!phase_config) return true;
    return age <= phase_config.start_by;
};

/**
 * Structural phase classifier — uses topHeight + DBH + volume, no age.
 * MONITORING ONLY. Does not drive any decisions in Paper 1.
 *
 * Logic (what a forester sees walking into the stand):
 *   1. "Nothing here"          → Planting   (low volume + low topHeight)
 *   2. "Dense thicket"         → Tending    (stems > threshold, purely density-driven)
 *   3. "Growing stock"         → Thinning   (topHeight ≥ 12m, dbh < 35cm)
 *   4. "Mature timber"         → Harvesting (dbh ≥ 35cm)
 */
Cognition.get_structural_phase = function(stand_data_obj) {
    var d = stand_data_obj.iLand_stand_data;

    // Use the same threshold resolution as the real classifier:
    // default thresholds merged with species-specific overrides.
    var T = Cognition.StructuralPhase._get_thresholds(stand_data_obj);

    if (!T) return "unknown";

    // 1. Bare / post-disturbance / failed regen
    if (d.volume < T.planting_max_volume) {
        return "Planting";
    }

    // 2. Dense stand — needs tending (Stammzahlreduktion, density-driven)
    var tending_stems = T.tending_stem_threshold || 1250;
    if (d.stems > tending_stems) {
        return "Tending";
    }

    // 3. Mature — dual gate (DBH target OR top-height risk urgency)
    if (d.mean_dbh >= T.harvest_min_dbh) {
        return "Harvesting";
    }
    if (T.harvest_entry_top_height && d.top_height >= T.harvest_entry_top_height) {
        return "Harvesting";
    }

    // 4. Not yet mature — thinnable growing stock
    return "Thinning";
};
