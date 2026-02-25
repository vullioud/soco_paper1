class institution {
    constructor(all_configs) {
        this.owners = {};
        this.all_agents = [];
        this.configs = all_configs;

        // Policy state — accessed by agents via owner.institution
        this.guideline = SoCoABE_CONFIG.GUIDELINE || {};
        this.es_demand = SoCoABE_CONFIG.ES_DEMAND || {};
        this.guideline_period = (SoCoABE_CONFIG.GUIDELINE && SoCoABE_CONFIG.GUIDELINE.period) || 0;

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

        for (const owner_type in owner_agent_stand_map) {
            const agent_stand_map = owner_agent_stand_map[owner_type];
            const new_owner = new owner(this, owner_type, agent_stand_map, this.configs);
            this.owners[owner_type] = new_owner;
            this.all_agents.push(...new_owner.agent_list);
        }
    }
}
this.institution = institution;

