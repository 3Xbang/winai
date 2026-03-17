# Requirements Document

## Introduction

Enhance the WINAI contract drafting form (`src/app/[locale]/contract/draft/page.tsx`) with a smarter, guided experience for non-lawyer users. The enhancement introduces three key capabilities: (1) party role self-identification so users can specify which party they represent, (2) support for multi-party contracts beyond the current two-party model, and (3) contract-type-specific "outcome input" fields that guide users to describe desired results (e.g., penalty amounts, deliverables, compensation terms) instead of legal jargon. The target audience is regular people navigating China-Thailand cross-border contracts who need intuitive guidance.

## Glossary

- **Draft_Form**: The contract drafting form UI component at `src/app/[locale]/contract/draft/page.tsx`
- **Contract_Type**: One of the six supported contract categories: EMPLOYMENT, SALE, SERVICE, LEASE, PARTNERSHIP, OTHER
- **Party**: A person or entity involved in the contract, identified by name, role, nationality, and address
- **User_Party**: The party that the current user represents in the contract
- **Outcome_Field**: A guided input field specific to a Contract_Type that captures the user's desired result or key term in plain language
- **Outcome_Config**: A data structure mapping each Contract_Type to its set of Outcome_Fields with labels, placeholders, and input types
- **Draft_API**: The backend endpoint at `/api/contract/draft` that accepts form data and returns AI-generated contract text
- **Party_Panel**: A repeatable UI section containing all input fields for a single Party (name, role, nationality, address)
- **i18n_System**: The next-intl internationalization system supporting zh, en, and th locales via `messages/*.json`
- **System_Prompt**: The system-level instruction sent to the GLM AI model that defines its role, expertise, and output rules
- **User_Prompt**: The user-level message sent to the GLM AI model containing the specific contract details and desired outcomes
- **CONTRACT_TYPE_PROMPT_MAP**: A mapping from each Contract_Type to specialized legal guidance text that supplements the system prompt with type-specific legal focus areas
- **Chat_Service**: The AI chat/consultation endpoint at `/api/chat` (`src/app/api/chat/route.ts`) providing general legal Q&A
- **IRAC_Service**: The IRAC legal analysis service (`src/server/services/legal/irac.ts`) providing structured legal issue analysis
- **Case_Analysis_Service**: The case analysis service (`src/server/services/legal/case-analyzer.ts`) providing case evaluation and litigation strategy
- **Evidence_Service**: The evidence management service (`src/server/services/legal/evidence.ts`) providing evidence checklist, assessment, and gap analysis
- **Visa_Service**: The visa consultation service (`src/server/services/legal/visa.ts`) providing visa recommendation, renewal, and conversion guidance
- **Case_Search_Service**: The case search service (`src/server/services/legal/case-search.ts`) providing case search, trend analysis, and case comparison
- **Jurisdiction_Service**: The jurisdiction identification service (`src/server/services/legal/jurisdiction.ts`) providing jurisdiction determination
- **Compliance_Service**: The compliance analysis service (`src/server/services/legal/compliance.ts`) providing regulatory compliance evaluation
- **Report_Service**: The report generation service (`src/server/services/report/generator.ts`) providing legal report generation
- **Timeline_Service**: The timeline generation service (`src/server/services/ai/paralegal/timeline-generator.ts`) providing case timeline construction
- **Prompt_Standard**: The mandatory set of elements every AI system prompt must contain: role definition, expertise scope (China-Thailand cross-border law), output quality rules, and legal disclaimer instruction

## Requirements

### Requirement 1: User Party Identification

**User Story:** As a non-lawyer user, I want to specify which party I represent in the contract, so that the AI can tailor the contract language to protect my interests.

#### Acceptance Criteria

1. WHEN a user selects a Contract_Type, THE Draft_Form SHALL display a "I am" selector allowing the user to choose which Party the user represents
2. THE Draft_Form SHALL visually highlight the Party_Panel corresponding to the selected User_Party with a distinct border or badge
3. WHEN the user changes the User_Party selection, THE Draft_Form SHALL update the visual highlight to reflect the new selection within the same render cycle
4. THE Draft_Form SHALL include the User_Party identifier in the request payload sent to the Draft_API
5. THE Draft_Form SHALL default the User_Party selection to the first party (Party 1)

### Requirement 2: Multi-Party Contract Support

**User Story:** As a user drafting a partnership or complex agreement, I want to add more than two parties to the contract, so that the contract accurately represents all involved entities.

#### Acceptance Criteria

1. THE Draft_Form SHALL support a minimum of 2 parties and a maximum of 10 parties per contract
2. WHEN the user clicks an "Add Party" button, THE Draft_Form SHALL append a new Party_Panel with empty fields to the party list
3. WHILE the party count is greater than 2, THE Draft_Form SHALL display a "Remove" button on each Party_Panel except the first two
4. WHEN the user removes a Party_Panel, THE Draft_Form SHALL re-index the remaining parties sequentially (Party 1, Party 2, Party 3, etc.)
5. THE Draft_Form SHALL auto-assign default role labels to each party based on the party index (甲方/Party A, 乙方/Party B, 丙方/Party C, etc.)
6. WHEN the user submits the form, THE Draft_API SHALL accept a `parties` array of variable length (2 to 10 entries)
7. IF the user attempts to add a party beyond the maximum of 10, THEN THE Draft_Form SHALL disable the "Add Party" button and display a message indicating the maximum has been reached

### Requirement 3: Contract-Type-Specific Outcome Fields

**User Story:** As a non-lawyer user, I want to see guided input fields specific to my contract type that ask me about the outcomes I want to achieve, so that I can describe my needs in plain language without knowing legal terminology.

#### Acceptance Criteria

1. WHEN the user selects a Contract_Type, THE Draft_Form SHALL dynamically render Outcome_Fields specific to that Contract_Type
2. THE Outcome_Config SHALL define Outcome_Fields for each of the six Contract_Types as follows:
   - EMPLOYMENT: desired salary/compensation, probation period, termination conditions, non-compete scope
   - SALE: item description, price and payment terms, delivery conditions, warranty/return terms, breach penalty amount
   - SERVICE: service scope, service period, payment schedule, quality standards, breach penalty amount
   - LEASE: property description, lease duration, monthly rent, deposit amount, early termination penalty
   - PARTNERSHIP: capital contribution per party, profit sharing ratio, decision-making authority, exit conditions
   - OTHER: a single free-text field for the user to describe desired outcomes
3. WHEN the user changes the Contract_Type selection, THE Draft_Form SHALL replace the current Outcome_Fields with the fields for the newly selected Contract_Type
4. WHEN the user changes the Contract_Type selection, THE Draft_Form SHALL clear previously entered Outcome_Field values
5. THE Draft_Form SHALL display each Outcome_Field with a user-friendly label and a placeholder example in the user's current locale
6. WHEN the user submits the form, THE Draft_Form SHALL include all Outcome_Field values in the request payload under a `desiredOutcomes` object keyed by field identifier
7. THE Draft_API SHALL pass the `desiredOutcomes` data to the AI prompt so the generated contract reflects the user's stated outcomes

### Requirement 4: Internationalization of New Fields

**User Story:** As a user who speaks Chinese, English, or Thai, I want all new form fields to be displayed in my selected language, so that I can use the form comfortably in my preferred language.

#### Acceptance Criteria

1. THE i18n_System SHALL contain translation keys for all new UI labels, placeholders, and messages in zh, en, and th locales
2. THE Draft_Form SHALL render all Outcome_Field labels and placeholders using translations from the i18n_System based on the active locale
3. THE Draft_Form SHALL render the "I am" selector label, "Add Party" button text, and party index labels using translations from the i18n_System
4. WHEN the user switches locale, THE Draft_Form SHALL re-render all new field labels and placeholders in the selected language without losing entered form data

### Requirement 5: Form Validation for New Fields

**User Story:** As a user, I want the form to validate my inputs before submission, so that I do not accidentally submit incomplete or invalid data.

#### Acceptance Criteria

1. WHEN the user submits the form without selecting a User_Party, THE Draft_Form SHALL prevent submission and display a validation error on the User_Party selector
2. WHEN the user submits the form with any required Outcome_Field left empty, THE Draft_Form SHALL prevent submission and display a validation error on each empty required Outcome_Field
3. THE Draft_Form SHALL mark the following Outcome_Fields as required per Contract_Type:
   - EMPLOYMENT: desired salary/compensation
   - SALE: item description, price and payment terms
   - SERVICE: service scope, service period
   - LEASE: property description, lease duration, monthly rent
   - PARTNERSHIP: capital contribution per party, profit sharing ratio
   - OTHER: free-text outcome description
4. IF the user enters a numeric Outcome_Field value that is not a valid positive number, THEN THE Draft_Form SHALL display a validation error indicating the value must be a positive number
5. THE Draft_Form SHALL validate that each Party_Panel has a non-empty name field before allowing submission

### Requirement 6: API Enhancement for Outcome Data

**User Story:** As a system, I want the Draft_API to accept and process the new outcome fields and party configuration, so that the AI can generate contracts that reflect the user's desired outcomes.

#### Acceptance Criteria

1. THE Draft_API SHALL accept an optional `userPartyIndex` field (integer, 0-based) in the request body indicating which party the user represents
2. THE Draft_API SHALL accept a `desiredOutcomes` object in the request body containing key-value pairs of outcome field identifiers and user-provided values
3. THE Draft_API SHALL validate that the `parties` array contains between 2 and 10 entries
4. IF the Draft_API receives a `parties` array with fewer than 2 or more than 10 entries, THEN THE Draft_API SHALL return a 400 status code with a descriptive error message
5. THE Draft_API SHALL include the `desiredOutcomes` data and `userPartyIndex` in the prompt sent to the AI model for contract generation
6. THE Draft_API SHALL maintain backward compatibility by treating requests without `desiredOutcomes` or `userPartyIndex` as valid requests with default behavior

### Requirement 7: AI Prompt Engineering for Contract Generation

**User Story:** As a system, I want the AI to receive specialized legal system prompts and structured user prompts for each contract type, so that the general-purpose GLM model produces professional, legally sound contracts that protect the user's interests.

#### Acceptance Criteria

1. THE CONTRACT_DRAFT_SYSTEM_PROMPT SHALL instruct the AI to act as a senior China-Thailand cross-border contract lawyer and SHALL include:
   - Role definition: "资深中泰跨境合同起草律师" (Senior China-Thailand cross-border contract drafting lawyer)
   - Expertise scope: Chinese law (《民法典》, 《劳动合同法》, etc.) and Thai law (Civil and Commercial Code, Labor Protection Act, etc.)
   - Output rules: contract structure requirements, jurisdiction-specific legal references, multi-language output format
   - Cross-border special requirements: applicable law clause, dispute resolution mechanism, currency/tax/compliance considerations
2. THE system SHALL define a CONTRACT_TYPE_PROMPT_MAP that maps each Contract_Type to a specialized prompt supplement containing:
   - EMPLOYMENT: labor law focus areas (probation, termination, severance, non-compete, social insurance obligations per jurisdiction)
   - SALE: commercial transaction focus areas (delivery, inspection, warranty, title transfer, force majeure, breach penalties)
   - SERVICE: service agreement focus areas (scope definition, SLA, acceptance criteria, IP ownership, liability caps)
   - LEASE: tenancy focus areas (rent adjustment, maintenance obligations, subletting restrictions, deposit return conditions)
   - PARTNERSHIP: partnership focus areas (capital contribution, profit/loss sharing, management rights, deadlock resolution, dissolution)
   - OTHER: general contract best practices
3. THE CONTRACT_DRAFT_USER_PROMPT_TEMPLATE SHALL include a `{{desiredOutcomes}}` placeholder that is populated with the user's outcome field values formatted as structured text
4. THE CONTRACT_DRAFT_USER_PROMPT_TEMPLATE SHALL include a `{{userPartyRole}}` placeholder indicating which party the user represents, with an instruction to the AI to draft protective clauses favoring that party
5. THE CONTRACT_DRAFT_USER_PROMPT_TEMPLATE SHALL include a `{{contractTypeGuidance}}` placeholder populated from the CONTRACT_TYPE_PROMPT_MAP
6. WHEN the user specifies a `userPartyIndex`, THE AI prompt SHALL include an explicit instruction: "请从{用户方角色}的角度起草合同，在法律允许范围内最大程度保护{用户方角色}的权益"
7. THE AI prompt SHALL instruct the model to incorporate all `desiredOutcomes` values into the appropriate contract clauses (e.g., breach penalty amount into the liability clause, salary into compensation clause)
8. THE consultation page (`/api/chat`) system prompt SHALL instruct the AI to act as a professional China-Thailand legal consultant with IRAC analysis methodology
9. THE contract review system prompt SHALL instruct the AI to act as a senior contract review lawyer with clause-by-clause risk analysis capability
10. ALL AI system prompts SHALL include a disclaimer instruction requiring the AI to append a legal disclaimer to generated content stating it is for reference only and does not constitute formal legal advice

### Requirement 8: AI Precision Prompts for All AI Services

**User Story:** As a system operator, I want every AI service in the platform to have a precise, domain-specific system prompt that guides the general-purpose GLM model to behave as a China-Thailand cross-border legal expert, so that all AI outputs across the platform are professional, accurate, and legally grounded.

#### Acceptance Criteria

1. THE Chat_Service system prompt SHALL define the AI role as "资深中泰跨境法律顾问" (Senior China-Thailand cross-border legal consultant) and SHALL include expertise scope covering Chinese law (《民法典》, 《合同法》, 《劳动法》, etc.) and Thai law (Civil and Commercial Code, Labor Protection Act, Foreign Business Act, etc.), IRAC analysis methodology, and structured response format requirements
2. THE IRAC_Service IRAC_SYSTEM_PROMPT SHALL define the AI role as "中泰跨境法律IRAC分析专家" and SHALL include explicit instructions for identifying applicable Chinese and Thai legal provisions, cross-border conflict-of-law analysis, and structured IRAC output format with jurisdiction-specific legal citations
3. THE IRAC_Service COMBINED_CONCLUSION_SYSTEM_PROMPT SHALL define the AI role as a cross-border legal conclusion synthesis expert and SHALL include instructions to reconcile findings across Chinese and Thai jurisdictions and produce a unified actionable recommendation
4. THE Case_Analysis_Service CASE_ANALYSIS_SYSTEM_PROMPT SHALL define the AI role as "中泰跨境案件分析专家" and SHALL include instructions for evaluating case merits under both Chinese and Thai legal frameworks, identifying cross-border procedural requirements, and providing jurisdiction-specific risk assessment
5. THE Case_Analysis_Service LITIGATION_STRATEGY_SYSTEM_PROMPT SHALL define the AI role as "中泰跨境诉讼策略专家" and SHALL include instructions for recommending litigation vs. arbitration vs. mediation strategies considering cross-border enforcement, applicable treaties (e.g., Hague Convention applicability), and cost-benefit analysis per jurisdiction
6. THE Evidence_Service EVIDENCE_CHECKLIST_SYSTEM_PROMPT SHALL define the AI role as "中泰跨境证据管理专家" and SHALL include instructions for listing required evidence types per Chinese and Thai procedural rules, cross-border evidence authentication requirements (公证认证/legalization), and evidence admissibility standards per jurisdiction
7. THE Evidence_Service EVIDENCE_ASSESSMENT_SYSTEM_PROMPT SHALL include instructions for evaluating evidence strength under both Chinese (《民事诉讼法》) and Thai (Civil Procedure Code) evidence rules and identifying cross-border evidence challenges
8. THE Evidence_Service EVIDENCE_GAPS_SYSTEM_PROMPT SHALL include instructions for identifying missing evidence items required by each jurisdiction and recommending specific steps to obtain cross-border evidence
9. THE Visa_Service VISA_RECOMMEND_SYSTEM_PROMPT SHALL define the AI role as "中泰签证与移民法律顾问" and SHALL include instructions referencing current Thai Immigration Act, Work Permit regulations, BOI promotion categories, and Chinese outbound travel regulations
10. THE Visa_Service VISA_RENEWAL_SYSTEM_PROMPT SHALL include instructions for renewal timeline requirements, document preparation checklists per visa category, and common rejection reasons with mitigation strategies
11. THE Visa_Service VISA_CONVERSION_SYSTEM_PROMPT SHALL include instructions for conversion eligibility rules between visa categories, required documentation differences, and processing timeline expectations
12. THE Case_Search_Service CASE_SEARCH_SYSTEM_PROMPT SHALL define the AI role as "中泰跨境判例检索专家" and SHALL include instructions for searching and citing relevant Chinese court decisions (裁判文书) and Thai court decisions with proper citation format per jurisdiction
13. THE Case_Search_Service TREND_ANALYSIS_SYSTEM_PROMPT SHALL include instructions for analyzing judicial trends across Chinese and Thai courts, identifying shifts in legal interpretation, and providing statistical context where available
14. THE Case_Search_Service CASE_COMPARISON_SYSTEM_PROMPT SHALL include instructions for comparing cases across jurisdictions, highlighting procedural and substantive law differences, and identifying precedent applicability
15. THE Jurisdiction_Service JURISDICTION_SYSTEM_PROMPT SHALL maintain its existing keyword-based jurisdiction mapping and SHALL be enhanced to include cross-border jurisdiction conflict resolution guidance and forum selection recommendations
16. THE Compliance_Service FULL_COMPLIANCE_SYSTEM_PROMPT SHALL define the AI role as "中泰跨境合规分析专家" and SHALL include instructions referencing Chinese regulatory frameworks (市场监管, 外汇管理, 税务合规) and Thai regulatory frameworks (Foreign Business Act, Revenue Code, BOI regulations) with cross-border compliance interaction analysis
17. THE Report_Service REPORT_SYSTEM_PROMPT SHALL define the AI role as "中泰跨境法律报告撰写专家" and SHALL include instructions for professional report structure, jurisdiction-specific legal citation format, executive summary requirements, and bilingual terminology usage
18. THE Timeline_Service TIMELINE_SYSTEM_PROMPT SHALL define the AI role as "中泰跨境案件时间线分析专家" and SHALL include instructions for identifying legally significant dates under both jurisdictions, statute of limitations calculations per applicable law, and procedural deadline mapping
19. EVERY AI system prompt across all services SHALL conform to the Prompt_Standard by including: (a) a specific role definition with "中泰跨境" expertise qualifier, (b) explicit listing of applicable Chinese and Thai legal sources, (c) output quality rules specifying structured format and professional legal language, and (d) a legal disclaimer instruction requiring the AI to state that output is for reference only and does not constitute formal legal advice
20. WHEN any AI service generates a response, THE service SHALL ensure the system prompt is sent as the first message in the conversation context so the GLM model operates within the defined legal expert persona throughout the entire interaction