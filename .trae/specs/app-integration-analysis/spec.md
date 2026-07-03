# weiji-app 前后端联调与账号体系分析 Spec

## Why

weiji-app 环境已修复（`fix-weiji-app-install` 完成），现需对 weiji-app（cool-uni 移动端）与 weiji-server（cool-admin-midway 后端）进行系统性的功能分析、前后端联调验证，并排查账号/用户体系问题。当前前端 `api.ts` 已按 API 路径映射契约编写了完整的请求封装，后端各模块控制器也已就位，但两端尚未经历完整的联调验证，存在潜在的路径不匹配、响应格式不一致、鉴权链路断裂等风险。

## What Changes

### 1. 账号/用户体系排查与修复
- 验证 C端 account 模块的 JWT secret 与内置 user 模块的 UserMiddleware 验签密钥一致性
- 排查 cool-uni user store 中 `refreshToken()`、`get()`、`update()` 方法对 C端体系的兼容性（这些方法内部调用 `service.user.*` 指向 B端用户体系）
- 验证 `api.ts` 中 `syncUserStore` 桥接逻辑的正确性：token 写入、用户信息字段映射（nickName/nickname、avatarUrl/avatar）
- 验证登录/注册/退出/401 跳转的完整链路

### 2. 前后端 API 端点对齐验证
- 逐模块对比前端 `api.ts` 请求路径与后端 controller 装饰器路由，确认完全匹配
- 验证响应格式一致性：前端期望 `code === 1000`，后端 `this.ok()` 返回格式
- 验证各模块是否正确注册到 cool-admin 的模块加载链

### 3. 前端页面功能分析
- 逐页审查 weiji-app 的 6 个业务页面（home、my、login、ai-record、family、achievement、gamification），确认数据流完整性
- 验证路由守卫、token 校验、登录态保持逻辑
- 确认各页面 API 调用与实际后端端点对应

### 4. 联调验证
- 启动 weiji-server 后端服务，验证所有 `/app/*` 端点可访问
- 启动 weiji-app H5 开发服务，通过代理连接后端
- 执行核心业务流程端到端测试：注册 → 登录 → 首页加载 → AI 记录 → 家庭菜谱 → 成就 → 打卡 → 退出

## Impact

- Affected specs: `fix-weiji-app-install`（前置依赖，已完成）
- Affected code:
  - `weiji-app/utils/api.ts` — 可能需调整路径/响应码判断
  - `weiji-app/cool/store/user.ts` — 可能需兼容 C端用户体系
  - `weiji-app/router/index.ts` — 路由守卫逻辑
  - `weiji-app/pages/**/*.vue` — 各业务页面（只读分析）
  - `weiji-server/src/modules/account/` — 鉴权密钥配置
  - `weiji-server/src/modules/user/` — 内置用户中间件配置

## ADDED Requirements

### Requirement: C端用户体系鉴权链路完整性
系统 SHALL 确保 C端 account 模块的 JWT 签发与 cool-admin 内置 UserMiddleware 的验签使用同一密钥，保证 `/app/*` 受保护端点能正确解析 token 并注入 `ctx.user`。

#### Scenario: 登录后访问受保护端点
- **WHEN** 用户通过 `POST /app/account/login` 获取 token 后，携带该 token 访问 `GET /app/user/profile`
- **THEN** UserMiddleware 正确验签，`ctx.user.userId` 为登录用户的 id
- **AND** 返回用户资料数据，HTTP 状态码 200

#### Scenario: 无 token 访问受保护端点
- **WHEN** 不带 Authorization header 访问 `GET /app/user/profile`
- **THEN** 返回 HTTP 401，前端 `api.ts` 拦截并跳转登录页

#### Scenario: 伪造 token 访问
- **WHEN** 携带伪造/过期 token 访问受保护端点
- **THEN** 返回 HTTP 401，前端清除本地 token 并跳转登录页

### Requirement: 前端 cool-uni user store 兼容 C端体系
系统 SHALL 确保 cool-uni 内置 user store 的 `refreshToken()`、`get()`、`update()` 方法在 C端用户体系下不触发对 B端 `service.user.*` 的无效调用，或不因调用失败而破坏用户体验。

#### Scenario: 我的页面加载用户信息
- **WHEN** 用户进入"我的"页面（`pages/index/my`）
- **THEN** 调用 `api.getUserProfile()` 获取用户数据
- **AND** 数据正确写入 cool-uni user store（字段映射：nickName、avatarUrl）
- **AND** 页面显示正确的昵称、头像、统计数据

#### Scenario: 修改昵称
- **WHEN** 用户在编辑页修改昵称后保存
- **THEN** 调用 `api.updateProfile({ nickName })` 更新后端
- **AND** 本地 user store 同步更新，返回"我的"页面后显示新昵称

### Requirement: 前后端 API 端点路径完全对齐
系统 SHALL 确保前端 `api.ts` 中所有请求路径与后端 controller 装饰器定义的路由精确匹配，包括 HTTP 方法、路径、参数位置。

#### Scenario: 注册接口对齐
- **WHEN** 前端调用 `api.register(username, password, nickName)`
- **THEN** 发起 `POST /app/account/register`，body 包含 `{ username, password, nickName }`
- **AND** 后端 `AppAccountAuthController.register` 正确接收 DTO 并返回 `{ code: 1000, data: { token, user } }`

#### Scenario: 美食记录列表对齐
- **WHEN** 前端调用 `api.getRecords({ page: 1, pageSize: 20 })`
- **THEN** 发起 `GET /app/record/list?page=1&pageSize=20`
- **AND** 后端返回 `{ code: 1000, data: { list: [...], total: N, page: 1, pageSize: 20 } }`

#### Scenario: 家庭菜谱列表对齐
- **WHEN** 前端调用 `api.getFamilyRecipes({ category: 'lunch' })`
- **THEN** 发起 `GET /app/family/recipe/list?category=lunch`
- **AND** 后端返回菜谱数组

### Requirement: 前端页面数据流完整性
系统 SHALL 确保所有业务页面的数据加载、交互操作、状态更新链路完整无断点。

#### Scenario: 首页加载完整数据流
- **WHEN** 用户登录后进入首页
- **THEN** 并行加载美食记录列表、打卡状态、AI 推荐
- **AND** 打卡按钮正确显示"今日打卡"或"已打卡"状态
- **AND** 美食记录列表正确渲染菜品名、食材标签、评分、时间

#### Scenario: AI 记录完整流程
- **WHEN** 用户选择图片 → 点击"开始 AI 识别" → 查看识别结果 → 填写评分和备注 → 保存记录
- **THEN** 每一步的数据正确传递，保存后跳转回首页并刷新列表

#### Scenario: 退出登录完整流程
- **WHEN** 用户在"我的"页面点击"退出登录"并确认
- **THEN** 调用 `POST /app/account/logout`
- **AND** 清除本地 token 和 userInfo
- **AND** 跳转到登录页

## MODIFIED Requirements

### Requirement: 后端用户资料统计字段
原有 `GET /app/user/profile` 返回硬编码的统计占位数据（`recordCount: 0, recipeCount: 0, streak: 0`）。修改为：若对应模块数据表已存在，则查询真实统计；若不存在，则返回 0（保持兼容，不阻塞联调）。

#### Scenario: 有记录时的统计
- **WHEN** 用户有美食记录和打卡记录
- **THEN** `recordCount` 返回实际记录数
- **AND** `streak` 返回实际连续打卡天数

#### Scenario: 无记录时的统计
- **WHEN** 新用户无任何记录
- **THEN** 所有统计字段返回 0，不报错

## REMOVED Requirements

无。