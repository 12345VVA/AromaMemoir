# Tasks

- [x] Task 1: 后端新增上传菜谱端点
  - [x] SubTask 1.1: 在 family.controller.ts 实现 `POST /api/family/recipes` — 接收菜谱名称、食材清单、步骤、分类、难度、烹饪时间等字段，校验必填项，写入 family_recipes 并返回新菜谱
  - [x] SubTask 1.2: 在 api.js 新增 `uploadRecipe(data)` 方法调用该端点

- [x] Task 2: 前端创建家庭组入口
  - [x] SubTask 2.1: 在 index.html 家庭菜谱页新增"创建家庭组"弹窗（家庭组名称输入框 + 确认/取消按钮）
  - [x] SubTask 2.2: 在 app.js 新增 `showCreateFamilyDialog()` 和 `handleCreateFamily()` 函数，调用 `api.createFamily(name)`，成功后刷新家庭数据
  - [x] SubTask 2.3: 在 loadFamilyData 中检测用户未加入家庭组时显示创建入口

- [x] Task 3: 前端上传菜谱功能
  - [x] SubTask 3.1: 在 index.html 家庭菜谱页新增"上传菜谱"弹窗（菜谱名称、食材清单动态添加、步骤动态添加、分类选择、难度、烹饪时间）
  - [x] SubTask 3.2: 在 app.js 新增 `showUploadRecipeDialog()` 和 `handleUploadRecipe()` 函数，调用 `api.uploadRecipe(data)`
  - [x] SubTask 3.3: 上传成功后刷新菜谱列表

- [x] Task 4: 成就自动解锁触发
  - [x] SubTask 4.1: 在 store/helpers.ts 新增 `checkAndUnlockAchievements(userId)` 函数，检查 first_record/streak_7/streak_30/record_100 等条件并解锁
  - [x] SubTask 4.2: 在 record.controller.ts 的 `POST /api/record` 创建记录后调用 checkAndUnlockAchievements
  - [x] SubTask 4.3: 在 checkin.controller.ts 的 `POST /api/checkin` 打卡后调用 checkAndUnlockAchievements
  - [x] SubTask 4.4: 解锁成就时返回新解锁列表，前端用 Toast 提示"恭喜解锁新成就"

- [x] Task 5: 连续打卡补签端点
  - [x] SubTask 5.1: 在 checkin.controller.ts 实现 `POST /api/checkin/replenish` — 校验本周是否已补签（isReplenish 字段），补签昨日记录，重算 streak
  - [x] SubTask 5.2: 在 api.js 新增 `replenishCheckin()` 方法
  - [x] SubTask 5.3: 前端打卡卡片新增补签按钮，本周已补签则置灰

- [x] Task 6: 挑战赛前后端打通
  - [x] SubTask 6.1: 在 api.js 新增 `getChallenges()` 方法调用 `GET /api/challenge/list`
  - [x] SubTask 6.2: 修改 app.js loadAchievementsData，将硬编码 CHALLENGES 替换为后端 API 调用，失败时显示空状态

- [x] Task 7: 自定义标签输入
  - [x] SubTask 7.1: 在 index.html 记录页标签区域新增"添加标签"按钮和输入框（隐藏式，点击按钮显示）
  - [x] SubTask 7.2: 在 app.js 新增 `addCustomTag()` 函数，校验标签名称≤10字、总数≤5个，回车后添加为 chip

- [x] Task 8: 联调验证
  - [x] SubTask 8.1: 验证创建家庭组：后端API已存在（POST /api/family），前端入口已添加
  - [x] SubTask 8.2: 验证上传菜谱：POST /api/family/recipes 返回成功，校验逻辑正确
  - [x] SubTask 8.3: 验证成就自动解锁：创建记录返回 newAchievements 数组
  - [x] SubTask 8.4: 验证补签：POST /api/checkin/replenish 校验逻辑正确
  - [x] SubTask 8.5: 验证挑战赛：GET /api/challenge/list 返回3条挑战数据
  - [x] SubTask 8.6: 验证自定义标签：前端代码已添加，chip class 修正为 selected

# Task Dependencies
- Task 2 可独立先行（后端 POST /api/family 已实现）
- Task 1 依赖后端已有 family.controller.ts，可独立
- Task 3 依赖 Task 1（上传UI需要API方法）
- Task 4 可独立先行（仅后端改动）
- Task 5 可独立先行
- Task 6 可独立先行
- Task 7 可独立先行
- Task 8 依赖 Task 1-7 全部完成
