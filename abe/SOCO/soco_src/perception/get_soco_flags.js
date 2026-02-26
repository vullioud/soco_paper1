Perception.update_history = function(stand_data_obj) {
    fmengine.standId = stand_data_obj.stand_id;
    if (!stand || stand.id <= 0) return stand_data_obj;

    var history = stand_data_obj.history;

    var last_activity_flag = stand.flag('abe_last_activity');
    var last_activity_year_flag = stand.flag('abe_last_activity_year');

    // Update history if a new activity was flagged last year
    if (last_activity_flag !== null && typeof last_activity_flag !== 'undefined' && last_activity_year_flag === (Globals.year - 1)) {
        history.last_activity = last_activity_flag;
        history.last_activity_Year = last_activity_year_flag;
    }

    return stand_data_obj;
};
