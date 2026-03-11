/**
 * =================================================================================
 * FILE: build_schedule.js
 * =================================================================================
 * DESCRIPTION:
 * Constructs timeline and sequence metadata from activity parameters.
 * Called after select_parameters() in plan_decade.
 * Simplified from old compute_schedule.js — uses calendar years directly.
 * =================================================================================
 */

Cognition.build_schedule = function(stand_data_obj, plan_year) {
    var activity = stand_data_obj.activity;
    var params = activity.parameters;

    // Resolve compound name for switch routing.
    // chosen_Activity keeps the full compound name (e.g. 'shelterwood_planting').
    // base_activity is used only for switch dispatch.
    var includes_planting = activity.chosen_Activity.indexOf('_planting') > -1
                         && activity.chosen_Activity.indexOf('_no_planting') === -1;
    var base_activity = activity.chosen_Activity
        .replace('_planting', '').replace('_no_planting', '');

    // If target_year not set, auto-assign from plan_year
    if ((!activity.target_year || activity.target_year <= 0) && plan_year) {
        var sched_phase = Cognition.Phases.classify(stand_data_obj);
        if (sched_phase === "Harvesting") {
            activity.target_year = plan_year + 2 + Math.floor(Math.random() * 8);
        } else {
            activity.target_year = plan_year + 1 + Math.floor(Math.random() * 3);
        }
    }

    var base_year = activity.target_year;

    // Default: single-shot, no sequence
    activity.is_Sequence = false;
    activity.timeline = [];
    activity.sequence_total_steps = 0;
    activity.sequence_current_step = 0;

    if (activity.chosen_Activity === 'noManagement' || base_year === -1) {
        return stand_data_obj;
    }

    var times = Number(params.times) || 1;
    var interval = Number(params.interval) || 5;

    // Minimum step enforcement (from old model)
    var MIN_STEPS_SHELTERWOOD = 3;  // select + remove(s) + final
    var MIN_STEPS_FEMEL = 3;        // select + step(s) + final
    var MIN_STEPS_THINNING = 2;     // select + remove(s)

    switch (base_activity) {

        case 'clearcut':
            activity.timeline = [base_year];
            activity.sequence_total_steps = 1;
            activity.is_Sequence = false;
            break;

        case 'planting':
            activity.timeline = [base_year];
            activity.sequence_total_steps = 1;
            activity.is_Sequence = false;
            break;

        case 'shelterwood':
            if (times < MIN_STEPS_SHELTERWOOD) times = MIN_STEPS_SHELTERWOOD;
            if (interval < 1) interval = 5;
            activity.is_Sequence = true;
            activity.sequence_total_steps = times;
            activity.timeline = [];
            for (var i = 0; i < times; i++) {
                activity.timeline.push(base_year + (i * interval));
            }
            break;

        case 'femel':
            if (times < MIN_STEPS_FEMEL) times = MIN_STEPS_FEMEL;
            if (interval < 1) interval = 10;
            activity.is_Sequence = true;
            activity.sequence_total_steps = times;
            activity.timeline = [];
            for (var i = 0; i < times; i++) {
                activity.timeline.push(base_year + (i * interval));
            }
            break;

        case 'selectiveThinning':
            if (times < MIN_STEPS_THINNING) times = MIN_STEPS_THINNING;
            // fall through
        case 'fromBelow':
        case 'thinningFromBelow':
        case 'tending':
            if (times < MIN_STEPS_THINNING) times = MIN_STEPS_THINNING;
            if (times > 1 && interval > 0) {
                activity.is_Sequence = true;
                activity.sequence_total_steps = times;
                activity.timeline = [];
                for (var i = 0; i < times; i++) {
                    activity.timeline.push(base_year + (i * interval));
                }
            } else {
                activity.timeline = [base_year];
                activity.sequence_total_steps = 1;
                activity.is_Sequence = false;
            }
            break;

        case 'targetDBH':
        case 'plenter_harvest':
        case 'plenter_thinning':
            if (interval > 0) {
                var repeats = 20;  // continuous management
                activity.is_Sequence = true;
                activity.sequence_total_steps = repeats;
                activity.timeline = [];
                for (var i = 0; i < repeats; i++) {
                    activity.timeline.push(base_year + (i * interval));
                }
            } else {
                activity.timeline = [base_year];
                activity.sequence_total_steps = 1;
                activity.is_Sequence = false;
            }
            break;

        default:
            // Unknown activity — single-shot
            activity.timeline = [base_year];
            activity.sequence_total_steps = 1;
            activity.is_Sequence = false;
            break;
    }

    // --- Append planting step for _planting harvest variants ---
    // Planting is a real sequence step: it lives in the timeline, has its own cost,
    // and the existing sequence machinery guarantees execution.
    if (includes_planting && activity.timeline.length > 0) {
        var PLANTING_GAP_YEARS = 2;  // plant 2 years after final harvest
        var last_harvest_year = activity.timeline[activity.timeline.length - 1];
        activity.timeline.push(last_harvest_year + PLANTING_GAP_YEARS);
        activity.sequence_total_steps += 1;
        activity.is_Sequence = true;  // clearcut becomes a sequence now
    }

    // Set first step
    activity.sequence_current_step = 0;
    activity.target_year = activity.timeline[0];

    // Write corrected times back to params (so prepare_flags sees correct value)
    if (times !== Number(params.times)) {
        activity.parameters.times = times;
    }

    return stand_data_obj;
};
