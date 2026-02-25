/**
 * SoCoABE Central Configuration File
 * This file assembles the final configuration object from the globally
 * available variables that were loaded by `Globals.include` in the main script.
 */

// const { act } = require("react");

if (typeof SoCoABE_CONFIG === 'undefined') {
    var SoCoABE_CONFIG = {
        csv_path: "./abe/stand_files/agent_table_high_shuffled-false.csv", // Default path, can be overridden in the main script
        core_abe_agent_type: 'socoabe_controller',
        warmupPeriod: 0,

        // ═══ WARMING PERIOD ═══
        // Warming period: Activities ARE performed but NOT recorded
        // Use this to stabilize forest initialization (e.g., clearcut young stands, replant, let grow)
        // After warming ends, a baseline snapshot is recorded and normal simulation begins
        WARMING: {
            ENABLED: false,
            DURATION: 10,  // Years to run before "real" recording starts
            // After warming ends:
            // - Baseline data is logged for all stands
            // - Normal monitoring/recording begins
        },

        // ═══ CONSOLE LOGGING ═══
        // Control verbose console output (can slow down simulation significantly)
        SOCO_LOG: {
            ENABLED: false,           // Master switch for SOCO console.log output
            ENABLED_DURING_WARMING: false,  // Log during warming period (usually false)
            LOG_ACTIVITIES: false,    // Log activity execution in mega_STP
            LOG_AGENT_CYCLES: false,  // Log agent yearly cycles
            LOG_NETWORK: false,       // Log network operations
            LOG_DECISIONS: false,     // Log decision-making
        },

        // ═══ BARK BEETLE OUTBREAK SCENARIO ═══
        // Configure artificial bark beetle outbreaks at specific simulation years
        // The module must also be enabled in the project XML (modules.barkbeetle.enabled = true)
        BARK_BEETLE: {
            ENABLED: true,                          // Master switch for outbreak triggering
            OUTBREAK_YEARS: [15, 30],               // Simulation years to spike infestation
            OUTBREAK_PROBABILITY: 0.05,             // Background infestation prob during outbreak years (high)
            BASELINE_PROBABILITY: 0.000685,         // Normal background prob (matches XML default)
            LOG_ENABLED: true                       // Log outbreak events to console
        },

        // Run simulation without any SOCO agent interventions (no activities)
        // Set to true to let iLand run naturally without management
        // Useful for: baseline comparisons, testing init data, observing natural dynamics
        NO_INTERVENTION: false,

        // ═══ FIXED STP MODE ═══
        // Fixed Stand Treatment Plan: Predefined management schedules from JSON
        // Bypasses agent cognition - activities execute at specified years
        // Useful for: controlled experiments, data collection with known conditions
        FIXED_STP: {
            ENABLED: false,
            JSON_PATH: "./abe/fixed_STP/scenario_2b_thinning_with_tending_schedule.json",
        },

        // Output file prefix for batch runs (e.g., "run_001_young_small_")
        // Files will be: output/{prefix}soco_ml_activities.csv
        OUTPUT_PREFIX: "",  // Empty = default filenames

        // Network configuration
        // Specifies which clustering scenario network to load (random, low, medium, high)
        // Must match the filename: agent_networks_{scenario}.json
        NETWORK_SCENARIO: 'medium',

        // Maximum similarity network size (at resource = 1.0)
        // Agent with resource = 0.5 will have 15 neighbors if MAX = 30
        MAX_SIMILARITY_NETWORK_SIZE: 30,

        // Social Learning Configuration
        SOCIAL_LEARNING: {
            // Enable/disable social learning entirely
            ENABLED: false,  // Set to true to activate social learning

            // Which network type to use for social learning
            // Options: 'geo' (geographical), 'similarity' (preference-based), or 'both'
            NETWORK_TYPE: 'similarity',

            // Activity-level social learning
            ACTIVITY_LEARNING: {
                enabled: false,           // Learn which activities neighbors chose
                learning_rate: 0.5,      // Weight of neighbor observations (0.0-1.0)
                time_window: 4          // How many years back to look
            },

            // Parameter-level social learning
            PARAMETER_LEARNING: {
                enabled: true,           // Learn parameter values from neighbors
                noise_factor: 0.1,       // Add noise to keep variability (0.0-1.0)
                time_window: 4          // How many years back to look
            }
        },

        MONITORING: {

            // ═══ MASTER SWITCH ═══
            ENABLED: true,  // Set to false to disable ALL logging

            // ═══ OUTPUT FILE NAMES ═══
            // Customize output file names for each run
            // Set to empty string "" to use default names
            // Files are saved to: output/{filename}.csv
            OUTPUT_FILES: {
                ML_ACTIVITY: "soco_ml_activities_for_bin_full_sim2",           // Default: soco_ml_activities.csv
                SIMPLE_ACTIVITY: "soco_log_activities",      // Default: soco_log_activities.csv
                HARVEST: "soco_log_harvest",                 // Default: soco_log_harvest.csv
                DETAILED_STANDS: "soco_log_detailed_stands", // Default: soco_log_detailed_stands.csv
                AGGREGATED: "soco_log_aggregated_species",   // Default: soco_log_aggregated_species.csv
                YEARLY_STRUCTURE: "soco_yearly_structure2"    // Default: soco_yearly_structure.csv
            },

            // ═══ ESSENTIAL LOGS (Recommended: Always ON) ═══

            // ML Training Dataset - Rich pre-activity state capture
            // Includes: structure, species, parameters, previous activity, sequence step
            ML_ACTIVITY_LOG: true,

            // ═══ OPTIONAL LOGS (For specific analyses) ═══

            // Simple Activity Timeline - Just year/stand/agent/activity
            // Note: Redundant if ML_ACTIVITY_LOG is on (ML log contains same info + more)
            SIMPLE_ACTIVITY_LOG: false,

            // Harvest Details - Volume removed, trees removed per activity
            // Note: Data already in ML log + iLand abeStandRemoval table
            HARVEST_LOG: false,

            // ═══ DEBUG LOGS (For development only) ═══

            // Detailed Stand Log - Full time series for sampled stands
            // WARNING: Resource intensive! Only enable for debugging
            DETAILED_STAND_LOG: false,
            DETAILED_LOG_SAMPLE_SIZE: 10,  // Number of stands to monitor (if enabled)

            // Aggregated Species - Landscape-level by owner type
            AGGREGATED_LOG: false,

            // Yearly Structure Log - Records structure_class and structure_detail for all stands each year
            // Links to iLand output (year = iLand year + 1 due to timing)
            YEARLY_STRUCTURE_LOG: true
        },

        TESTING: {
            // active_scenario: "inspect_classification_step"  //     
            // active_scenario: "inspect_raw_data_step"  // 
            // active_scenario: "inspect_history_step"
            // active_scenario: 'none'  
            // active_scenario: "inspect_check_need_step"
            // active_scenario: "inspect_planning_trigger"
            // active_scenario: "inspect_initialization"
            // active_scenario: "inspect_full_initialization_flow"  
            //  active_scenario: "snapshot_stand_data"
            // active_scenario: 'inspect_sequence_progression'
            // activiy_scenario: 'inspect_signal_trigger_targetDBH'
            //  active_scenario: "inspect_selectiveThinning_flags"
            //  active_scenario: "inspect_selectiveThinning_execution"  
            // active_scenario: "verify_mark_and_remove"
            // active_scenario: 'verify_phased_removal'
            //   active_scenario: 'verify_thinningFromBelow_sequence'
            // active_scenario: 'inspect_harvest_volume'
            active_scenario: "verify_barkbeetle_salvage"

        }
    };
}
this.SoCoABE_CONFIG = SoCoABE_CONFIG;