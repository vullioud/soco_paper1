// FILE: soco_src/cognition/species/wet_selectivity.js
// Compute owner-specific species selectivity from WET target and current composition.

var WetSelectivity = {

    /**
     * Compute owner-specific target composition.
     * target[sp] = ref + c * (current - ref), floored at 0.02, then normalized.
     *
     * @param {string} wet_type — WET code ('b','e','f', etc.)
     * @param {object} current — {species_id: fraction, ...} current composition
     * @param {number} c — concentration param (0=WET, 1=current, >1=amplify dominant)
     * @param {object} wet_targets — WET_TARGETS lookup table from institution
     * @returns {object} {species_id: target_fraction, ...}
     */
    computeOwnerTarget: function(wet_type, current, c, wet_targets) {
        var ref = wet_targets[wet_type];
        if (!ref) ref = wet_targets['b'];  // fallback to beech mixed

        // Collect all species from both ref and current
        var all_species = {};
        var sp;
        for (sp in ref) { if (sp !== 'rest') all_species[sp] = true; }
        for (sp in current) { all_species[sp] = true; }

        var rest_ref = ref['rest'] || 0.05;
        var target = {};
        var total = 0;

        for (sp in all_species) {
            var r = (ref[sp] !== undefined) ? ref[sp] : rest_ref;
            var cur = current[sp] || 0;
            var t = r + c * (cur - r);
            if (t < 0.02) t = 0.02;
            target[sp] = t;
            total += t;
        }

        // Normalize to 1
        if (total > 0) {
            for (sp in target) {
                target[sp] = target[sp] / total;
            }
        }

        return target;
    },

    /**
     * Compute species selectivity values for a stand.
     * sel = 0.5 - (deviation * intensity * 2.0), clamped [0.05, 0.95].
     * Species with share > target get sel < 0.5 (selected against).
     * Species with share < target get sel > 0.5 (favored).
     *
     * @param {object} stand_data_obj — stand_data instance
     * @param {object} agent — socoabe_agent instance
     * @returns {object} {species_id: selectivity_value, ...} or {} if no regulation
     */
    computeSpeciesSelectivity: function(stand_data_obj, agent) {
        var wet_type = stand_data_obj.wet_type;
        if (!wet_type) return {};

        var behavioral_type = agent.behavioral_type;
        var inst = agent.owner.institution;
        var params = inst.owner_species_params[behavioral_type];
        if (!params) return {};
        if (params.intensity === 0) return {};

        // Build current composition from classified.dominant_species
        var dom = stand_data_obj.classified.dominant_species;
        if (!dom || dom.length === 0) return {};

        var current = {};
        for (var i = 0; i < dom.length; i++) {
            // Group oaks and maples (same grouping as WetClassifier)
            var sp = dom[i].id;
            if (WetClassifier.OAK_GROUP.indexOf(sp) > -1) {
                sp = 'qusp';
            } else if (WetClassifier.MAPLE_GROUP.indexOf(sp) > -1) {
                sp = 'acsp';
            }
            current[sp] = (current[sp] || 0) + dom[i].share;
        }

        // Compute owner target
        var target = this.computeOwnerTarget(wet_type, current, params.c, inst.wet_targets);

        // Compute selectivity per grouped species
        var sel_grouped = {};
        var intensity = params.intensity;

        // Process all species in target (superset of current)
        for (var tsp in target) {
            var cur_frac = current[tsp] || 0;
            var tgt_frac = target[tsp] || 0;
            var deviation = cur_frac - tgt_frac;
            var s = 0.5 - (deviation * intensity * 2.0);
            if (s < 0.05) s = 0.05;
            if (s > 0.95) s = 0.95;
            sel_grouped[tsp] = s;
        }

        // Expand genus-level group codes (qusp, acsp) back to actual
        // iLand species IDs present in the stand.  iLand expressions only
        // accept real 4-letter species codes, not our internal groups.
        var sel = {};
        // Build a map of group code → actual species IDs seen in this stand
        var group_members = {};  // e.g. { qusp: ['quro','qupe'], acsp: ['acps'] }
        for (var k = 0; k < dom.length; k++) {
            var raw_id = dom[k].id;
            if (WetClassifier.OAK_GROUP.indexOf(raw_id) > -1 && raw_id !== 'qusp') {
                if (!group_members['qusp']) group_members['qusp'] = [];
                if (group_members['qusp'].indexOf(raw_id) === -1) group_members['qusp'].push(raw_id);
            } else if (WetClassifier.MAPLE_GROUP.indexOf(raw_id) > -1 && raw_id !== 'acsp') {
                if (!group_members['acsp']) group_members['acsp'] = [];
                if (group_members['acsp'].indexOf(raw_id) === -1) group_members['acsp'].push(raw_id);
            }
        }

        for (var gsp in sel_grouped) {
            if (group_members[gsp]) {
                // Expand group code to each real species in the stand
                var members = group_members[gsp];
                for (var m = 0; m < members.length; m++) {
                    sel[members[m]] = sel_grouped[gsp];
                }
            } else if (gsp !== 'qusp' && gsp !== 'acsp') {
                // Regular species — pass through
                sel[gsp] = sel_grouped[gsp];
            }
            // If gsp is qusp/acsp but no members found in stand, skip it
        }

        return sel;
    }
};
this.WetSelectivity = WetSelectivity;
