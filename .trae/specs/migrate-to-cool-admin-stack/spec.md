# 同步远程 main + 按《架构设计与迁移方案.md》迁移至 cool-admin 全家桶 Spec

## Why

当前 `weiji-server`（自研 Koa + Midway 风格装饰器）、`weiji-admin-web`（Vue3 标准栈）、`weiji-app`（普通 uni-app）均**非真正 cool-admin 全家桶**，缺少 RBAC、菜单、字典、文件管理、cl-crud 自动生成、插件体系等开箱能力。用户要求先同步远程 `main` 分支代码，再严格按照 [架构设计与迁移方案.md](file:///workspace/架构设计与迁移方案.md) 重建三端工程，使项目落地为官方脚手架（cool-admin-midway / cool-admin-vue / cool-uni）体系，weiji-ai 保持独立 AI 层不变。

决策 D1–D7 已在方案中全部确认（详见 §1 决策记录）：全新脚手架 + 业务迁移、`-next` 后缀目录并行迁移、主键改自增 bigint、无生产数据免迁移脚本、C 端/B 端用户分离、API 路径破坏性变更 `/api/*` → `/app/*`·`/admin/*`·`/open/*`。

## What Changes

### 前置：同步远程 main
- 执行 `git fetch origin` + `git pull origin main`，确保本地 `main` 与远程一致（当前工作树已 clean）
- 同步后核对工作树状态，确认无冲突

### 后端：weiji-server-next（cool-admin-midway）
- **新增** `weiji-server-next/` 目录，拉取 cool-admin-midway 官方脚手架（Midway.js + TypeORM + MySQL + Redis + `@cool-midway/core`）
- **保留** cool-admin 内置 `base` 模块（RBAC/菜单/字典/日志/文件/数据回收站）
- **新增** 7 个业务模块：`record` / `family` / `achievement` / `checkin` / `gamification` / `challenge` / `ai` / `analytics`（按方案 §5.2 归并现有 11 控制器）
- **迁移** 12+ 张表为 TypeORM entity（表名统一 `weiji_` 前缀，继承 `BaseEntity`，主键 uuid→bigint 自增，软删 isDeleted→deleteTime）
- **迁移** 5 个 service 业务逻辑到新模块
- **新增** C 端用户实体 `weiji_app_user`（与 B 端 `base_sys_user` 分离）
- **迁移** AI 代理 service（转发 weiji-ai:8002）
- **BREAKING** C 端业务接口路径 `/api/*` → `/app/*`；B 端管理用 cl-crud 自动生成 `/admin/*`
- 种子数据写入各模块 `db.json`（演示账号 demo/mom/dad/grandma、成就定义、挑战等）

### PC 后台：weiji-admin-web-next（cool-admin-vue）
- **新增** `weiji-admin-web-next/` 目录，拉取 cool-admin-vue 官方脚手架（Vue3 + Vite + Element Plus + cl-crud/cl-form）
- 迁移现有 9 个业务页面到 `modules/*/views/`
- **新增** record/family/recipe/achievement 管理页（cl-crud 一行生成 CRUD）
- baseURL 由 `/api` → 按场景 `/admin` 或 `/app`
- 复用 cool-admin 内置登录页（admin/123456）

### 移动端：weiji-app-next（cool-uni）
- **新增** `weiji-app-next/` 目录，拉取 cool-uni 官方脚手架（uni-app + Vue3 组合式 + Pinia）
- 迁移现有 8 个页面，补齐 Gameplay 页
- 接入 cool-uni Service 自动化（替代手写 client.ts）
- 微信小程序（真实 appid）+ H5 联调

### 切换与清理（Phase 4）
- **BREAKING** 删除旧 `weiji-server` / `weiji-admin-web` / `weiji-app`，将 `*-next` 重命名为正式名
- 更新 README.md / 味记PRD.md / MVP开发速查手册.md / scripts/run-all-tests.sh
- weiji-web 保持功能参考原型定位（不变）；weiji-ai 保持独立 AI 层（不变）

## Impact

- Affected specs:
  - separate-ai-cooladmin-migration（前序已完成，本变更取代其自研实现）
  - merge-features-into-main（功能在新工程中重新落地）
  - frontend-backend-integration（API 路径破坏性变更 `/api/*`→`/app/*`·`/admin/*`）
  - family-system-backend（家庭域端点迁移到 cool-admin `family` 模块）
  - mvp-feature-completion（功能在新工程中重新落地）
- Affected code:
  - 新增 `weiji-server-next/`（cool-admin-midway）
  - 新增 `weiji-admin-web-next/`（cool-admin-vue）
  - 新增 `weiji-app-next/`（cool-uni）
  - [weiji-server/](file:///workspace/weiji-server) — 旧工程，迁移期保留可运行，Phase 4 删除
  - [weiji-admin-web/](file:///workspace/weiji-admin-web) — 旧工程，迁移期保留，Phase 4 删除
  - [weiji-app/](file:///workspace/weiji-app) — 旧工程，迁移期保留，Phase 4 删除
  - [weiji-ai/](file:///workspace/weiji-ai) — 不变，仅被新 server 调用
  - [weiji-web/](file:///workspace/weiji-web) — 不变，功能参考原型
  - [README.md](file:///workspace/README.md) / [scripts/run-all-tests.sh](file:///workspace/scripts/run-all-tests.sh) — Phase 4 更新指向新工程

## ADDED Requirements

### Requirement: 远程 main 同步
系统 SHALL 在开始迁移前同步本地 `main` 分支与远程 `origin/main` 一致。

#### Scenario: 同步代码
- **WHEN** 执行 `git fetch origin && git pull origin main`
- **THEN** 本地 `main` 与 `origin/main` 一致，工作树 clean，无未提交改动被覆盖

### Requirement: cool-admin-midway 后端工程
系统 SHALL 在 `weiji-server-next/` 基于 cool-admin-midway 官方脚手架重建后端，端口 8001，包含内置 base 模块与 7 个业务模块。

#### Scenario: 脚手架启动
- **WHEN** 执行 `cd weiji-server-next && npm install && npm run dev`
- **THEN** 服务在 :8001 启动，cool-admin 后台可用 admin/123456 登录，base 表自动建表

#### Scenario: 业务模块 CRUD
- **WHEN** 后台请求 `POST /admin/record/page`
- **THEN** cl-crud 自动生成分页查询，返回 `{ code: 0, data: { list, pagination }, message: "" }`

### Requirement: TypeORM entity 与数据模型
系统 SHALL 将现有 12+ 张表迁移为 TypeORM entity，表名统一 `weiji_` 前缀，继承 `BaseEntity`（id/createTime/updateTime/deleteTime），主键自增 bigint。

#### Scenario: 自动建表
- **WHEN** 开发环境启动（`synchronize: true`）
- **THEN** `weiji_record` / `weiji_family` / `weiji_app_user` 等表自动创建，字段与 entity 定义一致

#### Scenario: 软删除
- **WHEN** 删除一条记录
- **THEN** `deleteTime` 被写入，记录不在普通查询中返回（cool-admin `softDelete: true`）

### Requirement: C 端用户与 B 端用户分离
系统 SHALL 分离两套用户体系：B 端管理员 `base_sys_user`（cool-admin 内置 + RBAC）、C 端 App 用户 `weiji_app_user`（独立 JWT）。

#### Scenario: C 端登录
- **WHEN** App 用户请求 `POST /app/account/login`
- **THEN** 校验 weiji_app_user 凭据，签发 C 端独立 JWT，不混入 B 端 RBAC

#### Scenario: B 端登录
- **WHEN** 后台请求 `POST /admin/base/open/login`
- **THEN** 校验 base_sys_user 凭据，签发含 RBAC 的 cool-admin token

### Requirement: AI 代理模块
系统 SHALL 在 `ai` 模块封装对 weiji-ai:8002 的 HTTP 转发，前端不直接访问 AI 服务。

#### Scenario: 代理转发
- **WHEN** 前端请求 `POST /app/ai/recognize` 上传图片
- **THEN** ai 模块 service 转发到 weiji-ai `/ai/recognize`，30s 超时，失败降级返回 mock

#### Scenario: 健康检查
- **WHEN** 后端启动或定时检查
- **THEN** 调用 weiji-ai `/health`，不可用时 `/app/ai/*` 返回 `code: 503`

### Requirement: cool-admin-vue 后台工程
系统 SHALL 在 `weiji-admin-web-next/` 基于 cool-admin-vue 官方脚手架重建 PC 后台，端口 9000，迁移现有业务页面并用 cl-crud 生成管理页。

#### Scenario: 管理页 CRUD
- **WHEN** 访问 record 管理页
- **THEN** cl-crud 自动渲染列表/新增/编辑/删除，调用 `/admin/record/*`

#### Scenario: 业务页面迁移
- **WHEN** 访问首页/AI记录/家庭菜谱/成就/个人中心
- **THEN** 页面调用 `/app/*` 接口正常渲染，无占位

### Requirement: cool-uni 移动端工程
系统 SHALL 在 `weiji-app-next/` 基于 cool-uni 官方脚手架重建移动端，迁移现有 8 页面并补齐 Gameplay 页，接入 Service 自动化。

#### Scenario: H5 编译
- **WHEN** 执行 `npm run dev:h5`
- **THEN** H5 开发服务器启动，所有页面可访问

#### Scenario: 微信小程序
- **WHEN** 执行 `npm run dev:mp-weixin`
- **THEN** 生成小程序产物，可导入微信开发者工具，核心闭环可用

### Requirement: API 路径契约
系统 SHALL 按 cool-admin 路由分层重新定义 API 路径：`/admin/*`（B 端）、`/app/*`（C 端）、`/open/*`（公开）。

#### Scenario: C 端业务路径
- **WHEN** 前端请求美食记录列表
- **THEN** 调用 `GET /app/record/list`（原 `GET /api/record/list`）

#### Scenario: 公开健康检查
- **WHEN** 请求健康检查
- **THEN** 调用 `GET /open/health` 或保留 `/health`

### Requirement: 分阶段迁移与切换
系统 SHALL 按方案 §10 分 5 阶段迁移：Phase 0 脚手架准备、Phase 1 后端业务模块、Phase 2 PC 后台、Phase 3 移动端、Phase 4 切换清理。`-next` 目录并行迁移，旧工程保持可运行直到 Phase 4。

#### Scenario: 迁移期并存
- **WHEN** Phase 1–3 进行中
- **THEN** 旧 `weiji-server` / `weiji-admin-web` / `weiji-app` 仍可启动运行，测试仍指向旧工程

#### Scenario: Phase 4 切换
- **WHEN** Phase 4 完成
- **THEN** 旧三目录删除，`*-next` 重命名为正式名，README 与测试脚本更新指向新工程

## MODIFIED Requirements

### Requirement: 统一响应格式
cool-admin 原生响应格式为 `{ code, data, message }`，与现有契约一致，三端沿用。AI 降级时 HTTP 200，由 `code` 区分业务失败。

### Requirement: 鉴权
B 端使用 cool-admin base token（含 RBAC），C 端使用 App 端独立 JWT（绑定 weiji_app_user.id）。前端各端拦截器自动注入 Authorization、401 清理重定向（cool-admin-vue / cool-uni 内置）。

### Requirement: 工程布局
迁移期采用 `-next` 后缀目录并存（D7），Phase 4 删除旧目录并将 `-next` 重命名为正式名。weiji-web 标注为功能参考原型，weiji-ai 保持独立 AI 层。

## REMOVED Requirements

### Requirement: 自研 Koa 后端
**Reason**: cool-admin-midway 提供完整脚手架（RBAC/CRUD/菜单/字典/日志/文件），自研实现无意义
**Migration**: 现有 weiji-server 的 11 控制器、5 service、12 张表迁移到 weiji-server-next 的 7 个业务模块；现有 36 个测试迁移并改造到新工程

### Requirement: uuid 主键
**Reason**: cool-admin 全家桶（RBAC/CRUD/关联表）均假设自增 id（D5）
**Migration**: 主键改 bigint 自增（BaseEntity 提供）；因 D6 无生产数据，无需 id 映射脚本，Phase 4 通过 db.json 重新灌种子

### Requirement: 统一 /api/* 前缀
**Reason**: cool-admin 路由按 /admin /app /open 分层
**Migration**: C 端业务接口 `/api/*` → `/app/*`，B 端管理 `/admin/*`（cl-crud 自动生成），公开 `/open/*`；所有前端请求路径批量修改
