// ----- Start of File: soco_src/utils/soco_log.js -----

/**
 * =================================================================================
 * FILE: soco_log.js
 * =================================================================================
 * DESCRIPTION:
 * Centralized logging utility for SoCoABE. Provides controlled console output
 * based on configuration settings. Helps reduce console spam and improve
 * simulation performance during production runs.
 * =================================================================================
 */

var SoCoLog = {

    /**
     * Check if we are currently in the warming period
     * @returns {boolean}
     */
    isWarmingPeriod: function() {
        if (typeof SoCoABE_CONFIG === 'undefined') return false;
        if (!SoCoABE_CONFIG.WARMING || !SoCoABE_CONFIG.WARMING.ENABLED) return false;

        var warmingEnd = SoCoABE_CONFIG.WARMING.DURATION || 0;
        return Globals.year <= warmingEnd;
    },

    /**
     * Get the year when warming period ends (first year of recording)
     * @returns {number}
     */
    getRecordingStartYear: function() {
        if (typeof SoCoABE_CONFIG === 'undefined') return 1;
        if (!SoCoABE_CONFIG.WARMING || !SoCoABE_CONFIG.WARMING.ENABLED) return 1;

        return (SoCoABE_CONFIG.WARMING.DURATION || 0) + 1;
    },

    /**
     * Check if logging is enabled for a given category
     * @param {string} category - 'activities', 'agent_cycles', 'network', 'decisions'
     * @returns {boolean}
     */
    isEnabled: function(category) {
        if (typeof SoCoABE_CONFIG === 'undefined') return true;
        if (!SoCoABE_CONFIG.SOCO_LOG) return true;  // Default to logging if not configured

        // Master switch
        if (!SoCoABE_CONFIG.SOCO_LOG.ENABLED) return false;

        // During warming, check warming-specific setting
        if (this.isWarmingPeriod() && !SoCoABE_CONFIG.SOCO_LOG.ENABLED_DURING_WARMING) {
            return false;
        }

        // Category-specific switches
        switch(category) {
            case 'activities':
                return SoCoABE_CONFIG.SOCO_LOG.LOG_ACTIVITIES !== false;
            case 'agent_cycles':
                return SoCoABE_CONFIG.SOCO_LOG.LOG_AGENT_CYCLES !== false;
            case 'network':
                return SoCoABE_CONFIG.SOCO_LOG.LOG_NETWORK !== false;
            case 'decisions':
                return SoCoABE_CONFIG.SOCO_LOG.LOG_DECISIONS !== false;
            default:
                return true;
        }
    },

    /**
     * Log a message if logging is enabled for the category
     * @param {string} category - Category of the log
     * @param {string} message - Message to log
     */
    log: function(category, message) {
        if (this.isEnabled(category)) {
            console.log(message);
        }
    },

    /**
     * Log activity execution (used in mega_STP.js)
     * @param {string} message
     */
    activity: function(message) {
        this.log('activities', message);
    },

    /**
     * Log agent cycle information
     * @param {string} message
     */
    agent: function(message) {
        this.log('agent_cycles', message);
    },

    /**
     * Log network operations
     * @param {string} message
     */
    network: function(message) {
        this.log('network', message);
    },

    /**
     * Log decision-making process
     * @param {string} message
     */
    decision: function(message) {
        this.log('decisions', message);
    },

    /**
     * Always log - for critical messages that should always appear
     * @param {string} message
     */
    always: function(message) {
        console.log(message);
    },

    /**
     * Log error - always shown
     * @param {string} message
     */
    error: function(message) {
        console.error(message);
    },

    /**
     * Log warning - always shown
     * @param {string} message
     */
    warn: function(message) {
        console.warn(message);
    },

    /**
     * Log only at specific year intervals (e.g., every 10 years)
     * @param {number} interval - Year interval
     * @param {string} category - Log category
     * @param {string} message - Message to log
     */
    periodic: function(interval, category, message) {
        if (Globals.year % interval === 0) {
            this.log(category, message);
        }
    }
};

this.SoCoLog = SoCoLog;

// ----- End of File: soco_src/utils/soco_log.js -----
