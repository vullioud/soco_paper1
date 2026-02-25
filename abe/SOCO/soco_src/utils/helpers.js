var helpers = {
    deepCopy: function(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        return JSON.parse(JSON.stringify(obj));
    },

    mean: function(arr) {
        if (!arr || arr.length === 0) return 0;
        var sum = 0;
        for (var i = 0; i < arr.length; i++) sum += arr[i];
        return sum / arr.length;
    },

    // Standard Deviation
    calculate_std_dev: function(arr) {
        if (!arr || arr.length < 2) return 0;
        var avg = this.mean(arr);
        var squareDiffs = arr.map(function(value) {
            var diff = value - avg;
            return diff * diff;
        });
        var avgSquareDiff = this.mean(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }
};
this.helpers = helpers;