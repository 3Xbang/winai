# Bugfix 需求文档

## 简介

Next.js App Router 应用中存在多处 React 水合（Hydration）不匹配错误（React error #425、#418、#423）。这些错误源于服务端渲染（SSR）与客户端渲染产生不同的 HTML 输出，导致用户在页面加载时看到控制台报错，严重时可能导致整个页面回退到客户端渲染，影响性能和 SEO。

涉及的组件包括：Footer.tsx、MessageBubble.tsx、UserAvatar.tsx、Navbar.tsx、AntdProvider.tsx 和 LanguageSwitcher.tsx。根本原因是在渲染阶段直接使用了依赖运行环境的动态值（时间、时区、locale、客户端状态），导致服务端和客户端输出不一致。

## Bug 分析

### 当前行为（缺陷）

1.1 WHEN Footer 组件在服务端渲染时执行 `new Date().getFullYear()`，且服务端与客户端处于不同时区（如跨年时刻 UTC vs UTC+7/UTC+8） THEN 系统产生年份文本不匹配，触发 React error #425（文本内容不匹配）

1.2 WHEN MessageBubble 组件渲染消息时间戳并调用 `message.timestamp.toLocaleTimeString()` THEN 系统因服务端与客户端的 locale 和时区配置不同而产生不同的时间格式字符串，触发 React error #425（文本内容不匹配）

1.3 WHEN UserAvatar 组件在服务端渲染时，`useMockAuth()` 中的 `useState(false)` 初始化认证状态 THEN 系统可能因 React 水合过程中状态初始化时序问题导致服务端与客户端渲染的 DOM 结构不一致，触发 React error #418（水合内容不匹配）

1.4 WHEN Navbar 组件在服务端渲染时使用 `usePathname()` 获取路径，且 next-intl 路由在初始渲染时路径解析结果与客户端不一致 THEN 系统产生菜单选中状态不匹配，触发 React error #418（水合内容不匹配）

1.5 WHEN AntdProvider 组件在服务端渲染时通过 `useLocale()` 获取 locale 并配置 Ant Design 主题 THEN 系统可能因服务端与客户端 locale 解析时序差异导致 Ant Design 组件渲染的 locale 相关内容不匹配，触发 React error #423（水合错误）

1.6 WHEN LanguageSwitcher 组件使用 `useTransition()` 管理 pending 状态并结合 `router.replace()` 进行路由切换 THEN 系统可能因 transition 状态在水合阶段的不确定性导致按钮的 disabled 属性和样式类在服务端与客户端不一致，触发 React error #418（水合内容不匹配）

### 期望行为（正确）

2.1 WHEN Footer 组件渲染版权年份时 THEN 系统 SHALL 确保年份值在服务端和客户端一致输出，避免因时区差异导致文本不匹配（例如使用 `suppressHydrationWarning` 或延迟到客户端挂载后再渲染动态年份）

2.2 WHEN MessageBubble 组件渲染消息时间戳时 THEN 系统 SHALL 确保时间格式在服务端和客户端一致（例如仅在客户端挂载后渲染本地化时间，或在服务端使用固定格式/占位符）

2.3 WHEN UserAvatar 组件渲染认证状态相关 UI 时 THEN 系统 SHALL 确保初始渲染输出在服务端和客户端完全一致（例如添加 mounted 状态守卫，在客户端挂载前渲染一致的占位内容）

2.4 WHEN Navbar 组件渲染导航菜单并高亮当前路径时 THEN 系统 SHALL 确保 `usePathname()` 的返回值在水合阶段与服务端一致，菜单选中状态不产生不匹配（例如延迟路径匹配到客户端挂载后，或使用 mounted 守卫）

2.5 WHEN AntdProvider 组件配置 Ant Design locale 时 THEN 系统 SHALL 确保 locale 配置在服务端和客户端渲染阶段保持一致，不产生水合错误（例如确保 locale 通过 props 从服务端传递而非仅依赖客户端 hook）

2.6 WHEN LanguageSwitcher 组件初始渲染时 THEN 系统 SHALL 确保 `useTransition()` 的 `isPending` 状态在水合阶段为 `false`，按钮的 disabled 属性和样式类在服务端与客户端一致

### 不变行为（回归预防）

3.1 WHEN 用户正常浏览页面时 THEN 系统 SHALL CONTINUE TO 正确显示 Footer 中的版权年份信息

3.2 WHEN 用户在聊天界面查看消息时 THEN 系统 SHALL CONTINUE TO 正确显示每条消息的时间戳

3.3 WHEN 用户处于未登录状态时 THEN 系统 SHALL CONTINUE TO 在 UserAvatar 位置显示登录/注册按钮

3.4 WHEN 用户处于已登录状态时 THEN 系统 SHALL CONTINUE TO 在 UserAvatar 位置显示用户头像和下拉菜单

3.5 WHEN 用户在不同页面间导航时 THEN 系统 SHALL CONTINUE TO 在 Navbar 中正确高亮当前页面对应的菜单项

3.6 WHEN 用户切换语言时 THEN 系统 SHALL CONTINUE TO 正确切换 Ant Design 组件的 locale 配置和界面语言

3.7 WHEN 用户点击语言切换按钮时 THEN 系统 SHALL CONTINUE TO 正确执行路由切换并在切换过程中显示 pending 状态

3.8 WHEN 页面进行服务端渲染时 THEN 系统 SHALL CONTINUE TO 保持 SSR 的 SEO 优势和首屏渲染性能
