// FILE: soco_src/cognition/phase_dispatch.js
// Dispatcher: routes Cognition.Phases.* calls to the active phase engine.
// Selected by SoCoABE_CONFIG.PHASE_ENGINE: "age" or "structural"
//
// CONTRACT:
//   Both Cognition.AgePhase and Cognition.StructuralPhase must implement:
//     classify(stand_data_obj) → string
//     can_start(stand_data_obj, phase) → boolean
//     sort_harvest(candidates) → void (sorts in-place)
//     priority_bonus(stand_data_obj, phase) → number
//   Cognition.StructuralPhase must also implement:
//     check_unblock(stand_data_obj) → boolean

Cognition.Phases = {};

Cognition.Phases._engine = function() {
    if (SoCoABE_CONFIG.PHASE_ENGINE === "structural") {
        return Cognition.StructuralPhase;
    }
    return Cognition.AgePhase;
};

Cognition.Phases.classify = function(stand_data_obj) {
    return Cognition.Phases._engine().classify(stand_data_obj);
};

Cognition.Phases.can_start = function(stand_data_obj, phase) {
    return Cognition.Phases._engine().can_start(stand_data_obj, phase);
};

Cognition.Phases.sort_harvest = function(candidates) {
    Cognition.Phases._engine().sort_harvest(candidates);
};

Cognition.Phases.priority_bonus = function(stand_data_obj, phase) {
    return Cognition.Phases._engine().priority_bonus(stand_data_obj, phase);
};

Cognition.Phases.check_unblock = function(stand_data_obj) {
    if (SoCoABE_CONFIG.PHASE_ENGINE === "structural") {
        return Cognition.StructuralPhase.check_unblock(stand_data_obj);
    }
    // Age engine: check if age has crossed into target phase
    var target = stand_data_obj.activity.blocked_until_phase;
    if (!target) return true;
    var current = Cognition.Phases.classify(stand_data_obj);
    if (current === target) {
        stand_data_obj.activity.blocked_until_phase = null;
        stand_data_obj.activity.blocked_since_year = -1;
        return true;
    }
    // Age engine force-forward: use fixed 150yr timeout
    var blocked_since = stand_data_obj.activity.blocked_since_year;
    if (blocked_since > 0 && (Globals.year - blocked_since) >= 150) {
        stand_data_obj.activity.blocked_until_phase = null;
        stand_data_obj.activity.blocked_since_year = -1;
        return true;
    }
    return false;
};
