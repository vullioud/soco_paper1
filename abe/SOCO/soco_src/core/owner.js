// FILE: soco_src/core/owner.js
// Paper 1: Tables keyed by behavioral_type for traits and activities.

class owner {
    constructor(institution, owner_type, agent_stand_map, all_configs) {
        this.institution = institution;
        this.type = owner_type;
        this.agent_list = [];

        // Store all configs so agents can pick by behavioral_type
        this.all_trait_tables = all_configs.traits;
        this.all_activity_tables = all_configs.activities;

        // Universal tables (parameters now keyed by activity → behavioral_type)
        this.all_parameter_tables = all_configs.parameters;
        this.plenter_profiles_table = all_configs.plenter_profiles['all'];
        this.targetDBH_profiles_table = all_configs.targetDBH_profiles['all'];

        // Create agents
        for (const agent_name in agent_stand_map) {
            const stand_ids = agent_stand_map[agent_name];
            const new_agent = new socoabe_agent(agent_name, this, stand_ids);
            this.agent_list.push(new_agent);
        }
    }
}
this.owner = owner;
