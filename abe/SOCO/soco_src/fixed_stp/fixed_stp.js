// ----- Start of File: soco_src/fixed_stp/fixed_stp.js -----

/**
 * =================================================================================
 * FILE: fixed_stp.js
 * =================================================================================
 * DESCRIPTION:
 * Provides Fixed Stand Treatment Plan (STP) mode for controlled experiments.
 * Loads predefined management schedules from JSON and bypasses agent cognition.
 *
 * JSON Input Format (from R universal_schedule.json):
 * [
 *   { "my_stands": 15, "year": 1, "activity": "clearcut", "arguments": {...} },
 *   { "my_stands": 15, "year": 3, "activity": "planting", "arguments": {...} }
 * ]
 * =================================================================================
 */

var FixedSTP = {
    plans: {},  // stand_id -> { current_step, steps: [...] }

    /**
     * Load plans from JSON array and group by stand_id
     * Input: flat array [{ my_stands, year, activity, arguments }, ...]
     * Output: plans[stand_id] = { current_step: 0, steps: [...] }
     */
    initialize: function(json_path) {
        try {
            var json_content = Globals.loadTextFile(json_path);
            var raw_data = JSON.parse(json_content);

            // Group by stand_id and sort by year
            var grouped = {};
            for (var i = 0; i < raw_data.length; i++) {
                var row = raw_data[i];
                var stand_id = row.my_stands.toString();

                if (!grouped[stand_id]) {
                    grouped[stand_id] = {
                        current_step: 0,
                        steps: []
                    };
                }

                grouped[stand_id].steps.push({
                    year: row.year,
                    activity: row.activity,
                    arguments: row.arguments || {}
                });
            }

            // Sort steps by year for each stand
            for (var sid in grouped) {
                grouped[sid].steps.sort(function(a, b) { return a.year - b.year; });
            }

            this.plans = grouped;
            var count = Object.keys(this.plans).length;
            var total_steps = raw_data.length;
            console.log("[FixedSTP] Loaded " + total_steps + " activity steps for " + count + " stands");

        } catch (e) {
            console.error("[FixedSTP] Failed to load plans: " + e.message);
            this.plans = {};
        }
    },

    /**
     * Check if stand has a fixed plan
     */
    has_plan: function(stand_id) {
        return this.plans.hasOwnProperty(stand_id.toString());
    },

    /**
     * Get current activity for stand if due this year
     * Returns { activity, arguments } or null if no action this year
     */
    get_current_activity: function(stand_id, current_year) {
        var plan = this.plans[stand_id.toString()];
        if (!plan) return null;

        var step_idx = plan.current_step;
        if (step_idx >= plan.steps.length) return null;

        var step = plan.steps[step_idx];

        // Check if this step is due this year
        if (step.year === current_year) {
            return {
                activity: step.activity,
                arguments: step.arguments || {}
            };
        }

        return null;
    },

    /**
     * Advance to next step after execution
     */
    advance_step: function(stand_id) {
        var plan = this.plans[stand_id.toString()];
        if (plan) {
            plan.current_step++;
        }
    },

    /**
     * Get number of stands with plans
     */
    get_stand_count: function() {
        return Object.keys(this.plans).length;
    },

    /**
     * Check if FixedSTP mode is enabled in config
     */
    is_enabled: function() {
        return (typeof SoCoABE_CONFIG !== 'undefined' &&
                SoCoABE_CONFIG.FIXED_STP &&
                SoCoABE_CONFIG.FIXED_STP.ENABLED);
    }
};

this.FixedSTP = FixedSTP;

// ----- End of File: soco_src/fixed_stp/fixed_stp.js -----
