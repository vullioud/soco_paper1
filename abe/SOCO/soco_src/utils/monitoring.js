// ----- Start of File: soco_src/utils/monitoring.js -----

var Monitoring = {

    aggregated_history: [],
    harvest_log: [],
    continuous_activity_log: [],  // NEW: For continuous logging
    continuous_activity_set: {},  // NEW: Track logged activities to prevent duplicates
    ml_activity_log: [],           // NEW: ML dataset - rich activity records with pre/post states
    ml_activity_set: {},           // NEW: Deduplication for ML log
    yearly_structure_log: [],      // Yearly structure classification for all stands

    /**
     * Check if we are currently in the warming period (no recording)
     * @returns {boolean}
     */
    isWarmingPeriod: function() {
        if (typeof SoCoABE_CONFIG === 'undefined') return false;
        if (!SoCoABE_CONFIG.WARMING || !SoCoABE_CONFIG.WARMING.ENABLED) return false;

        var warmingEnd = SoCoABE_CONFIG.WARMING.DURATION || 0;
        return Globals.year <= warmingEnd;
    },

    isEnabled: function() {
        // During warming period, monitoring is disabled
        if (this.isWarmingPeriod()) return false;

        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING) {
            return SoCoABE_CONFIG.MONITORING.ENABLED;
        }
        return true;
    },

    isMLLogEnabled: function() {
        // During warming period, no ML logging (except baseline at end)
        if (this.isWarmingPeriod()) return false;

        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING) {
            return SoCoABE_CONFIG.MONITORING.ENABLED && SoCoABE_CONFIG.MONITORING.ML_ACTIVITY_LOG;
        }
        return true;
    },

    isSimpleActivityLogEnabled: function() {
        if (this.isWarmingPeriod()) return false;

        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING) {
            return SoCoABE_CONFIG.MONITORING.ENABLED && SoCoABE_CONFIG.MONITORING.SIMPLE_ACTIVITY_LOG;
        }
        return false;
    },

    isHarvestLogEnabled: function() {
        if (this.isWarmingPeriod()) return false;

        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING) {
            return SoCoABE_CONFIG.MONITORING.ENABLED && SoCoABE_CONFIG.MONITORING.HARVEST_LOG;
        }
        return false;
    },

    isDetailedLogEnabled: function() {
        if (this.isWarmingPeriod()) return false;

        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING) {
            return SoCoABE_CONFIG.MONITORING.ENABLED && SoCoABE_CONFIG.MONITORING.DETAILED_STAND_LOG;
        }
        return false;
    },

    isAggregatedLogEnabled: function() {
        if (this.isWarmingPeriod()) return false;

        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING) {
            return SoCoABE_CONFIG.MONITORING.ENABLED && SoCoABE_CONFIG.MONITORING.AGGREGATED_LOG;
        }
        return false;
    },

    isYearlyStructureLogEnabled: function() {
        if (this.isWarmingPeriod()) return false;

        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING) {
            return SoCoABE_CONFIG.MONITORING.ENABLED && SoCoABE_CONFIG.MONITORING.YEARLY_STRUCTURE_LOG;
        }
        return false;
    },

    getAggInterval: function() {
        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING && SoCoABE_CONFIG.MONITORING.agg_interval) {
            return SoCoABE_CONFIG.MONITORING.agg_interval;
        }
        return 1;
    },

    _safeFixed: function(val, digits) {
        if (typeof val === 'number' && !isNaN(val)) return val.toFixed(digits);
        return "0";
    },

    _getSpeciesJson: function() {
        try {
            var comp = {};
            var total_ba = stand.basalArea;
            if (total_ba > 0) {
                for (var i = 0; i < stand.nspecies; i++) {
                    var share = stand.speciesBasalArea(i) / total_ba;
                    if (share > 0.01) comp[stand.speciesId(i)] = Number(share.toFixed(3));
                }
            }
            return JSON.stringify(comp).replace(/"/g, "'");
        } catch (e) { return "{}"; }
    },

    _getTargetsJson: function(stand_data) {
        try {
            var targets = (stand_data.history && stand_data.history.target_species) ? stand_data.history.target_species : [];
            return JSON.stringify(targets).replace(/"/g, "'");
        } catch (e) { return "[]"; }
    },

    // --- 1. DATA COLLECTION ---

    // Simple Activity Log - lightweight timeline
    log_activity_immediate: function(year, stand_id, agent_id, activity_name) {
        if (!this.isSimpleActivityLogEnabled()) return;

        // Create unique key to prevent duplicates
        var key = year + "_" + stand_id + "_" + activity_name;

        // Only log if not already logged
        if (!this.continuous_activity_set[key]) {
            this.continuous_activity_log.push({
                year: year,
                stand_id: stand_id,
                agent_id: agent_id,
                activity: activity_name
            });
            this.continuous_activity_set[key] = true;
        }
    },

    // ML Training Dataset - log baseline (year 1) for all stands, even without activity
    log_ml_baseline: function(stand_data_obj) {
        if (!this.isMLLogEnabled()) return;

        var year = Globals.year;
        var stand_id = stand_data_obj.stand_id;

        // Create unique key - only log once per stand at year 1
        var key = year + "_" + stand_id + "_baseline";

        if (!this.ml_activity_set[key]) {
            // Extract species composition
            var species_comp = {};
            try {
                var comp = stand_data_obj.get_species_composition();
                if (comp && typeof comp === 'object') {
                    species_comp = comp;
                }
            } catch (e) {
                species_comp = {};
            }

            // Extract structure information
            var structure_data = {};
            try {
                if (stand_data_obj.classified && stand_data_obj.classified.basal_area_by_layer) {
                    structure_data = stand_data_obj.classified.basal_area_by_layer;
                }
            } catch (e) {
                structure_data = {};
            }

            var record = {
                year: year,
                stand_id: stand_id,
                agent_id: stand_data_obj.agent_id,
                activity_name: "none",  // No activity - baseline record
                is_sequence: false,
                sequence_step: "none",
                previous_activity: "none",
                previous_activity_year: -1,
                age_t0: stand_data_obj.iLand_stand_data.absolute_age_iLand || 0,
                volume_t0: stand_data_obj.iLand_stand_data.volume || 0,
                basal_area_t0: stand_data_obj.iLand_stand_data.basal_area || 0,
                height_dominant_t0: stand_data_obj.iLand_stand_data.top_height || 0,
                stems_t0: stand_data_obj.iLand_stand_data.stems || 0,
                structure_class_t0: stand_data_obj.classified.structure_class || 'unknown',
                age_class_t0: stand_data_obj.classified.age_class || 'unknown',
                activity_class_t0: stand_data_obj.classified.activity_class || 'unknown',
                species_profile: stand_data_obj.species_profile || 'none',
                target_species: JSON.stringify([]),
                species_composition_t0: JSON.stringify(species_comp),
                structure_detail_t0: JSON.stringify(structure_data),
                parameters: JSON.stringify({})
            };

            this.ml_activity_log.push(record);
            this.ml_activity_set[key] = true;
        }
    },

    // ML Training Dataset - rich pre-activity state capture
    log_ml_activity: function(stand_data_obj) {
        if (!this.isMLLogEnabled()) return;

        var year = Globals.year;
        var stand_id = stand_data_obj.stand_id;
        var activity_name = stand_data_obj.activity.chosen_Activity;

        // Get sequence information
        var is_sequence = stand_data_obj.activity.is_Sequence || false;
        var sequence_step = 'none';
        // FIX: Use sequence_current_step (not sequence_step which doesn't exist)
        if (is_sequence && stand_data_obj.activity.sequence_current_step !== undefined) {
            sequence_step = stand_data_obj.activity.sequence_current_step.toString();
        }

        // Create unique key to prevent duplicates
        var key = year + "_" + stand_id + "_" + activity_name;

        // Only log if not already logged
        if (!this.ml_activity_set[key]) {
            // Extract species composition
            var species_comp = {};
            try {
                var comp = stand_data_obj.get_species_composition();
                if (comp && typeof comp === 'object') {
                    species_comp = comp;
                }
            } catch (e) {
                species_comp = {};
            }

            // Extract structure information
            var structure_data = {};
            try {
                if (stand_data_obj.classified && stand_data_obj.classified.basal_area_by_layer) {
                    structure_data = stand_data_obj.classified.basal_area_by_layer;
                }
            } catch (e) {
                structure_data = {};
            }

            // Get species strategy info
            var species_profile = stand_data_obj.species_profile || 'none';
            var target_species = [];
            try {
                if (stand_data_obj.history && stand_data_obj.history.target_species) {
                    target_species = stand_data_obj.history.target_species;
                }
            } catch (e) {
                target_species = [];
            }

            // Get activity class (phase)
            var activity_class = 'unknown';
            try {
                if (stand_data_obj.classified && stand_data_obj.classified.activity_class) {
                    activity_class = stand_data_obj.classified.activity_class;
                }
            } catch (e) {
                activity_class = 'unknown';
            }

            // Build rich activity record
            var record = {
                // Activity context
                year: year,
                stand_id: stand_id,
                agent_id: stand_data_obj.agent_id,
                owner_type: stand_data_obj.owner_type || 'unknown',
                behavioral_type: stand_data_obj.behavioral_type || 'unknown',
                activity_name: activity_name,

                // Sequence tracking (for multi-step activities like thinning sequences)
                is_sequence: is_sequence,
                sequence_step: sequence_step,

                // Previous activity tracking
                previous_activity: stand_data_obj.history.last_activity || 'none',
                previous_activity_year: stand_data_obj.history.last_activity_Year || -1,

                // Pre-activity state (t=0)
                age_t0: stand_data_obj.iLand_stand_data.absolute_age_iLand || 0,
                volume_t0: stand_data_obj.iLand_stand_data.volume || 0,
                basal_area_t0: stand_data_obj.iLand_stand_data.basal_area || 0,
                height_dominant_t0: stand_data_obj.iLand_stand_data.top_height || 0,
                stems_t0: stand_data_obj.iLand_stand_data.stems || 0,

                // Classification
                structure_class_t0: stand_data_obj.classified.structure_class || 'unknown',
                age_class_t0: stand_data_obj.classified.age_class || 'unknown',
                activity_class_t0: activity_class,

                // Species strategy (strategy name and actual target species)
                species_profile: species_profile,
                target_species: JSON.stringify(target_species),

                // Species composition (as JSON string)
                species_composition_t0: JSON.stringify(species_comp),

                // Structure details (as JSON string)
                structure_detail_t0: JSON.stringify(structure_data),

                // Activity parameters (as JSON string)
                parameters: JSON.stringify(stand_data_obj.activity.parameters || {})
            };

            this.ml_activity_log.push(record);
            this.ml_activity_set[key] = true;
        }
    },

    log_harvest: function(agent, stand_data) {
        if (!this.isHarvestLogEnabled()) return;

        try {
            fmengine.standId = stand_data.stand_id;
            if (stand.reload) stand.reload();

            var volume_removed = stand.flag('abe_last_harvest_volume') || 0;
            if (volume_removed <= 0) return;

            var harvest_record = {
                year: Globals.year,
                agent_id: agent.id,
                owner_type: (agent.owner) ? agent.owner.type : "unknown",
                behavioral_type: agent.behavioral_type || "unknown",
                stand_id: stand_data.stand_id,
                activity_name: stand_data.activity.chosen_Activity,
                volume_removed: volume_removed,
                trees_removed: stand.flag('abe_last_harvest_trees') || 0,
                rotation_total_harvest: stand.flag('abe_rotation_total_harvest') || 0,
                volume_before: stand.flag('abe_volume_before_harvest') || (stand.volume + volume_removed),
                volume_after: stand.volume,
                stand_age: stand.age,
                basal_area: stand.basalArea
            };

            this.harvest_log.push(harvest_record);

        } catch (e) {
            console.error(`[Monitoring] Harvest logging failed: ${e.message}`);
        }
    },

    snapshot: function(agent, stand_data) {
        if (!this.isDetailedLogEnabled()) return;
        try {
            fmengine.standId = stand_data.stand_id;

            if (stand.reload) {
                stand.reload();
            } else {
                var _wakeUp = stand.npp;
            }

            if (stand.id !== stand_data.stand_id) {
                return;
            }

            var activity_happened = (stand_data.activity.target_year === Globals.year);
            if (!activity_happened && !stand_data.is_monitoring_candidate) return;

            var d = stand_data.iLand_stand_data;

            // Read harvest values for THIS YEAR ONLY (yearly, not cumulative)
            var volume_removed_this_year = stand.flag('abe_last_harvest_volume') || 0;
            var trees_removed_this_year = stand.flag('abe_last_harvest_trees') || 0;
            var harvest_year = stand.flag('abe_last_harvest_year') || 0;

            // Only count harvest if it happened THIS year (prevents double-counting)
            if (harvest_year !== Globals.year) {
                volume_removed_this_year = 0;
                trees_removed_this_year = 0;
            }

            // Disturbance/salvage tracking
            var disturbance_year = stand.flag('abe_disturbance_year') || -1;
            var disturbance_severity = stand.flag('abe_disturbance_severity') || 0;
            var disturbance_volume = stand.flag('abe_disturbance_volume') || 0;
            var salvage_type = stand.flag('abe_param_salvage_type') || 'none';
            var salvage_fraction = stand.flag('abe_param_salvage_fraction') || 0;

            // Dead wood volumes from perception data
            var deadwood_snags = d.deadwood_volume_snags || 0;
            var deadwood_dwd = d.deadwood_volume_dwd || 0;

            var record = {
                year: Globals.year,
                agent_id: agent.id,
                owner_type: (agent.owner) ? agent.owner.type : "unknown",
                behavioral_type: agent.behavioral_type || "unknown",
                stand_id: stand_data.stand_id,
                preference: stand_data.preference_focus,
                strategy: stand_data.species_profile || "none",

                age: stand.age,
                absolute_age: stand.absoluteAge,
                soco_age: d.absolute_age_soco,

                volume: stand.volume,
                basal_area: stand.basalArea,
                height: stand.height,

                // Yearly values (not cumulative) - only this year's harvest
                volume_removed: volume_removed_this_year,
                trees_removed: trees_removed_this_year,
                rotation_total_harvest: stand.flag('abe_rotation_total_harvest') || 0,

                // Disturbance/salvage tracking
                disturbance_year: disturbance_year,
                disturbance_severity: disturbance_severity,
                disturbance_volume: disturbance_volume,
                salvage_type: salvage_type,
                salvage_fraction: salvage_fraction,

                // Dead wood tracking
                deadwood_volume_snags: deadwood_snags,
                deadwood_volume_dwd: deadwood_dwd,

                species_composition: this._getSpeciesJson(),
                target_species: this._getTargetsJson(stand_data),

                activity_name: stand_data.activity.chosen_Activity,
                is_active: activity_happened ? 1 : 0,

                age_class: stand_data.classified.age_class || "N/A",
                activity_class: stand_data.classified.activity_class || "N/A",
                structure_class: stand_data.classified.structure_class || "N/A"
            };

            if (stand_data.is_monitoring_candidate) stand_data.detailed_history.push(record);

        } catch (e) { console.error(`[Monitoring] Snapshot failed: ${e.message}`); }
    },

    // --- 2. LANDSCAPE AGGREGATION ---
    record_aggregate: function(institution, year) {
        if (!this.isAggregatedLogEnabled()) return;
        if (year % this.getAggInterval() !== 0) return;

        var stand_owner_map = {};
        var agents = institution.all_agents;
        for (var i = 0; i < agents.length; i++) {
            var ag = agents[i];
            var o = ag.owner.type;
            for (var j = 0; j < ag.managed_stand_ids.length; j++) {
                stand_owner_map[ag.managed_stand_ids[j]] = o;
            }
        }

        var sums = {};
        var all_ids = fmengine.standIds;

        for (var i = 0; i < all_ids.length; i++) {
            var sid = all_ids[i];
            var owner = stand_owner_map[sid];

            if (owner) {
                if (!sums[owner]) sums[owner] = { total_ba: 0, species: {} };

                fmengine.standId = sid;
                if (stand.id > 0) {
                    if (stand.reload) stand.reload();
                    var ba = stand.basalArea;
                    if (ba > 0) {
                        sums[owner].total_ba += ba;
                        for (var k = 0; k < stand.nspecies; k++) {
                            var sp = stand.speciesId(k);
                            var sp_ba = stand.speciesBasalArea(k);
                            if (!sums[owner].species[sp]) sums[owner].species[sp] = 0;
                            sums[owner].species[sp] += sp_ba;
                        }
                    }
                }
            }
        }

        for (var owner in sums) {
            var data = sums[owner];
            var comp = {};
            if (data.total_ba > 0) {
                for (var sp in data.species) {
                    var share = data.species[sp] / data.total_ba;
                    if (share > 0.001) comp[sp] = Number(share.toFixed(4));
                }
            }
            this.aggregated_history.push({
                year: year,
                owner_type: owner,
                total_ba: data.total_ba,
                species_json: JSON.stringify(comp).replace(/"/g, '""')
            });
        }
    },

    // --- 3. EXPORT FUNCTIONS ---

    save_detailed_csv: function(all_agents, filename) {
        console.log(`--- Monitoring: Saving Detailed Log ---`);
        this._write_csv(all_agents, filename, "detailed_history");
    },

    save_activity_csv: function(all_agents, filename) {
        console.log(`--- Monitoring: Saving Activity Log (Simplified) ---`);
        this._write_csv(all_agents, filename, "activity_history");
    },

    save_aggregated_csv: function(filename) {
        console.log(`--- Monitoring: Saving Aggregated Log ---`);
        var header = "year,owner_type,total_ba,species_composition";
        var lines = [header];
        for (var i = 0; i < this.aggregated_history.length; i++) {
            var r = this.aggregated_history[i];
            var line = `${r.year},${r.owner_type},${r.total_ba.toFixed(2)},"${r.species_json}"`;
            lines.push(line);
        }
        Globals.saveTextFile(filename, lines.join("\n"));
    },

    save_harvest_csv: function(filename) {
        console.log(`--- Monitoring: Saving Harvest-Only Log ---`);
        var header = "year,agent_id,owner_type,stand_id,activity_name," +
            "volume_removed,trees_removed,rotation_total_harvest," +
            "volume_before,volume_after,stand_age,basal_area";

        var lines = [header];

        for (var i = 0; i < this.harvest_log.length; i++) {
            var r = this.harvest_log[i];
            var line = `${r.year},${r.agent_id},${r.owner_type},${r.stand_id},${r.activity_name},` +
                `${this._safeFixed(r.volume_removed, 2)},` +
                `${this._safeFixed(r.trees_removed, 0)},` +
                `${this._safeFixed(r.rotation_total_harvest, 2)},` +
                `${this._safeFixed(r.volume_before, 2)},` +
                `${this._safeFixed(r.volume_after, 2)},` +
                `${this._safeFixed(r.stand_age, 1)},` +
                `${this._safeFixed(r.basal_area, 2)}`;
            lines.push(line);
        }

        Globals.saveTextFile(filename, lines.join("\n"));
    },

    // NEW: Save continuous activity log (logged immediately when flags are read)
    save_continuous_activity_csv: function(filename) {
        console.log(`--- Monitoring: Saving Continuous Activity Log ---`);
        var header = "year,stand_id,agent_id,activity";
        var lines = [header];

        for (var i = 0; i < this.continuous_activity_log.length; i++) {
            var r = this.continuous_activity_log[i];
            var line = `${r.year},${r.stand_id},${r.agent_id},${r.activity}`;
            lines.push(line);
        }

        Globals.saveTextFile(filename, lines.join("\n"));
        console.log(`      -> Saved ${this.continuous_activity_log.length} records to ${filename}.`);
    },

    // Save ML training dataset (rich activity records with pre-activity state)
    save_ml_activity_csv: function(filename) {
        console.log(`--- Monitoring: Saving ML Activity Dataset ---`);
        if (!this.ml_activity_log || this.ml_activity_log.length === 0) {
            console.warn(`    No ML activity records to save.`);
            // Still save the header so the file exists
        }

        var header = "year,stand_id,agent_id,owner_type,behavioral_type,activity_name," +
            "is_sequence,sequence_step," +
            "previous_activity,previous_activity_year," +
            "age_t0,volume_t0,basal_area_t0,height_dominant_t0,stems_t0," +
            "structure_class_t0,age_class_t0,activity_class_t0," +
            "species_profile,target_species," +
            "species_composition_t0,structure_detail_t0,parameters";
        var lines = [header];

        for (var i = 0; i < this.ml_activity_log.length; i++) {
            var r = this.ml_activity_log[i];
            var line = `${r.year},${r.stand_id},${r.agent_id},${r.owner_type || 'unknown'},${r.behavioral_type || 'unknown'},${r.activity_name},` +
                `${r.is_sequence},${r.sequence_step},` +
                `${r.previous_activity},${r.previous_activity_year},` +
                `${this._safeFixed(r.age_t0, 1)},` +
                `${this._safeFixed(r.volume_t0, 2)},` +
                `${this._safeFixed(r.basal_area_t0, 2)},` +
                `${this._safeFixed(r.height_dominant_t0, 2)},` +
                `${this._safeFixed(r.stems_t0, 0)},` +
                `${r.structure_class_t0},${r.age_class_t0},${r.activity_class_t0},` +
                `${r.species_profile},"${r.target_species}",` +
                `"${r.species_composition_t0}","${r.structure_detail_t0}","${r.parameters}"`;
            lines.push(line);
        }

        try {
            Globals.saveTextFile(filename, lines.join("\n"));
            console.log(`      -> Saved ${this.ml_activity_log.length} ML records to ${filename}.`);
        } catch (e) {
            console.error(`    [ERROR] Globals.saveTextFile failed: ${e.message}`);
        }
    },

    /**
     * Log yearly structure classification for all stands
     * Called once per year for each stand to capture structure_class and structure_detail
     * Uses pre-computed basal_area_by_layer from stand_data_obj.classified (computed in compute_derived_data.js)
     * @param {object} stand_data_obj - Stand data object with classified structure
     */
    log_yearly_structure: function(stand_data_obj) {
        if (!this.isYearlyStructureLogEnabled()) return;

        var year = Globals.year;
        var stand_id = stand_data_obj.stand_id;

        // Get structure detail from classified data (already computed in compute_derived_data.js)
        var structure_data = {};
        try {
            if (stand_data_obj.classified && stand_data_obj.classified.basal_area_by_layer) {
                // Use pre-computed values from perception pipeline
                structure_data = stand_data_obj.classified.basal_area_by_layer;
            } else {
                // Fallback: compute directly if not available
                fmengine.standId = stand_id;
                stand.trees.loadAll();

                var dom_h = stand_data_obj.iLand_stand_data.top_height || 0;
                var total_ba = stand.basalArea || 0;

                var ba_lower = 0, ba_middle = 0, ba_upper = 0;
                var limit_low = dom_h * 0.33;
                var limit_high = dom_h * 0.66;

                var count = stand.trees.count;
                for (var i = 0; i < count; i++) {
                    var t = stand.trees.tree(i);
                    var t_ba = t.basalArea;
                    var t_h = t.height;

                    if (t_h < limit_low) ba_lower += t_ba;
                    else if (t_h < limit_high) ba_middle += t_ba;
                    else ba_upper += t_ba;
                }

                structure_data = {
                    ba_lower: ba_lower,
                    ba_middle: ba_middle,
                    ba_upper: ba_upper,
                    share_lower: total_ba > 0 ? (ba_lower / total_ba) : 0,
                    share_middle: total_ba > 0 ? (ba_middle / total_ba) : 0,
                    share_upper: total_ba > 0 ? (ba_upper / total_ba) : 0,
                    dom_height: dom_h,
                    total_ba: total_ba
                };
            }
        } catch (e) {
            // If structure computation fails, log with empty detail
            structure_data = { error: e.message };
        }

        // iLand year offset: SOCO year = iLand year + 1
        // When we record at SOCO year Y, iLand has already processed year Y-1
        var iland_year = year - 1;

        // Get stand_age from iLand_stand_data
        var stand_age = 0;
        if (stand_data_obj.iLand_stand_data) {
            stand_age = stand_data_obj.iLand_stand_data.stand_age || 0;
        }

        this.yearly_structure_log.push({
            year: year,
            iland_year: iland_year,
            stand_id: stand_id,
            stand_age: stand_age,
            structure_class: stand_data_obj.classified ? stand_data_obj.classified.structure_class : 'unknown',
            structure_detail: JSON.stringify(structure_data)
        });
    },

    /**
     * Save yearly structure log to CSV
     * @param {string} filename - Output file path
     */
    save_yearly_structure_csv: function(filename) {
        console.log(`--- Monitoring: Saving Yearly Structure Log ---`);

        if (!this.yearly_structure_log || this.yearly_structure_log.length === 0) {
            console.warn(`    No yearly structure records to save.`);
        }

        // Header includes iland_year for easy joining with iLand output
        var header = "year,iland_year,stand_id,stand_age,structure_class,structure_detail";
        var lines = [header];

        for (var i = 0; i < this.yearly_structure_log.length; i++) {
            var r = this.yearly_structure_log[i];
            var line = `${r.year},${r.iland_year},${r.stand_id},${r.stand_age},${r.structure_class},"${r.structure_detail}"`;
            lines.push(line);
        }

        try {
            Globals.saveTextFile(filename, lines.join("\n"));
            console.log(`      -> Saved ${this.yearly_structure_log.length} yearly structure records to ${filename}.`);
        } catch (e) {
            console.error(`    [ERROR] Globals.saveTextFile failed: ${e.message}`);
        }
    },

    _write_csv: function(all_agents, filename, array_key) {
        try {
            var header = "";

            // Check if we are writing the simplified activity log
            var is_activity_log = (array_key === "activity_history");

            if (is_activity_log) {
                // Simplified Header
                header = "activity_type,stand_id,agent_id,year";
            } else {
                // Detailed Header - includes harvest_year for matching with iLand
                header = "year,harvest_year,agent_id,owner_type,behavioral_type,stand_id,preference,strategy," +
                         "age,absolute_age,soco_age,volume,basal_area,height," +
                         "volume_removed,trees_removed,rotation_total_harvest," +
                         "disturbance_year,disturbance_severity,disturbance_volume,salvage_type,salvage_fraction," +
                         "deadwood_volume_snags,deadwood_volume_dwd," +
                         "species_composition,target_species," +
                         "activity_name,is_active,age_class,activity_class,structure_class";
            }

            var lines = [header];
            var total_records = 0;

            for (var i = 0; i < all_agents.length; i++) {
                var agent = all_agents[i];
                for (var stand_id in agent.managed_stands_data) {
                    var stand_data = agent.managed_stands_data[stand_id];
                    var history_arr = stand_data[array_key];

                    // Access logic for activity history (nested object) vs detailed history (flat array)
                    if (array_key === "activity_history" && history_arr) {
                        history_arr = history_arr.log;
                    }

                    if (history_arr && history_arr.length > 0) {
                        for (var h = 0; h < history_arr.length; h++) {
                            var entry = history_arr[h];
                            var line = "";

                            if (is_activity_log) {
                                // --- SIMPLIFIED OUTPUT ---
                                // entry.activity holds the activity name
                                line = `${entry.activity},${stand_data.stand_id},${agent.id},${entry.year}`;
                            } else {
                                // --- DETAILED OUTPUT ---
                                var r = entry;
                                var sp_json = (r.species_composition || {});
                                if (typeof sp_json === 'object') sp_json = JSON.stringify(sp_json);
                                sp_json = sp_json.replace(/"/g, "'");

                                var tg_json = (r.target_species || []);
                                if (typeof tg_json === 'object') tg_json = JSON.stringify(tg_json);
                                tg_json = tg_json.replace(/"/g, "'");

                                // harvest_year = year - 1 for matching iLand timing
                                // iLand records harvest in year N, but effects visible in year N+1
                                // SOCO logs harvest in year it happens, so we provide harvest_year for matching
                                var harvest_year = (r.volume_removed > 0) ? (r.year - 1) : r.year;

                                line = `${r.year},${harvest_year},${r.agent_id},${r.owner_type},${r.behavioral_type || 'unknown'},${r.stand_id},${r.preference},${r.strategy},` +
                                       `${this._safeFixed(r.age, 1)},` +
                                       `${this._safeFixed(r.absolute_age, 1)},` +
                                       `${this._safeFixed(r.soco_age, 1)},` +
                                       `${this._safeFixed(r.volume, 2)},` +
                                       `${this._safeFixed(r.basal_area, 2)},` +
                                       `${this._safeFixed(r.height, 2)},` +
                                       `${this._safeFixed(r.volume_removed, 2)},` +
                                       `${this._safeFixed(r.trees_removed, 0)},` +
                                       `${this._safeFixed(r.rotation_total_harvest, 2)},` +
                                       `${r.disturbance_year || -1},` +
                                       `${this._safeFixed(r.disturbance_severity, 3)},` +
                                       `${this._safeFixed(r.disturbance_volume, 2)},` +
                                       `${r.salvage_type || 'none'},` +
                                       `${this._safeFixed(r.salvage_fraction, 2)},` +
                                       `${this._safeFixed(r.deadwood_volume_snags, 2)},` +
                                       `${this._safeFixed(r.deadwood_volume_dwd, 2)},` +
                                       `"${sp_json}","${tg_json}",` +
                                       `${r.activity_name},${r.is_active},` +
                                       `${r.age_class},${r.activity_class},${r.structure_class}`;
                            }

                            lines.push(line);
                            total_records++;
                        }
                    }
                }
            }
            Globals.saveTextFile(filename, lines.join("\n"));
            console.log(`      -> Saved ${total_records} records to ${filename}.`);
        } catch (e) {
            console.error(`[Monitoring] Error saving CSV ${filename}: ${e.message}`);
        }
    }
};

this.Monitoring = Monitoring;

// ----- End of File: soco_src/utils/monitoring.js -----