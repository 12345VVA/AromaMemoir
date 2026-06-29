# Phase 2 P1 功能增强 Spec

## Why

在 v1.2 完成 MVP 核心闭环全闭合后，仍存在三项关键偏差：

1. **F11 语音交互前端 0 集成**：后端 `POST /api/ai/voice/recognize`（讯飞 ASR）已通，前端只有占位图标 `onclick="showToast('语音搜索功能')"`，导致 P1 银发关怀场景无法落地。
2. **F15 购物清单不能根据菜单自动生成**：当前只有手动 CRUD，PRD 要求"根据菜单自动生成购物清单"是 P1 核心协作体验。
3. **F17 家庭饮食报告完全未实现**：PRD P1 功能"月度/年度饮食分析报告"需要聚合家庭成员记录生成报告。

这三项均为 P1 优先级，且后端数据/接口已部分具备，本次增强是 ROI 最高的下一阶段工作。

## What Changes

### 后端（weiji-server，TypeScript）

- **F11 语音交互增强**：扩展 `POST /api/ai/voice/recognize`，返回字段新增 `intent`（识别意图：search_recipe / cooking_step / what_to_cook / unknown），便于前端按意图分流处理。
- **F15 购物清单自动生成**：新增 `POST /api/family/shopping/generate`，根据当前家庭本周菜单（weekly_menu）聚合菜谱所需食材，去重生成购物清单条目。
- **F17 家庭饮食月度报告**：新增 `GET /api/family/report?month=YYYY-MM`，聚合家庭成员当月记录：记录数、高频菜品 Top5、平均评分、标签分布、菜系分布等指标。
- 新增对应类型定义（FamilyDietReport、ShoppingAutoGenerateRequest 等）到 `types.ts`。
- 在 `db.ts` 补充菜谱食材字段以支持自动聚合（已有 ingredients 字段）。

### 前端（weiji-web）

- **F11 语音交互集成**：
  - 新增录音按钮 UI（首页搜索框 + 识别结果页"语音备注"入口）
  - 调用浏览器 `MediaRecorder` API 采集音频
  - 上传至 `/api/ai/voice/recognize` 获取转写文本
  - 按返回的 `intent` 分流：`what_to_cook` 触发推荐、`search_recipe` 触发搜索、`cooking_step` 显示提示
  - 失败时降级为手动输入提示
- **F15 购物清单自动生成按钮**：
  - 购物清单区域新增"根据菜单生成"按钮
  - 调用 `POST /api/family/shopping/generate`，成功后刷新列表
  - 二次确认弹窗（"将合并到现有清单，已存在条目会跳过"）
- **F17 家庭饮食报告页**：
  - 家庭菜谱页新增"饮食报告"Tab
  - 月份选择器（默认当月）
  - 渲染报告卡片：记录总数、家庭成员贡献榜、高频菜品 Top5、平均评分、标签云
  - 无数据时友好提示"本月暂无记录"

## Impact

- Affected specs:
  - `enhance-mvp-experience`（已完成，本 spec 为其后续 Phase 2）
  - `fix-mvp-gap-closure`（已完成，本 spec 不影响 MVP 闭环）
- Affected code:
  - [types.ts](file:///workspace/weiji-server/src/store/types.ts) — 新增 FamilyDietReport、VoiceIntent 等类型
  - [ai.controller.ts](file:///workspace/weiji-server/src/controller/ai.controller.ts) — 增强 voice recognize 返回 intent
  - [family.controller.ts](file:///workspace/weiji-server/src/controller/family.controller.ts) — 新增 shopping/generate 和 report 端点
  - [helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts) — 新增聚合报告 helper
  - [api.js](file:///workspace/weiji-web/api.js) — 新增 generateShoppingFromMenu、getFamilyReport 方法
  - [app.js](file:///workspace/weiji-web/app.js) — 新增语音录制、报告渲染、自动生成购物清单逻辑
  - [index.html](file:///workspace/weiji-web/index.html) — 新增录音按钮、报告 Tab、自动生成按钮

## ADDED Requirements

### Requirement: F11 语音交互前端集成

系统 SHALL 提供浏览器端语音录制入口，将采集的音频上传至 `/api/ai/voice/recognize`，并根据返回的转写文本和意图字段执行对应操作。

#### Scenario: 语音搜索菜谱
- **WHEN** 用户在首页搜索框点击麦克风按钮并授权录音权限
- **THEN** 调用 `MediaRecorder` 采集最多 30 秒音频
- **WHEN** 用户点击"停止"或自动停止后
- **THEN** 上传音频至 `/api/ai/voice/recognize`
- **WHEN** 后端返回 `{ text, intent: 'search_recipe' }`
- **THEN** 弹出搜索结果弹窗，展示匹配的家庭菜谱

#### Scenario: 语音询问"今天做什么"
- **WHEN** 后端返回 `{ text, intent: 'what_to_cook' }`
- **THEN** 自动调用 `/api/ai/recommend` 并在首页推荐区展示结果，Toast 提示"为你推荐今天可以做的菜"

#### Scenario: 录音权限被拒绝
- **WHEN** 浏览器拒绝麦克风权限
- **THEN** Toast 提示"麦克风权限被拒绝，请使用文字输入"
- **AND** 不阻塞页面其他功能

#### Scenario: 识别失败降级
- **WHEN** 后端返回空文本或请求失败
- **THEN** Toast 提示"未能识别您的语音，请尝试文字输入"

### Requirement: F15 购物清单根据菜单自动生成

系统 SHALL 提供"根据菜单生成购物清单"按钮，调用后端聚合本周菜单对应菜谱的食材清单，去重后批量插入购物清单。

#### Scenario: 首次生成成功
- **WHEN** 用户在购物清单区域点击"根据菜单生成"按钮
- **THEN** 弹出确认弹窗"将根据本周菜单自动生成购物清单，已存在条目会跳过，是否继续？"
- **WHEN** 用户确认
- **THEN** 调用 `POST /api/family/shopping/generate`
- **WHEN** 后端返回 `{ added: N, skipped: M }`
- **THEN** Toast 提示"已生成 N 条，跳过 M 条已存在"
- **AND** 刷新购物清单列表

#### Scenario: 菜单为空
- **WHEN** 本周菜单为空时调用生成端点
- **THEN** 后端返回 `{ added: 0, skipped: 0, message: '本周菜单为空，请先添加菜单' }`
- **AND** 前端 Toast 提示相同消息

#### Scenario: 已存在条目跳过
- **WHEN** 后端聚合食材时发现购物清单中已有同名同单位条目
- **THEN** 跳过该条目不重复插入
- **AND** 在返回结果中累加 skipped 计数

### Requirement: F17 家庭饮食月度报告

系统 SHALL 提供家庭饮食月度报告页，聚合当月家庭成员的饮食记录，输出记录总数、贡献榜、高频菜品、平均评分、标签分布等指标。

#### Scenario: 报告展示
- **WHEN** 用户进入家庭菜谱页"饮食报告"Tab
- **THEN** 默认加载当月报告 `GET /api/family/report?month=YYYY-MM`
- **AND** 渲染报告卡片：
  - 当月记录总数 + 环比上月变化
  - 家庭成员贡献榜（成员昵称 + 记录数 + 头像）
  - 高频菜品 Top5（菜名 + 出现次数 + 平均评分）
  - 平均评分（5星制）
  - 标签云（按频次排序，最多 10 个）
  - 菜系分布饼图（如数据可识别）

#### Scenario: 月份切换
- **WHEN** 用户切换月份选择器
- **THEN** 重新加载对应月份的报告
- **AND** 平滑过渡，不闪烁

#### Scenario: 无数据
- **WHEN** 当月无任何记录
- **THEN** 报告区显示空状态"本月暂无记录，去记录第一餐吧"，并提供跳转到首页记录按钮

#### Scenario: 数据聚合规则
- **WHEN** 后端聚合时
- **THEN** 只统计 `isDeleted=false` 的记录
- **AND** 按 `recordDate` 字段所在月份过滤
- **AND** 仅聚合当前家庭组成员的记录

## MODIFIED Requirements

### Requirement: F11 语音交互

**原需求**：语音搜索菜谱、语音步骤导航烹饪、多轮对话烹饪助手。支持"今天做什么菜"等自然语言查询。银发关怀模式下为默认交互方式。
**修改后**：保持原需求，但本次先实现"语音搜索菜谱"和"今天做什么"两个核心场景，多轮对话烹饪助手延后到 Phase 3。前端集成浏览器 `MediaRecorder` 录音，后端返回 `intent` 字段以便前端分流处理。

### Requirement: F15 购物清单协同

**原需求**：根据菜单自动生成购物清单，按品类（蔬菜/肉类/调料等）分类。实时同步勾选状态，谁去超市一目了然。支持手动添加/删除条目。
**修改后**：本次实现"根据菜单自动生成"和"按品类分类展示"两个核心场景，实时同步（WebSocket）延后到 Phase 3。前端已有手动 CRUD 不变，新增自动生成按钮。

### Requirement: F17 家庭饮食报告

**原需求**：月度/年度饮食分析报告：营养摄入趋势、饮食偏好分布、开销统计、高频菜品排行。支持导出PDF分享。
**修改后**：本次实现月度报告的核心指标（记录数、贡献榜、高频菜品、平均评分、标签分布），年度报告、营养摄入趋势、开销统计、PDF 导出延后到 Phase 3。

## REMOVED Requirements

无（本 spec 为新增功能，不删除任何现有需求）
