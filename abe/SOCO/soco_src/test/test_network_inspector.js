/**
 * Network Inspector - Quick testing utility for agent networks
 *
 * Usage in iLand console:
 *   inspect_agent_network('big_agent_1')
 *   inspect_agent_network('small_agent_5', 'similarity')
 *   inspect_all_networks()
 */

var NetworkInspector = {

    /**
     * Inspect a specific agent's network
     * @param {string} agent_id - The agent ID to inspect
     * @param {string} network_type - 'geo' or 'similarity'
     */
    inspect_agent: function(agent_id, network_type = 'geo') {
        if (!socoabe || !socoabe.institution) {
            console.error('SoCoABE not initialized. Run the simulation first.');
            return;
        }

        const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);

        if (!agent) {
            console.error(`Agent '${agent_id}' not found.`);
            console.log('Available agents:', socoabe.institution.all_agents.map(a => a.id).join(', '));
            return;
        }

        console.log('='.repeat(80));
        console.log(`NETWORK INSPECTOR - Agent: ${agent_id}`);
        console.log('='.repeat(80));

        // Basic agent info
        console.log('\n--- Agent Info ---');
        console.log(`  Owner Type: ${agent.owner.type}`);
        console.log(`  Managed Stands: ${agent.managed_stand_ids.length}`);
        console.log(`  Resources: ${agent.resources.toFixed(3)}`);
        console.log(`  Preferences:`, agent.preferences);

        // Network info
        console.log(`\n--- ${network_type === 'geo' ? 'Geographical' : 'Similarity'} Network ---`);
        const network = network_type === 'geo' ? agent.geo_network : agent.similarity_network;
        console.log(`  Network Size: ${network.length} neighbors`);

        if (network.length === 0) {
            console.log('  (No neighbors in this network)');
            return;
        }

        console.log(`  Neighbor IDs: [${network.join(', ')}]`);

        // Get neighbor details
        const neighbors = agent.get_network_neighbors(network_type);

        console.log('\n--- Neighbor Details ---');
        neighbors.forEach((neighbor, idx) => {
            console.log(`  ${idx + 1}. ${neighbor.id}`);
            console.log(`     Owner Type: ${neighbor.owner.type}`);
            console.log(`     Stands: ${neighbor.managed_stand_ids.length}`);
            console.log(`     Resources: ${neighbor.resources.toFixed(3)}`);
            console.log(`     Preferences: Production=${neighbor.preferences.Production.toFixed(2)}, ` +
                       `Biodiversity=${neighbor.preferences.Biodiversity.toFixed(2)}, ` +
                       `CO2=${neighbor.preferences.CO2.toFixed(2)}`);
        });

        // Network summary
        const summary = agent.get_network_summary(network_type);
        console.log('\n--- Network Summary ---');
        console.log(`  Average Neighbor Resources: ${summary.avg_resources ? summary.avg_resources.toFixed(3) : 'N/A'}`);
        console.log(`  Most Common Preference: ${summary.common_preferences || 'N/A'}`);

        console.log('='.repeat(80));
    },

    /**
     * Get summary statistics for all agents' networks
     */
    inspect_all: function(network_type = 'geo') {
        if (!socoabe || !socoabe.institution) {
            console.error('SoCoABE not initialized. Run the simulation first.');
            return;
        }

        const all_agents = socoabe.institution.all_agents;

        console.log('='.repeat(80));
        console.log(`ALL AGENTS NETWORK SUMMARY (${network_type === 'geo' ? 'Geographical' : 'Similarity'})`);
        console.log('='.repeat(80));

        const network_sizes = all_agents.map(a => {
            const net = network_type === 'geo' ? a.geo_network : a.similarity_network;
            return net.length;
        });

        // Overall statistics
        const total_agents = all_agents.length;
        const agents_with_networks = network_sizes.filter(s => s > 0).length;
        const avg_network_size = network_sizes.reduce((a, b) => a + b, 0) / total_agents;
        const max_network_size = Math.max(...network_sizes);
        const min_network_size = Math.min(...network_sizes);

        console.log('\n--- Global Statistics ---');
        console.log(`  Total Agents: ${total_agents}`);
        console.log(`  Agents with Neighbors: ${agents_with_networks} (${(agents_with_networks/total_agents*100).toFixed(1)}%)`);
        console.log(`  Average Network Size: ${avg_network_size.toFixed(2)} neighbors`);
        console.log(`  Min Network Size: ${min_network_size}`);
        console.log(`  Max Network Size: ${max_network_size}`);

        // By owner type
        console.log('\n--- By Owner Type ---');
        const by_owner = {};
        all_agents.forEach(a => {
            const owner = a.owner.type;
            if (!by_owner[owner]) by_owner[owner] = [];
            const net = network_type === 'geo' ? a.geo_network : a.similarity_network;
            by_owner[owner].push(net.length);
        });

        for (const owner in by_owner) {
            const sizes = by_owner[owner];
            const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
            console.log(`  ${owner}: ${sizes.length} agents, avg ${avg.toFixed(2)} neighbors`);
        }

        // Distribution
        console.log('\n--- Network Size Distribution ---');
        const distribution = {};
        network_sizes.forEach(size => {
            distribution[size] = (distribution[size] || 0) + 1;
        });

        Object.keys(distribution).sort((a, b) => a - b).forEach(size => {
            const count = distribution[size];
            const bar = '█'.repeat(Math.ceil(count / total_agents * 50));
            console.log(`  ${size} neighbors: ${count.toString().padStart(3)} agents ${bar}`);
        });

        // Top 5 most connected agents
        console.log('\n--- Top 5 Most Connected Agents ---');
        const sorted = all_agents
            .map(a => ({
                id: a.id,
                owner: a.owner.type,
                size: network_type === 'geo' ? a.geo_network.length : a.similarity_network.length
            }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 5);

        sorted.forEach((a, idx) => {
            console.log(`  ${idx + 1}. ${a.id} (${a.owner}): ${a.size} neighbors`);
        });

        console.log('='.repeat(80));
    },

    /**
     * Visualize network connections for a specific agent
     */
    visualize_connections: function(agent_id, network_type = 'geo', depth = 1) {
        if (!socoabe || !socoabe.institution) {
            console.error('SoCoABE not initialized.');
            return;
        }

        const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);
        if (!agent) {
            console.error(`Agent '${agent_id}' not found.`);
            return;
        }

        console.log('='.repeat(80));
        console.log(`NETWORK VISUALIZATION - ${agent_id}`);
        console.log('='.repeat(80));

        // Draw the focal agent
        console.log('\n  [FOCAL]');
        console.log(`   └─ ${agent_id} (${agent.owner.type})`);

        // Draw direct neighbors
        const network = network_type === 'geo' ? agent.geo_network : agent.similarity_network;
        if (network.length === 0) {
            console.log('      └─ (no neighbors)');
            return;
        }

        console.log('\n  [NEIGHBORS]');
        network.forEach((neighbor_id, idx) => {
            const is_last = idx === network.length - 1;
            const prefix = is_last ? '   └─' : '   ├─';

            const neighbor = socoabe.institution.all_agents.find(a => a.id === neighbor_id);
            if (neighbor) {
                console.log(`${prefix} ${neighbor_id} (${neighbor.owner.type}, ${neighbor.managed_stand_ids.length} stands)`);

                // If depth > 1, show neighbors of neighbors
                if (depth > 1) {
                    const neighbor_net = network_type === 'geo' ? neighbor.geo_network : neighbor.similarity_network;
                    const mutual = neighbor_net.filter(nid => nid === agent_id);
                    const other = neighbor_net.filter(nid => nid !== agent_id).slice(0, 3);

                    if (mutual.length > 0) {
                        const sub_prefix = is_last ? '      ' : '   │  ';
                        console.log(`${sub_prefix}  └─ ↔ mutual connection`);
                    }
                    if (other.length > 0) {
                        const sub_prefix = is_last ? '      ' : '   │  ';
                        console.log(`${sub_prefix}  └─ also connected to: ${other.join(', ')}...`);
                    }
                }
            }
        });

        console.log('='.repeat(80));
    }
};

// Global convenience functions
function inspect_agent_network(agent_id, network_type = 'geo') {
    NetworkInspector.inspect_agent(agent_id, network_type);
}

function inspect_all_networks(network_type = 'geo') {
    NetworkInspector.inspect_all(network_type);
}

function visualize_network(agent_id, network_type = 'geo', depth = 1) {
    NetworkInspector.visualize_connections(agent_id, network_type, depth);
}

// Export
this.NetworkInspector = NetworkInspector;
this.inspect_agent_network = inspect_agent_network;
this.inspect_all_networks = inspect_all_networks;
this.visualize_network = visualize_network;
