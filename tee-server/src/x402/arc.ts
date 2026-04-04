import { ethers } from 'ethers';
import { config } from '../config.js';
import type {
  PaymentRequirements,
  PaymentPayload,
  VerificationResult,
  SettlementResult,
  EvmPayloadData,
} from './types.js';

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
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
  )
);

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(config.arc.rpcUrl, {
    chainId: config.arc.chainId,
    name: 'arc-testnet',
  });
}

function getSigner(): ethers.Wallet {
  return new ethers.Wallet(config.arc.walletPrivateKey, getProvider());
}

export async function verifyArcPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<VerificationResult> {
  try {
    const data = payload.payload as EvmPayloadData;
    const { authorization, signature } = data;
    const provider = getProvider();
    const usdc = new ethers.Contract(requirements.asset, EIP3009_ABI, provider); // EURC on Arc

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
    const nonceUsed = await usdc.authorizationState(
      authorization.from,
      authorization.nonce
    );
    if (nonceUsed) {
      return { valid: false, error: 'Nonce already used (replay detected)' };
    }

    // 5. Verify EIP-712 signature
    const domainSeparator = await usdc.DOMAIN_SEPARATOR();
    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
        [
          TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
          authorization.from,
          authorization.to,
          authorization.value,
          authorization.validAfter,
          authorization.validBefore,
          authorization.nonce,
        ]
      )
    );
    const digest = ethers.keccak256(
      ethers.concat([ethers.toUtf8Bytes('\x19\x01'), domainSeparator, structHash])
    );
    const recovered = ethers.recoverAddress(digest, signature);
    if (recovered.toLowerCase() !== authorization.from.toLowerCase()) {
      return { valid: false, error: 'Invalid signature' };
    }

    // 6. Check balance
    const balance = await usdc.balanceOf(authorization.from);
    if (balance < BigInt(authorization.value)) {
      return { valid: false, error: 'Insufficient USDC balance' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Verification error: ${(err as Error).message}` };
  }
}

export async function settleArcPayment(
  payload: PaymentPayload
): Promise<SettlementResult> {
  try {
    const data = payload.payload as EvmPayloadData;
    const { authorization, signature } = data;
    const signer = getSigner();
    const usdc = new ethers.Contract(config.arc.eurcContract, EIP3009_ABI, signer);

    // Split signature
    const sig = ethers.Signature.from(signature);

    const tx = await usdc.transferWithAuthorization(
      authorization.from,
      authorization.to,
      authorization.value,
      authorization.validAfter,
      authorization.validBefore,
      authorization.nonce,
      sig.v,
      sig.r,
      sig.s
    );

    const receipt = await tx.wait(1);
    return { success: true, txHash: receipt.hash };
  } catch (err) {
    return { success: false, error: `Settlement error: ${(err as Error).message}` };
  }
}
