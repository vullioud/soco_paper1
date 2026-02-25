// ----- Start of File: soco_src/cognition/compute_schedule.js -----

/**
 * =================================================================================
 * FILE: compute_schedule.js (Femel Fix)
 * =================================================================================
 */

// --- HELPER FUNCTIONS ---

function get_relevant_age(stand_data_obj) {
    var activity_name = stand_data_obj.activity.chosen_Activity;
    // Added 'femel' to rotation based activities
    var rotation_based_activities = ['clearcut', 'shelterwood', 'selectiveThinning', 'fromBelow', "planting", "femel"];

    if (rotation_based_activities.indexOf(activity_name) > -1) {
        return stand_data_obj.iLand_stand_data.absolute_age_soco; 
    } else {
        return stand_data_obj.iLand_stand_data.stand_age;
    }
}

function generate_timeline(activity_name, params) {
    var start_age = Math.round(Number(params.execution_schedule));
    // FIX: Handle NaN/undefined - default to 0 so minimum enforcement triggers
    var times = Number(params.times);
    if (isNaN(times) || times === null || times === undefined) {
        times = 0;
    }
    var interval = Number(params.interval);
    if (isNaN(interval) || interval === null || interval === undefined) {
        interval = 0;
    }

    var timeline = [];
    var is_Sequence = false;
    var sequence_total_steps = 0;
    var corrected_params = {};  // Track corrected parameter values

    // Define minimum steps for multi-phase activities
    // shelterwood/femel need: select(0) + at least 1 removal/step(1) + final(2) = minimum 3
    var MIN_STEPS_SHELTERWOOD = 3;
    var MIN_STEPS_FEMEL = 3;
    var MIN_STEPS_THINNING = 2; // selectiveThinning, fromBelow, tending

    switch (activity_name) {
        case 'clearcut':
        case 'planting':
            timeline.push(start_age);
            sequence_total_steps = 1;
            is_Sequence = false;
            break;

        case 'shelterwood':
            // Enforce minimum steps for shelterwood (select + remove + final)
            if (times < MIN_STEPS_SHELTERWOOD) {
                times = MIN_STEPS_SHELTERWOOD;
                corrected_params.times = times;  // Track correction
            }
            if (interval < 1) {
                interval = 5;  // Default interval if missing
                corrected_params.interval = interval;
            }
            is_Sequence = true;
            sequence_total_steps = times;
            for (var i = 0; i < times; i++) {
                timeline.push(start_age + (i * interval));
            }
            break;

        case 'femel':
            // Enforce minimum steps for femel (select + step + final)
            if (times < MIN_STEPS_FEMEL) {
                times = MIN_STEPS_FEMEL;
                corrected_params.times = times;
            }
            if (interval < 1) {
                interval = 10;
                corrected_params.interval = interval;
            }
            is_Sequence = true;
            sequence_total_steps = times;
            for (var i = 0; i < times; i++) {
                timeline.push(start_age + (i * interval));
            }
            break;

        case 'selectiveThinning':
        case 'fromBelow':
        case 'tending':
            // Enforce minimum steps for thinning activities
            if (times < MIN_STEPS_THINNING) {
                times = MIN_STEPS_THINNING;
                corrected_params.times = times;  // Track correction
            }
            if (times > 1 && interval > 0) {
                is_Sequence = true;
                sequence_total_steps = times;
                for (var i = 0; i < times; i++) {
                    timeline.push(start_age + (i * interval));
                }
            } else {
                // Fallback if times=1 or no interval
                timeline.push(start_age);
                sequence_total_steps = 1;
                is_Sequence = false;
            }
            break;

        case 'targetDBH':
        case 'plenter_harvest':
        case 'plenter_thinning':
            if (interval > 0) {
                is_Sequence = true;
                sequence_total_steps = 20;
                for (var i = 0; i < 20; i++) {
                    timeline.push(start_age + (i * interval));
                }
            }
            break;
    }
    return {
        timeline: timeline,
        is_Sequence: is_Sequence,
        sequence_total_steps: sequence_total_steps,
        corrected_params: corrected_params  // Include corrected parameter values
    };
}

function handle_overdue_harvest(stand_data_obj, original_start_age) {
    var activity_name = stand_data_obj.activity.chosen_Activity;
    var preference = stand_data_obj.preference_focus;
    var current_age = stand_data_obj.iLand_stand_data.absolute_age_soco;

    // Added 'femel' to harvest list for overdue check
    var is_harvest = ['clearcut', 'shelterwood', 'plenter_harvest', 'femel'].indexOf(activity_name) > -1;
    if (!is_harvest) {
        return original_start_age;
    }

    // If the scheduled age is in the past, force it to current age + small offset
    // This prevents sequences from starting with all timeline events in the past
    if (current_age > original_start_age) {
        var random_offset = 1 + Math.floor(Math.random() * 5);
        var forced_age = Math.round(current_age + random_offset);
        // console.log(`[COMPUTE_SCHEDULE] Stand overdue: current_age=${current_age}, ` +
        //             `original_start=${original_start_age}, forcing to ${forced_age}`);
        return forced_age;
    }

    // Also check against preference-based age thresholds
    var age_thresholds = { "Production": 100, "Biodiversity": 140, "CO2": 120 };
    var age_limit = age_thresholds[preference] || 999;

    if (current_age > age_limit) {
        var random_offset = 1 + Math.floor(Math.random() * 10);
        var forced_age = Math.round(current_age + random_offset);
        return forced_age;
    }

    return original_start_age;
}

Cognition.convert_age_timeline_to_calendar_years = function(stand_data_obj, age_timeline) {
    const current_year = Globals.year;
    const current_age = Math.floor(get_relevant_age(stand_data_obj));

    const calendar_timeline = age_timeline.map(target_age => {
        const years_until_due = target_age - current_age;
        return current_year + years_until_due;
    });

    return calendar_timeline;
};


// --- MAIN COGNITION FUNCTION ---

Cognition.compute_schedule = function(stand_data_obj) {
    var activity = stand_data_obj.activity;
    var params = activity.parameters;

    activity.target_year = -1;

    if (activity.chosen_Activity === 'noManagement' || typeof params.execution_schedule === 'undefined') {
        activity.timeline = [];
        activity.is_Sequence = false;
        activity.sequence_total_steps = 0;
        activity.sequence_current_step = 0;
        return stand_data_obj;
    }

    // 1. Determine the effective START AGE.
    var ideal_start_age = Math.round(Number(params.execution_schedule));
    var effective_start_age = handle_overdue_harvest(stand_data_obj, ideal_start_age);
    
    var temp_params = {};
    for (var key in params) {
        if (params.hasOwnProperty(key)) {
            temp_params[key] = params[key];
        }
    }
    temp_params.execution_schedule = effective_start_age;

    // 2. Generate the AGE-BASED timeline.
    var timeline_data = generate_timeline(activity.chosen_Activity, temp_params);

    activity.is_Sequence = timeline_data.is_Sequence;
    activity.sequence_total_steps = timeline_data.sequence_total_steps;

    // 2.5. Write corrected parameters back to activity.parameters
    // This ensures parameter learning propagates correct values
    if (timeline_data.corrected_params && Object.keys(timeline_data.corrected_params).length > 0) {
        for (var corrected_key in timeline_data.corrected_params) {
            if (timeline_data.corrected_params.hasOwnProperty(corrected_key)) {
                activity.parameters[corrected_key] = timeline_data.corrected_params[corrected_key];
            }
        }
    }

    // 3. Convert the AGE timeline to a CALENDAR YEAR timeline.
    if (timeline_data.timeline.length > 0) {
        activity.timeline = Cognition.convert_age_timeline_to_calendar_years(stand_data_obj, timeline_data.timeline);

        // 4. Synchronize the plan with the present
        let next_target_year = -1;
        let next_step_index = -1;
        const current_year = Globals.year;
        
        const grace_period = 3; 

        // A. Standard Loop
        for (let i = 0; i < activity.timeline.length; i++) {
            if (activity.timeline[i] >= current_year - grace_period) {
                next_target_year = activity.timeline[i];
                if (next_target_year < current_year) {
                    next_target_year = current_year;
                }
                next_step_index = i;
                break;
            }
        }

        // B. Check steps remaining from current year (including current year)
        // Count how many timeline events are >= current_year
        var steps_from_now = 0;
        var first_future_index = -1;
        for (var idx = 0; idx < activity.timeline.length; idx++) {
            if (activity.timeline[idx] >= current_year) {
                steps_from_now++;
                if (first_future_index === -1) {
                    first_future_index = idx;
                }
            }
        }

        // C. Late Entry Filter - Drop sequences that can't complete minimum steps
        if (activity.is_Sequence) {
            var min_required_steps = 2;  // Default minimum

            // Femel and Shelterwood require all 3 phases (select, step/remove, final)
            if (activity.chosen_Activity === 'femel' || activity.chosen_Activity === 'shelterwood') {
                min_required_steps = 3;
            }

            if (steps_from_now < min_required_steps) {
                activity.chosen_Activity = 'noManagement';
                activity.parameters = {};
                activity.timeline = [];
                activity.is_Sequence = false;
                activity.sequence_total_steps = 0;
                activity.sequence_current_step = 0;
                activity.target_year = -1;
                return stand_data_obj;
            }
        }

        // D. Set next target year if we have future events
        if (first_future_index !== -1) {
            next_target_year = activity.timeline[first_future_index];
            if (next_target_year < current_year) {
                next_target_year = current_year;
            }
            next_step_index = first_future_index;
        }

        if (next_target_year !== -1) {
            activity.sequence_current_step = next_step_index;
            activity.target_year = next_target_year;
        } else {
            activity.sequence_current_step = activity.sequence_total_steps;
            activity.target_year = -1;
        }

    } else {
        activity.timeline = [];
        activity.target_year = -1;
        activity.sequence_current_step = 0;
    }

    return stand_data_obj;
};

// ----- End of File: soco_src/cognition/compute_schedule.js -----