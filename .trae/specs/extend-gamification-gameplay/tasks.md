# Tasks

- [x] Task 1: 创建功能分支并更新 PRD 文档
  - [x] SubTask 1.1: 基于 main 创建并切换到 `feature/extend-gamification` 分支
  - [x] SubTask 1.2: 在 `味记PRD.md` 第 4.1 节功能全景图娱乐化模块补入 4 项新玩法
  - [x] SubTask 1.3: 在 `味记PRD.md` 第 4.2 节功能总览表 F26 之后追加 F27–F30 共 4 行
  - [x] SubTask 1.4: 在 `味记PRD.md` 第 8.2 节路线图 Phase 1/2 中补入对应功能
  - [x] SubTask 1.5: 提交 PRD 更新（commit: "docs: 扩展娱乐化玩法 PRD F27-F30"）

- [x] Task 2: 后端类型与数据层扩展（weiji-server）
  - [x] SubTask 2.1: 在 `src/store/types.ts` 新增 `PokedexItem`、`PokedexSummary`、`PersonalityReport`、`TimemachineMemory`、`BlindGuessRound`、`BlindGuessGuess`、`BlindGuessResult` 类型
  - [x] SubTask 2.2: 在 `src/store/db.ts` 新增图鉴分类种子（菜系/食材/地域维度，含稀有度）、人格类型映射表（6-8 种人格）、盲猜轮次内存表
  - [x] SubTask 2.3: 新增 `src/store/helpers.ts` 中的辅助聚合函数：`aggregatePokedex(userId)`、`buildPersonalityReport(userId)`、`queryTimemachine(userId)`、`scoreBlindGuess(roundId)`

- [x] Task 3: 后端新增 gamification 控制器（weiji-server）
  - [x] SubTask 3.1: 新建 `src/controller/gamification.controller.ts`，实现 `GET /api/gamification/pokedex`
  - [x] SubTask 3.2: 实现 `GET /api/gamification/personality`（含记录不足降级）
  - [x] SubTask 3.3: 实现 `GET /api/gamification/timemachine`（含空数据降级）
  - [x] SubTask 3.4: 实现 `POST /api/gamification/blindguess/round`（发起轮次）、`GET /api/gamification/blindguess/round/:id`（详情）、`POST /api/gamification/blindguess/round/:id/guess`（提交猜测）、`POST /api/gamification/blindguess/round/:id/reveal`（揭晓结果）
  - [x] SubTask 3.5: 在 `src/bootstrap.ts` 注册 GamificationController

- [x] Task 4: 前端 API 客户端扩展
  - [x] SubTask 4.1: 在 `weiji-web/api.js` 新增 `getPokedex`、`getPersonality`、`getTimemachine`、`createBlindGuessRound`、`getBlindGuessRound`、`submitBlindGuess`、`revealBlindGuessRound` 方法
  - [x] SubTask 4.2: 在 `weiji-admin-web/src/api/client.ts` 同步新增上述 7 个方法

- [x] Task 5: weiji-web 前端 UI 实现
  - [x] SubTask 5.1: 在 `index.html` 首页底部新增"趣味玩法"区域容器（4 个入口卡片：图鉴/人格/时光机/家庭盲猜）
  - [x] SubTask 5.2: 在 `app.js` 新增图鉴视图渲染（按分类网格展示，已点亮/未点亮视觉区分，完成度进度条）
  - [x] SubTask 5.3: 新增人格测试视图（人格卡 + 描述 + 特征 + 分享文案复制按钮，记录不足时降级提示）
  - [x] SubTask 5.4: 新增时光机视图（往年今日回忆卡片列表，空数据提示）
  - [x] SubTask 5.5: 新增家庭盲猜视图（发起轮次表单 + 当前轮次列表 + 提交猜测 + 揭晓结果排名）
  - [x] SubTask 5.6: 在 `app.js` 路由 `navigateTo` 中注册 4 个新视图

- [x] Task 6: weiji-admin-web 前端 UI 实现
  - [x] SubTask 6.1: 新建 `src/views/Gameplay.vue`，承载 4 个玩法 Tab（图鉴/人格/时光机/家庭盲猜）
  - [x] SubTask 6.2: 在 `src/router/index.ts` 注册 `/gameplay` 路由
  - [x] SubTask 6.3: 在 `Layout.vue` 侧边栏增加"趣味玩法"菜单项
  - [x] SubTask 6.4: 实现图鉴 Tab（网格 + 完成度）、人格 Tab（人格卡 + 分享）、时光机 Tab（回忆列表）、家庭盲猜 Tab（发起/列表/揭晓）

- [x] Task 7: 后端单元测试（weiji-server）
  - [x] SubTask 7.1: 新增 `tests/unit/gamification.helpers.test.ts`，验证图鉴聚合、人格生成、时光机查询、盲猜计分逻辑
  - [x] SubTask 7.2: 确保原有测试仍通过（运行 `npm test`）

- [x] Task 8: 后端集成测试（weiji-server）
  - [x] SubTask 8.1: 新增 `tests/integration/gamification.test.ts`，覆盖 4 类端点的成功/降级/边界场景
  - [x] SubTask 8.2: 运行 `npm test` 确认全部通过（123 测试全绿，含创建端点脱敏一致性 bugfix）

- [x] Task 9: 前端构建验证
  - [x] SubTask 9.1: `weiji-admin-web` 运行 `npm run build` 验证 TypeScript 编译通过（1.36s built）
  - [x] SubTask 9.2: `weiji-admin-web` 运行 `npm run test` 验证 Vue 组件测试通过（4 文件 / 25 测试全过）
  - [x] SubTask 9.3: 手动验证 `weiji-web`（vanilla JS）在浏览器中无报错（启动静态服务，curl 验证 index.html/api.js/app.js 均含新功能）

- [ ] Task 10: 合并到 main 并推送到 git 服务器
  - [ ] SubTask 10.1: 在功能分支上提交所有实现代码（commit: "feat: 新增娱乐化玩法 F27-F30 实现"）
  - [ ] SubTask 10.2: 切回 main 分支，执行 `git merge feature/extend-gamification`（no-ff）
  - [ ] SubTask 10.3: 执行 `git push origin main` 推送到 GitHub

# Task Dependencies
- Task 2 依赖 Task 1（PRD 先定义，再实现）
- Task 3 依赖 Task 2（控制器依赖类型与数据层）
- Task 4 依赖 Task 3（前端 API 客户端依赖后端端点定义，可并行编写但需对齐）
- Task 5 + Task 6 依赖 Task 4（前端 UI 依赖 API 客户端方法）
- Task 7 + Task 8 依赖 Task 3（测试控制器）
- Task 9 依赖 Task 5 + Task 6
- Task 10 依赖 Task 7 + Task 8 + Task 9（全部测试通过才能合并）
- Task 2 与 Task 4 可部分并行（前端 API 方法定义可先行对齐接口契约）
