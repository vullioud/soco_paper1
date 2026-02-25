// ----- Start of File: soco_src/cognition/species/functions/species_strategies.js -----

/**
 * =================================================================================
 * FILE: species_strategies.js (Refined Logic)
 * =================================================================================
 * DESCRIPTION:
 * - Ecologist: now correctly maintains "Mixed" state without reverting to dominance.
 * - Standardizer: now strongly biased towards Conifers (Industrial).
 * =================================================================================
 */

var SpeciesStrategies = {

    execute: function(strategyName, stand_data, agent, activityType) {
        if (this[strategyName] && typeof this[strategyName] === 'function') {
            return this[strategyName](stand_data, agent, activityType);
        } else {
            console.warn(`[SpeciesStrategy] Unknown strategy '${strategyName}'. Defaulting to indiscriminate.`);
            return this.indiscriminate(stand_data, agent, activityType);
        }
    },

    // --- Helper: Consistency Manager ---
    _resolveTargets: function(stand_data, valid_species_list, count, force_refresh) {
        var current_targets = stand_data.history.target_species || [];
        
        if (!force_refresh) {
            var isValid = current_targets.length > 0 && current_targets.every(function(s) {
                return valid_species_list.indexOf(s) > -1;
            });
            if (isValid) return current_targets;
        }

        var new_targets = [];
        
        // Opportunistic: Keep existing valid species
        if (!force_refresh) {
            var dom_list = stand_data.classified.dominant_species;
            if (dom_list) {
                dom_list.forEach(function(item) {
                    if (valid_species_list.indexOf(item.id) > -1) {
                        if (new_targets.indexOf(item.id) === -1) new_targets.push(item.id);
                    }
                });
            }
        }

        // Fill gaps
        var needed = count - new_targets.length;
        if (needed > 0) {
            var pool = valid_species_list.filter(function(s) { return new_targets.indexOf(s) === -1; });
            var shuffled = pool.slice(0).sort(function() { return 0.5 - Math.random(); });
            var picks = shuffled.slice(0, needed);
            new_targets = new_targets.concat(picks);
        }

        if (new_targets.length > count) new_targets = new_targets.slice(0, count);
        
        stand_data.history.target_species = new_targets;
        return new_targets;
    },

    _getShare: function(stand_data, target_list) {
        var total_share = 0;
        var dom_list = stand_data.classified.dominant_species;
        if (!dom_list) return 0;
        dom_list.forEach(function(item) {
            if (target_list.indexOf(item.id) > -1) total_share += item.share;
        });
        return total_share;
    },

    // --- 1. Indiscriminate (Status Quo) ---
    indiscriminate: function(stand_data, agent, activityType) {
        // Record the status quo (dominant species) as the target
        var dom_species = stand_data.classified.dominant_species;
        var current_dom = (dom_species.length > 0) ? dom_species[0].id : 'piab';
        stand_data.history.target_species = [current_dom];

        if (activityType === 'planting') {
            if (dom_species.length > 0) {
                var sp = [], fr = [];
                dom_species.forEach(function(item) {
                    if (item.share > 0.1) { sp.push(item.id); fr.push(item.share); }
                });
                var sum = fr.reduce((a,b)=>a+b, 0);
                fr = fr.map(f => f/sum);
                return { species: sp, fractions: fr };
            } else {
                return { species: ['piab'], fractions: [1.0] };
            }
        } else {
            return { "rest": 1.0 }; 
        }
    },

    // --- 2. Standardizer (Industrial Efficiency) ---
    standardizer: function(stand_data, agent, activityType) {
        var risk_tolerance = agent.risk_tolerance; 
        var valid_pool = [];
        var count = 1;

        // BIAS: Even if Risk Averse, prefer Conifers (80% chance)
        var prefer_conifer = Math.random() < 0.8;

        if (risk_tolerance > 0.6) {
            // High Risk: Fast Conifers (Monoculture)
            valid_pool = SpeciesData.PROD_FAST_CONIFER;
        } else {
            // Low Risk: 
            if (prefer_conifer) {
                // Robust Conifers
                valid_pool = SpeciesData.PROD_ROBUST_CONIFER;
                count = 2;
            } else {
                // High Value Broadleaves
                valid_pool = SpeciesData.PROD_VALUE_BROADLEAF;
                count = 2;
            }
        }

        var force = (activityType === 'planting');
        var targets = this._resolveTargets(stand_data, valid_pool, count, force);

        if (activityType === 'planting') {
            var fracs = targets.length === 1 ? [1.0] : [0.7, 0.3];
            return { species: targets, fractions: fracs };
        } else {
            var weights = { "rest": 0.05 }; // Aggressive removal of non-targets
            targets.forEach(function(sp) { weights[sp] = 1.0; });
            return weights;
        }
    },

    // --- 3. Resilience (Climate Security) ---
    resilience: function(stand_data, agent, activityType) {
        var resilient_group = SpeciesData.CLIMATE_BROADLEAF.concat(SpeciesData.CLIMATE_CONIFER);
        
        if (activityType !== 'planting') {
            var current_resilient_share = this._getShare(stand_data, resilient_group);
            if (current_resilient_share > 0.5) {
                return this.indiscriminate(stand_data, agent, activityType);
            }
        }

        var force = (activityType === 'planting');
        var targets = this._resolveTargets(stand_data, resilient_group, 3, force);

        if (activityType === 'planting') {
            var fracs = [0.33, 0.33, 0.34];
            return { species: targets, fractions: fracs };
        } else {
            var weights = { "rest": 0.5 }; 
            targets.forEach(function(sp) { weights[sp] = 1.0; });
            if (targets.indexOf('piab') === -1) weights['piab'] = 0.1;
            return weights;
        }
    },

    // --- 4. Ecologist (Diversity) ---
     ecologist: function(stand_data, agent, activityType) {
        var n_species = stand_data.iLand_stand_data.species_count;
        var dom_list = stand_data.classified.dominant_species;
        var top_share = (dom_list.length > 0) ? dom_list[0].share : 0;

        // A. Satisfaction Check
        if (n_species >= 5 && top_share <= 0.5) {
            stand_data.history.target_species = ["Mixed"]; 
            return { "rest": 1.0 }; 
        }

        // B. Action - Planting (Enrichment Mix)
        if (activityType === 'planting') {
            // Logic: Find what is MISSING
            var present_ids = dom_list.map(function(item) { return item.id; });
            
            // Filter BROADLEAVES to find candidates that are NOT present
            var candidates = SpeciesData. BROADLEAVES.filter(function(s) { 
                return present_ids.indexOf(s) === -1; 
            });

            // FIX: Plant a mix of up to 4 missing species
            var count_to_plant = 4;
            var picks = [];
            
            if (candidates.length > 0) {
                // Shuffle and pick top 4
                var shuffled = candidates.sort(function() { return 0.5 - Math.random(); });
                picks = shuffled.slice(0, count_to_plant);
            } else {
                // Fallback: If stand has everything, pick random rare ones to boost?
                picks = SpeciesData.getMultipleRandom('BROADLEAVES', count_to_plant);
            }

            // Calculate fractions (equal split)
            var fracs = [];
            var share = 1.0 / picks.length;
            for (var i = 0; i < picks.length; i++) fracs.push(share);
            
            stand_data.history.target_species = ["Mixed"]; 
            return { species: picks, fractions: fracs };
        } 
        
        // C. Action - Thinning (The Shaper)
        else {
            var weights = { "rest": 1.0 }; 
            
            if (dom_list) {
                dom_list.forEach(function(item) {
                    // Rule 1: Break Dominance
                    if (item.share > 0.5) {
                        weights[item.id] = 0.1; 
                    } 
                    // Rule 2: Protect Rarity
                    else if (item.share < 0.1) {
                        weights[item.id] = 2.0; 
                    }
                });
            }
            return weights;
        }
    },

    // --- 5. Experimenter ---
    experimenter: function(stand_data, agent, activityType) {
        var all_valid = SpeciesData.ALL_VALID;
        var force = (activityType === 'planting');
        var targets = this._resolveTargets(stand_data, all_valid, 1, force);

        if (activityType === 'planting') {
            return { species: targets, fractions: [1.0] };
        } else {
            var weights = { "rest": 0.5 }; 
            targets.forEach(function(sp) { weights[sp] = 1.2; });
            return weights;
        }
    }
};

this.SpeciesStrategies = SpeciesStrategies;
