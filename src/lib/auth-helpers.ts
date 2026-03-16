import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import redis from '@/lib/redis';

const SALT_ROUNDS = 12;
const VERIFICATION_CODE_TTL = 300; // 5 minutes in seconds

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function storeVerificationCode(
  key: string,
  code: string,
): Promise<void> {
  await redis.set(key, code, 'EX', VERIFICATION_CODE_TTL);
}

export async function verifyCode(
  key: string,
  code: string,
): Promise<boolean> {
  const stored = await redis.get(key);
  if (!stored || stored !== code) {
    return false;
  }
  await redis.del(key);
  return true;
}
