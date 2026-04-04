"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
function require_env(key) {
    const val = process.env[key];
    if (!val)
        throw new Error(`Missing required env var: ${key}`);
    return val;
}
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    stripe: {
        secretKey: require_env('STRIPE_SECRET_KEY'),
    },
    arc: {
        rpcUrl: require_env('ARC_RPC_URL'),
        walletPrivateKey: require_env('ARC_WALLET_PRIVATE_KEY'),
        walletAddress: require_env('ARC_WALLET_ADDRESS'),
        eurcContract: require_env('ARC_EURC_CONTRACT'),
        paymentReceiver: require_env('ARC_PAYMENT_RECEIVER'),
        chainId: parseInt(process.env.ARC_CHAIN_ID || '5042002', 10),
    },
    hedera: {
        accountId: require_env('HEDERA_ACCOUNT_ID'),
        privateKey: require_env('HEDERA_PRIVATE_KEY'),
        network: (process.env.HEDERA_NETWORK || 'testnet'),
        paymentReceiver: require_env('HEDERA_PAYMENT_RECEIVER'),
    },
    supabase: {
        url: require_env('SUPABASE_URL'),
        serviceRoleKey: require_env('SUPABASE_SERVICE_ROLE_KEY'),
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    admin: {
        secret: require_env('ADMIN_SECRET'),
    },
    worldId: {
        enabled: process.env.WORLD_ID_ENABLED === 'true',
        appId: process.env.WORLD_ID_APP_ID || '',
        action: process.env.WORLD_ID_ACTION || 'card-issuance',
    },
};
