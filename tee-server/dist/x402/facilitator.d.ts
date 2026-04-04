import type { PaymentPayload, PaymentRequirements, VerificationResult, SettlementResult } from './types.js';
export declare function verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerificationResult>;
export declare function settle(payload: PaymentPayload): Promise<SettlementResult>;
