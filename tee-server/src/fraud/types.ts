/**
 * FraudCheck interface — allows swapping in World ID or any other fraud
 * prevention mechanism without changing the card issuance logic.
 */
export interface FraudCheck {
  /**
   * Throws an error if the request should be blocked (banned user, invalid proof, etc.)
   * Does nothing if the request is clean.
   */
  check(nullifierHash?: string, worldIdProof?: unknown): Promise<void>;

  /**
   * Ban a user by their World ID nullifier hash.
   * No-op when fraud checks are disabled.
   */
  ban(nullifierHash: string, reason: string): Promise<void>;
}
