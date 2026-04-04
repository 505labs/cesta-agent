"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFraudCheck = getFraudCheck;
const config_js_1 = require("../config.js");
const noop_js_1 = require("./noop.js");
const worldid_js_1 = require("./worldid.js");
function getFraudCheck() {
    if (config_js_1.config.worldId.enabled) {
        console.log('[fraud] World ID fraud check enabled');
        return worldid_js_1.worldIdFraudCheck;
    }
    return noop_js_1.noopFraudCheck;
}
