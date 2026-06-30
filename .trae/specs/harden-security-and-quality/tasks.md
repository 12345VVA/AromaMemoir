# Tasks

> 实施顺序遵循"P0 安全紧急修复先行 → P1 安全加固 → P1 质量修复 → P2 快速收尾 → 全量回归"。Task 1-3 为独立 P0 修复可并行；Task 4-6 安全加固有依赖（限流需装包后装配）；Task 7-8 质量修复独立；Task 9-11 P2 收尾独立；Task 12 全量验证。

- [x] Task 1: 修复 Record IDOR 越权（P0 Critical）
  - [x] SubTask 1.1: 在 [record.controller.ts](file:///workspace/weiji-server/src/controller/record.controller.ts) `getById()` 的 `records.findById(id)` 之后、返回之前，增加所有权校验：`const user = ctx.state.user as AuthUser; if (record.userId !== user.userId) return fail('无权访问该记录', 403)`
  - [x] SubTask 1.2: 在 [tests/integration/record.test.ts](file:///workspace/weiji-server/tests/integration/record.test.ts) 追加用例：用户 A 创建记录 → 用户 B 携带自己 token 访问该 id → 断言 403；用户 A 访问不存在 id → 断言 404
  - [x] SubTask 1.3: 运行 `cd weiji-server && npm run test:integration`，确认新用例通过且原有用例不回归

- [x] Task 2: 修复 weiji-ai CORS 配置（P0 Critical）
  - [x] SubTask 2.1: 在 [weiji-ai/main.py](file:///workspace/weiji-ai/main.py) 第 38-44 行将 `allow_origins=["*"]` 改为 `allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8001"]`
  - [x] SubTask 2.2: 维持 `allow_credentials=True`（白名单后此组合合规），确认 `allow_methods` / `allow_headers` 保持 `["*"]`（方法与头通配不与 credentials 冲突）
  - [x] SubTask 2.3: 在 [weiji-ai/tests/integration/test_endpoints.py](file:///workspace/weiji-ai/tests/integration/test_endpoints.py) 追加用例：Origin 为白名单值时响应含 `access-control-allow-origin` 回显；Origin 为 `https://evil.example.com` 时响应不含该头

- [x] Task 3: 移除前端硬编码演示凭证（P0 Critical）
  - [x] SubTask 3.1: 在 [weiji-admin-web/src/views/Login.vue](file:///workspace/weiji-admin-web/src/views/Login.vue) 模板第 51-54 行 demo-tip 区块外层加 `v-if="isDev"` 条件渲染
  - [x] SubTask 3.2: 在 `<script setup>` 新增 `const isDev = import.meta.env.DEV`
  - [x] SubTask 3.3: 修改 `form` reactive 初始值：`username: isDev ? 'demo' : ''`、`password: isDev ? '123456' : ''`
  - [x] SubTask 3.4: 运行 `cd weiji-admin-web && npm run build`，对 `dist/assets/Login-*.js` 执行 grep 验证不含 `123456` 字符串（dev 字符串可保留因 vite tree-shaking 不一定清除，重点是密码不进生产产物）
  - [x] SubTask 3.5: 运行 `cd weiji-admin-web && npm run test`，确认现有 Login 测试不回归（如测试依赖默认值需同步调整为 isDev 模拟）

- [x] Task 4: 引入 koa-helmet 安全响应头（P1 High）
  - [x] SubTask 4.1: `cd weiji-server && npm install koa-helmet @types/koa-helmet`
  - [x] SubTask 4.2: 在 [bootstrap.ts](file:///workspace/weiji-server/src/bootstrap.ts) `createApp()` 第 1 步 CORS 之前装配 `app.use(helmet())`，导入 `import helmet from 'koa-helmet'`
  - [x] SubTask 4.3: 配置 helmet 选项：`contentSecurityPolicy: false`（避免破坏现有内联脚本，CSP 后续 spec 专项处理），保留 `xContentTypeOptions` / `xFrameOptions: 'DENY'` / `strictTransportSecurity` 仅生产启用
  - [x] SubTask 4.4: 运行 `cd weiji-server && npm run test:integration`，确认 health.test.ts 等用例响应头含 `x-content-type-options: nosniff`

- [x] Task 5: 引入 koa-ratelimit 限流（P1 High）
  - [x] SubTask 5.1: `cd weiji-server && npm install koa-ratelimit @types/koa-ratelimit`
  - [x] SubTask 5.2: 在 [bootstrap.ts](file:///workspace/weiji-server/src/bootstrap.ts) 装配路由前，对敏感路径单独挂载 ratelimit 中间件：`const authRateLimit = ratelimit({ db: new Map(), duration: 60_000, max: 5, id: (ctx) => ctx.ip, errorMessage: '请求过于频繁，请稍后再试', disableHeader: false })`
  - [x] SubTask 5.3: 在路由注册阶段，对 `/api/auth/login`、`/api/auth/register`、`/api/family/join` 三条路径在 jwtMiddleware 之前挂载 `authRateLimit`（参考 registerController 内的 router 注册逻辑，按 fullPath 匹配）
  - [x] SubTask 5.4: 在 [tests/integration/auth.test.ts](file:///workspace/weiji-server/tests/integration/auth.test.ts) 追加用例：连续 6 次登录失败请求第 6 次断言 429；冷却后（用 fake timers 或重置 Map）恢复
  - [x] SubTask 5.5: 注意 ratelimit 基于 ctx.ip，测试环境需保证 supertest 请求带固定 ip（默认 127.0.0.1 即可）

- [x] Task 6: 密码强度策略 + 用户名枚举修复（P1 High）
  - [x] SubTask 6.1: 在 [auth.service.ts](file:///workspace/weiji-server/src/service/auth.service.ts) `register()` 入参校验块新增 `validatePasswordStrength(password)` 私有方法：长度 ≥ 8、正则 `/[a-zA-Z]/.test(pwd) && /\d/.test(pwd)`、拒绝弱密码黑名单 `['123456','password','qwerty','111111','12345678','abc123','admin','letmein']`（小写比较）
  - [x] SubTask 6.2: 校验失败抛 `new Error('密码强度不足：至少 8 字符且需同时包含字母与数字')`
  - [x] SubTask 6.3: 将第 76 行 `throw new Error('用户名已存在')` 改为 `throw new Error('注册失败，请检查输入或更换用户名')`
  - [x] SubTask 6.4: 在 [tests/integration/auth.test.ts](file:///workspace/weiji-server/tests/integration/auth.test.ts) 追加用例：弱密码 `'123456'` / `'abc'` / `'password'` 注册 → 400 + 密码强度提示；强密码 `'demo1234'` 注册成功；重复用户名注册 → 400 + 通用提示（不断言含"已存在"）
  - [x] SubTask 6.5: 更新 [weiji-admin-web/src/views/Login.vue](file:///workspace/weiji-admin-web/src/views/Login.vue) 注册表单密码字段提示文案为"至少 8 字符，需含字母与数字"（仅文案，无逻辑改动）

- [x] Task 7: 统一成就解锁逻辑（P1 High 质量）
  - [x] SubTask 7.1: 在 [helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts) `checkAndUnlockAchievements(userId)` 改为 thin wrapper：先 `import { AchievementService } from '../service/achievement.service'` 与 `import { CheckinService } from '../service/checkin.service'`（如未导入）；函数体内删除现有 switch-case 主体，改为：`const streak = await CheckinService.calculateStreak(userId); const unlocked = await Promise.all([AchievementService.checkAndUnlockRecordAchievements(userId), AchievementService.checkAndUnlockStreakAchievements(userId, streak), AchievementService.checkAndUnlockFamilyAchievements(userId), AchievementService.checkAndUnlockGameplayAchievements(userId)]); return unlocked.flat()`
  - [x] SubTask 7.2: 注意 `AchievementService` 各方法返回 `UserAchievement[]`，而原 `checkAndUnlockAchievements` 返回 `AchievementDef[]`；调用点 `record.controller.ts:128` 仅用于 `newAchievements` 透传给前端 Toast，需确认前端不依赖返回结构的具体字段。如前端依赖 `code`/`name`/`icon` 等定义字段，需在 wrapper 内 join `achievements` 表补全为 `AchievementDef[]`（推荐做法：wrapper 内根据 unlocked 的 achievementId 反查 achievements 定义后返回 AchievementDef[]，保持向后兼容）
  - [x] SubTask 7.3: 在 [helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts) `findById` / `findByField` / `filterBy` / `insert` / `updateById` / `softDelete` 6 个纯函数上方加 `/** @deprecated 请使用 InMemoryRepository 实例方法（如 users.findById(id)）替代 */` JSDoc
  - [x] SubTask 7.4: 运行 `cd weiji-server && npm run test:integration`，确认 achievement.test.ts / record.test.ts / checkin.test.ts / family.test.ts / gamification.test.ts 中成就自动解锁相关用例不回归；如 variety 类成就（如 cuisine_10）此前因 switch-case 缺失分支未自动解锁，追加用例验证现在可解锁

- [x] Task 8: 修复 family.controller N+1 查询（P1 High 质量）
  - [x] SubTask 8.1: 在 [family.controller.ts](file:///workspace/weiji-server/src/controller/family.controller.ts) `getMembers()`（约 121-142 行）：先 `const allUsers = await users.toArray(); const userMap = new Map(allUsers.map(u => [u.id, u]))`，循环内 `const user = userMap.get(m.userId)` 替代 `await users.findById(m.userId)`
  - [x] SubTask 8.2: 在 `listFamilyRecords()`（约 760-807 行）：循环前一次性加载 `const allUsers = await users.toArray()` + `const allLikes = await record_likes.toArray()` + `const allComments = await record_comments.toArray()`，构造 `userMap` / `likesByRecord: Map<string, RecordLike[]>` / `commentsByRecord: Map<string, RecordComment[]>`；循环内 `userMap.get(record.userId)` / `likesByRecord.get(record.id) ?? []` / `commentsByRecord.get(record.id) ?? []` 替代逐条 await
  - [x] SubTask 8.3: 运行 `cd weiji-server && npm run test:integration`，确认 family.test.ts 现有 `GET /api/family/members` 与 `GET /api/family/records` 用例不回归（行为等价，仅性能改善）

- [x] Task 9: AI 代理头白名单转发（P1 High）
  - [x] SubTask 9.1: 在 [ai-proxy.service.ts](file:///workspace/weiji-server/src/service/ai-proxy.service.ts) `forwardMultipart()` 第 44 行 `headers: ctx.headers` 改为 `headers: pickHeaders(ctx.headers, ['content-type', 'content-length', 'authorization'])`
  - [x] SubTask 9.2: 新增私有辅助函数 `function pickHeaders(headers: Koa.Headers, allowlist: string[]): Record<string, string> { const result: Record<string, string> = {}; for (const key of allowlist) { const v = headers[key]; if (v) result[key] = Array.isArray(v) ? v.join(',') : String(v); } return result; }`
  - [x] SubTask 9.3: 在 [tests/unit/ai-proxy.service.test.ts](file:///workspace/weiji-server/tests/unit/) 或新增 unit 测试，验证含 `host` / `x-forwarded-for` / `cookie` 的请求转发后下游 axios 调用参数中不含这些 header（mock axios.post 捕获 args）

- [x] Task 10: weiji-admin-web/.gitignore 新建（P2 Low）
  - [x] SubTask 10.1: 新建 [weiji-admin-web/.gitignore](file:///workspace/weiji-admin-web/.gitignore)，内容：`node_modules/\ndist/\n.env\n.env.local\n.env.*.local\n*.log\n.DS_Store\n.vite/\ncoverage/\n`
  - [x] SubTask 10.2: 确认 `dist/` 当前已被提交（仓库已有 dist 目录），后续 git rm --cached 可在独立清理 spec 处理，本 spec 仅创建 .gitignore 阻止后续变更被追踪

- [x] Task 11: 移除启动日志明文密码（P2 Low）
  - [x] SubTask 11.1: 在 [weiji-server/src/store/db.ts](file:///workspace/weiji-server/src/store/db.ts) 第 869 行 `console.log('[store] 演示账号：demo / 123456')` 改为 `console.log('[store] 演示账号详见 README.md（dev 模式默认 demo / 123456）')` —— 注意：此为日志提示文案，密码字符串仍出现在源码中（dev 便利），但不再打印到运行时 stdout；如需彻底移除源码中的明文，需同时改 init.sql 注释与 README，本 spec 仅消除运行时日志泄露

- [x] Task 12: 评论 XSS 过滤（P2 Low）
  - [x] SubTask 12.1: 在 [family.controller.ts](file:///workspace/weiji-server/src/controller/family.controller.ts) `addComment()` 第 873 行 `content: content.trim()` 改为 `content: escapeHtml(content.trim())`
  - [x] SubTask 12.2: 在文件顶部或 [common/response.ts](file:///workspace/weiji-server/src/common/response.ts) 新增 `export function escapeHtml(s: string): string { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)); }`
  - [x] SubTask 12.3: 在 [tests/integration/family.test.ts](file:///workspace/weiji-server/tests/integration/family.test.ts) 追加用例：提交评论 `<script>alert(1)</script>` → GET 记录评论列表断言内容为 `&lt;script&gt;alert(1)&lt;/script&gt;`

- [x] Task 13: weiji-ai /static 访问限制（P2 Low）
  - [x] SubTask 13.1: 在 [weiji-ai/main.py](file:///workspace/weiji-ai/main.py) `app.mount('/static', ...)` 之前新增中间件：`@app.middleware('http') async def restrict_static(request, call_next): if request.url.path.startswith('/static'): referer = request.headers.get('referer', '') allowed = ('http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8001') if not any(referer.startswith(a) for a in allowed): return JSONResponse(status_code=403, content={'code': 403, 'message': 'Forbidden'}) return await call_next(request)`
  - [x] SubTask 13.2: 在 [weiji-ai/tests/integration/test_endpoints.py](file:///workspace/weiji-ai/tests/integration/test_endpoints.py) 追加用例：无 Referer 访问 `/static/foo.jpg` → 403；带白名单 Referer → 正常（或 404 文件不存在，但不被中间件拦截）
  - [x] SubTask 13.3: 注意：此中间件可能影响 weiji-server 代理转发美化图片 URL 的场景（前端通过 weiji-server `/api/ai/beautify` 拿到 `/static/xxx.jpg` 后直接访问 weiji-ai :8002/static/xxx.jpg）。需确认前端实际访问方式：若前端通过 weiji-server 反代访问则 Referer 为 weiji-server 域名（已白名单）；若前端直接访问 weiji-ai 则需把前端 dev server 域名加入白名单（已含 5173）

- [x] Task 14: 全量回归与构建验证
  - [x] SubTask 14.1: `cd weiji-server && npm run build`，确认 TypeScript 编译 exit 0
  - [x] SubTask 14.2: `cd weiji-server && npm run test:unit`，确认 110 单元测试中原通过项不回归（ach-0007 预存失败可接受）
  - [x] SubTask 14.3: `cd weiji-server && npm run test:integration`，确认 58 集成测试中原通过项不回归（analytics×4 + record×1 预存失败可接受），新增 IDOR / 限流 / 密码策略 / XSS 用例全部通过
  - [x] SubTask 14.4: `cd weiji-admin-web && npm run build`，确认 exit 0；对 `dist/assets/Login-*.js` 执行 grep 验证不含 `123456` 字符串
  - [x] SubTask 14.5: `cd weiji-admin-web && npm run test`，确认 25 测试不回归
  - [x] SubTask 14.6: `cd weiji-ai && python -m pytest`（沙箱无 fastapi 时记录为环境缺失，不阻塞；如有 fastapi 则确认 CORS 与 /static 用例通过）

# Task Dependencies
- Task 1 / 2 / 3 互相独立，可并行（P0 紧急）
- Task 4 / 5 互相独立，但都依赖 package.json 新增依赖，可与 Task 1-3 并行（不同文件）
- Task 6 依赖 Task 5 完成（限流已装配后，密码策略用例才能与限流用例解耦，避免 6 次注册触发限流）
- Task 7 独立（仅 helpers.ts + 验证现有调用点）
- Task 8 独立（仅 family.controller.ts）
- Task 9 独立（仅 ai-proxy.service.ts）
- Task 10 / 11 / 12 / 13 互相独立，均可并行
- Task 14 依赖 Task 1-13 全部完成
