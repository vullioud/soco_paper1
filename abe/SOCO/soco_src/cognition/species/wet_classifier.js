// FILE: soco_src/cognition/species/wet_classifier.js
// Classify stand into WET (Waldentwicklungstyp) based on species composition.

var WetClassifier = {

    CONIFERS: ['piab', 'abal', 'pisy', 'psme', 'lade', 'pimu'],

    // Oak group (qusp) and maple group (acsp) member species
    OAK_GROUP: ['qupe', 'quro', 'qupu', 'qusp'],
    MAPLE_GROUP: ['acps', 'acpl', 'acca', 'acsp'],

    /**
     * Classify a stand into a WET type code.
     * Uses stand_data_obj.classified.dominant_species (built by compute_derived_data).
     *
     * @param {object} stand_data_obj — stand_data instance (must have classified.dominant_species)
     * @returns {string} WET type code: 'b','e','f','t','d','k','h','j'
     */
    classifyWET: function(stand_data_obj) {
        var dom = stand_data_obj.classified.dominant_species;
        if (!dom || dom.length === 0) return 'b';  // bare ground fallback

        // Build grouped shares
        var shares = {};   // species_id → share
        var total_ba = 0;
        var self = this;

        for (var i = 0; i < dom.length; i++) {
            var sp = dom[i].id;
            var sh = dom[i].share;
            total_ba += sh;

            // Group oaks → qusp
            if (self.OAK_GROUP.indexOf(sp) > -1) {
                shares['qusp'] = (shares['qusp'] || 0) + sh;
            }
            // Group maples → acsp
            else if (self.MAPLE_GROUP.indexOf(sp) > -1) {
                shares['acsp'] = (shares['acsp'] || 0) + sh;
            }
            else {
                shares[sp] = (shares[sp] || 0) + sh;
            }
        }

        if (total_ba === 0) return 'b';  // bare ground

        // Helper: get share for a species (0 if absent)
        function g(sp) { return shares[sp] || 0; }

        // Compute conifer/broadleaf totals
        var total_conifer = 0;
        for (var j = 0; j < self.CONIFERS.length; j++) {
            total_conifer += g(self.CONIFERS[j]);
        }
        var total_broadleaf = 1.0 - total_conifer;

        // Decision tree (first match wins)
        if (g('psme') >= 0.30) return 'd';
        if (g('abal') >= 0.25 && g('abal') >= g('piab')) return 't';
        if (g('piab') >= 0.30 && total_conifer >= 0.50) return 'f';
        if (g('pisy') >= 0.30) return 'k';
        if (g('qusp') >= 0.30) return 'e';
        if (g('fasy') >= 0.30) return 'b';
        if (total_broadleaf >= 0.70 && g('fasy') < 0.30) return 'h';

        // Fallback
        if (total_conifer >= total_broadleaf) return 'f';
        return 'b';
    }
};
this.WetClassifier = WetClassifier;
