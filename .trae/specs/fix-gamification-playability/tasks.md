# Tasks

- [x] Task 1: 后端 — F30 多人协同链路打通（P0）
  - [x] SubTask 1.1: 新增 `GET /api/gamification/blindguess/rounds?familyId=xxx` 列表端点（返回当前 family 的所有轮次，active 状态脱敏）；新增 BlindGuessListItem 类型
  - [x] SubTask 1.2: 集成测试覆盖列表端点（含 active 脱敏、跨家庭隔离、空列表）
  - [x] SubTask 1.3: 校验非 creator 揭晓 403、揭晓后再猜测 400、家庭组不存在 三条测试缺口补齐（audit 发现）

- [x] Task 2: 后端 — F28 分享卡片 + 人格持久化（P0/P1）
  - [x] SubTask 2.1: buildPersonalityReport 填充 coverImage（生成 SVG data URL 或卡片数据结构，前端可渲染）
  - [x] SubTask 2.2: 新增 user_personalities 表与类型；GET /personality 端点写入历史人格（含 personalityType/createdAt）
  - [x] SubTask 2.3: 单元测试覆盖 coverImage 生成、人格持久化写入

- [x] Task 3: 后端 — 全玩法埋点体系（P0）
  - [x] SubTask 3.1: 新增 analytics.ts（trackEvent 函数 + 内存表 analytics_events + 聚合查询）；新增 AnalyticsEvent 类型
  - [x] SubTask 3.2: 新增 `GET /api/analytics/events?type=xxx` 查询端点
  - [x] SubTask 3.3: gamification.controller 6 玩法端点埋点上报（pokedex_view / personality_view / blindguess_create / blindguess_submit / blindguess_reveal；getBlindGuessRound 列表查询不上报；timemachine_view 由前端经 POST /api/analytics/track 上报）
  - [x] SubTask 3.4: 集成测试覆盖埋点上报与查询

- [x] Task 4: 后端 — F29 节日家宴 + F30 厨神徽章回写（P1）
  - [x] SubTask 4.1: queryTimemachine 新增节日判定（春节/中秋/冬至等，基于公历近似日期）与家宴聚合分支
  - [x] SubTask 4.2: scoreBlindGuess 揭晓时回写厨神徽章到 user_achievements（新增盲猜相关徽章种子）
  - [x] SubTask 4.3: 单元测试覆盖节日分支、厨神徽章回写

- [x] Task 5: 前端 weiji-web — 盲猜逐题猜测 + 跨玩法 CTA + 动效（P0/P1）
  - [x] SubTask 5.1: loadBlindguess/renderBlindguess 重构为逐题猜测 UI（每个 item 一道题，提交 guessAuthorId + guessDishName）；调用新增列表端点展示本 family 所有轮次
  - [x] SubTask 5.2: renderPersonality 渲染分享卡片（coverImage）+ 系统分享面板（Web Share API + 文本兜底）+ 埋点上报
  - [x] SubTask 5.3: renderPokedex 新点亮格子动效（CSS keyframes）+ 记录成功联动点亮提示 + "去记录解锁更多"CTA + 空状态文案修复
  - [x] SubTask 5.4: renderTimemachine 节日特别版渲染 + 回忆卡分享按钮
  - [x] SubTask 5.5: 四玩法跨玩法跳转 CTA（图鉴→人格、人格→时光机、盲猜揭晓→图鉴）
  - [x] SubTask 5.6: api.js 新增 getBlindGuessRounds / trackEvent 方法

- [x] Task 6: 前端 weiji-admin-web — 同步前端修复（P0/P1）
  - [x] SubTask 6.1: Gameplay.vue 盲猜 Tab 重构为逐题猜测；调用列表端点
  - [x] SubTask 6.2: Gameplay.vue 人格 Tab 分享卡片 + 系统分享 + 埋点
  - [x] SubTask 6.3: Gameplay.vue 图鉴 Tab 动效 + CTA；时光机 Tab 节日版 + 分享；跨玩法 CTA
  - [x] SubTask 6.4: client.ts 新增 getBlindGuessRounds / trackEvent 方法

- [x] Task 7: 测试与验证 — 后端 142 全绿（123+19）、admin-web 构建+25测试绿、weiji-web 语法通过、38/38 核查点通过
  - [x] SubTask 7.1: 后端全量测试通过（原有 123 + 新增 19 = 142）；前端构建通过
  - [x] SubTask 7.2: 前端测试新增/扩展（盲猜逐题、人格分享、图鉴动效、节日）
  - [x] SubTask 7.3: 端到端验证四玩法闭环（F30 多人参与、F28 分享回流、F27 点亮动效、F29 节日推送）

- [ ] Task 8: Git 提交与合并
  - [ ] SubTask 8.1: 在功能分支 `fix/gamification-playability` 提交所有修复
  - [ ] SubTask 8.2: 切回 main 执行 `git merge --no-ff fix/gamification-playability`
  - [ ] SubTask 8.3: 执行 `git push origin main`

# Task Dependencies
- Task 1-4 可并行（后端四块相互独立：F30 列表 / F28 卡片 / 埋点 / F29+徽章）
- Task 5-6 依赖 Task 1-4（前端需后端新端点/字段）
- Task 7 依赖 Task 1-6
- Task 8 依赖 Task 7
