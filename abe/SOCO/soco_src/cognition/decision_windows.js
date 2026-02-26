// FILE: soco_src/cognition/decision_windows.js
// Paper 1: Age-based decision windows for 10-year planning.

Cognition.get_decision_window = function(age) {
    if (age >= 0 && age <= 5)   return "Planting";
    if (age >= 10 && age <= 20) return "Tending";
    if (age >= 30 && age <= 70) return "Thinning";
    if (age >= 80)              return "Harvesting";
    return "limbo";
};

Cognition.classify_stand_status = function(stand_data_obj, current_year) {
    var age = stand_data_obj.iLand_stand_data.absolute_age_iLand;
    var window = Cognition.get_decision_window(age);
    var is_ongoing = stand_data_obj.activity.is_Sequence;
    var decided_window = stand_data_obj.activity.decided_window;

    if (is_ongoing) return "ongoing";
    if (decided_window === window) return "locked";
    if (window === "limbo") return "limbo";
    return "candidate";
};
