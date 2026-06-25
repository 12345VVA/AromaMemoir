# AI 与后端服务分离 + cool-admin 架构迁移 Spec

## Why
当前 `weiji-ai/main.py` 将 AI 能力（识别/美化/推荐/语音/贴纸）与业务 CRUD（用户/记录/家庭/成就/打卡）耦合在同一个 FastAPI 服务中，前端为纯 HTML/CSS/JS。用户要求将 AI 程序与后端服务分离，后端和前端均采用 cool-admin 框架（Midway.js + Vue3 + Element Plus），AI 层保留 Python FastAPI 独立部署。这样业务层获得 cool-admin 的 RBAC 权限、AI 编码、Socket.io、BullMQ 等开箱能力，AI 层专注模型推理，各自独立迭代和扩缩容。

## What Changes
- **新增** cool-admin 后端项目（Midway.js + TypeScript + MySQL + Redis），承载全部业务端点（auth/record/family/achievement/checkin/user/challenge）
- **新增** cool-admin 前端项目（Vue3 + Vite + Element Plus），替换现有 weiji-web 纯 HTML/CSS/JS
- **重构** weiji-ai（Python FastAPI）为纯 AI 服务，移除所有业务 CRUD 端点和内存业务数据，仅保留 `/api/ai/*` 端点
- **新增** cool-admin 后端 AI 代理层：业务后端通过 HTTP 调用 Python AI 服务，前端不直接访问 AI 服务
- **新增** 统一响应格式适配：cool-admin 后端对外沿用 `{ code, data, message }` 格式，对内调用 AI 服务时转换
- **迁移** 现有内存种子数据为 MySQL 初始化脚本（families、family_members、family_recipes、invitations、records、achievements 等）
- **BREAKING** 前端不再通过同端口静态文件部署，改为 cool-admin 前端独立构建（Vite），通过反向代理或 CORS 访问后端
- **BREAKING** AI 端点路径从 `/api/ai/*` 调整为后端代理路径（前端调用 `/api/ai/*` → cool-admin 后端 → Python AI 服务 `/ai/*`）

## Impact
- Affected specs:
  - frontend-backend-integration（前后端联调方式变更，同端口部署改为独立部署）
  - mvp-feature-completion（协作菜单/购物清单端点迁移到 cool-admin）
  - family-system-backend（家庭组端点迁移到 cool-admin，数据从内存改为 MySQL）
- Affected code:
  - [weiji-ai/main.py](file:///workspace/weiji-ai/main.py) — 移除业务端点，仅保留 AI 端点
  - [weiji-web/](file:////workspace/weiji-web) — 现有纯 HTML 前端将被 cool-admin Vue3 前端替换（保留作为设计参考）
  - 新增 `weiji-server/`（cool-admin Midway.js 后端）
  - 新增 `weiji-admin-web/`（cool-admin Vue3 前端）

## ADDED Requirements

### Requirement: cool-admin 后端业务服务
系统 SHALL 提供 cool-admin（Midway.js）后端服务，承载全部业务端点，包括用户认证、美食记录、家庭组管理、成就、打卡、挑战等。

#### Scenario: 业务端点迁移
- **WHEN** 前端请求任意业务接口（如 `GET /api/family/recipes`）
- **THEN** cool-admin 后端处理请求，从 MySQL 读取数据并返回 `{ code: 0, data, message }`

#### Scenario: 用户认证
- **WHEN** 用户请求 `POST /api/auth/login`
- **THEN** cool-admin 后端校验账号密码，签发 JWT token 并返回用户信息

### Requirement: Python AI 服务独立部署
系统 SHALL 保留 Python FastAPI 作为独立 AI 服务，仅提供 AI 能力端点，不再承载任何业务 CRUD。

#### Scenario: AI 识别调用链
- **WHEN** 前端请求 `POST /api/ai/recognize` 上传图片
- **THEN** cool-admin 后端接收请求，转发给 Python AI 服务 `/ai/recognize`，返回识别结果给前端

#### Scenario: AI 服务健康检查
- **WHEN** cool-admin 后端启动或定时检查
- **THEN** 调用 Python AI 服务 `/health`，确认 AI 服务可用

### Requirement: cool-admin Vue3 前端
系统 SHALL 提供 cool-admin（Vue3 + Vite + Element Plus）前端项目，替换现有纯 HTML/CSS/JS 前端，保持与设计稿一致的视觉效果。

#### Scenario: 页面路由
- **WHEN** 用户访问首页/家庭菜谱/AI记录/成就/个人中心
- **THEN** Vue Router 加载对应页面组件，调用 cool-admin 后端 API 获取数据并渲染

#### Scenario: API 客户端
- **WHEN** 前端组件需要调用后端
- **THEN** 通过统一封装的 axios 实例（携带 JWT token）请求 cool-admin 后端

### Requirement: 数据持久化迁移
系统 SHALL 将现有内存种子数据迁移为 MySQL 数据库表，通过初始化脚本填充种子数据。

#### Scenario: 数据库初始化
- **WHEN** 首次部署 cool-admin 后端
- **THEN** 执行 SQL 初始化脚本，创建 families、family_members、family_recipes、invitations、records、achievements、users 等表并填充种子数据

### Requirement: AI 代理层
系统 SHALL 在 cool-admin 后端实现 AI 代理层，封装对 Python AI 服务的调用，前端不直接访问 AI 服务。

#### Scenario: 代理调用
- **WHEN** 前端请求任意 `/api/ai/*` 端点
- **THEN** cool-admin 后端 AI 代理模块转发请求到 Python AI 服务，处理超时和错误降级

## MODIFIED Requirements

### Requirement: 前后端部署架构
现有前后端同端口部署（FastAPI 挂载静态文件）改为三服务独立部署：cool-admin 前端（Vite 构建）、cool-admin 后端（Midway.js）、Python AI 服务（FastAPI），通过反向代理统一对外。

### Requirement: 统一响应格式
cool-admin 后端对外响应沿用 `{ code: 0, data, message }` 格式以保持前端兼容；cool-admin 后端调用 Python AI 服务时，将 AI 服务的响应转换为统一格式。

## REMOVED Requirements

### Requirement: weiji-ai 业务端点
**Reason**: 业务端点迁移至 cool-admin 后端，AI 服务仅保留 AI 能力
**Migration**: 以下端点从 weiji-ai/main.py 移除，由 cool-admin 后端重新实现：
- `/api/auth/register`、`/api/auth/login`、`/api/auth/logout`
- `/api/record/list`、`/api/record`、`/api/record/{id}`
- `/api/family/*`（家庭组、成员、菜谱、菜单、购物、邀请、可见性）
- `/api/achievement/list`、`/api/achievement/level`
- `/api/checkin/status`、`/api/checkin`
- `/api/user/profile`、`/api/challenge/list`
- 静态文件挂载（StaticFiles）
