# 落地 cool-admin 业务后端 Spec

## Why

上一轮 `separate-ai-cooladmin-migration` spec 的清单声称已完成 cool-admin 后端迁移，但实际核对发现 `/workspace/weiji-server/` 目录根本不存在——AI 服务（weiji-ai）已重构为纯 AI 层、前端（weiji-admin-web）已迁移到 Vue3，但承上启下的业务后端缺失，导致三服务架构断裂：前端调用 `/api/*` 时代理到 `localhost:8001` 没有任何服务监听，整条核心闭环（登录 → 首页 → 拍照识别 → 保存 → 家庭协作）完全无法运行。

本 spec 的目标是用最小可行实现落地 cool-admin（Midway.js）业务后端，补齐前端期望的全部业务端点 + AI 代理层 + MySQL 种子数据，使三服务首次端到端跑通。**不做酷炫架构、不引入未使用的能力**：先用内存存储 + 单进程 Midway 跑通闭环，AI 代理直接 HTTP 转发到 weiji-ai（8002），数据库留接口但不强制落地（提供 SQL 脚本供后续启用）。

## What Changes

- **新增** `weiji-server/` 目录：Midway.js（TypeScript）业务后端项目骨架，监听 `:8001`
- **新增** 统一响应拦截器：对外输出 `{ code: 0, data, message }`，与前端 [client.ts](file:///workspace/weiji-admin-web/src/api/client.ts) 契约一致
- **新增** CORS 中间件 + 静态资源处理：允许前端开发端口跨域
- **新增** JWT 认证中间件：校验 `Authorization: Bearer`，登录/注册签发 token
- **新增** 内存数据存储层：预填充与设计稿一致的种子数据（用户、家庭组、成员、菜谱、邀请码、记录、菜单、购物清单、成就、挑战、打卡），保证前端首次启动即可看到完整数据
- **新增** 业务端点（全部基于内存存储，CRUD 真实生效）：
  - 认证：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`
  - 记录：`GET /api/record/list`、`POST /api/record`、`GET /api/record/{id}`
  - 家庭：`GET /api/family`、`POST /api/family`、`GET/PATCH/DELETE /api/family/members/{id}`、`POST/GET /api/family/invitations`、`POST /api/family/join`、`GET /api/family/recipes`、`PATCH /api/family/recipes/{id}/visibility`、`GET/POST /api/family/menu`、`POST /api/family/menu/{id}/vote`、`GET/POST /api/family/shopping`、`PATCH/DELETE /api/family/shopping/{id}`
  - 成就：`GET /api/achievement/list`、`GET /api/achievement/level`
  - 打卡：`GET /api/checkin/status`、`POST /api/checkin`
  - 用户：`GET /api/user/profile`
  - 挑战：`GET /api/challenge/list`
- **新增** AI 代理层：`POST /api/ai/{recognize,beautify,recommend,voice/recognize,sticker}` 转发到 weiji-ai 对应 `/ai/*` 端点，超时 30s、错误降级返回友好提示
- **新增** 健康检查端点：`GET /health` 返回后端与 AI 服务连通性状态
- **新增** MySQL 初始化 SQL 脚本 `db/init.sql`：包含全部表结构 + 种子数据（当前实现用内存存储，SQL 脚本作为后续启用持久化的接口预留，本 spec 不强制落地）
- **修改** [weiji-admin-web/vite.config.ts](file:///workspace/weiji-admin-web/vite.config.ts)：确认 proxy 配置正确指向 `localhost:8001`（无需修改则跳过）
- **修复** [weiji-ai/main.py](file:///workspace/weiji-ai/main.py)（仅必要处）：保留现有端点结构，仅修正响应格式以匹配 cool-admin 代理层期望（若已匹配则跳过）

## Impact

- Affected specs:
  - `separate-ai-cooladmin-migration`（本 spec 为其未完成部分的真实落地）
  - `frontend-backend-integration`（业务端点契约对齐）
  - `mvp-feature-completion`（协作菜单/购物清单端点交付）
  - `family-system-backend`（家庭组端点交付）
- Affected code:
  - 新增 `weiji-server/`（Midway.js 后端项目）
  - [weiji-admin-web/src/api/client.ts](file:///workspace/weiji-admin-web/src/api/client.ts)（消费方，契约需对齐）
  - [weiji-ai/main.py](file:///workspace/weiji-ai/main.py)（AI 代理下游）
  - [weiji-admin-web/vite.config.ts](file:///workspace/weiji-admin-web/vite.config.ts)（dev proxy 已指向 8001）

## ADDED Requirements

### Requirement: cool-admin 业务后端服务
系统 SHALL 提供 Midway.js 业务后端服务（weiji-server），监听 `:8001`，承载前端期望的全部业务端点。

#### Scenario: 后端启动
- **WHEN** 执行 `pnpm dev`（或 `npm run dev`）启动 weiji-server
- **THEN** 服务在 `http://localhost:8001` 监听，`GET /health` 返回 `{ status: "ok" }`

#### Scenario: 统一响应格式
- **WHEN** 前端请求任意业务端点
- **THEN** 响应体为 `{ code: 0, data: <payload>, message: "" }`，错误时 `code != 0` 且 `message` 可读

### Requirement: JWT 认证
系统 SHALL 通过 JWT 实现用户认证，登录/注册签发 token，受保护端点校验 `Authorization: Bearer`。

#### Scenario: 登录获取 token
- **WHEN** 用户 `POST /api/auth/login` 提供正确账号密码
- **THEN** 返回 `{ token, user: { id, username, nickname } }`，token 7 天有效

#### Scenario: 受保护端点未授权
- **WHEN** 请求未携带 token 或 token 无效
- **THEN** 返回 401，`{ code: 401, message: "未登录或登录已过期" }`

### Requirement: 内存数据存储层
系统 SHALL 提供基于内存的数据存储层，预填充与设计稿一致的种子数据，支持完整 CRUD 操作，使前端首次启动即可看到真实数据。

#### Scenario: 首页加载美食日记
- **WHEN** 前端调用 `GET /api/record/list`
- **THEN** 返回分页格式的记录列表，包含菜品名、图片、评分、标签、时间，至少 3 条种子数据

#### Scenario: 保存记录后可查
- **WHEN** 前端 `POST /api/record` 提交新记录
- **THEN** 记录写入内存存储，返回带 id 的记录，后续 `GET /api/record/list` 列表顶部可见

### Requirement: 家庭组体系
系统 SHALL 维护家庭组实体，支持创建、邀请码加入、成员角色管理、菜谱可见性控制。

#### Scenario: 查询家庭组
- **WHEN** 已登录用户 `GET /api/family`
- **THEN** 返回用户所属家庭组信息（id、名称、成员数、创建时间）

#### Scenario: 邀请码加入家庭
- **WHEN** 用户 `POST /api/family/join` 提供有效邀请码
- **THEN** 用户加入家庭组为 member 角色，返回家庭组信息
- **WHEN** 邀请码无效或已过期
- **THEN** 返回 `{ code: 400, message: "邀请码无效或已过期" }`

#### Scenario: 菜谱可见性切换
- **WHEN** 菜谱作者 `PATCH /api/family/recipes/{id}/visibility` 提供 `family` 或 `private`
- **THEN** 更新菜谱可见性，返回更新后的菜谱信息
- **WHEN** 非作者用户请求
- **THEN** 返回 403

### Requirement: 协作菜单与购物清单
系统 SHALL 提供本周菜单视图和购物清单的 CRUD，支持菜单投票和购物项勾选。

#### Scenario: 查看本周菜单
- **WHEN** 用户 `GET /api/family/menu`
- **THEN** 返回按天/餐次分组的周菜单列表，至少预填充周一至周日的早午晚餐

#### Scenario: 菜单投票
- **WHEN** 用户 `POST /api/family/menu/{id}/vote` 提供 `like` 或 `dislike`
- **THEN** 更新投票计数，返回更新后的菜单项

#### Scenario: 购物清单勾选
- **WHEN** 用户 `PATCH /api/family/shopping/{id}` 提供 `checked: true`
- **THEN** 标记为已购买，记录勾选人和时间，返回更新后的购物项

### Requirement: 成就与打卡
系统 SHALL 提供成就徽章列表、等级数据，以及每日打卡和连续天数追踪。

#### Scenario: 查询成就
- **WHEN** 用户 `GET /api/achievement/list`
- **THEN** 返回徽章列表，每项包含 id、名称、描述、图标、是否已解锁

#### Scenario: 今日打卡
- **WHEN** 用户 `POST /api/checkin` 首次打卡
- **THEN** 更新打卡状态，返回更新后的连续天数
- **WHEN** 当日已打卡再次请求
- **THEN** 返回 `{ code: 0, message: "今日已打卡" }`，不重复增加天数

### Requirement: AI 代理层
系统 SHALL 实现 AI 代理层，将 `/api/ai/*` 请求转发到 weiji-ai（Python 服务），处理超时和错误降级，前端不直接访问 AI 服务。

#### Scenario: AI 识别转发
- **WHEN** 前端 `POST /api/ai/recognize` 上传图片
- **THEN** cool-admin 后端转发到 `http://localhost:8002/ai/recognize`，返回 AI 服务响应给前端

#### Scenario: AI 服务不可用降级
- **WHEN** weiji-ai 不可达或返回错误
- **THEN** 代理层返回 `{ code: 503, message: "AI 服务暂时不可用，请稍后重试" }`，不阻塞前端流程

#### Scenario: AI 服务健康检查
- **WHEN** 后端启动或定时检查
- **THEN** 调用 weiji-ai `/health`，记录连通性状态供 `/health` 端点暴露

### Requirement: MySQL 初始化脚本（接口预留）
系统 SHALL 提供 MySQL 初始化 SQL 脚本，包含全部表结构 + 种子数据，作为后续启用持久化的接口预留。本 spec 不强制落地 MySQL 连接，内存存储即可满足 MVP 闭环。

#### Scenario: SQL 脚本可用
- **WHEN** 后续启用 MySQL 持久化
- **THEN** 执行 `weiji-server/db/init.sql` 可创建 users、families、family_members、family_recipes、invitations、records、weekly_menu、shopping_items、achievements、user_achievements、check_ins、challenges 表并填充种子数据

## MODIFIED Requirements

### Requirement: 三服务架构
现 `separate-ai-cooladmin-migration` spec 声明的三服务架构中，本 spec 补齐缺失的 weiji-server，使架构首次成立：weiji-admin-web（前端 :5173）→ weiji-server（业务后端 :8001）→ weiji-ai（AI 服务 :8002）。

### Requirement: 端到端核心闭环
现 `frontend-backend-integration` spec 的核心闭环首次完整可运行：登录 → 首页加载 → 拍照识别（前端→后端代理→AI 服务）→ 编辑保存 → 列表刷新。

## REMOVED Requirements

### Requirement: Redis / BullMQ / Socket.io
**Reason**: 本 spec 追求最小可行实现，Redis 队列和 WebSocket 实时同步不在 MVP 闭环的关键路径上，购物清单/菜单投票使用 HTTP 轮询或刷新即可。
**Migration**: 后续需要实时同步时单独开 spec 引入。
