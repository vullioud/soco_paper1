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
        this.initialized = true;
    }

    load_all_configs() {
         var base = './abe/SOCO/config/';
         var configs = {
            traits:             JSON.parse(Globals.loadTextFile(Globals.path(base + 'tables/traits/agent_traits.json'))),
            activities:         JSON.parse(Globals.loadTextFile(Globals.path(base + 'tables/activities/activity_distributions.json'))),
            parameters:         JSON.parse(Globals.loadTextFile(Globals.path(base + 'tables/params/parameter_distributions.json'))),
            plenter_profiles:   JSON.parse(Globals.loadTextFile(Globals.path(base + 'tables/profiles/plenter_profiles.json'))),
            targetDBH_profiles: JSON.parse(Globals.loadTextFile(Globals.path(base + 'tables/profiles/targetDBH_profiles.json'))),
        };

        // Load species strategies from JSON into runtime config
        var species_strategies = JSON.parse(Globals.loadTextFile(Globals.path(base + 'tables/species/species_strategies.json')));
        SoCoABE_CONFIG.THINNING_WEIGHTS = species_strategies.THINNING_WEIGHTS;
        SoCoABE_CONFIG.PLANTING_CONFIG = species_strategies.PLANTING_CONFIG;

         return configs;
    }

   update(current_year) {
        if (!this.initialized) return;

        this.institution.all_agents.forEach(agent => {
            agent.run_yearly_cycle(current_year);
        });
    }

    finalize() {
        if (!this.initialized) return;
        var prefix = "";
        try { prefix = Globals.setting('user.output_prefix') || ""; }
        catch (e) { prefix = SoCoABE_CONFIG.OUTPUT_PREFIX || ""; }
        Monitoring.save_all(prefix);
    }
}
this.socoabe_main = socoabe_main;
