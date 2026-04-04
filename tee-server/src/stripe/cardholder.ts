import Stripe from 'stripe';
import { config } from '../config.js';

const stripe = new Stripe(config.stripe.secretKey);

// Single shared testnet cardholder — in production you'd create per-user
let ephemeralCardholderId: string | null = null;

export async function ensureCardholder(): Promise<string> {
  if (ephemeralCardholderId) return ephemeralCardholderId;

  // Check if we already have one from a previous run
  const list = await stripe.issuing.cardholders.list({ limit: 1, status: 'active' });
  if (list.data.length > 0) {
    ephemeralCardholderId = list.data[0].id;
    return ephemeralCardholderId;
  }

  const cardholder = await stripe.issuing.cardholders.create({
    name: 'TEE Card Issuer',
    email: 'tee-issuer@example.com',
    type: 'individual',
    billing: {
      address: {
        line1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94111',
        country: 'US',
      },
    },
    status: 'active',
  });

  ephemeralCardholderId = cardholder.id;
  console.log('[stripe] Created cardholder:', cardholder.id);
  return cardholder.id;
}
