// FILE: soco_src/cognition/plan_decade.js
// Paper 1: Unit-level 10-year planning replacing per-stand compute_schedule.

Cognition.plan_decade = function(agent, current_year) {

    var mandatory = [];
    var harvest_pool = [];
    var thinning_pool = [];

    for (var stand_id in agent.managed_stands_data) {
        var s = agent.managed_stands_data[stand_id];

        // Skip NoManagement preference stands
        if (s.preference_focus === 'NoManagement') continue;

        var status = Cognition.classify_stand_status(s, current_year);
        if (status !== "candidate") continue;

        var window = Cognition.get_decision_window(s.iLand_stand_data.absolute_age_soco);

        switch (window) {
            case "Planting":
            case "Tending":
                mandatory.push(s);
                break;
            case "Thinning":
                thinning_pool.push(s);
                break;
            case "Harvesting":
                harvest_pool.push(s);
                break;
        }
    }

    // --- MANDATORY: Planting + Tending ---
    for (var i = 0; i < mandatory.length; i++) {
        var ms = mandatory[i];
        var mw = Cognition.get_decision_window(ms.iLand_stand_data.absolute_age_soco);
        var activity = Cognition.draw_activity(agent, mw);

        if (activity === "noManagement") {
            ms.activity.chosen_Activity = "noManagement";
            ms.activity.is_actionable = false;
        } else {
            ms.activity.chosen_Activity = activity;
            ms.activity.target_year = current_year + 1 + Math.floor(Math.random() * 3);
            ms.activity.is_actionable = true;
            Cognition.select_parameters(ms, agent);
        }
        ms.activity.decided_window = mw;
        ms.activity.planned_phase = mw;
    }

    // --- HARVESTING: Sustained yield ---
    var HARVEST_INTENSITY = { MF: 1.0, OP: 1.2, TR: 0.6, EN: 0.2, PA: 0.0 };
    var rotation_decades = 8;
    var harvest_target = Math.ceil(
        agent.managed_stand_ids.length / rotation_decades *
        (HARVEST_INTENSITY[agent.behavioral_type] || 0)
    );

    harvest_pool.sort(function(a, b) {
        return b.iLand_stand_data.volume - a.iLand_stand_data.volume;
    });

    var harvest_count = 0;
    for (var h = 0; h < harvest_pool.length; h++) {
        var hs = harvest_pool[h];
        if (harvest_count >= harvest_target) break;

        var hact = Cognition.draw_activity(agent, "Harvesting");

        if (hact === "noManagement") {
            hs.activity.chosen_Activity = "noManagement";
            hs.activity.is_actionable = false;
            hs.activity.decided_window = "Harvesting";
            continue;
        }

        hs.activity.chosen_Activity = hact;
        hs.activity.target_year = current_year + 2 + Math.floor(Math.random() * 8);
        hs.activity.is_actionable = true;
        hs.activity.decided_window = "Harvesting";
        hs.activity.planned_phase = "Harvesting";
        Cognition.select_parameters(hs, agent);
        harvest_count++;
    }

    // --- THINNING ---
    thinning_pool.sort(function(a, b) {
        return b.iLand_stand_data.basal_area - a.iLand_stand_data.basal_area;
    });

    for (var t = 0; t < thinning_pool.length; t++) {
        var ts = thinning_pool[t];
        var tact = Cognition.draw_activity(agent, "Thinning");

        if (tact === "noManagement") {
            ts.activity.chosen_Activity = "noManagement";
            ts.activity.is_actionable = false;
        } else {
            ts.activity.chosen_Activity = tact;
            ts.activity.target_year = current_year + 1 + Math.floor(Math.random() * 9);
            ts.activity.is_actionable = true;
            Cognition.select_parameters(ts, agent);
        }
        ts.activity.decided_window = "Thinning";
        ts.activity.planned_phase = "Thinning";
    }
};

// Helper: draw activity from agent's blended distribution for a given phase
Cognition.draw_activity = function(agent, phase) {
    var dist = agent.activity_table[phase];
    if (!dist || !dist.options || !dist.alpha) return "noManagement";

    var weights = Distributions.sample({
        distribution_function: "dirichlet",
        distribution_params: dist
    });
    return Distributions.weighted_random_choice(weights);
};
