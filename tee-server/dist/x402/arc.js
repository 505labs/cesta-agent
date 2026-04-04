"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyArcPayment = verifyArcPayment;
exports.settleArcPayment = settleArcPayment;
const ethers_1 = require("ethers");
const config_js_1 = require("../config.js");
// Minimal EIP-3009 ABI (transferWithAuthorization + nonces)
const EIP3009_ABI = [
    'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
    'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function name() view returns (string)',
    'function version() view returns (string)',
    'function DOMAIN_SEPARATOR() view returns (bytes32)',
];
// EIP-712 TypeHash for TransferWithAuthorization
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes('TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'));
function getProvider() {
    return new ethers_1.ethers.JsonRpcProvider(config_js_1.config.arc.rpcUrl, {
        chainId: config_js_1.config.arc.chainId,
        name: 'arc-testnet',
    });
}
function getSigner() {
    return new ethers_1.ethers.Wallet(config_js_1.config.arc.walletPrivateKey, getProvider());
}
async function verifyArcPayment(payload, requirements) {
    try {
        const data = payload.payload;
        const { authorization, signature } = data;
        const provider = getProvider();
        const usdc = new ethers_1.ethers.Contract(requirements.asset, EIP3009_ABI, provider); // EURC on Arc
        // 1. Check amounts match
        if (BigInt(authorization.value) < BigInt(requirements.maxAmountRequired)) {
            return { valid: false, error: 'Payment amount too low' };
        }
        // 2. Check destination
        if (authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
            return { valid: false, error: 'Invalid payment destination' };
        }
        // 3. Check expiry
        const now = Math.floor(Date.now() / 1000);
        if (now >= parseInt(authorization.validBefore)) {
            return { valid: false, error: 'Payment authorization expired' };
        }
        if (now < parseInt(authorization.validAfter)) {
            return { valid: false, error: 'Payment authorization not yet valid' };
        }
        // 4. Check nonce not already used
        const nonceUsed = await usdc.authorizationState(authorization.from, authorization.nonce);
        if (nonceUsed) {
            return { valid: false, error: 'Nonce already used (replay detected)' };
        }
        // 5. Verify EIP-712 signature
        const domainSeparator = await usdc.DOMAIN_SEPARATOR();
        const structHash = ethers_1.ethers.keccak256(ethers_1.ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'], [
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            authorization.from,
            authorization.to,
            authorization.value,
            authorization.validAfter,
            authorization.validBefore,
            authorization.nonce,
        ]));
        const digest = ethers_1.ethers.keccak256(ethers_1.ethers.concat([ethers_1.ethers.toUtf8Bytes('\x19\x01'), domainSeparator, structHash]));
        const recovered = ethers_1.ethers.recoverAddress(digest, signature);
        if (recovered.toLowerCase() !== authorization.from.toLowerCase()) {
            return { valid: false, error: 'Invalid signature' };
        }
        // 6. Check balance
        const balance = await usdc.balanceOf(authorization.from);
        if (balance < BigInt(authorization.value)) {
            return { valid: false, error: 'Insufficient USDC balance' };
        }
        return { valid: true };
    }
    catch (err) {
        return { valid: false, error: `Verification error: ${err.message}` };
    }
}
async function settleArcPayment(payload) {
    try {
        const data = payload.payload;
        const { authorization, signature } = data;
        const signer = getSigner();
        const usdc = new ethers_1.ethers.Contract(config_js_1.config.arc.eurcContract, EIP3009_ABI, signer);
        // Split signature
        const sig = ethers_1.ethers.Signature.from(signature);
        const tx = await usdc.transferWithAuthorization(authorization.from, authorization.to, authorization.value, authorization.validAfter, authorization.validBefore, authorization.nonce, sig.v, sig.r, sig.s);
        const receipt = await tx.wait(1);
        return { success: true, txHash: receipt.hash };
    }
    catch (err) {
        return { success: false, error: `Settlement error: ${err.message}` };
    }
}
