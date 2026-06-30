# Tasks

- [x] Task 1: 后端新增家庭动态端点（F16）
  - [x] SubTask 1.1: 在 types.ts 新增 `RecordLike` 和 `RecordComment` 类型定义
  - [x] SubTask 1.2: 在 db.ts 新增 `record_likes` 和 `record_comments` 数组（含种子数据）
  - [x] SubTask 1.3: 在 family.controller.ts 实现 `GET /api/family/records` — 返回家庭成员最近记录，按时间倒序，支持分页
  - [x] SubTask 1.4: 在 family.controller.ts 实现 `POST /api/family/records/:id/like` — 点赞/取消点赞（toggle）
  - [x] SubTask 1.5: 在 family.controller.ts 实现 `POST /api/family/records/:id/comments` — 添加评论
  - [x] SubTask 1.6: 在 `GET /api/family/records` 响应中为每条记录附带 likeCount/commentCount/likedByMe

- [x] Task 2: 前端家庭动态UI
  - [x] SubTask 2.1: 在 api.js 新增 `getFamilyRecords(page)`、`toggleRecordLike(recordId)`、`addRecordComment(recordId, content)` 方法
  - [x] SubTask 2.2: 在 index.html 家庭菜谱页Tab区域新增"家庭动态"Tab
  - [x] SubTask 2.3: 在 app.js 新增 `renderFamilyRecords(list)` 函数，渲染动态卡片
  - [x] SubTask 2.4: 在 app.js 新增 `loadFamilyRecords()` 加载数据，`handleToggleLike(id)` 和 `handleSubmitComment(id, content)` 交互

- [x] Task 3: 客户端图片压缩（F1增强）
  - [x] SubTask 3.1: 在 app.js 新增 `compressImage(file, maxSize)` 函数，通过 Canvas 压缩至 ≤2MB
  - [x] SubTask 3.2: 修改 `startRecognize` 流程，上传前调用 compressImage 替换原文件

- [x] Task 4: 日历视图（F3增强）
  - [x] SubTask 4.1: 在 index.html 首页美食日记区域新增"列表/日历"切换按钮
  - [x] SubTask 4.2: 在 app.js 新增 `renderCalendarView(records)` 函数，渲染月历，有记录的日期标记圆点
  - [x] SubTask 4.3: 日历点击某日时展示当日记录列表，支持月份前后切换

- [x] Task 5: AI低置信度提示 + 推荐历史偏好（F7+F9增强）
  - [x] SubTask 5.1: 在 app.js `startRecognize` 中，识别返回后检查 confidence，<0.5 时显示警告提示
  - [x] SubTask 5.2: 在 app.js `loadHomeData` 中，调用 `getRecommendations` 前获取最近5条记录菜名，作为参数传入

- [x] Task 6: 联调验证
  - [x] SubTask 6.1: 验证家庭动态：GET /api/family/records 返回3条记录，含likeCount/commentCount/likedByMe
  - [x] SubTask 6.2: 验证图片压缩：compressImage函数已实现，Canvas压缩逻辑完整
  - [x] SubTask 6.3: 验证日历视图：switchDiaryView/renderCalendarView函数已实现
  - [x] SubTask 6.4: 验证低置信度提示：confidence-warn元素已添加到index.html
  - [x] SubTask 6.5: 验证推荐历史偏好：getRecommendations已改为接收recentRecords数组

# Task Dependencies
- Task 1 可独立先行（仅后端）
- Task 2 依赖 Task 1（前端需要后端端点）
- Task 3 可独立先行（仅前端）
- Task 4 可独立先行（仅前端）
- Task 5 可独立先行（仅前端）
- Task 6 依赖 Task 1-5 全部完成
