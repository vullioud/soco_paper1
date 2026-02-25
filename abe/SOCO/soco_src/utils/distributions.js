
var Distributions = {

    sample: function(distObj) {
        if (!distObj || !distObj.distribution_function) {
            console.error("Invalid distribution object passed to Distributions.sample:", distObj);
            return null;
        }

        const func = distObj.distribution_function;
        const params = distObj.distribution_params;

        switch (func) {
            case "normal":
                return this._sampleNormal(params.mean, params.sd);
            case "poisson":
                return this._samplePoisson(params.lambda);
            case "beta":
                return this._sampleBeta(params.alpha, params.beta);
            case "gamma":
                return this._sampleGamma(params.shape, params.scale);
            case "dirichlet":
                // Returns a named object, e.g., { clearcut: 0.8, femel: 0.2 }
                return this._sampleDirichlet(params.options, params.alpha);
            default:
                console.error("Unknown distribution function:", func);
                return null;
        }
    },

    weighted_random_choice: function(weights_object) {
        if (!weights_object || Object.keys(weights_object).length === 0) return 'undefined';
        let sum = 0;
        const r = Math.random();
        for (const key in weights_object) {
            sum += weights_object[key];
            if (r <= sum) return key;
        }
        return Object.keys(weights_object)[0];
    },
    
    _sampleNormal: function(mean, stddev) {
        // Box-Muller transform for Normal distribution
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * (stddev || 1) + (mean || 0);
    },

    _samplePoisson: function(lambda) {
        // Knuth's algorithm for Poisson distribution
        if (lambda === undefined || lambda <= 0) return 0;
        let L = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
            k++;
            p *= Math.random();
        } while (p > L);
        return k - 1;
    },

    _sampleBeta: function(alpha, beta) {
        if (alpha <= 0 || beta <= 0) return 0.5;
        var x = this._sampleGamma(alpha, 1);
        var y = this._sampleGamma(beta, 1);
        return x / (x + y);
    },

    _sampleGamma: function(shape, scale) {
        // Marsaglia & Tsang's method for shape > 1
        if (shape <= 0) return 0;
        if (shape < 1) {
            return this._sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
        }
        var d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d), x, v;
        while (true) {
            do {
                x = this._sampleNormal(0, 1);
                v = 1 + c * x;
            } while (v <= 0);
            v = v * v * v;
            var u = Math.random();
            if (u < 1 - 0.0331 * (x * x) * (x * x)) return (d * v * (scale || 1));
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return (d * v * (scale || 1));
        }
    },

    _sampleDirichlet: function(options, alphas) {
        const samples = alphas.map(alpha => this._sampleGamma(alpha, 1));
        const sum = samples.reduce((a, b) => a + b, 0);
        
        const weights = (sum === 0)
            ? alphas.map(() => 1 / alphas.length)
            : samples.map(s => s / sum);

        const namedResult = {};
        options.forEach((option, i) => {
            namedResult[option] = weights[i];
        });
        
        return namedResult;
    }
};

this.Distributions = Distributions;
