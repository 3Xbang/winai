import { PrismaClient, SubscriptionTier, BillingPeriod, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedSubscriptionPlans() {
  console.log('🌱 Seeding subscription plans...');

  const plans = [
    {
      name: '免费版',
      tier: SubscriptionTier.FREE,
      period: BillingPeriod.MONTHLY,
      price: 0,
      currency: 'CNY',
      dailyLimit: 3,
      monthlyLimit: 30,
      features: ['每日3次免费咨询', '每月30次免费咨询', '基础法律分析', '中泰双语支持'],
    },
    {
      name: '标准版（月付）',
      tier: SubscriptionTier.STANDARD,
      period: BillingPeriod.MONTHLY,
      price: 99,
      currency: 'CNY',
      dailyLimit: null,
      monthlyLimit: null,
      features: [
        '无限咨询次数',
        'IRAC 深度分析',
        '合同起草与审查',
        '案件分析与策略',
        '证据组织与评估',
        '案例检索',
        'PDF 报告导出',
      ],
    },
    {
      name: '标准版（年付）',
      tier: SubscriptionTier.STANDARD,
      period: BillingPeriod.YEARLY,
      price: 999,
      currency: 'CNY',
      dailyLimit: null,
      monthlyLimit: null,
      features: [
        '无限咨询次数',
        'IRAC 深度分析',
        '合同起草与审查',
        '案件分析与策略',
        '证据组织与评估',
        '案例检索',
        'PDF 报告导出',
        '年付优惠（省189元）',
      ],
    },
    {
      name: 'VIP 尊享版（月付）',
      tier: SubscriptionTier.VIP,
      period: BillingPeriod.MONTHLY,
      price: 299,
      currency: 'CNY',
      dailyLimit: null,
      monthlyLimit: null,
      features: [
        '无限咨询次数',
        '优先响应队列',
        'AI 律师团模拟辩论',
        '多维度风险评估',
        '智能文书生成',
        '专属报告模板',
        '优先案例检索',
        '企业知识库',
      ],
    },
    {
      name: 'VIP 尊享版（年付）',
      tier: SubscriptionTier.VIP,
      period: BillingPeriod.YEARLY,
      price: 2999,
      currency: 'CNY',
      dailyLimit: null,
      monthlyLimit: null,
      features: [
        '无限咨询次数',
        '优先响应队列',
        'AI 律师团模拟辩论',
        '多维度风险评估',
        '智能文书生成',
        '专属报告模板',
        '优先案例检索',
        '企业知识库',
        '年付优惠（省589元）',
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: {
        id: `plan-${plan.tier.toLowerCase()}-${plan.period.toLowerCase()}`,
      },
      update: {
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        dailyLimit: plan.dailyLimit,
        monthlyLimit: plan.monthlyLimit,
        features: plan.features,
        isActive: true,
      },
      create: {
        id: `plan-${plan.tier.toLowerCase()}-${plan.period.toLowerCase()}`,
        name: plan.name,
        tier: plan.tier,
        period: plan.period,
        price: plan.price,
        currency: plan.currency,
        dailyLimit: plan.dailyLimit,
        monthlyLimit: plan.monthlyLimit,
        features: plan.features,
        isActive: true,
      },
    });
  }

  console.log(`  ✅ ${plans.length} subscription plans seeded`);
}

async function seedAdminUser() {
  console.log('🌱 Seeding admin user...');

  const passwordHash = await bcrypt.hash('Admin@LegalExpert2024', 12);

  await prisma.user.upsert({
    where: { email: 'admin@legalexpert.com' },
    update: {
      name: '系统管理员',
      role: UserRole.ADMIN,
      passwordHash,
      isEmailVerified: true,
    },
    create: {
      email: 'admin@legalexpert.com',
      name: '系统管理员',
      role: UserRole.ADMIN,
      passwordHash,
      isEmailVerified: true,
      locale: 'zh',
    },
  });

  console.log('  ✅ Admin user seeded (admin@legalexpert.com)');
}

async function seedLegalCases() {
  console.log('🌱 Seeding sample legal cases...');

  const cases = [
    {
      id: 'case-cn-contract-001',
      jurisdiction: 'CHINA',
      caseNumber: '（2023）京0105民初12345号',
      title: '北京某科技公司与上海某贸易公司买卖合同纠纷案',
      summary:
        '原告北京某科技公司与被告上海某贸易公司签订电子产品买卖合同，约定被告向原告采购价值500万元的电子元器件。被告收货后以产品质量不符合约定为由拒绝支付尾款200万元。原告提起诉讼要求被告支付剩余货款及违约金。',
      verdict:
        '法院判决被告支付原告货款180万元及违约金20万元。法院认定部分产品确实存在轻微质量瑕疵，酌情减少货款20万元，但被告拒绝支付全部尾款的行为构成违约。',
      keyReasoning:
        '根据《中华人民共和国民法典》第五百七十七条，当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。本案中，虽然原告交付的部分产品存在轻微瑕疵，但不构成根本违约，被告应当在合理扣减后支付剩余货款。',
      legalDomain: 'CONTRACT',
      tags: ['买卖合同', '质量瑕疵', '违约责任', '民法典'],
      decidedAt: new Date('2023-09-15'),
    },
    {
      id: 'case-th-fba-001',
      jurisdiction: 'THAILAND',
      caseNumber: 'Supreme Court Decision No. 4521/2566',
      title: 'Foreign Business Act Violation - Nominee Shareholding Structure',
      summary:
        'A Chinese national established a Thai limited company with Thai nominee shareholders holding 51% of shares to circumvent the Foreign Business Act restrictions. The Department of Business Development investigated and found that the actual control and funding came entirely from the foreign national.',
      verdict:
        'The court found the company in violation of Section 36 of the Foreign Business Act B.E. 2542. The foreign national was fined 100,000-1,000,000 THB and ordered to cease business operations within 6 months or restructure with a proper Foreign Business License.',
      keyReasoning:
        'Under Section 36 of the Foreign Business Act B.E. 2542, any foreigner operating a business restricted under Lists One, Two, or Three without proper authorization commits an offense. The use of Thai nominees to circumvent foreign ownership restrictions constitutes a violation regardless of the formal shareholding structure. The court examined the actual source of capital, management control, and profit distribution to determine true ownership.',
      legalDomain: 'CORPORATE',
      tags: [
        'Foreign Business Act',
        'nominee structure',
        'foreign ownership',
        'corporate compliance',
      ],
      decidedAt: new Date('2023-06-20'),
    },
    {
      id: 'case-cn-labor-001',
      jurisdiction: 'CHINA',
      caseNumber: '（2024）沪0115民初6789号',
      title: '外籍员工劳动合同解除纠纷案',
      summary:
        '泰国籍员工在上海某外资企业工作三年后被公司以"组织架构调整"为由单方面解除劳动合同。员工认为公司未依法支付经济补偿金，且解除程序违法，遂申请劳动仲裁后诉至法院。',
      verdict:
        '法院认定公司解除劳动合同的行为违法，判决公司支付违法解除劳动合同赔偿金（2N）共计18万元，并补缴社会保险差额。',
      keyReasoning:
        '根据《中华人民共和国劳动合同法》第四十八条及《外国人在中国就业管理规定》，用人单位违法解除劳动合同的，应当按照经济补偿标准的二倍向劳动者支付赔偿金。本案中，公司未能证明"组织架构调整"的客观性和必要性，且未履行提前三十日书面通知义务，构成违法解除。',
      legalDomain: 'LABOR',
      tags: ['劳动合同', '违法解除', '外籍员工', '经济补偿', '劳动合同法'],
      decidedAt: new Date('2024-01-10'),
    },
  ];

  for (const legalCase of cases) {
    await prisma.legalCase.upsert({
      where: { id: legalCase.id },
      update: {
        jurisdiction: legalCase.jurisdiction,
        caseNumber: legalCase.caseNumber,
        title: legalCase.title,
        summary: legalCase.summary,
        verdict: legalCase.verdict,
        keyReasoning: legalCase.keyReasoning,
        legalDomain: legalCase.legalDomain,
        tags: legalCase.tags,
        decidedAt: legalCase.decidedAt,
      },
      create: legalCase,
    });
  }

  console.log(`  ✅ ${cases.length} sample legal cases seeded`);
}

async function main() {
  console.log('🚀 Starting database seed...\n');

  await seedSubscriptionPlans();
  await seedAdminUser();
  await seedLegalCases();

  console.log('\n✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
