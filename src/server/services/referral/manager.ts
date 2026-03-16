/**
 * Referral Manager Service
 *
 * Handles referral code generation, tracking, and reward distribution.
 * - Generates unique referral codes for users
 * - Tracks referral URL parameters
 * - Awards consultation credits to both referrer and referee on registration
 */

import { randomBytes } from 'crypto';

export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  usageCount: number;
  createdAt: Date;
}

export interface Referral {
  id: string;
  referralCodeId: string;
  referredUserId: string;
  rewardGranted: boolean;
  createdAt: Date;
}

export interface ReferralStats {
  code: string;
  totalReferrals: number;
  rewardsGranted: number;
  shareUrl: string;
}

export interface RewardResult {
  referrerUserId: string;
  referredUserId: string;
  creditsAwarded: number;
  success: boolean;
}

const REFERRAL_CODE_LENGTH = 8;
const REWARD_CREDITS = 5; // consultation credits awarded to each party
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://legal-expert.example.com';

/**
 * Generate a unique referral code string.
 * Uses crypto.randomBytes for uniqueness, encoded as uppercase alphanumeric.
 */
export function generateReferralCode(): string {
  const bytes = randomBytes(REFERRAL_CODE_LENGTH);
  const code = bytes
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, '')
    .substring(0, REFERRAL_CODE_LENGTH)
    .toUpperCase();
  return code;
}

/**
 * Build a referral share URL with the referral code as a query parameter.
 */
export function buildReferralUrl(code: string, baseUrl: string = BASE_URL): string {
  return `${baseUrl}/register?ref=${code}`;
}

/**
 * Extract referral code from URL search params.
 */
export function extractReferralCode(url: string): string | null {
  try {
    const urlObj = new URL(url, 'https://placeholder.com');
    return urlObj.searchParams.get('ref') || null;
  } catch {
    return null;
  }
}

/**
 * Validate a referral code format.
 * Must be exactly REFERRAL_CODE_LENGTH uppercase alphanumeric characters.
 */
export function isValidReferralCode(code: string): boolean {
  const pattern = new RegExp(`^[A-Z0-9]{${REFERRAL_CODE_LENGTH}}$`);
  return pattern.test(code);
}

export class ReferralManager {
  private referralCodes: Map<string, ReferralCode> = new Map(); // code -> ReferralCode
  private referralsByUser: Map<string, string> = new Map(); // userId -> code
  private referrals: Map<string, Referral[]> = new Map(); // referralCodeId -> Referral[]
  private userCredits: Map<string, number> = new Map(); // userId -> credits

  /**
   * Get or create a referral code for a user.
   * Each user gets exactly one unique referral code.
   */
  getOrCreateReferralCode(userId: string): ReferralCode {
    const existingCode = this.referralsByUser.get(userId);
    if (existingCode) {
      return this.referralCodes.get(existingCode)!;
    }

    let code: string;
    do {
      code = generateReferralCode();
    } while (this.referralCodes.has(code));

    const referralCode: ReferralCode = {
      id: `rc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId,
      code,
      usageCount: 0,
      createdAt: new Date(),
    };

    this.referralCodes.set(code, referralCode);
    this.referralsByUser.set(userId, code);
    return referralCode;
  }

  /**
   * Look up a referral code record by code string.
   */
  findByCode(code: string): ReferralCode | null {
    return this.referralCodes.get(code) || null;
  }

  /**
   * Record a referral when a new user registers with a referral code.
   * Returns null if the code is invalid or the user was already referred.
   */
  recordReferral(code: string, referredUserId: string): Referral | null {
    const referralCode = this.referralCodes.get(code);
    if (!referralCode) return null;

    // Prevent self-referral
    if (referralCode.userId === referredUserId) return null;

    // Check if user was already referred
    for (const referralList of this.referrals.values()) {
      if (referralList.some((r) => r.referredUserId === referredUserId)) {
        return null;
      }
    }

    const referral: Referral = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      referralCodeId: referralCode.id,
      referredUserId,
      rewardGranted: false,
      createdAt: new Date(),
    };

    const existing = this.referrals.get(referralCode.id) || [];
    existing.push(referral);
    this.referrals.set(referralCode.id, existing);

    referralCode.usageCount += 1;

    return referral;
  }

  /**
   * Grant reward credits to both referrer and referred user.
   * Each party receives REWARD_CREDITS consultation credits.
   * Returns null if the referral doesn't exist or reward was already granted.
   */
  grantReward(referralId: string): RewardResult | null {
    for (const [codeId, referralList] of this.referrals.entries()) {
      const referral = referralList.find((r) => r.id === referralId);
      if (referral) {
        if (referral.rewardGranted) return null;

        // Find the referrer
        let referrerUserId: string | null = null;
        for (const rc of this.referralCodes.values()) {
          if (rc.id === codeId) {
            referrerUserId = rc.userId;
            break;
          }
        }

        if (!referrerUserId) return null;

        // Award credits to both parties
        const referrerCredits = (this.userCredits.get(referrerUserId) || 0) + REWARD_CREDITS;
        const referredCredits = (this.userCredits.get(referral.referredUserId) || 0) + REWARD_CREDITS;

        this.userCredits.set(referrerUserId, referrerCredits);
        this.userCredits.set(referral.referredUserId, referredCredits);

        referral.rewardGranted = true;

        return {
          referrerUserId,
          referredUserId: referral.referredUserId,
          creditsAwarded: REWARD_CREDITS,
          success: true,
        };
      }
    }
    return null;
  }

  /**
   * Process a complete referral flow: record + grant reward.
   */
  processReferral(code: string, referredUserId: string): RewardResult | null {
    const referral = this.recordReferral(code, referredUserId);
    if (!referral) return null;
    return this.grantReward(referral.id);
  }

  /**
   * Get referral statistics for a user.
   */
  getReferralStats(userId: string): ReferralStats | null {
    const code = this.referralsByUser.get(userId);
    if (!code) return null;

    const referralCode = this.referralCodes.get(code)!;
    const referralList = this.referrals.get(referralCode.id) || [];

    return {
      code,
      totalReferrals: referralList.length,
      rewardsGranted: referralList.filter((r) => r.rewardGranted).length,
      shareUrl: buildReferralUrl(code),
    };
  }

  /**
   * Get user's consultation credits balance.
   */
  getUserCredits(userId: string): number {
    return this.userCredits.get(userId) || 0;
  }

  /**
   * Get the reward credits amount per referral.
   */
  getRewardCredits(): number {
    return REWARD_CREDITS;
  }
}
