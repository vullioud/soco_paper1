// FILE: soco_src/cognition/species/species_strategies.js
// Paper 1: Config-driven species strategies by behavioral_type.

var SpeciesStrategies = {

    execute: function(strategyName, stand_data, agent, activityType) {
        if (activityType === 'planting') {
            return this.get_planting_mix(agent.behavioral_type);
        } else {
            return this.get_thinning_weights(agent.behavioral_type, stand_data);
        }
    },

    get_thinning_weights: function(behavioral_type, stand_data) {
        if (behavioral_type === 'PA') return { rest: 1.0 };

        var condition = ConditionClassifier.classify(stand_data);
        var type_weights = SoCoABE_CONFIG.THINNING_WEIGHTS[behavioral_type];
        if (!type_weights) return { rest: 1.0 };

        var base = type_weights[condition];
        if (!base) return { rest: 1.0 };

        // Copy weights
        var weights = {};
        for (var k in base) weights[k] = base[k];

        // Rarity protection for mixed stands
        if (condition === "mixed") {
            var dom = stand_data.classified.dominant_species;
            if (dom) {
                dom.forEach(function(s) {
                    if (s.share < 0.10) {
                        weights[s.id] = (weights[s.id] || 1.0) * 1.5;
                    }
                });
            }
        }

        return weights;
    },

    get_planting_mix: function(behavioral_type) {
        var config = SoCoABE_CONFIG.PLANTING_CONFIG[behavioral_type];
        if (!config) return { species: ['fasy'], fractions: [1.0] };

        var pool = [];
        for (var sp in config.weights) {
            pool.push({ id: sp, weight: config.weights[sp] });
        }

        // Draw n_species from weights (without replacement)
        var species = [];
        for (var i = 0; i < config.n_species && pool.length > 0; i++) {
            var total_w = 0;
            for (var j = 0; j < pool.length; j++) total_w += pool[j].weight;

            var r = Math.random() * total_w;
            var cumul = 0;
            for (var k = 0; k < pool.length; k++) {
                cumul += pool[k].weight;
                if (r < cumul) {
                    species.push(pool[k].id);
                    pool.splice(k, 1);
                    break;
                }
            }
        }

        if (species.length === 0) species = ['fasy'];
        var frac = 1.0 / species.length;
        var fractions = [];
        for (var f = 0; f < species.length; f++) fractions.push(frac);

        return { species: species, fractions: fractions };
    }
};

this.SpeciesStrategies = SpeciesStrategies;
