/**
 * Personalized Alert Engine — Law update alerts matched to user business profile
 * Requirements: 29.3
 */

// ─── Types ──────────────────────────────────────────────────

export interface UserBusinessProfile {
  userId: string;
  industry: string;
  operatingRegions: string[];
}

export interface LawUpdate {
  id: string;
  title: string;
  affectedIndustries: string[];
  affectedRegions: string[];
  summary: string;
  effectiveDate: string;
}

export interface PersonalizedAlert {
  userId: string;
  lawUpdateId: string;
  title: string;
  summary: string;
  matchReason: string;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Check law updates against a user's business profile.
 * Generates alerts when industry or operating regions match.
 */
export function checkLawUpdates(
  profile: UserBusinessProfile,
  updates: LawUpdate[],
): PersonalizedAlert[] {
  const alerts: PersonalizedAlert[] = [];

  for (const update of updates) {
    const industryMatch = update.affectedIndustries.some(
      (ind) => ind.toLowerCase() === profile.industry.toLowerCase(),
    );
    const regionMatch = update.affectedRegions.some((region) =>
      profile.operatingRegions.some(
        (or) => or.toLowerCase() === region.toLowerCase(),
      ),
    );

    if (industryMatch || regionMatch) {
      const reasons: string[] = [];
      if (industryMatch) reasons.push(`行业匹配: ${profile.industry}`);
      if (regionMatch) reasons.push(`地区匹配: ${profile.operatingRegions.join(', ')}`);

      alerts.push({
        userId: profile.userId,
        lawUpdateId: update.id,
        title: update.title,
        summary: update.summary,
        matchReason: reasons.join('; '),
      });
    }
  }

  return alerts;
}
