/**
 * Test Suite: Harvest Volume Tracking
 *
 * Tests the implementation of volume tracking across all harvest activities.
 * Run this test after implementing harvest tracking to verify functionality.
 *
 * Usage: Include this file in your test runner or run specific tests manually
 */

var HarvestVolumeTrackingTests = {

    // ==========================================
    // TEST 1: CLEARCUT VOLUME TRACKING
    // ==========================================
    test_clearcut_volume_tracking: function() {
        console.log("\n=== TEST 1: Clearcut Volume Tracking ===");

        /**
         * Test Plan:
         * 1. Create a test stand with known volume
         * 2. Trigger clearcut activity
         * 3. Verify flags are set correctly
         * 4. Verify stand_data receives harvest information
         *
         * Expected Results:
         * - abe_last_harvest_volume > 0
         * - abe_last_harvest_trees > 0
         * - abe_last_harvest_year === current year
         * - stand.volume ≈ 0 after clearcut
         * - stand_data.iLand_stand_data.last_harvest_volume > 0
         */

        return {
            description: "Test volume tracking in clearcut activity",
            setup: "Create mature stand, trigger clearcut via signal",
            assertions: [
                "Flag 'abe_last_harvest_volume' is set and > 0",
                "Flag 'abe_last_harvest_trees' is set and > 0",
                "Flag 'abe_last_harvest_year' equals current year",
                "Standing volume after clearcut is near zero",
                "stand_data.iLand_stand_data.last_harvest_volume reflects removal",
                "stand_data.history.harvest_events array has 1 entry"
            ],
            implementation_notes: "Requires agent to trigger 'do_clearcut' signal on test stand"
        };
    },

    // ==========================================
    // TEST 2: TARGET DBH VOLUME TRACKING
    // ==========================================
    test_targetDBH_volume_tracking: function() {
        console.log("\n=== TEST 2: TargetDBH Volume Tracking ===");

        return {
            description: "Test volume tracking in targetDBH harvest",
            setup: "Create mixed species stand, set DBH targets, trigger targetDBH",
            assertions: [
                "Volume removed corresponds to trees above target DBH",
                "Tree count matches trees filtered",
                "Volume before - volume after = volume_removed (within tolerance)",
                "Species-specific harvesting tracked correctly"
            ],
            implementation_notes: "Set abe_param_dbhList flag with species:dbh mappings"
        };
    },

    // ==========================================
    // TEST 3: THINNING FROM BELOW VOLUME TRACKING
    // ==========================================
    test_thinningFromBelow_volume_tracking: function() {
        console.log("\n=== TEST 3: ThinningFromBelow Volume Tracking ===");

        return {
            description: "Test volume tracking in built-in thinning activity (Pattern B)",
            setup: "Create dense stand, set thinning share (e.g., 30%), trigger thinning",
            assertions: [
                "Volume removed is approximately targetShare of original volume",
                "onExecute captures volume_before in flag",
                "onExecuted calculates volume_removed correctly",
                "Built-in C++ thinning tracked successfully"
            ],
            implementation_notes: "Pattern B: volume captured in onExecute, calculated in onExecuted"
        };
    },

    // ==========================================
    // TEST 4: CUMULATIVE HARVEST TRACKING
    // ==========================================
    test_cumulative_harvest_tracking: function() {
        console.log("\n=== TEST 4: Cumulative Harvest Tracking ===");

        return {
            description: "Test rotation total harvest accumulation over multiple activities",
            setup: "Execute sequence: Thinning (year 20), Thinning (year 30), Clearcut (year 40)",
            assertions: [
                "After first thinning: rotation_total_harvest = thinning1_volume",
                "After second thinning: rotation_total_harvest = thinning1 + thinning2",
                "After clearcut: rotation_total_harvest = thinning1 + thinning2 + clearcut",
                "harvest_events array has 3 entries",
                "Sum of harvest_events volumes equals rotation_total_harvest"
            ],
            implementation_notes: "Verifies cumulative tracking across rotation"
        };
    },

    // ==========================================
    // TEST 5: PERCEPTION INTEGRATION
    // ==========================================
    test_perception_data_flow: function() {
        console.log("\n=== TEST 5: Perception Data Flow ===");

        return {
            description: "Test harvest data flows through perception to stand_data",
            setup: "Execute harvest, trigger perception update (next simulation step)",
            assertions: [
                "Immediately after harvest: stand flags are set",
                "After perception update: stand_data.iLand_stand_data fields populated",
                "years_since_harvest calculated correctly",
                "harvest_events array in stand_data.history populated",
                "activity_history includes volume_removed in context"
            ],
            implementation_notes: "Tests full data pipeline from activity → flags → perception → stand_data"
        };
    },

    // ==========================================
    // TEST 6: ALL ACTIVITIES COVERAGE
    // ==========================================
    test_all_activities_coverage: function() {
        console.log("\n=== TEST 6: All Activities Coverage ===");

        var activities_to_test = [
            'clearcut',              // Pattern A
            'targetDBH',             // Pattern A
            'plenter',               // Pattern A
            'selectiveThinning_remove', // Pattern A
            'femel_select',          // Pattern A
            'femel_step',            // Pattern A
            'femel_final',           // Pattern A
            'shelterwood_select',    // Pattern B
            'shelterwood_remove',    // Pattern A
            'shelterwood_final',     // Pattern A
            'thinningFromBelow',     // Pattern B
            'tending'                // Pattern B
        ];

        return {
            description: "Verify all 12 harvest activities track volume",
            setup: "Create appropriate test scenarios for each activity",
            activities: activities_to_test,
            assertions: [
                "Each activity sets abe_last_harvest_volume flag",
                "Each activity sets abe_last_harvest_trees flag (or 0 for built-in)",
                "Each activity sets abe_last_harvest_year flag",
                "Volume tracking works for both Pattern A and Pattern B activities"
            ],
            implementation_notes: "Comprehensive test of all activities"
        };
    },

    // ==========================================
    // TEST 7: EDGE CASES
    // ==========================================
    test_edge_cases: function() {
        console.log("\n=== TEST 7: Edge Cases ===");

        return {
            description: "Test edge cases and error handling",
            scenarios: [
                {
                    name: "No trees to harvest",
                    test: "Trigger harvest on empty stand",
                    expected: "volume_removed = 0, no crash"
                },
                {
                    name: "Very small volume",
                    test: "Harvest stand with <1 m³/ha",
                    expected: "Decimal precision handled correctly"
                },
                {
                    name: "Rotation reset after clearcut",
                    test: "Clearcut, then check if rotation_total persists or resets",
                    expected: "Decision needed: reset or persist?"
                },
                {
                    name: "stand.reload() not available",
                    test: "Test graceful handling if reload() doesn't exist",
                    expected: "No crash, volume calculated with available methods"
                },
                {
                    name: "Multiple harvests same year",
                    test: "Trigger two different harvest activities in same year",
                    expected: "Only last activity's volume stored in flags"
                }
            ],
            implementation_notes: "Tests robustness and edge case handling"
        };
    },

    // ==========================================
    // MANUAL TEST HELPER FUNCTIONS
    // ==========================================

    /**
     * Helper: Check stand flags after harvest
     */
    check_harvest_flags: function(stand_id) {
        fmengine.standId = stand_id;
        if (!stand || stand.id <= 0) {
            console.error("Invalid stand ID");
            return false;
        }

        var volume = stand.flag('abe_last_harvest_volume');
        var trees = stand.flag('abe_last_harvest_trees');
        var year = stand.flag('abe_last_harvest_year');
        var total = stand.flag('abe_rotation_total_harvest');

        console.log(`\n--- Harvest Flags for Stand ${stand_id} ---`);
        console.log(`  Last Harvest Volume: ${volume ? volume.toFixed(2) : 'NOT SET'} m³/ha`);
        console.log(`  Last Harvest Trees: ${trees || 'NOT SET'}`);
        console.log(`  Last Harvest Year: ${year || 'NOT SET'}`);
        console.log(`  Rotation Total Harvest: ${total ? total.toFixed(2) : 0} m³/ha`);

        return (volume !== null && trees !== null && year !== null);
    },

    /**
     * Helper: Check stand_data harvest fields
     */
    check_stand_data_harvest: function(stand_data_obj) {
        if (!stand_data_obj) {
            console.error("No stand_data object provided");
            return false;
        }

        const data = stand_data_obj.iLand_stand_data;
        const history = stand_data_obj.history;

        console.log(`\n--- Stand Data Harvest Fields ---`);
        console.log(`  last_harvest_volume: ${data.last_harvest_volume} m³/ha`);
        console.log(`  last_harvest_trees: ${data.last_harvest_trees}`);
        console.log(`  last_harvest_year: ${data.last_harvest_year}`);
        console.log(`  years_since_harvest: ${data.years_since_harvest}`);
        console.log(`  rotation_total_harvest: ${data.rotation_total_harvest} m³/ha`);
        console.log(`  harvest_events count: ${history.harvest_events.length}`);

        if (history.harvest_events.length > 0) {
            console.log(`\n  Recent harvest events:`);
            history.harvest_events.slice(-3).forEach(function(event) {
                console.log(`    Year ${event.year}: ${event.activity} - ${event.volume_removed.toFixed(2)} m³/ha`);
            });
        }

        return true;
    },

    /**
     * Helper: Compare volumes for validation
     */
    validate_volume_calculation: function(stand_id, expected_removed) {
        fmengine.standId = stand_id;
        if (!stand || stand.id <= 0) return false;

        var actual_removed = stand.flag('abe_last_harvest_volume') || 0;
        var diff = Math.abs(actual_removed - expected_removed);
        var tolerance = 1.0; // 1 m³/ha tolerance

        console.log(`\n--- Volume Validation ---`);
        console.log(`  Expected Removed: ${expected_removed.toFixed(2)} m³/ha`);
        console.log(`  Actual Removed: ${actual_removed.toFixed(2)} m³/ha`);
        console.log(`  Difference: ${diff.toFixed(2)} m³/ha`);
        console.log(`  Within Tolerance: ${diff < tolerance ? 'YES' : 'NO'}`);

        return diff < tolerance;
    },

    // ==========================================
    // RUN ALL TESTS (SUMMARY)
    // ==========================================
    run_all_tests: function() {
        console.log("\n========================================");
        console.log("HARVEST VOLUME TRACKING TEST SUITE");
        console.log("========================================\n");

        console.log("This test suite verifies harvest volume tracking implementation.");
        console.log("Each test should be run manually with appropriate stand setup.\n");

        var tests = [
            this.test_clearcut_volume_tracking(),
            this.test_targetDBH_volume_tracking(),
            this.test_thinningFromBelow_volume_tracking(),
            this.test_cumulative_harvest_tracking(),
            this.test_perception_data_flow(),
            this.test_all_activities_coverage(),
            this.test_edge_cases()
        ];

        console.log(`\nTotal Tests Defined: ${tests.length}\n`);

        tests.forEach(function(test, index) {
            console.log(`${index + 1}. ${test.description}`);
            console.log(`   Setup: ${test.setup || 'See test definition'}`);
            if (test.assertions) {
                console.log(`   Assertions (${test.assertions.length}):`);
                test.assertions.forEach(function(assertion) {
                    console.log(`     - ${assertion}`);
                });
            }
            if (test.activities) {
                console.log(`   Activities to test (${test.activities.length}):`);
                test.activities.forEach(function(activity) {
                    console.log(`     - ${activity}`);
                });
            }
            console.log();
        });

        console.log("========================================");
        console.log("To run individual tests, call:");
        console.log("  HarvestVolumeTrackingTests.test_clearcut_volume_tracking()");
        console.log("To check flags after harvest:");
        console.log("  HarvestVolumeTrackingTests.check_harvest_flags(stand_id)");
        console.log("To check stand_data:");
        console.log("  HarvestVolumeTrackingTests.check_stand_data_harvest(stand_data_obj)");
        console.log("========================================\n");
    }
};

// Export for use in simulation
this.HarvestVolumeTrackingTests = HarvestVolumeTrackingTests;

// ==========================================
// INTEGRATION WITH Test_Scenarios
// ==========================================

if (typeof Test_Scenarios === 'undefined') {
    var Test_Scenarios = {};
}

/**
 * Test Scenario: Inspect Harvest Volume After Activity
 * Usage: Set SoCoABE_CONFIG.TESTING.active_scenario = 'inspect_harvest_volume'
 */
Test_Scenarios.inspect_harvest_volume = function(agent, current_year) {
    // Configuration
    const AGENT_ID_TO_INSPECT = "small_agent_1";  // Change as needed
    const YEARS_TO_INSPECT = [15, 20, 25, 40];    // Years to check

    if (agent.id !== AGENT_ID_TO_INSPECT || !YEARS_TO_INSPECT.includes(current_year)) {
        return;
    }

    const stand_id = agent.managed_stand_ids[0];
    if (typeof stand_id === 'undefined') return;

    console.log(`\n[TEST] ==================== Harvest Volume Inspection - Year ${current_year} ====================`);

    // Check flags
    HarvestVolumeTrackingTests.check_harvest_flags(stand_id);

    // Check stand_data
    let stand_data_obj = agent.managed_stands_data[stand_id];
    if (stand_data_obj) {
        HarvestVolumeTrackingTests.check_stand_data_harvest(stand_data_obj);
    }

    console.log(`[TEST] ==================== Inspection Complete ====================\n`);
};

// Auto-run summary when loaded
if (typeof Globals !== 'undefined' && Globals.year === 0) {
    console.log("\n[Test Suite Loaded] Harvest Volume Tracking Tests");
    console.log("Call HarvestVolumeTrackingTests.run_all_tests() to see test descriptions");
    console.log("Or set TESTING.active_scenario = 'inspect_harvest_volume' in config");
}
