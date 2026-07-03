# 修复剩余功能缺口 Spec

## Why

weiji-app 前后端联调已完成，但仍有 3 个功能缺口影响用户体验：挑战赛模块仅有列表查询无参与逻辑、美食记录无详情页、盲猜创建需手动输入 ID。此外需标记 AI 服务由后端统一代理的架构约定。

## What Changes

### 1. AI 服务代理约定标记
- 在 `weiji-app/utils/api.ts` 的 AI 方法区添加注释标记：所有 AI 请求必须经由后端 `/app/ai/*` 代理，前端不得直接请求 weiji-ai 服务或第三方 AI API

### 2. 挑战赛模块补全
- 后端新增 `UserChallengeEntity`（用户挑战参与记录表）
- 后端 `ChallengeService` 补充：`join()`（参与挑战）、`getProgress()`（查询用户进度）、`checkAndComplete()`（检查完成并发放奖励）
- 后端 Controller 新增 `POST /app/challenge/:id/join`、`GET /app/challenge/progress`
- 前端 `achievement/index.vue` 挑战列表增加"参与"按钮和进度展示

### 3. 美食记录详情页
- 前端新建 `pages/record/detail.vue`，展示记录完整信息（菜品名、图片、食材、评分、备注、营养、标签、烹饪方式）
- `pages.json` 注册路由 `pages/record/detail`
- `home.vue` 记录卡片点击跳转到详情页（替换当前跳转 ai-record 的逻辑）

### 4. 盲猜创建 UX 优化
- 前端 `gamification/index.vue` 创建轮次时自动获取当前家庭组 familyId（调用 `api.getFamilyInfo()`）
- 记录选择改为从家庭组成员的美食记录中选取（调用 `api.getFamilyFeed()` 获取记录列表），而非手动输入 recordIds

## Impact

- Affected specs: `app-integration-analysis`（前置联调已完成）
- Affected code:
  - `weiji-app/utils/api.ts` — AI 方法区添加约定注释
  - `weiji-server/src/modules/challenge/` — 新增 entity/service 方法/controller 端点
  - `weiji-app/pages/record/detail.vue` — 新建详情页
  - `weiji-app/pages.json` — 注册 detail 路由
  - `weiji-app/pages/index/home.vue` — 修改卡片点击跳转
  - `weiji-app/pages/gamification/index.vue` — 优化创建轮次 UX
  - `weiji-app/pages/achievement/index.vue` — 挑战参与按钮和进度

## ADDED Requirements

### Requirement: AI 服务后端代理约定
系统 SHALL 确保所有 AI 能力调用（识别、美化、推荐、语音、贴纸）经由后端 `/app/ai/*` 端点代理转发至 weiji-ai 服务，前端不得直接请求任何外部 AI 服务。

#### Scenario: 前端调用 AI 识别
- **WHEN** 前端调用 `api.recognizeFood(imagePath)`
- **THEN** 请求发往 `POST /app/ai/recognize`（后端代理）
- **AND** 后端转发至 weiji-ai 服务，前端不感知 weiji-ai 地址

### Requirement: 挑战赛参与与进度
系统 SHALL 提供挑战赛参与功能，用户可加入活跃挑战，系统自动追踪进度并在完成时发放经验奖励。

#### Scenario: 用户参与挑战
- **WHEN** 用户在成就中心点击"参与"按钮
- **THEN** 调用 `POST /app/challenge/:id/join`，创建参与记录
- **AND** 按钮变为"进行中"状态，显示当前进度

#### Scenario: 挑战进度自动追踪
- **WHEN** 用户完成与挑战相关的行为（如创建记录、打卡）
- **THEN** 系统更新该用户在对应挑战的 progress 字段
- **AND** 当 progress >= target 时标记挑战为已完成，发放 exp 经验

#### Scenario: 查询用户挑战进度
- **WHEN** 用户进入成就中心
- **THEN** 调用 `GET /app/challenge/progress` 获取用户所有参与中挑战的进度
- **AND** 列表显示每个挑战的 progress/target 和完成状态

### Requirement: 美食记录详情页
系统 SHALL 提供美食记录详情页面，展示单条记录的完整信息。

#### Scenario: 从首页查看记录详情
- **WHEN** 用户在首页点击美食记录卡片
- **THEN** 跳转到 `/pages/record/detail?id=xxx`
- **AND** 页面加载并展示该记录的菜品名、图片、食材标签、评分、备注、营养信息、烹饪方式、记录日期

#### Scenario: 记录不存在
- **WHEN** 访问不存在的记录 id
- **THEN** 页面显示"记录不存在"提示，提供返回按钮

### Requirement: 盲猜创建 UX 优化
系统 SHALL 在创建盲猜轮次时自动填充当前家庭组 ID，并提供记录选择器替代手动输入 recordIds。

#### Scenario: 自动填充 familyId
- **WHEN** 用户进入盲猜 Tab 的创建轮次表单
- **THEN** 系统自动调用 `api.getFamilyInfo()` 获取当前家庭组
- **AND** familyId 字段自动填充且不可编辑（如未加入家庭组则提示）

#### Scenario: 选择记录而非手动输入
- **WHEN** 用户点击"选择记录"按钮
- **THEN** 调用 `api.getFamilyFeed()` 获取家庭动态记录列表
- **AND** 以列表/多选形式展示，用户勾选 3-10 条记录
- **AND** 确认后将所选 recordId 数组填入创建表单

## MODIFIED Requirements

无。

## REMOVED Requirements

无。