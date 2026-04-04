"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyHederaPayment = verifyHederaPayment;
exports.settleHederaPayment = settleHederaPayment;
const sdk_1 = require("@hashgraph/sdk");
const config_js_1 = require("../config.js");
// Hedera testnet USDC token
const HEDERA_USDC_TOKEN_ID = '0.0.429274';
function getClient() {
    const client = config_js_1.config.hedera.network === 'mainnet'
        ? sdk_1.Client.forMainnet()
        : sdk_1.Client.forTestnet();
    client.setOperator(sdk_1.AccountId.fromString(config_js_1.config.hedera.accountId), sdk_1.PrivateKey.fromStringDer(config_js_1.config.hedera.privateKey));
    return client;
}
async function verifyHederaPayment(payload, requirements) {
    try {
        const data = payload.payload;
        // Check destination matches
        if (data.toAccount !== requirements.payTo) {
            return { valid: false, error: 'Invalid payment destination' };
        }
        // Check amount meets requirements
        if (BigInt(data.amount) < BigInt(requirements.maxAmountRequired)) {
            return { valid: false, error: 'Payment amount too low' };
        }
        // Verify asset matches (USDC token ID)
        if (requirements.asset !== HEDERA_USDC_TOKEN_ID) {
            return { valid: false, error: `Unsupported asset: ${requirements.asset}, expected ${HEDERA_USDC_TOKEN_ID}` };
        }
        // Deserialize and validate the partially-signed transaction
        const txBytes = Buffer.from(data.transactionBytes, 'base64');
        const tx = sdk_1.Transaction.fromBytes(txBytes);
        if (!(tx instanceof sdk_1.TransferTransaction)) {
            return { valid: false, error: 'Expected a TransferTransaction' };
        }
        // Verify expiry (Hedera tx valid window ~180s)
        const txId = tx.transactionId;
        if (txId?.validStart) {
            const validStartMs = txId.validStart.seconds.toNumber() * 1000;
            if (Date.now() > validStartMs + 180_000) {
                return { valid: false, error: 'Transaction expired' };
            }
        }
        return { valid: true };
    }
    catch (err) {
        return { valid: false, error: `Hedera verification error: ${err.message}` };
    }
}
async function settleHederaPayment(payload) {
    try {
        const data = payload.payload;
        const client = getClient();
        // Deserialize the partially-signed tx and add facilitator signature
        const txBytes = Buffer.from(data.transactionBytes, 'base64');
        const tx = sdk_1.Transaction.fromBytes(txBytes);
        const facilitatorKey = sdk_1.PrivateKey.fromStringDer(config_js_1.config.hedera.privateKey);
        const signedTx = await tx.sign(facilitatorKey);
        const response = await signedTx.execute(client);
        const receipt = await response.getReceipt(client);
        client.close();
        if (receipt.status.toString() !== 'SUCCESS') {
            return { success: false, error: `Hedera tx failed: ${receipt.status}` };
        }
        return { success: true, txHash: response.transactionId.toString() };
    }
    catch (err) {
        return { success: false, error: `Hedera settlement error: ${err.message}` };
    }
}
