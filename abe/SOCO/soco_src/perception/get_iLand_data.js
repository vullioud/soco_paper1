Perception.get_iLand_data = function(stand_data_obj) {
    fmengine.standId = stand_data_obj.stand_id;

    if (!stand || stand.id <= 0) {
        SoCoLog.warn('[Perception] Could not find valid iLand stand object for ID ' + stand_data_obj.stand_id);
        return stand_data_obj;
    }

    var data = stand_data_obj.iLand_stand_data;

    // --- Only populate fields declared in stand_data schema ---
    data.absolute_age_iLand   = stand.absoluteAge;
    data.volume               = stand.volume;
    data.basal_area           = stand.basalArea;
    data.top_height           = stand.topHeight;
    data.mean_dbh             = stand.dbh;
    // stand.stems is not exposed as a JS Q_PROPERTY — calculate from tree list
    stand.trees.loadAll();
    data.stems                = (stand.area > 0) ? stand.trees.count / stand.area : 0;

    // --- Structural diversity metrics (from tree list, already loaded) ---
    var n = stand.trees.count;
    if (n > 1) {
        // DBH standard deviation: sd = sqrt(E[x^2] - E[x]^2)
        var mean_dbh_val = stand.trees.mean('dbh');
        var mean_dbh_sq  = stand.trees.mean('dbh*dbh');
        data.dbh_sd = Math.sqrt(Math.max(0, mean_dbh_sq - mean_dbh_val * mean_dbh_val));

        // Max DBH (sort ascending, take 100th percentile)
        stand.trees.sort('dbh');
        data.max_dbh = stand.trees.percentile(100);

        // Large trees: DBH >= 40 cm, scaled to per hectare
        var n_large = stand.trees.sum('1', 'dbh>=40');
        data.n_large_trees = (stand.area > 0) ? n_large / stand.area : 0;

        // Height standard deviation
        var mean_h    = stand.trees.mean('height');
        var mean_h_sq = stand.trees.mean('height*height');
        data.height_sd = Math.sqrt(Math.max(0, mean_h_sq - mean_h * mean_h));

        // Height layers: count occupied 5m bins from 0 to 60m
        var layers = 0;
        for (var hbin = 0; hbin < 60; hbin += 5) {
            if (stand.trees.sum('1', 'height>=' + hbin + ' and height<' + (hbin + 5)) > 0) {
                layers++;
            }
        }
        data.n_height_layers = layers;

        // Gini coefficient of DBH (sorted formula, trees already sorted by dbh)
        // G = (2 * sum(i * x_i)) / (n * sum(x_i)) - (n+1)/n
        var sum_weighted = 0;
        var sum_dbh_all = 0;
        for (var gi = 0; gi < n; gi++) {
            var d = stand.trees.tree(gi).dbh;
            sum_weighted += (gi + 1) * d;
            sum_dbh_all += d;
        }
        data.dbh_gini = (sum_dbh_all > 0)
            ? (2 * sum_weighted) / (n * sum_dbh_all) - (n + 1) / n
            : 0;
    } else {
        data.dbh_sd = 0;
        data.dbh_gini = 0;
        data.n_large_trees = 0;
        data.n_height_layers = (n === 1) ? 1 : 0;
        data.height_sd = 0;
        data.max_dbh = (n === 1) ? stand.dbh : 0;
    }

    data.needs_salvage              = stand.flag('abe_need_salvage') || false;
    data.disturbance_severity       = stand.flag('abe_disturbance_severity') || 0;
    data.disturbance_volume         = stand.flag('abe_disturbance_volume') || 0;
    data.disturbance_cost           = stand.flag('abe_disturbance_cost') || 0;
    data.actual_salvage_volume_m3ha = stand.flag('abe_actual_salvage_volume_m3ha') || 0;
    data.deadwood_retained_m3ha     = stand.flag('abe_deadwood_retained_m3ha') || 0;

    // Clear one-shot disturbance notification on iLand side
    // (side-effect only — value is NOT stored on stand_data)
    if (stand.flag('abe_disturbance_detected')) {
        stand.setFlag('abe_disturbance_detected', false);
    }

    return stand_data_obj;
};
