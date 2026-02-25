/**
 * =================================================================================
 * FILE: mega_STP.js
 * =================================================================================
 */

if (typeof lib === 'undefined') {
    fmengine.abort("ABE Library ('lib') is not defined. MegaSTP cannot be built.");
}

console.log("--- Defining the SoCoABE Mega-STP ---");

/**
 * Conditional logging for mega_STP activities.
 * Checks SoCoABE_CONFIG.SOCO_LOG settings to determine if logging should occur.
 * This reduces console spam and improves performance during production runs.
 */
function megaLog(message) {
    // Check if logging is enabled
    if (typeof SoCoABE_CONFIG !== 'undefined' && SoCoABE_CONFIG.SOCO_LOG) {
        if (!SoCoABE_CONFIG.SOCO_LOG.ENABLED) return;
        if (!SoCoABE_CONFIG.SOCO_LOG.LOG_ACTIVITIES) return;

        // Check warming period
        if (SoCoABE_CONFIG.WARMING && SoCoABE_CONFIG.WARMING.ENABLED) {
            var warmingEnd = SoCoABE_CONFIG.WARMING.DURATION || 0;
            if (Globals.year <= warmingEnd && !SoCoABE_CONFIG.SOCO_LOG.ENABLED_DURING_WARMING) {
                return;
            }
        }
    }
    console.log(message);
}

const MEGA_STP_ACTIVITIES = {};

// --- ACTIVITY DEFINITIONS ---

// 1. No Management
MEGA_STP_ACTIVITIES['noManagement'] = {
    id: 'MegaSTP_NoManagement',
    type: 'general',
    schedule: { signal: 'do_noManagement' },
    action: function() {
        megaLog(`[MEGA-STP] Executing 'noManagement' for stand ${stand.id}.`);
    },
    // onExecuted is the reliable event for post-action logic for both general and scheduled activities.
    onExecuted: function() {
        megaLog(`[MEGA-STP] onExecuted for noManagement on stand ${stand.id}.`);
        stand.setFlag('abe_last_activity', 'MegaSTP_NoManagement');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

// 2. Clearcut
MEGA_STP_ACTIVITIES['clearcut'] = {
    id: 'MegaSTP_Clearcut',
    type: 'scheduled',
    schedule: { signal: 'do_clearcut' },
    finalHarvest: true,

    onEvaluate: function() {
        return true; 
    },

    onExecute: function() {
        megaLog(`[MEGA-STP] Executing 'clearcut' for stand ${stand.id}.`);

        // Capture volume before harvest
        var volumeBefore = stand.volume;

        // Execute harvest
        var preferenceFunction = stand.flag('abe_param_preferenceFunction') || 'dbh > 0';
        stand.trees.load(preferenceFunction);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', harvested_count);
        stand.setFlag('abe_last_harvest_year', Globals.year);

        megaLog(`[MEGA-STP] -> Harvested ${harvested_count} trees, ${volumeRemoved.toFixed(2)} m³/ha removed`);
    },

    // onExecuted is called after a successful onExecute, even for signal-triggered activities.
    onExecuted: function() {
        megaLog(`[MEGA-STP] onExecuted for clearcut on stand ${stand.id}.`);
        // DEBUG: Log at years ending in 9
        if (Globals.year % 10 === 9) {
            megaLog(`[DEBUG clearcut onExecuted] Year ${Globals.year}, Stand ${stand.id}: SETTING abe_last_activity_year=${Globals.year}`);
        }
        stand.setFlag('abe_last_activity', 'MegaSTP_Clearcut');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', true);
        stand.setAbsoluteAge(0);
    }
};

// 3. Target DBH Harvest (with volume-based fallback for homogeneous stands)
MEGA_STP_ACTIVITIES['targetDBH'] = {
    id: 'MegaSTP_TargetDBH',
    type: 'scheduled',
    schedule: { signal: 'do_targetDBH' },
    finalHarvest: false,

    onEvaluate: function() {
        return true;
    },

    onExecute: function() {
        megaLog(`[MEGA-STP] Executing 'targetDBH' for stand ${stand.id}.`);

        // Capture volume and BA before harvest
        var volumeBefore = stand.volume;
        var basalAreaBefore = stand.basalArea;

        var dbhList = stand.flag('abe_param_dbhList') || {};
        var maxRemovalShare = stand.flag('abe_param_maxRemovalShare') || 0.6; // Default: max 60% removal
        var volumeFallbackShare = stand.flag('abe_param_volumeFallbackShare') || 0.3; // Default: remove 30% in fallback
        var total_harvested_count = 0;

        megaLog("[MEGA-STP] -> Received dbhList: " + JSON.stringify(dbhList));
        megaLog("[MEGA-STP] -> Max removal share: " + (maxRemovalShare * 100).toFixed(0) + "%");

        // --- DETAILED STAND INVENTORY LOGGING ---
        megaLog("[MEGA-STP] -> Stand Inventory Before Harvest:");
        stand.trees.loadAll();
        var totalVolume = stand.trees.sum('volume');
        var totalBA = stand.trees.sum('basalarea');
        var totalTreeCount = stand.trees.count;

        megaLog(`[MEGA-STP] -> Total: ${totalTreeCount} trees, ${totalVolume.toFixed(1)} m³, ${totalBA.toFixed(1)} m² BA`);

        // Get a list of unique species IDs present in the stand
        var species_ids = [];
        for (var i = 0; i < stand.nspecies; i++) {
            species_ids.push(stand.speciesId(i));
        }

        for (var i = 0; i < species_ids.length; i++) {
            var species_id = species_ids[i];
            var filter = 'species=' + species_id;
            var species_count = stand.trees.sum('1', filter);

            if (species_count > 0) {
                var min_dbh = stand.trees.mean('dbh', filter, 'min');
                var max_dbh = stand.trees.mean('dbh', filter, 'max');
                megaLog(`  - Species: ${species_id}, Count: ${species_count}, DBH Range: [${min_dbh.toFixed(1)} - ${max_dbh.toFixed(1)}] cm`);
            }
        }

        // ===== PRE-CHECK: Calculate potential removal =====
        var listed_species = [];
        for (var species in dbhList) {
            if (dbhList.hasOwnProperty(species) && species !== 'rest') {
                listed_species.push(species);
            }
        }

        var volumeToRemove = 0;
        var baToRemove = 0;
        var treesToRemove = 0;

        // Check explicitly listed species
        for (var species in dbhList) {
            if (dbhList.hasOwnProperty(species) && species !== 'rest') {
                var dbh = dbhList[species];
                var filter = 'species = ' + species + ' and dbh > ' + dbh;
                var count = stand.trees.load(filter);
                if (count > 0) {
                    volumeToRemove += stand.trees.sum('volume');
                    baToRemove += stand.trees.sum('basalarea');
                    treesToRemove += count;
                }
            }
        }

        // Check 'rest' species (or ALL species if dbhList is empty)
        var rest_dbh = dbhList['rest'] || 50;
        if (listed_species.length > 0) {
            var exclude_parts = [];
            for (var i = 0; i < listed_species.length; i++) {
                exclude_parts.push('species <> ' + listed_species[i]);
            }
            var rest_filter = exclude_parts.join(' and ') + ' and dbh > ' + rest_dbh;
            var rest_count = stand.trees.load(rest_filter);
            if (rest_count > 0) {
                volumeToRemove += stand.trees.sum('volume');
                baToRemove += stand.trees.sum('basalarea');
                treesToRemove += rest_count;
            }
        } else {
            // SAFEGUARD: Empty dbhList - calculate what "rest" would remove
            // This ensures the safeguard triggers when no species are listed
            var rest_filter = 'dbh > ' + rest_dbh;
            var rest_count = stand.trees.load(rest_filter);
            if (rest_count > 0) {
                volumeToRemove += stand.trees.sum('volume');
                baToRemove += stand.trees.sum('basalarea');
                treesToRemove += rest_count;
                megaLog(`[MEGA-STP] -> WARNING: Empty dbhList - all trees dbh > ${rest_dbh} would be removed`);
            }
        }

        var removalShareVolume = totalVolume > 0 ? volumeToRemove / totalVolume : 0;
        var removalShareBA = totalBA > 0 ? baToRemove / totalBA : 0;

        megaLog(`[MEGA-STP] -> PRE-CHECK: DBH-based harvest would remove:`);
        megaLog(`  - ${treesToRemove} trees (${(treesToRemove/totalTreeCount*100).toFixed(1)}%)`);
        megaLog(`  - ${volumeToRemove.toFixed(1)} m³ (${(removalShareVolume*100).toFixed(1)}%)`);
        megaLog(`  - ${baToRemove.toFixed(1)} m² BA (${(removalShareBA*100).toFixed(1)}%)`);

        // ===== DECISION: DBH-based or volume-based fallback? =====
        var useFallback = (removalShareVolume > maxRemovalShare || removalShareBA > maxRemovalShare);

        if (useFallback) {
            megaLog(`[MEGA-STP] -> FALLBACK TRIGGERED: Removal would exceed ${(maxRemovalShare*100).toFixed(0)}% threshold.`);
            megaLog(`[MEGA-STP] -> Switching to volume-based harvest (${(volumeFallbackShare*100).toFixed(0)}% of standing volume).`);

            // ===== VOLUME-BASED FALLBACK =====
            var targetVolume = totalVolume * volumeFallbackShare;
            var removedVolume = 0;
            var harvestedTrees = [];

            // Collect all candidate trees (above DBH thresholds), sorted by DBH descending
            var candidates = [];

            for (var species in dbhList) {
                if (dbhList.hasOwnProperty(species) && species !== 'rest') {
                    var dbh_min = dbhList[species];
                    var filter = 'species = ' + species + ' and dbh > ' + dbh_min;
                    var count = stand.trees.load(filter);

                    if (count > 0) {
                        // Get tree data (iLand doesn't expose individual tree objects easily,
                        // so we'll work with aggregates per DBH class)
                        stand.trees.sort('-dbh'); // Sort descending
                        var speciesVolume = stand.trees.sum('volume');

                        // Mark trees for harvest proportionally
                        var speciesTarget = Math.min(speciesVolume, targetVolume - removedVolume);
                        if (speciesTarget > 0) {
                            // Harvest largest trees first (already sorted)
                            var harvested = stand.trees.harvest();
                            total_harvested_count += harvested;
                            removedVolume += speciesTarget;
                            megaLog(`  - ${species}: harvested ${harvested} trees, ~${speciesTarget.toFixed(1)} m³`);
                        }
                    }
                }
            }

            // Handle 'rest' species in fallback (or all species if dbhList empty)
            if (removedVolume < targetVolume) {
                var rest_filter;
                if (listed_species.length > 0) {
                    var exclude_parts = [];
                    for (var i = 0; i < listed_species.length; i++) {
                        exclude_parts.push('species <> ' + listed_species[i]);
                    }
                    rest_filter = exclude_parts.join(' and ') + ' and dbh > ' + rest_dbh;
                } else {
                    // Empty dbhList - harvest from all species but respect volume target
                    rest_filter = 'dbh > ' + rest_dbh;
                }
                var rest_count = stand.trees.load(rest_filter);
                if (rest_count > 0) {
                    stand.trees.sort('-dbh');
                    // In fallback mode, only harvest up to remaining target volume
                    var restVolume = stand.trees.sum('volume');
                    var remainingTarget = targetVolume - removedVolume;
                    if (restVolume <= remainingTarget) {
                        var rest_harvested = stand.trees.harvest();
                        total_harvested_count += rest_harvested;
                        megaLog(`  - rest species: harvested ${rest_harvested} trees`);
                    } else {
                        // Need to harvest partially - harvest largest first
                        megaLog(`  - rest species: partial harvest to meet volume target`);
                        var rest_harvested = stand.trees.harvest();
                        total_harvested_count += rest_harvested;
                    }
                }
            }

            stand.trees.removeMarkedTrees();

            megaLog(`[MEGA-STP] -> Volume fallback completed: ${total_harvested_count} trees, target ~${targetVolume.toFixed(1)} m³`);
            stand.setFlag('abe_targetDBH_mode', 'volume_fallback');

        } else {
            megaLog(`[MEGA-STP] -> Proceeding with standard DBH-based harvest (${(removalShareVolume*100).toFixed(1)}% < ${(maxRemovalShare*100).toFixed(0)}%).`);

            // ===== STANDARD DBH-BASED HARVEST =====
            // Harvest explicitly listed species
            for (var species in dbhList) {
                if (dbhList.hasOwnProperty(species) && species !== 'rest') {
                    var dbh = dbhList[species];
                    var filter = 'species = ' + species + ' and dbh > ' + dbh;
                    stand.trees.load(filter);
                    total_harvested_count += stand.trees.harvest();
                }
            }

            // Harvest 'rest' (unlisted species) using fallback DBH threshold
            // Note: rest_dbh was already defined in pre-check section
            if (listed_species.length > 0) {
                var exclude_parts = [];
                for (var i = 0; i < listed_species.length; i++) {
                    exclude_parts.push('species <> ' + listed_species[i]);
                }
                var rest_filter = exclude_parts.join(' and ') + ' and dbh > ' + rest_dbh;
                stand.trees.load(rest_filter);
                var rest_harvested = stand.trees.harvest();
                total_harvested_count += rest_harvested;
                if (rest_harvested > 0) {
                    megaLog(`[MEGA-STP] -> Harvested ${rest_harvested} unlisted species trees (dbh > ${rest_dbh})`);
                }
            } else {
                // Empty dbhList case - this should normally trigger fallback via pre-check
                // But as safety net, only harvest if removal share was acceptable
                var rest_filter = 'dbh > ' + rest_dbh;
                stand.trees.load(rest_filter);
                var rest_harvested = stand.trees.harvest();
                total_harvested_count += rest_harvested;
                if (rest_harvested > 0) {
                    megaLog(`[MEGA-STP] -> Harvested ${rest_harvested} trees (dbh > ${rest_dbh}) - empty dbhList mode`);
                }
            }

            stand.trees.removeMarkedTrees();
            stand.setFlag('abe_targetDBH_mode', 'dbh_standard');
        }

        // Calculate actual volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);
        var actualRemovalShare = totalVolume > 0 ? volumeRemoved / totalVolume : 0;

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', total_harvested_count);
        stand.setFlag('abe_last_harvest_year', Globals.year);
        stand.setFlag('abe_targetDBH_removal_share', actualRemovalShare);

        megaLog(`[MEGA-STP] -> ACTUAL RESULT: ${total_harvested_count} trees, ${volumeRemoved.toFixed(2)} m³/ha removed (${(actualRemovalShare*100).toFixed(1)}%)`);
    },

    onExecuted: function() {
        megaLog(`[MEGA-STP] onExecuted for targetDBH on stand ${stand.id}.`);
        stand.setFlag('abe_last_activity', 'MegaSTP_TargetDBH');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

// 4. Plenter Thinning
MEGA_STP_ACTIVITIES['plenter'] = {
    id: 'MegaSTP_Plenter',
    type: 'scheduled',
    schedule: { signal: 'do_plenter' },
    finalHarvest: false,

    onEvaluate: function() {
        return true; 
    },

onExecute: function() {
        megaLog(`[MEGA-STP] Executing 'plenter' for stand ${stand.id}.`);

        // Capture volume before harvest
        var volumeBefore = stand.volume;

        var plenterCurve = stand.flag('abe_param_plenterCurve') || {};
        const dbhSteps = 5;
        var total_harvested_count = 0;

        megaLog("[MEGA-STP] -> Received plenterCurve: " + JSON.stringify(plenterCurve));


        megaLog("[MEGA-STP] -> Stand Inventory Before Harvest:");
        stand.trees.loadAll(); // Load all trees FROM THE CURRENT STAND.

        // Diagnostic Logging (now correctly scoped)
        var species_ids = [];
        for (var i = 0; i < stand.trees.count; i++) {
            var species_id = stand.trees.tree(i).species;
            if (species_ids.indexOf(species_id) === -1) {
                species_ids.push(species_id);
            }
        }
        for (var i = 0; i < species_ids.length; i++) {
            var species_id = species_ids[i];
            var filter_string = 'species=' + species_id;
            // Use sum() on the already loaded list for efficiency
            var species_count = stand.trees.sum('1', filter_string);
            if (species_count > 0) {
                megaLog(`  - Species: ${species_id}, Count: ${species_count}`);
            }
        }

        var dbhClasses = Object.keys(plenterCurve).sort(function(a, b) { return parseInt(b) - parseInt(a); }); // Sort descending

        for (var i = 0; i < dbhClasses.length; i++) {
            var dbh = parseInt(dbhClasses[i], 10);
            var targetCount = plenterCurve[dbh] * stand.area;

            var filter = 'dbh > ' + (dbh - dbhSteps) + ' and dbh <= ' + dbh;

            // Load only the trees for the current class into the list.
            var treesInClass = stand.trees.load(filter);

            if (treesInClass > targetCount) {
                var treesToHarvest = treesInClass - targetCount;

                var treesToKeepInListForHarvest = treesInClass - (treesInClass - treesToHarvest);
                stand.trees.filterRandomExclude(treesToKeepInListForHarvest);

                var harvested_this_class = stand.trees.harvest();
                total_harvested_count += harvested_this_class;
                megaLog(`  - DBH Class ${dbh}: In stand=${treesInClass}, Target=${targetCount.toFixed(0)}. Surplus=${treesToHarvest}. Marking ${harvested_this_class} trees for harvest.`);
            }
        }

        stand.trees.removeMarkedTrees();

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', total_harvested_count);
        stand.setFlag('abe_last_harvest_year', Globals.year);

        megaLog(`[MEGA-STP] -> Total harvested trees: ${total_harvested_count}, ${volumeRemoved.toFixed(2)} m³/ha removed`);
    },
    onExecuted: function() {
        megaLog(`[MEGA-STP] onExecuted for plenter on stand ${stand.id}.`);
        stand.setFlag('abe_last_activity', 'MegaSTP_Plenter');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};


// 5. Selective Thinning - Phase 1: SELECTION (CORRECT LIBRARY PATTERN)

MEGA_STP_ACTIVITIES['shelterwood_select'] = {
    // id: 'MegaSTP_Shelterwood_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_shelterwood_select' },

    // Dynamic parameters from flags
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    
    // --- ENABLED: Species Selectivity ---
    speciesSelectivity: function() { 
        var val = stand.flag('abe_param_speciesSelectivity');
        megaLog(`[MEGA-STP] Shelterwood Select: Fetching species selectivity: ${JSON.stringify(val)}`);
        return val; 
    },

    ranking: 'height', // Keep dominant trees

    onCreate: function(act) { 
        act.scheduled = false; 
    },

    onExecuted: function() {
        megaLog(`[MEGA-STP] Shelterwood Select: Marking complete.`);
        
        // Snapshot total competitors marked
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        
        // Perform First Removal Pass immediately
        var fraction = stand.flag('abe_param_fraction_to_remove') || 0;
        var to_remove = Math.ceil(total_competitors * fraction);

        megaLog(`  -> Marked ${total_competitors} competitors. Removing ${to_remove} (${(fraction*100).toFixed(1)}%).`);
        
        if (to_remove > 0) {
            stand.trees.filterRandom(to_remove); // Keep 'to_remove' random trees in list
            var harvested = stand.trees.harvest(); // Harvest them
            // DO NOT reset marks here, they persist for next steps
            megaLog(`  -> Harvested ${harvested} trees.`);
        }

        // Set Initialization Flag
        stand.setFlag('abe_shelterwood_initialized', true);
        stand.setFlag('abe_last_activity', 'MegaSTP_Shelterwood_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

// 6a. Selective Thinning - Phase 1: SELECTION
MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },

    // Dynamic parameters from flags
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },

    // --- Species Selectivity ---
    speciesSelectivity: function() {
        var val = stand.flag('abe_param_speciesSelectivity');
        megaLog(`[MEGA-STP] SelectiveThinning Select: Fetching species selectivity: ${JSON.stringify(val)}`);
        return val;
    },

    ranking: 'height', // Keep dominant trees

    onCreate: function(act) {
        act.scheduled = false;
    },

    onExecute: function() {
        megaLog(`[MEGA-STP] SelectiveThinning Select: Starting tree selection for stand ${stand.id}`);
    },

    onExecuted: function() {
        megaLog(`[MEGA-STP] SelectiveThinning Select: Marking complete for stand ${stand.id}`);

        // Snapshot total competitors marked
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);

        // Perform First Removal Pass immediately
        var fraction = stand.flag('abe_param_fraction_to_remove') || 0;
        var to_remove = Math.ceil(total_competitors * fraction);

        megaLog(`  -> Marked ${total_competitors} competitors. Removing ${to_remove} (${(fraction*100).toFixed(1)}%).`);

        // Capture volume before harvest
        var volumeBefore = stand.volume;
        var treesHarvested = 0;

        if (to_remove > 0) {
            stand.trees.filterRandom(to_remove); // Keep 'to_remove' random trees in list
            treesHarvested = stand.trees.harvest(); // Harvest them
            // DO NOT reset marks here, they persist for next steps
            megaLog(`  -> Harvested ${treesHarvested} trees.`);
        }

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        // Store harvest tracking
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', treesHarvested);
        stand.setFlag('abe_last_harvest_year', Globals.year);

        // Set Initialization Flag
        stand.setFlag('abe_selective_thinning_initialized', true);
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);

        megaLog(`  -> SelectiveThinning Select complete: ${volumeRemoved.toFixed(2)} m³/ha removed`);
    }
};

// 6b. Selective Thinning - Phase 2: REMOVAL
MEGA_STP_ACTIVITIES['selectiveThinning_remove'] = {
    id: 'MegaSTP_SelectiveThinning_Remove',
    type: 'general', // Use 'general' for custom removal logic
    schedule: { signal: 'do_selectiveThinning_remove' },
    
    action: function() {
        megaLog(`\n[MEGA-STP - action] REMOVE phase for stand ${stand.id}.`);

        // Capture volume before harvest
        var volumeBefore = stand.volume;

        var fraction_to_remove = stand.flag('abe_param_fraction_to_remove') || 0;
        var remaining_competitors = stand.trees.load('markcompetitor=true');

        megaLog(`  -> Found ${remaining_competitors} remaining competitors.`);
        megaLog(`  -> Agent requested removal of fraction: ${fraction_to_remove.toFixed(2)}`);

        var trees_to_remove_this_step = Math.ceil(remaining_competitors * fraction_to_remove);

        stand.trees.filterRandomExclude(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', harvested_count);
        stand.setFlag('abe_last_harvest_year', Globals.year);

        megaLog(`  -> Subsequent removal: Harvested ${harvested_count} trees, ${volumeRemoved.toFixed(2)} m³/ha removed`);
    },
    onExecuted: function() {
        megaLog(`[MEGA-STP - onExecuted] REMOVE phase complete for stand ${stand.id}.`);
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Remove');
        stand.setFlag('abe_last_activity_year', Globals.year);
    }
};

// 7. Thinning From Below
// NOTE: Using type='scheduled' instead of type='thinning' because signal-triggered
// thinning activities don't properly call evaluate() in iLand's C++ code when
// the activity is not in the scheduler (scheduled=false doesn't work as expected).
MEGA_STP_ACTIVITIES['thinningFromBelow'] = {
    id: 'MegaSTP_ThinningFromBelow',
    type: 'scheduled',  // Changed from 'thinning' - handles harvest in onExecute
    schedule: { signal: 'do_thinningFromBelow' },

    onEvaluate: function() {
        return true;
    },

    onExecute: function() {
        megaLog(`[MEGA-STP] Executing 'thinningFromBelow' for stand ${stand.id}`);

        // Get parameters from flags
        var share = stand.flag('abe_param_thinningShare');
        if (share === undefined || share === null || typeof share !== 'number' || isNaN(share)) {
            console.warn(`[MEGA-STP] WARNING: Invalid thinningShare for stand ${stand.id}: ${share}. Using default 0.2`);
            share = 0.2;
        }

        var selectivity = stand.flag('abe_param_speciesSelectivity') || {};
        megaLog(`[MEGA-STP] ThinningFromBelow params: share=${(share*100).toFixed(1)}%, selectivity=${JSON.stringify(selectivity)}`);

        // Capture volume before
        var volumeBefore = stand.volume;
        stand.setFlag('abe_volume_before_thinning', volumeBefore);
        megaLog(`  -> Volume before: ${volumeBefore.toFixed(2)} m³/ha`);

        // Calculate target volume to remove
        var targetRemoval = volumeBefore * share;
        megaLog(`  -> Target removal: ${targetRemoval.toFixed(2)} m³/ha (${(share*100).toFixed(1)}%)`);

        // Load all trees sorted by volume (ascending - smallest first for thinning from below)
        stand.trees.loadAll();
        var totalTrees = stand.trees.count;

        if (totalTrees === 0) {
            megaLog(`  -> No trees in stand, nothing to thin`);
            stand.setFlag('abe_last_harvest_volume', 0);
            stand.setFlag('abe_last_harvest_trees', 0);
            stand.setFlag('abe_last_harvest_year', Globals.year);
            return;
        }

        stand.trees.sort('volume');
        megaLog(`  -> Total trees: ${totalTrees}`);

        // Thinning from below: remove smallest trees first
        var totalHarvested = 0;

        // Load trees sorted by volume ascending (smallest first)
        stand.trees.loadAll();
        stand.trees.sort('volume');

        // Calculate approximate number of trees to remove
        // Assume average tree volume = volumeBefore / totalTrees
        var avgTreeVolume = volumeBefore / totalTrees;
        var approxTreesToRemove = Math.ceil(targetRemoval / avgTreeVolume);

        // Don't remove more than 80% of trees
        approxTreesToRemove = Math.min(approxTreesToRemove, Math.floor(totalTrees * 0.8));

        megaLog(`  -> Avg tree volume: ${avgTreeVolume.toFixed(3)} m³, approx trees to remove: ${approxTreesToRemove}`);

        if (approxTreesToRemove > 0) {
            // filterRandom keeps N random trees from the current list
            // Since sorted by volume (smallest first), we want to keep the smallest ones for removal
            // So we filter to keep only the smallest approxTreesToRemove trees
            stand.trees.filterRandom(approxTreesToRemove);
            totalHarvested = stand.trees.harvest();
        }

        // Remove marked trees
        stand.trees.removeMarkedTrees();

        // Calculate actual volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var removedVolume = Math.max(0, volumeBefore - volumeAfter);

        // Store results
        stand.setFlag('abe_last_harvest_volume', removedVolume);
        stand.setFlag('abe_last_harvest_trees', totalHarvested);
        stand.setFlag('abe_last_harvest_year', Globals.year);

        megaLog(`[MEGA-STP] ThinningFromBelow complete for stand ${stand.id}:`);
        megaLog(`  -> Volume after: ${volumeAfter.toFixed(2)} m³/ha`);
        megaLog(`  -> Removed: ${removedVolume.toFixed(2)} m³/ha, ${totalHarvested} trees`);
    },

    onExecuted: function() {
        // C++ execution complete, now calculate volume removed
        var volumeBefore = stand.flag('abe_volume_before_thinning') || stand.volume;
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_year', Globals.year);

        megaLog(`[MEGA-STP] ThinningFromBelow removed ${volumeRemoved.toFixed(2)} m³/ha`);

        stand.setFlag('abe_last_activity', 'MegaSTP_ThinningFromBelow');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

MEGA_STP_ACTIVITIES['femel_select'] = {
    id: 'MegaSTP_Femel_Select',
    type: 'general',
    schedule: { signal: 'do_femel_select' },

    action: function() {
        var volumeBefore = stand.volume;
        megaLog(`[MEGA-STP] Femel Select: Initializing gap for stand ${stand.id}. Volume before: ${volumeBefore.toFixed(2)} m³/ha`);

        // 1. Initialize Patches
        // Uses parameter for number/size. Default 1 gap.
        var init_size = stand.flag('abe_param_femel_initial_size') || 1;
        megaLog(`[DEBUG] Femel init_size flag: ${init_size}`);

        stand.patches.clear();
        stand.patches.createRandomPatches(init_size);
        stand.patches.updateGrid();

        // 2. Determine Patch ID (createRandomPatches starts at 1)
        var initial_patch_id = 1;

        // 3. Harvest the Patch
        var trees_in_patch = stand.trees.load('patch=' + initial_patch_id);
        megaLog(`[DEBUG] Femel: Trees in patch ${initial_patch_id}: ${trees_in_patch}`);

        var harvested = stand.trees.harvest();

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', harvested);
        stand.setFlag('abe_last_harvest_year', Globals.year);
        megaLog(`[MEGA-STP] Femel Select: Created initial gap (ID ${initial_patch_id}). Harvested ${harvested} trees, ${volumeRemoved.toFixed(2)} m³/ha removed`);

        // 4. Update Flags
        stand.setFlag('abe_femel_initialized', true);
        stand.setFlag('abe_femel_current_ring', initial_patch_id);
    },

    onExecuted: function() {
        megaLog(`[MEGA-STP] Femel Select onExecuted: Setting flags for stand ${stand.id}`);
        stand.setFlag('abe_last_activity', 'MegaSTP_Femel_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

// 13. Femel - Phase 2: Expansion (Step)
MEGA_STP_ACTIVITIES['femel_step'] = {
    id: 'MegaSTP_Femel_Step',
    type: 'general',
    schedule: { signal: 'do_femel_step' },

    action: function() {
        var volumeBefore = stand.volume;
        megaLog(`[MEGA-STP] Femel Step: Expanding gap for stand ${stand.id}. Volume before: ${volumeBefore.toFixed(2)} m³/ha`);

        // 1. Read State
        var current_ring = stand.flag('abe_femel_current_ring');
        var grow_width = stand.flag('abe_param_femel_growth_width') || 1;

        megaLog(`[DEBUG] Femel Step: current_ring=${current_ring}, grow_width=${grow_width}`);

        if (!current_ring) {
            console.warn(`[MEGA-STP] ERROR: Femel step called but current_ring is undefined for stand ${stand.id}. Aborting expansion.`);
            // Set flags to indicate failure
            stand.setFlag('abe_last_harvest_volume', 0);
            stand.setFlag('abe_last_harvest_trees', 0);
            return;
        }

        var next_ring = current_ring + 1;

        // 2. Expand Patch
        // createExtendedPatch returns number of cells added
        var cells_added = stand.patches.createExtendedPatch(current_ring, next_ring, grow_width);

        // Update iLand grid
        stand.patches.updateGrid();

        megaLog(`[MEGA-STP] Femel Step: Expanded Ring ${current_ring} to ${next_ring}. Added ${cells_added} cells.`);

        if (cells_added > 0) {
            // 3. Harvest the New Ring
            var trees_in_ring = stand.trees.load('patch=' + next_ring);
            megaLog(`[DEBUG] Femel Step: Trees in ring ${next_ring}: ${trees_in_ring}`);

            var harvested = stand.trees.harvest();

            // Calculate volume removed
            if (stand.reload) stand.reload();
            var volumeAfter = stand.volume;
            var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

            // Store results
            stand.setFlag('abe_last_harvest_volume', volumeRemoved);
            stand.setFlag('abe_last_harvest_trees', harvested);
            stand.setFlag('abe_last_harvest_year', Globals.year);
            megaLog(`[MEGA-STP] Femel Step: Harvested ${harvested} trees from Ring ${next_ring}, ${volumeRemoved.toFixed(2)} m³/ha removed`);

            // 4. Update State
            stand.setFlag('abe_femel_current_ring', next_ring);
        } else {
            megaLog(`[MEGA-STP] Femel Step: No expansion possible (stand boundary reached?) for stand ${stand.id}.`);
            // Still set flags to 0 to track that step was attempted
            stand.setFlag('abe_last_harvest_volume', 0);
            stand.setFlag('abe_last_harvest_trees', 0);
        }
    },

    onExecuted: function() {
        megaLog(`[MEGA-STP] Femel Step onExecuted: Setting flags for stand ${stand.id}`);
        stand.setFlag('abe_last_activity', 'MegaSTP_Femel_Step');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

// 14. Femel - Phase 3: Final Harvest (Matrix)
MEGA_STP_ACTIVITIES['femel_final'] = {
    id: 'MegaSTP_Femel_Final',
    type: 'scheduled', // Final harvest is scheduled
    schedule: { signal: 'do_femel_final' },
    finalHarvest: true,

    onCreate: function(act) { act.scheduled = false; },
    onEvaluate: function() { return true; },

    onExecute: function() {
        var volumeBefore = stand.volume;
        megaLog(`[MEGA-STP] Femel Final: Clearing matrix for stand ${stand.id}.`);
        
        // Harvest everything remaining (The Matrix)
        stand.trees.loadAll();
        var harvested = stand.trees.harvest();

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);
        
        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', harvested);
        stand.setFlag('abe_last_harvest_year', Globals.year);
        stand.trees.removeMarkedTrees();
        
        megaLog(`  -> Harvested ${harvested} remaining trees.`);

        // Cleanup
        stand.setAbsoluteAge(0);
        stand.patches.clear();
        stand.patches.updateGrid();
        
        // Clear flags
        stand.setFlag('abe_femel_initialized', null);
        stand.setFlag('abe_femel_current_ring', null);
    },

    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_Femel_Final');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', true);
    }
};

// 8. Tending
// NOTE: Using type='scheduled' instead of type='thinning' because signal-triggered
// thinning activities don't properly call evaluate() in iLand's C++ code when
// the activity is not in the scheduler (scheduled=false doesn't work as expected).
// Tending removes suppressed/dominated trees to favor crop trees in young stands.
MEGA_STP_ACTIVITIES['tending'] = {
    id: 'MegaSTP_Tending',
    type: 'scheduled',  // Changed from 'thinning' - handles harvest in onExecute
    schedule: { signal: 'do_tending' },

    onEvaluate: function() {
        return true;
    },

    onExecute: function() {
        var volumeBefore = stand.volume;
        var standAge = stand.age;
        var basalArea = stand.basalArea;
        var totalTreesBefore = 0;

        megaLog(`[MEGA-STP] Executing 'tending' for stand ${stand.id}:`);
        megaLog(`  -> Volume before: ${volumeBefore.toFixed(2)} m³/ha`);
        megaLog(`  -> Stand age: ${standAge.toFixed(1)} years`);
        megaLog(`  -> Basal area: ${basalArea.toFixed(2)} m²/ha`);

        // Check if stand has enough volume for tending
        if (volumeBefore < 5) {
            megaLog(`  -> Volume too low (${volumeBefore.toFixed(2)} < 5 m³/ha), skipping tending`);
            stand.setFlag('abe_last_harvest_volume', 0);
            stand.setFlag('abe_last_harvest_trees', 0);
            stand.setFlag('abe_last_harvest_year', Globals.year);
            return;
        }

        // Get species selectivity if set
        var selectivity = stand.flag('abe_param_speciesSelectivity') || {};
        megaLog(`  -> Species selectivity: ${JSON.stringify(selectivity)}`);

        // Tending removes ~25% of suppressed trees (moderate intensity)
        var removalFraction = 0.25;

        // Load all trees
        stand.trees.loadAll();
        totalTreesBefore = stand.trees.count;

        if (totalTreesBefore === 0) {
            megaLog(`  -> No trees in stand, nothing to tend`);
            stand.setFlag('abe_last_harvest_volume', 0);
            stand.setFlag('abe_last_harvest_trees', 0);
            stand.setFlag('abe_last_harvest_year', Globals.year);
            return;
        }

        megaLog(`  -> Total trees: ${totalTreesBefore}`);

        // Sort by height descending - we want to keep the tallest (crop) trees
        // and remove the smallest (suppressed) trees
        stand.trees.sort('height');

        // Calculate trees to remove (from the suppressed/smallest)
        var treesToRemove = Math.ceil(totalTreesBefore * removalFraction);

        // Don't remove more than 40% of trees in tending
        treesToRemove = Math.min(treesToRemove, Math.floor(totalTreesBefore * 0.4));

        // Need at least a few trees to make tending worthwhile
        if (treesToRemove < 5) {
            megaLog(`  -> Too few trees to remove (${treesToRemove}), skipping tending`);
            stand.setFlag('abe_last_harvest_volume', 0);
            stand.setFlag('abe_last_harvest_trees', 0);
            stand.setFlag('abe_last_harvest_year', Globals.year);
            return;
        }

        megaLog(`  -> Target removal: ${treesToRemove} trees (${(removalFraction*100).toFixed(0)}%)`);

        // Reload and sort ascending (smallest first) to harvest suppressed trees
        stand.trees.loadAll();
        stand.trees.sort('height');  // smallest height first when ascending

        // Filter to keep only the smallest trees for removal
        stand.trees.filterRandom(treesToRemove);
        var totalHarvested = stand.trees.harvest();

        // Remove marked trees
        stand.trees.removeMarkedTrees();

        // Calculate actual volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', totalHarvested);
        stand.setFlag('abe_last_harvest_year', Globals.year);

        megaLog(`[MEGA-STP] Tending complete for stand ${stand.id}:`);
        megaLog(`  -> Volume after: ${volumeAfter.toFixed(2)} m³/ha`);
        megaLog(`  -> Removed: ${volumeRemoved.toFixed(2)} m³/ha, ${totalHarvested} trees`);

        if (volumeRemoved < 0.01 && totalHarvested > 0) {
            console.warn(`[MEGA-STP] WARNING: Tending harvested ${totalHarvested} trees but removed minimal volume`);
        }
    },

    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_Tending');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};


MEGA_STP_ACTIVITIES['shelterwood_select'] = {
    // id: 'MegaSTP_Shelterwood_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_shelterwood_select' },

    // Dynamic parameters from flags
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    speciesSelectivity: function() { return stand.flag('abe_param_speciesSelectivity'); },  // commented out in waiting for a good way to select species.
    ranking: 'height', // Standard for shelterwood: keep dominant trees

    // Force signal execution path
    onCreate: function(act) {
        act.scheduled = false;
    },

    onExecute: function() {
        // Capture volume before (C++ marking hasn't executed yet)
        var volumeBefore = stand.volume;
        stand.setFlag('abe_volume_before_thinning', volumeBefore);
        megaLog(`[MEGA-STP] Executing 'shelterwood_select' for stand ${stand.id}, volume before: ${volumeBefore.toFixed(2)} m³/ha`);
    },

    // Post-marking logic: Record stats and perform FIRST removal pass.
    onExecuted: function() {
        megaLog(`[MEGA-STP] Shelterwood Select: Marking complete.`);

        // Get volume before removal
        var volumeBefore = stand.flag('abe_volume_before_thinning') || stand.volume;

        // 1. Snapshot total competitors
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);

        // 2. Perform First Removal
        // Fraction calculated by prepare_flags based on remaining steps
        var fraction = stand.flag('abe_param_fraction_to_remove') || 0;
        var to_remove = Math.ceil(total_competitors * fraction);

        megaLog(`  -> Marked ${total_competitors} competitors. Removing ${to_remove} (${(fraction*100).toFixed(1)}%).`);

        var harvested = 0;
        if (to_remove > 0) {
            stand.trees.filterRandom(to_remove); // Keep 'to_remove' in list
            harvested = stand.trees.harvest(); // Remove them
            // Do NOT call removeMarkedTrees() here; we need marks for next steps!
            megaLog(`  -> Harvested ${harvested} trees.`);
        }

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', harvested);
        stand.setFlag('abe_last_harvest_year', Globals.year);

        megaLog(`[MEGA-STP] Shelterwood Select removed ${volumeRemoved.toFixed(2)} m³/ha`);

        // 3. Set Initialization Flag
        stand.setFlag('abe_shelterwood_initialized', true);
        stand.setFlag('abe_last_activity', 'MegaSTP_Shelterwood_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

// 10. Shelterwood - Phase 2: Removal (Subsequent Passes)
MEGA_STP_ACTIVITIES['shelterwood_remove'] = {
    type: 'general',
    schedule: { signal: 'do_shelterwood_remove' },
    
    action: function() {
        var volumeBefore = stand.volume;
        megaLog(`[MEGA-STP] Shelterwood Remove: Executing phase.`);

        // 1. Load remaining marked competitors
        var remaining = stand.trees.load('markcompetitor=true');
        
        // 2. Calculate removal
        var fraction = stand.flag('abe_param_fraction_to_remove') || 0;
        var to_remove = Math.ceil(remaining * fraction);

        megaLog(`  -> Remaining competitors: ${remaining}. Target removal: ${to_remove} (${(fraction*100).toFixed(1)}%).`);

        if (to_remove > 0) {
            stand.trees.filterRandomExclude(to_remove);
            var harvested = stand.trees.harvest();

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);
        
        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', harvested);
        stand.setFlag('abe_last_harvest_year', Globals.year);
            megaLog(`  -> Harvested ${harvested} trees.`);
        }
    },
    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_Shelterwood_Remove');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);

    }
};

// 11. Shelterwood - Phase 3: Final Harvest (Clearcut)
MEGA_STP_ACTIVITIES['shelterwood_final'] = {
    type: 'scheduled',
    schedule: { signal: 'do_shelterwood_final' },
    finalHarvest: true,

    // --- FIX: Force signal path for scheduled activity ---
    onCreate: function(act) { 
        act.scheduled = false; 
    },

    onEvaluate: function() { return true; },

    onExecute: function() {
        var volumeBefore = stand.volume;
        megaLog(`[MEGA-STP] Shelterwood Final Harvest: Clearing overstory.`);
        
        // Load EVERYTHING marked (Crop trees + any leftover competitors)
        stand.trees.load('markcompetitor=true or markcrop=true');
        
        var count = stand.trees.harvest();

        // Calculate volume removed
        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);
        
        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', count);
        stand.setFlag('abe_last_harvest_year', Globals.year);
        
        // Cleanup: Remove any stray marks on the stand
        stand.trees.resetMarks(); 
        
        megaLog(`  -> Removed ${count} seed trees and remnants.`);
        
        // Reset Rotation
        stand.setAbsoluteAge(0);
        
        // Clear Logic Flags
        stand.setFlag('abe_shelterwood_initialized', null);
        stand.setFlag('abe_param_totalCompetitors', null);
    },

    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_Shelterwood_Final');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', true);
    }
};

MEGA_STP_ACTIVITIES['planting'] = {
    type: 'scheduled',
    schedule: { signal: 'do_planting' },

    onCreate: function(act) { act.scheduled = false; },
    onEvaluate: function() { return true; },

    onExecute: function() {
        megaLog(`[MEGA-STP] Executing Planting on stand ${stand.id}.`);
        
        // 1. Read Flags
        var species_val = stand.flag('abe_param_planting_species');
        var fraction_val = stand.flag('abe_param_planting_fraction');

        // Log what we got (The Critical Check)
        megaLog(`[MEGA-STP] Flags Received -> Species: ${JSON.stringify(species_val)}, Fractions: ${JSON.stringify(fraction_val)}`);

        // --- Helper to force Arrays ---
        function toArray(val, isNumeric) {
            if (val === undefined || val === null) return [];
            if (Array.isArray(val)) return val;
            if (typeof val === 'string' && val.indexOf(',') > -1) {
                var parts = val.split(',');
                if (isNumeric) return parts.map(Number);
                return parts;
            }
            return [val];
        }

        var species_arr = toArray(species_val, false);
        var fraction_arr = toArray(fraction_val, true);

        // Defaults
        if (species_arr.length === 0) species_arr = ['piab'];
        if (fraction_arr.length === 0) fraction_arr = [1.0];

        for (var i = 0; i < species_arr.length; i++) {
            var sp = species_arr[i];
            if (typeof sp === 'string') sp = sp.trim();
            
            var fr = (i < fraction_arr.length) ? fraction_arr[i] : 1.0;

            var item = {
                species: sp,
                fraction: fr,
                height: 0.2, // sapling height
                age: 2,
                clear: false 
            };
            
            megaLog(`  -> Running iLand Planting: ${sp} on ${(fr*100).toFixed(0)}% of area.`);
            fmengine.runPlanting(stand.id, item);
        }
    },

    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_Planting');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

// =============================================================================
// 12. SALVAGE ACTIVITY - Disturbance Response
// =============================================================================
// This activity uses iLand's native salvage type with onAfterDisturbance callback.
// It monitors disturbance events and sets flags for SOCO to handle the response.

MEGA_STP_ACTIVITIES['salvage'] = {
    type: 'salvage',
    schedule: { repeat: true },  // Continuously monitors for disturbances

    // Thresholds for disturbance response
    thresholdIgnoreDamage: 30,   // m³/ha - Below this, no action taken
    thresholdClearStand: 0.6,    // Fraction (0-1) - Above this severity, consider clearcut

    // Called automatically by iLand C++ when disturbance is detected
    onAfterDisturbance: function(disturbedVolume) {
        var severity_m3ha = disturbedVolume / stand.area;
        var volume_before = stand.volume + disturbedVolume;  // Approximate pre-disturbance volume
        var severity_fraction = (volume_before > 0) ? disturbedVolume / volume_before : 0;

        megaLog(`[MEGA-STP SALVAGE] Disturbance detected on stand ${stand.id}!`);
        megaLog(`  -> Disturbed volume: ${disturbedVolume.toFixed(1)} m³ (${severity_m3ha.toFixed(1)} m³/ha)`);
        megaLog(`  -> Severity fraction: ${(severity_fraction * 100).toFixed(1)}%`);
        megaLog(`  -> Remaining volume: ${stand.volume.toFixed(1)} m³/ha`);

        // Set flags for SOCO perception to read
        stand.setFlag('abe_disturbance_detected', true);
        stand.setFlag('abe_disturbance_year', Globals.year);
        stand.setFlag('abe_disturbance_volume', disturbedVolume);
        stand.setFlag('abe_disturbance_severity', severity_fraction);
        stand.setFlag('abe_disturbance_severity_m3ha', severity_m3ha);

        // Clear any ongoing sequences - disturbance interrupts them
        // Check if we're in the middle of a sequence activity
        var current_activity = stand.flag('abe_next_activity');
        if (current_activity === 'shelterwood' || current_activity === 'femel' || current_activity === 'selectiveThinning') {
            megaLog(`  -> Interrupting ongoing ${current_activity} sequence due to disturbance.`);

            // Clear sequence-specific flags
            if (typeof Action !== 'undefined' && Action.prepare) {
                if (typeof Action.prepare.clear_shelterwood_flags === 'function') {
                    Action.prepare.clear_shelterwood_flags();
                }
                if (typeof Action.prepare.clear_femel_flags === 'function') {
                    Action.prepare.clear_femel_flags();
                }
                if (typeof Action.prepare.clear_selectiveThinning_flags === 'function') {
                    Action.prepare.clear_selectiveThinning_flags();
                }
            }

            // Clear sequence state flags
            stand.setFlag('abe_param_sequence_current_step', null);
            stand.setFlag('abe_param_sequence_total_steps', null);
        }

        // Mark stand for salvage decision by SOCO agent
        stand.setFlag('abe_need_salvage', true);
        stand.setFlag('abe_need_reassessment', true);

        // Store in stand.obj for history tracking
        if (!stand.obj) stand.obj = {};
        if (!stand.obj.disturbance_history) stand.obj.disturbance_history = [];
        stand.obj.disturbance_history.push({
            year: Globals.year,
            volume_disturbed: disturbedVolume,
            severity_m3ha: severity_m3ha,
            severity_fraction: severity_fraction,
            volume_remaining: stand.volume
        });

        megaLog(`  -> Flags set. SOCO will decide salvage response.`);
    }
};

// 12a. Salvage Execution Activities - Signal-triggered responses
// These are called by SOCO after it decides the appropriate response

MEGA_STP_ACTIVITIES['salvage_harvest'] = {
    type: 'scheduled',
    schedule: { signal: 'do_salvage_harvest' },

    onCreate: function(act) { act.scheduled = false; },
    onEvaluate: function() { return true; },

    onExecute: function() {
        var volumeBefore = stand.volume;
        megaLog(`[MEGA-STP] Salvage Harvest: Removing damaged/dead trees.`);

        // Get salvage parameters from flags
        var min_dbh = stand.flag('abe_param_salvage_min_dbh') || 10;
        var salvage_fraction = stand.flag('abe_param_salvage_fraction') || 1.0;

        // Load all trees and harvest damaged ones
        // In iLand, recently disturbed trees can be identified
        stand.trees.loadAll();
        var total_count = stand.trees.count;

        // Apply salvage fraction (some agents may leave portion for habitat)
        if (salvage_fraction < 1.0) {
            var trees_to_harvest = Math.floor(total_count * salvage_fraction);
            // Harvest larger trees first (economic value)
            stand.trees.sort('dbh', true);  // Descending
            stand.trees.harvest(trees_to_harvest);
        } else {
            // Harvest all merchantable trees
            stand.trees.filter('dbh >= ' + min_dbh);
            stand.trees.harvest();
        }

        stand.trees.removeMarkedTrees();

        if (stand.reload) stand.reload();
        var volumeAfter = stand.volume;
        var volumeRemoved = Math.max(0, volumeBefore - volumeAfter);

        megaLog(`  -> Salvage removed ${volumeRemoved.toFixed(1)} m³/ha`);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_year', Globals.year);
        stand.setFlag('abe_last_salvage_volume', volumeRemoved);
    },

    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_Salvage_Harvest');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_salvage', false);  // Salvage completed
        stand.setFlag('abe_need_reassessment', true);  // Agent should reassess stand
    }
};

MEGA_STP_ACTIVITIES['salvage_clearcut'] = {
    type: 'scheduled',
    schedule: { signal: 'do_salvage_clearcut' },
    finalHarvest: true,

    onCreate: function(act) { act.scheduled = false; },
    onEvaluate: function() { return true; },

    onExecute: function() {
        var volumeBefore = stand.volume;
        megaLog(`[MEGA-STP] Salvage Clearcut: Complete stand reset after severe disturbance.`);

        // Remove all remaining trees
        stand.trees.loadAll();
        var count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        if (stand.reload) stand.reload();
        var volumeRemoved = Math.max(0, volumeBefore);

        megaLog(`  -> Salvage clearcut removed ${count} trees, ${volumeRemoved.toFixed(1)} m³/ha`);

        // Store results
        stand.setFlag('abe_last_harvest_volume', volumeRemoved);
        stand.setFlag('abe_last_harvest_trees', count);
        stand.setFlag('abe_last_harvest_year', Globals.year);
        stand.setFlag('abe_last_salvage_volume', volumeRemoved);

        // Reset stand age for new rotation
        stand.setAbsoluteAge(0);
    },

    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_Salvage_Clearcut');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_salvage', false);
        stand.setFlag('abe_need_reassessment', true);

        // Trigger replanting signal
        megaLog(`  -> Sending do_planting signal for post-salvage replanting.`);
        stand.stp.signal('do_planting');
    }
};

MEGA_STP_ACTIVITIES['salvage_leave'] = {
    type: 'scheduled',
    schedule: { signal: 'do_salvage_leave' },

    onCreate: function(act) { act.scheduled = false; },
    onEvaluate: function() { return true; },

    onExecute: function() {
        megaLog(`[MEGA-STP] Salvage Leave: Leaving disturbed stand for natural recovery (biodiversity option).`);

        // No harvesting - just record the decision
        var remaining_volume = stand.volume;
        megaLog(`  -> Leaving ${remaining_volume.toFixed(1)} m³/ha standing for habitat/deadwood.`);

        // Could optionally set flags for monitoring recovery
        stand.setFlag('abe_salvage_left_for_recovery', true);
        stand.setFlag('abe_recovery_start_year', Globals.year);
    },

    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_Salvage_Leave');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_salvage', false);
        stand.setFlag('abe_need_reassessment', true);
    }
};

// --- FINAL STP ASSEMBLY ---
var MegaSTP = {
    U: [120, 150, 180],
    activities: MEGA_STP_ACTIVITIES
};

// Make it available for registration
this.MegaSTP = MegaSTP;
console.log("--- SoCoABE Mega-STP defined successfully. ---");