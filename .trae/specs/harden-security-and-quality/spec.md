# 安全加固与质量修复 Spec

## Why

2026-06-30 的"安全+质量+产品架构"三轨全面诊断报告给出综合评分 6.5/10，并列出 6 项 Critical、8 项 High、15 项 Medium、7 项 Low 问题。其中**三项 Critical 安全漏洞（Record IDOR 越权、weiji-ai CORS 配置错误、前端硬编码演示凭证）直接威胁用户数据与生产可用性，必须立即修复**。

经核查现有 spec 与代码现状：
- MySQL 持久化、JWT 密钥外置、成就自动解锁触发、家庭动态 feed 等已由 `production-readiness-backend` / `fix-core-shortcomings` / `enhance-mvp-experience` 等 spec 完成；
- 但报告中的 3 项 Critical + 多项 High 安全/质量问题**在源码中仍未修复**（已逐文件确认：`record.controller.ts:135-145` 无所有权校验、`main.py:38-44` 仍为 `allow_origins=["*"] + allow_credentials=True`、`Login.vue:51-54,75-79` 仍硬编码 demo/123456、`auth.service.ts` 无密码强度与限流、`family.controller.ts:130-141,781-804` 仍 N+1、`achievement.service.ts` 全文件无外部调用方等）。

本 spec 聚焦**可在本阶段直接落地**的安全加固与质量修复，不引入新基础设施（Redis/WebSocket/OSS）、不做大规模重构（前端拆分/命名统一/类型补全）、不启动新形态（小程序），这些大项明确列入 Out of Scope 由后续独立 spec 处理。

## What Changes

### P0 Critical 安全修复（立即）
- **修复 Record IDOR 越权**：[record.controller.ts](file:///workspace/weiji-server/src/controller/record.controller.ts) `GET /api/record/:id` 增加 `record.userId === ctx.state.user.userId` 所有权校验，越权访问返回 403
- **修复 weiji-ai CORS**：[main.py](file:///workspace/weiji-ai/main.py) `allow_origins` 改为显式白名单 `["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8001"]`，移除 `"*"`；`allow_credentials` 维持 `True` 但仅在白名单 origin 命中时生效
- **移除前端硬编码演示凭证**：[Login.vue](file:///workspace/weiji-admin-web/src/views/Login.vue) demo-tip 区块与表单默认值 `demo/123456` 仅在 `import.meta.env.DEV` 下显示/填充，生产构建产物中不包含

### P1 High 安全加固
- **新增速率限制**：引入 `koa-ratelimit`（基于内存 Map），对 `/api/auth/login`、`/api/auth/register`、`/api/family/join`（邀请码加入）端点限流 5 次/分钟/IP
- **新增密码强度策略**：[auth.service.ts](file:///workspace/weiji-server/src/service/auth.service.ts) `register()` 增加密码校验：最少 8 字符 + 至少包含字母与数字；拒绝纯数字/纯字母/常见弱密码（`123456`、`password`、`qwerty` 等）
- **修复用户名枚举**：`register()` 用户名已存在时改抛通用错误 `"注册失败，请检查输入或更换用户名"`（不暴露具体原因）；`login()` 维持现有的 `"用户名或密码错误"` 通用提示
- **新增安全响应头**：引入 `koa-helmet`，在 `bootstrap.ts` `createApp()` 装配（设置 CSP / X-Content-Type-Options / X-Frame-Options / HSTS）
- **修复 AI 代理头转发**：[ai-proxy.service.ts](file:///workspace/weiji-server/src/service/ai-proxy.service.ts) `forwardMultipart()` 改为仅转发白名单 headers（`Content-Type` / `Content-Length` / `Authorization`），过滤 `Host` / `X-Forwarded-*` / `Cookie` 等内部头

### P1 High 质量修复
- **统一成就解锁逻辑**：删除 [helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts) 中 `checkAndUnlockAchievements` 重复实现，改为 thin wrapper 委托 `AchievementService` 的 4 个方法（record/variety + streak + family + gameplay）；`record.controller.ts` / `checkin.controller.ts` / `family.controller.ts` / `gamification.controller.ts` 调用点签名保持不变（向后兼容），实现内部走 `AchievementService`
- **修复 N+1 查询**：[family.controller.ts](file:///workspace/weiji-server/src/controller/family.controller.ts)
  - `getMembers()`：批量预加载 `users` 到 Map，循环内 `Map.get(m.userId)` 替代逐条 `users.findById`
  - `listFamilyRecords()`：批量预加载 `users` / `record_likes` / `record_comments` 到 Map（按 recordId 分组），循环内从 Map 取值替代逐条 `findAll`

### P2 Medium/Low 快速修复
- **新增 weiji-admin-web/.gitignore**：忽略 `node_modules` / `dist` / `.env` / `*.local`
- **移除启动日志明文密码**：[db.ts](file:///workspace/weiji-server/src/store/db.ts) 第 869 行 `console.log('[store] 演示账号：demo / 123456')` 改为不打印密码，仅提示"演示账号见 README"
- **新增评论 XSS 过滤**：[family.controller.ts](file:////workspace/weiji-server/src/controller/family.controller.ts) `addComment()` 对 `content` 做 HTML 转义（`<`/`>`/`&`/`"`/`'`）后再入库
- **限制 weiji-ai /static 访问**：[main.py](file:///workspace/weiji-ai/main.py) `/static` 路径改为通过中间件校验 `Authorization` header（或简单 Referer 白名单），阻止匿名外部直接枚举生成图片
- **标记 helpers.ts 为 deprecated**：在 `findById` / `findByField` / `filterBy` / `insert` / `updateById` / `softDelete` 函数上方加 `@deprecated 使用 InMemoryRepository 实例方法` JSDoc 注释，引导后续迁移（不强制删除以保持现有调用点不破坏）

### 供应链版本核实（结论：无需改动）
- 经核查 `weiji-admin-web/package-lock.json`，报告所列 6 个"不存在版本"（typescript 6.0.3、vite 8.1.0、vue-router 5.1.0、vitest 4.1.9、pinia 3.0.4、dotenv 17.4.2）**均解析自 `registry.npmjs.org` 官方源且带 integrity hash**，实为真实发布版本，非 typosquatting。报告该项结论基于过期知识，本 spec 不做版本回退改动。

## Impact

- Affected specs:
  - `production-readiness-backend`（其安全基线仅覆盖 JWT 外置，本 spec 补齐 helmet/限流/密码策略/IDOR 等剩余 P1）
  - `fix-core-shortcomings`（其引入的 AchievementService 此前无外部调用方，本 spec 让其真正生效并删除 helpers 重复实现）
  - `enhance-mvp-experience`（其新增的 `listFamilyRecords` 存在 N+1，本 spec 修复性能债务）
- Affected code:
  - [weiji-server/src/controller/record.controller.ts](file:///workspace/weiji-server/src/controller/record.controller.ts) — IDOR 所有权校验
  - [weiji-server/src/service/auth.service.ts](file:///workspace/weiji-server/src/service/auth.service.ts) — 密码策略 + 用户名枚举修复
  - [weiji-server/src/controller/family.controller.ts](file:///workspace/weiji-server/src/controller/family.controller.ts) — N+1 批量预加载 + 评论 XSS 过滤
  - [weiji-server/src/store/helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts) — `checkAndUnlockAchievements` 改为委托 + `@deprecated` 标注
  - [weiji-server/src/service/ai-proxy.service.ts](file:///workspace/weiji-server/src/service/ai-proxy.service.ts) — header 白名单转发
  - [weiji-server/src/bootstrap.ts](file:///workspace/weiji-server/src/bootstrap.ts) — koa-helmet + koa-ratelimit 装配
  - [weiji-server/src/store/db.ts](file:///workspace/weiji-server/src/store/db.ts) — 移除明文密码日志
  - [weiji-server/package.json](file:///workspace/weiji-server/package.json) — 新增 `koa-helmet` / `koa-ratelimit` 依赖
  - [weiji-ai/main.py](file:///workspace/weiji-ai/main.py) — CORS 白名单 + /static 访问限制
  - [weiji-admin-web/src/views/Login.vue](file:///workspace/weiji-admin-web/src/views/Login.vue) — 演示凭证仅 dev 显示
  - [weiji-admin-web/.gitignore](file:///workspace/weiji-admin-web/.gitignore) — 新建
  - 测试：`weiji-server/tests/integration/record.test.ts` 追加 IDOR 403 用例；`auth.test.ts` 追加密码策略 + 限流 + 用户名枚举用例；`family.test.ts` 追加评论 XSS 用例；`achievement.test.ts` 验证统一逻辑无回归

## ADDED Requirements

### Requirement: 记录访问所有权校验
系统 SHALL 对 `GET /api/record/:id` 校验 `record.userId === ctx.state.user.userId`，越权访问返回 403。

#### Scenario: 本人记录正常访问
- **WHEN** 已认证用户请求自己的记录 id
- **THEN** 返回 200 + 记录详情

#### Scenario: 越权访问他人记录
- **WHEN** 已认证用户 A 请求用户 B 的记录 id
- **THEN** 返回 403 + `"无权访问该记录"`

#### Scenario: 不存在的记录
- **WHEN** 请求不存在的 id
- **THEN** 返回 404 + `"记录不存在"`（不泄露存在性）

### Requirement: weiji-ai CORS 白名单
weiji-ai 服务 SHALL 将 CORS `allow_origins` 限定为显式白名单，禁止使用 `"*"` 与 `allow_credentials=True` 的组合。

#### Scenario: 白名单来源访问
- **WHEN** Origin 为 `http://localhost:5173` 的请求到达 weiji-ai
- **THEN** 响应头回显该 Origin 并允许携带凭据

#### Scenario: 非白名单来源访问
- **WHEN** Origin 为 `https://evil.example.com` 的请求到达 weiji-ai
- **THEN** 响应不回显 Origin，浏览器拒绝跨域读取

### Requirement: 演示凭证仅开发模式可见
weiji-admin-web 登录页 SHALL 仅在 `import.meta.env.DEV` 下展示演示账号提示与表单默认值，生产构建产物不含任何 demo 凭证字符串。

#### Scenario: 开发模式
- **WHEN** `vite dev` 启动前端
- **THEN** 登录页显示 "演示账号 demo / 123456" 提示，表单预填 demo/123456

#### Scenario: 生产构建
- **WHEN** `vite build` 产物部署后访问登录页
- **THEN** 不显示 demo-tip 区块，表单默认值为空

### Requirement: 认证端点速率限制
系统 SHALL 对 `/api/auth/login`、`/api/auth/register`、`/api/family/join` 端点施加每 IP 每分钟 5 次的速率限制，超出返回 429。

#### Scenario: 正常速率
- **WHEN** 同一 IP 1 分钟内 5 次登录请求
- **THEN** 全部正常处理

#### Scenario: 超出限制
- **WHEN** 同一 IP 1 分钟内第 6 次登录请求
- **THEN** 返回 429 + `"请求过于频繁，请稍后再试"`

### Requirement: 密码强度策略
系统 SHALL 在注册时校验密码强度：最少 8 字符、至少包含字母与数字、拒绝常见弱密码列表。

#### Scenario: 弱密码被拒
- **WHEN** 注册时密码为 `"123456"` 或 `"password"` 或 `"abc"` 或纯数字/纯字母
- **THEN** 返回 400 + `"密码强度不足：至少 8 字符且需同时包含字母与数字"`

#### Scenario: 强密码通过
- **WHEN** 注册时密码为 `"demo1234"` 或 `"MyPass2026"`
- **THEN** 注册成功

### Requirement: 注册响应不泄露用户名存在性
系统 SHALL 在注册失败时返回通用错误，不区分"用户名已存在"与"其他校验失败"。

#### Scenario: 用户名已存在
- **WHEN** 注册时用户名已被占用
- **THEN** 返回 400 + `"注册失败，请检查输入或更换用户名"`（不出现"用户名已存在"字样）

### Requirement: 安全响应头
系统 SHALL 通过 `koa-helmet` 注入安全响应头：CSP / X-Content-Type-Options: nosniff / X-Frame-Options: DENY / HSTS（生产）。

#### Scenario: 任意 API 响应
- **WHEN** 客户端请求任意 weiji-server 端点
- **THEN** 响应头包含 `X-Content-Type-Options: nosniff` 与 `X-Frame-Options: DENY`

### Requirement: AI 代理头白名单转发
weiji-server 代理 multipart 请求到 weiji-ai 时 SHALL 仅转发白名单 headers（`Content-Type` / `Content-Length` / `Authorization`），过滤 `Host` / `X-Forwarded-*` / `Cookie` 等。

#### Scenario: 转发时过滤内部头
- **WHEN** 客户端请求携带 `Host: example.com` 与 `X-Forwarded-For: 1.2.3.4`
- **THEN** 转发到 weiji-ai 的请求不含这两个 header

### Requirement: 评论 XSS 过滤
系统 SHALL 在评论入库前对 `content` 做 HTML 字符转义（`<` / `>` / `&` / `"` / `'`）。

#### Scenario: 提交含脚本评论
- **WHEN** 用户提交评论内容 `<script>alert(1)</script>`
- **THEN** 入库内容为 `&lt;script&gt;alert(1)&lt;/script&gt;`，前端渲染不触发脚本

### Requirement: weiji-ai 静态资源访问限制
weiji-ai SHALL 对 `/static` 路径施加访问限制，阻止匿名外部枚举生成图片。

#### Scenario: 无 Referer 的匿名请求
- **WHEN** 直接访问 `http://localhost:8002/static/xxx.jpg` 且无合法 Referer
- **THEN** 返回 403

#### Scenario: 来自白名单来源的请求
- **WHEN** 请求带 Referer 为 `http://localhost:5173/*` 或 `http://localhost:8001/*`
- **THEN** 正常返回图片

## MODIFIED Requirements

### Requirement: 成就自动解锁逻辑
原实现：`helpers.ts:checkAndUnlockAchievements(userId)` 使用 switch-case 仅覆盖 5 个成就 code（first_record/streak_7/streak_30/record_100/family_create），且 `AchievementService` 类虽定义 4 个方法但无任何外部调用方。
修改后：`helpers.ts:checkAndUnlockAchievements(userId)` 改为 thin wrapper，内部委托 `AchievementService.checkAndUnlockRecordAchievements` + `checkAndUnlockStreakAchievements`（需调用 `CheckinService.calculateStreak` 获取 streak）+ `checkAndUnlockFamilyAchievements` + `checkAndUnlockGameplayAchievements`，聚合返回新解锁列表。调用点（record/checkin/family/gamification controller）签名不变，行为覆盖范围扩大（variety 类成就 `cuisine_10` 等现在也能自动解锁）。

### Requirement: 家庭成员列表查询性能
原实现：`getMembers()` 与 `listFamilyRecords()` 对每条数据单独 `await users.findById` / `await record_likes.findAll` / `await record_comments.findAll`，存在 N+1 查询。
修改后：先一次性预加载全部 users / record_likes / record_comments 到 Map（按 id / recordId 索引），循环内 `Map.get` 替代逐条查询。

### Requirement: 启动日志不泄露密码
原实现：`db.ts:869` 打印 `"[store] 演示账号：demo / 123456"`。
修改后：打印 `"[store] 演示账号详见 README.md（dev 模式默认 demo / 123456）"`，不在日志中暴露明文密码字段。

## REMOVED Requirements

### Requirement: 硬编码演示账号明文展示
**Reason**: 安全基线缺陷，生产构建中暴露 demo/123456 等同于公开后门。
**Migration**: 改为 `import.meta.env.DEV` 条件渲染，dev 模式保留便利性，生产构建移除。

### Requirement: helpers.ts checkAndUnlockAchievements 独立实现
**Reason**: 与 `AchievementService` 双重实现且互不调用，逻辑分叉导致 variety 类成就无法自动解锁。
**Migration**: 改为委托 `AchievementService`，删除 switch-case 主体；保留函数签名向后兼容现有调用点。

## Out of Scope（明确不在本 spec 范围，由后续独立 spec 处理）

以下报告提及的问题与本 spec 关注点不同，刻意排除以保持本 spec 聚焦且可独立交付：

- **微信小程序 MVP**（报告行动项 #5）—— 新形态开发，技术选型未定，独立 spec
- **weiji-web/app.js 拆分或废弃 weiji-web**（报告行动项 #6、问题 #13）—— 涉及前端形态产品决策（weiji-admin-web 是否已覆盖全部 weiji-web 功能待评估），独立 spec
- **Refresh token + 缩短 access token**（问题 #20）—— 需引入 Redis 维护 refresh 状态，独立 spec
- **logout() 黑名单**（问题 #21）—— 需 Redis TTL，独立 spec
- **API 版本化 `/api/v1/` 前缀**（问题 #29）—— 破坏性变更，需同步前端所有调用点，独立 spec
- **命名风格统一（snake_case → camelCase）**（问题 #23）—— 大规模机械重构，独立 spec
- **`any` 类型替换为明确接口**（问题 #24）—— 大规模类型补全，独立 spec
- **API 文档 Swagger/OpenAPI**（问题 #26）—— 独立工程项
- **MySQL CI 冒烟测试套件**（问题 #27）—— 需 CI 提供 MySQL 服务，独立 spec
- **docker-compose 一键启动**（报告行动项 #9）—— 工程化 DX，独立 spec
- **AI 评估体系（≥500 张标注图片）**（报告行动项 #10）—— 数据/算法工作，独立 spec
- **localStorage token → httpOnly cookie**（问题 #8）—— 需后端配合 set-cookie 跨域 SameSite 配置，且与现有 axios 拦截器耦合较深，独立 spec
- **邀请码增至 8 位**（问题 #17）—— 与限流配合后风险已降低，且涉及存量邀请码迁移，独立 spec
- **登录失败锁定 15 分钟**（问题 #16）—— 与限流有重叠，需 Redis 持久化失败计数，独立 spec
- **Magic Numbers 提取常量**（问题 #35）—— 纯重构，独立 spec
- **`.trae/specs/` 废弃目录清理**（问题 #36）—— 文档治理，独立 spec
- **console.error 信息泄露审计**（问题 #32）—— 需引入结构化日志库，独立 spec

## 验收基线

- 现有测试套件（weiji-server 110 单元 + 58 集成，weiji-admin-web 25 测试）保持原通过项不回归（预存的 6 个 ach-0007/analytics/record 失败不在本 spec 引入）
- 新增测试用例全部通过：IDOR 403、密码策略 4 类、限流 429、用户名枚举不泄露、评论 XSS 转义
- `cd weiji-server && npm run build` exit 0
- `cd weiji-admin-web && npm run build` exit 0（产物 grep 不到 `demo` / `123456` 字符串）
- `cd weiji-ai && python -m pytest` 通过（沙箱无 fastapi 时记录为环境缺失，不阻塞）
