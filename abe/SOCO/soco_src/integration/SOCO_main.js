// ----- Start of File: soco_src/integration/SOCO_main.js -----
var socoabe; 

class socoabe_main {
    constructor() {
        this.institution = null;
        this.initialized = false;
    }
    
    initialize() {
        console.log("--- SoCoABE Main: Initializing Cognitive Layer... ---");
        const configs = this.load_all_configs();
        this.institution = new institution(configs);

        // --- Compute Similarity Networks (after agents have been initialized with traits) ---
        const max_network_size = (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MAX_SIMILARITY_NETWORK_SIZE)
                                 ? SoCoABE_CONFIG.MAX_SIMILARITY_NETWORK_SIZE
                                 : 30;

        NetworkModule.compute_similarity_networks(this.institution.all_agents, max_network_size);

        // --- Initialize Fixed STP if enabled ---
        if (typeof SoCoABE_CONFIG !== 'undefined' &&
            SoCoABE_CONFIG.FIXED_STP && SoCoABE_CONFIG.FIXED_STP.ENABLED) {
            console.log("--- SoCoABE Main: Loading Fixed STP Plans ---");
            FixedSTP.initialize(SoCoABE_CONFIG.FIXED_STP.JSON_PATH);
        }

        // --- FIX: Use Configured Sample Size ---
        const sample_size = (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING)
                            ? SoCoABE_CONFIG.MONITORING.sample_size
                            : 10;

        this.select_monitoring_stands(sample_size);
        this.initialized = true;
        console.log(`--- SoCoABE Main: Initialization Complete. Monitoring ${sample_size} stands. ---`);
    }

    load_all_configs() {
         // ... (Same as previous) ...
         const configs = {
            traits:             JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/traits/agent_traits.json'))),
            activities:         JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/activities/activity_distributions.json'))),
            age_class:          JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/age_class/age_class_lookup.json'))),
            parameters:         JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/params/parameter_distributions.json'))),
            plenter_profiles:   JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/profiles/plenter_profiles.json'))),
            targetDBH_profiles: JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/profiles/targetDBH_profiles.json'))),
            species_config:     JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/species/species_config.json'))),
        };

         // Try to load agent networks (optional - may not exist)
         try {
             let network_scenario = 'medium';  // Default fallback

             // AUTOMATIC DETECTION: Extract scenario from CSV filename
             if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.csv_path) {
                 const csv_filename = SoCoABE_CONFIG.csv_path.split('/').pop().toLowerCase();

                 // Match clustering scenarios (Random, Low, Medium, High)
                 if (csv_filename.includes('random')) network_scenario = 'random';
                 else if (csv_filename.includes('low')) network_scenario = 'low';
                 else if (csv_filename.includes('medium')) network_scenario = 'medium';
                 else if (csv_filename.includes('high')) network_scenario = 'high';

                 // Match owner-only scenarios
                 else if (csv_filename.includes('small_only')) network_scenario = 'small_only';
                 else if (csv_filename.includes('big_only')) network_scenario = 'big_only';
                 else if (csv_filename.includes('state_only')) network_scenario = 'state_only';
             }

             // Allow manual override via config
             if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.NETWORK_SCENARIO) {
                 network_scenario = SoCoABE_CONFIG.NETWORK_SCENARIO;
                 console.log('Using manually specified network scenario:', network_scenario);
             }

             const network_path = `./abe/SOCO/config/tables/networks/agent_networks_${network_scenario}.json`;
             configs.agent_networks = JSON.parse(Globals.loadTextFile(Globals.path(network_path)));
             console.log(`✓ Loaded agent networks from scenario: ${network_scenario} (auto-detected from CSV grid)`);
         } catch (e) {
             console.warn('Agent networks not found or failed to load. Agents will have empty networks.');
             console.warn('Error:', e.message);
             configs.agent_networks = {};
         }

         return configs;
    }

    select_monitoring_stands(count) {
        let all_stands = [];
        this.institution.all_agents.forEach(agent => {
            for (let stand_id in agent.managed_stands_data) {
                all_stands.push(agent.managed_stands_data[stand_id]);
            }
        });
        for (let i = all_stands.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all_stands[i], all_stands[j]] = [all_stands[j], all_stands[i]];
        }
        let selected = all_stands.slice(0, count);
        selected.forEach(sd => sd.is_monitoring_candidate = true);
    }

   update(current_year) {
        if (!this.initialized) return;
        
        // 1. Run Agent Logic
        this.institution.all_agents.forEach(agent => {
            agent.run_yearly_cycle(current_year);
        });
        
        // 2. Record Landscape State (In Memory)
        Monitoring.record_aggregate(this.institution, current_year);
    }

    finalize() {
        if (!this.initialized) {
            console.log("--- SoCoABE Main: finalize() called but not initialized, skipping ---");
            return;
        }
        console.log("--- SoCoABE Main: Finalizing and Saving Logs ---");

        // Get output prefix from XML user settings (overridable via command line)
        var prefix = "";
        try {
            prefix = Globals.setting('user.output_prefix') || "";
        } catch (e) {
            // Fallback to config if XML setting not available
            prefix = (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.OUTPUT_PREFIX)
                     ? SoCoABE_CONFIG.OUTPUT_PREFIX : "";
        }
        if (prefix) {
            console.log(`    Using output prefix: ${prefix}`);
        }

        // Save logs based on configuration switches
        // Get custom file names from config (with defaults)
        var fileNames = SoCoABE_CONFIG.MONITORING.OUTPUT_FILES || {};
        var fn_ml = fileNames.ML_ACTIVITY || "soco_ml_activities";
        var fn_activity = fileNames.SIMPLE_ACTIVITY || "soco_log_activities";
        var fn_harvest = fileNames.HARVEST || "soco_log_harvest";
        var fn_detailed = fileNames.DETAILED_STANDS || "soco_log_detailed_stands";
        var fn_agg = fileNames.AGGREGATED || "soco_log_aggregated_species";

        // 1. ML Training Dataset (primary output)
        console.log(`    [DEBUG] ML Log enabled: ${Monitoring.isMLLogEnabled()}`);
        console.log(`    [DEBUG] ML Log record count: ${Monitoring.ml_activity_log ? Monitoring.ml_activity_log.length : 'undefined'}`);
        if (Monitoring.isMLLogEnabled()) {
            var path_ml = Globals.path("output/" + prefix + fn_ml + ".csv");
            console.log(`    [DEBUG] Saving ML log to: ${path_ml}`);
            try {
                Monitoring.save_ml_activity_csv(path_ml);
                console.log(`    [DEBUG] ML log save completed`);
            } catch (e) {
                console.error(`    [ERROR] ML log save failed: ${e.message}`);
            }
        } else {
            console.log("    [DEBUG] ML Log is DISABLED - skipping save");
        }

        // 2. Simple Activity Log (optional - redundant if ML log is on)
        if (Monitoring.isSimpleActivityLogEnabled()) {
            var path_activity = Globals.path("output/" + prefix + fn_activity + ".csv");
            Monitoring.save_continuous_activity_csv(path_activity);
        }

        // 3. Harvest Log (optional)
        if (Monitoring.isHarvestLogEnabled()) {
            var path_harvest = Globals.path("output/" + prefix + fn_harvest + ".csv");
            Monitoring.save_harvest_csv(path_harvest);
        }

        // 4. Detailed Stand Log (debug only)
        if (Monitoring.isDetailedLogEnabled()) {
            var path_detailed = Globals.path("output/" + prefix + fn_detailed + ".csv");
            Monitoring.save_detailed_csv(this.institution.all_agents, path_detailed);
        }

        // 5. Aggregated Species Log (optional)
        if (Monitoring.isAggregatedLogEnabled()) {
            var path_agg = Globals.path("output/" + prefix + fn_agg + ".csv");
            Monitoring.save_aggregated_csv(path_agg);
        }

        // 6. Yearly Structure Log (optional)
        if (Monitoring.isYearlyStructureLogEnabled()) {
            var fn_structure = fileNames.YEARLY_STRUCTURE || "soco_yearly_structure";
            var path_structure = Globals.path("output/" + prefix + fn_structure + ".csv");
            Monitoring.save_yearly_structure_csv(path_structure);
        }

        console.log("--- SoCoABE Main: Finalize Complete ---");
    }
}
this.socoabe_main = socoabe_main;

