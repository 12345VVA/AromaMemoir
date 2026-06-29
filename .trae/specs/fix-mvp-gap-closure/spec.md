# MVP 闭环断裂修复与功能补齐 Spec

## Why
PRD v1.1 偏差分析发现 MVP 核心闭环在"创建家庭组"和"共享菜谱上传"两处断裂，同时成就系统无自动解锁、挑战赛前后端未打通、评分标记缺少自定义标签、连续打卡缺少补签功能。这些问题严重影响核心用户体验，需优先修复。

## What Changes
- 前端补齐"创建家庭组"入口（后端 `POST /api/family` 已实现）
- 后端新增 `POST /api/family/recipes` 上传菜谱端点 + 前端上传UI
- 后端新增成就自动解锁触发逻辑（记录创建/打卡时检查并解锁）
- 后端新增 `POST /api/checkin/replenish` 补签端点
- 前端 F24 挑战赛改为调用后端 API（替换硬编码 CHALLENGES 数组）
- 前端 F2 评分标记新增自定义标签输入

## Impact
- Affected specs: mvp-feature-completion（已完成）, family-system-backend（已完成）
- Affected code:
  - [family.controller.ts](file:///workspace/weiji-server/src/controller/family.controller.ts) — 新增上传菜谱端点
  - [achievement.controller.ts](file:///workspace/weiji-server/src/controller/achievement.controller.ts) — 新增自动解锁逻辑
  - [checkin.controller.ts](file:///workspace/weiji-server/src/controller/checkin.controller.ts) — 新增补签端点
  - [api.js](file:///workspace/weiji-web/api.js) — 新增上传菜谱、补签方法
  - [app.js](file:///workspace/weiji-web/app.js) — 创建家庭组UI、上传菜谱UI、挑战赛改调后端、自定义标签
  - [index.html](file:///workspace/weiji-web/index.html) — 创建家庭组弹窗、上传菜谱弹窗、自定义标签输入框

## ADDED Requirements

### Requirement: 创建家庭组入口
系统 SHALL 在家庭菜谱页提供"创建家庭组"入口，当前用户未加入任何家庭组时可创建新家庭组。

#### Scenario: 用户未加入家庭组
- **WHEN** 用户进入家庭菜谱页且未加入任何家庭组
- **THEN** 显示"创建家庭组"按钮
- **WHEN** 用户点击按钮并输入家庭组名称
- **THEN** 调用 `POST /api/family` 创建家庭组，创建者自动成为 owner，页面刷新展示家庭组信息

#### Scenario: 用户已加入家庭组
- **WHEN** 用户已加入家庭组
- **THEN** 不显示创建入口，正常展示家庭菜谱内容

### Requirement: 上传家庭菜谱
系统 SHALL 提供上传菜谱功能，家庭成员可上传菜谱到家庭共享空间。

#### Scenario: 上传菜谱成功
- **WHEN** 用户点击"上传菜谱"按钮，填写菜谱名称、食材清单、步骤、分类等信息
- **THEN** 调用 `POST /api/family/recipes` 创建菜谱，返回新菜谱信息，菜谱列表刷新

#### Scenario: 校验失败
- **WHEN** 菜谱名称为空或食材清单为空
- **THEN** 提示"请填写菜谱名称和食材清单"，不提交

### Requirement: 成就自动解锁
系统 SHALL 在用户创建记录或打卡时，自动检查并解锁满足条件的成就。

#### Scenario: 首次记录解锁
- **WHEN** 用户创建第一条美食记录
- **THEN** 自动解锁"首次记录"成就，返回新解锁的成就列表

#### Scenario: 连续打卡7天解锁
- **WHEN** 用户连续打卡达到7天
- **THEN** 自动解锁"连续7天"成就

### Requirement: 连续打卡补签
系统 SHALL 提供补签功能，用户中断打卡后可补签（每周限1次）。

#### Scenario: 补签成功
- **WHEN** 用户本周未补签过，点击补签按钮
- **THEN** 调用 `POST /api/checkin/replenish`，补签昨日记录，连续天数恢复

#### Scenario: 补签次数用尽
- **WHEN** 用户本周已补签过1次
- **THEN** 补签按钮置灰，提示"本周补签次数已用完"

### Requirement: 自定义标签输入
系统 SHALL 在记录页评分标记区域支持自定义标签输入。

#### Scenario: 添加自定义标签
- **WHEN** 用户在标签区域点击"添加标签"按钮
- **THEN** 显示输入框，输入标签名称（≤10字）后回车添加
- **WHEN** 标签数量已达5个
- **THEN** 隐藏添加按钮，提示"最多5个标签"

## MODIFIED Requirements

### Requirement: 美食挑战赛前后端打通
前端 SHALL 调用后端 `GET /api/challenge/list` 获取挑战列表，替换硬编码的 CHALLENGES 静态数组。

#### Scenario: 加载挑战列表
- **WHEN** 用户进入成就徽章页
- **THEN** 调用 `GET /api/challenge/list` 获取进行中的挑战列表并渲染

#### Scenario: 后端不可用降级
- **WHEN** 挑战列表API返回错误
- **THEN** 显示空状态"暂无进行中的挑战"，不阻塞页面其他功能
