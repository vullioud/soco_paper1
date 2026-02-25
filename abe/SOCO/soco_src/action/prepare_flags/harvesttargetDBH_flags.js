Action.prepare.targetDBH = function(params) {
    if (params && params.dbhListProfile) {
        // 'params.dbhListProfile' now correctly holds the full dbhList object.
        stand.setFlag('abe_param_dbhList', params.dbhListProfile);
    } else {
        stand.setFlag('abe_param_dbhList', {});
    }

    // Set safeguard parameters to prevent excessive harvesting
    // maxRemovalShare: Maximum fraction of volume/BA that can be removed in one operation
    // volumeFallbackShare: If maxRemovalShare exceeded, remove this fraction instead
    var maxRemoval = (params && typeof params.maxRemovalShare === 'number')
        ? params.maxRemovalShare
        : 0.4;  // Default: max 40% removal (more conservative than mega_STP default of 60%)

    var fallbackShare = (params && typeof params.volumeFallbackShare === 'number')
        ? params.volumeFallbackShare
        : 0.2;  // Default: 20% volume removal in fallback mode

    stand.setFlag('abe_param_maxRemovalShare', maxRemoval);
    stand.setFlag('abe_param_volumeFallbackShare', fallbackShare);

};