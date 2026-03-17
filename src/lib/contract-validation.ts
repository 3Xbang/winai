import { ContractType, OUTCOME_FIELD_CONFIG, MIN_PARTIES, MAX_PARTIES } from '@/lib/contract-config';

export function validatePartiesCount(parties: unknown[]): boolean {
  return parties.length >= MIN_PARTIES && parties.length <= MAX_PARTIES;
}

export function validatePositiveNumber(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

export function validatePartyNames(parties: Array<{ name: string }>): boolean {
  return parties.every((p) => p.name.trim().length > 0);
}

export function validateRequiredOutcomes(
  contractType: ContractType,
  outcomes: Record<string, string>,
): string[] {
  const fields = OUTCOME_FIELD_CONFIG[contractType];
  return fields
    .filter((f) => f.required && (!outcomes[f.key] || outcomes[f.key].trim() === ''))
    .map((f) => f.key);
}
