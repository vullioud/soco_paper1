
var SoCo_Inspector = {

    _safeStringify: function(obj) {
        const cache = new Set();
        return JSON.stringify(obj, function(key, value) {
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) return '[Circular Reference]';
                cache.add(value);
                if (key === 'owner' && value.type) return `[Owner Object: type='${value.type}']`;
                if (key === 'institution') return '[Institution Object]';
            }
            return value;
        }, 2);
    },

   run_initialization_summary_report: function() {
        if (typeof socoabe === 'undefined' || !socoabe.initialized) {
            console.error("ERROR: SoCoABE model is not initialized.");
            return;
        }
        console.log("\n--- SoCoABE Post-Initialization Agent & Stand Report ---");
        console.log("--- AGENT TRAITS ---");
        // Add planning_offset to the header
        console.log("agent_id,owner_type,planning_offset,preferences,resources,risk_tolerance");
        socoabe.institution.all_agents.forEach(agent => {
            const prefs_string = JSON.stringify(agent.preferences);
            // Add agent.planning_offset to the output
            console.log(`${agent.id},${agent.owner.type},${agent.planning_offset},"${prefs_string}",${agent.resources.toFixed(3)},${agent.risk_tolerance.toFixed(3)}`);
        });

        console.log("\n--- STAND INITIALIZATION ---");
        console.log("agent_id,stand_id,preference_focus");
        socoabe.institution.all_agents.forEach(agent => {
            for (const stand_id in agent.managed_stands_data) {
                const stand_data = agent.managed_stands_data[stand_id];
                console.log(`${stand_data.agent_id},${stand_data.stand_id},${stand_data.preference_focus}`);
            }
        });
        console.log("--- End of Report ---");
    },

    run_detailed_agent_report: function() {
        if (typeof socoabe === 'undefined' || !socoabe.initialized) {
            console.error("ERROR: SoCoABE model is not initialized.");
            return;
        }
        console.log("\n--- SoCoABE Detailed Agent Inspection Report ---");
        for (const owner_type in socoabe.institution.owners) {
            const owner = socoabe.institution.owners[owner_type];
            if (owner.agent_list && owner.agent_list.length > 0) {
                const first_agent = owner.agent_list[0];
                console.log(`\n--- Inspecting First Agent of Owner Type: '${owner_type}' (Agent ID: ${first_agent.id}) ---`);
                console.log(this._safeStringify(first_agent));
            }
        }
        console.log("\n--- End of Detailed Report ---");
    },

    log_stand_data_section: function(agent, stand_id, subObjectKey, label) {
        const stand_data_obj = agent.managed_stands_data[stand_id];
        if (!stand_data_obj) {
            console.error(`[INSPECTOR] Stand ID ${stand_id} not found for agent ${agent.id}.`);
            return;
        }

        const object_to_log = stand_data_obj[subObjectKey];
        if (typeof object_to_log === 'undefined') {
            console.error(`[INSPECTOR] Sub-object key "${subObjectKey}" not found in stand_data.`);
            return;
        }

        console.log(`\n--- ${label} for Stand ${stand_id} ---`);
        console.log(this._safeStringify(object_to_log));
        console.log(`--- End Log ---`);
    },
};

this.SoCo_Inspector = SoCo_Inspector;
// ----- End of File: soco_src/test/soco_inspector.js -----