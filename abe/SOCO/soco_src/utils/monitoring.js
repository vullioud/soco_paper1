// FILE: soco_src/utils/monitoring.js
// Block 0: ML activity log + decade decision log only.

var Monitoring = {

    // --- State ---
    ml_activity_log:     [],
    decade_decision_log: [],

    // --- Guards ---
    isMLEnabled: function() {
        if (typeof SoCoABE_CONFIG === 'undefined') return true;
        if (SoCoABE_CONFIG.WARMING && SoCoABE_CONFIG.WARMING.ENABLED) {
            var warmingEnd = SoCoABE_CONFIG.WARMING.DURATION || 0;
            if (Globals.year <= warmingEnd) return false;
        }
        return SoCoABE_CONFIG.MONITORING.ML_LOG !== false;
    },

    isDecadeLogEnabled: function() {
        if (typeof SoCoABE_CONFIG === 'undefined') return true;
        if (SoCoABE_CONFIG.WARMING && SoCoABE_CONFIG.WARMING.ENABLED) {
            var warmingEnd = SoCoABE_CONFIG.WARMING.DURATION || 0;
            if (Globals.year <= warmingEnd) return false;
        }
        return SoCoABE_CONFIG.MONITORING.DECADE_LOG !== false;
    },

    _safeFixed: function(val, digits) {
        if (typeof val === 'number' && !isNaN(val)) return val.toFixed(digits);
        return "0";
    },

    // --- ML Activity Log ---

    log_ml_baseline: function(stand_data_obj, agent) {
        if (!this.isMLEnabled()) return;

        fmengine.standId = stand_data_obj.stand_id;

        var record = {
            year:                   Globals.year,
            stand_id:               stand_data_obj.stand_id,
            agent_id:               agent.id,
            owner_type:             agent.owner.type,
            behavioral_type:        agent.behavioral_type,
            activity_name:          'none',
            is_sequence:            0,
            sequence_step:          -1,
            previous_activity:      stand_data_obj.history.last_activity,
            previous_activity_year: stand_data_obj.history.last_activity_Year,
            age_t0:                 stand_data_obj.iLand_stand_data.absolute_age_iLand,
            volume_t0:              stand_data_obj.iLand_stand_data.volume,
            basal_area_t0:          stand_data_obj.iLand_stand_data.basal_area,
            top_height_t0:          stand.topHeight,
            species_composition_t0: JSON.stringify(stand_data_obj.get_species_composition()),
            parameters:             JSON.stringify({})
        };

        this.ml_activity_log.push(record);
    },

    log_ml_activity: function(stand_data_obj, agent) {
        if (!this.isMLEnabled()) return;

        fmengine.standId = stand_data_obj.stand_id;

        var record = {
            year:                   Globals.year,
            stand_id:               stand_data_obj.stand_id,
            agent_id:               agent.id,
            owner_type:             agent.owner.type,
            behavioral_type:        agent.behavioral_type,
            activity_name:          stand_data_obj.activity.chosen_Activity,
            is_sequence:            stand_data_obj.activity.is_Sequence ? 1 : 0,
            sequence_step:          stand_data_obj.activity.is_Sequence
                                        ? stand_data_obj.activity.sequence_current_step : -1,
            previous_activity:      stand_data_obj.history.last_activity,
            previous_activity_year: stand_data_obj.history.last_activity_Year,
            age_t0:                 stand_data_obj.iLand_stand_data.absolute_age_iLand,
            volume_t0:              stand_data_obj.iLand_stand_data.volume,
            basal_area_t0:          stand_data_obj.iLand_stand_data.basal_area,
            top_height_t0:          stand.topHeight,
            species_composition_t0: JSON.stringify(stand_data_obj.get_species_composition()),
            parameters:             JSON.stringify(stand_data_obj.activity.parameters || {})
        };

        this.ml_activity_log.push(record);
    },

    save_ml_activity_csv: function(filename) {
        var header = "year,stand_id,agent_id,owner_type,behavioral_type,activity_name," +
            "is_sequence,sequence_step," +
            "previous_activity,previous_activity_year," +
            "age_t0,volume_t0,basal_area_t0,top_height_t0," +
            "species_composition_t0,parameters";
        var lines = [header];

        for (var i = 0; i < this.ml_activity_log.length; i++) {
            var r = this.ml_activity_log[i];
            var line = r.year + "," + r.stand_id + "," + r.agent_id + "," +
                r.owner_type + "," + r.behavioral_type + "," + r.activity_name + "," +
                r.is_sequence + "," + r.sequence_step + "," +
                r.previous_activity + "," + r.previous_activity_year + "," +
                this._safeFixed(r.age_t0, 1) + "," +
                this._safeFixed(r.volume_t0, 2) + "," +
                this._safeFixed(r.basal_area_t0, 2) + "," +
                this._safeFixed(r.top_height_t0, 2) + "," +
                '"' + r.species_composition_t0 + '",' +
                '"' + r.parameters + '"';
            lines.push(line);
        }

        try {
            Globals.saveTextFile(filename, lines.join("\n"));
        } catch (e) {
            SoCoLog.error("[Monitoring] ML log save failed: " + e.message);
        }
    },

    // --- Decade Decision Log ---

    log_decade_decision: function(agent, year, pool_type, stand_data_obj, rank, was_selected) {
        if (!this.isDecadeLogEnabled()) return;

        this.decade_decision_log.push({
            year:            year,
            agent_id:        agent.id,
            behavioral_type: agent.behavioral_type,
            pool_type:       pool_type,
            stand_id:        stand_data_obj.stand_id,
            stand_rank:      rank,
            was_selected:    was_selected,
            age_t0:          stand_data_obj.iLand_stand_data.absolute_age_iLand,
            volume_t0:       stand_data_obj.iLand_stand_data.volume,
            basal_area_t0:   stand_data_obj.iLand_stand_data.basal_area,
            chosen_activity: stand_data_obj.activity.chosen_Activity,
            decided_window:  stand_data_obj.activity.decided_window
        });
    },

    save_decade_decisions_csv: function(filename) {
        var header = "year,agent_id,behavioral_type,pool_type,stand_id,stand_rank," +
            "was_selected,age_t0,volume_t0,basal_area_t0,chosen_activity,decided_window";
        var lines = [header];

        for (var i = 0; i < this.decade_decision_log.length; i++) {
            var r = this.decade_decision_log[i];
            var line = r.year + "," + r.agent_id + "," + r.behavioral_type + "," +
                r.pool_type + "," + r.stand_id + "," + r.stand_rank + "," +
                r.was_selected + "," +
                this._safeFixed(r.age_t0, 1) + "," +
                this._safeFixed(r.volume_t0, 2) + "," +
                this._safeFixed(r.basal_area_t0, 2) + "," +
                r.chosen_activity + "," + r.decided_window;
            lines.push(line);
        }

        try {
            Globals.saveTextFile(filename, lines.join("\n"));
        } catch (e) {
            SoCoLog.error("[Monitoring] Decade decisions save failed: " + e.message);
        }
    },

    // --- Save all ---
    save_all: function(prefix) {
        var files = SoCoABE_CONFIG.MONITORING.OUTPUT_FILES || {};
        if (this.isMLEnabled()) {
            var fn = files.ML_ACTIVITY || "soco_ml_activities";
            this.save_ml_activity_csv(Globals.path("output/" + prefix + fn + ".csv"));
        }
        if (this.isDecadeLogEnabled()) {
            var fn2 = files.DECADE_DECISIONS || "soco_decade_decisions";
            this.save_decade_decisions_csv(Globals.path("output/" + prefix + fn2 + ".csv"));
        }
    }
};

this.Monitoring = Monitoring;
