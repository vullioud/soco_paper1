// FILE: soco_src/cognition/phase_structural.js
// Structural phase engine with hysteresis.
// Activated by SoCoABE_CONFIG.PHASE_ENGINE === "structural"
//
// Forward transitions: topHeight and DBH grow → easy to advance.
// Backward transitions: only real structural collapse (disturbance)
//   crosses regression thresholds. Normal mortality noise is absorbed.
//
// Hysteresis uses last_completed_phase as anchor. If no anchor, forward only.

Cognition.StructuralPhase = {};

/**
 * Get merged thresholds: default + species-specific overrides.
 * @private
 */
Cognition.StructuralPhase._get_thresholds = function(stand_data_obj) {
    var T = {};
    var defaults = SoCoABE_CONFIG.PHASE_THRESHOLDS["default"];
    if (!defaults) return { planting_max_volume: 10, tending_stem_threshold: 1250,
                            harvest_min_dbh: 35, regression_thinning_dbh: 25 };

    // Copy defaults
    for (var k in defaults) {
        if (defaults.hasOwnProperty(k)) T[k] = defaults[k];
    }

    // Species override
    var dom = stand_data_obj.classified.dominant_species;
    if (dom && dom.length > 0) {
        var sp_overrides = SoCoABE_CONFIG.PHASE_THRESHOLDS[dom[0].id];
        if (sp_overrides) {
            for (var k2 in sp_overrides) {
                if (sp_overrides.hasOwnProperty(k2) && k2 !== '_comment') {
                    T[k2] = sp_overrides[k2];
                }
            }
        }
    }

    return T;
};

/**
 * Classify stand by structure with directional hysteresis.
 *
 * Forward classification (what the metrics say):
 *   vol < planting_max       → Planting
 *   stems > threshold → Tending (purely density-driven, no dbh gate)
 *   dbh >= harvest_min       → Harvesting
 *   topH >= harvest_entry    → Harvesting
 *   else                     → Thinning
 *
 * Regression check (only if forward < anchor):
 *   Stricter thresholds prevent noise-driven phase oscillation.
 *   Real disturbance (topH drops from 25 to 6) crosses regression.
 *   Minor mortality (topH drops from 12.1 to 11.8) does not.
 */
Cognition.StructuralPhase.classify = function(stand_data_obj) {
    var d = stand_data_obj.iLand_stand_data;
    var T = Cognition.StructuralPhase._get_thresholds(stand_data_obj);

    // --- Forward classification ---
    // Tending = density-driven: many small trees needing schematic stem reduction.
    // Thinning = size-driven: trees differentiated enough for crop tree selection.
    // Exit from Tending: stems drop below threshold (density resolved).
    var forward;
    var tending_stems = T.tending_stem_threshold || 1250;

    if (d.volume < T.planting_max_volume) {
        forward = "Planting";
    } else if (d.stems > tending_stems) {
        // Dense stand: high stem density, needs tending (Stammzahlreduktion)
        // Purely density-driven — no dbh gate. Exit when stems drop below threshold.
        forward = "Tending";
    } else if (d.mean_dbh >= T.harvest_min_dbh) {
        forward = "Harvesting";
    } else if (T.harvest_entry_top_height && d.top_height >= T.harvest_entry_top_height) {
        forward = "Harvesting";
    } else {
        forward = "Thinning";
    }

    // --- Hysteresis: compare to anchor ---
    var anchor = stand_data_obj.activity.last_completed_phase;
    if (!anchor || anchor === 'none') return forward;

    var rank = { Planting: 0, Tending: 1, Thinning: 2, Harvesting: 3 };
    var forward_rank = rank[forward];
    var anchor_rank = rank[anchor];

    // Moving forward or staying → always accept
    if (forward_rank === undefined || anchor_rank === undefined) return forward;
    if (forward_rank >= anchor_rank) return forward;

    // --- Backward check — regression thresholds ---
    // Planting regression: always detect bare ground (no hysteresis needed)
    if (d.volume < T.planting_max_volume) {
        return "Planting";
    }

    // Tending regression: dense regeneration after disturbance
    var reg_stems = T.regression_tending_stems || T.tending_stem_threshold || 1800;
    if (d.stems > reg_stems) {
        return "Tending";
    }

    // Thinning regression: severe diameter loss (only from Harvesting anchor)
    if (anchor === "Harvesting" && d.mean_dbh < (T.regression_thinning_dbh || 25)) {
        return "Thinning";
    }

    // Regression thresholds NOT crossed — hold at anchor (noise, not collapse)
    return anchor;
};

/**
 * Check if a blocked stand should be unblocked.
 * Called by plan_decade for blocked stands.
 *
 * Unblock if:
 *   (a) classify() now returns the target phase (structural transition achieved), OR
 *   (b) force-forward timeout exceeded (safety net — never fires during normal management).
 *
 * Returns true if stand was unblocked, false if still blocked.
 */
Cognition.StructuralPhase.check_unblock = function(stand_data_obj) {
    var blocked = stand_data_obj.activity.blocked_until_phase;
    if (!blocked) return true;  // not blocked — available

    // (a) Structural transition achieved?
    var current_phase = Cognition.StructuralPhase.classify(stand_data_obj);
    if (current_phase === blocked) {
        // Target phase reached — unblock
        stand_data_obj.activity.blocked_until_phase = null;
        stand_data_obj.activity.blocked_since_year = -1;
        return true;
    }

    // (b) Force-forward timeout?
    var T = Cognition.StructuralPhase._get_thresholds(stand_data_obj);
    var timeout_key = "force_forward_" + blocked.toLowerCase();
    var timeout = T[timeout_key] || 70;  // fallback: 70 years
    var blocked_since = stand_data_obj.activity.blocked_since_year;

    if (blocked_since > 0 && (Globals.year - blocked_since) >= timeout) {
        // Safety net: force unblock
        stand_data_obj.activity.blocked_until_phase = null;
        stand_data_obj.activity.blocked_since_year = -1;
        return true;
    }

    return false;  // still blocked
};

/**
 * Can a new activity start? Structural engine: always yes.
 * Structure IS the gate — no age cutoffs.
 */
Cognition.StructuralPhase.can_start = function(stand_data_obj, phase) {
    return true;
};

/**
 * Sort harvest candidates: DBH descending + carryover bonus.
 * Trees closest to/past target dimension get harvested first.
 */
Cognition.StructuralPhase.sort_harvest = function(candidates) {
    candidates.sort(function(a, b) {
        var a_s = a.iLand_stand_data.mean_dbh + (a.activity.carryover_count || 0) * 50;
        var b_s = b.iLand_stand_data.mean_dbh + (b.activity.carryover_count || 0) * 50;
        return b_s - a_s;
    });
};

/**
 * Priority bonus aligned with classification metrics.
 * Harvesting: DBH (target dimension). Thinning: BA (density).
 * Tending: topH (tallest thicket = most competitive). Planting: inverse volume.
 */
Cognition.StructuralPhase.priority_bonus = function(stand_data_obj, phase) {
    var d = stand_data_obj.iLand_stand_data;
    if (phase === "Harvesting") return d.mean_dbh * 0.5;
    if (phase === "Thinning")   return d.basal_area * 0.5;
    if (phase === "Tending")    return d.stems * 0.01;
    if (phase === "Planting")   return Math.max(0, (10 - d.volume)) * 2.0;
    return 0;
};

