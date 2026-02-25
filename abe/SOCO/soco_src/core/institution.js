class institution {
    constructor(all_configs) {
        this.owners = {};
        this.all_agents = [];
        this.configs = all_configs;
        console.log("Institution created. Discovering landscape...");
        this.discover_and_create();
    }

    discover_and_create() {

        const owner_agent_stand_map = {};

        fmengine.standIds.forEach(id => {
            fmengine.standId = id;
            if (stand && stand.agent) {
                const agent_name = stand.agent.name;
                const owner_type = stand.flag('owner_type');

                if (!owner_type) {
                    console.warn(`Stand ${id} is managed by agent '${agent_name}' but is missing the 'owner_type' flag. It will be ignored by the cognitive layer.`);
                    return;
                }

                if (!owner_agent_stand_map[owner_type]) {
                    owner_agent_stand_map[owner_type] = {};
                }
                if (!owner_agent_stand_map[owner_type][agent_name]) {
                    owner_agent_stand_map[owner_type][agent_name] = [];
                }
                owner_agent_stand_map[owner_type][agent_name].push(id);
            }
        });

        console.log("--- Creating SoCoABE Agents per Owner ---");
        for (const owner_type in owner_agent_stand_map) {
            const agent_stand_map = owner_agent_stand_map[owner_type];
            
            const new_owner = new owner(this, owner_type, agent_stand_map, this.configs);
            
            this.owners[owner_type] = new_owner;
            this.all_agents.push(...new_owner.agent_list);
            console.log(`  -> Owner '${owner_type}': created ${new_owner.agent_list.length} agents.`);
        }
        console.log(`Institution discovered ${Object.keys(this.owners).length} owner types, created ${this.all_agents.length} total agents.`);
    }
}
this.institution = institution;

