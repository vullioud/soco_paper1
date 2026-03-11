// FILE: soco_src/cognition/phase_age.js
// Age-based phase engine. Extracted from decision_windows.js.
// Activated by SoCoABE_CONFIG.PHASE_ENGINE === "age"

Cognition.AgePhase = {};

/**
 * Classify stand into lifecycle phase by absolute age.
 */
Cognition.AgePhase.classify = function(stand_data_obj) {
    var age = stand_data_obj.iLand_stand_data.absolute_age_iLand;
    var P = SoCoABE_CONFIG.PHASES;
    if (age >= P.Harvesting.start) return "Harvesting";
    if (age >= P.Thinning.start)   return "Thinning";
    if (age >= P.Tending.start)    return "Tending";
    return "Planting";
};

/**
 * Can a new activity start in this phase?
 * Age-based: check against start_by cutoff.
 */
Cognition.AgePhase.can_start = function(stand_data_obj, phase) {
    var age = stand_data_obj.iLand_stand_data.absolute_age_iLand;
    var P = SoCoABE_CONFIG.PHASES;
    var pc = P[phase];
    if (!pc || !pc.start_by) return true;
    return age <= pc.start_by;
};

/**
 * Sort harvest candidates: volume descending + carryover bonus.
 */
Cognition.AgePhase.sort_harvest = function(candidates) {
    candidates.sort(function(a, b) {
        var a_s = a.iLand_stand_data.volume + (a.activity.carryover_count || 0) * 100;
        var b_s = b.iLand_stand_data.volume + (b.activity.carryover_count || 0) * 100;
        return b_s - a_s;
    });
};

/**
 * Priority bonus for within-phase work pile ordering.
 */
Cognition.AgePhase.priority_bonus = function(stand_data_obj, phase) {
    if (phase === "Harvesting") return stand_data_obj.iLand_stand_data.volume * 0.1;
    if (phase === "Thinning")   return stand_data_obj.iLand_stand_data.basal_area * 0.5;
    return 0;
};
