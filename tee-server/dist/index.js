"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const config_js_1 = require("./config.js");
const cardIssue_js_1 = require("./routes/cardIssue.js");
const admin_js_1 = require("./routes/admin.js");
const signer_js_1 = require("./crypto/signer.js");
const ethers_1 = require("ethers");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        worldId: config_js_1.config.worldId.enabled,
        chains: ['arc-testnet', 'hedera-testnet'],
    });
});
/**
 * GET /v1/attestation
 *
 * Returns a verifiable attestation of what code is running in this TEE.
 *
 * Verification steps for a user:
 *   1. GET /v1/attestation — note tee_pubkey and code_hash
 *   2. Check code_hash matches the published Docker image SHA on GitHub
 *   3. On every /v1/card-issue response, verify:
 *        ethers.verifyMessage(JSON.stringify(receipt, sortedKeys), tee_signature) === tee_pubkey
 *   4. Confirm receipt.amount_usd_cents === receipt.card_spending_limit_cents (card limit = what you paid)
 *
 * The tee_pubkey is derived inside the enclave from the TEE's root secret.
 * An operator who modifies the code would produce a different code_hash (breaking step 2)
 * or lose access to the signing key (breaking step 3).
 */
app.get('/v1/attestation', async (_req, res) => {
    const teePubkey = (0, signer_js_1.getTeePubkey)();
    const codeHash = (0, signer_js_1.getCodeHash)();
    // Self-sign the attestation so clients can verify the pubkey is live
    const attestation = {
        code_hash: codeHash,
        tee_pubkey: teePubkey,
        chains: ['arc-testnet', 'hedera-testnet'],
        timestamp: Math.floor(Date.now() / 1000),
        version: '1',
    };
    const attestation_signature = await (0, signer_js_1.signReceipt)(attestation);
    res.json({
        ...attestation,
        attestation_signature,
        verify_instructions: {
            step1: 'Check code_hash matches the published Docker image digest at github.com/your-repo/releases',
            step2: 'On each /v1/card-issue response, run: ethers.verifyMessage(JSON.stringify(receipt, sortedKeys), tee_signature)',
            step3: 'Confirm the recovered address === tee_pubkey from this endpoint',
            step4: 'Confirm receipt.amount_usd_cents === receipt.card_spending_limit_cents',
        },
    });
});
/**
 * POST /v1/verify-receipt
 *
 * Utility endpoint — verifies a receipt + signature inline.
 * Body: { receipt: object, tee_signature: string }
 * Returns: { valid: bool, recovered_pubkey: string, expected_pubkey: string }
 */
app.post('/v1/verify-receipt', async (req, res) => {
    const { receipt, tee_signature } = req.body;
    if (!receipt || !tee_signature) {
        return res.status(400).json({ error: 'receipt and tee_signature required' });
    }
    try {
        const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
        const recovered = ethers_1.ethers.verifyMessage(canonical, tee_signature);
        const expected = (0, signer_js_1.getTeePubkey)();
        res.json({ valid: recovered.toLowerCase() === expected.toLowerCase(), recovered_pubkey: recovered, expected_pubkey: expected });
    }
    catch (err) {
        res.status(400).json({ valid: false, error: err.message });
    }
});
// Card issuance (x402 gated)
app.use('/v1/card-issue', cardIssue_js_1.cardIssueRouter);
// Admin (ban management, audit log)
app.use('/admin', admin_js_1.adminRouter);
// x402 facilitator endpoints (for external merchants who want to use our TEE)
app.post('/facilitator/verify', async (req, res) => {
    const { verify } = await Promise.resolve().then(() => __importStar(require('./x402/facilitator.js')));
    const { payload, requirements } = req.body;
    if (!payload || !requirements) {
        return res.status(400).json({ error: 'payload and requirements required' });
    }
    const result = await verify(payload, requirements);
    res.json(result);
});
app.post('/facilitator/settle', async (req, res) => {
    const { settle } = await Promise.resolve().then(() => __importStar(require('./x402/facilitator.js')));
    const { payload } = req.body;
    if (!payload) {
        return res.status(400).json({ error: 'payload required' });
    }
    const result = await settle(payload);
    res.json(result);
});
app.listen(config_js_1.config.port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║     TEE Card Issuer — running on :${config_js_1.config.port}     ║
╠══════════════════════════════════════════════╣
║  POST /v1/card-issue    — x402 card issuance ║
║  POST /facilitator/*    — x402 facilitator   ║
║  POST /admin/ban        — ban fraud users    ║
║  GET  /health           — health check       ║
╠══════════════════════════════════════════════╣
║  World ID: ${config_js_1.config.worldId.enabled ? 'ENABLED  ' : 'DISABLED '}                        ║
║  Chains:   Arc testnet + Hedera testnet      ║
╚══════════════════════════════════════════════╝
  `);
});
exports.default = app;
