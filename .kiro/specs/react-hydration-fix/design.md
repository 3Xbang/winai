# React 水合不匹配修复 — Bugfix 设计文档

## Overview

本项目的 6 个客户端组件（Footer、MessageBubble、UserAvatar、Navbar、AntdProvider、LanguageSwitcher）在 SSR 阶段使用了依赖运行环境的动态值（时间、时区、locale、客户端状态），导致服务端渲染的 HTML 与客户端水合时的输出不一致，触发 React hydration error #418/#423/#425。

修复策略的核心思路是：对于环境依赖的动态值，采用「mounted 守卫」模式或 `suppressHydrationWarning` 属性，确保首次渲染（SSR）与客户端水合阶段输出完全一致，仅在客户端挂载完成后才渲染动态内容。

## Glossary

- **Bug_Condition (C)**: 组件在 SSR 阶段渲染了依赖运行环境的动态值，导致服务端与客户端输出不一致的条件
- **Property (P)**: 修复后组件在 SSR 和客户端水合阶段应产生完全一致的 HTML 输出
- **Preservation**: 修复不应影响的现有行为——页面功能、交互、SEO、首屏性能
- **Hydration Mismatch**: React 在客户端水合时发现服务端渲染的 HTML 与客户端首次渲染的输出不一致
- **Mounted Guard（挂载守卫）**: 使用 `useEffect` + `useState` 检测客户端挂载完成，在挂载前渲染占位内容，挂载后渲染动态内容
- **suppressHydrationWarning**: React 提供的属性，允许特定元素在水合时忽略文本内容不匹配

## Bug Details

### Bug Condition

当组件在 SSR 阶段直接渲染依赖运行环境的动态值时，由于服务端和客户端的环境差异（时区、locale、状态初始化时序），产生不同的 HTML 输出，触发 React 水合错误。

**Formal Specification:**
```
FUNCTION isBugCondition(component, renderPhase)
  INPUT: component of type ReactComponent, renderPhase of type 'ssr' | 'hydration'
  OUTPUT: boolean

  LET ssrOutput = renderToString(component, serverEnv)
  LET hydrationOutput = renderToString(component, clientEnv)

  RETURN renderPhase == 'hydration'
         AND ssrOutput != hydrationOutput
         AND component uses environmentDependentValue
         AND NOT component.hasMountedGuard
         AND NOT component.hasSuppressHydrationWarning
END FUNCTION
```

### Examples

- **Footer.tsx**: 服务端时区 UTC，客户端时区 UTC+8，在 2024-12-31 23:30 UTC 时，服务端渲染 `© 2024`，客户端渲染 `© 2025` → React error #425
- **MessageBubble.tsx**: 服务端 `toLocaleTimeString()` 输出 `"2:30 PM"`（en-US），客户端输出 `"14:30"`（zh-CN 24小时制）→ React error #425
- **UserAvatar.tsx**: 服务端渲染未认证状态的登录/注册按钮，客户端水合时因 `useState` 初始化时序差异可能渲染不同 DOM 结构 → React error #418
- **Navbar.tsx**: 服务端 `usePathname()` 返回 `/zh/consultation`，客户端返回 `/consultation`（去除 locale 前缀后），导致 `selectedKeys` 不一致 → React error #418
- **AntdProvider.tsx**: 服务端 `useLocale()` 返回值与客户端水合时的值可能因 `NextIntlClientProvider` 初始化时序不同而不一致 → React error #423
- **LanguageSwitcher.tsx**: `useTransition()` 的 `isPending` 在 SSR 时为 `false`，但水合阶段可能因 pending transition 导致不一致 → React error #418

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Footer 在客户端挂载后仍正确显示当前年份
- MessageBubble 在客户端挂载后仍正确显示本地化时间戳
- UserAvatar 在未登录时显示登录/注册按钮，已登录时显示头像和下拉菜单
- Navbar 在客户端挂载后正确高亮当前页面对应的菜单项
- AntdProvider 正确配置 Ant Design 的 locale 和主题
- LanguageSwitcher 正确执行语言切换并显示 pending 状态
- 所有页面保持 SSR 的 SEO 优势和首屏渲染性能
- 鼠标点击、触摸等非水合相关交互不受影响

**Scope:**
修复仅影响组件的初始渲染阶段（SSR → 水合），客户端挂载完成后的所有交互行为不受影响。

## Hypothesized Root Cause

基于代码分析，各组件的根本原因如下：

1. **Footer.tsx — 时区敏感的 Date API**：`new Date().getFullYear()` 在服务端（通常 UTC）和客户端（用户本地时区）可能返回不同值。这是一个经典的 SSR 时间问题。

2. **MessageBubble.tsx — locale 敏感的时间格式化**：`toLocaleTimeString()` 的输出完全依赖运行环境的 locale 和时区设置。服务端 Node.js 环境与浏览器环境的 Intl 实现和默认 locale 可能不同。

3. **UserAvatar.tsx — 客户端状态在 SSR 中的不确定性**：`useMockAuth()` 使用 `useState` 初始化状态，虽然当前值是固定的 `false`，但作为 `'use client'` 组件，React 在水合时可能因组件树结构差异导致状态不匹配。更深层的问题是未来替换为真实 NextAuth session 时，session 状态在 SSR 和客户端必然不同。

4. **Navbar.tsx — usePathname() 的 SSR/客户端差异**：`next-intl` 的 `usePathname()` 在 SSR 阶段可能返回包含 locale 前缀的完整路径，而客户端返回去除前缀的路径，导致 `selectedKey` 计算结果不同。

5. **AntdProvider.tsx — useLocale() 初始化时序**：`useLocale()` 依赖 `NextIntlClientProvider` 的 context。在 SSR 阶段，provider 的 locale 值通过 server component 传入；在客户端水合时，可能存在短暂的 context 值不一致。

6. **LanguageSwitcher.tsx — useTransition() 水合不确定性**：`isPending` 状态在 SSR 时为 `false`，但如果页面加载时有正在进行的 transition（如从其他页面导航过来），水合时 `isPending` 可能为 `true`，导致按钮的 `disabled` 和 `opacity-50` 类不匹配。

## Correctness Properties

Property 1: Bug Condition — SSR 与客户端水合输出一致性

_For any_ 组件在 SSR 阶段渲染时，若该组件包含环境依赖的动态值（时间、locale、客户端状态），修复后的组件 SHALL 在 SSR 和客户端水合阶段产生完全一致的 HTML 输出（或通过 `suppressHydrationWarning` 明确标记允许差异的元素），不触发 React hydration error。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation — 客户端挂载后功能完整性

_For any_ 组件在客户端挂载完成后，修复后的组件 SHALL 产生与原始组件相同的功能行为和视觉输出，包括：年份显示、时间戳格式化、认证状态 UI、菜单高亮、locale 配置、语言切换功能。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

修复策略根据每个组件的具体情况，采用最小侵入性的方案：

**File**: `src/components/Footer.tsx`

**Function**: `Footer`

**Specific Changes**:
1. **使用 suppressHydrationWarning**: 在包含年份的 `<p>` 元素上添加 `suppressHydrationWarning` 属性。这是 Next.js 官方推荐的处理动态时间值的方式，因为年份差异仅在极端时区边界情况下出现，且不影响功能。
   - 在 `{t('copyright', { year: String(year) })}` 所在的 `<p>` 标签添加 `suppressHydrationWarning`

---

**File**: `src/components/chat/MessageBubble.tsx`

**Function**: `MessageBubble`

**Specific Changes**:
1. **添加 mounted 守卫**: 创建 `useMounted()` 自定义 hook（或内联 `useEffect` + `useState`）
2. **条件渲染时间戳**: 在未挂载时渲染固定占位符（如 `--:--`），挂载后渲染 `toLocaleTimeString()` 结果
3. **在时间戳 `<span>` 上添加 `suppressHydrationWarning`** 作为额外保护

---

**File**: `src/components/UserAvatar.tsx`

**Function**: `UserAvatar`

**Specific Changes**:
1. **添加 mounted 守卫**: 在组件内添加 `const [mounted, setMounted] = useState(false)` 和 `useEffect(() => setMounted(true), [])`
2. **未挂载时返回占位内容**: 在 `mounted` 为 `false` 时返回与未认证状态相同尺寸的骨架/占位元素，确保布局稳定
3. **保持现有逻辑不变**: 挂载后的认证状态判断和 UI 渲染逻辑完全不变

---

**File**: `src/components/Navbar.tsx`

**Function**: `Navbar`

**Specific Changes**:
1. **添加 mounted 守卫**: 添加 mounted 状态
2. **延迟 selectedKeys 计算**: 在未挂载时将 `selectedKeys` 设为空数组 `[]`，避免 SSR 和客户端的路径差异导致选中状态不匹配
3. **挂载后恢复正常逻辑**: `mounted` 为 `true` 后使用 `usePathname()` 计算 `selectedKey`

---

**File**: `src/components/AntdProvider.tsx`

**Function**: `AntdProvider`

**Specific Changes**:
1. **接收 locale 作为 prop**: 修改组件签名为 `AntdProvider({ children, locale }: { children: React.ReactNode; locale: string })`
2. **从 layout.tsx 传递 locale**: 在 `LocaleLayout` 中将 `locale` 作为 prop 传递给 `AntdProvider`
3. **保留 useLocale() 作为 fallback**: 如果 prop 未传递，仍使用 `useLocale()` 作为后备
4. **确保 locale 映射逻辑不变**: `antdLocaleMap` 查找逻辑保持不变

---

**File**: `src/components/LanguageSwitcher.tsx`

**Function**: `LanguageSwitcher`

**Specific Changes**:
1. **添加 mounted 守卫**: 添加 mounted 状态
2. **未挂载时固定 isPending 为 false**: 在未挂载时不使用 `isPending` 的值，确保按钮的 `disabled` 和样式类在 SSR 和水合阶段一致
3. **挂载后恢复正常 transition 行为**: `mounted` 为 `true` 后正常使用 `isPending`

---

**File**: `src/app/[locale]/layout.tsx`

**Function**: `LocaleLayout`

**Specific Changes**:
1. **传递 locale prop 给 AntdProvider**: `<AntdProvider locale={locale}>`


## Testing Strategy

### Validation Approach

测试策略分为两个阶段：首先在未修复代码上运行探索性测试以确认 bug 的存在和根因，然后在修复后验证 bug 已解决且现有行为未被破坏。

### Exploratory Bug Condition Checking

**Goal**: 在实施修复前，通过测试复现水合不匹配错误，确认或否定根因分析。如果否定，需要重新假设根因。

**Test Plan**: 使用 React Testing Library 的 `renderToString`（模拟 SSR）和 `hydrateRoot`（模拟客户端水合）对比各组件的输出。在未修复代码上运行以观察失败。

**Test Cases**:
1. **Footer 时区测试**: Mock `Date` 使服务端和客户端返回不同年份，验证输出不一致（will fail on unfixed code）
2. **MessageBubble locale 测试**: Mock 不同的 `Intl` locale 设置，验证 `toLocaleTimeString` 输出不一致（will fail on unfixed code）
3. **Navbar 路径测试**: Mock `usePathname` 返回不同路径格式，验证 `selectedKeys` 不一致（will fail on unfixed code）
4. **AntdProvider locale 测试**: 模拟 `useLocale` 在 SSR 和客户端返回不同值，验证 ConfigProvider locale 不一致（will fail on unfixed code）

**Expected Counterexamples**:
- SSR 输出的 HTML 字符串与客户端水合时的 HTML 字符串不匹配
- 可能原因：环境依赖值在不同运行环境下产生不同输出

### Fix Checking

**Goal**: 验证对于所有触发 bug 条件的输入，修复后的组件产生一致的 SSR 和水合输出。

**Pseudocode:**
```
FOR ALL component WHERE isBugCondition(component, 'hydration') DO
  ssrOutput := renderToString(fixedComponent, serverEnv)
  hydrationOutput := renderToString(fixedComponent, clientEnv)
  ASSERT ssrOutput == hydrationOutput
         OR element.hasSuppressHydrationWarning
END FOR
```

### Preservation Checking

**Goal**: 验证对于所有不触发 bug 条件的输入，修复后的组件与原始组件产生相同的行为。

**Pseudocode:**
```
FOR ALL component WHERE NOT isBugCondition(component, 'hydration') DO
  ASSERT originalComponent.behavior == fixedComponent.behavior
END FOR
```

**Testing Approach**: 属性测试（Property-Based Testing）适用于保留行为验证，因为：
- 可以自动生成大量测试用例覆盖输入域
- 能捕获手动单元测试可能遗漏的边界情况
- 对所有非 bug 输入的行为不变性提供强保证

**Test Plan**: 先在未修复代码上观察正常交互行为（鼠标点击、语言切换等），然后编写属性测试捕获该行为。

**Test Cases**:
1. **Footer 功能保留**: 验证客户端挂载后年份正确显示，链接可点击
2. **MessageBubble 功能保留**: 验证客户端挂载后时间戳正确显示本地化格式
3. **UserAvatar 功能保留**: 验证登录/注册按钮和头像下拉菜单功能正常
4. **Navbar 功能保留**: 验证菜单项点击导航和高亮功能正常
5. **LanguageSwitcher 功能保留**: 验证语言切换功能和 pending 状态显示正常

### Unit Tests

- 测试每个组件在 mounted=false 时渲染占位内容或一致内容
- 测试每个组件在 mounted=true 时渲染完整动态内容
- 测试 Footer 的 `suppressHydrationWarning` 属性存在
- 测试 AntdProvider 接收 locale prop 并正确映射到 Ant Design locale
- 测试 Navbar 在未挂载时 selectedKeys 为空数组

### Property-Based Tests

- 生成随机时区和 locale 组合，验证 Footer 和 MessageBubble 在 SSR 阶段不产生环境依赖输出
- 生成随机路径，验证 Navbar 在未挂载时不依赖 usePathname 的返回值
- 生成随机 locale 值，验证 AntdProvider 通过 prop 接收 locale 时行为一致

### Integration Tests

- 测试完整页面在 SSR → 水合 → 客户端交互的全流程无错误
- 测试语言切换后页面重新渲染无水合错误
- 测试不同路由间导航后 Navbar 高亮状态正确更新
