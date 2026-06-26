# 娱乐化玩法扩展 Spec

## Why
当前味记 App 的娱乐化能力仅停留在「成就列表（只读）+ 连续打卡 + 挑战定义列表」三层基础闭环，缺乏强互动、强传播、强情感连接的玩法。产品定位是"以人和家庭为中心的饮食记录"，但现有娱乐化设计偏个人激励，没有充分挖掘"家庭协作 + 情感记忆"这两个差异化内核。需要补充一批轻量、可快速上线、且能直接服务于冷启动裂变、留存与家庭组活跃的玩法，以补齐 PRD 娱乐化模块并落地实现。

## What Changes
- **更新 [味记PRD.md](file:///workspace/味记PRD.md)**：在第 4.2 节功能总览表新增 F27–F30 共 4 项娱乐化功能；在第 8.2 节路线图 Phase 1/2 中补入对应功能；在第 4.1 节功能全景图中补入娱乐化模块细分
- **后端新增 4 个娱乐化能力端点（weiji-server，TypeScript）**：
  - `GET /api/gamification/pokedex` — 美食图鉴：基于用户历史记录聚合，返回已点亮/未点亮菜品图鉴
  - `GET /api/gamification/personality` — 食物人格测试：基于近 30 天记录生成"美食人格"报告 + 可分享文案
  - `GET /api/gamification/timemachine` — 美食时光机：返回"往年今日"记录回忆卡片
  - `POST /api/gamification/blindguess/round` + `GET /api/gamification/blindguess/round/:id` + `POST /api/gamification/blindguess/round/:id/guess` — 家庭盲猜/谁是厨神：发起一轮盲猜、查看详情、提交猜测
- **后端新增内存数据与种子**：在 `src/store/db.ts` 补充图鉴分类、人格类型映射、盲猜轮次等数据结构
- **前端 weiji-web 新增娱乐化入口**：在首页底部新增"趣味玩法"区域，承载图鉴/人格/时光机/家庭盲猜 4 个卡片入口及对应详情视图
- **前端 weiji-admin-web 同步增加视图**：在 `Achievements.vue` 或新增 `Gameplay.vue` 中展示图鉴网格、人格报告、时光机回忆、家庭盲猜入口
- **测试与发布流程**：补充单元/集成测试，创建功能分支 `feature/extend-gamification`，本地通过测试后合并回 `main`，最后 `git push origin main`

## Impact
- Affected specs: mvp-feature-completion（已完成的记录/家庭/成就数据是其依赖基础）
- Affected code:
  - [味记PRD.md](file:///workspace/味记PRD.md) — 新增 F27–F30 功能定义与路线图更新
  - [db.ts](file:///workspace/weiji-server/src/store/db.ts) — 新增图鉴分类、人格映射、盲猜轮次等内存数据
  - [types.ts](file:///workspace/weiji-server/src/store/types.ts) — 新增 Pokedex/Personality/Timemachine/BlindGuessRound 等类型
  - 新增 [gamification.controller.ts](file:///workspace/weiji-server/src/controller/gamification.controller.ts) — 4 类娱乐化端点
  - [bootstrap.ts](file:///workspace/weiji-server/src/bootstrap.ts) — 注册新控制器
  - [api.js](file:///workspace/weiji-web/api.js) — 新增 gamification API 方法
  - [app.js](file:///workspace/weiji-web/app.js) — 新增趣味玩法区域渲染与路由
  - [index.html](file:///workspace/weiji-web/index.html) — 新增趣味玩法 UI 容器与模板
  - 新增 [Gameplay.vue](file:///workspace/weiji-admin-web/src/views/Gameplay.vue) + 路由注册
  - [client.ts](file:///workspace/weiji-admin-web/src/api/client.ts) — 新增 gamification API 方法
  - 新增 weiji-server 单元测试 + 集成测试

## ADDED Requirements

### Requirement: 美食图鉴（F27）
系统 SHALL 基于用户的全部历史饮食记录，聚合生成"美食图鉴"：按菜系/食材/地域等分类维度展示已点亮（用户记录过）与未点亮的菜品格子，并统计图鉴完成度。

#### Scenario: 查看图鉴
- **WHEN** 用户访问图鉴页
- **THEN** 返回按分类分组的图鉴列表，每项含 `dishName`、`category`、`rarity`（普通/稀有/史诗/传说）、`unlocked`（布尔）、`firstRecordedAt`、`recordCount`
- **AND** 返回整体完成度统计：`totalSlots`、`unlockedSlots`、`completionRate`

#### Scenario: 未登录或无记录
- **WHEN** 用户无任何饮食记录
- **THEN** 返回空图鉴（所有格子均未点亮），完成度 0%，提示"开始记录第一道菜来点亮图鉴"

### Requirement: 食物人格测试（F28）
系统 SHALL 基于用户近 30 天的饮食记录，生成"美食人格"报告：包含人格类型名称、描述、关键特征、可分享的短文案，并支持导出为可分享卡片的数据。

#### Scenario: 生成人格报告
- **WHEN** 用户访问人格测试页且 30 天内有 ≥3 条记录
- **THEN** 返回 `personalityType`（如"沉默的碳水爱好者"）、`description`、`traits`（特征数组）、`shareText`（分享文案）、`coverImage`（封面图 URL 或占位）

#### Scenario: 记录不足降级
- **WHEN** 用户近 30 天记录 <3 条
- **THEN** 返回提示"记录不足 3 条，暂无法生成人格报告，再记录几餐试试吧"，不抛错

### Requirement: 美食时光机（F29）
系统 SHALL 返回用户"往年今日"的饮食记录回忆卡片：展示历史同月同日的所有记录，支持逐年浏览。

#### Scenario: 查看时光机
- **WHEN** 用户访问时光机页
- **THEN** 返回 `memories` 数组，每项含 `year`、`records`（该日期记录列表）、`coverImage`、`caption`（如"3 年前的今天，你吃了红烧肉"）

#### Scenario: 无往年记录
- **WHEN** 用户无任何往年今日记录
- **THEN** 返回空 `memories` 数组，提示"暂无往年今日回忆，再记录一年就有啦"

### Requirement: 家庭盲猜/谁是厨神（F30）
系统 SHALL 支持家庭组内"盲猜"玩法：发起人选择若干条家庭菜谱记录（不署名）作为一轮，家庭成员提交猜测（作者/菜名），系统统计得分并排名。

#### Scenario: 发起一轮盲猜
- **WHEN** 家庭组成员发起盲猜，提交 `roundName` 和 `recordIds`（3-10 条记录 ID）
- **THEN** 创建盲猜轮次，返回 `roundId`、`status=active`、参与成员初始为发起人

#### Scenario: 提交猜测
- **WHEN** 家庭组成员对某条记录提交猜测 `guessAuthor`（猜测的作者 userId）和 `guessDishName`
- **THEN** 系统记录猜测，与真实作者/菜名比对累计得分

#### Scenario: 查看轮次结果
- **WHEN** 发起人点击"揭晓结果"
- **THEN** 轮次 `status` 变为 `revealed`，返回每个成员的得分与排名，最高分者获得"本周家庭厨神"称号

## MODIFIED Requirements

### Requirement: 娱乐化模块（PRD 4.1 功能全景图）
原 PRD 4.1 功能全景图娱乐化模块仅含"成就徽章/连续打卡/家庭排行榜/美食挑战赛/盲盒菜谱/美食地图/美食年度报告"7 项，现新增 4 项：美食图鉴、食物人格测试、美食时光机、家庭盲猜。

### Requirement: 功能总览表（PRD 4.2）
在 PRD 4.2 功能总览表 F26 之后追加 F27–F30 共 4 行功能定义（详见 What Changes）。

### Requirement: 路线图（PRD 8.2）
Phase 1 MVP 新增 F27 美食图鉴、F28 食物人格测试；Phase 2 增长新增 F29 美食时光机、F30 家庭盲猜。

## REMOVED Requirements
（本 spec 不移除任何已有需求）
