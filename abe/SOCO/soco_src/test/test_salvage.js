// =================================================================================
// FILE: soco_src/test/test_salvage.js
// =================================================================================
// DESCRIPTION:
// Test suite for the salvage/disturbance response system.
// Tests disturbance detection, flag setting, and salvage decision logic.
// =================================================================================

var Test_Salvage = {

    /**
     * Run all salvage tests
     */
    run_all_tests: function() {
        console.log("\n========================================");
        console.log("   SALVAGE SYSTEM TEST SUITE");
        console.log("========================================\n");

        var results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Run individual tests
        this.test_disturbance_flag_reading(results);
        this.test_salvage_prepare_production(results);
        this.test_salvage_prepare_biodiversity(results);
        this.test_salvage_prepare_co2(results);
        this.test_think_salvage_priority(results);
        this.test_signal_mapping(results);

        // Summary
        console.log("\n========================================");
        console.log("   TEST RESULTS SUMMARY");
        console.log("========================================");
        console.log(`  Passed: ${results.passed}`);
        console.log(`  Failed: ${results.failed}`);
        console.log(`  Total:  ${results.passed + results.failed}`);
        console.log("========================================\n");

        return results;
    },

    /**
     * Test that disturbance flags are correctly read from iLand
     */
    test_disturbance_flag_reading: function(results) {
        var test_name = "Disturbance Flag Reading";
        console.log(`\n[TEST] ${test_name}`);

        try {
            // Get a test stand
            var test_stand_id = fmengine.standIds[0];
            if (!test_stand_id) {
                throw new Error("No stands available for testing");
            }

            fmengine.standId = test_stand_id;

            // Simulate disturbance flags being set (as onAfterDisturbance would do)
            stand.setFlag('abe_disturbance_detected', true);
            stand.setFlag('abe_disturbance_year', Globals.year);
            stand.setFlag('abe_disturbance_volume', 150);
            stand.setFlag('abe_disturbance_severity', 0.45);
            stand.setFlag('abe_need_salvage', true);

            // Create mock stand_data_obj
            var mock_stand_data = {
                stand_id: test_stand_id,
                iLand_stand_data: {
                    disturbance_detected: false,
                    disturbance_year: -1,
                    disturbance_volume: 0,
                    disturbance_severity: 0,
                    needs_salvage: false
                }
            };

            // Call perception function
            mock_stand_data = Perception.get_iLand_data(mock_stand_data);

            // Verify flags were read correctly
            var checks = [
                { name: "disturbance_detected", expected: true, actual: mock_stand_data.iLand_stand_data.disturbance_detected },
                { name: "disturbance_year", expected: Globals.year, actual: mock_stand_data.iLand_stand_data.disturbance_year },
                { name: "disturbance_volume", expected: 150, actual: mock_stand_data.iLand_stand_data.disturbance_volume },
                { name: "disturbance_severity", expected: 0.45, actual: mock_stand_data.iLand_stand_data.disturbance_severity },
                { name: "needs_salvage", expected: true, actual: mock_stand_data.iLand_stand_data.needs_salvage }
            ];

            var all_passed = true;
            for (var i = 0; i < checks.length; i++) {
                var check = checks[i];
                if (check.actual !== check.expected) {
                    console.log(`    FAIL: ${check.name} - Expected ${check.expected}, got ${check.actual}`);
                    all_passed = false;
                } else {
                    console.log(`    OK: ${check.name} = ${check.actual}`);
                }
            }

            // Cleanup
            stand.setFlag('abe_disturbance_detected', null);
            stand.setFlag('abe_disturbance_year', null);
            stand.setFlag('abe_disturbance_volume', null);
            stand.setFlag('abe_disturbance_severity', null);
            stand.setFlag('abe_need_salvage', null);

            if (all_passed) {
                console.log(`  [PASSED] ${test_name}`);
                results.passed++;
            } else {
                console.log(`  [FAILED] ${test_name}`);
                results.failed++;
            }
            results.tests.push({ name: test_name, passed: all_passed });

        } catch (e) {
            console.log(`  [ERROR] ${test_name}: ${e.message}`);
            results.failed++;
            results.tests.push({ name: test_name, passed: false, error: e.message });
        }
    },

    /**
     * Test salvage prepare function for Production preference
     */
    test_salvage_prepare_production: function(results) {
        var test_name = "Salvage Prepare - Production Preference";
        console.log(`\n[TEST] ${test_name}`);

        try {
            var test_stand_id = fmengine.standIds[0];
            fmengine.standId = test_stand_id;

            // Setup: Severe disturbance (>60%)
            stand.setFlag('abe_disturbance_severity_m3ha', 200);

            var mock_stand_data = {
                stand_id: test_stand_id,
                preference_focus: 'Production',
                iLand_stand_data: {
                    disturbance_severity: 0.7  // 70% severity - severe
                }
            };

            // Call prepare function
            var salvage_type = Action.prepare.salvage({}, mock_stand_data);

            // Production with severe disturbance should trigger clearcut
            var expected_type = 'salvage_clearcut';
            var actual_type = stand.flag('abe_param_salvage_type');

            if (actual_type === expected_type) {
                console.log(`    OK: Severe disturbance -> ${actual_type}`);
                console.log(`  [PASSED] ${test_name}`);
                results.passed++;
                results.tests.push({ name: test_name, passed: true });
            } else {
                console.log(`    FAIL: Expected ${expected_type}, got ${actual_type}`);
                console.log(`  [FAILED] ${test_name}`);
                results.failed++;
                results.tests.push({ name: test_name, passed: false });
            }

            // Cleanup
            Action.prepare.clear_salvage_flags();

        } catch (e) {
            console.log(`  [ERROR] ${test_name}: ${e.message}`);
            results.failed++;
            results.tests.push({ name: test_name, passed: false, error: e.message });
        }
    },

    /**
     * Test salvage prepare function for Biodiversity preference
     */
    test_salvage_prepare_biodiversity: function(results) {
        var test_name = "Salvage Prepare - Biodiversity Preference";
        console.log(`\n[TEST] ${test_name}`);

        try {
            var test_stand_id = fmengine.standIds[0];
            fmengine.standId = test_stand_id;

            // Setup: Moderate disturbance (50%)
            stand.setFlag('abe_disturbance_severity_m3ha', 100);

            var mock_stand_data = {
                stand_id: test_stand_id,
                preference_focus: 'Biodiversity',
                iLand_stand_data: {
                    disturbance_severity: 0.5  // 50% severity - moderate for biodiversity
                }
            };

            // Call prepare function
            var salvage_type = Action.prepare.salvage({}, mock_stand_data);

            // Biodiversity with moderate disturbance should leave for habitat
            var expected_type = 'salvage_leave';
            var actual_type = stand.flag('abe_param_salvage_type');

            if (actual_type === expected_type) {
                console.log(`    OK: Moderate disturbance with Biodiversity -> ${actual_type}`);
                console.log(`  [PASSED] ${test_name}`);
                results.passed++;
                results.tests.push({ name: test_name, passed: true });
            } else {
                console.log(`    FAIL: Expected ${expected_type}, got ${actual_type}`);
                console.log(`  [FAILED] ${test_name}`);
                results.failed++;
                results.tests.push({ name: test_name, passed: false });
            }

            // Cleanup
            Action.prepare.clear_salvage_flags();

        } catch (e) {
            console.log(`  [ERROR] ${test_name}: ${e.message}`);
            results.failed++;
            results.tests.push({ name: test_name, passed: false, error: e.message });
        }
    },

    /**
     * Test salvage prepare function for CO2 preference
     */
    test_salvage_prepare_co2: function(results) {
        var test_name = "Salvage Prepare - CO2 Preference";
        console.log(`\n[TEST] ${test_name}`);

        try {
            var test_stand_id = fmengine.standIds[0];
            fmengine.standId = test_stand_id;

            // Setup: Moderate disturbance (40%)
            stand.setFlag('abe_disturbance_severity_m3ha', 80);

            var mock_stand_data = {
                stand_id: test_stand_id,
                preference_focus: 'CO2',
                iLand_stand_data: {
                    disturbance_severity: 0.4  // 40% severity
                }
            };

            // Call prepare function
            var salvage_type = Action.prepare.salvage({}, mock_stand_data);

            // CO2 with moderate disturbance should salvage but leave some as carbon store
            var expected_type = 'salvage_harvest';
            var actual_type = stand.flag('abe_param_salvage_type');
            var salvage_fraction = stand.flag('abe_param_salvage_fraction');

            var passed = (actual_type === expected_type && salvage_fraction < 1.0);

            if (passed) {
                console.log(`    OK: Moderate disturbance with CO2 -> ${actual_type} (fraction: ${salvage_fraction})`);
                console.log(`  [PASSED] ${test_name}`);
                results.passed++;
            } else {
                console.log(`    FAIL: Expected ${expected_type} with fraction < 1.0, got ${actual_type} (fraction: ${salvage_fraction})`);
                console.log(`  [FAILED] ${test_name}`);
                results.failed++;
            }
            results.tests.push({ name: test_name, passed: passed });

            // Cleanup
            Action.prepare.clear_salvage_flags();

        } catch (e) {
            console.log(`  [ERROR] ${test_name}: ${e.message}`);
            results.failed++;
            results.tests.push({ name: test_name, passed: false, error: e.message });
        }
    },

    /**
     * Test that think.js correctly prioritizes salvage
     */
    test_think_salvage_priority: function(results) {
        var test_name = "Think - Salvage Priority";
        console.log(`\n[TEST] ${test_name}`);

        try {
            var test_stand_id = fmengine.standIds[0];
            fmengine.standId = test_stand_id;

            // Create mock stand_data with needs_salvage = true
            var mock_stand_data = {
                stand_id: test_stand_id,
                preference_focus: 'Production',
                iLand_stand_data: {
                    needs_salvage: true,
                    disturbance_severity: 0.5,
                    disturbance_volume: 100,
                    needs_reassessment: false
                },
                activity: {
                    chosen_Activity: 'shelterwood',  // Ongoing activity should be overridden
                    is_Sequence: true,
                    is_actionable: false
                }
            };

            // Mock agent
            var mock_agent = {
                planning_offset: 0
            };

            // Call think
            var result = Cognition.think(mock_stand_data, mock_agent);

            // Verify salvage was chosen
            var passed = (result.activity.chosen_Activity === 'salvage' && result.activity.is_actionable === true);

            if (passed) {
                console.log(`    OK: Salvage priority correctly overrode ongoing activity`);
                console.log(`    Activity: ${result.activity.chosen_Activity}, Actionable: ${result.activity.is_actionable}`);
                console.log(`  [PASSED] ${test_name}`);
                results.passed++;
            } else {
                console.log(`    FAIL: Expected salvage, got ${result.activity.chosen_Activity}`);
                console.log(`  [FAILED] ${test_name}`);
                results.failed++;
            }
            results.tests.push({ name: test_name, passed: passed });

        } catch (e) {
            console.log(`  [ERROR] ${test_name}: ${e.message}`);
            results.failed++;
            results.tests.push({ name: test_name, passed: false, error: e.message });
        }
    },

    /**
     * Test signal mapping for salvage activities
     */
    test_signal_mapping: function(results) {
        var test_name = "Signal Mapping - Salvage Types";
        console.log(`\n[TEST] ${test_name}`);

        try {
            var test_stand_id = fmengine.standIds[0];
            fmengine.standId = test_stand_id;

            // Test each salvage type maps to correct signal
            var test_cases = [
                { salvage_type: 'salvage_harvest', expected_signal: 'do_salvage_harvest' },
                { salvage_type: 'salvage_clearcut', expected_signal: 'do_salvage_clearcut' },
                { salvage_type: 'salvage_leave', expected_signal: 'do_salvage_leave' }
            ];

            var all_passed = true;

            for (var i = 0; i < test_cases.length; i++) {
                var tc = test_cases[i];

                // Set the salvage type flag
                stand.setFlag('abe_param_salvage_type', tc.salvage_type);

                // The signal logic from act.js
                var signal_name = 'do_' + (stand.flag('abe_param_salvage_type') || 'salvage_harvest');

                if (signal_name === tc.expected_signal) {
                    console.log(`    OK: ${tc.salvage_type} -> ${signal_name}`);
                } else {
                    console.log(`    FAIL: ${tc.salvage_type} -> Expected ${tc.expected_signal}, got ${signal_name}`);
                    all_passed = false;
                }
            }

            // Cleanup
            stand.setFlag('abe_param_salvage_type', null);

            if (all_passed) {
                console.log(`  [PASSED] ${test_name}`);
                results.passed++;
            } else {
                console.log(`  [FAILED] ${test_name}`);
                results.failed++;
            }
            results.tests.push({ name: test_name, passed: all_passed });

        } catch (e) {
            console.log(`  [ERROR] ${test_name}: ${e.message}`);
            results.failed++;
            results.tests.push({ name: test_name, passed: false, error: e.message });
        }
    },

    /**
     * Simulate a disturbance event for integration testing
     * This manually triggers what onAfterDisturbance would do
     */
    simulate_disturbance: function(stand_id, disturbed_volume) {
        console.log(`\n[SIMULATE] Triggering disturbance on stand ${stand_id}`);

        fmengine.standId = stand_id;

        if (!stand || stand.id <= 0) {
            console.error("Invalid stand ID");
            return false;
        }

        var severity_m3ha = disturbed_volume / stand.area;
        var volume_before = stand.volume + disturbed_volume;
        var severity_fraction = (volume_before > 0) ? disturbed_volume / volume_before : 0;

        console.log(`  Disturbed volume: ${disturbed_volume.toFixed(1)} m³`);
        console.log(`  Severity: ${(severity_fraction * 100).toFixed(1)}%`);

        // Set flags as onAfterDisturbance would
        stand.setFlag('abe_disturbance_detected', true);
        stand.setFlag('abe_disturbance_year', Globals.year);
        stand.setFlag('abe_disturbance_volume', disturbed_volume);
        stand.setFlag('abe_disturbance_severity', severity_fraction);
        stand.setFlag('abe_disturbance_severity_m3ha', severity_m3ha);
        stand.setFlag('abe_need_salvage', true);
        stand.setFlag('abe_need_reassessment', true);

        console.log(`  Flags set. Stand marked for salvage.`);
        return true;
    }
};

// Make available globally
this.Test_Salvage = Test_Salvage;
console.log("--- Test_Salvage module loaded. Use Test_Salvage.run_all_tests() to run tests. ---");
