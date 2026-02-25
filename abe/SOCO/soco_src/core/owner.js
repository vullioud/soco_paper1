// FILE: soco_src/core/owner.js
// Paper 1: Tables keyed by behavioral_type instead of owner_type for traits.
// Activity, species_config still keyed by owner_type (until Block 3).

class owner {
    constructor(institution, owner_type, agent_stand_map, all_configs) {
        this.institution = institution;
        this.type = owner_type;
        this.agent_list = [];

        // Store all configs so agents can pick by behavioral_type
        this.all_trait_tables = all_configs.traits;
        this.activity_table = all_configs.activities[this.type];
        this.species_config_table = all_configs.species_config[this.type];

        // Universal tables
        this.age_class_table = all_configs.age_class['all'];
        this.parameter_table = all_configs.parameters['all'];
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
