Action.prepare.plenter = function(params) {


    if (params && params.plenterCurve) {
        // We just pass the object directly to the flag.
        stand.setFlag('abe_param_plenterCurve', params.plenterCurve);
    } else {
        stand.setFlag('abe_param_plenterCurve', {});
    }
};