"use strict";
// x402 v2 types — https://docs.x402.org/core-concepts/http-402
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_HEADER = exports.PAYMENT_REQUIRED_HEADER = void 0;
exports.encodePaymentRequired = encodePaymentRequired;
exports.decodePaymentPayload = decodePaymentPayload;
// x402 response headers
exports.PAYMENT_REQUIRED_HEADER = 'X-PAYMENT-REQUIRED';
exports.PAYMENT_HEADER = 'X-PAYMENT';
function encodePaymentRequired(req) {
    return Buffer.from(JSON.stringify(req)).toString('base64');
}
function decodePaymentPayload(encoded) {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}
