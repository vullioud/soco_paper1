console.log("[SMALL_LANDSCAPE_STP] Loading high-structure productive STP");

Globals.include(Globals.path("./abe/abe-lib/ABE-library.js"));

lib.initAllStands();
lib.loglevel = 2;

var SpeedFactor = 1.0;
var STP_DIRECT_CONFIG = {
    BARK_BEETLE: {
        ENABLED: true,
        BASELINE_PROBABILITY: 0.000685,
        OUTBREAK_PROBABILITY: 0.01,
        OUTBREAK_YEARS: [],
        LOG_ENABLED: true
    },
    DISTURBANCE_START_YEAR: 99999
};

try {
    var bb_val = Globals.setting("user.bb_enabled");
    if (bb_val === "false") {
        STP_DIRECT_CONFIG.BARK_BEETLE.ENABLED = false;
        STP_DIRECT_CONFIG.DISTURBANCE_START_YEAR = 99999;
    }
} catch (e) {}
try {
    var ds_val = Globals.setting("user.disturbance_start_year");
    if (ds_val) STP_DIRECT_CONFIG.DISTURBANCE_START_YEAR = parseInt(ds_val, 10);
} catch (e) {}
try {
    var op_val = Globals.setting("user.outbreak_probability");
    if (op_val) STP_DIRECT_CONFIG.BARK_BEETLE.OUTBREAK_PROBABILITY = parseFloat(op_val);
} catch (e) {}
try {
    var bp_val = Globals.setting("user.baseline_probability");
    if (bp_val) STP_DIRECT_CONFIG.BARK_BEETLE.BASELINE_PROBABILITY = parseFloat(bp_val);
} catch (e) {}
try {
    var os_val = Globals.setting("user.outbreak_start_year");
    var oe_val = Globals.setting("user.outbreak_end_year");
    if (os_val && oe_val) {
        var ob_start = parseInt(os_val, 10);
        var ob_end = parseInt(oe_val, 10);
        var ob_years = [];
        for (var oy = ob_start; oy <= ob_end; oy++) ob_years.push(oy);
        STP_DIRECT_CONFIG.BARK_BEETLE.OUTBREAK_YEARS = ob_years;
    }
} catch (e) {}

console.log(
    "[SMALL_LANDSCAPE_STP] Disturbance config: BB=" + STP_DIRECT_CONFIG.BARK_BEETLE.ENABLED +
    " start=" + STP_DIRECT_CONFIG.DISTURBANCE_START_YEAR +
    " outbreakProb=" + STP_DIRECT_CONFIG.BARK_BEETLE.OUTBREAK_PROBABILITY +
    " baselineProb=" + STP_DIRECT_CONFIG.BARK_BEETLE.BASELINE_PROBABILITY
);

function productivePlantingSelectivity() {
    return { psme: 0.7, piab: 0.3 };
}

function productiveTendingSelectivity() {
    return { psme: 0.9, piab: 0.9 };
}

const NoMgmt = lib.harvest.noManagement();
lib.createSTP("no_mgmt", NoMgmt);

const HSPlenterThinning_SC = lib.thinning.plenter({
    id: "LS1PlenterThinning_SC",
    schedule: { min: 1, opt: 1, max: 1, force: true, absolute: true },
    sendSignal: "plenter_execute",
    block: false
});

const HSHarvest_SC = lib.harvest.targetDBH({
    schedule: { signal: "plenter_execute" },
    targetDBH: 50 / SpeedFactor,
    times: 5 * SpeedFactor,
    dbhList: {
        fasy: 65 / SpeedFactor,
        frex: 60 / SpeedFactor,
        piab: 45 / SpeedFactor,
        quro: 75 / SpeedFactor,
        pisy: 45 / SpeedFactor,
        lade: 65 / SpeedFactor,
        qupe: 75 / SpeedFactor,
        psme: 65 / SpeedFactor,
        abal: 45 / SpeedFactor,
        acps: 60 / SpeedFactor,
        pini: 45 / SpeedFactor
    }
});

const HSSalvage_SC = lib.harvest.salvage({
    id: "HSSalvage_SC",
    onClear: function() {
        stand.stp.signal("start");
        lib.log("[SMALL_LANDSCAPE_STP] Disturbance management: select patches and plant Productive target.");
        lib.selectOptimalPatches({
            schedule: { signal: "start" },
            N: Math.round(4 * SpeedFactor),
            patchId: 1,
            patchsize: 2,
            spacing: 0,
            criterium: "max_light",
            sendSignal: "PatchesSelected"
        });
        lib.planting.dynamic({
            schedule: { signal: "PatchesSelected" },
            patches: "patch>=1",
            speciesSelectivity: productivePlantingSelectivity
        });
    }
});

lib.createSTP("highStructure_SC", HSPlenterThinning_SC, HSHarvest_SC, HSSalvage_SC);

fmengine.addAgentType({
    scheduler: { enabled: false },
    stp: { default: "highStructure_SC" }
}, "Type_agent_direct");

console.log("[SMALL_LANDSCAPE_STP] Registered Type_agent_direct -> highStructure_SC");

function run(year) {
    var distStart = STP_DIRECT_CONFIG.DISTURBANCE_START_YEAR || 0;
    var bb = STP_DIRECT_CONFIG.BARK_BEETLE;

    if (distStart > 0 && year === 0) {
        try {
            BarkBeetle.enabled = false;
            BarkBeetle.clear();
            console.log("[SMALL_LANDSCAPE_STP] Suppressed bark beetle until year " + distStart);
        } catch (e) {
            console.log("[SMALL_LANDSCAPE_STP] Warning: could not disable BB module: " + e.message);
        }
    } else if (distStart > 0 && year === distStart) {
        try {
            BarkBeetle.enabled = !!bb.ENABLED;
            if (bb.ENABLED) {
                BarkBeetle.setBackgroundInfestationProbability(bb.BASELINE_PROBABILITY || 0.000685);
                console.log("[SMALL_LANDSCAPE_STP] Activated bark beetle in year " + year +
                    " with baseline probability " + bb.BASELINE_PROBABILITY);
            }
        } catch (e) {
            console.log("[SMALL_LANDSCAPE_STP] Warning: could not enable BB module: " + e.message);
        }
    }

    if (distStart > 0 && year >= distStart && bb.ENABLED) {
        var is_outbreak = (bb.OUTBREAK_YEARS.indexOf(year) !== -1);
        if (is_outbreak) {
            BarkBeetle.setBackgroundInfestationProbability(bb.OUTBREAK_PROBABILITY);
            if (bb.LOG_ENABLED) {
                console.log("[SMALL_LANDSCAPE_STP] Outbreak year " + year +
                    " probability set to " + bb.OUTBREAK_PROBABILITY);
            }
        } else {
            var prev_was_outbreak = (bb.OUTBREAK_YEARS.indexOf(year - 1) !== -1);
            if (prev_was_outbreak) {
                BarkBeetle.setBackgroundInfestationProbability(bb.BASELINE_PROBABILITY);
                if (bb.LOG_ENABLED) {
                    console.log("[SMALL_LANDSCAPE_STP] Year " + year +
                        " outbreak ended, probability reset to " + bb.BASELINE_PROBABILITY);
                }
            }
        }
    }
}
