# 实施计划：中泰智能法律专家系统

## 概述

基于 Next.js 14 + tRPC + Prisma + PostgreSQL 技术栈，按模块化方式逐步实现中泰智能法律专家系统。每个任务构建在前一任务基础上，确保代码始终可运行。所有代码使用 TypeScript 实现。

## 任务列表

- [x] 1. 项目脚手架与基础设施搭建
  - [x] 1.1 初始化 Next.js 14 项目并配置核心依赖
    - 使用 App Router 创建 Next.js 14 项目
    - 安装并配置 tRPC、Prisma、Tailwind CSS、Ant Design 5、next-intl
    - 配置 TypeScript 严格模式、ESLint、Prettier
    - 创建项目目录结构（`src/server/`, `src/app/`, `src/lib/`, `src/components/`, `tests/`）
    - 配置环境变量模板（`.env.example`）：数据库连接、LLM API Key、支付密钥、Redis 连接等
    - _需求：18.1_

  - [x] 1.2 配置 Vitest 和 fast-check 测试框架
    - 安装 vitest、@vitest/coverage-v8、fast-check
    - 创建 `vitest.config.ts`，配置路径别名和测试目录
    - 创建测试目录结构：`tests/properties/`、`tests/unit/`、`tests/integration/`
    - 编写一个冒烟测试验证框架配置正确
    - _需求：全局_

  - [x] 1.3 配置 next-intl 多语言支持
    - 创建 `messages/zh.json`、`messages/th.json`、`messages/en.json` 翻译文件骨架
    - 配置 next-intl middleware 和 i18n routing
    - 实现语言切换组件 `LanguageSwitcher`
    - _需求：18.2_


- [x] 2. 数据库 Schema 与 ORM 配置
  - [x] 2.1 创建 Prisma Schema 并执行数据库迁移
    - 按照设计文档定义完整的 Prisma Schema（User、Enterprise、SocialAccount、SubscriptionPlan、Subscription、UsageRecord、Order、ConsultationSession、Message、Report、UploadedFile、Bookmark、LegalCase、BlogPost、Testimonial、ReferralCode、Referral、AuditLog、LawDocument、VectorEmbedding、GeneratedDocument、DocumentVersion、UserPreference、EnterpriseKnowledge、RiskAssessment、QualityFeedback、HumanEscalation、ABTestVariant、ABTestAssignment、PromptTemplate）
    - 定义所有枚举类型（UserRole、SubscriptionTier、BillingPeriod、SubscriptionStatus、PaymentStatus、SessionStatus、MessageRole、FileScanStatus）
    - 配置索引和唯一约束
    - 执行 `prisma migrate dev` 生成迁移文件
    - _需求：14.2, 14.5, 14.6, 15.1, 16.4, 17.1_

  - [x] 2.2 创建 Prisma Client 单例和数据库工具函数
    - 创建 `src/lib/prisma.ts` 导出 Prisma Client 单例（避免开发环境热重载问题）
    - 创建 `src/lib/redis.ts` 配置 Redis 连接（ioredis）
    - 创建通用的分页查询工具函数
    - _需求：全局_

  - [x] 2.3 创建种子数据脚本
    - 编写 `prisma/seed.ts`，插入默认订阅计划（FREE/STANDARD/VIP，月度/年度）
    - 插入管理员账户
    - 插入示例法律案例数据
    - _需求：15.1, 15.2, 15.3_

- [ ] 3. 认证系统实现
  - [x] 3.1 配置 NextAuth.js 并实现核心认证逻辑
    - 安装并配置 NextAuth.js（`src/app/api/auth/[...nextauth]/route.ts`）
    - 实现 Credentials Provider（邮箱密码登录）
    - 实现手机验证码登录 Provider
    - 配置 JWT 策略，在 token 中包含 userId 和 role
    - 实现密码哈希（bcrypt）和验证逻辑
    - _需求：14.1, 14.3_

  - [x] 3.2 实现社交账号登录（微信、Line）
    - 配置微信 OAuth Provider
    - 配置 Line OAuth Provider
    - 实现社交账号与本地账户的绑定/关联逻辑
    - _需求：14.1, 14.3_

  - [x] 3.3 实现注册、密码重置和账户锁定
    - 实现邮箱注册流程（发送验证码、验证邮箱唯一性）
    - 实现手机号注册流程（发送短信验证码、验证手机号唯一性）
    - 实现密码重置流程（邮箱/手机验证码方式）
    - 实现连续失败登录检测和账户锁定逻辑（5次失败后锁定30分钟）
    - 使用 Redis 记录登录失败次数和锁定状态
    - _需求：14.2, 14.4, 14.8_

  - [ ]* 3.4 编写认证属性测试
    - **属性 20：邮箱/手机号唯一性约束** — 验证重复邮箱或手机号注册被拒绝
    - **验证需求：14.2**

  - [ ]* 3.5 编写认证属性测试 - 账户锁定
    - **属性 23：连续失败登录锁定** — 验证5次错误密码后账户锁定，锁定期间正确密码也被拒绝
    - **验证需求：14.8**

  - [x] 3.6 实现角色权限中间件
    - 创建 tRPC 中间件，从 JWT 中提取用户角色
    - 实现基于角色的路由访问控制（FREE_USER/PAID_USER/VIP_MEMBER/ADMIN）
    - 创建 `protectedProcedure`、`paidProcedure`、`vipProcedure`、`adminProcedure`
    - _需求：14.7_

  - [ ]* 3.7 编写角色权限属性测试
    - **属性 22：角色权限访问控制** — 验证不同角色对受保护端点的访问控制正确性
    - **验证需求：14.7**

  - [x] 3.8 实现用户资料管理
    - 实现个人资料编辑 API（姓名、联系方式、头像）
    - 实现企业信息管理 API（公司名称、营业执照号、联系地址）
    - _需求：14.5, 14.6_

  - [ ]* 3.9 编写用户资料属性测试
    - **属性 21：用户资料更新往返一致性** — 验证更新后查询返回一致数据
    - **验证需求：14.5, 14.6**

  - [ ]* 3.10 编写认证单元测试
    - 测试多种注册方式（邮箱、手机、微信、Line）的注册流程
    - 测试多种登录方式的认证流程
    - 测试密码重置流程
    - _需求：14.1, 14.3, 14.4_


- [x] 4. 检查点 - 基础设施与认证验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 5. LLM 集成层与核心法律分析服务
  - [x] 5.1 实现 LLM API Gateway 和 Prompt 模板引擎
    - 创建 `src/server/services/llm/gateway.ts`，封装 OpenAI 和 Claude API 调用
    - 实现主模型/备用模型切换降级策略（GPT-4 → Claude → 降级响应）
    - 创建 `src/server/services/llm/prompt-engine.ts`，实现 Prompt 模板管理
    - 实现流式响应支持（SSE）
    - 实现 LLM 输出结构化解析和 schema 验证
    - _需求：全局_

  - [x] 5.2 实现管辖权识别器（Jurisdiction_Identifier）
    - 创建 `src/server/services/legal/jurisdiction.ts`
    - 实现 `identify(request: ConsultationRequest): Promise<JurisdictionResult>` 接口
    - 编写管辖权识别 Prompt（包含中泰法律关键词映射表和判定规则）
    - 实现低置信度时返回补充信息请求逻辑
    - _需求：1.1, 1.2, 1.3, 1.4_

  - [ ]* 5.3 编写管辖权识别属性测试
    - **属性 1：管辖权识别结果完整性** — 验证结果包含有效 jurisdiction 字段，DUAL 时两个法律数组非空
    - **验证需求：1.1, 1.2**

  - [ ]* 5.4 编写管辖权低置信度属性测试
    - **属性 2：低置信度管辖权触发补充信息请求** — 验证低置信度时 needsMoreInfo 非空
    - **验证需求：1.3**

  - [ ]* 5.5 编写报告管辖权标注属性测试
    - **属性 3：报告必须标注管辖权** — 验证所有报告包含有效 jurisdiction 字段
    - **验证需求：1.4**

  - [x] 5.6 实现 IRAC 分析引擎（IRAC_Engine）
    - 创建 `src/server/services/legal/irac.ts`
    - 实现 `analyze(request, jurisdiction): Promise<IRACResult>` 接口
    - 编写 IRAC 分析 Prompt，强制按四步骤输出，Rule 步骤引用具体法条编号
    - 实现双重管辖时分别执行两次独立 IRAC 分析
    - _需求：2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.7 编写 IRAC 结构完整性属性测试
    - **属性 4：IRAC 四步骤结构完整性** — 验证 issue/rule/analysis/conclusion 非空，rule 包含法条引用
    - **验证需求：2.1, 2.2**

  - [ ]* 5.8 编写双重管辖 IRAC 属性测试
    - **属性 5：双重管辖独立 IRAC 分析** — 验证 DUAL 管辖时两个分析均完整
    - **验证需求：2.3**

  - [x] 5.9 实现合同分析器（Contract_Analyzer）
    - 创建 `src/server/services/legal/contract.ts`
    - 实现 `draft(request: ContractDraftRequest): Promise<string>` 合同起草接口
    - 实现 `review(contractText, jurisdiction): Promise<ContractReviewResult>` 合同审查接口
    - 编写合同起草 Prompt（支持多种合同类型、多语言输出）
    - 编写合同审查 Prompt（逐条分析、风险标注、修改建议）
    - _需求：4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.10 编写合同草案属性测试
    - **属性 7：合同草案结构完整性** — 验证合同包含适用法律条款和争议解决条款，多语言请求时包含所有语言
    - **验证需求：4.1, 4.2, 4.3, 4.4**

  - [ ]* 5.11 编写合同审查风险项属性测试
    - **属性 8：合同审查风险项完整性** — 验证每个 ContractRisk 包含完整字段，HIGH 风险有法律依据
    - **验证需求：5.1, 5.2, 5.3, 5.4**

  - [ ]* 5.12 编写合同审查报告属性测试
    - **属性 9：合同审查报告生成完整性** — 验证 reviewReport 和 overallRiskLevel 非空
    - **验证需求：5.5**

  - [x] 5.13 实现案件分析器（Case_Analyzer）
    - 创建 `src/server/services/legal/case-analyzer.ts`
    - 实现 `analyze(caseInfo): Promise<CaseAnalysisResult>` 接口
    - 实现 `generateStrategy(analysis): Promise<LitigationStrategy>` 接口
    - 编写案件分析 Prompt（时间线梳理、争议焦点识别、三视角策略生成）
    - _需求：6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 5.14 编写案件时间线属性测试
    - **属性 10：案件时间线有序性** — 验证 timeline 数组按时间顺序排列
    - **验证需求：6.1**

  - [ ]* 5.15 编写争议焦点属性测试
    - **属性 11：法律争议焦点必须关联法条** — 验证每个 LegalIssue 的法条引用列表非空
    - **验证需求：6.2, 6.3**

  - [ ]* 5.16 编写三视角策略属性测试
    - **属性 12：三视角诉讼策略完整性** — 验证 plaintiff/defendant/judge 三视角存在且 keyArguments 非空
    - **验证需求：7.1, 7.2, 7.3, 7.4, 7.5**

  - [x] 5.17 实现证据组织器（Evidence_Organizer）
    - 创建 `src/server/services/legal/evidence.ts`
    - 实现 `generateChecklist(issues): Promise<EvidenceItem[]>` 接口
    - 实现 `assessStrength(evidence): Promise<EvidenceAssessment>` 接口
    - 实现 `identifyGaps(evidence, issues): Promise<EvidenceGap[]>` 接口
    - 编写证据评估 Prompt（证据类型分类、证明力评估、合法性风险标注）
    - _需求：8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 5.18 编写证据项属性测试
    - **属性 13：证据项完整性** — 验证每个 EvidenceItem 包含有效 type/strength/strengthReason，legalityRisk 非空时 alternativeCollection 也非空
    - **验证需求：8.1, 8.2, 8.3, 8.5**

  - [x] 5.19 实现案例检索引擎（Case_Search_Engine）
    - 创建 `src/server/services/legal/case-search.ts`
    - 实现 `search(query): Promise<CaseSearchResult>` 接口
    - 实现 `analyzeTrends(cases): Promise<TrendAnalysis>` 接口
    - 集成 OpenSearch 进行全文检索
    - 使用 LLM 进行语义相似度排序和趋势分析
    - _需求：9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 5.20 编写案例检索结果属性测试
    - **属性 14：案例检索结果完整性** — 验证每个 SimilarCase 包含非空 summary/verdict/keyReasoning 和有效 jurisdiction
    - **验证需求：9.1, 9.2**

  - [ ]* 5.21 编写案例检索趋势属性测试
    - **属性 15：案例检索附带趋势和对比分析** — 验证非空结果集包含 trendAnalysis 和 comparison
    - **验证需求：9.3, 9.4**

  - [x] 5.22 实现签证顾问（Visa_Advisor）
    - 创建 `src/server/services/legal/visa.ts`
    - 实现 `recommend(userProfile): Promise<VisaRecommendation[]>` 接口
    - 实现 `getRenewalInfo(currentVisa): Promise<RenewalInfo>` 接口
    - 实现 `getConversionPaths(currentVisa, targetType): Promise<ConversionPath[]>` 接口
    - 编写签证咨询 Prompt（签证类型推荐、申请要求、拒签原因、法律后果）
    - _需求：10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 5.23 编写签证推荐属性测试
    - **属性 16：签证推荐完整性** — 验证每个 VisaRecommendation 包含所有必需字段非空
    - **验证需求：10.1, 10.2, 10.3**

  - [ ]* 5.24 编写签证续签/转换属性测试
    - **属性 17：签证续签/转换路径查询** — 验证续签或转换查询返回非空结果
    - **验证需求：10.5**

  - [x] 5.25 实现合规风险标注逻辑
    - 在所有法律分析服务中实现合规风险检测
    - 确保每个风险项同时包含风险描述和合规替代方案
    - _需求：3.5, 11.4_

  - [ ]* 5.26 编写合规风险属性测试
    - **属性 6：合规风险标注必须附带替代方案** — 验证每个风险项包含描述和至少一条替代方案
    - **验证需求：3.5, 11.4**

- [x] 6. 检查点 - 核心法律分析服务验证
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 7. 报告生成与风险警示
  - [x] 7.1 实现报告生成器（Report_Generator）
    - 创建 `src/server/services/report/generator.ts`
    - 实现 `generate(analysisResult, format): Promise<LegalReport>` 接口
    - 实现六部分报告结构：核心结论摘要、法律依据分析、深度策略建议、行动方案、类似案例参考、免责声明
    - 实现 `exportPDF(report): Promise<Buffer>` PDF 导出功能（使用 Puppeteer 或 @react-pdf/renderer）
    - _需求：12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 7.2 编写报告结构属性测试
    - **属性 18：法律报告六部分结构完整性** — 验证六个字段全部存在且非空，actionPlan 为有序数组
    - **验证需求：12.1, 12.2, 12.3, 12.4**

  - [x] 7.3 实现风险警示与免责声明逻辑
    - 在咨询回复中自动插入免责声明
    - 实现高风险法律建议的醒目风险警示标注
    - 实现刑事案件聘请律师建议的自动插入
    - 实现法律法规变更提示逻辑
    - _需求：13.1, 13.2, 13.3, 13.4_

  - [ ]* 7.4 编写风险警示属性测试
    - **属性 19：咨询回复包含风险警示和免责声明** — 验证回复包含免责声明，高风险时包含警示，刑事案件包含律师建议
    - **验证需求：13.1, 13.2, 13.4**


- [x] 8. 订阅管理与支付系统
  - [x] 8.1 实现订阅管理器（Subscription_Manager）
    - 创建 `src/server/services/subscription/manager.ts`
    - 实现 `checkQuota(userId): Promise<QuotaStatus>` 额度检查（Redis 计数器）
    - 实现 `subscribe(userId, planId): Promise<Subscription>` 订阅创建
    - 实现 `cancelSubscription(userId): Promise<void>` 取消订阅
    - 实现 `startTrial(userId): Promise<Trial>` 新用户7天试用期
    - 实现 `downgradeToFree(userId): Promise<void>` 过期降级
    - 实现免费用户额度限制（每日3次、每月30次）
    - 实现 VIP 无限咨询逻辑
    - 实现订阅到期前3天续费通知（集成 SES/SMS）
    - _需求：15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [ ]* 8.2 编写免费用户额度属性测试
    - **属性 24：免费用户咨询额度限制** — 验证 FREE_USER 每日不超过3次、每月不超过30次
    - **验证需求：15.1**

  - [ ]* 8.3 编写年度订阅价格属性测试
    - **属性 25：年度订阅价格优惠** — 验证年度价格严格小于月度价格×12
    - **验证需求：15.2**

  - [ ]* 8.4 编写 VIP 无限咨询属性测试
    - **属性 26：VIP 会员无限咨询** — 验证 VIP_MEMBER 额度检查始终返回可用
    - **验证需求：15.5**

  - [ ]* 8.5 编写新用户试用期属性测试
    - **属性 27：新用户试用期** — 验证新注册用户获得7天试用订阅
    - **验证需求：15.6**

  - [ ]* 8.6 编写订阅过期降级属性测试
    - **属性 28：订阅过期自动降级** — 验证过期未续费用户降级为 FREE_USER
    - **验证需求：15.8**

  - [x] 8.7 实现支付网关（Payment_Gateway）
    - 创建 `src/server/services/payment/gateway.ts`
    - 实现 `createOrder(request): Promise<Order>` 订单创建（30分钟有效期）
    - 实现 `processPayment(orderId): Promise<PaymentResult>` 支付处理
    - 实现 `refund(orderId, reason): Promise<RefundResult>` 退款处理
    - 实现 `generateInvoice(orderId, format): Promise<Invoice>` 发票生成（CN_VAT/TH_TAX）
    - 使用 Redis 分布式锁防止重复支付
    - _需求：16.4, 16.5, 16.6, 16.7_

  - [x] 8.8 集成支付渠道 SDK
    - 集成微信支付 SDK 和支付回调处理
    - 集成支付宝 SDK 和支付回调处理
    - 集成 Stripe SDK（国际信用卡）和 webhook 处理
    - 集成 PromptPay 支付
    - 实现支付回调统一处理逻辑（`src/app/api/payment/callback/route.ts`）
    - 支付数据加密传输和存储
    - _需求：16.1, 16.2, 16.3, 16.8_

  - [ ]* 8.9 编写支付订单属性测试
    - **属性 29：支付订单记录完整性** — 验证已完成支付包含 orderNumber/transactionId/amount/paidAt/productType
    - **验证需求：16.4**

  - [ ]* 8.10 编写发票格式属性测试
    - **属性 30：发票格式正确性** — 验证 CN_VAT 和 TH_TAX 格式正确且与订单信息一致
    - **验证需求：16.5**

  - [ ]* 8.11 编写订单有效期属性测试
    - **属性 31：待支付订单30分钟有效期** — 验证 PENDING 订单 expiresAt 为创建时间+30分钟，过期后变为 EXPIRED
    - **验证需求：16.7**

  - [ ]* 8.12 编写支付单元测试
    - 测试各支付渠道集成配置
    - 测试支付回调处理
    - 测试订阅到期续费通知触发
    - _需求：16.1, 16.2, 16.3, 15.7_

- [x] 9. 检查点 - 订阅与支付系统验证
  - 确保所有测试通过，如有问题请向用户确认。


- [x] 10. 会话管理系统
  - [x] 10.1 实现会话管理器（Session_Manager）
    - 创建 `src/server/services/session/manager.ts`
    - 实现 `save(session): Promise<void>` 自动保存咨询会话和消息
    - 实现 `search(userId, filters): Promise<ConsultationSession[]>` 历史搜索（支持日期范围、关键词、法律领域过滤）
    - 实现 `exportPDF(sessionId): Promise<Buffer>` 会话导出 PDF
    - 实现 `bookmark(sessionId): Promise<void>` 和取消收藏
    - 实现 `resume(sessionId): Promise<ConsultationContext>` 会话恢复（加载完整上下文）
    - 使用 Redis 缓存活跃会话上下文（TTL: 24h）
    - _需求：17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [ ]* 10.2 编写会话自动保存属性测试
    - **属性 32：咨询会话自动保存往返一致性** — 验证消息持久化后查询返回完整对话记录
    - **验证需求：17.1**

  - [ ]* 10.3 编写历史搜索过滤属性测试
    - **属性 33：历史咨询搜索过滤准确性** — 验证返回结果满足所有过滤条件
    - **验证需求：17.2**

  - [ ]* 10.4 编写收藏操作属性测试
    - **属性 34：收藏操作往返一致性** — 验证收藏后列表包含该会话，取消后不包含
    - **验证需求：17.4**

  - [ ]* 10.5 编写会话恢复属性测试
    - **属性 35：会话恢复上下文完整性** — 验证恢复时加载所有历史消息
    - **验证需求：17.5**

  - [ ]* 10.6 编写会话单元测试
    - 测试 PDF 导出功能
    - 测试网络中断后会话恢复
    - _需求：17.3, 17.6_

- [x] 11. tRPC 路由层整合
  - [x] 11.1 创建 tRPC 路由器并整合所有服务
    - 创建 `src/server/trpc/router.ts` 主路由器
    - 实现 `auth.*` 路由（注册、登录、登出、密码重置）
    - 实现 `consultation.*` 路由（提交咨询、获取结果，支持流式响应）
    - 实现 `contract.*` 路由（起草、审查、上传审查）
    - 实现 `case.*` 路由（案件分析、策略生成）
    - 实现 `evidence.*` 路由（证据清单、评估、缺口识别）
    - 实现 `caseSearch.*` 路由（案例检索、趋势分析）
    - 实现 `visa.*` 路由（签证推荐、续签、转换）
    - 实现 `report.*` 路由（报告生成、PDF 导出）
    - 实现 `subscription.*` 路由（计划列表、订阅、额度检查）
    - 实现 `payment.*` 路由（创建订单、回调、退款）
    - 实现 `session.*` 路由（保存、搜索、导出、收藏、恢复）
    - 实现 `user.*` 路由（资料管理）
    - 实现 `admin.*` 路由（用户管理、内容管理）
    - 在每个路由中应用适当的权限中间件
    - _需求：全局_

  - [x] 11.2 实现咨询核心流程编排
    - 创建 `src/server/services/consultation/orchestrator.ts`
    - 编排完整咨询流程：管辖权识别 → IRAC 分析 → 报告生成
    - 集成额度检查中间件
    - 实现流式响应输出
    - _需求：1.1, 2.1, 3.1, 12.1_


- [x] 12. 检查点 - 后端服务完整性验证
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 13. 安全模块与合规
  - [x] 13.1 实现数据加密与安全中间件
    - 配置 TLS 1.2+ 传输加密（Nginx/ALB 层）
    - 实现敏感数据字段加密工具（AES-256）
    - 实现文件上传安全验证（MIME 类型白名单：PDF/Word/图片，大小限制 20MB）
    - 集成 ClamAV 病毒扫描服务
    - 实现文件扫描状态更新逻辑（PENDING → CLEAN/INFECTED/ERROR）
    - 实现感染文件隔离和下载阻止
    - _需求：19.1, 19.6, 18.4_

  - [ ]* 13.2 编写文件上传验证属性测试
    - **属性 37：文件上传类型和大小验证** — 验证超过20MB被拒绝，非白名单MIME类型被拒绝
    - **验证需求：18.4**

  - [ ]* 13.3 编写文件安全扫描属性测试
    - **属性 39：文件安全扫描状态更新** — 验证 scanStatus 从 PENDING 更新为终态，INFECTED 文件不可下载
    - **验证需求：19.6**

  - [x] 13.4 实现审计日志系统
    - 创建审计日志中间件，自动记录关键操作（LOGIN、DATA_ACCESS、DATA_EXPORT、DATA_DELETE）
    - 记录 userId、action、ipAddress、userAgent、createdAt
    - 实现日志保留策略（12个月）
    - _需求：19.7_

  - [ ]* 13.5 编写审计日志属性测试
    - **属性 40：关键操作审计日志记录** — 验证关键操作创建包含完整字段的 AuditLog 记录
    - **验证需求：19.7**

  - [x] 13.6 实现异常登录检测
    - 基于 Redis 记录用户最近登录 IP
    - 实现 IP 变化 + 多次失败登录的异常检测逻辑
    - 触发安全警报通知用户
    - _需求：19.8_

  - [ ]* 13.7 编写异常登录检测属性测试
    - **属性 41：异常登录检测** — 验证 IP 变化且近期多次失败时触发安全警报
    - **验证需求：19.8**

  - [x] 13.8 实现数据保留与删除策略
    - 实现用户注销后软删除（设置 deletedAt）
    - 实现90天后数据标记为待删除的定时任务逻辑
    - 实现个人数据导出功能
    - 实现账户和数据不可恢复删除功能
    - _需求：19.2, 19.3, 19.4, 19.5_

  - [ ]* 13.9 编写数据删除属性测试
    - **属性 38：已注销用户数据90天删除** — 验证注销后90天内数据被标记为待删除
    - **验证需求：19.3**

  - [x] 13.10 实现 API 限流
    - 基于 Redis 实现 API 限流中间件
    - 按用户角色配置不同限流策略
    - _需求：19.1_

- [x] 14. 检查点 - 安全模块验证
  - 确保所有测试通过，如有问题请向用户确认。


- [ ] 15. 前端界面实现
  - [x] 15.1 实现全局布局和导航组件
    - 创建 `src/app/[locale]/layout.tsx` 全局布局（Ant Design ConfigProvider + next-intl Provider）
    - 实现响应式导航栏（桌面端/平板端/移动端适配）
    - 实现页脚组件
    - 实现用户头像/登录状态组件
    - 实现语言切换器集成到导航栏
    - _需求：18.1, 18.2_

  - [ ]* 15.2 编写多语言翻译属性测试
    - **属性 36：多语言翻译完整性** — 验证每个 UI 翻译键同时存在 zh/th/en 三种语言文本
    - **验证需求：18.2**

  - [x] 15.3 实现认证页面
    - 创建登录页面（邮箱密码、手机验证码、微信扫码、Line 登录）
    - 创建注册页面（邮箱注册、手机注册）
    - 创建密码重置页面
    - 创建用户资料编辑页面（个人信息 + 企业信息）
    - _需求：14.1, 14.3, 14.4, 14.5, 14.6_

  - [x] 15.4 实现咨询聊天界面
    - 创建聊天对话界面组件（消息气泡、文本输入框、发送按钮）
    - 实现历史消息滚动加载
    - 实现流式响应实时显示（SSE 接收 + 逐字渲染）
    - 实现处理状态指示器（输入中动画、加载进度提示）
    - 实现 IRAC 分析结果结构化展示
    - 实现风险警示和免责声明的醒目展示样式
    - _需求：18.3, 18.5_

  - [x] 15.5 实现文件上传组件
    - 创建文件上传组件（支持 PDF、Word、图片，限制 20MB）
    - 实现上传进度显示
    - 实现上传成功确认（文件名、大小、状态）
    - 实现上传失败错误提示和重新上传入口
    - _需求：18.4, 18.6, 18.7_

  - [x] 15.6 实现咨询历史和会话管理页面
    - 创建历史咨询列表页面（支持搜索、日期过滤、法律领域过滤）
    - 实现收藏列表快速访问入口
    - 实现会话详情查看和继续咨询功能
    - 实现 PDF 导出按钮
    - _需求：17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 15.7 实现订阅和支付页面
    - 创建订阅计划展示页面（FREE/STANDARD/VIP 对比）
    - 创建支付页面（支持微信/支付宝/PromptPay/Stripe 选择）
    - 实现支付状态轮询和结果展示
    - 创建订单历史页面
    - 创建发票申请页面
    - _需求：15.1, 15.2, 15.3, 15.4, 16.1, 16.2, 16.3, 16.5_

  - [x] 15.8 实现合同服务页面
    - 创建合同起草表单页面（合同类型选择、当事人信息、关键条款输入）
    - 创建合同审查页面（文本粘贴/文件上传 + 审查结果展示）
    - 实现风险标注可视化（高/中/低风险颜色标注）
    - _需求：4.1, 5.1_

  - [x] 15.9 实现案件分析和证据页面
    - 创建案件信息提交表单
    - 创建案件分析结果展示页面（时间线、争议焦点、三视角策略）
    - 创建证据清单展示和评估结果页面
    - _需求：6.1, 7.1, 8.1_

  - [x] 15.10 实现签证咨询页面
    - 创建签证咨询表单（用户情况输入）
    - 创建签证推荐结果展示页面
    - _需求：10.1_

  - [x] 15.11 实现管理后台页面
    - 创建管理后台布局
    - 实现用户管理页面（列表、搜索、角色修改）
    - 实现内容管理页面（博客文章、用户评价审核）
    - 实现订单管理页面
    - _需求：14.7_

- [x] 16. 检查点 - 前端界面验证
  - 确保所有测试通过，如有问题请向用户确认。


- [ ] 17. SEO 与营销功能
  - [x] 17.1 实现 SEO 落地页和博客系统
    - 创建核心法律主题 SEO 落地页（中泰公司注册、泰国签证咨询、跨境合同纠纷等）
    - 使用 Next.js SSG 生成静态落地页
    - 实现博客/知识库模块（文章发布、管理、多语言支持）
    - 实现结构化数据标记（JSON-LD）
    - 实现 `<title>`、`<meta description>`、`<meta keywords>` 自动生成
    - _需求：20.1, 20.2_

  - [ ]* 17.2 编写 SEO 落地页属性测试
    - **属性 42：SEO 落地页结构完整性** — 验证每个落地页包含非空 title/meta description/keywords
    - **验证需求：20.1**

  - [ ]* 17.3 编写博客结构化数据属性测试
    - **属性 43：博客文章结构化数据** — 验证已发布文章包含 JSON-LD 结构化数据
    - **验证需求：20.2**

  - [x] 17.4 实现用户评价和推荐计划
    - 创建用户评价展示页面（管理员审核后发布）
    - 实现推荐计划功能（生成唯一推荐码、URL 参数追踪）
    - 实现推荐奖励发放逻辑（被推荐用户注册后双方获得额度奖励）
    - _需求：20.3, 20.4_

  - [ ]* 17.5 编写推荐计划奖励属性测试
    - **属性 44：推荐计划奖励发放** — 验证被推荐用户注册后双方获得咨询额度奖励
    - **验证需求：20.4**

  - [x] 17.6 实现 Sitemap 和邮件营销
    - 实现 `sitemap.xml` 自动生成和更新（新文章发布时自动包含）
    - 实现 `robots.txt` 配置
    - 集成 Amazon SES 邮件营销服务
    - 实现模板化邮件发送（法律资讯通讯、促销活动）
    - _需求：20.5, 20.6_

  - [ ]* 17.7 编写 Sitemap 更新属性测试
    - **属性 45：Sitemap 自动更新** — 验证新发布文章的 URL 出现在 sitemap.xml 中
    - **验证需求：20.6**

  - [ ]* 17.8 编写 SEO 单元测试
    - 测试邮件营销集成
    - 测试页面加载性能（3秒以内）
    - _需求：20.5, 20.7_

- [x] 18. 检查点 - SEO 与营销功能验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 19. RAG 检索增强生成知识系统
  - [x] 19.1 实现 pgvector 向量存储与嵌入服务
    - 创建 `src/server/services/rag/embedding.ts`，封装 OpenAI Embeddings API（text-embedding-3-small，1536 维度）
    - 创建 `src/server/services/rag/vector-store.ts`，封装 pgvector 操作（余弦相似度搜索、IVFFlat 索引）
    - 实现 `generateEmbedding(text: string): Promise<number[]>` 文本向量化接口
    - 实现 `similaritySearch(embedding: number[], namespace: string, topK: number): Promise<RetrievedDocument[]>` 向量检索接口
    - 配置 pgvector 扩展和索引（`CREATE EXTENSION vector; CREATE INDEX USING ivfflat`）
    - _需求：24.1_

  - [x] 19.2 实现文档分块与知识库管理
    - 创建 `src/server/services/rag/chunker.ts`，实现法律文档分块逻辑（按法条/条款级别分块，每块 500-1000 tokens）
    - 创建 `src/server/services/rag/knowledge-base.ts`，实现知识库 CRUD 管理
    - 实现 `indexDocument(document: KnowledgeBaseUpdate): Promise<void>` 文档索引接口（分块 → 嵌入 → 写入 pgvector）
    - 实现 `updateDocument(documentId, update): Promise<void>` 文档更新接口（重新分块和嵌入）
    - 实现 `reindexAll(): Promise<void>` 全量重建索引接口
    - 创建种子脚本导入中国核心法律（民法典、刑法、公司法、劳动法等）和泰国核心法律（民商法典、刑法典、外国人经商法等）
    - _需求：24.2, 24.3, 24.4, 24.5_

  - [x] 19.3 实现 RAG 检索管线与置信度评分
    - 创建 `src/server/services/rag/pipeline.ts`，实现完整 RAG 管线
    - 实现 `query(request: RAGQuery): Promise<RAGResult>` 接口：用户查询 → 嵌入 → pgvector 搜索 → Top-K 结果 → LLM 生成（上下文包含检索结果）
    - 实现法条引用格式化（法律名称 + 条款编号 + 关键条文内容摘要）
    - 实现 `getConfidenceScore(citation): Promise<number>` 置信度评分（LLM 自评估，Prompt 要求对引用准确性打分 0-100）
    - 实现低置信度标注逻辑（< 70 分标注 `needsVerification: true`，附加"建议人工核实"提示）
    - 实现 RAG 降级策略：pgvector 超时或 Embeddings API 不可用时，降级为无 RAG 的 LLM 直接回复并标注"未经知识库验证"
    - _需求：24.1, 24.6, 24.7_

  - [ ]* 19.4 编写 RAG 检索法条引用属性测试
    - **属性 62：RAG 检索结果包含法条引用** — 验证法律分析查询返回至少一条 citation，每条包含非空 lawName/articleNumber/contentSummary
    - **验证需求：24.1, 24.6**

  - [ ]* 19.5 编写法条引用置信度属性测试
    - **属性 63：法条引用置信度评分与标注** — 验证 confidenceScore 在 0-100 范围内，< 70 时 needsVerification 为 true
    - **验证需求：24.7**

  - [ ]* 19.6 编写 RAG 单元测试
    - 测试中国法律知识库数据完整性（民法典、刑法、公司法等核心法律已索引）
    - 测试泰国法律知识库数据完整性（民商法典、刑法典、外国人经商法等已索引）
    - 测试双边条约知识库数据完整性（投资保护协定、避免双重征税协定等已索引）
    - 测试文档分块逻辑（验证分块大小在 500-1000 tokens 范围内）
    - _需求：24.2, 24.3, 24.4_

- [x] 20. 检查点 - RAG 知识系统验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 21. AI 智能对话引擎
  - [x] 21.1 实现意图分类器与语言检测
    - 创建 `src/server/services/ai/conversation/intent-classifier.ts`
    - 实现 `classifyIntent(text: string): Promise<IntentClassification>` 接口
    - 编写意图分类 System Prompt（包含 LegalDomain 枚举定义：CORPORATE/CONTRACT/CRIMINAL/CIVIL/VISA/TAX/IP/LABOR/TRADE）
    - 实现多领域输入时 secondaryIntents 识别逻辑
    - 实现 `routingTarget` 映射（意图 → 对应分析模块名称）
    - 创建 `src/server/services/ai/conversation/language-detector.ts`
    - 实现 `detectLanguage(text: string): Promise<'zh' | 'th' | 'en'>` 语言检测接口（通过 LLM Prompt 分析输入文本语言特征）
    - _需求：21.2, 21.7, 28.6_

  - [ ]* 21.2 编写意图分类属性测试
    - **属性 47：意图分类与智能路由完整性** — 验证 primaryIntent 为有效 LegalDomain 枚举值，routingTarget 非空，多领域输入时 secondaryIntents 包含所有附加领域
    - **验证需求：21.2, 28.6**

  - [ ]* 21.3 编写语言检测属性测试
    - **属性 51：语言检测与回复语言一致性** — 验证检测到的语言与输入文本实际语言一致，回复 detectedLanguage 与输入语言匹配
    - **验证需求：21.7**

  - [x] 21.4 实现多轮对话上下文管理
    - 创建 `src/server/services/ai/conversation/context-manager.ts`
    - 实现 `getContext(sessionId: string): Promise<ConversationContext>` 上下文获取（优先 Redis 缓存，回退 DB）
    - 实现 `updateContext(sessionId, message): Promise<void>` 上下文更新（同步写入 Redis + DB）
    - 实现对话上下文窗口管理（保留最近 N 轮对话 + 关键事实摘要）
    - Redis 缓存策略：`conversation:{sessionId}:context` TTL 24h
    - _需求：21.1_

  - [ ]* 21.5 编写对话上下文记忆属性测试
    - **属性 46：对话上下文记忆往返一致性** — 验证第 N 轮提及的事实信息在第 N+M 轮通过 getContext 获取的上下文中仍然存在
    - **验证需求：21.1**

  - [x] 21.6 实现追问生成与主题切换
    - 创建 `src/server/services/ai/conversation/clarifier.ts`
    - 实现 `generateClarifyingQuestions(context: ConversationContext): Promise<string[]>` 追问生成接口
    - 编写追问生成 Prompt（分析当前上下文中缺失的关键信息：时间、地点、金额、当事人关系等）
    - 创建 `src/server/services/ai/conversation/topic-manager.ts`
    - 实现 `switchTopic(sessionId, newTopic): Promise<TopicBranch>` 主题切换接口
    - 实现主题切换检测逻辑（LLM 比较当前消息与历史上下文的语义相关性）
    - 实现主题分支独立上下文存储（`conversation:{sessionId}:topics` Redis 键）
    - 实现原主题上下文保留和恢复功能
    - _需求：21.3, 21.4_

  - [ ]* 21.7 编写不完整输入追问属性测试
    - **属性 48：不完整输入触发追问** — 验证缺少关键事实信息的咨询输入时，生成至少一条针对性追问问题
    - **验证需求：21.3**

  - [ ]* 21.8 编写主题切换上下文隔离属性测试
    - **属性 49：主题切换上下文隔离** — 验证切换后新主题拥有独立分析上下文，原主题上下文完整保留且可恢复
    - **验证需求：21.4**

  - [x] 21.9 实现 AI 对话引擎核心处理器
    - 创建 `src/server/services/ai/conversation/engine.ts`
    - 实现 `processMessage(sessionId, userMessage): Promise<ConversationResponse>` 核心处理接口
    - 编排完整对话流程：语言检测 → 意图分类 → 上下文加载 → RAG 检索 → LLM 生成 → 追问建议 → 上下文更新
    - 实现回复结构化输出（summary + analysis + nextSteps）
    - 实现 followUpSuggestions 后续问题建议生成
    - 实现情绪检测逻辑（LLM Prompt 分析用户文本情绪倾向，焦虑/紧迫时采用安抚性语气）
    - 实现流式响应输出（SSE）
    - _需求：21.1, 21.5, 21.6, 21.8_

  - [ ]* 21.10 编写 AI 回复结构完整性属性测试
    - **属性 50：AI 回复结构完整性与后续建议** — 验证回复包含非空 structure.summary/analysis/nextSteps，followUpSuggestions 至少一条
    - **验证需求：21.6, 21.8**

  - [ ]* 21.11 编写对话引擎单元测试
    - 测试情绪化输入的安抚性回复验证
    - 测试多轮对话上下文连贯性
    - _需求：21.5_

- [x] 22. 检查点 - AI 对话引擎验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 23. AI 律师助理
  - [x] 23.1 实现智能文书起草与模板系统
    - 创建 `src/server/services/ai/paralegal/document-drafter.ts`
    - 实现 `draftDocument(request: DocumentDraftRequest): Promise<string>` 文书起草接口
    - 编写文书起草 System Prompt（包含起诉状/答辩状/上诉状/律师函/法律意见书/尽职调查报告的格式规范和法域要求）
    - 创建 `src/server/services/ai/paralegal/template-engine.ts`
    - 实现 `fillTemplate(templateId, userInput): Promise<string>` 模板填充接口
    - 实现 AI 从用户输入中提取变量值（LLM 结构化输出），填入模板占位符
    - 创建模板种子数据（各类文书模板 + 变量定义）
    - _需求：22.1, 22.2_

  - [ ]* 23.2 编写智能模板填充属性测试
    - **属性 52：智能模板变量填充完整性** — 验证填充后文书中所有 required 变量被替换为非空值，不残留未填充占位符
    - **验证需求：22.2**

  - [x] 23.3 实现案件时间线生成与 OCR 文档分析
    - 创建 `src/server/services/ai/paralegal/timeline-generator.ts`
    - 实现 `generateTimeline(caseDescription: string): Promise<TimelineNode[]>` 时间线生成接口
    - 编写时间线提取 Prompt（从案件描述中提取日期和事件，按时间排序，标注法律意义）
    - 创建 `src/server/services/ai/paralegal/ocr-analyzer.ts`
    - 实现 `analyzeOCRDocument(fileKey: string): Promise<OCRAnalysisResult>` OCR + NLP 分析接口
    - 集成 AWS Textract API 进行文字识别
    - 实现 LLM NLP 分析管线（提取 keyFacts、parties、amounts、legalReferences）
    - _需求：22.3, 22.4_

  - [ ]* 23.4 编写案件时间线属性测试
    - **属性 53：案件时间线有序性与标注完整性** — 验证 TimelineNode 按日期升序排列，每个节点包含非空 date/description/legalSignificance
    - **验证需求：22.3**

  - [ ]* 23.5 编写 OCR + NLP 分析属性测试
    - **属性 54：OCR + NLP 分析结果结构完整性** — 验证 extractedText 非空，keyFacts 数组长度 > 0
    - **验证需求：22.4**

  - [x] 23.6 实现证据清单生成与诉讼时效计算
    - 创建 `src/server/services/ai/paralegal/evidence-checklist.ts`
    - 实现 `generateEvidenceChecklist(caseAnalysis: CaseAnalysisResult): Promise<EvidenceChecklistItem[]>` 证据清单生成接口
    - 编写证据清单 Prompt（标注优先级 ESSENTIAL/IMPORTANT/SUPPLEMENTARY、证据类型、获取建议）
    - 创建 `src/server/services/ai/paralegal/statute-calculator.ts`
    - 实现 `calculateStatuteOfLimitations(caseType, keyDates): Promise<StatuteOfLimitations>` 诉讼时效计算接口
    - 实现纯规则引擎（基于案件类型和法域的时效规则表，不依赖 AI）
    - 实现提醒日期计算（到期前 30 天、7 天、1 天）
    - _需求：22.5, 22.6_

  - [ ]* 23.7 编写证据清单优先级属性测试
    - **属性 55：证据清单优先级有效性** — 验证每项 EvidenceChecklistItem 包含有效 priority/evidenceType/collectionSuggestion
    - **验证需求：22.5**

  - [ ]* 23.8 编写诉讼时效计算属性测试
    - **属性 56：诉讼时效计算确定性** — 验证相同输入返回相同 expiryDate，reminderDates 包含 30天/7天/1天前提醒
    - **验证需求：22.6**

  - [x] 23.9 实现案件强度评分
    - 创建 `src/server/services/ai/paralegal/case-scorer.ts`
    - 实现 `scoreCaseStrength(caseInfo: CaseSubmission): Promise<CaseStrengthScore>` 案件强度评分接口
    - 编写案件评分 Prompt（LLM 结构化 JSON 输出，按四维度评分：evidenceSufficiency/legalBasisStrength/similarCaseTrends/proceduralCompliance）
    - 实现 overall 综合评分计算和评分说明报告生成
    - _需求：22.7_

  - [ ]* 23.10 编写案件强度评分属性测试
    - **属性 57：案件强度评分范围与维度完整性** — 验证 overall 在 0-100 范围内，四维度评分均在 0-100 范围内，report 非空
    - **验证需求：22.7**

  - [ ]* 23.11 编写律师助理单元测试
    - 测试六种文书类型（起诉状/答辩状/上诉状/律师函/法律意见书/尽职调查报告）的起草流程
    - 测试 OCR 识别失败时的降级处理（提示用户上传更清晰图片）
    - _需求：22.1, 22.4_

- [ ] 24. 检查点 - AI 律师助理验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 25. AI 律师团模拟系统
  - [x] 25.1 实现律师角色配置与 System Prompt
    - 创建 `src/server/services/ai/lawyer-team/roles.ts`
    - 定义四个 AI 律师角色的 LawyerAgent 配置：
      - 原告律师（PLAINTIFF_LAWYER）：侧重证据攻击力和损害赔偿论证的 System Prompt
      - 被告律师（DEFENDANT_LAWYER）：侧重程序瑕疵、证据缺陷和对方论证逻辑漏洞的 System Prompt
      - 法官（JUDGE）：侧重法律条文适用和裁判一致性的 System Prompt
      - 法律顾问（LEGAL_ADVISOR）：侧重成本效益和替代方案的 System Prompt
    - 将角色 Prompt 模板存入 PromptTemplate 表
    - _需求：23.1, 23.2_

  - [x] 25.2 实现多轮辩论引擎
    - 创建 `src/server/services/ai/lawyer-team/debate-engine.ts`
    - 实现 `startDebate(caseInfo: CaseSubmission, rounds: number): Promise<DebateRound[]>` 辩论启动接口
    - 实现顺序 LLM 调用逻辑：每个角色的输入包含前一个角色的输出
    - 实现辩论轮次管理：第一轮各角色独立论述，第二轮起每个角色必须包含对前一轮其他角色论点的 rebuttal
    - 实现单轮辩论超时 30 秒、总辩论超时 120 秒的控制逻辑
    - 实现 `updateWithNewFacts(debateId, newFacts): Promise<DebateRound[]>` 新事实更新接口
    - _需求：23.3, 23.6, 23.7_

  - [ ]* 25.3 编写律师团辩论顺序性属性测试
    - **属性 58：律师团辩论顺序性与引用性** — 验证每轮 DebateRound 包含所有角色论点，第二轮起每个角色包含 rebuttal 引用
    - **验证需求：23.3**

  - [ ]* 25.4 编写新事实更新属性测试
    - **属性 61：新事实更新触发策略变化** — 验证提供新事实后，更新后的辩论结果与原始结果不同
    - **验证需求：23.7**

  - [x] 25.5 实现共识报告生成与角色咨询
    - 创建 `src/server/services/ai/lawyer-team/consensus.ts`
    - 实现 `generateConsensusReport(debateRounds: DebateRound[]): Promise<ConsensusReport>` 共识报告生成接口
    - 编写共识报告 Prompt（输入为所有辩论轮次完整记录，输出包含 roleViewpoints/multiAngleAnalysis/consensusConclusions/disagreementPoints/unifiedStrategy）
    - 实现 `consultRole(role: LawyerRole, caseInfo: CaseSubmission): Promise<string>` 单角色深度咨询接口
    - _需求：23.4, 23.5_

  - [ ]* 25.6 编写共识报告完整性属性测试
    - **属性 59：律师团共识报告完整性** — 验证所有角色 roleViewpoints 的 coreArguments 非空，multiAngleAnalysis/consensusConclusions/unifiedStrategy 非空
    - **验证需求：23.4**

  - [ ]* 25.7 编写角色专属分析属性测试
    - **属性 60：角色专属分析视角一致性** — 验证指定角色的咨询返回使用该角色 System Prompt 生成的分析
    - **验证需求：23.5**

  - [ ]* 25.8 编写律师团单元测试
    - 测试四个 AI 律师角色配置完整性
    - 测试辩论超时处理（返回已完成轮次并标注"辩论因时间限制提前结束"）
    - _需求：23.1, 23.3_

- [ ] 26. 检查点 - AI 律师团验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 27. AI 风险评估系统
  - [x] 27.1 实现多维度风险评估与热力图
    - 创建 `src/server/services/ai/risk/assessor.ts`
    - 实现 `assess(request: RiskAssessmentRequest): Promise<RiskAssessmentResult>` 风险评估接口
    - 编写风险评分 Prompt（LLM 结构化 JSON 输出，包含四维度评分标准：legal/financial/compliance/reputation，每维度 0-100）
    - 实现 overallLevel 综合等级计算逻辑（所有维度 < 30 → LOW，任一维度 > 80 → 至少 HIGH）
    - 实现 `heatMapData` 热力图数据提取（从风险评分结果中提取各维度子类别评分）
    - 将评估结果持久化到 RiskAssessment 表
    - _需求：25.1, 25.2_

  - [ ]* 27.2 编写风险评估四维度属性测试
    - **属性 64：风险评估四维度完整性与等级一致性** — 验证四维度评分均在 0-100 范围内，overallLevel 与评分综合结果一致
    - **验证需求：25.1, 25.2**

  - [x] 27.3 实现场景模拟与结果预测
    - 创建 `src/server/services/ai/risk/simulator.ts`
    - 实现 `simulateScenario(baseAssessment, modifiedParams): Promise<ScenarioSimulation>` 场景模拟接口
    - 实现修改参数后重新调用 LLM 分析，对比基线和模拟结果差异
    - 创建 `src/server/services/ai/risk/predictor.ts`
    - 实现 `predictOutcome(caseInfo): Promise<OutcomePrediction>` 案件结果预测接口
    - 编写结果预测 Prompt（LLM 分析 + RAG 检索类似案例统计数据，输出 winProbability/loseProbability/settleProbability）
    - 实现概率归一化逻辑（三个概率之和 = 1.0，允许 ±0.01 浮点误差）
    - _需求：25.3, 25.4_

  - [ ]* 27.4 编写场景模拟属性测试
    - **属性 65：场景模拟参数变化导致结果变化** — 验证 simulatedAssessment 与 baselineAssessment 至少一个维度存在差异，impactAnalysis 非空
    - **验证需求：25.3**

  - [ ]* 27.5 编写案件结果概率属性测试
    - **属性 66：案件结果概率分布归一化** — 验证 winProbability + loseProbability + settleProbability = 1.0（±0.01），每个概率在 [0, 1] 范围内
    - **验证需求：25.4**

  - [x] 27.6 实现成本效益分析与风险趋势追踪
    - 创建 `src/server/services/ai/risk/cost-benefit.ts`
    - 实现 `analyzeCostBenefit(caseInfo): Promise<CostBenefitAnalysis>` 成本效益分析接口
    - 编写成本效益 Prompt（LLM 结构化输出，基于案件类型和法域的费用参考数据，输出 litigation/settlement/mediation 三种路径分析）
    - 创建 `src/server/services/ai/risk/trend-tracker.ts`
    - 实现 `trackRiskTrend(enterpriseId): Promise<RiskTrendReport>` 企业风险趋势追踪接口
    - 从 RiskAssessment 表聚合历史数据，生成趋势报告
    - 实现风险等级显著变化时的预警通知逻辑
    - _需求：25.5, 25.6_

  - [ ]* 27.7 编写成本效益三路径属性测试
    - **属性 67：成本效益三路径完整性** — 验证同时包含 litigation/settlement/mediation 三种路径，每种包含非空 cost/time/probability/potentialOutcome
    - **验证需求：25.5**

- [ ] 28. 增强合同分析
  - [x] 28.1 实现逐条风险评分与缺失条款检测
    - 创建 `src/server/services/ai/contract/enhanced-analyzer.ts`
    - 实现 `scoreClauseRisks(contractText, jurisdiction): Promise<ClauseRiskScore[]>` 逐条评分接口
    - 编写逐条评分 Prompt（LLM 逐条分析 + 结构化 JSON 输出，四维度：legalCompliance/fairness/enforceability/completeness，每维度 0-100）
    - 实现 `detectMissingClauses(contractText, contractType): Promise<MissingClause[]>` 缺失条款检测接口
    - 编写缺失条款 Prompt（LLM 对比合同内容与标准条款清单：违约责任/不可抗力/争议解决/保密/知识产权归属等）
    - _需求：26.1, 26.2_

  - [ ]* 28.2 编写逐条风险评分属性测试
    - **属性 68：逐条合同风险评分范围有效性** — 验证四维度评分和 overallScore 均在 0-100 范围内
    - **验证需求：26.1**

  - [ ]* 28.3 编写缺失条款检测属性测试
    - **属性 69：缺失条款检测与推荐文本完整性** — 验证每个 MissingClause 包含有效 importance 和非空 recommendedText
    - **验证需求：26.2**

  - [x] 28.4 实现不公平条款识别与法律交叉验证
    - 实现 `detectUnfairTerms(contractText): Promise<UnfairTerm[]>` 不公平条款识别接口
    - 编写不公平条款 Prompt（LLM 分析条款权利义务对称性，标注 MINOR/MODERATE/SEVERE）
    - 实现 `crossReferenceWithLaw(contractText, jurisdiction): Promise<LawCrossReference[]>` 法律交叉验证接口
    - 集成 RAG 检索相关强制性法规 + LLM 比对分析
    - _需求：26.3, 26.4_

  - [ ]* 28.5 编写不公平条款标注属性测试
    - **属性 70：不公平条款标注完整性** — 验证每个 UnfairTerm 包含有效 unfairnessLevel/explanation/balancedAlternative
    - **验证需求：26.3**

  - [x] 28.6 实现合同对比与谈判建议
    - 实现 `compareContracts(version1, version2): Promise<ContractComparison>` 合同对比接口
    - 实现文本 diff 算法 + LLM 分析法律影响
    - 实现 `getNegotiationAdvice(contractText, clientSide): Promise<NegotiationAdvice[]>` 谈判建议接口
    - 编写谈判建议 Prompt（基于合同条款和法律背景生成策略：建议立场/可接受让步/底线条款）
    - _需求：26.5, 26.7_

  - [ ]* 28.7 编写合同对比变更属性测试
    - **属性 71：合同对比变更完整性** — 验证每个 ClauseChange 包含有效 changeType/legalImpact/riskChange
    - **验证需求：26.5**

  - [ ]* 28.8 编写增强合同分析单元测试
    - 测试行业合同模板库可用性（房地产租赁/国际贸易/技术服务/劳动雇佣/股权投资）
    - _需求：26.6_

- [ ] 29. 检查点 - 风险评估与增强合同分析验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 30. AI 法律文书生成器
  - [x] 30.1 实现多类型文书生成引擎
    - 创建 `src/server/services/ai/document/generator.ts`
    - 实现 `generate(request: DocumentGenerationRequest): Promise<string>` 文书生成接口
    - 支持 10+ 文书类型：COMPLAINT/DEFENSE/APPEAL/LAWYER_LETTER/LEGAL_OPINION/DUE_DILIGENCE/SHAREHOLDER_AGREEMENT/ARTICLES_OF_ASSOCIATION/NDA/EMPLOYMENT_CONTRACT
    - 编写各类文书的结构化 Prompt（包含文书格式规范 + 法域要求 + 模板系统）
    - 实现当事人信息和案件事实自动填充，确保不残留模板占位符
    - 将生成的文书存入 GeneratedDocument 表
    - _需求：27.1, 27.2_

  - [ ]* 30.2 编写文书模板填充属性测试
    - **属性 72：法律文书模板填充内容完整性** — 验证生成文书包含所有用户提供的当事人信息和案件事实，不含未填充占位符
    - **验证需求：27.2**

  - [x] 30.3 实现 Word/PDF 导出与版本管理
    - 创建 `src/server/services/ai/document/exporter.ts`
    - 实现 `exportWord(documentId): Promise<Buffer>` Word 导出接口（使用 docx 库生成 .docx）
    - 实现 `exportPDF(documentId): Promise<Buffer>` PDF 导出接口（使用 Puppeteer 渲染 HTML 模板为 PDF）
    - 创建 `src/server/services/ai/document/version-manager.ts`
    - 实现 `getVersionHistory(documentId): Promise<DocumentVersion[]>` 版本历史查询
    - 实现 `restoreVersion(documentId, versionId): Promise<string>` 版本恢复
    - 每次修改自动创建新版本记录存入 DocumentVersion 表
    - _需求：27.3, 27.4_

  - [ ]* 30.4 编写文书版本历史属性测试
    - **属性 73：文书版本历史往返一致性** — 验证创建新版本后 getVersionHistory 包含该版本，restoreVersion 恢复后内容与原始一致
    - **验证需求：27.4**

  - [x] 30.5 实现术语一致性检查与法域合规性检查
    - 创建 `src/server/services/ai/document/quality-checker.ts`
    - 实现 `checkTerminologyConsistency(content): Promise<TerminologyCheck>` 术语一致性检查接口
    - 编写术语检查 Prompt（LLM 扫描文书中的法律术语，检测同义不同表述）
    - 实现 `checkJurisdictionCompliance(content, jurisdiction): Promise<JurisdictionComplianceCheck>` 法域合规性检查接口
    - 集成 RAG 检索目标法域的程序规定 + LLM 比对分析
    - 实现不合规项标注（section/issue/requirement/suggestion）
    - _需求：27.5, 27.6, 27.7_

  - [ ]* 30.6 编写术语一致性属性测试
    - **属性 74：文书术语一致性检查** — 验证每个 inconsistency 包含至少两个不同 variants 和一个 suggestedUniform
    - **验证需求：27.6**

  - [ ]* 30.7 编写法域合规性属性测试
    - **属性 75：文书法域合规性检查结构** — 验证 isCompliant 为 false 时 issues 非空，每个 issue 包含非空 section/issue/requirement/suggestion
    - **验证需求：27.7**

  - [ ]* 30.8 编写文书生成单元测试
    - 测试 10+ 文书类型支持验证
    - 测试 Word 和 PDF 导出功能
    - _需求：27.1, 27.3_

- [ ] 31. AI 智能问答增强
  - [x] 31.1 实现快速问答与深度分析模式
    - 创建 `src/server/services/ai/qa/smart-qa.ts`
    - 实现 `quickAnswer(request: QuickQARequest): Promise<string>` 快速问答接口
    - 编写快速问答 Prompt（简洁 Prompt，优先匹配 FAQ 知识库，5 秒内响应）
    - 实现 `deepAnalysis(request: DeepAnalysisRequest): Promise<DeepAnalysisResult>` 深度分析接口
    - 实现多步 LLM 管线：事实提取 → RAG 法律检索 → 分析 → 策略 → 行动方案（30 秒内响应）
    - 创建 `src/server/services/ai/qa/faq-manager.ts`
    - 实现 `searchFAQ(query): Promise<FAQEntry[]>` FAQ 语义匹配接口
    - 创建 FAQ 种子数据（中泰两国高频法律咨询问题 + AI 增强标准化回答 + 法条引用）
    - _需求：28.1, 28.2, 28.3_

  - [ ]* 31.2 编写深度分析五步骤属性测试
    - **属性 76：深度分析模式五步骤完整性** — 验证 DeepAnalysisResult 包含非空 factExtraction/lawApplication/riskAssessment/strategySuggestion，actionPlan 非空
    - **验证需求：28.2**

  - [x] 31.3 实现语音输入与 OCR 图片输入
    - 创建 `src/server/services/ai/qa/voice-input.ts`
    - 实现 `processVoiceInput(audioBlob): Promise<string>` 语音转文本接口
    - 集成 Web Speech API（浏览器端实现，服务端接收转写文本）
    - 实现 `processImageInput(fileKey): Promise<OCRAnalysisResult>` OCR 图片输入接口
    - 复用 AWS Textract OCR + AI_Paralegal 的 NLP 分析管线
    - 创建 `src/server/services/ai/qa/router.ts`
    - 实现 `routeQuery(query): Promise<IntentClassification>` 智能路由接口（复用意图分类器）
    - _需求：28.4, 28.5, 28.6_

  - [ ]* 31.4 编写 OCR 图片输入属性测试
    - **属性 77：OCR 图片输入分析管线完整性** — 验证包含文字内容的图片经 OCR 提取文本非空，后续 AI 分析基于提取文本生成结构化结果
    - **验证需求：28.5**

  - [ ]* 31.5 编写智能问答单元测试
    - 测试 FAQ 知识库数据完整性
    - 测试语音输入功能集成（Web Speech API）
    - 测试响应时间 SLA（快速 5s / 深度 30s）
    - _需求：28.3, 28.4, 30.7_

- [ ] 32. 检查点 - 文书生成与智能问答验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 33. AI 个性化引擎
  - [x] 33.1 实现用户偏好管理与术语适配
    - 创建 `src/server/services/ai/personalization/preference-manager.ts`
    - 实现 `getUserPreferences(userId): Promise<UserPreference>` 偏好获取接口（优先 Redis 缓存 `user:prefs:{userId}` TTL 12h，回退 DB）
    - 实现 `updatePreferences(userId, prefs): Promise<void>` 偏好更新接口（同步更新 Redis + DB）
    - 实现 `getTerminologyLevel(userId): Promise<'LAYPERSON' | 'PROFESSIONAL' | 'EXPERT'>` 术语等级获取
    - 实现偏好注入 LLM System Prompt 的中间件逻辑（responseStyle/terminologyLevel/preferredLanguage 注入 Prompt）
    - _需求：29.1, 29.5_

  - [ ]* 33.2 编写用户偏好存储属性测试
    - **属性 78：用户偏好存储往返一致性** — 验证更新后 getUserPreferences 返回一致数据，terminologyLevel 被注入后续 LLM System Prompt
    - **验证需求：29.1, 29.5**

  - [x] 33.3 实现企业知识积累与个性化推荐
    - 创建 `src/server/services/ai/personalization/enterprise-knowledge.ts`
    - 实现 `getEnterpriseKnowledge(enterpriseId): Promise<EnterpriseKnowledge>` 企业知识获取
    - 实现 `accumulateKnowledge(enterpriseId, consultation): Promise<void>` 知识积累接口
    - 从咨询会话中提取关键信息（行业特征、常见法律问题、历史结论），存入 EnterpriseKnowledge 表和 pgvector 专属命名空间
    - 创建 `src/server/services/ai/personalization/recommender.ts`
    - 实现 `getRecommendations(userId): Promise<Recommendation[]>` 智能推荐接口
    - 基于咨询历史的向量相似度搜索推荐相关法律知识文章和类似案例
    - _需求：29.2, 29.4_

  - [ ]* 33.4 编写企业知识积累属性测试
    - **属性 79：企业知识积累往返一致性** — 验证 accumulateKnowledge 后 getEnterpriseKnowledge 包含该次咨询提取的关键信息
    - **验证需求：29.2**

  - [x] 33.5 实现个性化风险预警
    - 创建 `src/server/services/ai/personalization/alert-engine.ts`
    - 实现 `checkLawUpdates(userId): Promise<PersonalizedAlert[]>` 法律变更预警接口
    - 实现 Cron 定时任务：检查法律更新 → 与用户业务画像（industry/operatingRegions）匹配 → 生成 PersonalizedAlert
    - 实现预警通知发送（邮件/站内通知）
    - 实现匹配逻辑：法律变更与用户 industry 或 operatingRegions 匹配时生成预警，不匹配时不生成
    - _需求：29.3_

  - [ ]* 33.6 编写个性化风险预警属性测试
    - **属性 80：个性化风险预警匹配性** — 验证法律变更与用户 industry/operatingRegions 匹配时生成 PersonalizedAlert，不匹配时不生成
    - **验证需求：29.3**

- [ ] 34. AI 服务质量监控系统
  - [x] 34.1 实现用户反馈收集与满意度评分
    - 创建 `src/server/services/ai/quality/feedback-collector.ts`
    - 实现 `submitFeedback(feedback): Promise<QualityFeedback>` 反馈提交接口
    - 支持 1-5 星评分 + 文字反馈 + feedbackType（HELPFUL/UNHELPFUL/INCORRECT）
    - 将反馈存入 QualityFeedback 表
    - _需求：30.1, 30.2_

  - [ ]* 34.2 编写用户反馈存储属性测试
    - **属性 81：用户反馈存储往返一致性** — 验证提交后查询返回一致记录，月度报告满意度统计包含该反馈
    - **验证需求：30.1, 30.2**

  - [x] 34.3 实现置信度评分与人工升级
    - 创建 `src/server/services/ai/quality/confidence-assessor.ts`
    - 实现 `assessConfidence(messageId, response): Promise<ConfidenceAssessment>` 置信度评分接口
    - 编写置信度评分 Prompt（每次 LLM 响应时要求模型自评置信度，JSON 输出 score 0-100）
    - 实现低置信度标记逻辑：score < 60 → needsReview = true
    - 实现连续低置信度追踪（Redis `confidence:consecutive:{sessionId}`）
    - 创建 `src/server/services/ai/quality/escalation-manager.ts`
    - 实现 `triggerHumanEscalation(sessionId, reason): Promise<void>` 人工升级接口
    - 实现连续两次 score < 50 → needsEscalation = true → 创建 HumanEscalation 工单 → 通知合作律师
    - _需求：30.3, 30.5_

  - [ ]* 34.4 编写低置信度标记属性测试
    - **属性 82：低置信度回复标记审核** — 验证 score < 60 时 needsReview 为 true，连续两次 < 50 时 needsEscalation 为 true 且触发人工升级
    - **验证需求：30.3, 30.5**

  - [x] 34.5 实现幻觉检测器
    - 创建 `src/server/services/ai/quality/hallucination-detector.ts`
    - 实现 `checkHallucination(messageId, citations): Promise<HallucinationCheckResult>` 幻觉检测接口
    - 实现法条引用验证逻辑：提取 LLM 引用的法条 → 在 Knowledge_Base（pgvector + LawDocument 表）中查询验证 → 不匹配则标记 hasHallucination = true
    - 实现自动重新生成逻辑：shouldRegenerate = true 时使用更严格 Prompt（仅引用 RAG 检索到的法条）重新生成
    - 实现二次幻觉处理：重新生成仍检测到幻觉时，返回回复并标注"部分法条引用待人工核实"
    - _需求：30.4_

  - [ ]* 34.6 编写幻觉检测属性测试
    - **属性 83：幻觉检测拦截机制** — 验证引用法条在 Knowledge_Base 中不存在或内容不匹配时 hasHallucination 为 true 且 shouldRegenerate 为 true
    - **验证需求：30.4**

  - [x] 34.7 实现 A/B 测试框架与 SLA 监控
    - 创建 `src/server/services/ai/quality/ab-testing.ts`
    - 实现 `assignABTest(userId, testName): Promise<ABTestVariant>` A/B 测试分配接口
    - 实现用户随机分配到 Prompt 变体逻辑（Redis `abtest:{testName}:{userId}` 缓存分配结果，确保同一用户同一测试始终分配相同变体）
    - 实现满意度和准确性指标追踪（更新 ABTestVariant.metrics）
    - 创建 `src/server/services/ai/quality/sla-monitor.ts`
    - 实现 `checkSLA(messageId, responseTimeMs, mode): Promise<boolean>` SLA 检查接口
    - 实现响应时间记录（Redis `sla:response:{messageId}` TTL 24h）
    - SLA 阈值：快速问答 5s / 深度分析 30s / 文书生成 60s
    - _需求：30.6, 30.7_

  - [ ]* 34.8 编写 A/B 测试分配属性测试
    - **属性 84：A/B 测试分配与指标追踪** — 验证同一用户同一测试始终分配相同变体，metrics 包含 totalAssignments/avgSatisfaction/accuracyRate
    - **验证需求：30.6**

  - [x] 34.9 实现月度质量报告生成
    - 创建 `src/server/services/ai/quality/report-generator.ts`
    - 实现 `generateMonthlyReport(month): Promise<MonthlyQualityReport>` 月度报告生成接口
    - 从 DB 聚合统计数据：responseAccuracyRate、avgSatisfactionScore、hallucinationRate、humanEscalationRate、slaComplianceRate、totalConsultations
    - 确保所有比率值在 [0, 1] 范围内
    - _需求：30.8_

  - [ ]* 34.10 编写月度质量报告属性测试
    - **属性 85：月度质量报告完整性** — 验证包含非空 responseAccuracyRate/avgSatisfactionScore/hallucinationRate/humanEscalationRate/slaComplianceRate，所有比率在 [0, 1] 范围内
    - **验证需求：30.8**

  - [ ]* 34.11 编写质量监控单元测试
    - 测试响应时间 SLA 阈值配置验证（快速 5s / 深度 30s / 文书 60s）
    - 测试人工升级流程（创建 HumanEscalation 工单 + 通知合作律师）
    - 测试幻觉检测与重新生成流程
    - _需求：30.7, 30.5, 30.4_

- [ ] 35. 检查点 - AI 个性化与质量监控验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 36. AI 模块前端界面
  - [x] 36.1 实现 AI 对话增强界面
    - 在咨询聊天界面中集成意图分类结果展示（显示识别到的法律领域标签）
    - 实现追问建议按钮组（用户可点击追问建议快速发送）
    - 实现后续问题建议展示（每轮对话后显示 followUpSuggestions）
    - 实现主题切换 UI（主题分支列表、切换确认、历史主题恢复）
    - 实现语言自动检测指示器
    - _需求：21.2, 21.3, 21.4, 21.6, 21.8_

  - [x] 36.2 实现 AI 律师助理界面
    - 创建文书起草页面（文书类型选择、案件信息输入、生成结果展示、Word/PDF 下载）
    - 创建案件时间线可视化组件（时间轴展示、法律意义标注）
    - 创建 OCR 文档上传与分析结果展示页面
    - 创建证据清单展示页面（优先级颜色标注、获取建议）
    - 创建诉讼时效计算器页面（案件类型选择、关键日期输入、时效结果展示、提醒设置）
    - 创建案件强度评分仪表盘（四维度雷达图、综合评分、评分报告）
    - _需求：22.1, 22.3, 22.4, 22.5, 22.6, 22.7_

  - [x] 36.3 实现 AI 律师团界面
    - 创建律师团辩论页面（角色头像展示、辩论轮次时间线、论点/反驳展示）
    - 创建共识报告展示页面（各角色观点摘要、共识结论、分歧点、统一策略）
    - 创建单角色咨询页面（角色选择、深度分析结果展示）
    - 实现新事实输入和策略更新 UI
    - _需求：23.1, 23.3, 23.4, 23.5, 23.7_

  - [x] 36.4 实现风险评估与合同分析增强界面
    - 创建风险评估仪表盘（四维度评分展示、风险热力图使用 ECharts/D3.js 渲染）
    - 创建场景模拟页面（参数调整滑块、实时结果对比）
    - 创建案件结果预测展示（概率分布饼图、预测依据说明）
    - 创建成本效益对比页面（三路径对比表格、推荐标注）
    - 创建增强合同分析结果页面（逐条评分展示、缺失条款列表、不公平条款标注、合同对比 diff 视图）
    - 创建谈判建议展示页面
    - _需求：25.1, 25.2, 25.3, 25.4, 25.5, 26.1, 26.2, 26.3, 26.5, 26.7_

  - [x] 36.5 实现文书生成与智能问答界面
    - 创建文书生成页面（文书类型选择、案件信息输入、生成结果编辑、版本历史、Word/PDF 导出）
    - 创建术语一致性检查结果展示
    - 创建法域合规性检查结果展示
    - 创建智能问答页面（快速/深度模式切换、语音输入按钮、图片上传入口）
    - 实现 FAQ 搜索结果展示
    - _需求：27.1, 27.3, 27.4, 27.6, 27.7, 28.1, 28.2, 28.4, 28.5_

  - [x] 36.6 实现个性化设置与质量反馈界面
    - 创建用户偏好设置页面（回复详细度、术语等级、语言偏好、报告格式）
    - 创建企业知识管理页面（行业信息、业务范围、经营地域、合规要求）
    - 创建风险预警通知列表页面
    - 实现每条 AI 回复的评分组件（1-5 星 + 文字反馈 + 有用/无用/错误标签）
    - 创建管理后台质量监控仪表盘（月度报告展示、A/B 测试管理、人工升级工单列表）
    - _需求：29.1, 29.2, 29.3, 30.1, 30.2, 30.6, 30.8_

- [ ] 37. 检查点 - AI 模块前端界面验证
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 38. AI 模块 tRPC 路由整合
  - [x] 38.1 创建 AI 模块 tRPC 路由
    - 实现 `conversation.*` 路由（send、classify、switchTopic、getContext）
    - 实现 `paralegal.*` 路由（draftDocument、fillTemplate、generateTimeline、analyzeOCR、generateEvidenceChecklist、calculateStatuteOfLimitations、scoreCase）
    - 实现 `lawyerTeam.*` 路由（startDebate、getReport、consultRole、updateWithNewFacts）
    - 实现 `rag.*` 路由（query、indexDocument、updateDocument、reindexAll — 管理员权限）
    - 实现 `risk.*` 路由（assess、simulate、predict、analyzeCostBenefit、trackTrend）
    - 实现 `enhancedContract.*` 路由（scoreClauseRisks、detectMissingClauses、detectUnfairTerms、crossReference、compare、getNegotiationAdvice）
    - 实现 `document.*` 路由（generate、exportWord、exportPDF、getVersionHistory、restoreVersion、checkTerminology、checkCompliance）
    - 实现 `qa.*` 路由（quickAnswer、deepAnalysis、searchFAQ、processVoice、processImage、routeQuery）
    - 实现 `personalization.*` 路由（getPreferences、updatePreferences、getEnterpriseKnowledge、accumulateKnowledge、checkLawUpdates、getRecommendations）
    - 实现 `quality.*` 路由（submitFeedback、assessConfidence、checkHallucination、triggerEscalation、assignABTest、generateReport、checkSLA）
    - 在每个路由中应用适当的权限中间件（protectedProcedure/paidProcedure/vipProcedure/adminProcedure）
    - _需求：全局_

  - [x] 38.2 实现 AI 增强咨询流程编排
    - 更新 `src/server/services/consultation/orchestrator.ts`
    - 编排增强咨询流程：语言检测 → 意图分类 → 上下文加载 → RAG 检索 → 管辖权识别 → IRAC 分析 → 风险评估 → 报告生成 → 置信度评分 → 幻觉检测 → 个性化适配
    - 集成质量监控中间件（每次响应自动进行置信度评分和幻觉检测）
    - 集成个性化中间件（注入用户偏好到 LLM Prompt）
    - _需求：21.1, 24.1, 25.1, 29.1, 30.3, 30.4_

- [ ] 39. 部署配置
  - [x] 39.1 创建 Docker 配置
    - 编写 `Dockerfile`（多阶段构建：依赖安装 → 构建 → 生产镜像）
    - 编写 `docker-compose.yml`（Next.js 应用 + Nginx + PostgreSQL + pgvector + Redis + OpenSearch，用于本地开发）
    - 配置 Nginx 反向代理（`nginx.conf`）
    - _需求：全局_

  - [x] 39.2 创建 CI/CD 配置
    - 编写 `.github/workflows/ci.yml`（lint、类型检查、测试、构建）
    - 编写 `.github/workflows/deploy.yml`（构建 Docker 镜像、推送 ECR、部署到 EC2）
    - _需求：全局_

  - [x] 39.3 创建 EC2 部署脚本和配置
    - 编写 EC2 用户数据脚本（Docker 安装、应用启动）
    - 创建 Auto Scaling Group 配置模板
    - 配置 CloudWatch 监控告警（CPU、内存、错误率）
    - 配置 Sentry 错误追踪集成
    - _需求：全局_

- [x] 40. 最终检查点 - 全系统验证
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号，确保需求可追溯
- 检查点任务确保增量验证，及时发现问题
- 属性测试验证设计文档中的全部 85 个正确性属性（属性 1-45 覆盖基础模块，属性 46-85 覆盖 AI 模块）
- 单元测试覆盖具体示例和边缘情况
- 所有代码使用 TypeScript 实现，使用 fast-check 进行属性测试，使用 Vitest 进行单元测试
- 所有 AI 功能通过外部模型 API（OpenAI GPT-4 / Anthropic Claude）+ Prompt 工程 + RAG 架构实现，不涉及自建模型或模型微调
- RAG 系统使用 pgvector + OpenAI Embeddings API，OCR 使用 AWS Textract，语音使用 Web Speech API
- 多智能体律师团通过顺序 LLM 调用 + 角色专属 System Prompt 实现
