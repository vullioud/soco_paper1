var Test_Runner = {
    run_for_agent: function(agent, current_year) {
        const scenario_name = SoCoABE_CONFIG.TESTING.active_scenario;
        
        // Debug log to confirm Runner is active (prints once per year per agent, might be spammy, but useful now)
        // console.log(`[Test_Runner] Attempting to run: ${scenario_name} for agent ${agent.id}`);

        if (!scenario_name || scenario_name === 'none') {
            return false;
        }

        const test_function = Test_Scenarios[scenario_name];
        
        if (typeof test_function === 'function') {
            const did_override = test_function(agent, current_year);
            return did_override === true; 
        } else {
            // CRITICAL: Warn if the function is missing
            console.error(`[Test_Runner] ERROR: Configured scenario '${scenario_name}' is NOT a function in Test_Scenarios. Is the file included?`);
        }
        
        return false;
    }
};
this.Test_Runner = Test_Runner;