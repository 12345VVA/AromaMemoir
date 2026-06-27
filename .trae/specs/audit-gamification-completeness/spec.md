# 味记娱乐化玩法系统可用性评估 Spec

## Why
味记已实现 F27-F30 四项娱乐化玩法（美食图鉴 / 食物人格测试 / 美食时光机 / 家庭盲猜）并合并至 main 分支。但"功能开发完成"不等于"玩法系统可用"：当前实现可能存在"半截子功能"（只有生成无分享 / 只有前端无后端闭环）、"平行宇宙式玩法"（玩法间无关联）、"缺激励 / 缺传播 / 缺沉淀"等结构性问题。需要从 PRD 完成度、玩法闭环质量、核心体验一致性、数据与验证层四个维度，对每种玩法单独进行系统化评估，识别结构性缺口并输出可落地的改进优先级。

## What Changes
- 对 F27 美食图鉴单独进行 4 维度评估（PRD完成度 / 玩法闭环 / 体验一致性 / 数据验证）
- 对 F28 食物人格测试单独进行 4 维度评估
- 对 F29 美食时光机单独进行 4 维度评估
- 对 F30 家庭盲猜单独进行 4 维度评估
- 进行跨玩法系统级分析（单玩法闭环 / 激励结构 / 社交扩散 / 玩法间关联 / 记忆沉淀 / 可量化指标 / A-B 测试能力 / MVP 判断）
- 输出综合评估报告：每个玩法标注【已实现 / 半截子 / 缺失】，列出结构性缺口与改进优先级（P0 / P1 / P2）
- 本阶段为分析评估，不修改任何代码与 PRD；分析结论将作为后续优化 spec 的输入

## Impact
- 评估对象（需逐项核查实际实现，而非仅看 PRD）：
  - PRD：`味记PRD.md` 第 4.1 / 4.2 / 8.2 节娱乐化模块
  - 后端：[gamification.controller.ts](file:///workspace/weiji-server/src/controller/gamification.controller.ts)、[types.ts](file:///workspace/weiji-server/src/store/types.ts)、[db.ts](file:///workspace/weiji-server/src/store/db.ts)、[helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts)、[单元测试](file:///workspace/weiji-server/tests/unit/gamification.helpers.test.ts)、[集成测试](file:///workspace/weiji-server/tests/integration/gamification.test.ts)
  - 前端 weiji-web：[index.html](file:///workspace/weiji-web/index.html)、[app.js](file:///workspace/weiji-web/app.js)、[api.js](file:///workspace/weiji-web/api.js)
  - 前端 weiji-admin-web：[Gameplay.vue](file:///workspace/weiji-admin-web/src/views/Gameplay.vue)、[router/index.ts](file:///workspace/weiji-admin-web/src/router/index.ts)、[Layout.vue](file:///workspace/weiji-admin-web/src/components/Layout.vue)、[api/client.ts](file:///workspace/weiji-admin-web/src/api/client.ts)
- 输出：分析报告（含每玩法评估表 + 系统级缺口 + 改进优先级）
- 不产生代码变更；若发现需修复项，将在评估完成后另起 spec

## ADDED Requirements

### Requirement: 单玩法四维评估
针对 F27-F30 每一种玩法，系统评估 SHALL 覆盖四个维度，且每项结论必须有代码 / PRD / 测试证据支撑，不得臆测。

#### Scenario: PRD完成度评估
- **WHEN** 评估某玩法
- **THEN** 检查功能覆盖度（页面入口 / 核心交互 / 结果反馈页是否存在）、核心链路完整性（触发 → 参与 → 计算 / 生成 → 反馈 → 激励 → 留存入口是否跑通）、异常与边界处理（无数据 / 新用户 / 家庭组不存在 / AI 失败降级是否存在）

#### Scenario: 玩法闭环质量评估
- **WHEN** 评估某玩法
- **THEN** 检查单玩法是否形成闭环（玩一次后是否有再玩 / 引导下一个的入口）、激励结构（即时反馈 / 延迟奖励 / 长期目标是否齐备）、社交扩散（是否天然可分享 / 是否有他人参与机制如投票 / 猜测 / PK / 接力）

#### Scenario: 核心体验一致性评估
- **WHEN** 评估某玩法
- **THEN** 检查是否服务统一主线（家庭饮食记录 → 情感连接 → 互动游戏化）、与其他玩法是否有关联、是否存在记忆沉淀机制

#### Scenario: 数据与验证层评估
- **WHEN** 评估某玩法
- **THEN** 检查是否有可量化指标、是否能 A/B 测试（玩法开关 / 独立埋点 / 单独灰度）、是否具备 MVP 最小闭环（单一玩法即可冷启动留存或传播）

### Requirement: 跨玩法系统级分析
分析 SHALL 识别玩法间的结构性问题。

#### Scenario: 系统级缺口识别
- **WHEN** 完成四玩法单独评估
- **THEN** 判断当前系统属于"记录驱动 / 个人激励偏重"还是"互动驱动 / 传播型"，识别是否缺少强互动玩法 / 传播型机制 / 家庭协作冲突博弈机制，输出改进优先级（P0 阻塞 / P1 重要 / P2 增强）

### Requirement: 综合评估报告
评估 SHALL 输出一份可评审报告。

#### Scenario: 报告产出
- **WHEN** 完成单玩法与系统级分析
- **THEN** 报告包含：每玩法评估表（已实现 / 半截子 / 缺失标注）、结构性缺口清单与优先级、"是否可用"结论与后续优化建议
