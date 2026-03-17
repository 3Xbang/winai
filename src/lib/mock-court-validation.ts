import type { CreateSessionInput, EvidenceInput } from '@/types/mock-court';
import type { CaseType } from '@prisma/client';

// ==================== Supplementary Field Definition ====================

export interface SupplementaryFieldDef {
  key: string;
  label: string;
  type: 'string' | 'number';
  required: boolean;
}

// ==================== Case Config Validation ====================

const MIN_DESCRIPTION_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 5000;

export function validateCaseConfig(
  input: CreateSessionInput,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.caseType || (input.caseType as string).trim() === '') {
    errors.caseType = 'Case type is required';
  }

  if (!input.caseDescription || input.caseDescription.trim() === '') {
    errors.caseDescription = 'Case description is required';
  } else if (input.caseDescription.length < MIN_DESCRIPTION_LENGTH) {
    errors.caseDescription = `Case description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
  } else if (input.caseDescription.length > MAX_DESCRIPTION_LENGTH) {
    errors.caseDescription = `Case description must be at most ${MAX_DESCRIPTION_LENGTH} characters`;
  }

  if (!input.jurisdiction || (input.jurisdiction as string).trim() === '') {
    errors.jurisdiction = 'Jurisdiction is required';
  }

  if (!input.userRole || (input.userRole as string).trim() === '') {
    errors.userRole = 'User role is required';
  }

  if (!input.difficulty || (input.difficulty as string).trim() === '') {
    errors.difficulty = 'Difficulty level is required';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ==================== Supplementary Fields ====================

const SUPPLEMENTARY_FIELDS_MAP: Record<string, SupplementaryFieldDef[]> = {
  CONTRACT_DISPUTE: [
    { key: 'contractAmount', label: 'Contract Amount', type: 'number', required: true },
    { key: 'breachParty', label: 'Breach Party', type: 'string', required: true },
  ],
  TORT: [
    { key: 'damageType', label: 'Damage Type', type: 'string', required: true },
    { key: 'injuryDescription', label: 'Injury Description', type: 'string', required: true },
  ],
  LABOR_DISPUTE: [
    { key: 'laborRelationType', label: 'Labor Relation Type', type: 'string', required: true },
    { key: 'disputeFocus', label: 'Dispute Focus', type: 'string', required: true },
  ],
  IP_DISPUTE: [
    { key: 'ipType', label: 'IP Type', type: 'string', required: true },
    { key: 'registrationNumber', label: 'Registration Number', type: 'string', required: true },
  ],
  CROSS_BORDER_TRADE: [
    { key: 'tradeValue', label: 'Trade Value', type: 'number', required: true },
    { key: 'tradeRoute', label: 'Trade Route', type: 'string', required: true },
  ],
  OTHER: [
    { key: 'customDescription', label: 'Custom Description', type: 'string', required: false },
  ],
};

export function getSupplementaryFields(caseType: CaseType): SupplementaryFieldDef[] {
  return SUPPLEMENTARY_FIELDS_MAP[caseType] ?? [];
}

// ==================== Evidence Input Validation ====================

export function validateEvidenceInput(
  input: EvidenceInput,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim() === '') {
    errors.name = 'Evidence name is required';
  }

  if (!input.evidenceType || (input.evidenceType as string).trim() === '') {
    errors.evidenceType = 'Evidence type is required';
  }

  if (!input.description || input.description.trim() === '') {
    errors.description = 'Evidence description is required';
  }

  if (!input.proofPurpose || input.proofPurpose.trim() === '') {
    errors.proofPurpose = 'Proof purpose is required';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
