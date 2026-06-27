# 味记娱乐化玩法可用性修复 Spec

## Why
audit-gamification-completeness 评估结论：四玩法（F27-F30）全部为"半截子"，玩法系统不可用。最致命的阻塞是 F30 多人协同链路断裂（唯一多人玩法实际跑不通）、F28 分享卡片缺失（PRD 硬性要求未落地）、全玩法无埋点（无法度量）。本 spec 聚焦 P0 阻塞项 + 关键 P1 体验项，使系统从"功能集合"升级为"可玩可量化的玩法系统"。P2 增强项（分类维度、family_chef 死数据、A/B 灰度）不在本 spec 范围，留待后续。

## What Changes
- **F30 多人协同打通（P0）**：新增 `GET /api/gamification/blindguess/rounds?familyId=xxx` 列表端点；前端修复猜测维度退化（逐题猜测 + 作者维度，不再只猜首道菜/作者传空）；轮次对家庭成员可见
- **F28 分享卡片实现（P0）**：coverImage 字段填充（SVG/HTML 转图片或 canvas 渲染卡片）；前端分享卡片渲染 + 系统分享面板（Web Share API + 文本兜底）
- **全玩法埋点体系（P0）**：新增轻量事件记录器（内存表 + 查询端点），为四玩法定义专属埋点事件（pokedex_view / personality_view / personality_share / timemachine_view / blindguess_create / blindguess_submit / blindguess_reveal），关键交互点上报
- **F27 点亮动效 + 留存 CTA（P1）**：新点亮格子动效（CSS keyframes）；记录成功联动点亮提示；图鉴页"去记录解锁更多"CTA；空状态引导文案修复
- **F29 节日家宴推送 + 分享（P1）**：queryTimemachine 增加节日判定（春节/中秋/冬至等）与家宴聚合分支；回忆卡分享按钮
- **玩法间关联打通（P1）**：跨玩法跳转 CTA（图鉴→人格、人格→时光机、盲猜揭晓→图鉴）；盲猜揭晓回写厨神徽章到成就系统
- **激励持久化（P1）**：F28 人格报告持久化（新增 user_personality 表，记录历史人格）；F30 厨神称号写入成就系统（新增盲猜相关徽章）

## Impact
- 受影响 spec：audit-gamification-completeness（评估结论已沉淀，本 spec 为其下游修复）
- 受影响代码：
  - 后端 [gamification.controller.ts](file:///workspace/weiji-server/src/controller/gamification.controller.ts)：新增列表端点、节日分支、埋点上报
  - 后端 [helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts)：queryTimemachine 节日分支、buildPersonalityReport coverImage 生成、scoreBlindGuess 厨神徽章回写
  - 后端 [types.ts](file:///workspace/weiji-server/src/store/types.ts)：新增 UserPersonality / AnalyticsEvent / BlindGuessListItem 类型
  - 后端 [db.ts](file:///workspace/weiji-server/src/store/db.ts)：新增 user_personalities / analytics_events 表、盲猜徽章种子
  - 后端新增 [analytics.ts](file:///workspace/weiji-server/src/store/analytics.ts)：事件记录器与查询
  - 前端 weiji-web [app.js](file:///workspace/weiji-web/app.js)：盲猜逐题猜测、人格分享卡片、图鉴动效、时光机节日、跨玩法 CTA
  - 前端 weiji-web [index.html](file:///workspace/weiji-web/index.html)：动效 CSS、分享卡片样式
  - 前端 weiji-web [api.js](file:///workspace/weiji-web/api.js)：新增盲猜列表、埋点上报方法
  - 前端 weiji-admin-web [Gameplay.vue](file:///workspace/weiji-admin-web/src/views/Gameplay.vue)：盲猜逐题猜测、人格卡片、跨玩法 CTA
  - 前端 weiji-admin-web [api/client.ts](file:///workspace/weiji-admin-web/src/api/client.ts)：新增方法
  - 测试：后端新增/扩展单元与集成测试；前端新增测试
- **不修改**：PRD（评估已对照 PRD，修复为对齐 PRD）；F30 计分逻辑、F27 聚合逻辑、F28 关键词规则核心算法
- 范围外（P2，后续 spec）：F27 食材/地域分类、F28 family_chef 死数据修复、A/B 灰度开关、F30 测试缺口补齐

## ADDED Requirements

### Requirement: F30 多人协同链路打通
系统 SHALL 提供按 familyId 列出盲猜轮次的端点，使家庭成员能在自己设备上发现并参与轮次；前端 SHALL 实现逐题猜测（对每个 item 提交作者 + 菜名），不再只猜首道菜。

#### Scenario: 家庭成员发现轮次
- **WHEN** 家庭成员进入盲猜页
- **THEN** 看到本 family 所有 active 轮次（含他人发起的），可点击参与

#### Scenario: 逐题猜测
- **WHEN** 用户对轮次中某 item 提交猜测
- **THEN** 必须提交 guessAuthorId + guessDishName 双维度；guessAuthorId 不可为空

### Requirement: F28 分享卡片
系统 SHALL 生成可视化分享卡片（含人格名、特征、视觉符号），前端 SHALL 提供系统分享面板（Web Share API 优先，文本复制兜底）。

#### Scenario: 生成并分享卡片
- **WHEN** 用户在人格结果页点击"分享"
- **THEN** coverImage 非空，前端渲染卡片图；点击分享触发系统分享面板（含卡片 + shareText）

### Requirement: 全玩法埋点体系
系统 SHALL 提供轻量事件记录器（内存表 + 查询端点 GET /api/analytics/events），四玩法关键交互点 SHALL 上报埋点事件。

#### Scenario: 埋点上报与查询
- **WHEN** 用户触发 pokedex_view / personality_view / personality_share / timemachine_view / blindguess_create / blindguess_submit / blindguess_reveal
- **THEN** 事件记录到 analytics_events 表；GET /api/analytics/events 可按事件类型聚合查询

### Requirement: F27 点亮动效与留存 CTA
图鉴 SHALL 对新点亮格子播放动效；记录成功联动点亮提示；图鉴页 SHALL 含"去记录解锁更多"CTA；空状态文案可达。

### Requirement: F29 节日家宴推送与分享
queryTimemachine SHALL 在节日（春节/中秋/冬至等）聚合家宴回忆为特别版；回忆卡 SHALL 提供分享按钮。

### Requirement: 玩法间关联
四玩法 SHALL 提供跨玩法跳转 CTA；F30 盲猜揭晓 SHALL 回写厨神徽章到成就系统。

### Requirement: 激励持久化
F28 人格报告 SHALL 持久化到 user_personalities 表（含历史人格）；F30 厨神称号 SHALL 写入成就系统（新增盲猜徽章）。

## MODIFIED Requirements

### Requirement: F30 家庭盲猜
在原有发起/查看/猜测/揭晓基础上，新增列表端点；前端猜测维度从"只猜首道菜菜名"改为"逐题猜测作者+菜名"。

### Requirement: F28 食物人格测试
buildPersonalityReport 返回的 coverImage 不再恒空，填充为可渲染卡片数据；新增人格持久化（写入 user_personalities）。

### Requirement: F29 美食时光机
queryTimemachine 新增节日判定分支，节日时聚合家宴回忆为特别版。
