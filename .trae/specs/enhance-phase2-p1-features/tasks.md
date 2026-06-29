# Tasks

## 后端任务（weiji-server）

- [x] Task 1: F11 语音交互后端增强
  - [x] SubTask 1.1: 在 `types.ts` 新增 `VoiceIntent` 类型（'search_recipe' | 'cooking_step' | 'what_to_cook' | 'unknown'）和 `VoiceRecognizeResponse` 扩展字段
  - [x] SubTask 1.2: 在 `ai.controller.ts` 修改 `/api/ai/voice/recognize`，根据转写文本关键词返回 `intent` 字段（含"做什么/今天"→what_to_cook；含"步骤/怎么做"→cooking_step；其他→search_recipe）
  - [x] SubTask 1.3: 用 curl 验证返回 `{ text, intent }` 结构

- [x] Task 2: F15 购物清单根据菜单自动生成后端
  - [x] SubTask 2.1: 在 `types.ts` 新增 `ShoppingGenerateResult` 类型（{ added, skipped, message }）
  - [x] SubTask 2.2: 在 `family.controller.ts` 新增 `POST /api/family/shopping/generate`，聚合本周菜单对应菜谱的 `ingredients` 字段，去重后批量插入 `shopping_items`
  - [x] SubTask 2.3: 处理菜单为空、菜谱无 ingredients 等边界情况
  - [x] SubTask 2.4: 用 curl 验证返回 `{ added: N, skipped: M }`

- [x] Task 3: F17 家庭饮食月度报告后端
  - [x] SubTask 3.1: 在 `types.ts` 新增 `FamilyDietReport` 类型（含 month, totalRecords, memberContributions, topDishes, avgRating, tagDistribution 等）
  - [x] SubTask 3.2: 在 `helpers.ts` 新增 `generateFamilyDietReport(familyId, month)` 函数，聚合 records 数据生成报告
  - [x] SubTask 3.3: 在 `family.controller.ts` 新增 `GET /api/family/report?month=YYYY-MM`
  - [x] SubTask 3.4: 处理无数据情况，返回空报告结构（totalRecords=0 等）
  - [x] SubTask 3.5: 用 curl 验证返回完整报告数据

## 前端任务（weiji-web）

- [x] Task 4: F11 语音交互前端集成
  - [x] SubTask 4.1: 在 `api.js` 修改 `recognizeVoice` 方法，新增 `intent` 字段处理
  - [x] SubTask 4.2: 在 `app.js` 新增 `startVoiceRecording` / `stopVoiceRecording` / `handleVoiceResult` 函数，使用 `MediaRecorder` 采集音频
  - [x] SubTask 4.3: 在 `index.html` 修改占位语音图标为可点击录音按钮，添加录音中状态 UI（红色脉动点）
  - [x] SubTask 4.4: 实现 intent 分流：what_to_cook → 调推荐；search_recipe → 弹搜索结果；cooking_step → Toast 提示
  - [x] SubTask 4.5: 处理权限拒绝、识别失败、不支持 MediaRecorder 三种降级
  - [x] SubTask 4.6: 在浏览器中测试完整流程

- [x] Task 5: F15 购物清单自动生成前端
  - [x] SubTask 5.1: 在 `api.js` 新增 `generateShoppingFromMenu()` 方法
  - [x] SubTask 5.2: 在 `index.html` 购物清单区域新增"根据菜单生成"按钮
  - [x] SubTask 5.3: 在 `app.js` 新增 `handleGenerateShopping` 函数：弹确认 → 调 API → Toast 提示 → 刷新列表
  - [x] SubTask 5.4: 在浏览器中测试生成成功 / 菜单为空 / 已存在跳过三种情况

- [x] Task 6: F17 家庭饮食报告前端
  - [x] SubTask 6.1: 在 `api.js` 新增 `getFamilyReport(month)` 方法
  - [x] SubTask 6.2: 在 `index.html` 家庭菜谱页新增"饮食报告"Tab + 报告容器 `#family-report-view`
  - [x] SubTask 6.3: 在 `app.js` 新增 `loadFamilyReport` / `renderFamilyReport` / `changeReportMonth` 函数
  - [x] SubTask 6.4: 渲染报告卡片：记录总数 + 环比、贡献榜、Top5 菜品、平均评分、标签云
  - [x] SubTask 6.5: 修改 `switchFamilyTab` 支持 'report' Tab
  - [x] SubTask 6.6: 在浏览器中测试报告展示 / 月份切换 / 无数据空状态

## 验证任务

- [x] Task 7: 端到端联调验证
  - [x] SubTask 7.1: 启动后端服务，确认 3 个新端点已注册
  - [x] SubTask 7.2: 启动前端服务，验证 3 项功能 UI 正常
  - [x] SubTask 7.3: 完整跑通 F11 / F15 / F17 三个用户场景

## 文档任务

- [x] Task 8: 更新 PRD 文档 v1.3
  - [x] SubTask 8.1: 4.2 节更新 F11 / F15 / F17 实现状态
  - [x] SubTask 8.2: 8.2 节 P0/P1 功能汇总表更新
  - [x] SubTask 8.3: 11.1 节标记新增已修复项
  - [x] SubTask 8.4: 11.4 节统计数量更新
  - [x] SubTask 8.5: 11.5 节更新下一步优先事项
  - [x] SubTask 8.6: 版本号 v1.2 → v1.3，更新日期

# Task Dependencies

- Task 1, 2, 3 可并行（独立的后端能力）
- Task 4 依赖 Task 1（前端使用后端的 intent 字段）
- Task 5 依赖 Task 2（前端调用生成 API）
- Task 6 依赖 Task 3（前端渲染报告数据）
- Task 7 依赖 Task 1-6 全部完成
- Task 8 依赖 Task 7 验证通过
