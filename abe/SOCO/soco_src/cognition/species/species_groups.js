// ----- Start of File: soco_src/cognition/species/data/species_groups.js -----

/**
 * =================================================================================
 * FILE: species_groups.js (Corrected)
 * =================================================================================
 * DESCRIPTION:
 * Classification of species for cognitive decision making.
 * Strictly validated against the provided species list.
 * =================================================================================
 */

var SpeciesData = {
    
    // --- 1. Production Categories ---
    
    // "High Risk / High Reward" - Fast growing conifers
    PROD_FAST_CONIFER: ['piab', 'lade', 'pisy'], 

    // "Robust Production" - Stable/Adaptive conifers
    PROD_ROBUST_CONIFER: ['psme', 'abal', 'pini'],
    
    // "Value Hardwoods" - Economic value through timber quality
    // Checked against valid list: acps, acpl, frex, fasy, quro, qupe are valid.
    PROD_VALUE_BROADLEAF: ['acps', 'acpl', 'frex', 'fasy', 'quro', 'qupe'],

    // --- 2. Climate / Resilience Categories ---

    // "Climate Broadleaf" - Drought/Heat tolerant broadleaves
    CLIMATE_BROADLEAF: ['quro', 'qupe', 'cabe', 'tico', 'acpl', 'soau', 'soar', 'ulgl', 'casa'],

    // "Climate Conifer" - Drought/Heat tolerant conifers
    CLIMATE_CONIFER: ['pini', 'pisy', 'psme', 'pimu'],

    // --- 3. Functional Groups (Helpers) ---
    // Used for general lookups or fallbacks
    
    CONIFERS: ['piab', 'abal', 'psme', 'lade', 'pisy', 'pini', 'pimu'],
    
    BROADLEAVES: ['fasy', 'quro', 'qupe', 'acps', 'acpl', 'frex', 'cabe', 'algl', 'alin', 'soau', 'bepe', 'casa', 'tico', 'potr', 'acca', 'rops', 'ulgl', 'saca'],

    // The Master List
    ALL_VALID: ["piab", "algl", "saca", "acps", "ulgl", "frex", "quro", "fasy", "abal", "alin", "soau", "pimu", "bepe", "cabe", "qupe", "pisy", "lade", "psme", "casa", "tico", "potr", "acpl", "soar", "poni", "acca", "rops", "pini"],

    /**
     * Helper: Get a random species from a specific list.
     * Returns 'piab' as absolute fallback if list is empty.
     */
    getRandom: function(listName) {
        var list = this[listName];
        if (!list || list.length === 0) return 'piab';
        return list[Math.floor(Math.random() * list.length)];
    },

    /**
     * Helper: Get multiple random species from a list
     */
    getMultipleRandom: function(listName, count) {
        var list = this[listName];
        if (!list) return ['piab'];
        // Simple shuffle and slice
        var shuffled = list.slice(0).sort(function() { return 0.5 - Math.random(); });
        return shuffled.slice(0, count);
    }
};

this.SpeciesData = SpeciesData;

// ----- End of File: soco_src/cognition/species/data/species_groups.js -----