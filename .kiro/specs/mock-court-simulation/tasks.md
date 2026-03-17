# 实施计划：模拟法庭（Mock Court Simulation）

## 概述

基于 Next.js App Router + tRPC + Prisma + SSE 流式传输架构，增量实现模拟法庭功能。从数据模型和核心类型定义开始，逐步构建服务层（阶段状态机、AI 调度、表现评估）、API 层（tRPC 路由 + SSE 端点）、前端页面和组件，最后完成国际化和集成联调。每个任务在前一个任务基础上递进构建，测试任务紧跟实现任务以尽早发现问题。

## Tasks

- [x] 1. 定义数据模型与核心类型
  - [x] 1.1 在 `prisma/schema.prisma` 中添加模拟法庭相关的枚举和模型定义
    - 添加枚举：`CourtPhase`、`MockCourtStatus`、`UserCourtRole`、`AICourtRole`、`CaseType`、`CourtJurisdiction`、`DifficultyLevel`、`EvidenceType`、`EvidenceAdmission`、`ObjectionType`、`ObjectionRuling`
    - 添加模型：`MockCourtSession`、`CourtMessage`、`CourtEvidence`、`CourtObjection`、`CourtPerformanceReport`
    - 添加索引：`[userId, status]`、`[userId, createdAt]`、`[sessionId, createdAt]`、`[sessionId]`
    - 运行 `npx prisma generate` 生成 Prisma Client 类型
    - _需求: 1.1, 1.2, 3.1, 5.1, 5.2, 6.1, 7.1, 7.2, 8.1, 11.1_

  - [x] 1.2 创建 `src/types/mock-court.ts` 核心类型定义文件
    - 定义 `CreateSessionInput`、`CaseConfigPartial`、`CourtContext`、`AIResponse`、`CourtMessageResponse` 等 TypeScript 接口
    - 定义 `EvidenceInput`、`SubmitEvidenceInput`、`EvidenceSubmissionResult` 证据相关类型
    - 定义 `ObjectionInput`、`RaiseObjectionInput`、`ObjectionRulingResult`、`ObjectionResolutionResult` 异议相关类型
    - 定义 `PerformanceReport`、`DimensionScore`、`ScoreDimension` 评估报告类型
    - 定义 `MockCourtSessionDetail`、`MockCourtSessionSummary`、`CaseAnalysisSummary` 查询结果类型
    - _需求: 1.1, 3.1, 4.1, 5.1, 6.1, 7.1, 7.2_

- [x] 2. 实现阶段状态机与案件配置验证
  - [x] 2.1 创建 `src/server/services/mock-court/phase-manager.ts` 阶段状态机
    - 实现 `TRANSITIONS` 映射：OPENING → EVIDENCE → DEBATE → CLOSING → VERDICT → null
    - 实现 `canTransition(currentPhase)` 判断是否可转换
    - 实现 `transition(currentPhase)` 执行阶段转换
    - 实现 `getPhaseRules(phase, jurisdiction)` 获取阶段规则描述
    - 实现 `isActionAllowed(phase, action)` 判断当前阶段允许的操作（证据提交仅 EVIDENCE、异议除 VERDICT 外均可、发言除 VERDICT 外均可）
    - _需求: 3.1, 3.2, 3.4, 3.5, 6.1_

  - [ ]* 2.2 编写阶段转换顺序属性测试 (`tests/properties/mock-court-phase.test.ts`)
    - **Property 3: 庭审阶段顺序不变性** — 对任意当前阶段，transition() 应返回且仅返回下一个合法阶段；VERDICT 阶段不允许转换
    - **验证: 需求 3.1**

  - [ ]* 2.3 编写阶段限定操作属性测试 (`tests/properties/mock-court-phase.test.ts`)
    - **Property 5: 阶段限定操作可用性** — 对任意阶段和操作组合，证据提交仅 EVIDENCE 可用，异议除 VERDICT 外可用，发言除 VERDICT 外可用
    - **验证: 需求 3.4, 3.5, 6.1**

  - [x] 2.4 创建 `src/lib/mock-court-validation.ts` 案件配置验证函数
    - 实现 `validateCaseConfig(input)` 验证必填字段和案情描述长度（50-5000 字符）
    - 实现 `getSupplementaryFields(caseType)` 获取案件类型对应的补充配置字段
    - 实现 `validateEvidenceInput(input)` 验证证据提交的必填字段
    - _需求: 1.2, 1.3, 1.6, 5.2_

  - [ ]* 2.5 编写案件配置验证属性测试 (`tests/properties/mock-court-validation.test.ts`)
    - **Property 1: 案件配置表单验证** — 生成随机字符串测试案情描述长度边界（<50 拒绝、>5000 拒绝、50-5000 接受）和必填字段为空时拒绝
    - **验证: 需求 1.2, 1.6**

  - [ ]* 2.6 编写案件类型补充字段属性测试 (`tests/properties/mock-court-validation.test.ts`)
    - **Property 2: 案件类型补充字段映射** — 对任意 CaseType，getSupplementaryFields() 返回非空字段定义数组且与预定义映射一致
    - **验证: 需求 1.3**

- [x] 3. 检查点 — 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 4. 实现 AI 提示词模板与多角色调度
  - [x] 4.1 创建 `src/server/services/mock-court/prompts.ts` AI 提示词模板
    - 定义 `JUDGE_SYSTEM_PROMPT` 法官系统提示词：包含角色定义（中泰跨境模拟法庭审判长）、程序规则、`{{caseConfig}}`、`{{currentPhase}}` 占位符、法律免责声明
    - 定义 `OPPOSING_COUNSEL_SYSTEM_PROMPT` 对方律师系统提示词：包含角色定义、对抗策略指令、`{{caseConfig}}`、`{{currentPhase}}` 占位符
    - 定义 `WITNESS_SYSTEM_PROMPT` 证人系统提示词：包含角色定义、角色一致性指令、`{{caseConfig}}` 占位符
    - 为每个管辖区（CHINA/THAILAND/ARBITRATION）定义程序法规则片段
    - 为每个难度等级（BEGINNER/INTERMEDIATE/ADVANCED）定义对抗策略片段
    - 所有提示词符合平台 Prompt_Standard：角色定义、中泰跨境法律专业资质、输出格式规则、法律免责声明
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ]* 4.2 编写管辖区提示词内容属性测试 (`tests/properties/mock-court-prompts.test.ts`)
    - **Property 6: 管辖区特定提示词内容** — 对任意管辖区和 AI 角色，构建的系统提示词包含该管辖区对应的法律体系引用
    - **验证: 需求 4.5, 4.6, 4.7, 9.2**

  - [ ]* 4.3 编写难度等级对抗策略属性测试 (`tests/properties/mock-court-prompts.test.ts`)
    - **Property 7: 难度等级对抗策略映射** — 对任意难度等级，对方律师提示词包含该等级对应的对抗策略指令
    - **验证: 需求 4.2, 9.4**

  - [ ]* 4.4 编写提示词结构合规性属性测试 (`tests/properties/mock-court-prompts.test.ts`)
    - **Property 15: AI 提示词结构合规性** — 对任意 AI 角色，系统提示词包含角色定义、专业资质说明、输出格式规则、法律免责声明、`{{caseConfig}}` 和 `{{currentPhase}}` 占位符
    - **验证: 需求 9.1, 9.3, 9.5, 9.6, 9.7, 9.8**

  - [x] 4.5 创建 `src/server/services/mock-court/court-ai.ts` 多角色 AI 调度服务
    - 实现 `CourtAIService` 类
    - 实现 `buildSystemPrompt(role, config, phase, locale)` 构建角色系统提示词，填充占位符，注入管辖区规则和难度策略，添加语言指令
    - 实现 `generateJudgeResponse(context)` 生成法官发言
    - 实现 `generateOpposingCounselResponse(context)` 生成对方律师发言
    - 实现 `generateWitnessResponse(context)` 生成证人发言
    - 实现 `streamResponse(role, context)` 流式生成 AI 响应（AsyncIterable）
    - 调用现有 `LLMGateway` 进行 AI 推理
    - _需求: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 9.1, 9.2, 9.3, 9.4, 10.4_

  - [ ]* 4.6 编写 AI 消息角色标注属性测试 (`tests/properties/mock-court-prompts.test.ts`)
    - **Property 8: AI 消息角色标注完整性** — 对任意 AI 生成的 CourtMessage，senderRole 必须为 'JUDGE'、'OPPOSING_COUNSEL' 或 'WITNESS' 之一
    - **验证: 需求 4.8**

  - [ ]* 4.7 编写 AI 语言适配属性测试 (`tests/properties/mock-court-prompts.test.ts`)
    - **Property 16: AI 语言适配** — 对任意用户语言设置（zh/en/th），AI 角色的系统提示词包含指示模型以该语言回复的指令
    - **验证: 需求 10.4**

- [x] 5. 实现核心业务服务
  - [x] 5.1 创建 `src/server/services/mock-court/service.ts` MockCourtService 核心服务
    - 实现 `createSession(userId, config)` 创建会话：校验订阅配额 → 创建 DB 记录 → 调用 CourtAIService 生成法官开场白 → 记录 UsageRecord
    - 实现 `processMessage(sessionId, userId, content)` 处理用户消息：校验会话状态和阶段操作权限 → 检查是否有待处理异议 → 保存用户消息 → 调度 AI 响应 → 检查阶段转换
    - 实现 `submitEvidence(sessionId, userId, evidence)` 提交证据：校验 EVIDENCE 阶段 → 验证证据字段 → 保存证据 → AI 对方律师质证 → AI 法官裁定
    - 实现 `handleObjection(sessionId, userId, objection)` 处理用户异议：保存异议 → AI 法官裁定
    - 实现 `respondToObjection(sessionId, userId, response)` 回应 AI 异议：保存回应 → 解除异议等待状态
    - 实现 `resumeSession(sessionId, userId)` 恢复会话：查询 DB 返回完整会话状态
    - _需求: 1.5, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.3, 4.4, 5.2, 5.3, 5.4, 6.3, 6.4, 6.5, 11.1, 11.2, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 5.2 编写异议裁定流程属性测试 (`tests/properties/mock-court-service.test.ts`)
    - **Property 9: 异议裁定流程完整性** — 对任意异议（用户或 AI 提出），系统应生成法官裁定消息，裁定结果为 SUSTAINED 或 OVERRULED 且包含理由
    - **验证: 需求 4.4, 6.3**

  - [ ]* 5.3 编写 AI 异议暂停状态属性测试 (`tests/properties/mock-court-service.test.ts`)
    - **Property 10: AI 异议暂停状态** — 对任意 AI 对方律师提出的异议，会话进入等待用户回应状态，在回应前不处理新的普通消息
    - **验证: 需求 6.5**

  - [ ]* 5.4 编写证据提交工作流属性测试 (`tests/properties/mock-court-service.test.ts`)
    - **Property 11: 证据提交验证与工作流** — 对任意证据提交，四个必填字段非空时成功，并依次生成 AI 质证消息和法官裁定消息
    - **验证: 需求 5.2, 5.3, 5.4**

  - [ ]* 5.5 编写阶段转换法官引导消息属性测试 (`tests/properties/mock-court-service.test.ts`)
    - **Property 4: 阶段转换生成法官引导消息** — 对任意阶段转换事件，系统生成 senderRole 为 'JUDGE' 的消息，phase 等于新阶段
    - **验证: 需求 3.2**

- [x] 6. 实现订阅配额控制与访问控制
  - [x] 6.1 在 `src/server/services/mock-court/service.ts` 中实现配额校验逻辑
    - 实现 `checkQuota(userId, subscriptionTier)` 检查用户当月创建次数是否超限
    - 实现 `checkDifficultyAccess(subscriptionTier, difficulty)` 检查难度等级访问权限
    - FREE: 每月 2 次，仅 BEGINNER；STANDARD: 每月 10 次，BEGINNER + INTERMEDIATE；VIP: 无限制，所有难度
    - 超限时返回 FORBIDDEN 错误并附带升级提示
    - 创建成功后调用 UsageRecord 计数
    - _需求: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 6.2 编写订阅等级访问控制属性测试 (`tests/properties/mock-court-access.test.ts`)
    - **Property 20: 订阅等级访问控制** — 对任意订阅等级和当月已创建会话数，系统正确执行次数和难度限制规则
    - **验证: 需求 12.2, 12.3, 12.4, 12.5**

  - [ ]* 6.3 编写使用记录计数属性测试 (`tests/properties/mock-court-access.test.ts`)
    - **Property 21: 使用记录计数** — 对任意成功创建的会话，用户 UsageRecord 当月计数增加 1
    - **验证: 需求 12.6**

  - [ ]* 6.4 编写认证保护属性测试 (`tests/properties/mock-court-access.test.ts`)
    - **Property 22: 认证保护** — 对任意未认证请求，所有 tRPC 端点返回 UNAUTHORIZED 错误
    - **验证: 需求 12.1**

- [x] 7. 实现表现评估服务
  - [x] 7.1 创建 `src/server/services/mock-court/evaluator.ts` PerformanceEvaluator
    - 实现 `evaluate(session)` 基于完整庭审记录生成评估报告
    - 实现 `evaluateDimension(dimension, messages, config)` 评估单个维度（法律论证质量、证据运用能力、程序规范性、应变能力、语言表达）
    - 实现 `calculateOverallScore(dimensionScores)` 计算加权平均总分
    - 实现 `extractLegalCitations(messages)` 提取用户引用的法律条文并标注准确性
    - 实现 `generateImprovements(messages, dimensionScores)` 生成改进建议，引用庭审中的具体发言
    - 调用 LLMGateway 进行 AI 评估
    - 将报告保存到 `CourtPerformanceReport` 表
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 7.2 编写表现报告完整性属性测试 (`tests/properties/mock-court-evaluator.test.ts`)
    - **Property 17: 表现报告完整性与评分范围** — 对任意生成的报告，包含五个评分维度，每项 1-10 分，包含详细评价、改进建议和法条引用列表，总分等于加权平均值
    - **验证: 需求 7.2, 7.3, 7.4, 7.5, 7.6**

- [x] 8. 检查点 — 确保所有服务层测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 9. 实现 tRPC 路由层
  - [x] 9.1 创建 `src/server/routers/mockCourt.ts` tRPC 路由
    - 实现 `create` mutation：Zod 输入验证 → 调用 MockCourtService.createSession
    - 实现 `importFromCaseAnalysis` query：从案件分析会话导入案情数据
    - 实现 `listCaseAnalyses` query：获取用户历史案件分析列表（按创建时间倒序）
    - 实现 `sendMessage` mutation：调用 MockCourtService.processMessage
    - 实现 `submitEvidence` mutation：调用 MockCourtService.submitEvidence
    - 实现 `raiseObjection` mutation：调用 MockCourtService.handleObjection
    - 实现 `respondToObjection` mutation：调用 MockCourtService.respondToObjection
    - 实现 `getSession` query：调用 MockCourtService.resumeSession
    - 实现 `listSessions` query：获取用户会话列表（按创建时间倒序）
    - 实现 `getReport` query：获取表现评估报告
    - 实现 `exportPDF` mutation：导出庭审记录 PDF
    - 实现 `deleteSession` mutation：软删除会话
    - 所有端点使用 `protectedProcedure` 确保认证保护
    - _需求: 1.5, 2.1, 2.2, 2.3, 5.1, 6.2, 6.3, 7.7, 8.1, 8.2, 8.3, 8.4, 8.5, 11.4, 11.5, 12.1_

  - [x] 9.2 在 `src/server/root.ts` 中注册 `mockCourtRouter`
    - 将 mockCourtRouter 添加到 appRouter
    - _需求: 1.5_

  - [ ]* 9.3 编写案件分析导入数据映射属性测试 (`tests/properties/mock-court-import.test.ts`)
    - **Property 12: 案件分析导入数据映射** — 对任意包含案情描述、案件类型和管辖区的案件分析会话，导入操作正确映射三个字段且值与源数据一致
    - **验证: 需求 2.3**

  - [ ]* 9.4 编写案件分析导入证据预填充属性测试 (`tests/properties/mock-court-import.test.ts`)
    - **Property 13: 案件分析导入证据预填充** — 对任意包含证据信息的案件分析会话，导入操作将证据数据预填充到证据清单
    - **验证: 需求 5.6**

  - [ ]* 9.5 编写会话列表排序属性测试 (`tests/properties/mock-court-import.test.ts`)
    - **Property 14: 会话列表时间排序** — 对任意用户的会话集合，列表查询返回结果按创建时间倒序排列
    - **验证: 需求 2.2, 8.4**

  - [ ]* 9.6 编写软删除行为属性测试 (`tests/properties/mock-court-import.test.ts`)
    - **Property 19: 软删除行为** — 对任意被删除的会话，deletedAt 被设置，不出现在正常列表中，但数据库仍保留记录
    - **验证: 需求 11.5**

- [x] 10. 实现 SSE 流式端点
  - [x] 10.1 创建 `src/app/api/mock-court/stream/route.ts` SSE 流式端点
    - 实现 POST handler：认证校验 → 解析请求（sessionId, content）→ 调用 CourtAIService.streamResponse → 返回 SSE 流
    - 响应格式：`{ role: AI_Role, content: string, phase: Court_Phase, done: boolean }`
    - 复用现有 SSE 流式传输模式（参考 `src/app/api/` 下已有的流式端点）
    - 处理 AI 服务不可用和超时（30s）的降级策略
    - _需求: 4.1, 4.8, 11.3_

- [x] 11. 检查点 — 确保 API 层测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 12. 添加国际化翻译键
  - [x] 12.1 在 `messages/zh.json`、`messages/en.json`、`messages/th.json` 中添加模拟法庭翻译键
    - 添加 `mockCourt` 命名空间下的所有 UI 标签：页面标题、按钮文本（开始模拟、提交证据、提出异议、导出记录等）
    - 添加庭审阶段名称翻译：开庭陈述/Opening Statement/คำแถลงเปิดคดี 等
    - 添加案件类型、管辖区、难度等级、证据类型、异议类型的翻译
    - 添加表单标签、验证错误提示、空状态提示信息
    - 添加评估报告维度名称翻译
    - _需求: 10.1, 10.2_

  - [ ]* 12.2 编写 i18n 翻译键完整性属性测试 (`tests/properties/mock-court-i18n.test.ts`)
    - **Property 23: i18n 翻译键完整性** — 对任意模拟法庭定义的翻译键，zh.json、en.json、th.json 三个文件中都包含该键的翻译值
    - **验证: 需求 10.1**

- [x] 13. 实现会话创建页面与表单
  - [x] 13.1 创建 `src/app/[locale]/mock-court/page.tsx` 会话创建页面
    - 使用 Ant Design Form 组件构建创建表单
    - 包含字段：Case_Type 选择器、案情描述文本框（50-5000 字符限制）、Jurisdiction 选择器、User_Role 选择器、Difficulty_Level 选择器
    - 默认值：Jurisdiction=CHINA、Difficulty_Level=BEGINNER、User_Role=PLAINTIFF_LAWYER
    - 根据 Case_Type 动态显示补充配置字段
    - 表单验证：必填字段校验、案情描述长度校验
    - 提交时调用 `trpc.mockCourt.create` mutation
    - 所有 UI 文本使用 `useTranslations('mockCourt')` 国际化
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.2_

  - [x] 13.2 在创建表单中实现"从案件分析导入"功能
    - 添加"从案件分析导入"按钮
    - 点击后调用 `trpc.mockCourt.listCaseAnalyses` 显示历史案件分析列表（按时间倒序）
    - 选择后调用 `trpc.mockCourt.importFromCaseAnalysis` 自动填充案情描述、案件类型、管辖区
    - 导入后允许用户修改任何已填充字段
    - 无历史记录时显示引导提示
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 13.3 实现订阅等级限制的前端展示
    - 根据用户订阅等级禁用不可用的难度选项
    - 达到月度上限时禁用"开始模拟"按钮并显示升级提示
    - _需求: 12.2, 12.3, 12.4, 12.5_

- [x] 14. 实现庭审主界面
  - [x] 14.1 创建 `src/app/[locale]/mock-court/[sessionId]/page.tsx` 庭审页面
    - 调用 `trpc.mockCourt.getSession` 加载会话数据
    - 布局：顶部阶段进度条 + 中间消息列表 + 底部输入区 + 右侧证据面板
    - 支持会话恢复（页面加载时恢复到离开时的状态）
    - _需求: 3.8, 11.2, 10.2_

  - [x] 14.2 创建 `src/components/mock-court/PhaseIndicator.tsx` 阶段进度指示器
    - 显示五个庭审阶段：已完成（绿色）、当前（蓝色高亮）、待进行（灰色）
    - 响应阶段变化实时更新
    - _需求: 3.8_

  - [x] 14.3 创建 `src/components/mock-court/CourtMessage.tsx` 庭审消息组件
    - 根据 senderRole 显示不同样式：USER（右侧蓝色）、JUDGE（居中金色）、OPPOSING_COUNSEL（左侧红色）、WITNESS（左侧绿色）、SYSTEM（居中灰色）
    - 显示角色标签（法官/对方律师/证人）
    - 显示所属庭审阶段标注
    - _需求: 4.8_

  - [x] 14.4 创建 `src/components/mock-court/CourtRoom.tsx` 庭审主组件
    - 消息列表渲染，支持自动滚动到最新消息
    - 用户输入区：文本输入框 + 发送按钮
    - 集成 `useSSEStream` hook 处理 AI 流式响应
    - 发送消息调用 SSE 端点，实时显示 AI 回复
    - VERDICT 阶段禁用输入区
    - _需求: 3.3, 3.5, 3.6, 4.1, 4.3_

  - [x] 14.5 创建 `src/components/mock-court/EvidencePanel.tsx` 证据清单面板
    - 显示所有已提交证据及其采纳状态（待审、采纳、部分采纳、不予采纳）
    - 仅在 EVIDENCE 阶段显示"提交证据"按钮
    - 提交证据表单：证据名称、证据类型选择器、证据描述、证明目的
    - 从案件分析导入的证据预填充显示
    - _需求: 5.1, 5.2, 5.5, 5.6_

  - [x] 14.6 创建 `src/components/mock-court/ObjectionDialog.tsx` 异议对话框
    - "提出异议"按钮（VERDICT 阶段除外）
    - 异议类型选择器：与案件无关、传闻证据、引导性提问、未回答问题、其他
    - AI 对方律师提出异议时显示回应对话框，暂停正常庭审流程
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 15. 实现表现评估报告页面
  - [x] 15.1 创建 `src/components/mock-court/PerformanceReport.tsx` 评估报告组件
    - 显示五个维度评分（雷达图或条形图）
    - 显示每个维度的详细文字评价（优点和不足）
    - 显示改进建议（引用庭审中的具体发言）
    - 显示用户引用的法律条文及准确性标注
    - 显示总体评分和总体评语
    - _需求: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 15.2 在庭审页面中集成评估报告
    - VERDICT 阶段判决宣布后自动调用 `trpc.mockCourt.getReport` 显示报告
    - 报告页面与庭审记录可切换查看
    - _需求: 7.1, 7.7_

- [x] 16. 实现历史记录与 PDF 导出
  - [x] 16.1 创建 `src/app/[locale]/mock-court/history/page.tsx` 历史记录页面
    - 调用 `trpc.mockCourt.listSessions` 显示已完成和进行中的会话列表（按时间倒序）
    - 显示会话摘要：案件类型、管辖区、难度、状态、创建时间
    - 点击进入庭审记录查看页面
    - 支持软删除操作
    - _需求: 8.4, 8.5, 11.4, 11.5_

  - [x] 16.2 实现 PDF 导出功能
    - "导出记录"按钮调用 `trpc.mockCourt.exportPDF`
    - PDF 包含：案件配置信息、各阶段完整对话记录、判决结果、表现评估报告
    - _需求: 8.2, 8.3_

- [x] 17. 检查点 — 确保前端组件和页面功能正常
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 18. 数据持久化与会话恢复
  - [x] 18.1 在 MockCourtService 中完善会话持久化逻辑
    - 每条消息实时保存到 CourtMessage 表
    - 阶段转换时更新 MockCourtSession.currentPhase
    - 证据提交和异议裁定实时保存
    - 网络中断恢复后自动同步未保存的消息（前端重连机制）
    - _需求: 11.1, 11.2, 11.3_

  - [ ]* 18.2 编写会话数据持久化往返属性测试 (`tests/properties/mock-court-persistence.test.ts`)
    - **Property 18: 会话数据持久化往返** — 对任意会话及其消息和证据，保存后查询返回与原始数据等价的结果
    - **验证: 需求 8.1, 11.1, 11.2**

- [ ] 19. 编写单元测试
  - [ ]* 19.1 创建 `tests/unit/mock-court.test.ts` 单元测试
    - 测试会话创建的默认值（Jurisdiction=CHINA, Difficulty=BEGINNER, UserRole=PLAINTIFF_LAWYER）
    - 测试案件分析导入的字段映射（具体示例）
    - 测试证据提交工作流的完整流程（提交 → 质证 → 裁定）
    - 测试异议裁定流程（用户异议 → 法官裁定 / AI 异议 → 用户回应 → 法官裁定）
    - 测试软删除行为（deletedAt 设置、列表不可见）
    - 测试 AI 服务降级时的错误处理
    - 测试 PDF 导出内容完整性
    - 测试配额超限时的错误响应
    - _需求: 1.4, 2.3, 5.3, 5.4, 6.3, 6.5, 8.2, 8.3, 11.5, 12.2, 12.5_

- [x] 20. 最终检查点 — 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用具体需求编号以确保可追溯性
- 检查点确保增量验证，避免问题累积
- 属性测试验证设计文档中的 23 个正确性属性
- 单元测试验证具体示例和边界情况
- 所有代码使用 TypeScript；测试使用 vitest + fast-check
- 任务 1-8 覆盖数据模型、核心服务层（状态机、AI 调度、评估、配额控制）
- 任务 9-11 覆盖 API 层（tRPC 路由、SSE 流式端点）
- 任务 12-17 覆盖前端页面和组件（创建表单、庭审界面、评估报告、历史记录）
- 任务 18-20 覆盖数据持久化完善和综合测试
