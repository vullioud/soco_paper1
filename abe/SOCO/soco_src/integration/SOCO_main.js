// FILE: soco_src/integration/SOCO_main.js
// Paper 1 version: Removed NetworkModule, FixedSTP, debug logs.
var socoabe;

class socoabe_main {
    constructor() {
        this.institution = null;
        this.initialized = false;
    }

    initialize() {
        var configs = this.load_all_configs();
        this.institution = new institution(configs);

        var sample_size = (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING)
                            ? SoCoABE_CONFIG.MONITORING.sample_size
                            : 10;

        this.select_monitoring_stands(sample_size);
        this.initialized = true;
    }

    load_all_configs() {
         const configs = {
            traits:             JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/traits/agent_traits.json'))),
            activities:         JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/activities/activity_distributions.json'))),
            parameters:         JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/params/parameter_distributions.json'))),
            plenter_profiles:   JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/profiles/plenter_profiles.json'))),
            targetDBH_profiles: JSON.parse(Globals.loadTextFile(Globals.path('./abe/SOCO/config/tables/profiles/targetDBH_profiles.json'))),
        };

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

        // Run Agent Logic
        this.institution.all_agents.forEach(agent => {
            agent.run_yearly_cycle(current_year);
        });

        // Record Landscape State
        Monitoring.record_aggregate(this.institution, current_year);
    }

    finalize() {
        if (!this.initialized) return;

        var prefix = "";
        try {
            prefix = Globals.setting('user.output_prefix') || "";
        } catch (e) {
            prefix = (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.OUTPUT_PREFIX)
                     ? SoCoABE_CONFIG.OUTPUT_PREFIX : "";
        }



        var fileNames = SoCoABE_CONFIG.MONITORING.OUTPUT_FILES || {};
        var fn_ml = fileNames.ML_ACTIVITY || "soco_ml_activities";
        var fn_activity = fileNames.SIMPLE_ACTIVITY || "soco_log_activities";
        var fn_harvest = fileNames.HARVEST || "soco_log_harvest";
        var fn_detailed = fileNames.DETAILED_STANDS || "soco_log_detailed_stands";
        var fn_agg = fileNames.AGGREGATED || "soco_log_aggregated_species";

        // 1. ML Training Dataset
        if (Monitoring.isMLLogEnabled()) {
            var path_ml = Globals.path("output/" + prefix + fn_ml + ".csv");
            try {
                Monitoring.save_ml_activity_csv(path_ml);
            } catch (e) {
                console.error(`    [ERROR] ML log save failed: ${e.message}`);
            }
        }

        // 2. Simple Activity Log
        if (Monitoring.isSimpleActivityLogEnabled()) {
            var path_activity = Globals.path("output/" + prefix + fn_activity + ".csv");
            Monitoring.save_continuous_activity_csv(path_activity);
        }

        // 3. Harvest Log
        if (Monitoring.isHarvestLogEnabled()) {
            var path_harvest = Globals.path("output/" + prefix + fn_harvest + ".csv");
            Monitoring.save_harvest_csv(path_harvest);
        }

        // 4. Detailed Stand Log
        if (Monitoring.isDetailedLogEnabled()) {
            var path_detailed = Globals.path("output/" + prefix + fn_detailed + ".csv");
            Monitoring.save_detailed_csv(this.institution.all_agents, path_detailed);
        }

        // 5. Aggregated Species Log
        if (Monitoring.isAggregatedLogEnabled()) {
            var path_agg = Globals.path("output/" + prefix + fn_agg + ".csv");
            Monitoring.save_aggregated_csv(path_agg);
        }

        // 6. Yearly Structure Log
        if (Monitoring.isYearlyStructureLogEnabled()) {
            var fn_structure = fileNames.YEARLY_STRUCTURE || "soco_yearly_structure";
            var path_structure = Globals.path("output/" + prefix + fn_structure + ".csv");
            Monitoring.save_yearly_structure_csv(path_structure);
        }

    }
}
this.socoabe_main = socoabe_main;
