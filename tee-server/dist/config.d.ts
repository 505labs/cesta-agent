import 'dotenv/config';
export declare const config: {
    readonly port: number;
    readonly stripe: {
        readonly secretKey: string;
    };
    readonly arc: {
        readonly rpcUrl: string;
        readonly walletPrivateKey: string;
        readonly walletAddress: string;
        readonly eurcContract: string;
        readonly paymentReceiver: string;
        readonly chainId: number;
    };
    readonly hedera: {
        readonly accountId: string;
        readonly privateKey: string;
        readonly network: "testnet" | "mainnet";
        readonly paymentReceiver: string;
    };
    readonly supabase: {
        readonly url: string;
        readonly serviceRoleKey: string;
    };
    readonly redis: {
        readonly url: string;
    };
    readonly admin: {
        readonly secret: string;
    };
    readonly worldId: {
        readonly enabled: boolean;
        readonly appId: string;
        readonly action: string;
    };
};
