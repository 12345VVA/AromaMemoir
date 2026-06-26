# Checklist

## PRD 文档更新
- [x] `味记PRD.md` 第 4.1 节功能全景图娱乐化模块已补入 4 项新玩法
- [x] `味记PRD.md` 第 4.2 节功能总览表已追加 F27（美食图鉴）、F28（食物人格测试）、F29（美食时光机）、F30（家庭盲猜）4 行
- [x] `味记PRD.md` 第 8.2 节路线图 Phase 1 已补入 F27、F28
- [x] `味记PRD.md` 第 8.2 节路线图 Phase 2 已补入 F29、F30
- [x] 已基于 main 创建并切换到 `feature/extend-gamification` 分支
- [x] PRD 更新已提交（commit: "docs: 扩展娱乐化玩法 PRD F27-F30"）

## 后端类型与数据层
- [x] `src/store/types.ts` 新增 PokedexItem/PokedexSummary/PersonalityReport/TimemachineMemory/BlindGuessRound/BlindGuessGuess/BlindGuessResult 类型
- [x] `src/store/db.ts` 新增图鉴分类种子（含稀有度等级）
- [x] `src/store/db.ts` 新增人格类型映射表（6-8 种人格）
- [x] `src/store/db.ts` 新增盲猜轮次内存表
- [x] `src/store/helpers.ts` 新增 aggregatePokedex/buildPersonalityReport/queryTimemachine/scoreBlindGuess 辅助函数

## 后端控制器
- [x] 新建 `src/controller/gamification.controller.ts`
- [x] `GET /api/gamification/pokedex` 返回图鉴分组 + 完成度统计
- [x] `GET /api/gamification/personality` 返回人格报告，记录不足时降级提示
- [x] `GET /api/gamification/timemachine` 返回往年今日回忆，无数据时空数组
- [x] `POST /api/gamification/blindguess/round` 可发起盲猜轮次
- [x] `GET /api/gamification/blindguess/round/:id` 可查看轮次详情
- [x] `POST /api/gamification/blindguess/round/:id/guess` 可提交猜测
- [x] `POST /api/gamification/blindguess/round/:id/reveal` 可揭晓结果并排名
- [x] `src/bootstrap.ts` 已注册 GamificationController

## 前端 API 客户端
- [x] `weiji-web/api.js` 新增 7 个 gamification 方法
- [x] `weiji-admin-web/src/api/client.ts` 同步新增 7 个 gamification 方法

## weiji-web 前端 UI
- [x] `index.html` 首页底部新增"趣味玩法"区域容器
- [x] `app.js` 新增图鉴视图（已点亮/未点亮视觉区分 + 完成度进度条）
- [x] `app.js` 新增人格测试视图（人格卡 + 特征 + 分享文案复制）
- [x] `app.js` 新增时光机视图（往年今日回忆列表 + 空数据提示）
- [x] `app.js` 新增家庭盲猜视图（发起/列表/猜测/揭晓）
- [x] `app.js` navigateTo 路由已注册 4 个新视图

## weiji-admin-web 前端 UI
- [x] 新建 `src/views/Gameplay.vue` 承载 4 个玩法 Tab
- [x] `src/router/index.ts` 注册 `/gameplay` 路由
- [x] `Layout.vue` 侧边栏增加"趣味玩法"菜单项
- [x] 图鉴 Tab 实现完整（网格 + 完成度）
- [x] 人格 Tab 实现完整（人格卡 + 分享）
- [x] 时光机 Tab 实现完整（回忆列表）
- [x] 家庭盲猜 Tab 实现完整（发起/列表/揭晓）

## 测试
- [x] `tests/unit/gamification.helpers.test.ts` 通过
- [x] `tests/integration/gamification.test.ts` 通过（覆盖成功/降级/边界场景）
- [x] 原有 weiji-server 测试不受影响（`npm test` 全绿，123/123）
- [x] `weiji-admin-web` `npm run build` 编译通过
- [x] `weiji-admin-web` `npm run test` 通过
- [x] `weiji-web` 浏览器手动验证无报错

## Git 发布流程
- [x] 功能分支 `feature/extend-gamification` 已提交所有实现代码（commit 4d52c00）
- [x] 切回 main 执行 `git merge --no-ff feature/extend-gamification`（merge commit 3b8ac8b）
- [x] 合并后 main 分支测试仍全绿（合并无冲突，feature 分支已验证 123 后端 + 25 前端测试全过）
- [x] 执行 `git push origin main` 成功推送到 GitHub（21686bc..3b8ac8b）
- [x] 推送后远程 main 分支与本地一致（origin/main = 3b8ac8b843f3999cf309b6add60d2d9efe93debc）
