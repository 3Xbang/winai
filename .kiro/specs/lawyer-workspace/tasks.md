# 实施计划：律师工作空间（Lawyer Workspace）

## 概述

基于 Next.js 14 + TypeScript + PostgreSQL（Prisma）+ Redis + AWS S3 + GLM AI + tRPC 技术栈，
按照设计文档逐步实现律师工作空间的全部功能模块。每个任务均可独立执行，并在前序任务基础上递进构建。

## 任务列表

- [x] 1. 数据库模型与 Prisma Schema 扩展
  - 在 `prisma/schema.prisma` 中追加所有枚举类型（LawyerPlanTier、WorkspaceStatus、CaseStatus、EvidenceCategory、EvidenceStrength、DeadlineType、FeeVisibility、ChannelMessageType、AuditAction、NotificationType）
  - 追加全部核心数据模型（LawyerWorkspace、LawyerSubscription、StorageAddOn、Case、CaseTimelineEvent、Evidence、VisitRecord、Channel、ChannelMessage、Deadline、FeeRecord、CaseDocument、CaseDocumentVersion、WorkspaceAuditLog、Notification）
  - 执行 `prisma migrate dev` 生成迁移文件
  - _需求：1.1, 1.2, 1.3, 2.1, 3.1, 4.1, 5.3, 6.1, 7.1, 8.1, 10.1, 11.1_

- [x] 2. 工作空间初始化与存储配额
  - [x] 2.1 实现 `WorkspaceService`
    - 创建 `src/server/services/workspaceService.ts`，实现 `initWorkspace`、`getStorageUsage`、`checkQuota` 三个方法
    - `initWorkspace` 在事务中创建 `LawyerWorkspace` 记录，设置 `s3BasePath = workspaces/{lawyerId}/`，按套餐初始化 `storageQuotaGB`
    - `checkQuota` 纯函数：`usedBytes + fileSize <= quotaBytes` 返回 true，否则 false
    - _需求：1.1, 1.2, 1.3, 1.4, 2.4_

  - [ ]* 2.2 为 WorkspaceService 编写属性测试
    - **属性 1：工作空间自动创建** — 验证 `initWorkspace` 返回的记录 `lawyerId` 与入参一致
    - **属性 2：S3 路径格式与隔离性** — 生成两个不同 lawyerId，验证路径格式和互不为前缀
    - **属性 3：套餐配额初始化** — 枚举三种套餐，验证 `storageQuotaGB` 等于预定义值
    - **属性 4：存储配额叠加** — 随机初始配额和扩充包，验证总配额等于基础配额加所有扩充包之和
    - **属性 5：配额超限拒绝上传** — 随机三元组，验证 `checkQuota` 返回值与 `used + size <= quota` 一致
    - **验证：需求 1.1, 1.2, 1.3, 1.4, 2.3, 2.4**
    - 测试文件：`tests/properties/lawyer-workspace/storage.property.ts`

  - [x] 2.3 实现 `workspace` tRPC router
    - 创建 `src/server/routers/workspace.ts`，暴露 `initWorkspace`、`getStorageUsage` 过程
    - 实现 `requireActiveWorkspace` tRPC middleware，订阅到期时抛出 `WORKSPACE_READONLY`
    - 将 router 注册到 `src/server/routers/index.ts`（appRouter）
    - _需求：1.1, 2.4, 2.6_

  - [ ]* 2.4 为订阅到期只读编写属性测试
    - **属性 6：订阅到期只读** — 模拟 READONLY 状态工作空间，验证写操作返回 WORKSPACE_READONLY，读操作正常
    - **验证：需求 2.6**
    - 测试文件：`tests/properties/lawyer-workspace/storage.property.ts`

- [x] 3. 案件管理与冲突检查
  - [x] 3.1 实现 `ConflictService` 和 `case` tRPC router
    - 创建 `src/server/services/conflictService.ts`，实现 `checkConflict(lawyerId, opposingParty)` 函数：检索工作空间内所有案件当事人，返回冲突案件列表
    - 创建 `src/server/routers/case.ts`，实现 `createCase`（含冲突检查）、`updateCase`、`getCaseById`、`listCases`、`getCaseTimeline` 过程
    - 所有查询强制附加 `workspaceId` 过滤，`getCaseById` 不存在时抛出 `NOT_FOUND`
    - 案件状态变更时自动向 `CaseTimelineEvent` 追加带时间戳的事件条目
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 3.2 为案件访问控制编写属性测试
    - **属性 7：律师案件访问隔离** — 生成两个不同 lawyerId，验证跨律师访问返回 NOT_FOUND
    - **属性 8：FirmAdmin 案件可见性** — 验证 FirmAdmin 可查询所属律师的任意案件
    - **验证：需求 3.4, 3.5**
    - 测试文件：`tests/properties/lawyer-workspace/access-control.property.ts`

  - [ ]* 3.3 为冲突检测编写属性测试
    - **属性 15：利益冲突检测正确性** — 随机现有案件集合和新案件对立方，验证当且仅当存在字符串重叠时返回冲突列表
    - **验证：需求 9.2, 9.3**
    - 测试文件：`tests/properties/lawyer-workspace/conflict.property.ts`

- [ ] 4. 检查点 — 确保所有测试通过，如有疑问请向用户确认

- [x] 5. S3 存储服务与证据管理
  - [x] 5.1 实现 `StorageService`
    - 创建 `src/server/services/storageService.ts`，实现 `upload`、`getPresignedUrl`、`delete` 方法
    - `upload` 前置调用 `checkQuota`，超限时抛出 `STORAGE_QUOTA_EXCEEDED`；成功后更新 `storageUsedBytes`
    - 所有方法强制验证 `s3Key` 前缀归属（`workspaces/{lawyerId}/`），防止越权访问
    - _需求：1.2, 1.4, 2.4_

  - [x] 5.2 实现 `AIService`（GLM AI 封装）
    - 创建 `src/server/services/aiService.ts`，封装 `classifyEvidence` 和 `generateVisitSummary`
    - `classifyEvidence` 返回 `ClassificationResult`，`category` 仅允许三种枚举值
    - `generateVisitSummary` 返回不超过 500 字的摘要字符串
    - _需求：4.2, 4.3, 4.4, 5.1_

  - [x] 5.3 实现 `EvidenceService` 和 `evidence` tRPC router
    - 创建 `src/server/services/evidenceService.ts`，实现 `uploadEvidence`、`triggerClassification`（写入 Redis 队列）、`generateEvidenceList`、`exportEvidenceList`、`importEvidenceList`
    - 创建 `src/server/routers/evidence.ts`，暴露上传、查询、生成清单、导出/导入过程
    - AI 调用失败时将证据标记为 `PENDING_CLASSIFICATION`，写入 Redis 重试队列（延迟 5 分钟，最多 3 次）
    - 每次文件访问/下载/删除操作写入 `WorkspaceAuditLog`
    - _需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 11.1, 12.1_

  - [ ]* 5.4 为证据分类编写属性测试
    - **属性 9：证据分类结果枚举约束** — 随机证据输入，验证 `category` 始终是三种枚举值之一
    - **属性 18：证据清单序列化往返** — 随机 EvidenceListData，导出再导入，验证深度相等
    - **验证：需求 4.2, 12.3**
    - 测试文件：`tests/properties/lawyer-workspace/evidence.property.ts`

- [x] 6. 会见准备与记录
  - [x] 6.1 实现 `VisitService` 和 `visit` tRPC router
    - 创建 `src/server/services/visitService.ts`，实现 `generateVisitSummary`（调用 AIService，基于 CaseTimeline 和历史 VisitRecord）和 `saveVisitRecord`
    - 无历史 VisitRecord 时仅基于 CaseTimeline 生成初始摘要
    - 创建 `src/server/routers/visit.ts`，暴露 `generateSummary`、`saveRecord`、`listRecords` 过程
    - _需求：5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 6.2 为会见摘要编写属性测试
    - **属性 10：会见摘要长度约束** — 随机案件时间线和会见记录数量，验证生成摘要长度不超过 500 字符
    - **验证：需求 5.1**
    - 测试文件：`tests/properties/lawyer-workspace/evidence.property.ts`

- [x] 7. 沟通频道
  - [x] 7.1 实现 `ChannelService` 和 `channel` tRPC router
    - 创建 `src/server/services/channelService.ts`，实现 `createChannel`（案件创建时自动调用）、`sendMessage`、`listMessages`
    - `sendMessage` 禁止删除操作（消息永久保存）；客户只能访问自己参与案件的频道（`clientId` 验证）
    - 创建 `src/server/routers/channel.ts`，暴露 `sendMessage`、`listMessages` 过程
    - 律师发布进展时调用 `NotificationService` 向客户发送站内通知；客户上传材料时通知律师
    - _需求：6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 7.2 为频道访问控制编写属性测试
    - **属性 11：频道消息不可删除** — 验证删除操作被拒绝，消息总数不减少
    - **属性 12：客户频道访问隔离** — 生成两个不同客户，验证跨客户访问返回 FORBIDDEN
    - **验证：需求 6.5, 6.6**
    - 测试文件：`tests/properties/lawyer-workspace/access-control.property.ts`

- [x] 8. 期限管理与通知
  - [x] 8.1 实现 `DeadlineService`、`NotificationService` 和对应 tRPC router
    - 创建 `src/server/services/deadlineService.ts`，实现 `createDeadline`、`checkDeadlines`（定时任务调用，检查 7 天和 1 天提醒）、`markHandled`
    - 创建 `src/server/services/notificationService.ts`，实现 `send`、`getUnread`、`markRead`
    - 创建 `src/server/routers/deadline.ts` 和 `src/server/routers/notification.ts`
    - 逾期未处理的期限在案件详情页显示逾期警告标识（通过 `isHandled` 和 `dueDate` 判断）
    - _需求：7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.2 为期限提醒编写属性测试
    - **属性 13：期限提醒触发时机** — 随机期限记录，验证距截止 7 天/1 天时创建通知，超过 7 天时不创建
    - **验证：需求 7.2, 7.3**
    - 测试文件：`tests/properties/lawyer-workspace/deadline.property.ts`

- [x] 9. 费用记录
  - [x] 9.1 实现 `fee` tRPC router
    - 创建 `src/server/routers/fee.ts`，实现 `createFeeRecord`、`listFeeRecords`（支持按案件过滤）、`updateVisibility`、`getFeesSummary`（按案件汇总）
    - 客户查询时仅返回 `visibility = CLIENT_VISIBLE` 的条目
    - _需求：8.1, 8.2, 8.3, 8.4_

  - [ ]* 9.2 为费用汇总编写属性测试
    - **属性 14：费用汇总一致性** — 随机费用记录集合，验证汇总金额等于所有 `amount` 的算术和
    - **验证：需求 8.2**
    - 测试文件：`tests/properties/lawyer-workspace/fee.property.ts`

- [x] 10. 文件版本管理与审计日志
  - [x] 10.1 实现 `document` tRPC router 和审计日志
    - 创建 `src/server/routers/document.ts`，实现 `uploadVersion`（自动递增版本号，保留历史版本）、`listVersions`、`setActiveVersion`、`compareVersions`
    - 每次文件访问/下载/删除操作写入 `WorkspaceAuditLog`（操作类型、操作人、时间、文件标识）
    - 审计日志表禁止 UPDATE/DELETE 操作（在 Service 层强制，不暴露修改接口）
    - FirmAdmin 可查询所属律师全部审计日志；普通律师和客户无权访问
    - _需求：10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 10.2 为文件版本和审计日志编写属性测试
    - **属性 16：文件版本单调递增** — 随机上传次数，验证版本总数递增且历史 s3Key 均可查询
    - **属性 17：审计日志完整性与不可篡改** — 验证每次文件操作后日志存在，且删除/更新操作被拒绝
    - **验证：需求 10.1, 11.1, 11.2**
    - 测试文件：`tests/properties/lawyer-workspace/document.property.ts`、`tests/properties/lawyer-workspace/audit.property.ts`

- [ ] 11. 检查点 — 确保所有测试通过，如有疑问请向用户确认

- [x] 12. 前端页面：工作空间仪表盘与案件列表
  - [x] 12.1 创建工作空间仪表盘页面
    - 创建 `src/app/[locale]/workspace/page.tsx`，展示"今日待办"和"紧急期限"醒目卡片
    - 使用 Ant Design 卡片式布局，主色调温暖中性色或浅蓝绿色，正文字号不小于 16px，卡片内边距不小于 24px
    - 通过 tRPC 查询当天到期/即将到期的期限和待处理事项
    - _需求：13.1, 13.2, 13.5, 13.6_

  - [x] 12.2 创建案件列表页面
    - 创建 `src/app/[locale]/workspace/cases/page.tsx`，卡片式展示案件列表
    - 每张案件卡片直接显示：案件名称、当事人、最新进展、紧急期限，无需点击
    - 创建 `src/app/[locale]/workspace/cases/new/page.tsx`，新建案件表单含冲突检查结果展示
    - _需求：3.1, 9.2, 9.3, 9.4, 13.3, 13.4, 13.6_

- [x] 13. 前端页面：案件详情与各子模块
  - [x] 13.1 创建案件详情页面
    - 创建 `src/app/[locale]/workspace/cases/[caseId]/page.tsx`，显眼位置展示最近一次 VisitRecord 结论和下一步策略
    - 显示案件时间线、逾期期限警告标识
    - _需求：3.2, 5.4, 7.4, 13.2_

  - [x] 13.2 创建证据管理页面
    - 创建 `src/app/[locale]/workspace/cases/[caseId]/evidence/page.tsx`
    - 支持文件上传（图片、PDF、Word、录音、视频），展示 AI 分类结果（分类、证明目的、法律依据、证明力、类似案例）
    - 提供"生成证据清单"和"导出清单（PDF/Word）"操作按钮（圆角设计）
    - _需求：4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 12.1, 13.4_

  - [x] 13.3 创建会见记录、沟通频道、期限管理、费用记录、文件版本页面
    - 创建 `src/app/[locale]/workspace/cases/[caseId]/visit/page.tsx`：生成摘要按钮 + 会见记录表单
    - 创建 `src/app/[locale]/workspace/cases/[caseId]/channel/page.tsx`：消息列表 + 发送框
    - 创建 `src/app/[locale]/workspace/cases/[caseId]/deadlines/page.tsx`：期限列表 + 新增表单
    - 创建 `src/app/[locale]/workspace/cases/[caseId]/fees/page.tsx`：费用列表 + 新增表单
    - 创建 `src/app/[locale]/workspace/cases/[caseId]/documents/page.tsx`：版本列表 + 上传 + 版本对比
    - _需求：5.1, 5.2, 5.3, 6.2, 6.3, 6.4, 7.1, 8.1, 8.3, 8.4, 10.2, 10.3, 10.4_

  - [x] 13.4 创建工作空间设置与通知中心页面
    - 创建 `src/app/[locale]/workspace/settings/page.tsx`：套餐信息、存储用量、购买扩充包
    - 创建 `src/app/[locale]/workspace/notifications/page.tsx`：通知列表 + 标记已读
    - _需求：2.1, 2.2, 2.3, 2.5, 2.6_

- [x] 14. 律师注册钩子：自动初始化工作空间
  - 在现有用户注册流程中（`src/app/api/auth/[...nextauth]` 或注册 API）接入 `WorkspaceService.initWorkspace`
  - 律师角色用户注册完成后自动触发，默认套餐为 BASIC
  - _需求：1.1, 1.2, 1.3_

- [x] 15. 期限提醒定时任务
  - 创建 `src/server/jobs/deadlineReminder.ts`，实现每日定时检查逻辑（调用 `DeadlineService.checkDeadlines`）
  - 集成到现有定时任务机制（或通过 Next.js API route + cron 触发）
  - _需求：7.2, 7.3_

- [x] 16. 最终检查点 — 确保所有测试通过，如有疑问请向用户确认

## 备注

- 标有 `*` 的子任务为可选测试任务，可在 MVP 阶段跳过
- 每个任务均引用具体需求条款，确保可追溯性
- 属性测试使用 `fast-check` 库，每条属性最少运行 100 次迭代
- 所有属性测试文件位于 `tests/properties/lawyer-workspace/` 目录
- 单元测试文件位于 `tests/unit/lawyer-workspace/` 目录
