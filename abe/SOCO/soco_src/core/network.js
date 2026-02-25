/**
 * =================================================================================
 * FILE: soco_src/core/network.js
 * =================================================================================
 * DESCRIPTION:
 * Network computation and observation functions for agent social learning.
 * Handles similarity network construction and neighbor activity screening.
 * =================================================================================
 */

var NetworkModule = {

    /**
     * Compute similarity networks for all agents based on preferences
     * Called after agent initialization when all traits have been sampled
     *
     * @param {Array<socoabe_agent>} all_agents - Array of all agents
     * @param {number} max_network_size - Maximum network size at resource = 1.0 (default: 30)
     */
    compute_similarity_networks: function(all_agents, max_network_size = 30) {
        console.log(`[Network] Computing similarity networks for ${all_agents.length} agents...`);
        console.log(`[Network] Max network size: ${max_network_size} (at resource = 1.0)`);

        const network_sizes = [];

        // For each agent, compute similarity to all others
        all_agents.forEach(focal_agent => {
            const focal_prefs = focal_agent.preferences;
            const focal_resources = focal_agent.resources;

            // Calculate network size cap based on resources
            const network_cap = Math.floor(focal_resources * max_network_size);

            if (network_cap === 0) {
                focal_agent.similarity_network = [];
                network_sizes.push(0);
                return;
            }

            // Compute weighted similarity to all other agents
            const similarities = all_agents.map(other_agent => {
                if (focal_agent.id === other_agent.id) {
                    return { agent_id: other_agent.id, similarity: Infinity }; // Exclude self
                }

                const other_prefs = other_agent.preferences;

                // Compute weighted preference difference
                // Dimensions the focal agent cares about more get higher weight
                const weighted_diff = this.compute_weighted_preference_difference(
                    focal_prefs,
                    other_prefs
                );

                return {
                    agent_id: other_agent.id,
                    similarity: weighted_diff
                };
            });

            // Sort by similarity (lower weighted_diff = more similar)
            similarities.sort((a, b) => a.similarity - b.similarity);

            // Select top N most similar agents (up to network_cap)
            const n_neighbors = Math.min(network_cap, all_agents.length - 1);
            const similar_agents = similarities.slice(0, n_neighbors).map(s => s.agent_id);

            focal_agent.similarity_network = similar_agents;
            network_sizes.push(similar_agents.length);
        });

        // Log summary
        const avg_size = network_sizes.reduce((a, b) => a + b, 0) / network_sizes.length;
        const max_size = Math.max(...network_sizes);
        const min_size = Math.min(...network_sizes);

        console.log(`[Network] -> Computed similarity networks`);
        console.log(`[Network] -> Average network size: ${avg_size.toFixed(1)} neighbors`);
        console.log(`[Network] -> Network size range: ${min_size} - ${max_size} neighbors`);

        // Resource correlation check
        const resource_brackets = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.0]];
        console.log(`[Network] -> Network size by resource level:`);

        resource_brackets.forEach(([low, high]) => {
            const agents_in_bracket = all_agents.filter(a =>
                a.resources >= low && a.resources < high
            );
            if (agents_in_bracket.length > 0) {
                const avg_net_size = agents_in_bracket.reduce((sum, a) =>
                    sum + a.similarity_network.length, 0) / agents_in_bracket.length;
                console.log(`[Network]    ${low.toFixed(2)} - ${high.toFixed(2)}: ` +
                           `avg ${avg_net_size.toFixed(1)} neighbors`);
            }
        });
    },

    /**
     * Compute weighted preference difference between two agents
     * Lower value = more similar
     *
     * @param {Object} focal_prefs - Focal agent's preference vector
     * @param {Object} other_prefs - Other agent's preference vector
     * @returns {number} Weighted difference score
     */
    compute_weighted_preference_difference: function(focal_prefs, other_prefs) {
        // Ensure consistent keys
        const keys = ['Production', 'Biodiversity', 'CO2'];

        let weighted_diff = 0;

        keys.forEach(key => {
            const focal_val = focal_prefs[key] || 0;
            const other_val = other_prefs[key] || 0;

            // Absolute difference for this dimension
            const diff = Math.abs(focal_val - other_val);

            // Weight by focal agent's preference (dimensions they care about matter more)
            weighted_diff += diff * focal_val;
        });

        return weighted_diff;
    },

    /**
     * Screen neighbors' recent activities in similar stand contexts
     * Returns activities that neighbors performed on stands similar to the focal stand
     *
     * @param {socoabe_agent} focal_agent - The agent doing the screening
     * @param {stand_data} focal_stand - The stand context to match
     * @param {string} network_type - 'geo' or 'similarity'
     * @param {number} time_window - How many years back to look (default: 10)
     * @returns {Array} List of neighbor activities with context
     */
    screen_neighbor_activities: function(focal_agent, focal_stand, network_type = 'similarity', time_window = 10) {
        const neighbors = focal_agent.get_network_neighbors(network_type);

        if (neighbors.length === 0) {
            return [];
        }

        const current_year = Globals.year;
        const observed_activities = [];

        // Screen each neighbor's stands
        neighbors.forEach(neighbor => {
            for (const stand_id in neighbor.managed_stands_data) {
                const neighbor_stand = neighbor.managed_stands_data[stand_id];

                // Check if this stand is in a similar context to focal stand
                if (this.is_similar_context(focal_stand, neighbor_stand)) {

                    // Check if neighbor has activity history
                    if (neighbor_stand.activity_history && neighbor_stand.activity_history.log) {
                        // Get recent activities from the history log
                        const recent_activities = neighbor_stand.activity_history.get_recent(time_window);

                        // Add each recent activity to observations
                        recent_activities.forEach(entry => {
                            const years_ago = current_year - entry.year;

                            observed_activities.push({
                                neighbor_id: neighbor.id,
                                neighbor_owner_type: neighbor.owner.type,
                                activity: entry.activity,
                                parameters: entry.parameters || {},
                                years_ago: years_ago,
                                stand_context: {
                                    structure_class: entry.context.structure_class,
                                    age_class: entry.context.age_class,
                                    preference_focus: entry.context.preference_focus,
                                    species_composition: entry.context.species_composition
                                }
                            });
                        });
                    }
                }
            }
        });

        return observed_activities;
    },

    /**
     * Check if two stands are in similar context
     * Used to determine if a neighbor's activity is relevant
     *
     * @param {stand_data} focal_stand - The focal stand
     * @param {stand_data} other_stand - The neighbor's stand
     * @returns {boolean} True if contexts are similar
     */
    is_similar_context: function(focal_stand, other_stand) {
        // Similar if same activity class (phase) and similar structure
        const same_phase = focal_stand.classified.age_class === other_stand.classified.age_class;

        // Allow some flexibility in structure (adjacent classes are ok)
        const structure_similarity = this.structure_classes_similar(
            focal_stand.classified.structure_class,
            other_stand.classified.structure_class
        );

        return same_phase && structure_similarity;
    },

    /**
     * Check if two structure classes are similar enough
     */
    structure_classes_similar: function(class1, class2) {
        if (class1 === class2) return true;

        // Allow adjacent classes
        const structure_order = ['low', 'medium', 'high'];
        const idx1 = structure_order.indexOf(class1);
        const idx2 = structure_order.indexOf(class2);

        if (idx1 === -1 || idx2 === -1) return false;

        return Math.abs(idx1 - idx2) <= 1; // Adjacent or same
    },

    /**
     * Aggregate neighbor activities into weighted activity counts
     * Used to incorporate social learning into activity selection
     *
     * @param {Array} observed_activities - Output from screen_neighbor_activities
     * @returns {Object} Activity counts weighted by recency
     */
    aggregate_neighbor_activities: function(observed_activities) {
        const activity_weights = {};

        observed_activities.forEach(obs => {
            const activity = obs.activity;

            // Weight by recency (more recent = higher weight)
            // Simple decay: weight = 1 / (years_ago + 1)
            const weight = 1 / (obs.years_ago + 1);

            if (!activity_weights[activity]) {
                activity_weights[activity] = 0;
            }

            activity_weights[activity] += weight;
        });

        return activity_weights;
    },

    /**
     * Add neighbor observations to Dirichlet weights for activity selection
     * This is the key function for social learning
     *
     * @param {Object} base_weights - Original Dirichlet alpha parameters {options: [...], alpha: [...]}
     * @param {Array} observed_activities - Neighbor activities
     * @param {number} learning_rate - How much weight to give to observations (default: 0.5)
     * @returns {Object} Modified weights incorporating social learning
     */
    incorporate_social_learning: function(base_weights, observed_activities, learning_rate = 0.5) {
        // Start with base weights (from agent's own distribution)
        const modified_weights = helpers.deepCopy(base_weights);

        // CRITICAL FIX: base_weights has structure {options: [...], alpha: [...]}
        // We need to modify the alpha values for matching activities

        if (!modified_weights.options || !modified_weights.alpha) {
            console.warn('[Network] Invalid base_weights structure in incorporate_social_learning');
            return modified_weights;
        }

        // Get aggregated neighbor activity weights
        const neighbor_weights = this.aggregate_neighbor_activities(observed_activities);

        // Add neighbor observations to the alpha values for matching activities
        for (const observed_activity in neighbor_weights) {
            // Map observed activity to base activity (handle sequence variants)
            const base_activity = this.map_to_base_activity(observed_activity);

            // Find index in options array
            const idx = modified_weights.options.indexOf(base_activity);

            if (idx !== -1) {
                // Add learning_rate * neighbor_weight to existing alpha
                modified_weights.alpha[idx] += learning_rate * neighbor_weights[observed_activity];
            }
        }

        return modified_weights;
    },

    /**
     * =========================================================================
     * PARAMETER-LEVEL SOCIAL LEARNING
     * =========================================================================
     */

    /**
     * Learn parameter values from neighbors who used the same activity
     * Takes neighbor values, computes mean, adds noise for variability
     *
     * @param {socoabe_agent} focal_agent - The agent doing the learning
     * @param {stand_data} focal_stand - The stand context
     * @param {string} chosen_activity - The activity that was selected
     * @param {Object} base_params - Original parameters from agent's distribution
     * @param {string} network_type - 'geo' or 'similarity'
     * @param {number} time_window - Years back to look
     * @param {number} noise_factor - How much noise to add (0.0-1.0)
     * @returns {Object} Modified parameters incorporating neighbor observations
     */
    learn_parameters_from_neighbors: function(focal_agent, focal_stand, chosen_activity,
                                              base_params, network_type = 'similarity',
                                              time_window = 10, noise_factor = 0.1) {

        // Screen neighbors for the same activity in similar contexts
        const observed_activities = this.screen_neighbor_activities(
            focal_agent, focal_stand, network_type, time_window
        );

        // Filter for matching activity only (map sequence activities to base names)
        const matching_activities = observed_activities.filter(obs => {
            const base_activity = this.map_to_base_activity(obs.activity);
            return base_activity === chosen_activity;
        });

        if (matching_activities.length === 0) {
            // No neighbors used this activity - use base params
            return base_params;
        }

        // Extract parameters from matching activities
        const neighbor_params_list = matching_activities.map(obs => obs.parameters);

        // Compute mean parameters (with noise)
        const learned_params = this.compute_mean_parameters(
            neighbor_params_list,
            base_params,
            noise_factor
        );

        return learned_params;
    },

    /**
     * Compute mean of neighbor parameters with added noise
     *
     * @param {Array} neighbor_params_list - List of parameter objects from neighbors
     * @param {Object} base_params - Fallback if no neighbor data
     * @param {number} noise_factor - How much noise to add (0.0-1.0)
     * @returns {Object} Mean parameters with noise
     */
    compute_mean_parameters: function(neighbor_params_list, base_params, noise_factor = 0.1) {
        if (neighbor_params_list.length === 0) {
            return base_params;
        }

        const result = {};

        // Get all parameter keys from base_params
        const param_keys = Object.keys(base_params);

        param_keys.forEach(key => {
            // Collect values for this parameter from neighbors
            const values = [];

            neighbor_params_list.forEach(neighbor_params => {
                if (neighbor_params[key] !== undefined && neighbor_params[key] !== null) {
                    values.push(neighbor_params[key]);
                }
            });

            if (values.length === 0) {
                // No neighbor data for this param - use base value
                result[key] = base_params[key];
                return;
            }

            // Check if parameter is numeric
            const first_value = values[0];

            if (typeof first_value === 'number') {
                // Compute mean
                const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

                // Add noise for variability
                const noise_range = Math.abs(mean) * noise_factor;
                const noise = (Math.random() - 0.5) * 2 * noise_range;  // Uniform noise
                let noisy_value = mean + noise;

                // Check if original was integer
                const all_integers = values.every(v => Number.isInteger(v));

                if (all_integers) {
                    // Round to nearest integer
                    result[key] = Math.round(noisy_value);
                } else {
                    // Keep as float
                    result[key] = noisy_value;
                }

            } else if (Array.isArray(first_value)) {
                // For arrays (e.g., species lists), use most common
                result[key] = this.most_common_array(values);

            } else if (typeof first_value === 'string') {
                // For strings, use most common value
                result[key] = this.most_common_value(values);

            } else {
                // Fallback for other types
                result[key] = base_params[key];
            }
        });

        return result;
    },

    /**
     * Find most common value in an array of values
     */
    most_common_value: function(values) {
        const counts = {};
        values.forEach(val => {
            const key = String(val);
            counts[key] = (counts[key] || 0) + 1;
        });

        let max_count = 0;
        let most_common = values[0];

        for (const key in counts) {
            if (counts[key] > max_count) {
                max_count = counts[key];
                most_common = key;
            }
        }

        // Try to return original type
        const original = values.find(v => String(v) === most_common);
        return original !== undefined ? original : most_common;
    },

    /**
     * Find most common array (for species lists, etc.)
     * Compares arrays by stringified version
     */
    most_common_array: function(arrays) {
        const counts = {};
        arrays.forEach(arr => {
            const key = JSON.stringify(arr);
            counts[key] = (counts[key] || 0) + 1;
        });

        let max_count = 0;
        let most_common_key = JSON.stringify(arrays[0]);

        for (const key in counts) {
            if (counts[key] > max_count) {
                max_count = counts[key];
                most_common_key = key;
            }
        }

        return JSON.parse(most_common_key);
    },

    /**
     * Map observed activity names (which may include sequence suffixes) to base activity names
     * Examples:
     *   shelterwood_select -> shelterwood
     *   shelterwood_remove -> shelterwood
     *   shelterwood_final -> shelterwood
     *   clearcut -> clearcut (unchanged)
     *
     * @param {string} observed_activity - Activity name from logs
     * @returns {string} Base activity name for matching in distribution
     */
    map_to_base_activity: function(observed_activity) {
        // Define sequence activity mappings
        const sequence_mappings = {
            // Shelterwood variants
            'shelterwood_select': 'shelterwood',
            'shelterwood_remove': 'shelterwood',
            'shelterwood_final': 'shelterwood',

            // Femel variants
            'femel_select': 'femel',
            'femel_remove': 'femel',
            'femel_final': 'femel',

            // Plenter variants (if any)
            'plenter_harvest': 'plenter_harvest',  // Already base name

            // Add more mappings as needed
        };

        // Check if we have a mapping
        if (sequence_mappings[observed_activity]) {
            return sequence_mappings[observed_activity];
        }

        // If no mapping, return as-is (e.g., clearcut, planting, noManagement)
        return observed_activity;
    }
};

// Export
this.NetworkModule = NetworkModule;

