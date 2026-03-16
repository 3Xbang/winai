/**
 * Shared types for payment channel adapters.
 * Requirements: 16.1, 16.2, 16.3, 16.8
 */

import crypto from 'crypto';

// ==================== Payment Channel Interface ====================

export type PaymentMethod = 'WECHAT' | 'ALIPAY' | 'STRIPE' | 'PROMPTPAY';

export interface PaymentOrderInfo {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: 'CNY' | 'THB' | 'USD';
  productType: string;
  productId: string;
  userId: string;
  description?: string;
}

export interface PaymentInitResult {
  success: boolean;
  channel: PaymentMethod;
  /** Channel-specific payment URL or data (e.g. QR code URL, redirect URL) */
  paymentUrl?: string;
  /** Channel-specific payload for the client SDK */
  paymentData?: Record<string, string>;
  /** Transaction reference from the channel */
  channelTransactionId?: string;
  expiresAt?: Date;
  message: string;
}

export interface CallbackVerification {
  verified: boolean;
  channel: PaymentMethod;
  orderId: string;
  channelTransactionId: string;
  amount: number;
  currency: string;
  paidAt: Date;
  rawPayload?: Record<string, unknown>;
  message: string;
}

export interface RefundResult {
  success: boolean;
  channel: PaymentMethod;
  refundId: string;
  amount: number;
  message: string;
}

/**
 * Common interface that all payment channel adapters must implement.
 */
export interface PaymentChannel {
  readonly channelName: PaymentMethod;

  /** Initiate a payment with the channel */
  initiatePayment(order: PaymentOrderInfo): Promise<PaymentInitResult>;

  /** Verify a callback/webhook payload and signature from the channel */
  verifyCallback(payload: Record<string, unknown>, signature: string): Promise<CallbackVerification>;

  /** Process a refund through the channel */
  processRefund(transactionId: string, amount: number): Promise<RefundResult>;
}

// ==================== Encryption Utilities (Req 16.8) ====================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive payment data using AES-256-GCM.
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encryptPaymentData(plaintext: string, encryptionKey: string): string {
  const key = crypto.scryptSync(encryptionKey, 'payment-salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt sensitive payment data encrypted with encryptPaymentData.
 */
export function decryptPaymentData(encryptedData: string, encryptionKey: string): string {
  const [ivB64, authTagB64, ciphertext] = encryptedData.split(':');
  if (!ivB64 || !authTagB64 || !ciphertext) {
    throw new Error('Invalid encrypted data format');
  }

  const key = crypto.scryptSync(encryptionKey, 'payment-salt', 32);
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate an HMAC-SHA256 signature for callback verification.
 */
export function generateHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify an HMAC-SHA256 signature using timing-safe comparison.
 */
export function verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateHmacSignature(payload, secret);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
