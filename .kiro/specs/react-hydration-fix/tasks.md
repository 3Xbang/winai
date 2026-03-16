# 实施计划

- [x] 1. 编写 Bug Condition 探索性测试
  - **Property 1: Bug Condition** — SSR 与客户端水合输出不一致
  - **重要**: 此测试必须在实施修复之前编写
  - **目标**: 通过反例证明 bug 的存在，确认根因分析
  - **Scoped PBT 方法**: 针对每个组件的具体 bug 条件编写属性测试
  - 测试 Footer：Mock `Date` 使服务端返回 2024、客户端返回 2025，验证年份文本不匹配
  - 测试 MessageBubble：Mock 不同 locale/时区环境，验证 `toLocaleTimeString()` 输出不一致
  - 测试 Navbar：Mock `usePathname` 在 SSR 返回 `/zh/consultation`、客户端返回 `/consultation`，验证 `selectedKeys` 不一致
  - 测试 AntdProvider：模拟 `useLocale()` 在 SSR 和客户端返回不同 locale 值
  - 测试 UserAvatar：验证 SSR 与客户端水合时 DOM 结构可能不一致
  - 测试 LanguageSwitcher：验证 `isPending` 状态在水合阶段的不确定性导致属性不匹配
  - 在未修复代码上运行测试
  - **预期结果**: 测试失败（这是正确的——证明 bug 存在）
  - 记录发现的反例以理解根因
  - 当测试编写完成、运行并记录失败后标记任务完成
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. 编写保留行为属性测试（修复前）
  - **Property 2: Preservation** — 客户端挂载后功能完整性
  - **重要**: 遵循观察优先方法论
  - 观察未修复代码上的正常行为：
  - 观察：Footer 在客户端挂载后正确显示当前年份，链接（privacy/terms/contact）可正常点击
  - 观察：MessageBubble 在客户端挂载后正确显示本地化时间戳格式
  - 观察：UserAvatar 未登录时显示登录/注册按钮，已登录时显示头像和下拉菜单
  - 观察：Navbar 菜单项点击后正确导航并高亮当前页面
  - 观察：LanguageSwitcher 点击后正确切换语言并在切换过程中显示 pending 状态（opacity-50 + cursor-not-allowed）
  - 观察：AntdProvider 正确配置 Ant Design 的 locale（zh→zhCN, th→thTH, en→enUS）
  - 编写属性测试：对于所有非 bug 条件输入（客户端已挂载的正常交互场景），组件行为与修复前一致
  - 属性测试生成多种输入组合以提供更强的保留保证
  - 在未修复代码上运行测试
  - **预期结果**: 测试通过（确认需要保留的基线行为）
  - 当测试编写完成、运行并在未修复代码上通过后标记任务完成
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. 修复 React 水合不匹配错误

  - [x] 3.1 修复 Footer.tsx — 添加 suppressHydrationWarning
    - 在包含 `{t('copyright', { year: String(year) })}` 的 `<p>` 元素上添加 `suppressHydrationWarning` 属性
    - _Bug_Condition: isBugCondition(Footer, 'hydration') where serverEnv.timezone != clientEnv.timezone AND Date crosses year boundary_
    - _Expected_Behavior: SSR 和客户端水合阶段不触发 React error #425，年份差异通过 suppressHydrationWarning 静默处理_
    - _Preservation: 客户端挂载后年份正确显示，链接功能不受影响_
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 3.2 修复 MessageBubble.tsx — 添加 mounted 守卫 + 占位符
    - 添加 `const [mounted, setMounted] = useState(false)` 和 `useEffect(() => setMounted(true), [])`
    - 未挂载时时间戳显示固定占位符 `--:--`
    - 挂载后显示 `message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })`
    - 在时间戳 `<span>` 上添加 `suppressHydrationWarning` 作为额外保护
    - _Bug_Condition: isBugCondition(MessageBubble, 'hydration') where serverEnv.locale != clientEnv.locale OR serverEnv.timezone != clientEnv.timezone_
    - _Expected_Behavior: SSR 输出占位符 "--:--"，客户端水合阶段输出相同占位符，挂载后渲染本地化时间_
    - _Preservation: 客户端挂载后时间戳正确显示本地化格式_
    - _Requirements: 1.2, 2.2, 3.2_

  - [x] 3.3 修复 UserAvatar.tsx — 添加 mounted 守卫 + 骨架占位
    - 添加 `const [mounted, setMounted] = useState(false)` 和 `useEffect(() => setMounted(true), [])`
    - 未挂载时返回与未认证状态相同尺寸的骨架/占位元素，确保布局稳定
    - 挂载后保持现有认证状态判断和 UI 渲染逻辑完全不变
    - _Bug_Condition: isBugCondition(UserAvatar, 'hydration') where useState initialization timing differs between SSR and client_
    - _Expected_Behavior: SSR 和客户端水合阶段渲染相同的占位内容，挂载后渲染完整 UI_
    - _Preservation: 未登录时显示登录/注册按钮，已登录时显示头像和下拉菜单_
    - _Requirements: 1.3, 2.3, 3.3, 3.4_

  - [x] 3.4 修复 Navbar.tsx — 添加 mounted 守卫 + 空 selectedKeys
    - 添加 `const [mounted, setMounted] = useState(false)` 和 `useEffect(() => setMounted(true), [])`
    - 未挂载时将 `selectedKeys` 设为空数组 `[]`，避免 SSR 和客户端路径差异
    - 挂载后使用 `usePathname()` 正常计算 `selectedKey`
    - 同时更新 Drawer 中的 Menu 组件的 `selectedKeys`
    - _Bug_Condition: isBugCondition(Navbar, 'hydration') where usePathname() returns different path format on SSR vs client_
    - _Expected_Behavior: SSR 和客户端水合阶段 selectedKeys 均为空数组，挂载后正确高亮_
    - _Preservation: 客户端挂载后菜单项点击导航和高亮功能正常_
    - _Requirements: 1.4, 2.4, 3.5_

  - [x] 3.5 修复 AntdProvider.tsx + layout.tsx — locale 通过 prop 传递
    - 修改 AntdProvider 组件签名为 `({ children, locale }: { children: React.ReactNode; locale: string })`
    - 优先使用 prop 传入的 locale，保留 `useLocale()` 作为 fallback
    - 在 `layout.tsx` 的 `LocaleLayout` 中传递 `<AntdProvider locale={locale}>`
    - _Bug_Condition: isBugCondition(AntdProvider, 'hydration') where useLocale() returns different value during SSR vs hydration_
    - _Expected_Behavior: locale 通过 server component prop 传递，SSR 和客户端水合阶段值一致_
    - _Preservation: Ant Design 组件的 locale 配置和主题功能不受影响_
    - _Requirements: 1.5, 2.5, 3.6_

  - [x] 3.6 修复 LanguageSwitcher.tsx — 添加 mounted 守卫
    - 添加 `const [mounted, setMounted] = useState(false)` 和 `useEffect(() => setMounted(true), [])`
    - 未挂载时将 `isPending` 视为 `false`：`const effectivePending = mounted ? isPending : false`
    - 确保按钮的 `disabled` 属性和 `opacity-50 cursor-not-allowed` 样式类在 SSR 和水合阶段一致
    - 挂载后恢复正常 transition 行为
    - _Bug_Condition: isBugCondition(LanguageSwitcher, 'hydration') where isPending state is uncertain during hydration_
    - _Expected_Behavior: SSR 和客户端水合阶段 isPending 均为 false，挂载后正常响应 transition 状态_
    - _Preservation: 语言切换功能和 pending 状态显示正常_
    - _Requirements: 1.6, 2.6, 3.7_

  - [x] 3.7 验证 Bug Condition 探索性测试现在通过
    - **Property 1: Expected Behavior** — SSR 与客户端水合输出一致
    - **重要**: 重新运行任务 1 中的相同测试——不要编写新测试
    - 任务 1 的测试编码了期望行为
    - 当此测试通过时，确认期望行为已满足
    - 运行任务 1 中的 bug condition 探索性测试
    - **预期结果**: 测试通过（确认 bug 已修复）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.8 验证保留行为测试仍然通过
    - **Property 2: Preservation** — 客户端挂载后功能完整性
    - **重要**: 重新运行任务 2 中的相同测试——不要编写新测试
    - 运行任务 2 中的保留行为属性测试
    - **预期结果**: 测试通过（确认无回归）
    - 确认修复后所有测试仍然通过（无回归）

- [x] 4. 检查点 — 确保所有测试通过
  - 运行完整测试套件，确保所有测试通过
  - 验证无 React 水合错误（#418、#423、#425）
  - 如有问题，询问用户
