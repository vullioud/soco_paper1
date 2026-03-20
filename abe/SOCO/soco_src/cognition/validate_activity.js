// FILE: soco_src/cognition/validate_activity.js
// Utility scorer for execution ordering. No validation logic — that's in plan_decade.

Cognition.validate_activity = function(stand_data_obj) {
    var activity = stand_data_obj.activity;

    if (!activity.is_actionable ||
        activity.chosen_Activity === 'none' ||
        activity.chosen_Activity === 'noManagement') {
        activity.utility_score = 0;
        return stand_data_obj;
    }

    var vol = stand_data_obj.iLand_stand_data.volume;
    var ba = stand_data_obj.iLand_stand_data.basal_area;
    var age = stand_data_obj.iLand_stand_data.absolute_age_iLand;
    var act_name = activity.chosen_Activity;

    // Salvage clearcut: always first (set by plan_decade PostDisturbance step)
    if (act_name === 'salvage_clearcut') {
        activity.utility_score = 1000;
    }
    // Planting: high priority for empty stands
    else if (act_name === 'planting') {
        activity.utility_score = 100 + (age <= 0.1 ? 100 : 10 / Math.max(age, 0.1));
    }
    // Harvesting activities: prioritize by volume
    else if (act_name === 'clearcut' || act_name === 'shelterwood' ||
             act_name === 'targetDBH' || act_name === 'plenter_harvest' || act_name === 'femel') {
        activity.utility_score = vol;
    }
    // Thinning/tending: prioritize by basal area
    else {
        activity.utility_score = ba;
    }

    return stand_data_obj;
};
