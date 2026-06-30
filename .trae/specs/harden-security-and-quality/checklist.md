# Checklist

## P0 Critical 安全修复
- [x] `record.controller.ts` `GET /api/record/:id` 已增加 `record.userId === ctx.state.user.userId` 所有权校验，越权返回 403 `"无权访问该记录"`
- [x] `record.test.ts` 追加 IDOR 用例：用户 B 访问用户 A 记录断言 403；不存在 id 断言 404
- [x] `weiji-ai/main.py` CORS `allow_origins` 已改为显式白名单 `["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8001"]`，移除 `"*"`
- [x] `weiji-ai/tests/integration/test_endpoints.py` 追加 CORS 用例：白名单 origin 回显、非白名单 origin 不回显
- [x] `Login.vue` demo-tip 区块已加 `v-if="isDev"` 条件渲染，`isDev = import.meta.env.DEV`
- [x] `Login.vue` form 初始值改为 `isDev ? 'demo' : ''` / `isDev ? '123456' : ''`
- [x] `npm run build` 产物 `dist/assets/Login-*.js` grep 不到 `123456` 字符串

## P1 High 安全加固
- [x] `koa-helmet` 与 `@types/koa-helmet` 已安装并写入 package.json
- [x] `bootstrap.ts` `createApp()` 已装配 `app.use(helmet())`，CSP 关闭、`xContentTypeOptions` / `xFrameOptions: 'DENY'` 启用
- [x] 集成测试响应头含 `x-content-type-options: nosniff`
- [x] `koa-ratelimit` 与 `@types/koa-ratelimit` 已安装并写入 package.json
- [x] `bootstrap.ts` 已对 `/api/auth/login`、`/api/auth/register`、`/api/family/join` 挂载限流中间件（5 次/分钟/IP）
- [x] `auth.test.ts` 追加限流用例：连续 6 次第 6 次断言 429
- [x] `auth.service.ts` `register()` 已实现 `validatePasswordStrength`：长度 ≥ 8 + 字母 + 数字 + 弱密码黑名单
- [x] 弱密码（`123456` / `abc` / `password`）注册返回 400 + 密码强度提示
- [x] 强密码（`demo1234`）注册成功
- [x] `auth.service.ts` 用户名已存在错误已改为通用 `"注册失败，请检查输入或更换用户名"`，不再出现 `"用户名已存在"` 字样
- [x] `auth.test.ts` 追加用户名枚举用例：重复注册断言 400 + 通用提示
- [x] `ai-proxy.service.ts` `forwardMultipart()` 已改为白名单转发（仅 `content-type` / `content-length` / `authorization`）
- [x] `ai-proxy.service.ts` 新增 `pickHeaders` 辅助函数过滤 `host` / `x-forwarded-*` / `cookie`
- [x] ai-proxy 单元测试验证下游 axios 调用参数不含被过滤的 header

## P1 High 质量修复
- [x] `helpers.ts` `checkAndUnlockAchievements` 已改为 thin wrapper，委托 `AchievementService` 4 个方法
- [x] wrapper 返回 `AchievementDef[]`（按 achievementId 反查 achievements 定义补全），保持与原签名向后兼容
- [x] `helpers.ts` `findById` / `findByField` / `filterBy` / `insert` / `updateById` / `softDelete` 已加 `@deprecated` JSDoc
- [x] `family.controller.ts` `getMembers()` 已改为批量预加载 users 到 Map，循环内 `Map.get`
- [x] `family.controller.ts` `listFamilyRecords()` 已改为批量预加载 users / record_likes / record_comments 到 Map
- [x] `family.test.ts` 现有 `GET /api/family/members` 与 `GET /api/family/records` 用例不回归
- [x] `achievement.test.ts` / `record.test.ts` / `checkin.test.ts` / `family.test.ts` / `gamification.test.ts` 成就自动解锁相关用例不回归
- [x] variety 类成就（如 cuisine_10）此前未自动解锁的，现在能自动解锁（如条件覆盖）

## P2 Medium/Low 快速修复
- [x] `weiji-admin-web/.gitignore` 已新建，忽略 `node_modules` / `dist` / `.env` / `*.local` / `.vite` / `coverage`
- [x] `db.ts` 第 869 行日志已改为不打印明文密码（`"[store] 演示账号详见 README.md（dev 模式默认 demo / 123456）"`）
- [x] `family.controller.ts` `addComment()` 已对 content 做 HTML 转义后再入库
- [x] `escapeHtml` 辅助函数已实现（转义 `&` / `<` / `>` / `"` / `'`）
- [x] `family.test.ts` 追加 XSS 用例：提交 `<script>alert(1)</script>` 评论 → 列表返回转义后的 `&lt;script&gt;alert(1)&lt;/script&gt;`
- [x] `weiji-ai/main.py` 已新增 `/static` 路径访问限制中间件（Referer 白名单）
- [x] 无 Referer 访问 `/static/*` 返回 403
- [x] 白名单 Referer 访问 `/static/*` 不被中间件拦截
- [x] `Login.vue` 注册表单密码字段提示文案已更新为"至少 8 字符，需含字母与数字"

## 供应链版本核实
- [x] `weiji-admin-web/package-lock.json` 核查记录：typescript 6.0.3 / vite 8.1.0 / vue-router 5.1.0 / vitest 4.1.9 / pinia 3.0.4 均解析自 `registry.npmjs.org` 官方源且带 integrity hash，确认为真实版本，无需改动

## 全量回归与构建
- [x] `cd weiji-server && npm run build` exit 0（tsc 无错误）
- [x] `cd weiji-server && npm run test:unit` 原通过项不回归（ach-0007 预存失败可接受）
- [x] `cd weiji-server && npm run test:integration` 原通过项不回归（analytics×4 + record×1 预存失败可接受），新增 IDOR / 限流 / 密码策略 / XSS 用例全部通过
- [x] `cd weiji-admin-web && npm run build` exit 0
- [x] `cd weiji-admin-web && npm run test` 25 测试不回归
- [x] `cd weiji-ai && python -m pytest` 通过（沙箱无 fastapi 时记录为环境缺失，不阻塞）

## Out of Scope 确认（不在本 spec 处理，已在 spec.md 列明）
- [x] 微信小程序 MVP —— 独立 spec
- [x] weiji-web/app.js 拆分或废弃 weiji-web —— 独立 spec
- [x] Refresh token + Redis —— 独立 spec
- [x] logout() 黑名单 + Redis —— 独立 spec
- [x] API 版本化 `/api/v1/` —— 独立 spec
- [x] 命名风格统一 / `any` 类型补全 —— 独立 spec
- [x] API 文档 Swagger / docker-compose / AI 评估体系 —— 独立 spec
- [x] localStorage → httpOnly cookie —— 独立 spec
- [x] 邀请码 8 位 / 登录失败锁定 / Magic Numbers / spec 目录清理 / console.error 审计 —— 独立 spec
