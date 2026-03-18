# 需求文档：律师工作空间（Lawyer Workspace）

## 简介

律师工作空间是 winaii.com 中泰法律平台的 SaaS 核心功能模块，专为执业律师设计。
该模块提供智能证据管理、案件记忆与会见准备、律师-客户专属沟通频道、订阅套餐与专属存储、
保密权限控制，以及期限管理、费用记录、利益冲突检查、文件版本管理等辅助功能。

用户角色：律师（付费订阅用户）、客户（免费/低价用户）、律所管理员。

技术栈：Next.js 14、TypeScript、PostgreSQL（Prisma）、Redis、AWS S3、GLM AI。

---

## 词汇表

- **Workspace**：律师工作空间，每位律师注册后自动创建的专属工作环境
- **Case**：案件，律师在工作空间内创建和管理的法律事务单元
- **Evidence**：证据，与案件关联的文件、图片、录音或视频材料
- **Evidence_Classifier**：AI 证据分类器，负责对上传证据进行自动分类和标注
- **Evidence_List**：证据清单，由系统生成的结构化证据汇总文档
- **Case_Timeline**：案件时间线，记录案件从立案到当前的所有关键事件
- **Visit_Summary**：会见摘要，会见前由系统自动生成的案情温习文档
- **Visit_Record**：会见记录，律师在会见后填写的处理结果与下一步策略
- **Channel**：沟通频道，律师与客户之间的专属异步通信通道
- **Storage_Quota**：存储配额，订阅套餐对应的 S3 存储空间上限
- **Subscription**：订阅套餐，律师购买的服务等级（基础版/专业版/事务所版）
- **Conflict_Checker**：利益冲突检查器，检测新案件与现有案件是否存在对立方冲突
- **Deadline_Manager**：期限管理器，负责追踪和提醒诉讼时效、开庭日期等关键期限
- **Fee_Record**：费用记录，律师每次工作的时间和费用条目
- **Document_Version**：文件版本，合同、诉状等文件的历史版本快照
- **Firm_Admin**：律所管理员，可查看所属律师全部案件的特权用户
- **GLM_AI**：智谱 AI 大语言模型，用于证据分析、摘要生成等 AI 功能

---

## 需求列表

### 需求 1：工作空间初始化

**用户故事：** 作为律师，我希望注册后自动获得专属工作空间，以便立即开始管理案件和文件。

#### 验收标准

1. WHEN 律师完成注册，THE Workspace SHALL 自动为该律师创建专属工作空间记录
2. WHEN 工作空间创建完成，THE Workspace SHALL 在 AWS S3 中为该律师分配独立存储路径（格式：`workspaces/{lawyerId}/`）
3. WHEN 工作空间创建完成，THE Workspace SHALL 根据律师选择的套餐初始化对应的 Storage_Quota
4. THE Workspace SHALL 确保每位律师的存储路径与其他律师物理隔离，不共享任何 S3 前缀

---

### 需求 2：订阅套餐管理

**用户故事：** 作为律师，我希望选择适合自己的订阅套餐，以便按需获取存储空间和功能权限。

#### 验收标准

1. THE Subscription SHALL 提供三个套餐等级：基础版（5 GB）、专业版（50 GB）、事务所版（500 GB）
2. THE Subscription SHALL 采用年费制计费周期
3. WHEN 律师购买额外存储扩充包，THE Subscription SHALL 在当前套餐配额基础上叠加对应容量
4. WHEN 律师上传文件导致已用空间超出 Storage_Quota，THE Workspace SHALL 拒绝本次上传并返回提示升级套餐的错误信息
5. WHILE 律师订阅有效，THE Workspace SHALL 允许律师访问对应套餐的全部功能
6. IF 律师订阅到期未续费，THEN THE Workspace SHALL 将工作空间切换为只读状态，禁止新增案件和上传文件

---

### 需求 3：案件管理

**用户故事：** 作为律师，我希望在工作空间内创建和管理案件，以便集中追踪每个案件的完整信息。

#### 验收标准

1. WHEN 律师创建案件，THE Case SHALL 记录案件编号、案由、当事人信息、立案日期和关联客户
2. THE Case SHALL 维护完整的 Case_Timeline，记录从立案到当前的所有关键事件及操作日志
3. WHEN 律师更新案件状态，THE Case_Timeline SHALL 自动追加带时间戳的事件条目
4. THE Case SHALL 确保律师只能访问自己创建或被授权的案件，不得访问其他律师的案件数据
5. WHERE 律所管理员账户，THE Case SHALL 允许 Firm_Admin 查看所属律师的全部案件

---

### 需求 4：智能证据管理

**用户故事：** 作为律师，我希望上传证据后由 AI 自动分类和标注，以便快速判断证据价值和胜诉方向。

#### 验收标准

1. WHEN 律师上传证据文件（支持格式：图片、PDF、Word、录音、视频），THE Evidence SHALL 将文件存储至该律师的专属 S3 路径
2. WHEN 证据文件上传完成，THE Evidence_Classifier SHALL 调用 GLM_AI 对证据进行分类，结果为以下三类之一：有效证据、无效证据、需补充
3. WHEN Evidence_Classifier 完成分类，THE Evidence_Classifier SHALL 为每条证据标注证明目的、适用法律依据和证明力强弱（强/中/弱）
4. WHEN Evidence_Classifier 完成分类，THE Evidence_Classifier SHALL 引用至少一个类似案例支撑证据价值判断
5. IF GLM_AI 调用失败，THEN THE Evidence_Classifier SHALL 将证据标记为"待分类"状态，并在 AI 服务恢复后重新触发分类
6. WHEN 律师请求生成证据清单，THE Evidence_List SHALL 汇总案件内所有证据的分类、标注和证明力，生成结构化清单文档
7. THE Evidence_List SHALL 在清单顶部标注当前证据组合对应的胜诉方向评估

---

### 需求 5：会见准备与记录

**用户故事：** 作为律师，我希望每次会见前获得案情摘要，会见后记录结论，以便提升会见效率并避免重复询问。

#### 验收标准

1. WHEN 律师触发"生成会见摘要"操作，THE Visit_Summary SHALL 调用 GLM_AI 基于 Case_Timeline 和历史 Visit_Record 生成不超过 500 字的案情摘要
2. THE Visit_Summary SHALL 在摘要中突出显示上次会见结论和待确认事项
3. WHEN 律师提交会见记录，THE Visit_Record SHALL 保存处理结果、下一步策略和会见时间戳
4. WHEN 律师查看案件详情，THE Case SHALL 在显眼位置展示最近一次 Visit_Record 的结论和下一步策略
5. IF 案件尚无任何 Visit_Record，THEN THE Visit_Summary SHALL 仅基于 Case_Timeline 生成初始案情摘要

---

### 需求 6：律师-客户专属沟通频道

**用户故事：** 作为律师，我希望通过专属频道向客户发布工作进展，以便减少电话沟通并留存沟通记录。

#### 验收标准

1. WHEN 案件创建完成，THE Channel SHALL 自动为该案件创建律师与关联客户之间的专属沟通频道
2. WHEN 律师在 Channel 发布工作进展，THE Channel SHALL 向关联客户发送站内通知
3. WHEN 律师更新案件阶段，THE Channel SHALL 向客户推送阶段变更通知，说明当前所处阶段
4. WHEN 客户在 Channel 上传新材料或补充说明，THE Channel SHALL 向律师发送站内通知
5. THE Channel SHALL 永久保存双方全部沟通记录，不得删除
6. THE Channel SHALL 确保客户只能访问自己参与案件的 Channel，不得访问其他案件的频道

---

### 需求 7：期限管理

**用户故事：** 作为律师，我希望系统自动追踪关键法律期限并提前提醒，以便避免因超期导致的法律风险。

#### 验收标准

1. WHEN 律师为案件添加期限条目（类型：诉讼时效、开庭日期、上诉截止、其他），THE Deadline_Manager SHALL 保存期限类型、截止日期和关联案件
2. WHEN 距离截止日期剩余 7 天，THE Deadline_Manager SHALL 向律师发送站内提醒通知
3. WHEN 距离截止日期剩余 1 天，THE Deadline_Manager SHALL 再次向律师发送站内提醒通知
4. IF 截止日期已过且律师未标记为已处理，THEN THE Deadline_Manager SHALL 在案件详情页显示逾期警告标识

---

### 需求 8：费用记录

**用户故事：** 作为律师，我希望记录每次工作的时间和费用，以便向客户提供透明的账单。

#### 验收标准

1. WHEN 律师提交费用记录，THE Fee_Record SHALL 保存工作描述、工时（小时）、费用金额、货币单位和工作日期
2. THE Fee_Record SHALL 关联到具体案件，支持按案件汇总费用
3. WHEN 客户查看关联案件的费用明细，THE Fee_Record SHALL 展示该案件下所有已标记为"客户可见"的费用条目及汇总金额
4. THE Fee_Record SHALL 允许律师将费用条目标记为"仅内部"或"客户可见"

---

### 需求 9：利益冲突检查

**用户故事：** 作为律师，我希望在接受新案件前自动检查利益冲突，以便遵守职业道德规范。

#### 验收标准

1. WHEN 律师创建新案件并填写对立方信息，THE Conflict_Checker SHALL 自动检索该律师工作空间内所有现有案件的当事人信息
2. WHEN Conflict_Checker 检测到新案件对立方与现有案件当事人存在重叠，THE Conflict_Checker SHALL 向律师展示冲突警告，列出冲突案件编号和当事人姓名
3. IF 未检测到利益冲突，THEN THE Conflict_Checker SHALL 显示"无冲突"确认信息，允许律师继续创建案件
4. THE Conflict_Checker SHALL 在律师确认知悉冲突警告后，允许律师自主决定是否继续创建案件

---

### 需求 10：文件版本管理

**用户故事：** 作为律师，我希望对合同和诉状等文件进行版本管理，以便追踪修改历史并对比差异。

#### 验收标准

1. WHEN 律师上传同名文件或主动创建新版本，THE Document_Version SHALL 保存新版本文件并保留所有历史版本
2. THE Document_Version SHALL 为每个版本记录版本号、上传时间、上传人和版本备注
3. WHEN 律师选择两个版本进行对比，THE Document_Version SHALL 展示两个版本之间的差异内容
4. THE Document_Version SHALL 允许律师将任意历史版本标记为当前有效版本

---

### 需求 11：访问日志与审计

**用户故事：** 作为律所管理员，我希望所有文件访问操作均有日志记录，以便满足合规审计要求。

#### 验收标准

1. WHEN 任意用户访问、下载或删除 Evidence 或 Document_Version 文件，THE Workspace SHALL 记录操作类型、操作人、操作时间和文件标识
2. THE Workspace SHALL 将访问日志存储至独立的审计日志表，不得修改或删除已有日志条目
3. WHERE Firm_Admin 账户，THE Workspace SHALL 允许 Firm_Admin 查询所属律师的全部访问日志
4. THE Workspace SHALL 确保普通律师和客户无法访问审计日志

---

### 需求 12：解析器与序列化（证据清单导出）

**用户故事：** 作为律师，我希望将证据清单导出为标准格式文件，以便在庭审中提交或与当事人共享。

#### 验收标准

1. WHEN 律师请求导出证据清单，THE Evidence_List SHALL 将清单数据序列化为 PDF 或 Word 格式文件
2. THE Evidence_List SHALL 提供将导出文件重新解析为系统内部数据结构的导入功能
3. FOR ALL 有效的证据清单数据对象，导出后再导入 SHALL 产生与原始对象等价的数据结构（往返属性）

---

### 需求 13：UI 视觉设计规范

**用户故事：** 作为律师，我希望工作空间界面视觉轻松活泼、操作区域宽敞，以便在高强度工作中减轻视觉疲劳。

#### 验收标准

1. THE Workspace UI SHALL 采用柔和色调（非纯黑/纯白），主色调以温暖中性色或浅蓝绿色为主，避免压迫感
2. THE Workspace UI SHALL 在案件列表和案件详情页使用大字号（正文不小于 16px）、大间距（卡片内边距不小于 24px），确保内容一目了然
3. THE Case 卡片 SHALL 在列表视图中占据足够大的展示区域，核心信息（案件名称、当事人、最新进展、紧急期限）无需点击即可直接看到
4. THE Workspace UI SHALL 在关键操作按钮（新建案件、生成摘要、上传证据）上使用圆角设计和适度的色彩区分，降低视觉紧张感
5. THE Workspace UI SHALL 在仪表盘首页提供"今日待办"和"紧急期限"的醒目卡片，让律师进入页面后 3 秒内掌握当天重点
6. THE Workspace UI SHALL 避免密集的表格布局，优先使用卡片式布局展示案件和证据信息
