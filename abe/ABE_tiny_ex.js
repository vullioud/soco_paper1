// ----- START OF FINAL, FULLY CORRECTED FILE: ABE_tiny_ex.js -----

/**
 * =================================================================================
 * FILE: ABE_tiny_ex.js (Final Architecture)
 * =================================================================================
 */

console.log("--- Loading SoCoABE (Final Debugging) ---");
fmengine.verbose = true;

var socoabe;

try {
    Globals.include(Globals.path('./abe/load_all_files.js'));
    console.log("--- All ABE files loaded successfully. ---");

    // --- Override SoCoABE_CONFIG from user.* CLI settings ---
    // These are set by the runner via iLand CLI overrides (config.toml → run_table → CLI)
    try {
        var bb_val = Globals.setting('user.bb_enabled');
        if (bb_val === 'false') {
            SoCoABE_CONFIG.BARK_BEETLE.ENABLED = false;
            SoCoABE_CONFIG.DISTURBANCE_START_YEAR = 99999;
        }
    } catch(e) {}
    try {
        var ds_val = Globals.setting('user.disturbance_start_year');
        if (ds_val) SoCoABE_CONFIG.DISTURBANCE_START_YEAR = parseInt(ds_val, 10);
    } catch(e) {}
    try {
        var op_val = Globals.setting('user.outbreak_probability');
        if (op_val) SoCoABE_CONFIG.BARK_BEETLE.OUTBREAK_PROBABILITY = parseFloat(op_val);
    } catch(e) {}
    try {
        var bp_val = Globals.setting('user.baseline_probability');
        if (bp_val) SoCoABE_CONFIG.BARK_BEETLE.BASELINE_PROBABILITY = parseFloat(bp_val);
    } catch(e) {}
    // Override outbreak window (resilience experiment: years 150-210)
    try {
        var os_val = Globals.setting('user.outbreak_start_year');
        var oe_val = Globals.setting('user.outbreak_end_year');
        if (os_val && oe_val) {
            var ob_start = parseInt(os_val, 10);
            var ob_end = parseInt(oe_val, 10);
            var ob_years = [];
            for (var oy = ob_start; oy <= ob_end; oy++) ob_years.push(oy);
            SoCoABE_CONFIG.BARK_BEETLE.OUTBREAK_YEARS = ob_years;
            console.log("[CONFIG] Outbreak window overridden: years " + ob_start + "-" + ob_end);
        }
    } catch(e) {}
    // Override management enabled flag (no-management control)
    try {
        var mgmt_val = Globals.setting('user.management_enabled');
        if (mgmt_val === 'false') {
            SoCoABE_CONFIG.MANAGEMENT_ENABLED = false;
            console.log("[CONFIG] Management DISABLED (no-management control)");
        }
    } catch(e) {}
    console.log("[CONFIG] BB=" + SoCoABE_CONFIG.BARK_BEETLE.ENABLED +
        " start=" + SoCoABE_CONFIG.DISTURBANCE_START_YEAR +
        " outbreakProb=" + SoCoABE_CONFIG.BARK_BEETLE.OUTBREAK_PROBABILITY +
        " baselineProb=" + SoCoABE_CONFIG.BARK_BEETLE.BASELINE_PROBABILITY +
        " mgmt=" + SoCoABE_CONFIG.MANAGEMENT_ENABLED);

    // --- Register ABE Components ---
    if (typeof MegaSTP === 'undefined') throw new Error("MegaSTP object not defined.");
    console.error("[DIAG] MegaSTP keys: " + Object.keys(MegaSTP));
    console.error("[DIAG] MegaSTP.activities count: " + Object.keys(MegaSTP.activities).length);
    console.error("[DIAG] MegaSTP.U: " + JSON.stringify(MegaSTP.U));

    var mgmtResult = fmengine.addManagement(MegaSTP, 'SoCo_MegaSTP');
    console.error("[DIAG] addManagement returned: " + mgmtResult + " (type: " + typeof mgmtResult + ")");

    var atResult = fmengine.addAgentType({ scheduler: { enabled: false }, stp: { default: 'SoCo_MegaSTP' } }, SoCoABE_CONFIG.core_abe_agent_type);
    console.error("[DIAG] addAgentType returned: " + atResult + " (type: " + typeof atResult + ")");

    // Read agent CSV path from XML (overridable via command line)
    var agentDataCsvPath;
    try {
        agentDataCsvPath = Globals.setting('model.management.abe.agentDataFile');
        if (!agentDataCsvPath) agentDataCsvPath = SoCoABE_CONFIG.csv_path;
    } catch (e) {
        agentDataCsvPath = SoCoABE_CONFIG.csv_path;
    }
    agentDataCsvPath = Globals.path(agentDataCsvPath);
    console.log("Loading agents from: " + agentDataCsvPath);

    var agentDataFile = new CSVFile(agentDataCsvPath);
    if (agentDataFile.isEmpty) throw new Error(`Agent data file is empty: ${agentDataCsvPath}`);
    
    var agentColumnIndex = agentDataFile.columnIndex('agent');
    var seenNames = {};
    for (var i = 0; i < agentDataFile.rowCount; i++) { var name = agentDataFile.value(i, agentColumnIndex).trim(); if (name) seenNames[name] = true; }
    var agentNames = Object.keys(seenNames);
    console.error("[DIAG] Registering " + agentNames.length + " agents with type '" + SoCoABE_CONFIG.core_abe_agent_type + "'");
    console.error("[DIAG] First 3 agent names: " + agentNames.slice(0, 3).join(", "));
    for (var ai = 0; ai < agentNames.length; ai++) {
        var aaResult = fmengine.addAgent(SoCoABE_CONFIG.core_abe_agent_type, agentNames[ai]);
        if (ai < 3) console.error("[DIAG] addAgent('" + agentNames[ai] + "') returned: " + aaResult);
    }
    
    console.log("--- ABE Core Setup Complete ---");

} catch (e) {
    console.error("CRITICAL ERROR during ABE setup: " + e.message + (e.stack ? "\nStack: " + e.stack : ""));
    fmengine.abort("Failed during ABE setup phase.");
}

function onAfterInit() {
    console.log("--- onAfterInit(): Initializing SoCoABE world and establishing clean state. ---");
    try {
        fmengine.standIds.forEach(id => {
            fmengine.standId = id;
            if (stand && stand.id > 0) {
                stand.setFlag('abe_next_activity', 'noManagement');
                stand.setFlag('abe_need_reassessment', false);
                stand.setFlag('abe_last_activity', 'none');
                stand.setFlag('abe_last_activity_year', -1);
                stand.setFlag('abe_param_sequence_current_step', null);
                stand.setFlag('abe_param_sequence_total_steps', null);
                stand.setFlag('abe_param_nTrees', null);
           //     stand.setSTP('SoCo_MegaSTP');
            }
        });
        
        console.log("--- All stands cleaned and assigned to SoCo_MegaSTP. ---");

        if (SoCoABE_CONFIG.MANAGEMENT_ENABLED !== false) {
            socoabe = new socoabe_main();
            socoabe.initialize();
        } else {
            console.log("--- SoCoABE management DISABLED: stands remain unmanaged ---");
        }

        console.log("\n--- SoCoABE INITIALIZATION COMPLETE ---");
        
        // --- AUTOMATICALLY RUN INSPECTION REPORTS ---
        if (typeof SoCo_Inspector !== 'undefined') {
            console.log("--- RUNNING AUTOMATED INITIALIZATION REPORTS ---");
            SoCo_Inspector.run_initialization_summary_report();
            SoCo_Inspector.run_detailed_agent_report();

            console.log("--- AUTOMATED REPORTS COMPLETE ---");
        } else {
            console.error("SoCo_Inspector is not defined. Cannot run reports.");
        }

    } catch(e) {
        console.error("CRITICAL ERROR during onAfterInit: " + e.message + (e.stack ? "\nStack: " + e.stack : ""));
        fmengine.abort("Failed during SoCoABE initialization.");
    }
};

function run(year) {
    console.log(`--- run() called for year ${year} ---`);

    // --- DISTURBANCE SUPPRESSION / ACTIVATION ---
    // iLand execution order: ABE.run() -> tree growth -> disturbance modules
    // Setting parameters HERE takes effect THIS SAME YEAR.
    var distStart = (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.DISTURBANCE_START_YEAR)
        ? SoCoABE_CONFIG.DISTURBANCE_START_YEAR : 0;

    if (distStart > 0 && year === 0) {
        // Year 0 only: disable module + clear any residual state.
        // XML already has near-zero probabilities (0.0000001) as safety net.
        try {
            BarkBeetle.enabled = false;
            BarkBeetle.clear();
            console.log('[DISTURBANCE] Suppressed until year ' + distStart + '. BB module disabled.');
        } catch (e) {
            console.log('[DISTURBANCE] Warning: could not disable BB module: ' + e.message);
        }
    } else if (distStart > 0 && year === distStart) {
        // Activate: enable module and restore real background probability
        try {
            BarkBeetle.enabled = true;
            var activationProb = SoCoABE_CONFIG.BARK_BEETLE.BASELINE_PROBABILITY || 0.000685;
            BarkBeetle.setBackgroundInfestationProbability(activationProb);
            console.log('[DISTURBANCE] Year ' + year + ': Disturbances ACTIVATED. BB prob restored to ' + activationProb + '.');
        } catch (e) {
            console.log('[DISTURBANCE] Warning: could not enable BB module: ' + e.message);
        }
    }

    // --- BARK BEETLE OUTBREAK CONTROL (on top of baseline) ---
    // Skip outbreak logic when distStart=0 (constant BB scenarios need no JS intervention)
    if (distStart > 0 && year >= distStart &&
        typeof SoCoABE_CONFIG !== 'undefined' &&
        SoCoABE_CONFIG.BARK_BEETLE && SoCoABE_CONFIG.BARK_BEETLE.ENABLED) {
        var bb = SoCoABE_CONFIG.BARK_BEETLE;
        var is_outbreak = (bb.OUTBREAK_YEARS.indexOf(year) !== -1);

        if (is_outbreak) {
            BarkBeetle.setBackgroundInfestationProbability(bb.OUTBREAK_PROBABILITY);
            if (bb.LOG_ENABLED) {
                console.log(`[BARK BEETLE] *** OUTBREAK YEAR ${year} *** Probability set to ${bb.OUTBREAK_PROBABILITY}`);
            }
        } else {
            var prev_was_outbreak = (bb.OUTBREAK_YEARS.indexOf(year - 1) !== -1);
            if (prev_was_outbreak) {
                BarkBeetle.setBackgroundInfestationProbability(bb.BASELINE_PROBABILITY);
                if (bb.LOG_ENABLED) {
                    console.log(`[BARK BEETLE] Year ${year}: Outbreak ended. Probability reset to baseline ${bb.BASELINE_PROBABILITY}`);
                }
            }
        }
    }

    // --- SOCO AGENT UPDATE ---
    if (socoabe && socoabe.initialized) {
        socoabe.update(year);
    }
}

function onBeforeDestroy() {
    console.log("=== onBeforeDestroy() CALLED ===");
    console.log("    [DEBUG] socoabe defined: " + (typeof socoabe !== 'undefined'));
    console.log("    [DEBUG] socoabe truthy: " + (socoabe ? 'yes' : 'no'));
    console.log("    [DEBUG] socoabe.initialized: " + (socoabe ? socoabe.initialized : 'N/A'));

    if (typeof socoabe !== 'undefined' && socoabe) {
        console.log("    [DEBUG] Calling socoabe.finalize()...");
        socoabe.finalize(); // This triggers the CSV save
        console.log("    [DEBUG] socoabe.finalize() returned");
    } else {
        console.log("    [WARNING] socoabe not available, cannot finalize!");
    }
    console.log("=== onBeforeDestroy() COMPLETE ===");
}


