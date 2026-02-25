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

        // Static ecosystem service demand (post-processing only in Paper 1)
        ES_DEMAND: { Production: 0.4, Biodiversity: 0.3, CO2: 0.3 },

        // Behavioral types (Paper 1 - Sotirov)
        BEHAVIORAL_TYPES: ["MF", "OP", "TR", "PA", "EN"],
        SMALL_PRIVATE_SPLIT: { TR: 0.40, PA: 0.30, EN: 0.30 },

        // Institutional guideline (Paper 1: identical to MF own_ideal)
        GUIDELINE: {
            period: { start: 0, end: 999 },
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

        // Species strategies: condition-dependent thinning weights
        // All values MUST be [0,1]. iLand C++ clamps speciesSelectivity to [0,1].
        // Species > 0.5 get tending protection. Paper 1 simplification: same weights
        // for tending, thinning, and shelterwood. Paper 2 will split into separate tables.
        THINNING_WEIGHTS: {
            MF: {  // Multifunctional: diverse, broadleaf-leaning
                conifer_dominated:   { piab: 0.5, psme: 0.7, fasy: 1.0, qupe: 0.9, abal: 0.8, rest: 0.6 },
                broadleaf_dominated: { fasy: 0.8, qupe: 0.8, abal: 1.0, piab: 0.7, rest: 0.5 },
                mixed:               { rest: 1.0 },
                pioneer:             { bepe: 0.2, potr: 0.2, rest: 0.5 }
            },
            OP: {  // Optimiser/Production: conifer-focused
                conifer_dominated:   { piab: 1.0, psme: 0.9, lade: 0.7, fasy: 0.2, rest: 0.3 },
                broadleaf_dominated: { fasy: 0.8, qupe: 0.9, rest: 0.3 },
                mixed:               { piab: 0.9, psme: 1.0, fasy: 0.7, rest: 0.5 },
                pioneer:             { rest: 0.3 }
            },
            TR: {  // Traditionalist: balanced, slight broadleaf
                conifer_dominated:   { fasy: 0.7, abal: 0.7, rest: 0.6 },
                broadleaf_dominated: { fasy: 0.7, abal: 0.7, rest: 0.6 },
                mixed:               { rest: 0.7 },
                pioneer:             { rest: 0.6 }
            },
            EN: {  // Environmentalist: strongly broadleaf, anti-monoculture conifer
                conifer_dominated:   { piab: 0.3, psme: 0.4, fasy: 1.0, qupe: 1.0, abal: 0.9, rest: 0.6 },
                broadleaf_dominated: { rest: 0.7 },
                mixed:               { rest: 0.7 },
                pioneer:             { rest: 0.7 }
            }
        },

        // Species strategies: planting config
        PLANTING_CONFIG: {
            MF: { n_species: 3, weights: { piab: 0.15, psme: 0.15, fasy: 0.30, qupe: 0.15, abal: 0.25 } },
            OP: { n_species: 1, weights: { piab: 0.45, psme: 0.35, fasy: 0.05, qupe: 0.05, abal: 0.10 } },
            TR: { n_species: 2, weights: { piab: 0.10, fasy: 0.40, qupe: 0.15, abal: 0.35 } },
            PA: null,
            EN: { n_species: 3, weights: { fasy: 0.35, qupe: 0.40, abal: 0.25 } }
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
