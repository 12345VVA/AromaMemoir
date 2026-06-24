# 前后端联调 Spec

## Why

当前前端页面（`weiji-web/index.html`）处于纯静态 demo 阶段：所有数据硬编码在 HTML 中，所有交互仅通过 `showToast` 模拟，没有任何真实 API 调用。后端 AI 服务（`weiji-ai/main.py`）仅有桩接口返回"待实现"占位数据，且缺少 CORS 配置和业务 CRUD 端点。需要将前后端打通，实现真实的数据流：加载 → 展示 → 交互 → 保存 → 刷新，验证核心闭环可用性。

## What Changes

### 后端（weiji-ai/main.py）
- 添加 CORS 中间件，允许前端跨域访问
- 新增内存 Mock 数据存储层（模拟数据库），预填充与设计稿一致的种子数据
- 实现 AI 识别端点 `POST /api/ai/recognize`：返回符合 MVP手册契约的真实 mock 响应（菜品名、食材、置信度、营养信息）
- 新增业务 CRUD 端点（均返回内存 mock 数据，符合 MVP手册统一响应格式 `{ code, data, message }`）：
  - `GET /api/record/list` — 美食日记列表（支持分页、标签筛选）
  - `POST /api/record` — 保存美食记录
  - `GET /api/record/{id}` — 记录详情
  - `GET /api/family/recipes` — 家庭菜谱列表（支持分类筛选）
  - `GET /api/family/members` — 家庭成员列表
  - `GET /api/achievement/list` — 成就徽章列表
  - `GET /api/achievement/level` — 用户等级与经验
  - `GET /api/checkin/status` — 打卡状态与连续天数
  - `POST /api/checkin` — 今日打卡
  - `GET /api/user/profile` — 用户信息与统计数据
- 统一响应格式：`{ "code": 0, "data": {...}, "message": "" }`

### 前端（weiji-web）
- 新建 `api.js`：封装 API 客户端层，统一 fetch 请求、错误处理、baseURL 配置
- 新建 `app.js`：抽取页面逻辑、状态管理、数据渲染
- 重构 `index.html`：移除硬编码数据，改为 JS 动态渲染
- 每个页面接入真实 API：
  - **首页**：`GET /api/record/list` 加载美食日记；`GET /api/checkin/status` 加载打卡状态；`POST /api/checkin` 打卡
  - **家庭菜谱**：`GET /api/family/recipes` + `GET /api/family/members` 加载数据
  - **AI记录**：`POST /api/ai/recognize` 调用真实识别接口；`POST /api/record` 保存记录
  - **成就徽章**：`GET /api/achievement/list` + `GET /api/achievement/level` 加载数据
  - **个人中心**：`GET /api/user/profile` 加载用户信息与统计
- 添加加载状态（Loading 骨架屏 / Spinner）
- 添加错误处理（网络失败、接口异常的友好提示）
- 保存记录后自动刷新列表数据

## Impact
- Affected specs: 无（首个 spec）
- Affected code:
  - `weiji-ai/main.py` — 扩展为完整 mock 后端
  - `weiji-web/index.html` — 重构为动态渲染
  - `weiji-web/api.js` — 新建，API 客户端层
  - `weiji-web/app.js` — 新建，应用逻辑层

## ADDED Requirements

### Requirement: API 客户端层
系统 SHALL 提供统一的 API 客户端模块（`api.js`），封装所有后端请求，支持 baseURL 配置、统一错误处理、请求/响应拦截。

#### Scenario: 正常请求
- **WHEN** 前端调用任意 API 方法
- **THEN** 通过 fetch 发起请求到配置的 baseURL，返回解析后的 `data` 字段

#### Scenario: 网络错误
- **WHEN** 请求因网络问题失败
- **THEN** 显示 Toast 提示"网络异常，请稍后重试"，不崩溃页面

#### Scenario: 接口返回错误码
- **WHEN** 后端返回 `code != 0`
- **THEN** 显示后端 `message` 字段内容

### Requirement: 后端 Mock 数据服务
系统 SHALL 提供基于内存的 Mock 数据服务，预填充与设计稿一致的种子数据，支持完整的 CRUD 操作，使前端能够进行真实的数据流联调。

#### Scenario: 获取美食日记列表
- **WHEN** 前端调用 `GET /api/record/list`
- **THEN** 返回 `{ code: 0, data: { list: [...], total: N, page: 1, pageSize: 20 } }`，list 包含菜品名、图片、评分、标签、时间

#### Scenario: AI 识别美食
- **WHEN** 前端上传图片调用 `POST /api/ai/recognize`
- **THEN** 返回 `{ code: 0, data: { dishName, ingredients, cookingMethod, confidence, nutrition, imageUrl } }`，数据符合 MVP手册契约

#### Scenario: 保存美食记录
- **WHEN** 前端调用 `POST /api/record` 提交记录数据
- **THEN** 记录写入内存存储，返回 `{ code: 0, data: { id, ...record } }`，后续列表查询可查到新记录

#### Scenario: 今日打卡
- **WHEN** 前端调用 `POST /api/checkin`
- **THEN** 更新打卡状态，返回更新后的连续天数；重复打卡返回提示"今日已打卡"

### Requirement: 前端动态渲染与状态管理
系统 SHALL 将所有硬编码数据替换为 API 动态加载，页面切换时按需加载数据，交互操作后自动刷新关联数据。

#### Scenario: 首页加载
- **WHEN** 用户进入首页
- **THEN** 显示加载状态，并行请求美食日记列表和打卡状态，数据返回后渲染卡片

#### Scenario: 保存记录后刷新
- **WHEN** 用户在 AI记录页保存记录成功
- **THEN** 跳转回首页时自动重新加载美食日记列表，新记录出现在列表顶部

#### Scenario: 打卡交互
- **WHEN** 用户点击"今日打卡"按钮
- **THEN** 调用 `POST /api/checkin`，成功后更新打卡天数显示和打卡日历状态

## MODIFIED Requirements

### Requirement: AI 识别功能
原有 demo 中 `startRecognize()` 仅用 `setTimeout` 模拟 2 秒延迟后显示"识别完成"。修改为调用真实后端 `POST /api/ai/recognize` 接口，展示后端返回的菜品名、食材、置信度，并填充到编辑表单中。

### Requirement: 评分与标签
原有 demo 中评分和标签仅做 UI 状态切换。修改为评分和标签状态在保存记录时随 `POST /api/record` 一并提交到后端。
