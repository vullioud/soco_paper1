/**
 * Diagnostic for Test_Runner interference
 * Run: DiagnoseTestRunner.check()
 */

var DiagnoseTestRunner = {

    check: function() {
        console.log("\n=== TEST_RUNNER DIAGNOSTIC ===\n");

        // Check config
        console.log("SoCoABE_CONFIG.TESTING:");
        console.log(JSON.stringify(SoCoABE_CONFIG.TESTING, null, 2));

        const scenario_name = SoCoABE_CONFIG.TESTING.active_scenario;
        console.log(`\nactive_scenario value: ${scenario_name}`);
        console.log(`Type: ${typeof scenario_name}`);
        console.log(`Is undefined: ${scenario_name === undefined}`);
        console.log(`Is null: ${scenario_name === null}`);
        console.log(`Truthiness: ${!!scenario_name}`);

        // Check what Test_Runner would return
        console.log("\n--- Simulating Test_Runner Logic ---");

        if (!scenario_name || scenario_name === 'none') {
            console.log("✓ Would return FALSE (normal execution)");
        } else {
            console.log(`✗ Would try to run scenario: '${scenario_name}'`);

            const test_function = Test_Scenarios[scenario_name];
            if (typeof test_function === 'function') {
                console.log(`  Test function EXISTS`);
                console.log(`  WARNING: This scenario WILL override agent cycles!`);
            } else {
                console.log(`  ✗ Test function DOES NOT EXIST`);
                console.log(`  ERROR would be logged, but returns FALSE`);
            }
        }

        // Test with a sample agent
        console.log("\n--- Testing with First Agent ---");
        if (socoabe && socoabe.institution && socoabe.institution.all_agents.length > 0) {
            const sample_agent = socoabe.institution.all_agents[0];
            console.log(`Agent: ${sample_agent.id}`);

            const result = Test_Runner.run_for_agent(sample_agent, Globals.year);
            console.log(`Test_Runner.run_for_agent() returned: ${result}`);

            if (result === true) {
                console.error("\n✗ PROBLEM: Test_Runner is OVERRIDING agent cycles!");
                console.error("   This prevents agents from observing, thinking, and acting");
                console.error("   Solution: Set active_scenario to 'none' or comment it properly");
            } else {
                console.log("\n✓ Test_Runner is NOT interfering");
            }
        }

        console.log("\n=== END DIAGNOSTIC ===\n");
    }
};

this.DiagnoseTestRunner = DiagnoseTestRunner;
