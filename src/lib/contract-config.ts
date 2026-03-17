export type ContractType = 'EMPLOYMENT' | 'SALE' | 'SERVICE' | 'LEASE' | 'PARTNERSHIP' | 'OTHER';

export interface OutcomeFieldDef {
  key: string;              // unique identifier, e.g. 'salary'
  inputType: 'text' | 'number' | 'textarea';
  required: boolean;
  // i18n keys are derived: `contract.draft.outcomes.{contractType}.{key}`
  // label key:       `contract.draft.outcomes.{contractType}.{key}.label`
  // placeholder key: `contract.draft.outcomes.{contractType}.{key}.placeholder`
}

export type OutcomeFieldConfig = Record<ContractType, OutcomeFieldDef[]>;

export const OUTCOME_FIELD_CONFIG: OutcomeFieldConfig = {
  EMPLOYMENT: [
    { key: 'salary', inputType: 'text', required: true },
    { key: 'probationPeriod', inputType: 'text', required: false },
    { key: 'terminationConditions', inputType: 'textarea', required: false },
    { key: 'nonCompeteScope', inputType: 'textarea', required: false },
  ],
  SALE: [
    { key: 'itemDescription', inputType: 'textarea', required: true },
    { key: 'priceAndPayment', inputType: 'text', required: true },
    { key: 'deliveryConditions', inputType: 'text', required: false },
    { key: 'warrantyTerms', inputType: 'textarea', required: false },
    { key: 'breachPenalty', inputType: 'text', required: false },
  ],
  SERVICE: [
    { key: 'serviceScope', inputType: 'textarea', required: true },
    { key: 'servicePeriod', inputType: 'text', required: true },
    { key: 'paymentSchedule', inputType: 'text', required: false },
    { key: 'qualityStandards', inputType: 'textarea', required: false },
    { key: 'breachPenalty', inputType: 'text', required: false },
  ],
  LEASE: [
    { key: 'propertyDescription', inputType: 'textarea', required: true },
    { key: 'leaseDuration', inputType: 'text', required: true },
    { key: 'monthlyRent', inputType: 'number', required: true },
    { key: 'depositAmount', inputType: 'number', required: false },
    { key: 'earlyTerminationPenalty', inputType: 'text', required: false },
  ],
  PARTNERSHIP: [
    { key: 'capitalContribution', inputType: 'text', required: true },
    { key: 'profitSharingRatio', inputType: 'text', required: true },
    { key: 'decisionMakingAuthority', inputType: 'textarea', required: false },
    { key: 'exitConditions', inputType: 'textarea', required: false },
  ],
  OTHER: [
    { key: 'freeTextOutcome', inputType: 'textarea', required: true },
  ],
};

/** Party role labels by index (0-based). Used for default role assignment. */
export const PARTY_ROLE_LABELS = {
  zh: ['甲方', '乙方', '丙方', '丁方', '戊方', '己方', '庚方', '辛方', '壬方', '癸方'],
  en: ['Party A', 'Party B', 'Party C', 'Party D', 'Party E', 'Party F', 'Party G', 'Party H', 'Party I', 'Party J'],
  th: ['ฝ่าย ก', 'ฝ่าย ข', 'ฝ่าย ค', 'ฝ่าย ง', 'ฝ่าย จ', 'ฝ่าย ฉ', 'ฝ่าย ช', 'ฝ่าย ซ', 'ฝ่าย ฌ', 'ฝ่าย ญ'],
};

export const MIN_PARTIES = 2;
export const MAX_PARTIES = 10;
