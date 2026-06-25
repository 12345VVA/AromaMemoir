# MVP 功能补齐 Spec

## Why
当前项目已完成基础前后端联调和用户登录，但 PRD 要求的 MVP 核心闭环仍有 5 项 P0/P1 功能缺失：AI美化未集成到记录流程、菜谱推荐无UI、营养分析未展示、协作菜单规划完全缺失、购物清单协同完全缺失。这些功能是"拍照→AI识别→美化→推荐→家庭协作"核心闭环的关键环节。

## What Changes
- 在 AI记录页集成图片美化预览：拍照识别后调用 `/api/ai/beautify`，展示原图/美化图对比，用户可选择保存哪个版本
- 在 AI记录页展示营养分析结果：识别返回的 nutrition 数据（热量/蛋白质/脂肪/碳水）渲染为可视化卡片
- 新增菜谱推荐模块：首页底部增加"为你推荐"区域，调用 `/api/ai/recommend` 展示推荐菜谱卡片
- 新增协作菜单功能：家庭菜谱页增加"本周菜单"Tab，支持查看周菜单、添加菜谱到菜单、成员投票
- 新增购物清单功能：协作菜单页增加购物清单区域，根据菜单自动生成、支持勾选/添加/删除
- 后端补充协作菜单和购物清单的 CRUD 端点及种子数据

## Impact
- Affected specs: frontend-backend-integration（已完成，本spec为其后续）
- Affected code:
  - [main.py](file:///workspace/weiji-ai/main.py) — 新增菜单/购物清单端点+种子数据
  - [api.js](file:///workspace/weiji-web/api.js) — 新增菜单/购物清单API方法
  - [app.js](file:///workspace/weiji-web/app.js) — 新增美化/营养/推荐/菜单/购物清单渲染逻辑
  - [index.html](file:///workspace/weiji-web/index.html) — 新增推荐区域、菜单Tab、购物清单UI

## ADDED Requirements

### Requirement: AI图片美化集成
系统 SHALL 在用户拍照识别后，自动调用美化接口，展示原图与美化后图片的对比预览，用户可选择保存美化版或原图。

#### Scenario: 美化成功
- **WHEN** 用户拍照并完成AI识别
- **THEN** 系统自动调用 `/api/ai/beautify`，展示原图/美化图对比切换器
- **WHEN** 用户点击"使用美化版"
- **THEN** 保存记录时使用美化图URL

#### Scenario: 美化失败降级
- **WHEN** 美化接口返回错误
- **THEN** 提示"美化失败，将使用原图"，不阻塞保存流程

### Requirement: 营养分析展示
系统 SHALL 在AI识别结果页展示营养信息卡片，包含热量、蛋白质、脂肪、碳水四项核心指标。

#### Scenario: 营养数据展示
- **WHEN** AI识别返回 nutrition 字段
- **THEN** 在识别结果区域渲染营养卡片，显示热量(kcal)、蛋白质(g)、脂肪(g)、碳水(g)

### Requirement: 菜谱推荐
系统 SHALL 在首页展示"为你推荐"区域，调用推荐接口展示3-5张推荐菜谱卡片，支持点击查看详情。

#### Scenario: 推荐展示
- **WHEN** 用户进入首页
- **THEN** 在美食日记列表下方渲染"为你推荐"区域，展示推荐菜谱卡片（菜名、难度、烹饪时间、匹配度）

### Requirement: 协作菜单规划
系统 SHALL 提供本周菜单视图，家庭成员可将家庭菜谱中的菜品添加到周菜单，并对菜单项进行投票。

#### Scenario: 查看周菜单
- **WHEN** 用户进入家庭菜谱页并切换到"本周菜单"Tab
- **THEN** 展示周一至周日的早/午/晚餐菜单列表

#### Scenario: 添加菜谱到菜单
- **WHEN** 用户在菜谱卡片点击"加入菜单"
- **THEN** 弹出选择日期和餐次，确认后菜谱添加到对应位置

#### Scenario: 成员投票
- **WHEN** 用户对某个菜单项点击"赞"或"踩"
- **THEN** 投票计数更新，显示投票分布

### Requirement: 购物清单协同
系统 SHALL 根据本周菜单自动生成购物清单，按品类分组，支持勾选/手动添加/删除。

#### Scenario: 自动生成购物清单
- **WHEN** 周菜单中有菜谱
- **THEN** 根据菜谱食材自动生成购物清单，按蔬菜/肉类/调料等品类分组

#### Scenario: 勾选购物项
- **WHEN** 用户勾选某个购物项
- **THEN** 该项标记为已购买，显示勾选人和时间

#### Scenario: 手动添加购物项
- **WHEN** 用户点击"添加物品"
- **THEN** 弹出输入框，输入名称/品类/数量后添加到清单
