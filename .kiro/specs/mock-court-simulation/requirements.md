# 需求文档：模拟法庭

## 简介

模拟法庭（Mock Court）是 WINAI 中泰跨境法律智能平台的新增功能模块。该功能允许用户在 AI 驱动的虚拟法庭环境中模拟真实庭审流程，练习法律论辩技巧。AI 将扮演法官、对方律师、证人等角色，与用户进行多轮交互式庭审对抗。用户可以基于自定义案情或从平台已有的案件分析中导入案件信息，选择适用的法律管辖区（中国法院或泰国法院），体验完整的庭审流程（开庭陈述、举证质证、法庭辩论、最后陈述）。庭审结束后，AI 将生成详细的表现评估报告，帮助用户提升法律实务能力。

该功能面向法学生、初级律师、企业法务人员以及需要了解庭审流程的普通用户，尤其适用于中泰跨境法律纠纷场景的庭审准备。

## 术语表

- **Mock_Court_Session**: 一次完整的模拟法庭会话，包含案件配置、庭审过程和评估报告
- **Court_Phase**: 庭审阶段，包括 OPENING（开庭陈述）、EVIDENCE（举证质证）、DEBATE（法庭辩论）、CLOSING（最后陈述）、VERDICT（判决）
- **User_Role**: 用户在模拟法庭中扮演的角色，包括 PLAINTIFF_LAWYER（原告律师）、DEFENDANT_LAWYER（被告律师）
- **AI_Role**: AI 在模拟法庭中扮演的角色，包括 JUDGE（法官）、OPPOSING_COUNSEL（对方律师）、WITNESS（证人）
- **Case_Config**: 案件配置信息，包含案件类型、案情描述、当事人信息、管辖区、适用法律等
- **Case_Type**: 案件类型，包括 CONTRACT_DISPUTE（合同纠纷）、TORT（侵权纠纷）、LABOR_DISPUTE（劳动争议）、IP_DISPUTE（知识产权纠纷）、CROSS_BORDER_TRADE（跨境贸易纠纷）、OTHER（其他）
- **Jurisdiction**: 法律管辖区，包括 CHINA（中国法院）、THAILAND（泰国法院）、ARBITRATION（仲裁庭）
- **Difficulty_Level**: 模拟难度等级，包括 BEGINNER（初级）、INTERMEDIATE（中级）、ADVANCED（高级）
- **Performance_Report**: 庭审结束后 AI 生成的表现评估报告，包含各维度评分和改进建议
- **Court_Message**: 模拟法庭中的一条消息，包含发言角色、内容和所属庭审阶段
- **Phase_Transition**: 庭审阶段的切换，由 AI 法官根据庭审进展主动推进或由用户请求推进
- **Evidence_Item**: 庭审中提交的证据项，包含证据名称、类型、描述和关联方
- **Objection**: 庭审中的异议，用户或 AI 对方律师可以提出异议，由 AI 法官裁定
- **Score_Dimension**: 评估维度，包括法律论证质量、证据运用能力、程序规范性、应变能力、语言表达
- **Session_Transcript**: 庭审完整记录，可导出为 PDF 格式
- **Draft_Form**: 合同起草表单 UI 组件
- **Case_Analysis_Service**: 案件分析服务，提供案件评估和诉讼策略
- **Evidence_Service**: 证据管理服务，提供证据清单和评估
- **LLM_Gateway**: AI 大语言模型网关服务，支持多模型调用
- **i18n_System**: next-intl 国际化系统，支持 zh、en、th 三种语言

## 需求

### 需求 1：模拟法庭会话创建与案件配置

**用户故事：** 作为一名法学生或法律从业者，我希望能够创建模拟法庭会话并配置案件信息，以便在贴近真实的庭审环境中练习法律论辩。

#### 验收标准

1. WHEN 用户进入模拟法庭页面，THE Mock_Court_Session 创建表单 SHALL 显示以下配置字段：Case_Type 选择器、案情描述文本框、管辖区 Jurisdiction 选择器、用户角色 User_Role 选择器、难度等级 Difficulty_Level 选择器
2. THE Mock_Court_Session 创建表单 SHALL 要求用户填写案情描述（最少 50 个字符，最多 5000 个字符）
3. WHEN 用户选择 Case_Type 后，THE 创建表单 SHALL 显示该案件类型对应的补充配置字段（如合同纠纷需填写合同金额、违约方；劳动争议需填写劳动关系类型、争议焦点）
4. THE Mock_Court_Session 创建表单 SHALL 默认将 Jurisdiction 设置为 CHINA，Difficulty_Level 设置为 BEGINNER，User_Role 设置为 PLAINTIFF_LAWYER
5. WHEN 用户点击"开始模拟"按钮且所有必填字段已填写，THE 系统 SHALL 创建一个新的 Mock_Court_Session 并进入庭审界面
6. IF 用户提交表单时存在未填写的必填字段，THEN THE 创建表单 SHALL 阻止提交并在对应字段显示验证错误提示

### 需求 2：从已有案件分析导入案情

**用户故事：** 作为一名已经使用过平台案件分析功能的用户，我希望能够将已有的案件分析结果直接导入模拟法庭，以便无需重复输入案情信息即可开始庭审模拟。

#### 验收标准

1. THE Mock_Court_Session 创建表单 SHALL 提供"从案件分析导入"按钮
2. WHEN 用户点击"从案件分析导入"按钮，THE 系统 SHALL 显示该用户历史案件分析会话列表，按创建时间倒序排列
3. WHEN 用户选择一个历史案件分析会话，THE 系统 SHALL 自动填充 Case_Config 中的案情描述、案件类型和管辖区字段
4. WHEN 案件分析数据导入完成后，THE 创建表单 SHALL 允许用户修改任何已导入的字段值
5. IF 用户没有任何历史案件分析记录，THEN THE 系统 SHALL 显示提示信息引导用户先使用案件分析功能或手动填写案情

### 需求 3：庭审流程与阶段管理

**用户故事：** 作为一名模拟法庭参与者，我希望庭审按照真实法庭的流程分阶段进行，以便我能系统地练习每个庭审环节的技巧。

#### 验收标准

1. THE Mock_Court_Session SHALL 按照以下顺序执行庭审阶段：OPENING（开庭陈述）→ EVIDENCE（举证质证）→ DEBATE（法庭辩论）→ CLOSING（最后陈述）→ VERDICT（判决）
2. WHEN 庭审进入新阶段时，THE AI 法官 SHALL 发送一条阶段引导消息，说明当前阶段的规则和用户应执行的操作
3. WHILE 庭审处于 OPENING 阶段，THE AI 法官 SHALL 先宣布开庭并介绍案件基本信息，然后要求用户（作为一方律师）进行开庭陈述，随后 AI 对方律师进行开庭陈述
4. WHILE 庭审处于 EVIDENCE 阶段，THE 系统 SHALL 允许用户提交证据项（Evidence_Item），AI 对方律师对证据进行质证，AI 法官对证据采纳作出裁定
5. WHILE 庭审处于 DEBATE 阶段，THE 系统 SHALL 支持用户与 AI 对方律师进行多轮法庭辩论，AI 法官在必要时进行引导或制止
6. WHILE 庭审处于 CLOSING 阶段，THE AI 法官 SHALL 要求双方进行最后陈述，用户先进行陈述，随后 AI 对方律师进行陈述
7. WHEN 所有庭审阶段完成后，THE AI 法官 SHALL 进入 VERDICT 阶段并宣布模拟判决结果，包含判决理由和法律依据
8. THE 庭审界面 SHALL 在顶部显示当前庭审阶段的进度指示器，标明已完成、当前和待进行的阶段

### 需求 4：AI 角色交互与对抗

**用户故事：** 作为一名模拟法庭参与者，我希望 AI 能够真实地扮演法官和对方律师角色，提供有挑战性的对抗体验，以便我能在接近真实的对抗环境中提升能力。

#### 验收标准

1. THE AI 法官 SHALL 在整个庭审过程中维持中立、权威的角色，按照所选 Jurisdiction 的程序规则主持庭审
2. THE AI 对方律师 SHALL 根据 Difficulty_Level 调整对抗强度：BEGINNER 级别提出基础性反驳，INTERMEDIATE 级别引用具体法条进行反驳，ADVANCED 级别运用复杂法律推理和判例进行全面对抗
3. WHEN 用户发送一条庭审发言，THE AI 对方律师 SHALL 在回复中针对用户论点的薄弱环节进行反驳
4. WHEN 用户或 AI 对方律师提出 Objection 时，THE AI 法官 SHALL 根据程序规则裁定异议是否成立，并说明裁定理由
5. WHILE Jurisdiction 设置为 CHINA，THE AI 法官和 AI 对方律师 SHALL 引用中国法律条文（如《民法典》、《民事诉讼法》等）进行论述
6. WHILE Jurisdiction 设置为 THAILAND，THE AI 法官和 AI 对方律师 SHALL 引用泰国法律条文（如 Civil and Commercial Code、Civil Procedure Code 等）进行论述
7. WHILE Jurisdiction 设置为 ARBITRATION，THE AI 法官 SHALL 以仲裁员身份主持程序，引用相关仲裁规则（如 CIETAC 规则、TAI 规则等）
8. THE AI 各角色 SHALL 在每条消息中明确标注发言角色（法官/对方律师/证人），以便用户区分不同角色的发言

### 需求 5：证据提交与质证

**用户故事：** 作为一名模拟法庭参与者，我希望能够在举证阶段提交证据并经历质证过程，以便练习证据组织和质证应对技巧。

#### 验收标准

1. WHILE 庭审处于 EVIDENCE 阶段，THE 庭审界面 SHALL 显示"提交证据"按钮，允许用户添加 Evidence_Item
2. WHEN 用户提交一项 Evidence_Item，THE 系统 SHALL 要求用户填写证据名称、证据类型（书证、物证、证人证言、鉴定意见、电子数据等）、证据描述和证明目的
3. WHEN 用户提交 Evidence_Item 后，THE AI 对方律师 SHALL 对该证据进行质证，提出真实性、合法性或关联性方面的质疑
4. WHEN AI 对方律师完成质证后，THE AI 法官 SHALL 对证据的采纳作出裁定（采纳、部分采纳或不予采纳），并说明理由
5. THE 庭审界面 SHALL 维护一个证据清单面板，显示所有已提交证据及其采纳状态
6. WHEN 用户从已有案件分析导入案情时，IF 该案件分析包含证据信息，THEN THE 系统 SHALL 将证据信息预填充到证据清单中供用户在举证阶段使用

### 需求 6：异议机制

**用户故事：** 作为一名模拟法庭参与者，我希望能够在庭审中提出异议，并体验法官裁定异议的过程，以便练习庭审中的程序性应对技巧。

#### 验收标准

1. THE 庭审界面 SHALL 在每个庭审阶段（VERDICT 阶段除外）提供"提出异议"按钮
2. WHEN 用户点击"提出异议"按钮，THE 系统 SHALL 显示异议类型选择器，包含以下选项：与案件无关（irrelevant）、传闻证据（hearsay）、引导性提问（leading question）、未回答问题（non-responsive）、其他
3. WHEN 用户提交异议后，THE AI 法官 SHALL 裁定异议是否成立，说明裁定理由，并指示庭审如何继续
4. THE AI 对方律师 SHALL 在适当时机主动向用户的发言提出异议，用户需要对异议进行回应
5. WHEN AI 对方律师提出异议时，THE 系统 SHALL 暂停正常庭审流程，等待用户回应异议后再继续

### 需求 7：庭审表现评估报告

**用户故事：** 作为一名模拟法庭参与者，我希望在庭审结束后获得详细的表现评估报告，以便了解自己的优势和不足并有针对性地改进。

#### 验收标准

1. WHEN 庭审进入 VERDICT 阶段且 AI 法官宣布判决后，THE 系统 SHALL 自动生成 Performance_Report
2. THE Performance_Report SHALL 包含以下 Score_Dimension 的评分（每项 1-10 分）：法律论证质量、证据运用能力、程序规范性、应变能力、语言表达
3. THE Performance_Report SHALL 包含每个 Score_Dimension 的详细文字评价，指出具体的优点和不足
4. THE Performance_Report SHALL 包含针对用户表现的具体改进建议，引用庭审中的具体发言作为示例
5. THE Performance_Report SHALL 包含一个总体评分（各维度加权平均）和总体评语
6. THE Performance_Report SHALL 列出用户在庭审中引用的法律条文，并标注引用是否准确
7. WHEN Performance_Report 生成完成后，THE 庭审界面 SHALL 显示评估报告页面，用户可以查看各维度评分和详细反馈

### 需求 8：庭审记录与导出

**用户故事：** 作为一名模拟法庭参与者，我希望能够查看和导出完整的庭审记录，以便日后复习和参考。

#### 验收标准

1. THE 系统 SHALL 保存每次 Mock_Court_Session 的完整 Session_Transcript，包含所有 Court_Message 及其角色标注和阶段标注
2. THE 庭审界面 SHALL 提供"导出记录"按钮，允许用户将 Session_Transcript 导出为 PDF 格式
3. THE 导出的 PDF SHALL 包含案件配置信息、庭审各阶段的完整对话记录、判决结果和 Performance_Report
4. THE 系统 SHALL 在用户的历史记录页面显示所有已完成的 Mock_Court_Session，按完成时间倒序排列
5. WHEN 用户点击历史记录中的某个 Mock_Court_Session，THE 系统 SHALL 显示该会话的完整庭审记录和评估报告

### 需求 9：模拟法庭 AI 提示词工程

**用户故事：** 作为系统，我需要为模拟法庭的各 AI 角色配置精确的系统提示词，以便通用大语言模型能够准确扮演法官、对方律师等角色，提供专业且符合法律程序的庭审模拟体验。

#### 验收标准

1. THE JUDGE_SYSTEM_PROMPT SHALL 定义 AI 角色为"中泰跨境模拟法庭审判长"，并包含以下指令：维持庭审秩序、按程序规则推进庭审阶段、对证据采纳和异议作出裁定、在 VERDICT 阶段基于双方论点和证据作出合理判决
2. THE JUDGE_SYSTEM_PROMPT SHALL 根据 Jurisdiction 配置包含对应的程序法规则：CHINA 引用《民事诉讼法》庭审程序规定，THAILAND 引用 Civil Procedure Code 庭审程序规定，ARBITRATION 引用相关仲裁规则
3. THE OPPOSING_COUNSEL_SYSTEM_PROMPT SHALL 定义 AI 角色为"对方代理律师"，并包含以下指令：根据 Difficulty_Level 调整对抗策略、针对用户论点薄弱环节进行反驳、在适当时机提出异议、引用具体法律条文支持论点
4. THE OPPOSING_COUNSEL_SYSTEM_PROMPT SHALL 根据 Difficulty_Level 包含不同的对抗策略指令：BEGINNER 仅进行基础事实层面反驳，INTERMEDIATE 结合法条和基本法理进行反驳，ADVANCED 运用判例、法学理论和复杂法律推理进行全面对抗
5. THE WITNESS_SYSTEM_PROMPT SHALL 定义 AI 角色为案件相关证人，并包含以下指令：基于案情描述生成合理的证人背景、回答提问时保持角色一致性、在交叉询问中表现出合理的紧张或犹豫
6. EVERY 模拟法庭 AI 系统提示词 SHALL 符合平台 Prompt_Standard：包含角色定义、中泰跨境法律专业资质说明、输出格式规则、以及法律免责声明指令
7. THE 模拟法庭 AI 系统提示词 SHALL 包含 `{{caseConfig}}` 占位符，在会话开始时填充用户配置的案件信息
8. THE 模拟法庭 AI 系统提示词 SHALL 包含 `{{currentPhase}}` 占位符，确保 AI 角色的行为与当前庭审阶段一致

### 需求 10：国际化支持

**用户故事：** 作为一名使用中文、英文或泰文的用户，我希望模拟法庭的所有界面元素都以我选择的语言显示，以便我能舒适地使用该功能。

#### 验收标准

1. THE i18n_System SHALL 包含模拟法庭所有 UI 标签、按钮文本、提示信息和阶段名称的 zh、en、th 三语翻译键
2. THE 庭审界面 SHALL 使用 i18n_System 的翻译渲染所有固定 UI 文本（阶段名称、按钮标签、表单标签等）
3. WHEN 用户切换语言时，THE 庭审界面 SHALL 以选定语言重新渲染所有 UI 文本，且不丢失当前庭审进度和已输入的内容
4. THE AI 角色 SHALL 根据用户的当前语言设置生成对应语言的庭审发言内容

### 需求 11：会话数据持久化

**用户故事：** 作为一名用户，我希望模拟法庭的会话数据能够被保存，以便我可以中断后继续庭审或日后查看历史记录。

#### 验收标准

1. THE 系统 SHALL 将每个 Mock_Court_Session 的配置信息、庭审消息和当前阶段状态持久化到数据库
2. WHEN 用户离开庭审页面后重新进入，THE 系统 SHALL 恢复该 Mock_Court_Session 到用户离开时的状态，包括当前阶段、已发送的消息和证据清单
3. IF 用户的网络连接中断，THEN THE 系统 SHALL 在连接恢复后自动同步未保存的消息
4. THE 系统 SHALL 在用户的个人中心显示进行中和已完成的 Mock_Court_Session 列表
5. WHEN 用户删除一个 Mock_Court_Session，THE 系统 SHALL 将该会话标记为已删除（软删除），保留数据 30 天后永久删除

### 需求 12：访问控制与使用限制

**用户故事：** 作为平台运营者，我希望模拟法庭功能受到合理的访问控制和使用限制，以便管理资源消耗并激励用户升级订阅。

#### 验收标准

1. THE 系统 SHALL 要求用户登录后才能访问模拟法庭功能
2. WHILE 用户的订阅等级为 FREE，THE 系统 SHALL 限制用户每月创建的 Mock_Court_Session 数量为 2 次，且仅允许选择 BEGINNER 难度
3. WHILE 用户的订阅等级为 STANDARD，THE 系统 SHALL 限制用户每月创建的 Mock_Court_Session 数量为 10 次，允许选择 BEGINNER 和 INTERMEDIATE 难度
4. WHILE 用户的订阅等级为 VIP，THE 系统 SHALL 不限制 Mock_Court_Session 创建次数，允许选择所有难度等级
5. IF 用户达到当月 Mock_Court_Session 创建上限，THEN THE 系统 SHALL 禁用"开始模拟"按钮并显示升级订阅的提示信息
6. THE 系统 SHALL 将每次 Mock_Court_Session 的创建计入用户的 UsageRecord
