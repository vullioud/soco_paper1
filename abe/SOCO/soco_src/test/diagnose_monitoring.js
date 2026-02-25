/**
 * Diagnostic tool for monitoring issues
 * Run in console: DiagnoseMonitoring.run()
 */

var DiagnoseMonitoring = {

    run: function() {
        console.log("\n" + "=".repeat(80));
        console.log("MONITORING DIAGNOSTIC TOOL");
        console.log("=".repeat(80) + "\n");

        if (!socoabe || !socoabe.institution) {
            console.error("✗ SoCoABE not initialized");
            return;
        }

        const agents = socoabe.institution.all_agents;
        console.log(`✓ Found ${agents.length} agents\n`);

        // Count stands by status
        let total_stands = 0;
        let stands_with_detailed = 0;
        let stands_with_activity_log = 0;
        let stands_with_planned_activity = 0;
        let stands_activity_happening_now = 0;
        let activity_types = {};

        agents.forEach(agent => {
            for (const stand_id in agent.managed_stands_data) {
                total_stands++;
                const stand = agent.managed_stands_data[stand_id];

                // Check detailed history
                if (stand.detailed_history && stand.detailed_history.length > 0) {
                    stands_with_detailed++;
                }

                // Check activity history log
                if (stand.activity_history && stand.activity_history.log && stand.activity_history.log.length > 0) {
                    stands_with_activity_log++;
                }

                // Check if activity is planned
                if (stand.activity && stand.activity.chosen_Activity !== 'noManagement') {
                    stands_with_planned_activity++;

                    // Count activity types
                    const act = stand.activity.chosen_Activity;
                    activity_types[act] = (activity_types[act] || 0) + 1;

                    // Check if happening this year
                    if (stand.activity.target_year === Globals.year) {
                        stands_activity_happening_now++;
                    }
                }
            }
        });

        console.log("=== STAND STATUS ===");
        console.log(`Total stands: ${total_stands}`);
        console.log(`  Monitoring candidates (detailed_history): ${stands_with_detailed} (${(stands_with_detailed/total_stands*100).toFixed(1)}%)`);
        console.log(`  With activity history logs: ${stands_with_activity_log} (${(stands_with_activity_log/total_stands*100).toFixed(1)}%)`);
        console.log(`  With planned activities: ${stands_with_planned_activity} (${(stands_with_planned_activity/total_stands*100).toFixed(1)}%)`);
        console.log(`  Activities executing THIS year: ${stands_activity_happening_now}`);

        if (stands_with_activity_log === 0) {
            console.log("\n⚠ WARNING: No activity history logs found!");
            console.log("\nPossible causes:");
            console.log("  1. Simulation just started (no activities executed yet)");
            console.log("  2. All agents choosing 'noManagement' (check activity_types below)");
            console.log("  3. Bug in monitoring.js (now fixed - restart simulation)");
            console.log("\nSolution:");
            console.log("  - Run simulation for 10+ years");
            console.log("  - Check activity_types distribution below");
        }

        console.log("\n=== PLANNED ACTIVITY DISTRIBUTION ===");
        if (Object.keys(activity_types).length === 0) {
            console.log("  No activities planned (all 'noManagement')");
        } else {
            for (const act in activity_types) {
                console.log(`  ${act}: ${activity_types[act]} stands`);
            }
        }

        // Check monitoring config
        console.log("\n=== MONITORING CONFIG ===");
        if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.MONITORING) {
            const mon = SoCoABE_CONFIG.MONITORING;
            console.log(`  Enabled: ${mon.ENABLED}`);
            console.log(`  Mode: ${mon.mode}`);
            console.log(`  Sample size: ${mon.sample_size}`);
            console.log(`  Aggregation interval: ${mon.agg_interval}`);

            if (!mon.ENABLED) {
                console.error("\n✗ MONITORING IS DISABLED!");
                console.error("   Enable in socoabe_config.js: MONITORING.ENABLED = true");
            }
        } else {
            console.error("✗ Monitoring config not found");
        }

        // Sample one stand with activity history
        console.log("\n=== SAMPLE ACTIVITY LOG ===");
        let sample_found = false;
        for (const agent of agents) {
            for (const stand_id in agent.managed_stands_data) {
                const stand = agent.managed_stands_data[stand_id];
                if (stand.activity_history && stand.activity_history.log && stand.activity_history.log.length > 0) {
                    console.log(`Agent: ${agent.id}, Stand: ${stand_id}`);
                    console.log(`Activity log entries: ${stand.activity_history.log.length}`);
                    console.log("\nMost recent entry:");
                    const recent = stand.activity_history.log[stand.activity_history.log.length - 1];
                    console.log(`  Year: ${recent.year}`);
                    console.log(`  Activity: ${recent.activity_name}`);
                    console.log(`  Age class: ${recent.age_class}`);
                    console.log(`  Structure: ${recent.structure_class}`);
                    sample_found = true;
                    break;
                }
            }
            if (sample_found) break;
        }

        if (!sample_found) {
            console.log("  (No activity logs found yet)");
        }

        // Check aggregated history
        console.log("\n=== AGGREGATED HISTORY ===");
        if (Monitoring.aggregated_history) {
            console.log(`Records: ${Monitoring.aggregated_history.length}`);
            if (Monitoring.aggregated_history.length > 0) {
                const last = Monitoring.aggregated_history[Monitoring.aggregated_history.length - 1];
                console.log(`Last record year: ${last.year}`);
            }
        } else {
            console.log("  No aggregated history");
        }

        console.log("\n=== RECOMMENDATIONS ===");
        if (stands_with_activity_log === 0 && Globals.year < 10) {
            console.log("✓ Simulation is young - activities will be logged as they execute");
            console.log("  Run for 10+ years and re-run this diagnostic");
        } else if (stands_with_activity_log === 0 && stands_with_planned_activity > 0) {
            console.log("⚠ Activities are planned but not logged yet");
            console.log("  Check that planned activities are actually executing (target_year reached)");
        } else if (stands_with_activity_log === 0 && stands_with_planned_activity === 0) {
            console.error("✗ PROBLEM: No activities planned at all!");
            console.error("  Check agent decision-making logic (select_activity.js)");
        } else {
            console.log("✓ Activity logging appears to be working");
            console.log(`  ${stands_with_activity_log} stands have logged activities`);
        }

        console.log("\n" + "=".repeat(80) + "\n");
    }
};

this.DiagnoseMonitoring = DiagnoseMonitoring;
