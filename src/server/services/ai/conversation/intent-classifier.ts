/**
 * Intent Classifier (意图分类器)
 * Classifies user legal consultation input into legal domains
 * and routes to the appropriate analysis module.
 *
 * Uses keyword-based classification for testability and determinism.
 * Supports Chinese, Thai, and English keywords.
 *
 * Requirements: 21.2, 21.7, 28.6
 */

// ─── Types ──────────────────────────────────────────────────

export enum LegalDomain {
  CORPORATE = 'CORPORATE',
  CONTRACT = 'CONTRACT',
  CRIMINAL = 'CRIMINAL',
  CIVIL = 'CIVIL',
  VISA = 'VISA',
  TAX = 'TAX',
  IP = 'IP',
  LABOR = 'LABOR',
  TRADE = 'TRADE',
}

export interface IntentClassification {
  primaryIntent: LegalDomain;
  secondaryIntents: LegalDomain[];
  confidence: number; // 0-1
  routingTarget: string; // module name
}

// ─── Routing Map ────────────────────────────────────────────

export const ROUTING_MAP: Record<LegalDomain, string> = {
  [LegalDomain.CORPORATE]: 'case-analyzer',
  [LegalDomain.CONTRACT]: 'contract',
  [LegalDomain.CRIMINAL]: 'case-analyzer',
  [LegalDomain.CIVIL]: 'case-analyzer',
  [LegalDomain.VISA]: 'visa',
  [LegalDomain.TAX]: 'case-analyzer',
  [LegalDomain.IP]: 'case-analyzer',
  [LegalDomain.LABOR]: 'case-analyzer',
  [LegalDomain.TRADE]: 'case-analyzer',
};

// ─── Keyword Definitions ────────────────────────────────────

/**
 * Multi-language keyword map for each legal domain.
 * Each domain has keywords in Chinese (zh), Thai (th), and English (en).
 */
export const DOMAIN_KEYWORDS: Record<LegalDomain, string[]> = {
  [LegalDomain.CORPORATE]: [
    // Chinese
    '公司注册', '公司设立', '股权结构', '股东', '营业执照', '企业合规',
    '公司法', '外商投资', '公司章程', '董事会', '法人', '注册资本',
    '工商登记', '企业变更', '公司注销',
    // Thai
    'จดทะเบียนบริษัท', 'โครงสร้างผู้ถือหุ้น', 'กรรมการ', 'ข้อบังคับบริษัท',
    'ทุนจดทะเบียน', 'นิติบุคคล',
    // English
    'company registration', 'corporate', 'shareholder', 'incorporation',
    'articles of association', 'board of directors', 'registered capital',
  ],
  [LegalDomain.CONTRACT]: [
    // Chinese
    '合同', '协议', '契约', '违约', '合同审查', '合同起草',
    '合同纠纷', '合同条款', '合同签订', '合同解除', '合同终止',
    '租赁合同', '买卖合同', '服务合同',
    // Thai
    'สัญญา', 'ข้อตกลง', 'ผิดสัญญา', 'ร่างสัญญา', 'ตรวจสอบสัญญา',
    // English
    'contract', 'agreement', 'breach of contract', 'contract review',
    'contract draft', 'lease agreement', 'terms and conditions',
  ],
  [LegalDomain.CRIMINAL]: [
    // Chinese
    '刑事', '犯罪', '刑法', '罪名', '量刑', '逮捕', '拘留',
    '起诉', '辩护', '刑事诉讼', '犯罪嫌疑人', '被告人',
    '诈骗', '盗窃', '故意伤害', '贪污', '受贿',
    // Thai
    'อาญา', 'ความผิด', 'จับกุม', 'คุมขัง', 'ฟ้องร้อง',
    // English
    'criminal', 'crime', 'arrest', 'prosecution', 'defense',
    'fraud', 'theft', 'assault', 'sentencing',
  ],
  [LegalDomain.CIVIL]: [
    // Chinese
    '民事', '侵权', '损害赔偿', '民事诉讼', '民法典',
    '人身损害', '财产损害', '名誉权', '隐私权', '继承',
    '婚姻', '离婚', '抚养', '赡养',
    // Thai
    'แพ่ง', 'ละเมิด', 'ค่าเสียหาย', 'มรดก', 'หย่า',
    // English
    'civil', 'tort', 'damages', 'personal injury', 'inheritance',
    'divorce', 'custody', 'civil litigation',
  ],
  [LegalDomain.VISA]: [
    // Chinese
    '签证', '工作签', '退休签', '精英签', '商务签', 'DTV签',
    '签证续签', '签证转换', '逾期滞留', '移民', '居留许可',
    '工作许可', '90天报到',
    // Thai
    'วีซ่า', 'ใบอนุญาตทำงาน', 'ต่อวีซ่า', 'ตรวจคนเข้าเมือง',
    // English
    'visa', 'work permit', 'retirement visa', 'elite visa',
    'business visa', 'immigration', 'residence permit', 'overstay',
  ],
  [LegalDomain.TAX]: [
    // Chinese
    '税务', '税收', '纳税', '增值税', '所得税', '个人所得税',
    '企业所得税', '避免双重征税', '税务合规', '报税', '退税',
    // Thai
    'ภาษี', 'ภาษีเงินได้', 'ภาษีมูลค่าเพิ่ม', 'สรรพากร',
    // English
    'tax', 'taxation', 'income tax', 'vat', 'value added tax',
    'double taxation', 'tax compliance', 'tax return',
  ],
  [LegalDomain.IP]: [
    // Chinese
    '知识产权', '商标', '专利', '著作权', '版权', '商业秘密',
    '知识产权侵权', '商标注册', '专利申请', '著作权登记',
    // Thai
    'ทรัพย์สินทางปัญญา', 'เครื่องหมายการค้า', 'สิทธิบัตร', 'ลิขสิทธิ์',
    // English
    'intellectual property', 'trademark', 'patent', 'copyright',
    'trade secret', 'ip infringement', 'ip rights',
  ],
  [LegalDomain.LABOR]: [
    // Chinese
    '劳动', '劳动法', '劳动合同', '劳动争议', '劳动仲裁',
    '工资', '加班', '社保', '公积金', '解雇', '辞退',
    '工伤', '劳动保护', '最低工资',
    // Thai
    'แรงงาน', 'กฎหมายแรงงาน', 'สัญญาจ้าง', 'ค่าจ้าง', 'เลิกจ้าง',
    'ประกันสังคม', 'ค่าชดเชย',
    // English
    'labor', 'labour', 'employment', 'employment contract', 'wages',
    'overtime', 'dismissal', 'termination', 'workplace injury',
    'minimum wage', 'labor dispute',
  ],
  [LegalDomain.TRADE]: [
    // Chinese
    '贸易', '跨境贸易', '进出口', '海关', '关税', '国际贸易',
    '贸易合规', '出口管制', '进口许可', '贸易壁垒',
    '投资准入', '外资准入',
    // Thai
    'การค้า', 'นำเข้า', 'ส่งออก', 'ศุลกากร', 'การค้าระหว่างประเทศ',
    // English
    'trade', 'import', 'export', 'customs', 'tariff',
    'international trade', 'cross-border trade', 'trade compliance',
  ],
};

// ─── Intent Classifier ─────────────────────────────────────

/**
 * System prompt for intent classification context.
 * Defines the LegalDomain enum and classification rules.
 */
export const INTENT_CLASSIFICATION_SYSTEM_PROMPT = `你是一位法律意图分类专家。根据用户输入的法律咨询文本，识别其法律领域意图。

## 法律领域枚举 (LegalDomain)
- CORPORATE: 企业合规、公司注册、股权结构
- CONTRACT: 合同起草、审查、纠纷
- CRIMINAL: 刑事案件、犯罪、量刑
- CIVIL: 民事纠纷、侵权、损害赔偿
- VISA: 签证咨询、移民、居留许可
- TAX: 税务合规、纳税、避免双重征税
- IP: 知识产权、商标、专利、著作权
- LABOR: 劳动争议、劳动合同、工资
- TRADE: 跨境贸易、进出口、海关

## 分类规则
1. 识别主要法律领域 (primaryIntent)
2. 如果涉及多个领域，识别次要领域 (secondaryIntents)
3. 给出置信度评分 (0-1)`;

/**
 * Classify the legal intent of user input text using keyword matching.
 * Supports Chinese, Thai, and English keywords.
 */
export function classifyIntent(text: string): IntentClassification {
  const normalizedText = text.toLowerCase();
  const domainScores = new Map<LegalDomain, number>();

  // Score each domain by counting keyword matches
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > 0) {
      domainScores.set(domain as LegalDomain, score);
    }
  }

  // Sort domains by score descending
  const sorted = Array.from(domainScores.entries()).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    // No keywords matched — default to CIVIL with low confidence
    return {
      primaryIntent: LegalDomain.CIVIL,
      secondaryIntents: [],
      confidence: 0.3,
      routingTarget: ROUTING_MAP[LegalDomain.CIVIL],
    };
  }

  const primaryDomain: LegalDomain = sorted[0][0];
  const primaryScore = sorted[0][1];

  // Secondary intents: all other matched domains
  const secondaryIntents: LegalDomain[] = sorted.slice(1).map((entry) => entry[0]);

  // Confidence calculation:
  // Base confidence from primary score, reduced if many secondary intents
  const totalMatches = sorted.reduce((sum, entry) => sum + entry[1], 0);
  const dominance = primaryScore / totalMatches; // How dominant the primary intent is
  const baseConfidence = Math.min(0.95, 0.5 + primaryScore * 0.1);
  const confidence = Math.round(baseConfidence * dominance * 100) / 100;

  return {
    primaryIntent: primaryDomain,
    secondaryIntents,
    confidence: Math.max(0.3, Math.min(1, confidence)),
    routingTarget: ROUTING_MAP[primaryDomain],
  };
}
