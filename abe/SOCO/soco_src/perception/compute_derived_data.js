Perception.compute_derived_data = function(stand_data_obj, agent) {

    // Set context
    fmengine.standId = stand_data_obj.stand_id;
    stand.trees.loadAll();

    // --- Species composition vector (consumed by ConditionClassifier) ---
    var total_ba = stand.basalArea;
    var species_vector = [];

    if (total_ba > 0) {
        for (var i = 0; i < stand.nspecies; i++) {
            var sp_id = stand.speciesId(i);
            var sp_ba = stand.speciesBasalArea(i);
            var share = sp_ba / total_ba;
            species_vector.push({ id: sp_id, share: share });
        }
        species_vector.sort(function(a, b) { return b.share - a.share; });
    }

    stand_data_obj.classified.dominant_species = species_vector;

    return stand_data_obj;
};
