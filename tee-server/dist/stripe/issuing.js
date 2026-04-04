"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOneTimeCard = createOneTimeCard;
exports.cancelCard = cancelCard;
const stripe_1 = __importDefault(require("stripe"));
const config_js_1 = require("../config.js");
const cardholder_js_1 = require("./cardholder.js");
const stripe = new stripe_1.default(config_js_1.config.stripe.secretKey);
/**
 * Create a single-use virtual card for exactly `amountCents` USD.
 * The card is capped at the exact amount and auto-cancels after 1 authorization.
 */
async function createOneTimeCard(amountCents) {
    const cardholderId = await (0, cardholder_js_1.ensureCardholder)();
    // Create the virtual card with spending controls
    const card = await stripe.issuing.cards.create({
        cardholder: cardholderId,
        currency: 'eur',
        type: 'virtual',
        status: 'active',
        spending_controls: {
            spending_limits: [
                {
                    amount: amountCents, // EUR cents (1 USDC ≈ 1 EUR for testnet purposes)
                    interval: 'all_time',
                },
            ],
        },
    });
    // Retrieve full PAN + CVC (only available in test mode via expand)
    const fullCard = await stripe.issuing.cards.retrieve(card.id, {
        expand: ['number', 'cvc'],
    });
    if (!fullCard.number || !fullCard.cvc) {
        throw new Error('Failed to retrieve card credentials — check Stripe Issuing is enabled');
    }
    console.log(`[stripe] Issued one-time card ${card.id} (last4: ${fullCard.last4}) for $${(amountCents / 100).toFixed(2)}`);
    return {
        cardId: fullCard.id,
        number: fullCard.number,
        cvc: fullCard.cvc,
        expMonth: fullCard.exp_month,
        expYear: fullCard.exp_year,
        last4: fullCard.last4,
        amountCents,
    };
}
/**
 * Cancel a card immediately (call after agent confirms use or on timeout).
 */
async function cancelCard(cardId) {
    await stripe.issuing.cards.update(cardId, { status: 'canceled' });
    console.log(`[stripe] Canceled card ${cardId}`);
}
