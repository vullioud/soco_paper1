/**
 * SoCoABE Central Configuration File
 * Paper 1 version: Removed FixedSTP, NetworkModule, Social Learning, Testing.
 */

if (typeof SoCoABE_CONFIG === 'undefined') {
    var SoCoABE_CONFIG = {
        csv_path: "./abe/stand_files/agent_table_high_shuffled-false.csv",
        core_abe_agent_type: 'socoabe_controller',
        warmupPeriod: 0,

        // Warming period: Activities ARE performed but NOT recorded
        WARMING: {
            ENABLED: false,
            DURATION: 10,
        },

        // Console logging control
        SOCO_LOG: {
            ENABLED: false,
            ENABLED_DURING_WARMING: false,
            LOG_ACTIVITIES: false,
            LOG_AGENT_CYCLES: false,
            LOG_DECISIONS: false,
        },

        // Bark beetle outbreak scenario
        BARK_BEETLE: {
            ENABLED: true,
            OUTBREAK_YEARS: [15, 30],
            OUTBREAK_PROBABILITY: 0.05,
            BASELINE_PROBABILITY: 0.000685,
            LOG_ENABLED: true
        },

        // Behavioral types (Paper 1 - Sotirov)
        BEHAVIORAL_TYPES: ["MF", "OP", "TR", "PA", "EN"],
        SMALL_PRIVATE_SPLIT: { TR: 0.40, PA: 0.30, EN: 0.30 },

        // Institutional guideline (Paper 1: identical to MF own_ideal)
        GUIDELINE: {
            Harvesting: {
                options: ["shelterwood", "targetDBH", "clearcut", "plenter_harvest", "femel", "noManagement"],
                alpha: [4, 3, 0, 3, 5, 0]
            },
            Thinning: {
                options: ["selectiveThinning", "fromBelow", "plenter_thinning", "noManagement"],
                alpha: [5, 3, 2, 0]
            },
            Tending: {
                options: ["tending", "noManagement"],
                alpha: [8, 2]
            },
            Planting: {
                options: ["planting", "noManagement"],
                alpha: [9, 1]
            }
        },

        // Run without agent interventions
        NO_INTERVENTION: false,

        // Output file prefix for batch runs
        OUTPUT_PREFIX: "",

        MONITORING: {
            ENABLED: true,
            sample_size: 10,

            OUTPUT_FILES: {
                ML_ACTIVITY: "soco_ml_activities",
                SIMPLE_ACTIVITY: "soco_log_activities",
                HARVEST: "soco_log_harvest",
                DETAILED_STANDS: "soco_log_detailed_stands",
                AGGREGATED: "soco_log_aggregated_species",
                YEARLY_STRUCTURE: "soco_yearly_structure"
            },

            ML_ACTIVITY_LOG: true,
            SIMPLE_ACTIVITY_LOG: false,
            HARVEST_LOG: false,
            DETAILED_STAND_LOG: false,
            DETAILED_LOG_SAMPLE_SIZE: 10,
            AGGREGATED_LOG: false,
            YEARLY_STRUCTURE_LOG: true
        }
    };
}
this.SoCoABE_CONFIG = SoCoABE_CONFIG;
