Action.prepare.plenter = function(params) {


    if (params && params.plenterCurve) {
        // We just pass the object directly to the flag.
        stand.setFlag('abe_param_plenterCurve', params.plenterCurve);
        console.log(`      -> Setting 'abe_param_plenterCurve' flag with received object.`);
    } else {
        console.warn(`      -> WARN: No 'plenterCurve' object found in parameters. Setting empty flag.`);
        stand.setFlag('abe_param_plenterCurve', {});
    }
};