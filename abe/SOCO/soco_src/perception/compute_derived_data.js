// ----- Start of File: soco_src/perception/compute_derived_data.js -----

/**
 * =================================================================================
 * FILE: compute_derived_data.js
 * =================================================================================
 */

Perception.compute_derived_data = function(stand_data_obj, agent) {
    
    const data = stand_data_obj.iLand_stand_data;
    const history = stand_data_obj.history;
    const classified = stand_data_obj.classified;

    // --- 0. PRE-PROCESSING (History & Soco Age) ---
    if (history.last_activity_Year !== -1) {
        history.time_since_last_activity = Globals.year - history.last_activity_Year;
    } else {
        history.time_since_last_activity = -1;
    }
    
    const is_final_harvest = (history.last_activity === 'MegaSTP_Clearcut' || 
                              history.last_activity === 'MegaSTP_Shelterwood_Final' ||
                             history.last_activity === 'MegaSTP_Femel_Final');
    
    if (data.absolute_age_soco === 0 && Globals.year > 1) {
        data.absolute_age_soco = Math.floor(data.stand_age);
    } else if (is_final_harvest && history.last_activity_Year === (Globals.year - 1)) {
        data.absolute_age_soco = 0;
    } else if (Globals.year > 1) {
        data.absolute_age_soco += 1;
    }

    // Set context
    fmengine.standId = stand_data_obj.stand_id;
    stand.trees.loadAll(); 

    // =========================================================
    // --- 1. PIPELINE A: AGE CLASS (Deterministic) ---
    // =========================================================

    var soco_age = data.absolute_age_soco;
    var age_class_result;
    if      (soco_age <= 5)  age_class_result = "Planting";
    else if (soco_age <= 9)  age_class_result = "Establishment";
    else if (soco_age <= 20) age_class_result = "Tending";
    else if (soco_age <= 29) age_class_result = "Pole";
    else if (soco_age <= 70) age_class_result = "Thinning";
    else if (soco_age <= 79) age_class_result = "Mature";
    else                     age_class_result = "Harvesting";
    classified.age_class = age_class_result;


    // =========================================================
    // --- 2. PIPELINE B: ACTIVITY CLASS (WET / HEIGHT + STOCKING) ---
    // =========================================================
    
    // 2a. Use iLand Top Height directly
    var dom_h = data.top_height; 
    classified.dom_top_height = dom_h;

    var total_ba = stand.basalArea;

    // 2b. Species Composition Vector
    // We calculate this first as we might need it, but mainly for storage.
    var species_vector = [];
    if (total_ba > 0) {
        for (var i = 0; i < stand.nspecies; i++) {
            var sp_id = stand.speciesId(i);
            var sp_ba = stand.speciesBasalArea(i);
            var share = sp_ba / total_ba;
            species_vector.push({ id: sp_id, share: share });
        }
        // Sort descending by share
        species_vector.sort(function(a, b) { return b.share - a.share; });
    }
    classified.dominant_species = species_vector; 

    // 2c. Classification Logic
    // Thresholds: [Start_Tending, Start_Thinning, Start_Harvesting]
    var thresholds = [2, 10, 25]; 
    var ba_planting_threshold = 5.0; // m2/ha. Below this, we assume the stand is empty/planting phase.

    var activity_phase = "Planting"; 

    // Check 1: Is the stand effectively empty?
    if (total_ba < ba_planting_threshold) {
        activity_phase = "Planting";
    } else {
        // Check 2: Height based classification
        if (dom_h < thresholds[0]) activity_phase = "Planting";
        else if (dom_h < thresholds[1]) activity_phase = "Tending";
        else if (dom_h < thresholds[2]) activity_phase = "Thinning";
        else activity_phase = "Harvesting";
    }

    classified.activity_class = classified.age_class;


    // =========================================================
    // --- 3. PIPELINE C: STRUCTURE CLASSIFICATION (VERTICAL LAYERS) ---
    // =========================================================
    
    // Structure based on vertical layering (BA distribution across height classes)
    var ba_lower = 0, ba_middle = 0, ba_upper = 0;
    
    // Define layers relative to Top Height
    var limit_low = dom_h * 0.33;
    var limit_high = dom_h * 0.66;
    
    var count = stand.trees.count;
    
    // Iterate trees to sum BA in layers
    // Note: stand.trees is already loaded via loadAll() at start of function
    for(var i = 0; i < count; i++) {
        var t = stand.trees.tree(i);
        var t_ba = t.basalArea; 
        var t_h = t.height;

        if (t_h < limit_low) ba_lower += t_ba;
        else if (t_h < limit_high) ba_middle += t_ba;
        else ba_upper += t_ba;
    }
    
    var layers = 0;
    var threshold_share = 0.10; // A layer counts if it has > 10% of total BA
    
    if (total_ba > 0) {
        if ((ba_lower / total_ba) > threshold_share) layers++;
        if ((ba_middle / total_ba) > threshold_share) layers++;
        if ((ba_upper / total_ba) > threshold_share) layers++;
    }

    // Map layer count to classes
    if (layers <= 1) classified.structure_class = 'low';
    else if (layers === 2) classified.structure_class = 'medium';
    else classified.structure_class = 'high';

    // Store basal area by layer for yearly structure logging
    classified.basal_area_by_layer = {
        ba_lower: ba_lower,
        ba_middle: ba_middle,
        ba_upper: ba_upper,
        share_lower: total_ba > 0 ? (ba_lower / total_ba) : 0,
        share_middle: total_ba > 0 ? (ba_middle / total_ba) : 0,
        share_upper: total_ba > 0 ? (ba_upper / total_ba) : 0,
        dom_height: dom_h,
        total_ba: total_ba
    };


    // =========================================================
    // --- 4. PIPELINE D: SPECIES DOMINANCE (LEGACY SUPPORT) ---
    // =========================================================
    
    var conifers = ['piab', 'pisy', 'abal', 'psme', 'lade', 'pini', 'larix'];
    var leading_species_id = (species_vector.length > 0) ? species_vector[0].id : "none";
    var max_share = (species_vector.length > 0) ? species_vector[0].share : 0;

    if (leading_species_id === "none") {
        classified.species_dominance = 'mixed';
    } else {
        if (conifers.indexOf(leading_species_id) > -1) classified.species_dominance = 'conifer';
        else classified.species_dominance = 'broadleaf';
        
        // Use strict 70% threshold for Pure vs Mixed
        if (max_share < 0.70) classified.species_dominance = 'mixed';
    }

    return stand_data_obj;
};

