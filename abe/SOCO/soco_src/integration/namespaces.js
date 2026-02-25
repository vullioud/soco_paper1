/**
 * =================================================================================
 * FILE: namespaces.js
 * =================================================================================
 * DESCRIPTION:
 * This file's only job is to create the global namespaces for the major
 * modules. It MUST be the first SoCoABE source file included by `load_all_files.js`
 * to prevent 'ReferenceError' issues.
 * =================================================================================
 */

var Perception = {};
this.Perception = Perception;

var Cognition = {};
this.Cognition = Cognition;

var Action = {
    prepare: {}
};
this.Action = Action;

console.log("--- SoCoABE Global Namespaces Initialized ---");
