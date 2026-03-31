// FILE: soco_src/utils/monitoring.js
// Block 0: ML activity log + decade decision log only.

var Monitoring = {

    // --- State ---
    ml_activity_log:     [],
    decade_decision_log: [],
    decade_budget_log:   [],
    decade_snapshot_log: [],
    stand_state_log:     [],

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

    // --- Stand State Log (yearly, all stands — structural phase monitoring) ---

    isStandStateEnabled: function() {
        if (typeof SoCoABE_CONFIG === 'undefined') return false;
        if (SoCoABE_CONFIG.WARMING && SoCoABE_CONFIG.WARMING.ENABLED) {
            var warmingEnd = SoCoABE_CONFIG.WARMING.DURATION || 0;
            if (Globals.year <= warmingEnd) return false;
        }
        return SoCoABE_CONFIG.MONITORING.STAND_STATE_LOG !== false;
    },

    log_stand_state: function(stand_data_obj, agent) {
        if (!this.isStandStateEnabled()) return;

        var d = stand_data_obj.iLand_stand_data;
        var age = d.absolute_age_iLand;
        var age_phase = Cognition.get_phase(age);
        var struct_phase = Cognition.get_structural_phase(stand_data_obj);

        var active_phase = Cognition.Phases.classify(stand_data_obj);

        this.stand_state_log.push({
            year:             Globals.year,
            stand_id:         stand_data_obj.stand_id,
            agent_id:         agent.id,
            behavioral_type:  agent.behavioral_type,
            is_set_aside:     stand_data_obj.is_set_aside ? 1 : 0,
            age:              age,
            volume:           d.volume,
            basal_area:       d.basal_area,
            top_height:       d.top_height,
            mean_dbh:         d.mean_dbh,
            stems:            d.stems,
            dbh_sd:           d.dbh_sd,
            dbh_gini:         d.dbh_gini,
            n_large_trees:    d.n_large_trees,
            n_height_layers:  d.n_height_layers,
            height_sd:        d.height_sd,
            max_dbh:          d.max_dbh,
            age_phase:        age_phase,
            structural_phase: struct_phase,
            active_phase:     active_phase,
            engine:           SoCoABE_CONFIG.PHASE_ENGINE || 'age',
            phase_match:      (age_phase === struct_phase) ? 1 : 0,
            blocked_until:    stand_data_obj.activity.blocked_until_phase || 'none',
            last_completed:   stand_data_obj.activity.last_completed_phase || 'none',
            chosen_activity:  stand_data_obj.activity.chosen_Activity || 'none',
            is_sequence:      stand_data_obj.activity.is_Sequence ? 1 : 0,
            wet_type:         stand_data_obj.wet_type || 'b',
            disturbance_type: d.disturbance_type || ''
        });
    },

    save_stand_state_csv: function(filename) {
        var header = "year,stand_id,agent_id,behavioral_type,is_set_aside," +
            "age,volume,basal_area,top_height,mean_dbh,stems," +
            "dbh_sd,dbh_gini,n_large_trees,n_height_layers,height_sd,max_dbh," +
            "age_phase,structural_phase,active_phase,engine,phase_match," +
            "blocked_until,last_completed,chosen_activity,is_sequence," +
            "wet_type,disturbance_type";
        var lines = [header];

        for (var i = 0; i < this.stand_state_log.length; i++) {
            var r = this.stand_state_log[i];
            var line = r.year + "," + r.stand_id + "," + r.agent_id + "," +
                r.behavioral_type + "," + r.is_set_aside + "," +
                this._safeFixed(r.age, 1) + "," +
                this._safeFixed(r.volume, 2) + "," +
                this._safeFixed(r.basal_area, 2) + "," +
                this._safeFixed(r.top_height, 2) + "," +
                this._safeFixed(r.mean_dbh, 2) + "," +
                this._safeFixed(r.stems, 0) + "," +
                this._safeFixed(r.dbh_sd, 2) + "," +
                this._safeFixed(r.dbh_gini, 4) + "," +
                this._safeFixed(r.n_large_trees, 1) + "," +
                r.n_height_layers + "," +
                this._safeFixed(r.height_sd, 2) + "," +
                this._safeFixed(r.max_dbh, 2) + "," +
                r.age_phase + "," + r.structural_phase + "," +
                r.active_phase + "," + r.engine + "," + r.phase_match + "," +
                r.blocked_until + "," + r.last_completed + "," +
                r.chosen_activity + "," + r.is_sequence + "," +
                r.wet_type + "," + r.disturbance_type;
            lines.push(line);
        }

        try {
            Globals.saveTextFile(filename, lines.join("\n"));
        } catch (e) {
            SoCoLog.error("[Monitoring] Stand state log save failed: " + e.message);
        }
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
            parameters:             JSON.stringify({}),
            salvage_fraction:           0,
            actual_salvage_volume_m3ha: 0,
            deadwood_retained_m3ha:     0,
            disturbance_severity_frac:  0,
            extraction_cost_paid:       0,
            remnant_decision:           'none',
            disturbance_type:           ''
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
            parameters:             JSON.stringify(stand_data_obj.activity.parameters || {}),
            salvage_fraction:           0,
            actual_salvage_volume_m3ha: 0,
            deadwood_retained_m3ha:     0,
            disturbance_severity_frac:  0,
            extraction_cost_paid:       0,
            remnant_decision:           'none',
            disturbance_type:           ''
        };

        // Populate salvage-specific fields when applicable
        // Option B: iLand extracts 100% of dead trees; salvage_fraction is always 1.0
        if (stand_data_obj.activity.chosen_Activity === 'salvage_clearcut' ||
            stand_data_obj.activity.chosen_Activity === 'salvage_leave') {
            record.salvage_fraction = 1.0;
            record.actual_salvage_volume_m3ha = stand.flag('abe_actual_salvage_volume_m3ha') || 0;
            record.deadwood_retained_m3ha = 0;
            record.disturbance_severity_frac = stand.flag('abe_disturbance_severity') || 0;
            record.extraction_cost_paid = stand.flag('abe_extraction_cost_paid') || 0;
            record.remnant_decision = stand.flag('abe_param_salvage_type') || 'none';
            record.disturbance_type = stand.flag('abe_disturbance_type') || '';
        }

        this.ml_activity_log.push(record);
    },

    save_ml_activity_csv: function(filename) {
        var header = "year,stand_id,agent_id,owner_type,behavioral_type,activity_name," +
            "is_sequence,sequence_step," +
            "previous_activity,previous_activity_year," +
            "age_t0,volume_t0,basal_area_t0,top_height_t0," +
            "species_composition_t0,parameters," +
            "salvage_fraction,actual_salvage_volume_m3ha,deadwood_retained_m3ha,disturbance_severity_frac," +
            "extraction_cost_paid,remnant_decision,disturbance_type";
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
                '"' + (r.species_composition_t0 || '{}').replace(/"/g, '""') + '",' +
                '"' + (r.parameters || '{}').replace(/"/g, '""') + '",' +
                this._safeFixed(r.salvage_fraction, 2) + "," +
                this._safeFixed(r.actual_salvage_volume_m3ha, 2) + "," +
                this._safeFixed(r.deadwood_retained_m3ha, 2) + "," +
                this._safeFixed(r.disturbance_severity_frac, 3) + "," +
                this._safeFixed(r.extraction_cost_paid, 0) + "," +
                (r.remnant_decision || 'none') + "," +
                (r.disturbance_type || '');
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
            last_completed:  stand_data_obj.activity.last_completed_phase || 'none'
        });
    },

    log_decade_budget: function(agent, year, n_all_stands, budget_total, ongoing_cost, budget_spent, harvest_selected, harvest_target) {
        if (!this.isDecadeLogEnabled()) return;

        var n_set_aside = 0;
        var n_managed = 0;
        for (var sid in agent.managed_stands_data) {
            if (agent.managed_stands_data[sid].is_set_aside) n_set_aside++;
            else n_managed++;
        }

        this.decade_budget_log.push({
            year:             year,
            agent_id:         agent.id,
            behavioral_type:  agent.behavioral_type,
            n_all_stands:     n_all_stands,
            n_set_aside:      n_set_aside,
            n_managed:        n_managed,
            resources:        agent.resources,
            budget_total:     budget_total,
            ongoing_cost:     ongoing_cost,
            budget_spent:     budget_spent,
            budget_remaining: budget_total - budget_spent,
            harvest_selected: harvest_selected,
            harvest_target:   harvest_target,
            pile_size:        (agent.unit_state.work_pile || []).length
        });
    },

    save_decade_budget_csv: function(filename) {
        var header = "year,agent_id,behavioral_type,n_all_stands,n_set_aside,n_managed," +
            "resources,budget_total,ongoing_cost,budget_spent,budget_remaining," +
            "harvest_selected,harvest_target,pile_size";
        var lines = [header];

        for (var i = 0; i < this.decade_budget_log.length; i++) {
            var r = this.decade_budget_log[i];
            var line = r.year + "," + r.agent_id + "," + r.behavioral_type + "," +
                r.n_all_stands + "," + r.n_set_aside + "," + r.n_managed + "," +
                this._safeFixed(r.resources, 3) + "," +
                r.budget_total + "," + r.ongoing_cost + "," +
                r.budget_spent + "," + r.budget_remaining + "," +
                r.harvest_selected + "," + r.harvest_target + "," + r.pile_size;
            lines.push(line);
        }

        try {
            Globals.saveTextFile(filename, lines.join("\n"));
        } catch (e) {
            SoCoLog.error("[Monitoring] Budget log save failed: " + e.message);
        }
    },

    // --- Decade Snapshot Log (complete per-stand census at each planning point) ---

    log_decade_snapshot: function(agent, year) {
        if (!this.isDecadeLogEnabled()) return;

        // Build work_pile lookup: stand_id → { rank, priority, cost, source }
        var pile = agent.unit_state.work_pile || [];
        var pile_lookup = {};
        for (var p = 0; p < pile.length; p++) {
            var item = pile[p];
            if (!pile_lookup[item.stand_id]) {
                pile_lookup[item.stand_id] = {
                    rank:     p,
                    priority: item.priority,
                    cost:     item.cost,
                    source:   item.source
                };
            }
        }

        for (var sid in agent.managed_stands_data) {
            var s = agent.managed_stands_data[sid];
            var age = s.iLand_stand_data.absolute_age_iLand;
            var pw = pile_lookup[s.stand_id];

            // Derive status
            var status;
            if (s.is_set_aside) {
                status = "set_aside";
            } else if (pw && pw.source === 'ongoing') {
                status = "ongoing";
            } else if (s.activity.blocked_until_phase) {
                status = "blocked";
            } else if (pw && pw.source === 'new') {
                status = "committed";
            } else if ((s.activity.carryover_count || 0) > 0 && s.activity.chosen_Activity === 'none') {
                status = "deferred";
            } else {
                status = "idle";
            }

            this.decade_snapshot_log.push({
                year:            year,
                agent_id:        agent.id,
                behavioral_type: agent.behavioral_type,
                stand_id:        s.stand_id,
                status:          status,
                current_phase:   Cognition.Phases.classify(s),
                blocked_until:   s.activity.blocked_until_phase || 'none',
                last_completed:  s.activity.last_completed_phase || 'none',
                chosen_activity: s.activity.chosen_Activity || 'none',
                is_sequence:     s.activity.is_Sequence ? 1 : 0,
                carryover_count: s.activity.carryover_count || 0,
                age:             age,
                volume:          s.iLand_stand_data.volume,
                basal_area:      s.iLand_stand_data.basal_area,
                target_year:     s.activity.target_year || -1,
                pile_rank:       pw ? pw.rank : -1,
                pile_priority:   pw ? pw.priority : 0,
                pile_cost:       pw ? pw.cost : 0
            });
        }
    },

    save_decade_snapshot_csv: function(filename) {
        var header = "year,agent_id,behavioral_type,stand_id," +
            "status,current_phase,blocked_until,last_completed,chosen_activity," +
            "is_sequence,carryover_count," +
            "age,volume,basal_area," +
            "target_year,pile_rank,pile_priority,pile_cost";
        var lines = [header];

        for (var i = 0; i < this.decade_snapshot_log.length; i++) {
            var r = this.decade_snapshot_log[i];
            var line = r.year + "," + r.agent_id + "," + r.behavioral_type + "," +
                r.stand_id + "," + r.status + "," + r.current_phase + "," +
                r.blocked_until + "," + r.last_completed + "," +
                r.chosen_activity + "," +
                r.is_sequence + "," + r.carryover_count + "," +
                this._safeFixed(r.age, 1) + "," +
                this._safeFixed(r.volume, 2) + "," +
                this._safeFixed(r.basal_area, 2) + "," +
                r.target_year + "," + r.pile_rank + "," +
                this._safeFixed(r.pile_priority, 2) + "," + r.pile_cost;
            lines.push(line);
        }

        try {
            Globals.saveTextFile(filename, lines.join("\n"));
        } catch (e) {
            SoCoLog.error("[Monitoring] Snapshot log save failed: " + e.message);
        }
    },

    save_decade_decisions_csv: function(filename) {
        var header = "year,agent_id,behavioral_type,pool_type,stand_id,stand_rank," +
            "was_selected,age_t0,volume_t0,basal_area_t0,chosen_activity,last_completed";
        var lines = [header];

        for (var i = 0; i < this.decade_decision_log.length; i++) {
            var r = this.decade_decision_log[i];
            var line = r.year + "," + r.agent_id + "," + r.behavioral_type + "," +
                r.pool_type + "," + r.stand_id + "," + r.stand_rank + "," +
                r.was_selected + "," +
                this._safeFixed(r.age_t0, 1) + "," +
                this._safeFixed(r.volume_t0, 2) + "," +
                this._safeFixed(r.basal_area_t0, 2) + "," +
                r.chosen_activity + "," + r.last_completed;
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
        // Use system.path.output so CSVs land in the per-run output dir
        var out_dir = "output/";
        try { out_dir = Globals.setting('system.path.output') + "/"; }
        catch (e) { /* fallback to default */ }

        if (this.isMLEnabled()) {
            var fn = files.ML_ACTIVITY || "soco_ml_activities";
            this.save_ml_activity_csv(Globals.path(out_dir + prefix + fn + ".csv"));
        }
        if (this.isDecadeLogEnabled()) {
            var fn2 = files.DECADE_DECISIONS || "soco_decade_decisions";
            this.save_decade_decisions_csv(Globals.path(out_dir + prefix + fn2 + ".csv"));

            var fn3 = files.DECADE_BUDGET || "soco_decade_budget";
            this.save_decade_budget_csv(Globals.path(out_dir + prefix + fn3 + ".csv"));

            var fn4 = files.DECADE_SNAPSHOT || "soco_decade_snapshot";
            this.save_decade_snapshot_csv(Globals.path(out_dir + prefix + fn4 + ".csv"));
        }
        if (this.isStandStateEnabled() && this.stand_state_log.length > 0) {
            var fn_state = files.STAND_STATE || "soco_stand_state";
            this.save_stand_state_csv(Globals.path(out_dir + prefix + fn_state + ".csv"));
        }
    }
};

this.Monitoring = Monitoring;
