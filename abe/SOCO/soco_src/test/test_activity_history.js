/**
 * =================================================================================
 * FILE: soco_src/test/test_activity_history.js
 * =================================================================================
 * DESCRIPTION:
 * Test and inspection functions for stand activity history logging
 * =================================================================================
 */

/**
 * Inspect activity history for a specific stand
 * Shows all logged activities with context
 *
 * @param {string} agent_id - The agent ID
 * @param {number} stand_id - The stand ID
 */
function inspect_stand_history(agent_id, stand_id) {
    const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);

    if (!agent) {
        console.log(`[Activity History] Agent ${agent_id} not found`);
        return;
    }

    const stand = agent.managed_stands_data[stand_id];

    if (!stand) {
        console.log(`[Activity History] Stand ${stand_id} not found for agent ${agent_id}`);
        return;
    }

    console.log(`\n=== Activity History for Stand ${stand_id} (Agent: ${agent_id}) ===`);
    console.log(`Current Year: ${Globals.year}`);
    console.log(`Total Activities Logged: ${stand.activity_history.log.length}`);
    console.log(`Max History Length: ${stand.activity_history.max_length}`);

    if (stand.activity_history.log.length === 0) {
        console.log(`No activities logged yet.`);
        return;
    }

    console.log(`\nActivity Log:`);
    console.log(`-`.repeat(80));

    stand.activity_history.log.forEach((entry, index) => {
        console.log(`\n[${index + 1}] Year ${entry.year} (${Globals.year - entry.year} years ago)`);
        console.log(`  Activity: ${entry.activity}`);
        console.log(`  Parameters: ${JSON.stringify(entry.parameters)}`);
        console.log(`  Context:`);
        console.log(`    - Age Class: ${entry.context.age_class}`);
        console.log(`    - Structure Class: ${entry.context.structure_class}`);
        console.log(`    - Preference Focus: ${entry.context.preference_focus}`);
        console.log(`    - Stand Age: ${entry.context.age} years`);
        console.log(`    - Volume Before: ${entry.context.volume_before.toFixed(2)} m³/ha`);
        console.log(`    - Basal Area Before: ${entry.context.basal_area_before.toFixed(2)} m²/ha`);
        console.log(`    - Species Composition: ${JSON.stringify(entry.context.species_composition)}`);
    });

    console.log(`\n${'='.repeat(80)}\n`);
}

/**
 * Get summary statistics about activity history across all stands
 */
function summarize_activity_history() {
    console.log(`\n=== Activity History Summary (Year ${Globals.year}) ===\n`);

    let total_stands = 0;
    let stands_with_history = 0;
    let total_activities_logged = 0;
    const activity_counts = {};

    socoabe.institution.all_agents.forEach(agent => {
        for (const stand_id in agent.managed_stands_data) {
            total_stands++;
            const stand = agent.managed_stands_data[stand_id];

            if (stand.activity_history && stand.activity_history.log.length > 0) {
                stands_with_history++;
                total_activities_logged += stand.activity_history.log.length;

                // Count activity types
                stand.activity_history.log.forEach(entry => {
                    activity_counts[entry.activity] = (activity_counts[entry.activity] || 0) + 1;
                });
            }
        }
    });

    console.log(`Total Stands: ${total_stands}`);
    console.log(`Stands with History: ${stands_with_history} (${(stands_with_history/total_stands*100).toFixed(1)}%)`);
    console.log(`Total Activities Logged: ${total_activities_logged}`);
    console.log(`Average Activities per Stand: ${(total_activities_logged/stands_with_history).toFixed(2)}`);

    console.log(`\nActivity Type Distribution:`);
    const sorted_activities = Object.entries(activity_counts)
        .sort((a, b) => b[1] - a[1]);

    sorted_activities.forEach(([activity, count]) => {
        const pct = (count / total_activities_logged * 100).toFixed(1);
        console.log(`  ${activity}: ${count} (${pct}%)`);
    });

    console.log(`\n${'='.repeat(80)}\n`);
}

/**
 * Find stands with specific activity in their history
 *
 * @param {string} activity_name - The MegaSTP activity name to search for
 * @param {number} years_back - How many years back to search (optional)
 */
function find_stands_with_activity(activity_name, years_back = null) {
    console.log(`\n=== Stands with Activity: ${activity_name} ===`);
    if (years_back !== null) {
        console.log(`Looking back: ${years_back} years\n`);
    }

    const found_stands = [];

    socoabe.institution.all_agents.forEach(agent => {
        for (const stand_id in agent.managed_stands_data) {
            const stand = agent.managed_stands_data[stand_id];

            if (stand.activity_history && stand.activity_history.log.length > 0) {
                const matching_entries = stand.activity_history.log.filter(entry => {
                    const matches_activity = entry.activity === activity_name;
                    const within_timeframe = years_back === null ||
                                           (Globals.year - entry.year) <= years_back;
                    return matches_activity && within_timeframe;
                });

                if (matching_entries.length > 0) {
                    found_stands.push({
                        agent_id: agent.id,
                        stand_id: stand_id,
                        entries: matching_entries
                    });
                }
            }
        }
    });

    console.log(`Found ${found_stands.length} stands with activity "${activity_name}"\n`);

    found_stands.slice(0, 10).forEach(item => {
        console.log(`Agent: ${item.agent_id}, Stand: ${item.stand_id}`);
        item.entries.forEach(entry => {
            console.log(`  - Year ${entry.year}: ${entry.context.age_class}/${entry.context.structure_class}`);
        });
    });

    if (found_stands.length > 10) {
        console.log(`\n... and ${found_stands.length - 10} more stands`);
    }

    console.log(`\n${'='.repeat(80)}\n`);
}

/**
 * Test social learning screening with activity history
 * Shows what a focal agent can observe from neighbors
 *
 * @param {string} agent_id - The focal agent ID
 * @param {number} stand_id - The focal stand ID
 * @param {string} network_type - 'geo' or 'similarity'
 * @param {number} time_window - Years back to look
 */
function test_social_learning_observation(agent_id, stand_id, network_type = 'similarity', time_window = 10) {
    const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);

    if (!agent) {
        console.log(`[Social Learning Test] Agent ${agent_id} not found`);
        return;
    }

    const stand = agent.managed_stands_data[stand_id];

    if (!stand) {
        console.log(`[Social Learning Test] Stand ${stand_id} not found`);
        return;
    }

    console.log(`\n=== Social Learning Test ===`);
    console.log(`Focal Agent: ${agent_id}`);
    console.log(`Focal Stand: ${stand_id}`);
    console.log(`Network Type: ${network_type}`);
    console.log(`Time Window: ${time_window} years`);
    console.log(`\nFocal Stand Context:`);
    console.log(`  Age Class: ${stand.classified.age_class}`);
    console.log(`  Structure Class: ${stand.classified.structure_class}`);
    console.log(`  Preference Focus: ${stand.preference_focus}`);

    // Get network neighbors
    const neighbors = agent.get_network_neighbors(network_type);
    console.log(`\nNetwork Size: ${neighbors.length} neighbors`);

    // Screen neighbor activities
    const observations = NetworkModule.screen_neighbor_activities(
        agent, stand, network_type, time_window
    );

    console.log(`\nObserved Activities: ${observations.length}`);

    if (observations.length === 0) {
        console.log(`No activities observed from neighbors in similar contexts.`);
        console.log(`\n${'='.repeat(80)}\n`);
        return;
    }

    // Aggregate by activity type
    const activity_summary = {};
    observations.forEach(obs => {
        if (!activity_summary[obs.activity]) {
            activity_summary[obs.activity] = {
                count: 0,
                avg_years_ago: 0,
                neighbors: new Set()
            };
        }
        activity_summary[obs.activity].count++;
        activity_summary[obs.activity].avg_years_ago += obs.years_ago;
        activity_summary[obs.activity].neighbors.add(obs.neighbor_id);
    });

    console.log(`\nActivity Summary:`);
    Object.entries(activity_summary).forEach(([activity, data]) => {
        const avg_years = (data.avg_years_ago / data.count).toFixed(1);
        console.log(`  ${activity}:`);
        console.log(`    - Observations: ${data.count}`);
        console.log(`    - From ${data.neighbors.size} neighbors`);
        console.log(`    - Avg years ago: ${avg_years}`);
    });

    // Show sample observations
    console.log(`\nSample Observations (first 5):`);
    observations.slice(0, 5).forEach((obs, idx) => {
        console.log(`\n[${idx + 1}] ${obs.activity} (${obs.years_ago} years ago)`);
        console.log(`  Neighbor: ${obs.neighbor_id} (${obs.neighbor_owner_type})`);
        console.log(`  Context: ${obs.stand_context.age_class}/${obs.stand_context.structure_class}`);
        console.log(`  Species: ${JSON.stringify(obs.stand_context.species_composition)}`);
    });

    console.log(`\n${'='.repeat(80)}\n`);
}

/**
 * Test parameter-level social learning
 * Shows what parameter values a focal agent would learn from neighbors
 *
 * @param {string} agent_id - The focal agent ID
 * @param {number} stand_id - The focal stand ID
 * @param {string} activity_name - The activity to test
 * @param {string} network_type - 'geo' or 'similarity'
 * @param {number} time_window - Years back to look
 */
function test_parameter_learning(agent_id, stand_id, activity_name, network_type = 'similarity', time_window = 10) {
    const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);

    if (!agent) {
        console.log(`[Parameter Learning Test] Agent ${agent_id} not found`);
        return;
    }

    const stand = agent.managed_stands_data[stand_id];

    if (!stand) {
        console.log(`[Parameter Learning Test] Stand ${stand_id} not found`);
        return;
    }

    console.log(`\n=== Parameter Learning Test ===`);
    console.log(`Focal Agent: ${agent_id}`);
    console.log(`Focal Stand: ${stand_id}`);
    console.log(`Activity: ${activity_name}`);
    console.log(`Network Type: ${network_type}`);
    console.log(`Time Window: ${time_window} years`);

    // Get neighbors
    const neighbors = agent.get_network_neighbors(network_type);
    console.log(`\nNetwork Size: ${neighbors.length} neighbors`);

    // Screen for matching activities
    const observed_activities = NetworkModule.screen_neighbor_activities(
        agent, stand, network_type, time_window
    );

    const matching_activities = observed_activities.filter(obs =>
        obs.activity === activity_name
    );

    console.log(`\nObserved Activities: ${observed_activities.length} total`);
    console.log(`Matching Activity "${activity_name}": ${matching_activities.length} observations`);

    if (matching_activities.length === 0) {
        console.log(`\nNo neighbors used activity "${activity_name}" in similar contexts.`);
        console.log(`Parameter learning would use base distribution only.`);
        console.log(`\n${'='.repeat(80)}\n`);
        return;
    }

    // Extract parameters
    const neighbor_params_list = matching_activities.map(obs => obs.parameters);

    console.log(`\nNeighbor Parameters (sample of first 5):`);
    neighbor_params_list.slice(0, 5).forEach((params, idx) => {
        console.log(`[${idx + 1}] ${JSON.stringify(params)}`);
    });

    // Compute mean parameters
    const base_params = neighbor_params_list[0]; // Use first as template
    const noise_factor = 0.1;

    const learned_params = NetworkModule.compute_mean_parameters(
        neighbor_params_list,
        base_params,
        noise_factor
    );

    console.log(`\nLearned Parameters (mean + noise):`);
    console.log(JSON.stringify(learned_params, null, 2));

    // Show statistics for numeric parameters
    console.log(`\nParameter Statistics:`);
    const param_keys = Object.keys(base_params);

    param_keys.forEach(key => {
        const values = neighbor_params_list
            .map(p => p[key])
            .filter(v => typeof v === 'number');

        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            const std = Math.sqrt(
                values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
            );

            console.log(`  ${key}:`);
            console.log(`    Min: ${min.toFixed(3)}, Max: ${max.toFixed(3)}`);
            console.log(`    Mean: ${mean.toFixed(3)}, Std: ${std.toFixed(3)}`);
            console.log(`    Learned: ${learned_params[key]}`);
        }
    });

    console.log(`\n${'='.repeat(80)}\n`);
}

/**
 * Compare parameters with and without social learning
 * Run multiple samples to see the difference
 */
function compare_parameter_learning(agent_id, stand_id, activity_name, num_samples = 10) {
    const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);

    if (!agent) {
        console.log(`[Compare Test] Agent ${agent_id} not found`);
        return;
    }

    const stand = agent.managed_stands_data[stand_id];

    if (!stand) {
        console.log(`[Compare Test] Stand ${stand_id} not found`);
        return;
    }

    console.log(`\n=== Comparing Parameter Learning (${num_samples} samples) ===`);
    console.log(`Agent: ${agent_id}, Stand: ${stand_id}, Activity: ${activity_name}\n`);

    // Get base parameters (would need to sample from agent's distribution)
    // For this test, we'll use mock base params
    const base_params = { intensity: 0.3, threshold: 15 };

    // Test with social learning
    const social_config = SoCoABE_CONFIG.SOCIAL_LEARNING;
    if (!social_config || !social_config.ENABLED) {
        console.log(`Social learning is disabled in config. Enable to test.`);
        return;
    }

    const learned_params_samples = [];

    for (let i = 0; i < num_samples; i++) {
        const learned = NetworkModule.learn_parameters_from_neighbors(
            agent, stand, activity_name, base_params,
            social_config.NETWORK_TYPE,
            social_config.PARAMETER_LEARNING.time_window,
            social_config.PARAMETER_LEARNING.noise_factor
        );
        learned_params_samples.push(learned);
    }

    console.log(`Base Parameters: ${JSON.stringify(base_params)}\n`);

    console.log(`Learned Parameters (with noise variability):`);
    learned_params_samples.forEach((params, idx) => {
        console.log(`  Sample ${idx + 1}: ${JSON.stringify(params)}`);
    });

    // Compute statistics
    const param_keys = Object.keys(base_params);
    console.log(`\nLearned Parameter Statistics:`);

    param_keys.forEach(key => {
        const values = learned_params_samples
            .map(p => p[key])
            .filter(v => typeof v === 'number');

        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            console.log(`  ${key}: Mean ${mean.toFixed(3)}, Range [${min.toFixed(3)}, ${max.toFixed(3)}]`);
        }
    });

    console.log(`\n${'='.repeat(80)}\n`);
}

// Export functions
this.inspect_stand_history = inspect_stand_history;
this.summarize_activity_history = summarize_activity_history;
this.find_stands_with_activity = find_stands_with_activity;
this.test_social_learning_observation = test_social_learning_observation;
this.test_parameter_learning = test_parameter_learning;
this.compare_parameter_learning = compare_parameter_learning;
