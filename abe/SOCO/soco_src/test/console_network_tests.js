/**
 * =================================================================================
 * Console Network Testing Functions
 * =================================================================================
 * Run these from the iLand console (View -> Javascript Console) during simulation
 * to verify that networks are influencing agent decisions
 * =================================================================================
 */

var NetworkTests = {

    /**
     * TEST 1: Verify networks are loaded
     * Usage: NetworkTests.test_networks_loaded()
     */
    test_networks_loaded: function() {
        console.log("\n=== TEST 1: Network Loading Status ===\n");

        if (!socoabe || !socoabe.institution) {
            console.error("✗ SoCoABE not initialized");
            return false;
        }

        const all_agents = socoabe.institution.all_agents;
        console.log(`✓ Found ${all_agents.length} agents`);

        // Check geographical networks
        let geo_count = 0;
        let geo_size_sum = 0;
        let geo_empty = 0;

        all_agents.forEach(agent => {
            if (agent.geo_network && agent.geo_network.length > 0) {
                geo_count++;
                geo_size_sum += agent.geo_network.length;
            } else {
                geo_empty++;
            }
        });

        console.log("\nGeographical Networks:");
        console.log(`  Agents with geo neighbors: ${geo_count}/${all_agents.length}`);
        console.log(`  Average geo network size: ${(geo_size_sum / geo_count).toFixed(1)} neighbors`);
        if (geo_empty > 0) {
            console.warn(`  ⚠ ${geo_empty} agents have no geo neighbors (isolated)`);
        }

        // Check similarity networks
        let sim_count = 0;
        let sim_size_sum = 0;
        let sim_empty = 0;

        all_agents.forEach(agent => {
            if (agent.similarity_network && agent.similarity_network.length > 0) {
                sim_count++;
                sim_size_sum += agent.similarity_network.length;
            } else {
                sim_empty++;
            }
        });

        console.log("\nSimilarity Networks:");
        console.log(`  Agents with similarity neighbors: ${sim_count}/${all_agents.length}`);
        console.log(`  Average similarity network size: ${(sim_size_sum / sim_count).toFixed(1)} neighbors`);
        if (sim_empty > 0) {
            console.warn(`  ⚠ ${sim_empty} agents have no similarity neighbors`);
        }

        // Check config
        console.log("\nSocial Learning Config:");
        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.SOCIAL_LEARNING) {
            const sl = SoCoABE_CONFIG.SOCIAL_LEARNING;
            console.log(`  Enabled: ${sl.ENABLED}`);
            console.log(`  Network Type: ${sl.NETWORK_TYPE}`);
            console.log(`  Activity Learning: ${sl.ACTIVITY_LEARNING.enabled} (rate=${sl.ACTIVITY_LEARNING.learning_rate})`);
            console.log(`  Parameter Learning: ${sl.PARAMETER_LEARNING.enabled} (noise=${sl.PARAMETER_LEARNING.noise_factor})`);

            if (!sl.ENABLED) {
                console.warn("\n⚠ WARNING: Social learning is DISABLED in config!");
                console.warn("   Networks are loaded but not used for decision-making.");
            }
        } else {
            console.error("✗ Social learning config not found");
        }

        console.log("\n=== TEST 1 Complete ===\n");
        return (geo_count > 0 || sim_count > 0);
    },

    /**
     * TEST 2: Check activity history logging
     * Usage: NetworkTests.test_activity_history()
     */
    test_activity_history: function() {
        console.log("\n=== TEST 2: Activity History Status ===\n");

        if (!socoabe || !socoabe.institution) {
            console.error("✗ SoCoABE not initialized");
            return false;
        }

        const all_agents = socoabe.institution.all_agents;
        let stands_with_history = 0;
        let total_stands = 0;
        let total_activities_logged = 0;

        all_agents.forEach(agent => {
            for (const stand_id in agent.managed_stands_data) {
                total_stands++;
                const stand = agent.managed_stands_data[stand_id];

                if (stand.activity_history && stand.activity_history.log && stand.activity_history.log.length > 0) {
                    stands_with_history++;
                    total_activities_logged += stand.activity_history.log.length;
                }
            }
        });

        console.log(`Total stands: ${total_stands}`);
        console.log(`Stands with activity history: ${stands_with_history} (${(stands_with_history/total_stands*100).toFixed(1)}%)`);
        console.log(`Total activities logged: ${total_activities_logged}`);

        if (stands_with_history > 0) {
            console.log(`Average activities per stand: ${(total_activities_logged/stands_with_history).toFixed(2)}`);
        }

        if (stands_with_history === 0) {
            console.warn("\n⚠ WARNING: No activity history found!");
            console.warn("   This could mean:");
            console.warn("   1. Simulation just started (no activities yet)");
            console.warn("   2. Activity history logging is broken");
            console.warn("   Solution: Run simulation for 5+ years and re-test");
        }

        console.log("\n=== TEST 2 Complete ===\n");
        return stands_with_history > 0;
    },

    /**
     * TEST 3: Watch network influence in real-time
     * Usage: NetworkTests.watch_network_influence('small_agent_1', 123456)
     *
     * @param {string} agent_id - Agent to watch
     * @param {number} stand_id - Stand to watch
     */
    watch_network_influence: function(agent_id, stand_id) {
        console.log(`\n=== TEST 3: Real-Time Network Influence ===`);
        console.log(`Agent: ${agent_id}, Stand: ${stand_id}\n`);

        const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);
        if (!agent) {
            console.error(`✗ Agent ${agent_id} not found`);
            return;
        }

        const stand_data = agent.managed_stands_data[stand_id];
        if (!stand_data) {
            console.error(`✗ Stand ${stand_id} not found for agent ${agent_id}`);
            return;
        }

        // Check network configuration
        const network_type = (SoCoABE_CONFIG && SoCoABE_CONFIG.SOCIAL_LEARNING)
            ? SoCoABE_CONFIG.SOCIAL_LEARNING.NETWORK_TYPE
            : 'none';

        console.log(`Network Type: ${network_type}`);

        // Get neighbors
        const neighbors = agent.get_network_neighbors(network_type);
        console.log(`Number of neighbors: ${neighbors.length}`);

        if (neighbors.length === 0) {
            console.warn("⚠ Agent has no neighbors - social learning cannot occur");
            return;
        }

        // Screen neighbor activities
        const time_window = (SoCoABE_CONFIG && SoCoABE_CONFIG.SOCIAL_LEARNING)
            ? SoCoABE_CONFIG.SOCIAL_LEARNING.ACTIVITY_LEARNING.time_window
            : 10;

        const observed_activities = NetworkModule.screen_neighbor_activities(
            agent,
            stand_data,
            network_type,
            time_window
        );

        console.log(`\nObserved neighbor activities (last ${time_window} years): ${observed_activities.length}`);

        if (observed_activities.length === 0) {
            console.log("  → No relevant neighbor activities found");
            console.log("  → This could mean:");
            console.log("     - Neighbors haven't acted on similar stands yet");
            console.log("     - Time window is too short");
            console.log("     - Stand context is unique");
        } else {
            console.log("\n  Neighbor Activities:");

            // Aggregate by activity type
            const activity_counts = {};
            observed_activities.forEach(obs => {
                activity_counts[obs.activity] = (activity_counts[obs.activity] || 0) + 1;
            });

            for (const activity in activity_counts) {
                console.log(`    - ${activity}: observed ${activity_counts[activity]} times`);
            }

            // Show most recent
            const most_recent = observed_activities.sort((a, b) => a.years_ago - b.years_ago)[0];
            console.log(`\n  Most recent observation:`);
            console.log(`    Neighbor: ${most_recent.neighbor_id} (${most_recent.neighbor_owner_type})`);
            console.log(`    Activity: ${most_recent.activity}`);
            console.log(`    Years ago: ${most_recent.years_ago}`);
        }

        // Show stand context
        console.log(`\nFocal Stand Context:`);
        console.log(`  Age class: ${stand_data.classified.age_class}`);
        console.log(`  Structure: ${stand_data.classified.structure_class}`);
        console.log(`  Preference: ${stand_data.preference_focus}`);

        console.log(`\n=== TEST 3 Complete ===\n`);
    },

    /**
     * TEST 4: Compare activity selection WITH vs WITHOUT network influence
     * Usage: NetworkTests.test_activity_selection_influence('small_agent_1', 123456)
     *
     * Temporarily disables/enables network to show difference
     *
     * @param {string} agent_id - Agent to test
     * @param {number} stand_id - Stand to test
     */
    test_activity_selection_influence: function(agent_id, stand_id) {
        console.log(`\n=== TEST 4: Activity Selection Influence ===\n`);

        const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);
        if (!agent) {
            console.error(`✗ Agent ${agent_id} not found`);
            return;
        }

        const stand_data = agent.managed_stands_data[stand_id];
        if (!stand_data) {
            console.error(`✗ Stand ${stand_id} not found`);
            return;
        }

        // Save original config
        const original_enabled = SoCoABE_CONFIG.SOCIAL_LEARNING.ENABLED;

        console.log("Running 100 simulations of activity selection...\n");

        // WITHOUT network influence
        SoCoABE_CONFIG.SOCIAL_LEARNING.ENABLED = false;
        const without_network = {};
        for (let i = 0; i < 100; i++) {
            const result = Cognition.select_activity(helpers.deepCopy(stand_data), agent);
            const activity = result.activity.chosen_Activity;
            without_network[activity] = (without_network[activity] || 0) + 1;
        }

        // WITH network influence
        SoCoABE_CONFIG.SOCIAL_LEARNING.ENABLED = true;
        const with_network = {};
        for (let i = 0; i < 100; i++) {
            const result = Cognition.select_activity(helpers.deepCopy(stand_data), agent);
            const activity = result.activity.chosen_Activity;
            with_network[activity] = (with_network[activity] || 0) + 1;
        }

        // Restore original config
        SoCoABE_CONFIG.SOCIAL_LEARNING.ENABLED = original_enabled;

        // Display results
        console.log("WITHOUT Network Influence:");
        for (const activity in without_network) {
            console.log(`  ${activity}: ${without_network[activity]}% chance`);
        }

        console.log("\nWITH Network Influence:");
        for (const activity in with_network) {
            console.log(`  ${activity}: ${with_network[activity]}% chance`);
        }

        // Compute difference
        console.log("\nDifference (WITH - WITHOUT):");
        const all_activities = new Set([...Object.keys(without_network), ...Object.keys(with_network)]);
        let max_change = 0;
        let changed_activity = null;

        all_activities.forEach(activity => {
            const without_val = without_network[activity] || 0;
            const with_val = with_network[activity] || 0;
            const change = with_val - without_val;

            if (Math.abs(change) > Math.abs(max_change)) {
                max_change = change;
                changed_activity = activity;
            }

            if (Math.abs(change) > 2) {  // Only show meaningful changes
                const arrow = change > 0 ? "↑" : "↓";
                console.log(`  ${activity}: ${change > 0 ? '+' : ''}${change}% ${arrow}`);
            }
        });

        if (Math.abs(max_change) < 2) {
            console.warn("\n⚠ WARNING: Network has minimal influence on this stand!");
            console.warn("   This could mean:");
            console.warn("   1. No neighbors have relevant history");
            console.warn("   2. Learning rate is too low");
            console.warn("   3. Stand context is unique");
        } else {
            console.log(`\n✓ Network influence detected: ${changed_activity} probability changed by ${max_change}%`);
        }

        console.log(`\n=== TEST 4 Complete ===\n`);
    },

    /**
     * TEST 5: Parameter learning test
     * Usage: NetworkTests.test_parameter_learning('small_agent_1', 'selectiveThinning')
     */
    test_parameter_learning: function(agent_id, activity_name) {
        console.log(`\n=== TEST 5: Parameter Learning ===\n`);

        const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);
        if (!agent) {
            console.error(`✗ Agent ${agent_id} not found`);
            return;
        }

        // Get a stand for context
        const stand_id = agent.managed_stand_ids[0];
        const stand_data = agent.managed_stands_data[stand_id];

        // Sample parameters WITHOUT learning
        const original_enabled = SoCoABE_CONFIG.SOCIAL_LEARNING.ENABLED;
        SoCoABE_CONFIG.SOCIAL_LEARNING.ENABLED = false;

        stand_data.activity.chosen_Activity = activity_name;
        const without_learning_samples = [];
        for (let i = 0; i < 20; i++) {
            const result = Cognition.select_parameters(helpers.deepCopy(stand_data), agent);
            without_learning_samples.push(result.activity.parameters);
        }

        // Sample parameters WITH learning
        SoCoABE_CONFIG.SOCIAL_LEARNING.ENABLED = true;

        const with_learning_samples = [];
        for (let i = 0; i < 20; i++) {
            const result = Cognition.select_parameters(helpers.deepCopy(stand_data), agent);
            with_learning_samples.push(result.activity.parameters);
        }

        // Restore original config
        SoCoABE_CONFIG.SOCIAL_LEARNING.ENABLED = original_enabled;

        // Compare distributions
        console.log(`Activity: ${activity_name}`);
        console.log(`\nParameter distributions (20 samples):\n`);

        const param_keys = Object.keys(without_learning_samples[0]);

        param_keys.forEach(key => {
            const without_values = without_learning_samples.map(p => p[key]).filter(v => typeof v === 'number');
            const with_values = with_learning_samples.map(p => p[key]).filter(v => typeof v === 'number');

            if (without_values.length === 0) return;  // Skip non-numeric params

            const mean_without = without_values.reduce((a, b) => a + b, 0) / without_values.length;
            const mean_with = with_values.reduce((a, b) => a + b, 0) / with_values.length;

            const sd_without = Math.sqrt(without_values.reduce((sum, v) => sum + Math.pow(v - mean_without, 2), 0) / without_values.length);
            const sd_with = Math.sqrt(with_values.reduce((sum, v) => sum + Math.pow(v - mean_with, 2), 0) / with_values.length);

            console.log(`${key}:`);
            console.log(`  WITHOUT learning: ${mean_without.toFixed(2)} ± ${sd_without.toFixed(2)}`);
            console.log(`  WITH learning:    ${mean_with.toFixed(2)} ± ${sd_with.toFixed(2)}`);

            const mean_diff = mean_with - mean_without;
            const sd_diff = sd_with - sd_without;

            if (Math.abs(mean_diff) > 0.1 * mean_without) {
                console.log(`  → Mean shifted by ${mean_diff.toFixed(2)} (${(mean_diff/mean_without*100).toFixed(1)}%)`);
            }
            if (Math.abs(sd_diff) > 0.1 * sd_without) {
                const direction = sd_diff < 0 ? "decreased" : "increased";
                console.log(`  → Variability ${direction} by ${Math.abs(sd_diff).toFixed(2)}`);
            }
        });

        console.log(`\n=== TEST 5 Complete ===\n`);
    },

    /**
     * RUN ALL TESTS
     * Usage: NetworkTests.run_all()
     */
    run_all: function() {
        console.log("\n" + "=".repeat(80));
        console.log("RUNNING ALL NETWORK TESTS");
        console.log("=".repeat(80) + "\n");

        const test1 = this.test_networks_loaded();
        const test2 = this.test_activity_history();

        console.log("\n" + "=".repeat(80));
        console.log("SUMMARY");
        console.log("=".repeat(80));
        console.log(`Test 1 (Networks Loaded): ${test1 ? '✓ PASS' : '✗ FAIL'}`);
        console.log(`Test 2 (Activity History): ${test2 ? '✓ PASS' : '✗ FAIL'}`);

        if (test1 && test2) {
            console.log("\n✓ All basic tests passed!");
            console.log("\nTo test actual influence, pick an agent and stand:");
            console.log("  NetworkTests.watch_network_influence('agent_id', stand_id)");
            console.log("  NetworkTests.test_activity_selection_influence('agent_id', stand_id)");
        } else {
            console.log("\n✗ Some tests failed. Check warnings above.");
        }

        console.log("\n" + "=".repeat(80) + "\n");
    }
};

// Export to global scope
this.NetworkTests = NetworkTests;

// Auto-run on load (can comment out if unwanted)
console.log("\n=== Network Testing Functions Loaded ===");
console.log("Usage:");
console.log("  NetworkTests.run_all()              - Run all automated tests");
console.log("  NetworkTests.test_networks_loaded() - Check if networks exist");
console.log("  NetworkTests.test_activity_history() - Check if history is logging");
console.log("  NetworkTests.watch_network_influence('agent_id', stand_id) - Watch real-time");
console.log("  NetworkTests.test_activity_selection_influence('agent_id', stand_id) - Compare WITH/WITHOUT");
console.log("  NetworkTests.test_parameter_learning('agent_id', 'activity_name') - Test param convergence");
console.log("\nRecommended: Run NetworkTests.run_all() first\n");
