# Tasks

- [x] Task 1: 扩展后端 Mock 服务（weiji-ai/main.py）
  - [x] SubTask 1.1: 添加 CORS 中间件，允许 `http://localhost:8000` 跨域
  - [x] SubTask 1.2: 创建内存数据存储层，预填充种子数据（美食记录、家庭菜谱、家庭成员、成就徽章、用户信息、打卡记录）
  - [x] SubTask 1.3: 实现 `POST /api/ai/recognize` — 返回符合 MVP手册契约的 mock 识别结果（菜品名、食材列表含置信度、烹饪方式、总置信度、营养信息、图片URL）
  - [x] SubTask 1.4: 实现记录 CRUD 端点 — `GET /api/record/list`（支持 tag/rating 筛选+分页）、`POST /api/record`（保存记录到内存）、`GET /api/record/{id}`
  - [x] SubTask 1.5: 实现家庭端点 — `GET /api/family/recipes`（支持 category 筛选）、`GET /api/family/members`
  - [x] SubTask 1.6: 实现成就端点 — `GET /api/achievement/list`、`GET /api/achievement/level`
  - [x] SubTask 1.7: 实现打卡端点 — `GET /api/checkin/status`、`POST /api/checkin`（含重复打卡校验）
  - [x] SubTask 1.8: 实现用户端点 — `GET /api/user/profile`（含统计数据：记录数、菜谱数、连续打卡天数）
  - [x] SubTask 1.9: 统一响应格式为 `{ code: 0, data: {...}, message: "" }`，错误时 code != 0

- [x] Task 2: 创建前端 API 客户端层（weiji-web/api.js）
  - [x] SubTask 2.1: 定义 `API_BASE` 常量（默认 `http://localhost:8002`），封装 `request(method, path, body)` 通用方法
  - [x] SubTask 2.2: 封装所有业务 API 方法：`getRecords(params)`、`saveRecord(data)`、`recognizeFood(file)`、`getFamilyRecipes(params)`、`getFamilyMembers()`、`getAchievements()`、`getLevel()`、`getCheckinStatus()`、`doCheckin()`、`getUserProfile()`
  - [x] SubTask 2.3: 统一错误处理 — 网络错误 Toast 提示、接口错误展示 message

- [x] Task 3: 创建前端应用逻辑层（weiji-web/app.js）
  - [x] SubTask 3.1: 实现页面路由与数据加载调度 — `navigateTo(page)` 切换页面时触发对应数据加载
  - [x] SubTask 3.2: 实现首页渲染 — `loadHomeData()` 并行请求日记列表+打卡状态，渲染卡片和打卡日历
  - [x] SubTask 3.3: 实现家庭菜谱页渲染 — `loadFamilyData()` 请求菜谱列表+成员列表，渲染网格和成员栏
  - [x] SubTask 3.4: 实现 AI记录页逻辑 — `recognizeFood()` 调用真实接口，填充识别结果到表单；`saveRecord()` 提交到后端
  - [x] SubTask 3.5: 实现成就页渲染 — `loadAchievementsData()` 请求等级+徽章+挑战数据
  - [x] SubTask 3.6: 实现个人中心渲染 — `loadProfileData()` 请求用户信息和统计数据
  - [x] SubTask 3.7: 实现加载状态 — 各页面数据加载时显示 Loading Spinner/骨架屏
  - [x] SubTask 3.8: 实现交互后刷新 — 保存记录后刷新首页列表、打卡后刷新打卡状态

- [x] Task 4: 重构 index.html 接入动态数据
  - [x] SubTask 4.1: 移除首页美食日记的硬编码 HTML，改为空容器 + JS 渲染
  - [x] SubTask 4.2: 移除家庭菜谱页的硬编码菜谱和成员 HTML，改为空容器 + JS 渲染
  - [x] SubTask 4.3: 移除成就页的硬编码徽章和挑战 HTML，改为空容器 + JS 渲染
  - [x] SubTask 4.4: 移除个人中心的硬编码统计数据，改为 JS 渲染
  - [x] SubTask 4.5: 引入 api.js 和 app.js，移除内联 script 中的 mock 逻辑

- [x] Task 5: 联调验证
  - [x] SubTask 5.1: 启动后端 `python3 -m uvicorn main:app --port 8002`，确认所有端点可访问
  - [x] SubTask 5.2: 启动前端 `python3 -m http.server 8000`，确认页面正常加载
  - [x] SubTask 5.3: 验证核心闭环：首页加载 → 拍照识别 → 编辑保存 → 首页列表刷新显示新记录
  - [x] SubTask 5.4: 验证各页面数据加载无报错、交互响应正常

# Task Dependencies
- Task 2 依赖 Task 1（API 客户端需要后端端点定义）
- Task 3 依赖 Task 2（应用逻辑调用 API 客户端方法）
- Task 4 依赖 Task 3（HTML 重构依赖应用逻辑层渲染函数）
- Task 5 依赖 Task 1 + Task 4（联调需要前后端都就绪）
- Task 1 可独立先行
