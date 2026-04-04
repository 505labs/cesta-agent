"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noopFraudCheck = void 0;
/**
 * No-op fraud check — used when WORLD_ID_ENABLED=false.
 * All requests pass through. Safe to use in development.
 */
exports.noopFraudCheck = {
    async check() {
        // No-op: allow all requests
    },
    async ban(_nullifierHash, _reason) {
        // No-op: banning not supported without World ID
        console.warn('[fraud] Ban called but WORLD_ID_ENABLED=false — no effect');
    },
};
