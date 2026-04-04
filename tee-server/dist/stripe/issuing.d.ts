export interface CardCredentials {
    cardId: string;
    number: string;
    cvc: string;
    expMonth: number;
    expYear: number;
    last4: string;
    amountCents: number;
}
/**
 * Create a single-use virtual card for exactly `amountCents` USD.
 * The card is capped at the exact amount and auto-cancels after 1 authorization.
 */
export declare function createOneTimeCard(amountCents: number): Promise<CardCredentials>;
/**
 * Cancel a card immediately (call after agent confirms use or on timeout).
 */
export declare function cancelCard(cardId: string): Promise<void>;
