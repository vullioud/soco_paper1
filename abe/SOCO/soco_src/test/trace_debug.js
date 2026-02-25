/**
 * =================================================================================
 * FILE: soco_src/test/debug_trace.js
 * =================================================================================
 * DESCRIPTION:
 * Monkey-patches specific agents to log every step of their lifecycle.
 * This reveals exactly which line of code causes the "silent death" (crash).
 * =================================================================================
 */

var DebugTrace = {

    /**
     * Call this in the console: DebugTrace.enable(['state_agent_1', 'big_agent_1']);
     */
    enable: function(agent_ids) {
        if (!socoabe || !socoabe.institution) {
            console.error("SoCoABE not initialized.");
            return;
        }

        console.log(`\n[TRACE] Enabling lifecycle tracing for: ${agent_ids.join(', ')}`);

        agent_ids.forEach(id => {
            const agent = socoabe.institution.all_agents.find(a => a.id === id);
            if (!agent) {
                console.warn(`[TRACE] Agent ${id} not found.`);
                return;
            }

            // --- 1. Wrap run_yearly_cycle ---
            const original_run = agent.run_yearly_cycle.bind(agent);
            
            agent.run_yearly_cycle = function(current_year) {
                console.log(`\n[TRACE] >>> START CYCLE: Agent ${this.id} (Year ${current_year})`);
                try {
                    
                    // Step A: Observation
                    console.log(`[TRACE] ${this.id}: Starting Observe...`);
                    this.observe();
                    // Check if observation worked
                    const sample_stand = this.managed_stands_data[this.managed_stand_ids[0]];
                    console.log(`[TRACE] ${this.id}: Observe done. Stand ${sample_stand.stand_id} observed year: ${sample_stand.iLand_stand_data.year_of_observation}`);

                    // Step B: Perception
                    console.log(`[TRACE] ${this.id}: Starting Perceive Unit...`);
                    this.perceive_unit();

                    // Step C: Cognition
                    console.log(`[TRACE] ${this.id}: Starting Cognition...`);
                    
                    // We interpret 'cognitize' manually to catch errors inside the loop
                    const actionable_stands = [];
                    for (const stand_id in this.managed_stands_data) {
                        let stand_data = this.managed_stands_data[stand_id];
                        
                        // Trace specific logic for one stand to reduce noise
                        if (stand_id === this.managed_stand_ids[0]) {
                            console.log(`[TRACE-DETAIL] Stand ${stand_id}: Calling Cognition.think...`);
                            console.log(`[TRACE-DETAIL]   - Current Activity: ${stand_data.activity.chosen_Activity}`);
                        }

                        // THE CRITICAL POINT: Often crashes here due to missing table entries
                        stand_data = Cognition.think(stand_data, this);
                        
                        this.managed_stands_data[stand_id] = stand_data;

                        if (stand_data.activity.is_actionable && stand_data.activity.target_year === current_year) {
                            actionable_stands.push(stand_data);
                        }
                    }
                    console.log(`[TRACE] ${this.id}: Cognition done. Actionable stands: ${actionable_stands.length}`);

                    // Step D: Action
                    if (actionable_stands.length > 0) {
                        console.log(`[TRACE] ${this.id}: Starting Action (Triggering ${actionable_stands.length} stands)...`);
                        // We wrap act manually too
                        for (var i = 0; i < actionable_stands.length; i++) {
                            var stand_data = actionable_stands[i];
                            console.log(`[TRACE-ACT] Triggering ${stand_data.activity.chosen_Activity} on ${stand_data.stand_id}`);
                            Action.trigger_activity(stand_data);
                        }
                    }

                    console.log(`[TRACE] <<< END CYCLE: Agent ${this.id} Success.\n`);

                } catch (e) {
                    console.error(`\n[CRITICAL CRASH] Agent ${this.id} died!`);
                    console.error(`ERROR MESSAGE: ${e.message}`);
                    console.error(`STACK TRACE:\n${e.stack}`);
                    // Re-throw so the main loop usually handles it, or we suppress it here to let others run
                }
            };
        });
        
        console.log("[TRACE] Agents instrumented. Run the simulation to see logs.");
    }
};

this.DebugTrace = DebugTrace;

var Inspector = {

    dump: function(agent_id) {
        if (!socoabe || !socoabe.institution) {
            console.error("SoCoABE not initialized.");
            return;
        }

        const agent = socoabe.institution.all_agents.find(a => a.id === agent_id);
        if (!agent) {
            console.error(`Agent '${agent_id}' not found.`);
            return;
        }

        console.log(`\n=============================================================`);
        console.log(`FULL DUMP: Agent ${agent.id} (Year ${Globals.year})`);
        console.log(`Owner: ${agent.owner.type} | Stands: ${agent.managed_stand_ids.length}`);
        console.log(`=============================================================\n`);

        for (const stand_id in agent.managed_stands_data) {
            const s = agent.managed_stands_data[stand_id];
            
            // Create a clean summary object to log
            const snapshot = {
                id: s.stand_id,
                
                // 1. WHAT THE AGENT SEES
                perception: {
                    age: s.iLand_stand_data.stand_age.toFixed(1),
                    soco_age: s.iLand_stand_data.absolute_age_soco,
                    volume: s.iLand_stand_data.volume.toFixed(1),
                    needs_reassessment: s.iLand_stand_data.needs_reassessment,
                    obs_year: s.iLand_stand_data.year_of_observation
                },

                // 2. HOW IT CLASSIFIES IT
                classification: {
                    age_class: s.classified.age_class,
                    structure: s.classified.structure_class,
                    preference: s.preference_focus
                },

                // 3. WHAT IT REMEMBERS
                history: {
                    last_act: s.history.last_activity,
                    last_year: s.history.last_activity_Year,
                    last_satisfied: s.history.last_satisfied_phase
                },

                // 4. THE CURRENT PLAN (CRITICAL PART)
                plan: {
                    activity: s.activity.chosen_Activity,
                    target_year: s.activity.target_year,
                    actionable: s.activity.is_actionable,
                    is_sequence: s.activity.is_Sequence,
                    step: `${s.activity.sequence_current_step} / ${s.activity.sequence_total_steps}`,
                    
                    // IF PARAMS ARE EMPTY, THIS IS YOUR BUG
                    parameters: s.activity.parameters 
                }
            };

            console.log(`--- STAND ${stand_id} ---`);
            console.log(JSON.stringify(snapshot, null, 2));
        }
        console.log(`\n=============================================================\n`);
    }
};

this.Inspector = Inspector;