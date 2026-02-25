// ----- Start of File: soco_src/test/scenarios/inspect_raw_data.js -----

/**
 * =================================================================================
 * TEST SCENARIO: Inspect Raw Data Perception Step
 * =================================================================================
 */
Test_Scenarios.inspect_raw_data_step = function(agent, current_year) {
    
    // --- CONFIGURATION ---
    const AGENT_ID_TO_INSPECT = "small_agent_51";
    const YEARS_TO_INSPECT = [2, 4];
    // ---------------------

    if (agent.id !== AGENT_ID_TO_INSPECT || !YEARS_TO_INSPECT.includes(current_year)) {
        return; 
    }

    const stand_id_to_inspect = agent.managed_stand_ids[0];
    if (typeof stand_id_to_inspect === 'undefined') return;

    console.log(`\n[TEST] ==================== Running Raw Data Inspection for Year ${current_year} ====================`);

    // --- 1. ARTIFICIAL STATE MANIPULATION (for Year 4) ---
    if (current_year === 4) {
        console.log("[TEST] MANIPULATION: Artificially setting 'abe_last_activity' flag to simulate a clearcut from Year 3.");
        fmengine.standId = stand_id_to_inspect;
        stand.setFlag('abe_last_activity', 'MegaSTP_Clearcut');
        stand.setFlag('abe_last_activity_year', current_year - 1);
    }
    
    // --- 2. OBSERVE (Run the full perception pipeline silently) ---
    let stand_data_obj = agent.managed_stands_data[stand_id_to_inspect];
    stand_data_obj = Perception.observe_stand(stand_data_obj, agent);
    
    // --- 3. LOG THE FINAL RESULT ---
    // --- THIS WAS THE MISSING PART ---
    SoCo_Inspector.log_stand_data_section(
        agent, 
        stand_id_to_inspect, 
        "iLand_stand_data", 
        `Final Raw Data State - Year ${current_year}`
    );

    // IMPORTANT: Update the agent's memory with the final state
    agent.managed_stands_data[stand_id_to_inspect] = stand_data_obj;
    
    console.log(`[TEST] ==================== Inspection Complete for Year ${current_year} ====================\n`);
};


/**
 * =================================================================================
 * TEST SCENARIO: COMPUTED CLASSIFICATION
 * =================================================================================
 */
Test_Scenarios.inspect_classification_step = function(agent, current_year) {
    
    // --- CONFIGURATION ---
    const AGENT_ID_TO_INSPECT = "small_agent_51";
    const YEARS_TO_INSPECT = [1, 3, 4];
    // ---------------------

    if (agent.id !== AGENT_ID_TO_INSPECT || !YEARS_TO_INSPECT.includes(current_year)) {
        return;
    }

    const stand_id_to_inspect = agent.managed_stand_ids[0];
    if (typeof stand_id_to_inspect === 'undefined') return;

    console.log(`\n[TEST] ==================== Running Classification Inspection for Year ${current_year} ====================`);

    // --- 1. OBSERVE (Run the full perception pipeline silently) ---
    let stand_data_obj = agent.managed_stands_data[stand_id_to_inspect];
    stand_data_obj = Perception.observe_stand(stand_data_obj, agent);
    
    // --- 2. MANIPULATE (On a specific year) ---
    if (current_year === 4) {
        console.log("[TEST] MANIPULATION: Artificially setting stand_age to 260 to test edge case.");
        stand_data_obj.iLand_stand_data.stand_age = 260;
        stand_data_obj.std = 260;

        // Re-run the classification step to see the effect of the manipulation
        console.log("[TEST] Re-running classification after manipulation...");
        stand_data_obj = Perception.compute_classified_data(stand_data_obj, agent);
    }
    
    // --- 3. LOG THE FINAL RESULT ---
    // Log the key input data.
    SoCo_Inspector.log_stand_data_section(
        agent, 
        stand_id_to_inspect, 
        "iLand_stand_data", 
        `Input Data State - Year ${current_year}`
    );

    // Log the classification output.
    SoCo_Inspector.log_stand_data_section(
        agent, 
        stand_id_to_inspect, 
        "classified", 
        `Final Classified State - Year ${current_year}`
    );

    // IMPORTANT: Update the agent's memory with the final state
    agent.managed_stands_data[stand_id_to_inspect] = stand_data_obj;
    
    console.log(`[TEST] ==================== Inspection Complete for Year ${current_year} ====================\n`);
};


/**
 * =================================================================================
 * TEST SCENARIO: Inspect History FLAG Perception Step
 * =================================================================================
 */
// ----- Start of File: soco_src/test/scenarios/inspect_history.js -----

Test_Scenarios.inspect_history_step = function(agent, current_year) {
    
    const AGENT_ID_TO_INSPECT = "small_agent_51";
    const YEARS_TO_INSPECT = [2, 3, 4, 5, 7, 8];

    if (agent.id !== AGENT_ID_TO_INSPECT || !YEARS_TO_INSPECT.includes(current_year)) {
        return;
    }

    const stand_id_to_inspect = agent.managed_stand_ids[0];
    if (typeof stand_id_to_inspect === 'undefined') return;

    console.log(`\n[TEST] ==================== Running History Inspection for Year ${current_year} ====================`);

    // --- 1. MANIPULATE (Only for Year 4) ---
    if (current_year === 4) {
        console.log("[TEST] MANIPULATION: Setting 'abe_last_activity' flag for Year 3.");
        fmengine.standId = stand_id_to_inspect;
        stand.setFlag('abe_last_activity', 'MegaSTP_Clearcut');
        stand.setFlag('abe_last_activity_year', current_year - 1); // Year 3
        stand.setFlag('abe_need_reassessment', true); 
    } else {
        // On other years, ensure the flag is clear so we can see the counter increment.
        fmengine.standId = stand_id_to_inspect;
        stand.setFlag('abe_last_activity', null);
        stand.setFlag('abe_last_activity_year', null);
    }
    
    // --- 2. OBSERVE ---
    let stand_data_obj = agent.managed_stands_data[stand_id_to_inspect];
    stand_data_obj = Perception.observe_stand(stand_data_obj, agent);
    
    // --- 3. LOG ---
    SoCo_Inspector.log_stand_data_section(agent, stand_id_to_inspect, "history", `Final History State - Year ${current_year}`);
    console.log(`NEEDS_REASSESSMENT flag is now: ${stand_data_obj.iLand_stand_data.needs_reassessment}`);

    // Update the agent's memory
    agent.managed_stands_data[stand_id_to_inspect] = stand_data_obj;
    
    console.log(`[TEST] ==================== Inspection Complete for Year ${current_year} ====================\n`);
};

/**
 * =================================================================================
 * TEST SCENARIO: Inspect Reassessment Flag Trigger
 * =================================================================================
 * DESCRIPTION:
 * This scenario verifies that setting the `abe_need_reassessment` flag on an
 * iLand stand correctly triggers the agent's `check()` method to select that
 * stand for replanning, independent of the 10-year periodic cycle.
 * =================================================================================
 */
Test_Scenarios.inspect_check_need_step = function(agent, current_year) {
    
    // --- CONFIGURATION ---
    const AGENT_ID_TO_INSPECT = "small_agent_51";
    // Choose a year that is GUARANTEED NOT to be a periodic planning year.
    // Since offsets are 5-14, Year 3 is a safe choice.
    const YEAR_TO_INSPECT = 3;
    // ---------------------

    if (agent.id !== AGENT_ID_TO_INSPECT || current_year !== YEAR_TO_INSPECT) {
        return;
    }

    const stands_to_flag = agent.managed_stand_ids.slice(0, 2); // Select the first two stands
    if (stands_to_flag.length < 2) {
        console.warn(`[TEST] Agent ${agent.id} does not have enough stands for this test.`);
        return;
    }

    console.log(`\n[TEST] ==================== Running Reassessment Flag Inspection for Year ${current_year} ====================`);

    // --- 1. MANIPULATE ---
    console.log(`[TEST] MANIPULATION: Setting 'abe_need_reassessment' flag to true for stands: ${stands_to_flag.join(', ')}.`);
    stands_to_flag.forEach(stand_id => {
        fmengine.standId = stand_id;
        stand.setFlag('abe_need_reassessment', true);
    });
    
    // --- 2. OBSERVE ---
    // This step is crucial for the agent to read the flags we just set.
    agent.observe();
    
    // --- 3. CHECK & LOG ---
    // This is the core of the test. We call the function we want to verify.
    const stands_found = agent.check(current_year);

    console.log("\n--- TEST RESULTS ---");
    console.log(`Agent ${agent.id}: Found ${stands_found.length} stands requiring a new plan.`);
    
    if (stands_found.length > 0) {
        const found_ids = stands_found.map(s => s.stand_id);
        console.log(`IDs of stands found: [${found_ids.join(', ')}]`);
    }

    // Verification
    if (stands_found.length === 2) {
        console.log("[TEST] SUCCESS: The correct number of stands was identified.");
    } else {
        console.error(`[TEST] FAILURE: Expected to find 2 stands, but found ${stands_found.length}.`);
    }
    
    console.log(`[TEST] ==================== Inspection Complete for Year ${current_year} ====================\n`);
};

// ----- Start of File: soco_src/test/scenarios/inspect_planning_trigger.js -----

/**
 * =================================================================================
 * TEST SCENARIO: Inspect Planning Trigger and Activity Selection
 * =================================================================================
 */
Test_Scenarios.inspect_planning_trigger = function(agent, current_year) {
    
    const YEARS_TO_INSPECT = [3, 4, 5, 6];
    
    if (typeof this.stands_to_watch === 'undefined') {
        this.stands_to_watch = {};
        for (const owner_type in socoabe.institution.owners) {
            const owner = socoabe.institution.owners[owner_type];
            if (owner.agent_list.length > 0 && owner.agent_list[0].managed_stand_ids.length > 0) {
                const agent_id = owner.agent_list[0].id;
                const stand_id = owner.agent_list[0].managed_stand_ids[0];
                this.stands_to_watch[agent_id] = stand_id;
                console.log(`[TEST SETUP] Watching Stand ${stand_id} from Agent ${agent_id} (Owner: ${owner_type})`);
            }
        }
    }

    if (this.stands_to_watch[agent.id] === undefined || !YEARS_TO_INSPECT.includes(current_year)) {
        return;
    }

    const stand_id_to_inspect = this.stands_to_watch[agent.id];
    console.log(`\n[TEST] --- Inspecting Agent ${agent.id}, Stand ${stand_id_to_inspect} for Year ${current_year} ---`);

    // --- 1. MANIPULATE (for Year 5) ---
    if (current_year === 5) {
        console.log(`[TEST] MANIPULATION: Setting 'abe_need_reassessment' flag to true.`);
        fmengine.standId = stand_id_to_inspect;
        stand.setFlag('abe_need_reassessment', true);
    }

    // --- 2. RUN THE AGENT'S P-C-A CYCLE ---
    agent.observe();
    const stands_to_plan = agent.check(current_year);
    if (stands_to_plan.length > 0) {
        agent.plan(stands_to_plan);
    }

    // --- 3. LOG THE RESULT ---
    const final_stand_data = agent.managed_stands_data[stand_id_to_inspect];
    
    // --- ENHANCED LOGGING ---
    console.log("--- TEST RESULTS ---");
    console.log(`  Context:`);
    console.log(`    - Preference Focus: ${final_stand_data.preference_focus}`);
    console.log(`    - Species Focus: ${final_stand_data.species_profile}`);
    console.log(`    - Stand Age:        ${final_stand_data.iLand_stand_data.stand_age.toFixed(2)}`);
   console.log(`    - absolute Age:        ${final_stand_data.iLand_stand_data.absolute_age_soco.toFixed(2)}`);
    console.log(`    - Age Class:        ${final_stand_data.classified.age_class}`);
    console.log(`    - Structure Class:  ${final_stand_data.classified.structure_class}`);
    console.log(`  Result:`);
    console.log(`    - Chosen Activity:  '${final_stand_data.activity.chosen_Activity}'`);
    console.log(`    - Arguments:  '${final_stand_data.activity.parameters ? SoCo_Inspector._safeStringify(final_stand_data.activity.parameters) : '{}'}'`);
    console.log(`    - target year:  '${final_stand_data.activity.target_year}'`);
    console.log("--------------------");
};



Test_Scenarios.inspect_initialization = function(agent, current_year) {
    
    // This test runs only in Year 2, AFTER the main initialization has happened in Year 1.
    if (current_year !== 2) { 
        return;
    }

    // Setup stands to watch on the first run of this test
    if (typeof this.stands_to_watch === 'undefined') {
        this.stands_to_watch = {};
        for (const owner_type in socoabe.institution.owners) {
            const owner = socoabe.institution.owners[owner_type];
            if (owner.agent_list.length > 0 && owner.agent_list[0].managed_stand_ids.length > 0) {
                const agent_id = owner.agent_list[0].id;
                const stand_id = owner.agent_list[0].managed_stand_ids[0];
                this.stands_to_watch[agent_id] = stand_id;
            }
        }
    }

    if (this.stands_to_watch[agent.id] === undefined) {
        return;
    }

    // --- THIS IS THE FIX ---
    // 1. First, we must run the agent's observation for the current year (Year 2)
    //    to ensure all data is up-to-date.
    agent.observe();

    // 2. Now we can inspect the result.
    const stand_id_to_inspect = this.stands_to_watch[agent.id];
    const stand_data_obj = agent.managed_stands_data[stand_id_to_inspect];

    console.log(`\n[TEST] --- Verifying Initialization for Agent ${agent.id}, Stand ${stand_id_to_inspect} (inspected in Year 2) ---`);
    console.log(`  - Stand Preference Focus: ${stand_data_obj.preference_focus}`);
    console.log(`  - Assigned Species Profile: ${stand_data_obj.species_profile}`);
    
    if (stand_data_obj.preference_focus !== "none" && stand_data_obj.species_profile !== "none") {
        console.log("  - [SUCCESS] Stand appears to be initialized correctly.");
    } else {
        console.error("  - [FAILURE] Stand initialization is incomplete.");
    }
    console.log(`----------------------------------------------------------`);
};

Test_Scenarios.inspect_full_initialization_flow = function(agent, current_year) {
    
    const AGENT_ID_TO_INSPECT = "small_agent_51";

    // This test runs ONLY in Year 1 for our target agent.
    if (agent.id !== AGENT_ID_TO_INSPECT || current_year !== 1 ) {
        return;
    }

    const stand_id_to_inspect = agent.managed_stand_ids[0];
    if (typeof stand_id_to_inspect === 'undefined') return;

    console.log(`\n[TEST] ==================== Full Initialization Flow for Agent ${agent.id}, Stand ${stand_id_to_inspect} ====================`);

    // --- 1. STATE AFTER CONSTRUCTOR ---
    // We log the initial state before any perception runs.
    let stand_data_obj = agent.managed_stands_data[stand_id_to_inspect];
    console.log("\n[TEST] --- State AFTER constructor ---");
    console.log(SoCo_Inspector._safeStringify(stand_data_obj));

    // --- 2. RUN AND LOG OBSERVE STEP ---
    console.log("\n[TEST] --- Running agent.observe()... ---");
    agent.observe();
    stand_data_obj = agent.managed_stands_data[stand_id_to_inspect]; // Re-fetch
    console.log("[TEST] --- State AFTER observe() ---");
    console.log(SoCo_Inspector._safeStringify(stand_data_obj));


    // --- 3. RUN AND LOG PROFILE ASSIGNMENT STEP ---
    console.log("\n[TEST] --- Running agent.assign_species_profiles()... ---");
    agent.assign_species_profiles();
    stand_data_obj = agent.managed_stands_data[stand_id_to_inspect]; // Re-fetch
    console.log("[TEST] --- State AFTER assign_species_profiles() ---");
    console.log(SoCo_Inspector._safeStringify(stand_data_obj));

    console.log(`[TEST] ==================== Inspection Complete ====================\n`);
    
    // Manually set the flag since we are overriding the main loop.
    agent.is_initialized = true;
};

// ----- Start of File: soco_src/test/scenarios/snapshot_stand_data.js -----

/**
 * =================================================================================
 * TEST SCENARIO: Snapshot Stand Data
 * =================================================================================
 * DESCRIPTION:
 * This is a simple reporting tool, not a test. It runs alongside the normal
 * agent logic and logs the complete state of specific stand_data objects
 * at specified years. This is used for direct inspection of the model's state
 * during a normal run.
 * =================================================================================
 */
Test_Scenarios.snapshot_stand_data = function(agent, current_year) {
    
    // --- CONFIGURATION ---
    const YEARS_TO_SNAPSHOT = [4, 5, 6];
    
    // Setup stands to watch on the first run
    if (typeof this.stands_to_watch === 'undefined') {
        this.stands_to_watch = {};
        for (const owner_type in socoabe.institution.owners) {
            const owner = socoabe.institution.owners[owner_type];
            if (owner.agent_list.length > 0 && owner.agent_list[0].managed_stand_ids.length > 0) {
                const agent_id = owner.agent_list[0].id;
                const stand_id = owner.agent_list[0].managed_stand_ids[0];
                this.stands_to_watch[agent_id] = stand_id;
            }
        }
    }
    // ---------------------

    if (this.stands_to_watch[agent.id] === undefined || !YEARS_TO_SNAPSHOT.includes(current_year)) {
        // This scenario does not override the agent's logic, so we return false.
        return false; 
    }

    const stand_id_to_inspect = this.stands_to_watch[agent.id];
    const stand_data_obj = agent.managed_stands_data[stand_id_to_inspect];

    console.log(`\n--- SNAPSHOT of Stand ${stand_id_to_inspect} at END of Year ${current_year} ---`);
    console.log(SoCo_Inspector._safeStringify(stand_data_obj));
    console.log(`--- END SNAPSHOT ---`);

    // Return false to allow the normal agent logic to run.
    return false;
};

/**
 * =================================================================================
 * TEST SCENARIO: Inspect Schedule Computation
 * =================================================================================
 * DESCRIPTION:
 * This scenario verifies the entire planning pipeline, from activity and parameter
 * selection through to schedule computation. It logs the complete `activity` object
 * to show the final generated timeline.
 * =================================================================================
 */
Test_Scenarios.inspect_schedule_computation = function(agent, current_year) {
    
    // --- CONFIGURATION ---
    const YEARS_TO_INSPECT = [3, 4, 12, 16, 17];
    
    if (typeof this.stands_to_watch === 'undefined') {
        this.stands_to_watch = {};
        for (const owner_type in socoabe.institution.owners) {
            const owner = socoabe.institution.owners[owner_type];
            if (owner.agent_list.length > 0 && owner.agent_list[0].managed_stand_ids.length > 0) {
                const agent_id = owner.agent_list[0].id;
                const stand_id = owner.agent_list[0].managed_stand_ids[0];
                this.stands_to_watch[agent_id] = stand_id;
            }
        }
    }
    // ---------------------

    if (this.stands_to_watch[agent.id] === undefined || !YEARS_TO_INSPECT.includes(current_year)) {
        return;
    }

    const stand_id_to_inspect = this.stands_to_watch[agent.id];
    console.log(`\n[TEST] --- Inspecting Agent ${agent.id}, Stand ${stand_id_to_inspect} for Year ${current_year} ---`);

    // --- 1. MANIPULATE (for Year 5) ---
    if (current_year === 12) {
        console.log(`[TEST] MANIPULATION: Setting 'abe_need_reassessment' flag to true.`);
        fmengine.standId = stand_id_to_inspect;
        stand.setFlag('abe_need_reassessment', true);
    }

    // --- 2. RUN THE AGENT'S P-C-A CYCLE ---
    agent.observe();
    const stands_to_plan = agent.check(current_year);
    if (stands_to_plan.length > 0) {
        agent.plan(stands_to_plan);
    }

    // --- 3. LOG THE RESULT ---
    const final_stand_data = agent.managed_stands_data[stand_id_to_inspect];
    
    console.log("--- TEST RESULTS ---");
    console.log(`  Context:`);
    console.log(`    - Stand Age:       ${final_stand_data.iLand_stand_data.stand_age.toFixed(2)}`);
    console.log(`    - absolute Age:        ${final_stand_data.iLand_stand_data.absolute_age_soco.toFixed(2)}`);
    console.log(`    - Species Profile: ${final_stand_data.species_profile}`);
    console.log(`  Result (Full Activity Object):`);
    console.log(SoCo_Inspector._safeStringify(final_stand_data.activity));
    console.log(SoCo_Inspector._safeStringify(final_stand_data.target_year));

    console.log("--------------------");
};


Test_Scenarios.inspect_schedule_only = function(agent, current_year) {
    
    // This test runs only once, for any agent, in year 2.
    if (current_year !== 2 || typeof this.test_has_run !== 'undefined') {
        return;
    }
    this.test_has_run = true; // Ensure it only runs for the very first agent.

    console.log(`\n[TEST] ==================== Inspecting compute_schedule Function Directly ====================`);

    // --- TEST CASE 1: Finite Sequence (selectiveThinning) ---
    let test_stand_1 = new stand_data(1, agent.id, "Production");
    test_stand_1.activity.chosen_Activity = "selectiveThinning";
    test_stand_1.activity.parameters = { execution_schedule: 40, times: 4, interval: 8 };
    
    console.log("\n--- Testing: selectiveThinning ---");
    console.log("Input Parameters:", SoCo_Inspector._safeStringify(test_stand_1.activity.parameters));
    test_stand_1 = Cognition.compute_schedule(test_stand_1);
    console.log("Result:", SoCo_Inspector._safeStringify(test_stand_1.activity));

    // --- TEST CASE 2: Continuous Sequence (plenter_thinning) ---
    let test_stand_2 = new stand_data(2, agent.id, "Biodiversity");
    test_stand_2.activity.chosen_Activity = "plenter_thinning";
    test_stand_2.activity.parameters = { execution_schedule: 50, interval: 7 };

    console.log("\n--- Testing: plenter_thinning ---");
    console.log("Input Parameters:", SoCo_Inspector._safeStringify(test_stand_2.activity.parameters));
    test_stand_2 = Cognition.compute_schedule(test_stand_2);
    console.log("Result:", SoCo_Inspector._safeStringify(test_stand_2.activity));

    // --- TEST CASE 3: Continuous Sequence (targetDBH) ---
    let test_stand_3 = new stand_data(3, agent.id, "CO2");
    test_stand_3.activity.chosen_Activity = "targetDBH";
    test_stand_3.activity.parameters = { execution_schedule: 80, times: 6 }; // 'times' is the interval

    console.log("\n--- Testing: targetDBH ---");
    console.log("Input Parameters:", SoCo_Inspector._safeStringify(test_stand_3.activity.parameters));
    test_stand_3 = Cognition.compute_schedule(test_stand_3);
    console.log("Result:", SoCo_Inspector._safeStringify(test_stand_3.activity));

    console.log(`\n[TEST] ==================== Inspection Complete ====================\n`);
};

/**
 * =================================================================================
 * TEST SCENARIO: Inspect Age Classification Logic
 * =================================================================================
 * DESCRIPTION:
 * This is a simple, focused test to verify the age classification logic.
 * It runs for a single stand in a single year. It loops through ages 1 to 200,
 * artificially sets the stand_age, re-runs the classification logic, and logs
 * the result. This allows for direct validation of the `age_class_lookup.json` table.
 * =================================================================================
 */
Test_Scenarios.inspect_age_classification_logic = function(agent, current_year) {

    // --- CONFIGURATION ---
    const AGENT_ID_TO_INSPECT = "small_agent_51"; // We only need one agent to run this
    const YEAR_TO_INSPECT = 2; // Run this test once, early in the simulation
    // ---------------------

    // Guard clause: only run this test for the specified agent and year.
    if (agent.id !== AGENT_ID_TO_INSPECT || current_year !== YEAR_TO_INSPECT) {
        return false; // Let other agents/years run normally
    }

    // Select the first stand managed by this agent for the test.
    var stand_id_to_inspect = agent.managed_stand_ids[0];
    if (typeof stand_id_to_inspect === 'undefined') {
        console.warn("[TEST] Agent " + agent.id + " has no stands to test.");
        return true; // Stop the test
    }

    var stand_data_obj = agent.managed_stands_data[stand_id_to_inspect];

    console.log("\n[TEST] --- Verifying Age Classification Logic (Ages 1-200) ---");
    console.log("stand_age,age_class"); // Print CSV header

    // Loop from age 1 to 200
    for (var test_age = 1; test_age <= 200; test_age++) {

        // 1. Artificially set the stand_age in the data object.
        stand_data_obj.iLand_stand_data.stand_age = test_age;

        // 2. Re-run the perception step that performs the classification.
        //    We pass the agent object because compute_derived_data needs it to access the age_class_table.
        stand_data_obj = Perception.compute_derived_data(stand_data_obj, agent);

        // 3. Log the result in a simple, comma-separated format.
        var age_class_result = stand_data_obj.classified.age_class;
        console.log(test_age + "," + age_class_result);
    }

    console.log("[TEST] --- Age Classification Test Complete ---");

    // Return true to signify that we have taken over the agent's logic for this year.
    // The agent will do nothing else.
    return true;
};


 /**
 * =================================================================================
 * TEST SCENARIO: Inspect 10-Year Plan Summary (Detailed)
 * =================================================================================
 * DESCRIPTION:
 * This test provides a detailed summary of each agent and its managed stands,
 * including their ages, planned activities, and target years.
 * =================================================================================
 */
Test_Scenarios.inspect_10_year_plan_summary = function(agent, current_year) {
    
    // --- CONFIGURATION ---
    const YEAR_TO_INSPECT = 5;
    // ---------------------

    if (current_year !== YEAR_TO_INSPECT) {
        return false; // Do not override the agent's logic in other years.
    }

    console.log(`\n[TEST] --- Running Detailed 10-Year Plan Summary for Agent ${agent.id} (Owner: ${agent.owner.type}) ---`);
    console.log(`  - Number of managed stands: ${agent.managed_stand_ids.length}`);

    // 1. Force reassessment for all stands
    for (const stand_id in agent.managed_stands_data) {
        fmengine.standId = stand_id;
        stand.setFlag('abe_need_reassessment', true);
    }

    // 2. Run the agent's P-C-A cycle
    agent.observe();
    const stands_to_plan = agent.check(current_year);
    if (stands_to_plan.length > 0) {
        agent.plan(stands_to_plan);
    }

    // 3. Log details for each stand
    for (const stand_id in agent.managed_stands_data) {
        const stand_data = agent.managed_stands_data[stand_id];
        fmengine.standId = stand_id; // Set context for accessing stand properties

        console.log(`\n  --- Stand ${stand_id} ---`);
        console.log(`    - Age: ${stand.age}`);
        console.log(`    - Absolute Age: ${stand.absoluteAge}`);
        console.log(`    - Activity: ${stand_data.activity.chosen_Activity}`);
        console.log(`    - AgeClass: ${stand_data.classified.age_class}`);
        console.log(`    - Target Year: ${stand_data.activity.target_year}`);
    }

    console.log(`[TEST] ==================== Inspection Complete ====================\n`);

    // Return true to override the agent's normal 'act' phase for this test run.
    return true;
};

/**
 * =================================================================================
 * TEST SCENARIO: Inspect Flag Setting for a Single Clearcut Action
 * =================================================================================
 * DESCRIPTION:
 * This test verifies the entire "plan -> act -> flag" pipeline for a single,
 * hardcoded 'clearcut' activity. It checks if the agent's `act()` method
 * correctly calls the Action module, which should then set the appropriate
 * flags on the iLand stand object.
 * =================================================================================
 */
/**
 * =================================================================================
 * TEST SCENARIO: Inspect Signal Triggering System for Multiple Activities
 * =================================================================================
 */
Test_Scenarios.inspect_signal_trigger_system = function(agent, current_year) {
    
    // --- CONFIGURATION ---
    const AGENT_ID_TO_INSPECT = "big_agent_1";
    const TRIGGER_YEAR = 10;
    const VERIFY_YEAR = 13;
    // ---------------------

    if (agent.id !== AGENT_ID_TO_INSPECT || (current_year !== TRIGGER_YEAR && current_year !== VERIFY_YEAR)) {
        return false;
    }

    // --- TRIGGER PHASE ---
    if (current_year === TRIGGER_YEAR) {
        console.log(`\n[TEST] ==================== Triggering Activities via Signal ====================`);
        
        const stands_for_clearcut = agent.managed_stand_ids.slice(0, 5);
        const stands_for_no_mgmt = agent.managed_stand_ids.slice(5, 10);

        var plans = [];
        // Create clearcut plans
        for (var i = 0; i < stands_for_clearcut.length; i++) {
            var stand_id = stands_for_clearcut[i];
            var stand_plan = agent.managed_stands_data[stand_id];
            stand_plan.activity.chosen_Activity = 'clearcut';
            stand_plan.activity.target_year = TRIGGER_YEAR;
            plans.push(stand_plan);
        }
        // Create noManagement plans
        for (var i = 0; i < stands_for_no_mgmt.length; i++) {
            var stand_id = stands_for_no_mgmt[i];
            var stand_plan = agent.managed_stands_data[stand_id];
            stand_plan.activity.chosen_Activity = 'noManagement';
            stand_plan.activity.target_year = TRIGGER_YEAR;
            plans.push(stand_plan);
        }

        console.log(`[TEST] Calling agent.act() for ${plans.length} stands...`);
        agent.act(plans);
        console.log(`[TEST] Signals fired. Execution expected in year ${TRIGGER_YEAR + 1}.`);
    }

    // --- VERIFICATION PHASE ---
    if (current_year === VERIFY_YEAR) {
        console.log(`\n[TEST] ==================== Verifying Activity Execution in Year ${VERIFY_YEAR} ====================`);
        
        const stands_to_verify = agent.managed_stand_ids.slice(0, 10);
        
        agent.observe(); // Run observation to update all stand_data objects

        console.log("\n--- VERIFICATION RESULTS ---");
        for (var i = 0; i < stands_to_verify.length; i++) {
            var stand_id = stands_to_verify[i];
            var stand_data = agent.managed_stands_data[stand_id];
            var volume = stand_data.iLand_stand_data.volume;

            console.log(`  - Stand ${stand_id}: Volume = ${volume.toFixed(2)} m3/ha`);
            if (i < 5) { // First 5 should be clearcut
                if (volume < 1.0) console.log("    - [SUCCESS] Stand was clearcut as planned.");
                else console.error(`    - [FAILURE] Stand was NOT clearcut.`);
            } else { // Next 5 should be noManagement
                if (volume > 1.0) console.log("    - [SUCCESS] Stand was not harvested, as planned.");
                else console.error(`    - [FAILURE] Stand volume is zero, which was not expected.`);
            }
        }

        // Log full object for one stand of each type
        console.log("\n--- Detailed Stand Data Object for a Clearcut Stand ---");
        console.log(SoCo_Inspector._safeStringify(agent.managed_stands_data[stands_to_verify[0]]));
        
        console.log("\n--- Detailed Stand Data Object for a No-Management Stand ---");
        console.log(SoCo_Inspector._safeStringify(agent.managed_stands_data[stands_to_verify[5]]));

        console.log(`[TEST] ==================== Verification Complete ====================\n`);
    }

    return true;
};

/**
 * =================================================================================
 * TEST SCENARIO: Inspect Signal Triggering for Target DBH Harvest
 * =================================================================================
 */
Test_Scenarios.inspect_signal_trigger_targetDBH = function(agent, current_year) {
    
    // --- CONFIGURATION ---
    const AGENT_ID_TO_INSPECT = "big_agent_1";
    const TRIGGER_YEAR = 15;
    const VERIFY_YEAR = 17;
    // ---------------------

    if (agent.id !== AGENT_ID_TO_INSPECT || (current_year !== TRIGGER_YEAR && current_year !== VERIFY_YEAR)) {
        return false;
    }

    // --- TRIGGER PHASE ---
    if (current_year === TRIGGER_YEAR) {
        console.log(`\n[TEST] ==================== Triggering TargetDBH via Signal ====================`);
        
        const stand_id_to_trigger = agent.managed_stand_ids[0];
        if (typeof stand_id_to_trigger === 'undefined') return true;

        var stand_plan = agent.managed_stands_data[stand_id_to_trigger];
        stand_plan.activity.chosen_Activity = 'targetDBH';
        stand_plan.activity.target_year = TRIGGER_YEAR;
        stand_plan.activity.parameters = { dbhListProfile: 'default' }; 

        console.log(`[TEST] Calling agent.act() for stand ${stand_id_to_trigger} with profile: '${stand_plan.activity.parameters.dbhListProfile}'`);
        agent.act([stand_plan]);
        console.log(`[TEST] Signal fired. Execution expected in year ${TRIGGER_YEAR + 1}.`);
    }

    // --- VERIFICATION PHASE ---
    if (current_year === VERIFY_YEAR) {
        console.log(`\n[TEST] ==================== Verifying TargetDBH Execution in Year ${VERIFY_YEAR} ====================`);
        
        const stand_id_to_verify = agent.managed_stand_ids[0];
        
        agent.observe();
        
        var stand_data = agent.managed_stands_data[stand_id_to_verify];
        var volume_after = stand_data.iLand_stand_data.volume;

        // Read the flag that was used by the MegaSTP in the execution year.
        fmengine.standId = stand_id_to_verify;
        var dbhList_used = stand.flag('abe_param_dbhList');

        console.log("--- VERIFICATION RESULTS ---");
        console.log(`  - Stand ${stand_id_to_verify}: Volume = ${volume_after.toFixed(2)} m3/ha`);
        
        if (volume_after > 1.0 && volume_after < 1000) { // A plausible range for partial harvest
            console.log("    - [SUCCESS] Stand was partially harvested, as expected for targetDBH.");
        } else {
            console.error(`    - [FAILURE] Stand volume is unexpected (${volume_after}).`);
        }

        console.log("\n--- Detailed Stand Data Object ---");
        console.log(SoCo_Inspector._safeStringify(stand_data));

        console.log("\n--- Parameter Flag Verification ---");
        console.log("  - The 'abe_param_dbhList' flag used by the MegaSTP was:");
        console.log("    - " + JSON.stringify(dbhList_used));
        
        console.log(`[TEST] ==================== Verification Complete ====================\n`);
    }

    return true; 
};

// ----- Start of File: soco_src/test/scenarios/inspect_age_classification_flow.js -----

Test_Scenarios.inspect_age_classification_flow = function(agent, current_year) {

    // --- CONFIGURATION ---
    const YEARS_TO_INSPECT = [1, 2, 5, 10, 45]; 
    // ---------------------

    // 1. Guard: Check Year
    if (!YEARS_TO_INSPECT.includes(current_year)) {
        return false;
    }

    // 2. Guard: Run only for the FIRST agent encountered in that year to avoid log floods
    if (typeof this._logged_agents === 'undefined') this._logged_agents = {};
    if (this._logged_agents[current_year]) return false; // Already ran for this year
    this._logged_agents[current_year] = true;

    console.log(`\n[TEST] === Age Classification Inspection | Agent: ${agent.id} | Year: ${current_year} ===`);

    // 3. Inspect the Lookup Table structure (Year 1 only)
    if (current_year === 1) {
        console.log("[TEST] Dumping Agent's Age Class Table Structure:");
        console.log(JSON.stringify(agent.age_class_table, null, 2));
    }

    // 4. Inspect first 3 stands
    const stands_to_inspect = agent.managed_stand_ids.slice(0, 3); 

    stands_to_inspect.forEach(stand_id => {
        let stand_data = agent.managed_stands_data[stand_id];
        
        // Force observation
        stand_data = Perception.observe_stand(stand_data, agent);
        const soco_age = stand_data.iLand_stand_data.absolute_age_soco;
        const iland_age = stand_data.iLand_stand_data.stand_age;
        const current_class = stand_data.classified.age_class;

        console.log(`\n  --- Stand ${stand_id} ---`);
        console.log(`    iLand Age: ${iland_age.toFixed(2)}`);
        console.log(`    SoCo Age:  ${soco_age} (Type: ${typeof soco_age})`);
        console.log(`    Resulting Class: '${current_class}'`);

        // Manual Verification Logic
        let match_found = null;
        let log_check = [];

        if (agent.age_class_table) {
            for (let cls in agent.age_class_table) {
                if (agent.age_class_table.hasOwnProperty(cls)) {
                    let range = agent.age_class_table[cls];
                    let is_match = (soco_age >= range[0] && soco_age <= range[1]);
                    
                    if (is_match) {
                        match_found = cls;
                    }
                    if (soco_age >= range[0] - 5 && soco_age <= range[1] + 5) {
                        log_check.push(`Checked '${cls}' [${range[0]}, ${range[1]}]: ${is_match}`);
                    }
                }
            }
        }

        if (match_found) {
            console.log(`    [VERIFY] Table Match Found: '${match_found}'`);
            if (match_found !== current_class) {
                console.error(`    [ERROR] Mismatch! Logic calculated '${current_class}', but table says '${match_found}'`);
            }
        } else {
            console.warn(`    [VERIFY] No match found in table for Age ${soco_age}.`);
            console.log(`    [DEBUG] Checked nearby ranges: ${log_check.join(' | ')}`);
        }
    });

    console.log(`[TEST] === End Inspection ===\n`);
    
    return false; 
};

Test_Scenarios.debug_planting_mass_test = function(agent, current_year) {

    // --- SHARED STATE MANAGEMENT ---
    if (typeof this.mass_test_state === 'undefined') {
        this.mass_test_state = {
            tracked_stands: [] 
        };
    }

    // --- GLOBAL EXECUTION GUARD ---
    if (typeof this.mass_test_year_flag === 'undefined') this.mass_test_year_flag = -1;
    if (this.mass_test_year_flag === current_year) {
        return false; 
    }
    this.mass_test_year_flag = current_year;


    // =========================================================================
    // --- YEAR 2: SETUP PHASE ---
    // =========================================================================
    if (current_year === 2) {
        console.log(`\n[MASS-TEST] === SETUP PHASE (Year ${current_year}) ===`);
        console.log(`[MASS-TEST] Selecting and resetting stands...`);

        let count = 0;
        const TARGET_COUNT = 25;

        if (typeof socoabe !== 'undefined' && socoabe.institution) {
            socoabe.institution.all_agents.some(ag => {
                ag.managed_stand_ids.some(sid => {
                    if (count >= TARGET_COUNT) return true; 

                    // 1. MANIPULATE iLand State
                    fmengine.standId = sid;
                    stand.setAbsoluteAge(0);
                    stand.setFlag('abe_last_activity', 'MegaSTP_Clearcut');
                    stand.setFlag('abe_last_activity_year', current_year - 1); 
                    stand.setFlag('abe_need_reassessment', true); 
                    stand.setFlag('abe_next_activity', null); 

                    // 2. MANIPULATE Agent Memory
                    if (ag.managed_stands_data[sid]) {
                        ag.managed_stands_data[sid].iLand_stand_data.absolute_age_soco = 0;
                        ag.managed_stands_data[sid].history.last_activity = 'MegaSTP_Clearcut';
                        ag.managed_stands_data[sid].history.last_activity_Year = current_year - 1;
                    }

                    // 3. TRACK
                    this.mass_test_state.tracked_stands.push({ agent_id: ag.id, stand_id: sid });
                    count++;
                    return false;
                });
                if (count >= TARGET_COUNT) return true; 
                return false;
            });
        }

        console.log(`[MASS-TEST] Forced Clearcut state on ${count} stands.`);
        return false; 
    }


    // =========================================================================
    // --- YEAR 3-10: REPORTING PHASE ---
    // =========================================================================
    if (current_year > 2 && current_year <= 10) {
        console.log(`\n[MASS-TEST] === STATUS REPORT Year ${current_year} ===`);
        // Added 'Param' column
        console.log("StandID | SoCoAge | Class      | Activity         | TgtYear | Priority | Param (Sched)");
        console.log("------- | ------- | ---------- | ---------------- | ------- | -------- | -------------");

        this.mass_test_state.tracked_stands.forEach(item => {
            const ag = socoabe.institution.all_agents.find(a => a.id === item.agent_id);
            if (!ag) return;

            const data = ag.managed_stands_data[item.stand_id];
            if (!data) return;

            const sid = item.stand_id.toString().padEnd(7);
            const sage = data.iLand_stand_data.absolute_age_soco.toString().padEnd(7);
            
            const cls = (data.classified.age_class || "??").padEnd(10);
            const act = (data.activity.chosen_Activity || "??").padEnd(16);
            const tgt = data.activity.target_year.toString().padEnd(7);
            const prio = (data.activity.scheduling_priority || "-").toString().padEnd(8);
            
            // New: Extract execution_schedule parameter
            let param = "-";
            if (data.activity.parameters && data.activity.parameters.execution_schedule !== undefined) {
                param = data.activity.parameters.execution_schedule.toString();
            }
            param = param.padEnd(13);

            console.log(`${sid} | ${sage} | ${cls} | ${act} | ${tgt} | ${prio} | ${param}`);
        });
        console.log("---------------------------------------------------------------------------------");
    }

    return false; 
};

// ----- Start of File: soco_src/test/scenarios/test_species_strategies.js -----

/**
 * =================================================================================
 * TEST SCENARIO: Unit Test for Species Strategies
 * =================================================================================
 * Tests all 4 species selection strategies against mock agent/stand states
 * to verify outputs without running the full simulation.
 */

// ----- Start of File: soco_src/test/scenarios/test_species_strategies.js -----

/**
 * =================================================================================
 * TEST SCENARIO: Unit Test for Species Strategies (Comprehensive)
 * =================================================================================
 * Tests all 4 species selection strategies against mock agent/stand states.
 * Iterates through all relevant activity types.
 */
Test_Scenarios.test_species_strategies = function(agent, current_year) {

    if (current_year !== 1 || this.species_test_done) return false;
    this.species_test_done = true;

    console.log(`\n[TEST] === START: Species Strategy Unit Tests ===`);

    // --- 0. DIAGNOSTIC CHECKS ---
    if (typeof SpeciesData === 'undefined') {
        console.error("[TEST] CRITICAL: 'SpeciesData' undefined.");
        return false;
    }

    // --- 1. MOCK OBJECTS ---
    var mock_stand = {
        stand_id: 9999,
        classified: {
            dominant_species: [
                { id: 'piab', share: 0.8 },
                { id: 'fasy', share: 0.1 }
            ]
        }
    };

    var mock_agent_risky = { id: "test_risky", risk_tolerance: 0.9 };
    var mock_agent_fearful = { id: "test_fearful", risk_tolerance: 0.1 };

    // --- 2. EXECUTION MATRIX ---
    
    // List of activities the agent might encounter
    var activities = ['planting', 'tending', 'thinning', 'shelterwood'];
    var strategies = ['indiscriminate', 'diversifier', 'economic', 'climate'];

    strategies.forEach(strategy => {
        console.log(`\n--- Strategy: ${strategy.toUpperCase()} ---`);
        
        activities.forEach(act => {
            var agent_to_use = mock_agent_risky;
            var label = "";

            // For economic, we show both risk profiles for planting/thinning
            if (strategy === 'economic' && (act === 'planting' || act === 'thinning')) {
                // Run Risky
                try {
                    var res = SpeciesStrategies.execute(strategy, mock_stand, mock_agent_risky, act);
                    console.log(`    [${act}] (Risky)   -> ${JSON.stringify(res)}`);
                } catch(e) { console.error(e.message); }
                
                // Run Fearful
                try {
                    var res2 = SpeciesStrategies.execute(strategy, mock_stand, mock_agent_fearful, act);
                    console.log(`    [${act}] (Fearful) -> ${JSON.stringify(res2)}`);
                } catch(e) { console.error(e.message); }
                
                return; // Skip default log
            }

            try {
                var res = SpeciesStrategies.execute(strategy, mock_stand, agent_to_use, act);
                console.log(`    [${act}]${label} -> ${JSON.stringify(res)}`);
            } catch (e) {
                console.error(`    [ERROR] ${strategy} - ${act}: ${e.message}`);
            }
        });
    });

    console.log(`\n[TEST] === END: Species Strategy Unit Tests ===\n`);
    
    return false; 
};

    
// ----- Start of File: soco_src/test/scenarios/inspect_stand_strategies.js -----

/**
 * =================================================================================
 * TEST SCENARIO: Inspect Stand Species Strategies
 * =================================================================================
 * Verifies that all stands have been assigned a valid strategy string
 * (economic, climate, etc.) in Year 2.
 */
// ----- Start of File: soco_src/test/scenarios/verify_planting_stp.js -----

/**
 * =================================================================================
 * TEST SCENARIO: Verify Planting STP
 * =================================================================================
 * 1. Year 2: Force Clearcut & Set Strategy 'climate'.
 * 2. Year 3: Force Planting (Check logs for correct species passing).
 * 3. Year 13: Check Stand composition.
 */
Test_Scenarios.verify_planting_stp = function(agent, current_year) {

    // --- CONFIGURATION ---
    const AGENT_ID = "small_agent_1"; 
    const TEST_STAND_INDEX = 0; // First stand managed by this agent
    
    if (agent.id !== AGENT_ID) return false;

    const stand_id = agent.managed_stand_ids[TEST_STAND_INDEX];
    if (!stand_id) return false;

    // --- YEAR 2: CLEAR & PREPARE ---
    if (current_year === 2) {
        console.log(`\n[TEST-PLANT] Year ${current_year}: Forcing Clearcut on Stand ${stand_id}.`);
        
        // 1. Force Strategy to 'climate' (Expected species: quro, cabe, tico, pini...)
        agent.managed_stands_data[stand_id].species_profile = "climate";
        
        // 2. Prepare Action: Clearcut
        fmengine.standId = stand_id;
        // We act manually to ensure it happens
        var stand_plan = agent.managed_stands_data[stand_id];
        stand_plan.activity.chosen_Activity = 'clearcut';
        stand_plan.activity.target_year = current_year;
        stand_plan.activity.is_actionable = true;
        stand_plan.activity.parameters = { execution_schedule: 100 }; // dummy

        console.log(`[TEST-PLANT] Strategy set to 'climate'. Triggering clearcut...`);
        agent.act([stand_plan]);
        return true; // Override normal loop
    }

    // --- YEAR 3: PLANTING ---
    if (current_year === 3) {
        console.log(`\n[TEST-PLANT] Year ${current_year}: Forcing Planting on Stand ${stand_id}.`);
        
        // 1. Force Strategy (Ensure it persisted or re-set it)
        agent.managed_stands_data[stand_id].species_profile = "climate";

        // 2. Prepare Action: Planting
        var stand_plan = agent.managed_stands_data[stand_id];
        stand_plan.activity.chosen_Activity = 'planting';
        stand_plan.activity.target_year = current_year;
        stand_plan.activity.is_actionable = true;
        stand_plan.activity.parameters = { execution_schedule: 1 };

        console.log(`[TEST-PLANT] Triggering planting logic...`);
        // This will call prepare.planting -> SpeciesStrategies.climate -> setFlags -> MegaSTP
        agent.act([stand_plan]);
        return true; // Override normal loop
    }

    // --- YEAR 13: VERIFICATION ---
    if (current_year === 13) {
        console.log(`\n[TEST-PLANT] Year ${current_year}: Inspecting Stand ${stand_id} composition.`);
        
        fmengine.standId = stand_id;
        stand.reload(); // Refresh iLand data
        stand.trees.loadAll(); // Load trees > 4m

        console.log(`  - Stand Age: ${stand.age}`);
        console.log(`  - Tree Count (>4m): ${stand.trees.count}`);
        
        // Note: 10 years might be too short for saplings to reach 4m (dbh > 0).
        // If count is 0, we rely on the logs from Year 3 to prove success.
        // But we can check if *any* trees exist.
        
        if (stand.trees.count > 0) {
            console.log("  - Species found:");
            for (var i = 0; i < stand.nspecies; i++) {
                console.log(`    * ${stand.speciesId(i)}: ${stand.speciesBasalArea(i).toFixed(2)} m2/ha`);
            }
        } else {
            console.log("  - No trees > 4m yet (Expected for 10y old stand). Please check Year 3 logs for 'Running iLand Planting'.");
        }
        
        return true;
    }

    return false;
};

// ----- End of File: soco_src/test/scenarios/verify_planting_stp.js -----

Test_Scenarios.verify_planting_stp = function(agent, current_year) {

    const AGENT_ID = "small_agent_1"; 
    const TEST_STAND_INDEX = 0; 
    
    if (agent.id !== AGENT_ID) return false;

    const stand_id = agent.managed_stand_ids[TEST_STAND_INDEX];
    if (!stand_id) return false;

    // --- YEAR 2: CLEAR ---
    if (current_year === 2) {
        console.log(`\n[TEST-PLANT] Year ${current_year}: Forcing Clearcut & Strategy 'climate'.`);
        agent.managed_stands_data[stand_id].species_profile = "climate";
        agent.managed_stands_data[stand_id].history.target_species = []; 
        
        var stand_plan = agent.managed_stands_data[stand_id];
        stand_plan.activity.chosen_Activity = 'clearcut';
        stand_plan.activity.target_year = current_year;
        stand_plan.activity.is_actionable = true;
        stand_plan.activity.parameters = { execution_schedule: 100 }; 
        agent.act([stand_plan]);
        return true; 
    }

    // --- YEAR 3: PLANTING (Establishes Memory) ---
    if (current_year === 3) {
        console.log(`\n[TEST-PLANT] Year ${current_year}: Forcing Planting.`);
        var stand_plan = agent.managed_stands_data[stand_id];
        stand_plan.activity.chosen_Activity = 'planting';
        stand_plan.activity.target_year = current_year;
        stand_plan.activity.is_actionable = true;
        stand_plan.activity.parameters = { execution_schedule: 1 };
        agent.act([stand_plan]);
        return true; 
    }

    // --- YEAR 4: CHECK MEMORY ---
    if (current_year === 4) {
        console.log(`\n[TEST-PLANT] Year 4 Check: Did we memorize targets?`);
        var targets = agent.managed_stands_data[stand_id].history.target_species;
        console.log(`  -> Memorized Targets: ${JSON.stringify(targets)}`);
        return false;
    }

    // --- YEAR 20: TRIGGER THINNING (End-to-End Check) ---
    if (current_year === 20) {
        console.log(`\n[TEST-PLANT] Year ${current_year}: Triggering Selective Thinning.`);
        
        // 1. Prepare Plan for Selective Thinning
        var stand_plan = agent.managed_stands_data[stand_id];
        stand_plan.activity.chosen_Activity = 'selectiveThinning';
        stand_plan.activity.target_year = current_year;
        stand_plan.activity.is_actionable = true;
        stand_plan.activity.sequence_current_step = 0;
        stand_plan.activity.sequence_total_steps = 1;
        // Parameters
        stand_plan.activity.parameters = { 
            nTrees: 100, 
            nCompetitors: 3 
        };

        // 2. Execute
        // This triggers: act() -> Action.trigger -> prepare.selectiveThinning -> Strategy(Climate) -> Set Flag -> Signal -> MegaSTP
        console.log(`[TEST-PLANT] Calling agent.act() to fire 'do_selectiveThinning_select'...`);
        agent.act([stand_plan]);
        
        // Note: The success proof will be in the log output:
        // "[Action] Prepared Selective Thinning... Selectivity: {...}"
        // "[MEGA-STP] SelectiveThinning: Fetching species selectivity: {...}"
        
        return true; 
    }

    return false;
};


Test_Scenarios.verify_shelterwood_stp = function(agent, current_year) {

    const AGENT_ID = "small_agent_1"; 
    const TEST_STAND_INDEX = 0; 
    
    if (agent.id !== AGENT_ID) return false;

    const stand_id = agent.managed_stand_ids[TEST_STAND_INDEX];
    if (!stand_id) return false;

    // --- YEAR 2: TRIGGER SHELTERWOOD ---
    if (current_year === 2) {
        console.log(`\n[TEST-SHELTER] Year ${current_year}: Triggering Shelterwood on Stand ${stand_id}.`);
        
        // 1. Force Strategy 'climate' (should favor resilient species)
        agent.managed_stands_data[stand_id].species_profile = "climate";
        
        // 2. Prepare Plan
        var stand_plan = agent.managed_stands_data[stand_id];
        stand_plan.activity.chosen_Activity = 'shelterwood';
        stand_plan.activity.target_year = current_year;
        stand_plan.activity.is_actionable = true;
        // Simulate start of sequence
        stand_plan.activity.sequence_current_step = 0;
        stand_plan.activity.sequence_total_steps = 3; 
        
        stand_plan.activity.parameters = { 
            nTrees: 50, 
            nCompetitors: 1000 
        };

        // 3. Execute
        console.log(`[TEST-SHELTER] Calling agent.act()...`);
        agent.act([stand_plan]);
        
        // Expected Logs:
        // [Action] Prepared Shelterwood (climate)... Selectivity: { ... }
        // [MEGA-STP] Shelterwood Select: Fetching species selectivity: { ... }
        
        return true; 
    }

    return false;
};


Test_Scenarios.verify_tending_stp = function(agent, current_year) {

    const AGENT_ID = "small_agent_1"; 
    const TEST_STAND_INDEX = 0; 
    
    if (agent.id !== AGENT_ID) return false;

    const stand_id = agent.managed_stand_ids[TEST_STAND_INDEX];
    if (!stand_id) return false;

    // --- YEAR 2: TRIGGER TENDING ---
    if (current_year === 2) {
        console.log(`\n[TEST-TEND] Year ${current_year}: Triggering Tending on Stand ${stand_id}.`);
        
        // 1. Force Strategy 'economic' (Should produce specific weights)
        agent.managed_stands_data[stand_id].species_profile = "economic";
        
        // 2. Prepare Plan
        var stand_plan = agent.managed_stands_data[stand_id];
        stand_plan.activity.chosen_Activity = 'tending';
        stand_plan.activity.target_year = current_year;
        stand_plan.activity.is_actionable = true;
        
        // 3. Execute
        console.log(`[TEST-TEND] Calling agent.act()...`);
        agent.act([stand_plan]);
        
        // Expected Logs:
        // [Action] Prepared Tending (economic)... Selectivity: { ... }
        // [MEGA-STP] Tending: Fetching species selectivity: { ... }
        
        return true; 
    }

    return false;
};

/* 
* =================================================================================
 * TEST SCENARIO: Verify Femel STP (Visual GUI Check)
 * =================================================================================
 * Forces the Femel sequence on ALL stands of the target agent.
 * Year 2: Initialization (Hole creation)
 * Year 3: Expansion (Hole growth)
 * Year 4: Final (Matrix removal)
 */
Test_Scenarios.verify_femel_stp = function(agent, current_year) {

    // --- CONFIGURATION ---
    const AGENT_ID = "small_agent_1"; 
    
    if (agent.id !== AGENT_ID) return false;

    // Helper to force plan on all stands
    function force_femel_on_all(step_index) {
        var actionable = [];
        var first = true;
        
        agent.managed_stand_ids.forEach(sid => {
            let stand_data = agent.managed_stands_data[sid];
            
            // 1. Force Activity Config
            stand_data.activity.chosen_Activity = 'femel';
            stand_data.activity.is_Sequence = true;
            stand_data.activity.sequence_total_steps = 3; // Select, Step, Final
            stand_data.activity.sequence_current_step = step_index;
            
            // 2. Force Parameters
            stand_data.activity.parameters = { 
                initial_size: 2, // Visible hole size
                growth_width: 1  // Expansion
            }; 
            
            // 3. Force Execution NOW
            stand_data.activity.target_year = current_year;
            stand_data.activity.is_actionable = true;
            
            actionable.push(stand_data);
            
            // Log only one for confirmation
            if (first) {
                console.log(`[TEST-FEMEL] Year ${current_year}: Forcing Step ${step_index} on Stand ${sid} (and all others).`);
                first = false;
            }
        });
        
        // Execute manually to bypass cognitive scheduler
        agent.act(actionable);
    }

    // --- YEAR 2: PHASE 1 - SELECT (Init) ---
    if (current_year === 10) {
        console.log(`\n[TEST-FEMEL] === STARTING FEMEL SEQUENCE ===`);
        // Ensure flags are clean
        agent.managed_stand_ids.forEach(sid => {
            fmengine.standId = sid;
            stand.setFlag('abe_femel_initialized', null);
            stand.setFlag('abe_femel_current_ring', null);
        });

        force_femel_on_all(0); // Step 0: Select
        return true; // Override normal cycle
    }

    // --- YEAR 3: PHASE 2 - STEP (Expand) ---
    if (current_year === 11) {
        force_femel_on_all(1); // Step 1: Expansion
        return true;
    }

    // --- YEAR 4: PHASE 3 - FINAL (Clear) ---
    if (current_year === 14) {
        force_femel_on_all(2); // Step 2: Final
        console.log(`[TEST-FEMEL] === SEQUENCE COMPLETE ===\n`);
        return true;
    }

    return false;
};

// ----- End of File: soco_src/test/scenarios/verify_femel_stp.js -----

Test_Scenarios.global_clearcut_all_stands = function(agent, current_year) {

    const TRIGGER_YEAR = 5;
    const VERIFY_YEAR  = 7;

    // -------------------------------------------------------------------------
    // TRIGGER PHASE — schedule clearcut for all stands of all agents
    // -------------------------------------------------------------------------
    if (current_year === TRIGGER_YEAR) {

        console.log(`\n[GLOBAL CLEARCUT] === TRIGGER YEAR ${current_year} | Agent ${agent.id} ===`);
        console.log(`[GLOBAL CLEARCUT] Scheduling clearcut on ${agent.managed_stand_ids.length} stands`);

        let plans = [];

        agent.managed_stand_ids.forEach(stand_id => {
            let stand_plan = agent.managed_stands_data[stand_id];

            stand_plan.activity.chosen_Activity = 'clearcut';
            stand_plan.activity.target_year     = TRIGGER_YEAR;
            stand_plan.activity.is_actionable   = true;

            // Dummy but valid parameter (MegaSTP just needs something)
            stand_plan.activity.parameters = {
                execution_schedule: 100
            };

            plans.push(stand_plan);
        });

        if (plans.length > 0) {
            agent.act(plans);
            console.log(`[GLOBAL CLEARCUT] Fired ${plans.length} clearcut signals.`);
        }

        return true; // Override normal loop
    }

    // -------------------------------------------------------------------------
    // VERIFICATION PHASE — check execution result
    // -------------------------------------------------------------------------
    if (current_year === VERIFY_YEAR) {

        console.log(`\n[GLOBAL CLEARCUT] === VERIFICATION YEAR ${current_year} | Agent ${agent.id} ===`);

        agent.observe(); // Refresh stand data

        agent.managed_stand_ids.forEach(stand_id => {
            const data = agent.managed_stands_data[stand_id];
            const volume = data.iLand_stand_data.volume;

            fmengine.standId = stand_id;
            const last_act = stand.flag('abe_last_activity');
            const last_year = stand.flag('abe_last_activity_year');

            console.log(`Stand ${stand_id} | Volume: ${volume.toFixed(2)} | LastAct: ${last_act} | Year: ${last_year}`);

            if (volume < 1.0 && last_act === 'MegaSTP_Clearcut') {
                console.log("  ✔ Clearcut confirmed");
            } else {
                console.error("  ✘ Clearcut FAILED or not detected");
            }
        });

        console.log(`[GLOBAL CLEARCUT] === VERIFICATION COMPLETE ===\n`);
        return true;
    }

    return false;
};

/**
 * =================================================================================
 * TEST SCENARIO: Staggered Clearcut by OWNER (identity-safe)
 * =================================================================================
 *
 * Year 5 → big
 * Year 6 → small
 * Year 7 → state
 *
 * Uses ONLY agent.owner identity.
 * =================================================================================
 */
Test_Scenarios.staggered_clearcut_by_owner = function(agent, current_year) {

    // ---------------------------------------------------------------------
    // YEAR → OWNER KEY (STRING, NOT OBJECT)
    // ---------------------------------------------------------------------
    let owner_key = null;

    if (current_year === 5) owner_key = 'big';
    if (current_year === 6) owner_key = 'small';
    if (current_year === 7) owner_key = 'state';

    if (!owner_key) return false;

    const target_owner = OWNERS[owner_key];

    // ---------------------------------------------------------------------
    // HARD GUARD — DEBUG THIS FIRST
    // ---------------------------------------------------------------------
    if (agent.owner !== target_owner) {
        return false;
    }

    console.log(`\n[TEST CLEARCUT] ===============================`);
    console.log(`[TEST CLEARCUT] Year ${current_year}`);
    console.log(`[TEST CLEARCUT] Agent ${agent.id}`);
    console.log(`[TEST CLEARCUT] Owner matched: ${owner_key}`);
    console.log(`[TEST CLEARCUT] Stands: ${agent.managed_stand_ids.length}`);

    let plans = [];

    // ---------------------------------------------------------------------
    // ALL STANDS OF THIS AGENT
    // ---------------------------------------------------------------------
    for (let i = 0; i < agent.managed_stand_ids.length; i++) {

        const stand_id   = agent.managed_stand_ids[i];
        const stand_plan = agent.managed_stands_data[stand_id];

        if (!stand_plan) {
            console.warn(`[TEST CLEARCUT] Missing stand ${stand_id}`);
            continue;
        }

        stand_plan.activity.chosen_Activity = 'clearcut';
        stand_plan.activity.target_year     = current_year;
        stand_plan.activity.is_actionable   = true;
        stand_plan.activity.parameters      = { execution_schedule: 100 };

        plans.push(stand_plan);

        console.log(`[TEST CLEARCUT] → Stand ${stand_id} scheduled`);
    }

    if (plans.length > 0) {
        agent.act(plans);
        console.log(`[TEST CLEARCUT] Fired ${plans.length} actions`);
    }

    console.log(`[TEST CLEARCUT] ===============================\n`);

    return true;
};


/**
 * =================================================================================
 * TEST SCENARIO: Verify Bark Beetle Salvage Pipeline
 * =================================================================================
 * DESCRIPTION:
 * End-to-end test of the bark beetle -> disturbance detection -> salvage pipeline.
 *
 * This test verifies that:
 * 1. Bark beetle outbreak probability is correctly elevated in the outbreak year
 * 2. iLand's onAfterDisturbance callback fires and sets flags on affected stands
 * 3. SOCO agents detect the disturbance via perception (get_iLand_data.js)
 * 4. Cognition correctly prioritizes salvage over normal activities
 * 5. The correct salvage signal is dispatched based on agent preference
 * 6. Monitoring captures disturbance/salvage data in the output
 *
 * CONFIGURATION:
 * Set BARK_BEETLE.OUTBREAK_YEARS in socoabe_config.js to include the test year.
 * Set active_scenario: "verify_barkbeetle_salvage" in TESTING config.
 *
 * The test runs passively - it does NOT override agent logic. It just instruments
 * the observation so you can see the full pipeline in the console log.
 * =================================================================================
 */
Test_Scenarios.verify_barkbeetle_salvage = function(agent, current_year) {

    // --- CONFIGURATION ---
    // Observation years: before, during, and after outbreak
    // Assumes BARK_BEETLE.OUTBREAK_YEARS includes year 15
    var OUTBREAK_YEAR = 15;
    var YEARS_TO_INSPECT = [OUTBREAK_YEAR - 1, OUTBREAK_YEAR, OUTBREAK_YEAR + 1, OUTBREAK_YEAR + 2, OUTBREAK_YEAR + 3];

    // Only run for a single agent to keep output manageable
    if (typeof this._bb_test_agent === 'undefined') {
        this._bb_test_agent = null;
    }

    if (!YEARS_TO_INSPECT.includes(current_year)) {
        return false;
    }

    // Lock onto the first agent we see
    if (this._bb_test_agent === null) {
        this._bb_test_agent = agent.id;
    }
    if (agent.id !== this._bb_test_agent) {
        return false;
    }

    console.log(`\n[BB-TEST] ==================== Year ${current_year} | Agent ${agent.id} ====================`);

    // --- 1. Log bark beetle config state ---
    if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.BARK_BEETLE) {
        var bb = SoCoABE_CONFIG.BARK_BEETLE;
        var is_outbreak = (bb.OUTBREAK_YEARS.indexOf(current_year) !== -1);
        console.log(`[BB-TEST] Bark Beetle Config: ENABLED=${bb.ENABLED}, Is Outbreak Year=${is_outbreak}`);
        console.log(`[BB-TEST]   Outbreak Years: [${bb.OUTBREAK_YEARS.join(', ')}]`);
        console.log(`[BB-TEST]   Outbreak Prob: ${bb.OUTBREAK_PROBABILITY}, Baseline: ${bb.BASELINE_PROBABILITY}`);
    }

    // --- 2. Scan ALL stands of this agent for disturbance flags ---
    var disturbed_stands = [];
    var salvage_stands = [];
    var total_disturbed_volume = 0;

    agent.managed_stand_ids.forEach(function(stand_id) {
        fmengine.standId = stand_id;
        if (!stand || stand.id <= 0) return;

        var dist_detected = stand.flag('abe_disturbance_detected');
        var need_salvage = stand.flag('abe_need_salvage');
        var dist_year = stand.flag('abe_disturbance_year');
        var dist_volume = stand.flag('abe_disturbance_volume') || 0;
        var dist_severity = stand.flag('abe_disturbance_severity') || 0;
        var salvage_type = stand.flag('abe_param_salvage_type');
        var last_activity = stand.flag('abe_last_activity');

        if (dist_detected || need_salvage || (dist_year > 0 && dist_year >= current_year - 2)) {
            disturbed_stands.push({
                id: stand_id,
                detected: dist_detected,
                need_salvage: need_salvage,
                year: dist_year,
                volume: dist_volume,
                severity: dist_severity,
                salvage_type: salvage_type,
                last_activity: last_activity
            });
            total_disturbed_volume += dist_volume;
        }

        if (salvage_type && salvage_type !== 'none') {
            salvage_stands.push(stand_id);
        }
    });

    console.log(`[BB-TEST] Agent ${agent.id}: ${agent.managed_stand_ids.length} total stands`);
    console.log(`[BB-TEST]   Disturbed stands (current + recent): ${disturbed_stands.length}`);
    console.log(`[BB-TEST]   Total disturbed volume: ${total_disturbed_volume.toFixed(1)} m³`);
    console.log(`[BB-TEST]   Stands with salvage type set: ${salvage_stands.length}`);

    // --- 3. Log details of disturbed stands (max 10) ---
    var log_count = Math.min(disturbed_stands.length, 10);
    if (log_count > 0) {
        console.log(`[BB-TEST] --- Disturbed Stand Details (showing ${log_count} of ${disturbed_stands.length}) ---`);
        console.log(`[BB-TEST]   StandID | DetYear | Volume  | Severity | NeedSalvage | SalvageType       | LastActivity`);
        console.log(`[BB-TEST]   ------- | ------- | ------- | -------- | ----------- | ----------------- | ----------------`);
        for (var i = 0; i < log_count; i++) {
            var d = disturbed_stands[i];
            console.log(`[BB-TEST]   ${String(d.id).padEnd(7)} | ${String(d.year).padEnd(7)} | ${d.volume.toFixed(1).padStart(7)} | ${d.severity.toFixed(3).padStart(8)} | ${String(d.need_salvage).padEnd(11)} | ${String(d.salvage_type || 'none').padEnd(17)} | ${d.last_activity || 'none'}`);
        }
    }

    // --- 4. After outbreak: check if SOCO processed the disturbance ---
    if (current_year >= OUTBREAK_YEAR + 1) {
        var processed_count = 0;
        var salvage_executed_count = 0;
        agent.managed_stand_ids.forEach(function(stand_id) {
            var sd = agent.managed_stands_data[stand_id];
            if (sd && sd.iLand_stand_data) {
                if (sd.iLand_stand_data.disturbance_year >= OUTBREAK_YEAR) {
                    processed_count++;
                }
            }
            fmengine.standId = stand_id;
            var last_act = stand.flag('abe_last_activity') || '';
            if (last_act.indexOf('Salvage') !== -1) {
                salvage_executed_count++;
            }
        });
        console.log(`[BB-TEST] Post-outbreak check: ${processed_count} stands with disturbance recorded in agent memory`);
        console.log(`[BB-TEST] Post-outbreak check: ${salvage_executed_count} stands with salvage executed (last_activity contains 'Salvage')`);
    }

    console.log(`[BB-TEST] ==================== End Year ${current_year} ====================\n`);

    return false; // Do NOT override agent logic - let the full pipeline run naturally
};
