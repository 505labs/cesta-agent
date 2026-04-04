"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCardholder = ensureCardholder;
const stripe_1 = __importDefault(require("stripe"));
const config_js_1 = require("../config.js");
const stripe = new stripe_1.default(config_js_1.config.stripe.secretKey);
// Single shared testnet cardholder — in production you'd create per-user
let ephemeralCardholderId = null;
async function ensureCardholder() {
    if (ephemeralCardholderId)
        return ephemeralCardholderId;
    // Check if we already have one from a previous run
    const list = await stripe.issuing.cardholders.list({ limit: 1, status: 'active' });
    if (list.data.length > 0) {
        ephemeralCardholderId = list.data[0].id;
        return ephemeralCardholderId;
    }
    const cardholder = await stripe.issuing.cardholders.create({
        name: 'TEE Card Issuer',
        email: 'tee-issuer@example.com',
        type: 'individual',
        billing: {
            address: {
                line1: '123 Main St',
                city: 'San Francisco',
                state: 'CA',
                postal_code: '94111',
                country: 'US',
            },
        },
        status: 'active',
    });
    ephemeralCardholderId = cardholder.id;
    console.log('[stripe] Created cardholder:', cardholder.id);
    return cardholder.id;
}
