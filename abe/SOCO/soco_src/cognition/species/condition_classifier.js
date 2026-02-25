// FILE: soco_src/cognition/species/condition_classifier.js
// Paper 1: Classify stand condition for species strategy selection.

var ConditionClassifier = {
    CONIFERS: ['piab', 'abal', 'psme', 'lade', 'pisy', 'pini'],

    classify: function(stand_data) {
        var dom = stand_data.classified.dominant_species;
        if (!dom || dom.length === 0) return "pioneer";

        var conifer_share = 0;
        var self = this;
        dom.forEach(function(s) {
            if (self.CONIFERS.indexOf(s.id) > -1) conifer_share += s.share;
        });

        if (conifer_share > 0.7) return "conifer_dominated";
        if (conifer_share < 0.3) return "broadleaf_dominated";
        return "mixed";
    }
};
this.ConditionClassifier = ConditionClassifier;
