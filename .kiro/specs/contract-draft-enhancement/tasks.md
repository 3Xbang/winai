# Implementation Plan: Contract Draft Enhancement

## Overview

Incrementally enhance the WINAI contract drafting form with user party identification, multi-party support, contract-type-specific outcome fields, enhanced AI prompts, and full i18n coverage. Each task builds on the previous, starting with shared config, then backend, then frontend, with tests woven in alongside implementation.

## Tasks

- [x] 1. Create shared contract config module
  - [x] 1.1 Create `src/lib/contract-config.ts` with `ContractType`, `OutcomeFieldDef`, `OutcomeFieldConfig` types, `OUTCOME_FIELD_CONFIG` constant, `PARTY_ROLE_LABELS` constant, and `MIN_PARTIES`/`MAX_PARTIES` constants
    - Define all six contract types with their outcome fields matching the design specification
    - Mark required fields per type as specified in Requirements 5.3
    - Include party role labels for zh, en, th locales (10 entries each)
    - _Requirements: 2.1, 2.5, 3.2, 5.3_

  - [ ]* 1.2 Write property tests for config completeness (`tests/properties/contract-draft-config.test.ts`)
    - **Property 1: Outcome field config completeness** — For any contract type, `OUTCOME_FIELD_CONFIG[type]` is a non-empty array and required fields match the spec
    - **Validates: Requirements 3.2, 5.3**
    - **Property 4: Default role label assignment** — For any index 0–9 and any locale, `PARTY_ROLE_LABELS[locale][i]` returns the correct label
    - **Validates: Requirements 2.5**
    - **Property 5: Outcome fields match selected contract type** — For any contract type, the field keys match `OUTCOME_FIELD_CONFIG[type]`
    - **Validates: Requirements 3.1, 3.3**
    - **Property 11: CONTRACT_TYPE_PROMPT_MAP completeness** — For any contract type, the map entry is a non-empty string (tested after task 3.1 creates the map; stub or import accordingly)
    - **Validates: Requirements 7.2**

- [x] 2. Implement validation utilities
  - [x] 2.1 Add validation functions to `src/lib/contract-config.ts` (or a new `src/lib/contract-validation.ts`)
    - `validatePartiesCount(parties: unknown[]): boolean` — returns true if length is in [2, 10]
    - `validatePositiveNumber(value: string): boolean` — returns true if value is a valid positive number
    - `validatePartyNames(parties: Array<{ name: string }>): boolean` — returns true if all names are non-empty/non-whitespace
    - `validateRequiredOutcomes(contractType: ContractType, outcomes: Record<string, string>): string[]` — returns list of missing required field keys
    - _Requirements: 2.1, 5.2, 5.4, 5.5, 6.3, 6.4_

  - [ ]* 2.2 Write property tests for validation (`tests/properties/contract-draft-validation.test.ts`)
    - **Property 2: Party count invariant** — Generate arrays of length 0–15, verify validation accepts [2,10] only
    - **Validates: Requirements 2.1, 2.6, 6.3, 6.4**
    - **Property 9: Numeric outcome field validation** — Generate random strings, verify positive number validation
    - **Validates: Requirements 5.4**
    - **Property 10: Party name non-empty validation** — Generate party arrays with random empty/whitespace names, verify validation fails
    - **Validates: Requirements 5.5**
    - **Property 14: Required outcome field validation** — For any type, leaving a required field empty should fail validation
    - **Validates: Requirements 5.2**

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Enhance contract service with new prompts and template placeholders
  - [x] 4.1 Update `src/server/services/legal/contract.ts` with new prompt constants and formatting methods
    - Add `CONTRACT_TYPE_PROMPT_MAP` with specialized legal guidance per contract type
    - Update `CONTRACT_DRAFT_SYSTEM_PROMPT` with senior cross-border lawyer role, dual-jurisdiction expertise, and legal disclaimer instruction
    - Update `CONTRACT_DRAFT_USER_PROMPT_TEMPLATE` with `{{desiredOutcomes}}`, `{{userPartyRole}}`, `{{contractTypeGuidance}}` placeholders
    - Add `formatDesiredOutcomes()`, `formatUserPartyRole()`, `getContractTypeGuidance()` methods
    - Update consultation and review system prompts with disclaimer instruction
    - Extend `ContractDraftRequest` interface with optional `userPartyIndex` and `desiredOutcomes` fields
    - Update `draft()` method to populate new placeholders and append type-specific guidance
    - _Requirements: 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [ ]* 4.2 Write property tests for prompt construction (`tests/properties/contract-draft-prompt.test.ts`)
    - **Property 7: Prompt includes all desired outcomes** — Generate random outcome maps, verify all values appear in prompt
    - **Validates: Requirements 3.7, 6.5, 7.7**
    - **Property 8: Prompt includes user party protection instruction** — Generate random party lists and valid index, verify prompt text
    - **Validates: Requirements 7.6**
    - **Property 12: All system prompts include disclaimer instruction** — Verify all system prompt constants contain disclaimer text
    - **Validates: Requirements 7.10**

- [x] 5. Update API route for new request fields
  - [x] 5.1 Modify `src/app/api/contract/draft/route.ts` to accept and validate new fields
    - Accept `parties` as variable-length array (2–10), `userPartyIndex` (optional, 0-based integer), `desiredOutcomes` (optional object)
    - Validate `parties` array length, return 400 if out of range
    - Maintain backward compatibility: convert old `partyAName`/`partyBName` format to `parties` array
    - Pass new fields to `ContractAnalyzer.draft()` via extended `ContractDraftRequest`
    - Default `userPartyIndex` to 0 if out of range or undefined
    - _Requirements: 2.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 5.2 Write property test for backward compatibility (`tests/properties/contract-draft-api.test.ts`)
    - **Property 13: Backward compatibility** — Generate old-format requests (partyAName/partyBName, no desiredOutcomes/userPartyIndex), verify API processes them
    - **Validates: Requirements 6.6**

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add i18n translations for all new fields
  - [x] 7.1 Update `messages/zh.json`, `messages/en.json`, and `messages/th.json` with new translation keys
    - Add `contract.draft.iAm`, `contract.draft.iAmPlaceholder`, `contract.draft.addParty`, `contract.draft.removeParty`, `contract.draft.maxPartiesReached`, `contract.draft.partyLabel`, `contract.draft.desiredOutcomes`
    - Add `contract.draft.outcomes.{TYPE}.{field}.label` and `.placeholder` for all contract types and fields
    - Add `contract.draft.validation.userPartyRequired`, `.outcomeRequired`, `.positiveNumber`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 7.2 Write property test for i18n completeness (`tests/properties/contract-draft-i18n.test.ts`)
    - **Property 6: i18n key completeness for outcome fields** — For any type × field × locale, verify both label and placeholder keys exist and are non-empty
    - **Validates: Requirements 3.5, 4.1, 4.2**

- [x] 8. Implement draft form UI enhancements
  - [x] 8.1 Refactor `src/app/[locale]/contract/draft/page.tsx` for multi-party support
    - Replace hardcoded Party A/B fields with `Form.List` for dynamic parties array
    - Add "Add Party" button (disabled at MAX_PARTIES with message) and "Remove" button on panels with index ≥ 2
    - Auto-assign default role labels from `PARTY_ROLE_LABELS` based on party index and current locale
    - Re-index parties sequentially after removal
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 8.2 Add user party selector to the draft form
    - Add "I am" `<Select>` after contract type selection, options derived from current parties list
    - Default selection to index 0 (Party 1)
    - Visually highlight the selected party's panel with a distinct border/badge via conditional CSS class
    - Update highlight when selection changes within the same render cycle
    - Include `userPartyIndex` in form submission payload
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 8.3 Add dynamic outcome fields to the draft form
    - Read `OUTCOME_FIELD_CONFIG[contractType]` and render corresponding fields when contract type changes
    - Clear outcome field values when contract type changes via `form.resetFields`
    - Display labels and placeholders using i18n keys (`contract.draft.outcomes.{type}.{key}.label/placeholder`)
    - Include `desiredOutcomes` object in form submission payload
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_

  - [x] 8.4 Add form validation for new fields
    - Validate user party selection before submission
    - Validate required outcome fields per contract type are non-empty
    - Validate numeric outcome fields are valid positive numbers
    - Validate all party names are non-empty
    - Display i18n validation error messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 8.5 Write property test for party re-indexing (`tests/properties/contract-draft-party.test.ts`)
    - **Property 3: Party re-indexing after removal** — Generate party lists of length 3–10, remove at random valid index, verify sequential indexing
    - **Validates: Requirements 2.4**

- [ ] 9. Write unit tests for edge cases and specific examples
  - [ ]* 9.1 Create `tests/unit/contract-draft-enhancement.test.ts` with unit tests
    - Test "Add Party" button disabled at 10 parties (edge case from 2.7)
    - Test default `userPartyIndex` is 0 (example from 1.5)
    - Test `CONTRACT_DRAFT_USER_PROMPT_TEMPLATE` contains `{{desiredOutcomes}}`, `{{userPartyRole}}`, `{{contractTypeGuidance}}` placeholders (from 7.3, 7.4, 7.5)
    - Test `CONTRACT_DRAFT_SYSTEM_PROMPT` contains senior lawyer role definition (from 7.1)
    - Test consultation and review system prompts contain expected role definitions (from 7.8, 7.9)
    - Test backward-compatible request mapping from old partyAName/partyBName format
    - _Requirements: 1.5, 2.7, 7.1, 7.3, 7.4, 7.5, 7.8, 7.9_

- [x] 10. Final checkpoint (Requirements 1-7)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Enhance Chat Service system prompt
  - [x] 11.1 Update `src/app/api/chat/route.ts` SYSTEM_PROMPT
    - Change role to "资深中泰跨境法律顾问"
    - Add explicit Chinese legal sources: 《民法典》、《合同法》、《劳动法》、《劳动合同法》、《公司法》、《外商投资法》
    - Add explicit Thai legal sources: Civil and Commercial Code, Labor Protection Act, Foreign Business Act, Immigration Act, BOI Investment Promotion Act
    - Add structured response format requirements (section headers, legal citation format)
    - Add disclaimer instruction: instruct AI to append "本回复仅供参考，不构成正式法律意见。具体法律事务请咨询持牌律师。" to every response
    - _Requirements: 8.1, 8.19, 8.20_

- [x] 12. Enhance IRAC Service system prompts
  - [x] 12.1 Update `src/server/services/legal/irac.ts` IRAC_SYSTEM_PROMPT
    - Change role to "中泰跨境法律IRAC分析专家"
    - Add cross-border conflict-of-law analysis instructions (法律冲突分析)
    - Add explicit legal source references for both jurisdictions
    - Add disclaimer instruction
    - _Requirements: 8.2, 8.19_

  - [x] 12.2 Update `src/server/services/legal/irac.ts` COMBINED_CONCLUSION_SYSTEM_PROMPT
    - Change role to "中泰跨境法律综合结论专家"
    - Add explicit instructions to reconcile findings across Chinese and Thai jurisdictions
    - Add unified actionable recommendation format
    - Add disclaimer instruction
    - _Requirements: 8.3, 8.19_

- [x] 13. Enhance Case Analysis Service system prompts
  - [x] 13.1 Update `src/server/services/legal/case-analyzer.ts` CASE_ANALYSIS_SYSTEM_PROMPT
    - Change role to "中泰跨境案件分析专家"
    - Add cross-border procedural requirements section (跨境送达、域外证据、判决承认与执行)
    - Add jurisdiction-specific risk assessment instructions
    - Add disclaimer instruction
    - _Requirements: 8.4, 8.19_

  - [x] 13.2 Update `src/server/services/legal/case-analyzer.ts` LITIGATION_STRATEGY_SYSTEM_PROMPT
    - Change role to "中泰跨境诉讼策略专家"
    - Add litigation vs. arbitration vs. mediation strategy instructions for cross-border disputes
    - Add applicable treaty references (Hague Convention, bilateral agreements)
    - Add cost-benefit analysis per jurisdiction
    - Add disclaimer instruction
    - _Requirements: 8.5, 8.19_

- [x] 14. Enhance Evidence Service system prompts
  - [x] 14.1 Update `src/server/services/legal/evidence.ts` EVIDENCE_CHECKLIST_SYSTEM_PROMPT
    - Change role to "中泰跨境证据管理专家"
    - Add cross-border evidence authentication requirements (公证认证/legalization procedures)
    - Add evidence admissibility standards per jurisdiction
    - Add Chinese procedural rules (《民事诉讼法》) and Thai procedural rules (Civil Procedure Code) references
    - Add disclaimer instruction
    - _Requirements: 8.6, 8.19_

  - [x] 14.2 Update `src/server/services/legal/evidence.ts` EVIDENCE_ASSESSMENT_SYSTEM_PROMPT
    - Add explicit references to Chinese evidence rules (《民事诉讼法》) and Thai evidence rules (Civil Procedure Code)
    - Add cross-border evidence challenge identification
    - Add disclaimer instruction
    - _Requirements: 8.7, 8.19_

  - [x] 14.3 Update `src/server/services/legal/evidence.ts` EVIDENCE_GAPS_SYSTEM_PROMPT
    - Add instructions for identifying missing evidence items required by each jurisdiction separately
    - Add specific steps for obtaining cross-border evidence (国际司法协助、领事认证)
    - Add disclaimer instruction
    - _Requirements: 8.8, 8.19_

- [x] 15. Enhance Visa Service system prompts
  - [x] 15.1 Update `src/server/services/legal/visa.ts` VISA_RECOMMEND_SYSTEM_PROMPT
    - Change role to "中泰签证与移民法律顾问"
    - Add references to Thai Immigration Act, Work Permit regulations, BOI promotion categories
    - Add Chinese outbound travel regulations (中国公民出境管理条例)
    - Add disclaimer instruction
    - _Requirements: 8.9, 8.19_

  - [x] 15.2 Update `src/server/services/legal/visa.ts` VISA_RENEWAL_SYSTEM_PROMPT
    - Add renewal timeline requirements per visa category
    - Add document preparation checklists
    - Add common rejection reasons with mitigation strategies
    - Add disclaimer instruction
    - _Requirements: 8.10, 8.19_

  - [x] 15.3 Update `src/server/services/legal/visa.ts` VISA_CONVERSION_SYSTEM_PROMPT
    - Add conversion eligibility rules between visa categories
    - Add required documentation differences per conversion path
    - Add processing timeline expectations
    - Add disclaimer instruction
    - _Requirements: 8.11, 8.19_

- [x] 16. Enhance Case Search Service system prompts
  - [x] 16.1 Update `src/server/services/legal/case-search.ts` CASE_SEARCH_SYSTEM_PROMPT
    - Change role to "中泰跨境判例检索专家"
    - Add instructions for citing Chinese court decisions (裁判文书) with proper format (案号、法院、日期)
    - Add instructions for citing Thai court decisions with proper format
    - Add disclaimer instruction
    - _Requirements: 8.12, 8.19_

  - [x] 16.2 Update `src/server/services/legal/case-search.ts` TREND_ANALYSIS_SYSTEM_PROMPT
    - Add instructions for analyzing judicial trends across Chinese and Thai courts separately
    - Add identification of shifts in legal interpretation
    - Add statistical context guidance
    - Add disclaimer instruction
    - _Requirements: 8.13, 8.19_

  - [x] 16.3 Update `src/server/services/legal/case-search.ts` CASE_COMPARISON_SYSTEM_PROMPT
    - Add instructions for comparing cases across jurisdictions
    - Add highlighting of procedural and substantive law differences
    - Add precedent applicability analysis
    - Add disclaimer instruction
    - _Requirements: 8.14, 8.19_

- [x] 17. Enhance Jurisdiction, Compliance, Report, and Timeline Service system prompts
  - [x] 17.1 Update `src/server/services/legal/jurisdiction.ts` JURISDICTION_SYSTEM_PROMPT
    - Add "中泰跨境" qualifier to role
    - Add cross-border jurisdiction conflict resolution guidance (管辖权冲突解决)
    - Add forum selection recommendations (法院选择建议)
    - Add disclaimer instruction
    - Preserve existing keyword mapping and confidence scoring logic
    - _Requirements: 8.15, 8.19_

  - [x] 17.2 Update `src/server/services/legal/compliance.ts` FULL_COMPLIANCE_SYSTEM_PROMPT
    - Change role to "中泰跨境合规分析专家"
    - Add Chinese regulatory frameworks: 市场监管总局规定、外汇管理条例、税务合规要求
    - Add Thai regulatory frameworks: Foreign Business Act, Revenue Code, BOI regulations
    - Add cross-border compliance interaction analysis
    - Add disclaimer instruction
    - _Requirements: 8.16, 8.19_

  - [x] 17.3 Update `src/server/services/report/generator.ts` REPORT_SYSTEM_PROMPT
    - Change role to "中泰跨境法律报告撰写专家"
    - Add professional report structure standards
    - Add jurisdiction-specific legal citation format requirements
    - Add executive summary requirements
    - Add bilingual terminology usage guidance (中英泰法律术语对照)
    - Add disclaimer instruction
    - _Requirements: 8.17, 8.19_

  - [x] 17.4 Update `src/server/services/ai/paralegal/timeline-generator.ts` TIMELINE_SYSTEM_PROMPT (major rewrite)
    - Change role to "中泰跨境案件时间线分析专家"
    - Add instructions for identifying legally significant dates under both jurisdictions
    - Add statute of limitations calculations per applicable law (中国诉讼时效/泰国 Prescription)
    - Add procedural deadline mapping (立案期限、上诉期限、执行期限)
    - Add cross-border timeline considerations (跨境送达时间、域外取证时间)
    - Add explicit Chinese and Thai legal source references
    - Add disclaimer instruction
    - _Requirements: 8.18, 8.19_

- [x] 18. Checkpoint (Requirement 8 prompt enhancements)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Write tests for Requirement 8
  - [ ]* 19.1 Write property tests for Prompt_Standard conformance (`tests/properties/prompt-standard.test.ts`)
    - **Property 15: All system prompts conform to Prompt_Standard** — For each of the 20 system prompt constants, verify: (a) role definition contains "中泰跨境", (b) at least one Chinese law reference, (c) at least one Thai law reference, (d) output quality rules, (e) disclaimer instruction containing "仅供参考" and "不构成正式法律意见"
    - **Validates: Requirements 8.19**

  - [ ]* 19.2 Write property test for system prompt ordering (`tests/properties/prompt-standard.test.ts`)
    - **Property 16: System prompt is first message in conversation context** — For each AI service that calls the LLM gateway, verify the messages array starts with a system-role message matching the service's designated prompt constant
    - **Validates: Requirements 8.20**

  - [ ]* 19.3 Expand Property 12 coverage in `tests/properties/contract-draft-prompt.test.ts`
    - **Property 12 (expanded): All 20 system prompts include disclaimer instruction** — Add the 18 newly enhanced prompt constants to the existing Property 12 test to verify disclaimer text across all services
    - **Validates: Requirements 8.19**

  - [ ]* 19.4 Write unit tests for per-service prompt content (`tests/unit/ai-prompt-enhancement.test.ts`)
    - Verify Chat_Service SYSTEM_PROMPT contains "资深中泰跨境法律顾问" role and explicit legal source references
    - Verify IRAC_SYSTEM_PROMPT contains "中泰跨境法律IRAC分析专家" role and conflict-of-law instructions
    - Verify COMBINED_CONCLUSION_SYSTEM_PROMPT contains cross-border reconciliation instructions
    - Verify CASE_ANALYSIS_SYSTEM_PROMPT contains "中泰跨境案件分析专家" role and cross-border procedural requirements
    - Verify LITIGATION_STRATEGY_SYSTEM_PROMPT contains "中泰跨境诉讼策略专家" role and treaty references
    - Verify EVIDENCE_CHECKLIST_SYSTEM_PROMPT contains "中泰跨境证据管理专家" role and 公证认证 requirements
    - Verify EVIDENCE_ASSESSMENT_SYSTEM_PROMPT references 《民事诉讼法》 and Civil Procedure Code
    - Verify EVIDENCE_GAPS_SYSTEM_PROMPT contains per-jurisdiction missing evidence instructions
    - Verify VISA_RECOMMEND_SYSTEM_PROMPT contains "中泰签证与移民法律顾问" role and BOI references
    - Verify VISA_RENEWAL_SYSTEM_PROMPT contains renewal timeline and rejection reasons
    - Verify VISA_CONVERSION_SYSTEM_PROMPT contains conversion eligibility rules
    - Verify CASE_SEARCH_SYSTEM_PROMPT contains "中泰跨境判例检索专家" role and citation format instructions
    - Verify TREND_ANALYSIS_SYSTEM_PROMPT contains cross-jurisdiction trend analysis instructions
    - Verify CASE_COMPARISON_SYSTEM_PROMPT contains cross-jurisdiction comparison instructions
    - Verify JURISDICTION_SYSTEM_PROMPT contains cross-border conflict resolution guidance
    - Verify FULL_COMPLIANCE_SYSTEM_PROMPT contains "中泰跨境合规分析专家" role and regulatory framework references
    - Verify REPORT_SYSTEM_PROMPT contains "中泰跨境法律报告撰写专家" role and bilingual terminology guidance
    - Verify TIMELINE_SYSTEM_PROMPT contains "中泰跨境案件时间线分析专家" role and statute of limitations instructions
    - _Requirements: 8.1–8.18_

- [x] 20. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (16 properties total)
- Unit tests validate specific examples and edge cases
- All code uses TypeScript; tests use vitest + fast-check
- Tasks 1-10 cover Requirements 1-7 (form enhancements, config, API, i18n, contract service prompts)
- Tasks 11-20 cover Requirement 8 (AI Precision Prompts for all 11 service endpoints)
