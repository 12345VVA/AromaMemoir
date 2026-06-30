# 后端生产可用化 Spec（MySQL 持久化 + 配置外置 + 安全基线）

## Why

项目评审报告指出，味记当前处于"能演示，不能上线"的原型阶段（成熟度约 60%）。三个 P0 阻塞项中，**数据持久化缺失是最致命的一项**：所有数据存在 TypeScript 内存数组里（[db.ts](file:///workspace/weiji-server/src/store/db.ts)），服务重启即全部丢失，无法进行真实内测。同时 [configuration.ts:40](file:///workspace/weiji-server/src/configuration.ts#L40) 将 JWT 密钥硬编码为 `'weiji-server-jwt-secret-2026'`，任何人拿到代码即可伪造任意用户 token。

好消息是 [db/init.sql](file:///workspace/weiji-server/db/init.sql) 已写好 12 张表 DDL + 种子数据，[db/README.md](file:///workspace/weiji-server/db/README.md) 明确写道"具体切换逻辑由后续 spec 处理"——本 spec 正是补齐该连接层。这是报告所列所有行动中**投入产出比最高**的一项（1-2 天工作量，解锁真实内测能力）。

本 spec 聚焦后端工程化补齐，使项目从"原型"迈入"可内测"。前端碎片化合并、Redis/WebSocket/OSS 基础设施、移动端等属于不同关注点，**明确不在本 spec 范围内**，由后续独立 spec 处理（见"Out of Scope"）。

## What Changes

### 后端存储层重构（核心）
- **新增** `mysql2` 依赖（Promise 版连接池）
- **新增** `store/repository.ts`：定义泛型 `Repository<T>` 接口，方法与现有 [helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts) 一一对应（`findById` / `findByField` / `findAll` / `insert` / `updateById` / `softDelete` / `count` 等）
- **新增** `store/in-memory-repository.ts`：`InMemoryRepository<T>` 包装内存数组，复用现有 helpers 逻辑（行为零变化，保证现有 141 个测试全绿）
- **新增** `store/mysql-repository.ts`：`MysqlRepository<T>` 基于 mysql2 连接池实现 `Repository<T>` 接口，自动完成 camelCase 字段 ↔ 数据库行的映射、JSON 字段序列化、软删除过滤
- **重构** [db.ts](file:///workspace/weiji-server/src/store/db.ts)：改为工厂模式，根据 `appConfig.storage.driver` 实例化 12 个实体的 Repository（`users` / `families` / `familyMembers` / `familyRecipes` / `invitations` / `records` / `weeklyMenu` / `shoppingItems` / `achievements` / `userAchievements` / `checkIns` / `challenges`），导出对象类型由"裸数组"变为"Repository 实例"
- **重构** 所有 service / controller 调用点：将 `findByField(users, 'username', x)` 改为 `users.findByField('username', x)`，`insert(users, obj)` 改为 `users.insert(obj)`，以此类推（机械式替换，不改业务逻辑）

### 配置外置与安全基线
- **新增** `.env.example`：声明全部环境变量（`JWT_SECRET`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`DB_DRIVER`、`AI_SERVICE_URL`、`PORT`）
- **修改** [configuration.ts](file:///workspace/weiji-server/src/configuration.ts)：所有敏感配置改为从 `process.env` 读取，保留内存模式作为默认值（保证未配置环境变量时 dev 与测试仍可运行）；**JWT_SECRET 缺失时启动报错并退出**（生产模式强制要求）
- **新增** `dotenv` 依赖：`bootstrap.ts` 启动时加载 `.env`
- **新增** `.gitignore` 条目：忽略 `.env`（防止密钥入库）

### 种子数据与启动流程
- **修改** `bootstrap.ts`：启动时若 `DB_DRIVER=mysql`，先校验数据库连通性，缺失表时打印指引（不自动执行 SQL，避免误操作）；内存模式仍预填充种子数据
- **修改** [db/README.md](file:///workspace/weiji-server/db/README.md) 与根 [README.md](file:///workspace/README.md)：更新为"已支持 MySQL 持久化"，移除"接口预留/后续 spec 处理"措辞，补充启用步骤与故障排查

### 文档一致性修复（P2，低工作量顺带完成）
- **修改** 根 [README.md](file:///workspace/README.md)：修正"前端实现待补"等与现状不符的描述（weiji-admin-web 已存在），统一三服务架构描述
- **修改** [MVP开发速查手册.md](file:///workspace/MVP开发速查手册.md)：将"cool-admin 项目结构"描述对齐到实际 Koa 简化方案

## Impact

- Affected specs:
  - `implement-cooladmin-backend`（其 REMOVED Requirements "MySQL 接口预留" 由本 spec 真正落地）
  - `comprehensive-testing-system`（本 spec 必须保持 141 个测试全绿，存储抽象需对测试透明）
- Affected code:
  - [weiji-server/src/store/db.ts](file:///workspace/weiji-server/src/store/db.ts) — 重构为 Repository 工厂
  - [weiji-server/src/store/helpers.ts](file:///workspace/weiji-server/src/store/helpers.ts) — 被 InMemoryRepository 复用
  - [weiji-server/src/store/types.ts](file:///workspace/weiji-server/src/store/types.ts) — 可能补充 Repository 接口类型
  - [weiji-server/src/configuration.ts](file:///workspace/weiji-server/src/configuration.ts) — 配置外置
  - [weiji-server/src/bootstrap.ts](file:///workspace/weiji-server/src/bootstrap.ts) — dotenv 加载 + DB 连通性校验
  - 全部 `src/service/*.ts` 与 `src/controller/*.ts` — 调用点机械式替换
  - [weiji-server/package.json](file:///workspace/weiji-server/package.json) — 新增 mysql2 / dotenv 依赖
  - [weiji-server/db/init.sql](file:///workspace/weiji-server/db/init.sql) — 校正种子数据密码占位符为真实 bcrypt 哈希（demo/123456）
  - [weiji-server/db/README.md](file:///workspace/weiji-server/db/README.md) / 根 [README.md](file:///workspace/README.md) / [MVP开发速查手册.md](file:///workspace/MVP开发速查手册.md) — 文档同步

## ADDED Requirements

### Requirement: 存储抽象层
系统 SHALL 提供统一的 `Repository<T>` 接口抽象存储访问，支持内存与 MySQL 两种实现，由配置切换，对业务层透明。

#### Scenario: 内存模式（默认，用于开发与测试）
- **WHEN** 未设置 `DB_DRIVER` 或 `DB_DRIVER=memory`
- **THEN** 12 个实体 Repository 全部使用 `InMemoryRepository`，预填充种子数据，行为与现状完全一致
- **AND** 现有 141 个测试（76 单元 + 65 集成）全部通过，零修改

#### Scenario: MySQL 模式（用于内测/生产）
- **WHEN** 设置 `DB_DRIVER=mysql` 并提供有效 `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`
- **THEN** 12 个实体 Repository 全部使用 `MysqlRepository`，数据持久化到 MySQL
- **AND** 服务重启后数据不丢失

#### Scenario: MySQL 不可达时明确报错
- **WHEN** `DB_DRIVER=mysql` 但数据库连接失败
- **THEN** 启动阶段打印明确错误（含 host/port/database）并 `process.exit(1)`，不静默降级到内存模式

### Requirement: MySQL 持久化
系统 SHALL 通过 mysql2 连接池将全部 12 个实体的 CRUD 持久化到 MySQL，表结构与 [init.sql](file:///workspace/weiji-server/db/init.sql) 一致。

#### Scenario: 注册用户持久化
- **WHEN** `DB_DRIVER=mysql` 下用户 `POST /api/auth/register` 注册成功
- **THEN** 用户写入 `users` 表，服务重启后该用户仍可登录

#### Scenario: 创建记录持久化
- **WHEN** 用户 `POST /api/record` 创建记录
- **THEN** 记录写入 `records` 表，重启后 `GET /api/record/list` 仍返回该记录

#### Scenario: 软删除过滤
- **WHEN** 查询列表时
- **THEN** MySQL 模式自动过滤 `isDeleted=0`，与内存模式 `filterBy` 行为一致

#### Scenario: JSON 字段正确序列化
- **WHEN** 写入含 JSON 字段的实体（如 `achievements.condition`、菜谱 `ingredients`）
- **THEN** MySQL 模式将 JSON 对象序列化为字符串写入 `JSON` 列，读取时反序列化回对象

### Requirement: 配置外置
系统 SHALL 通过环境变量管理所有敏感配置，源码中不再包含任何明文密钥或连接串。

#### Scenario: JWT 密钥来自环境变量
- **WHEN** 启动服务
- **THEN** JWT 密钥从 `process.env.JWT_SECRET` 读取，[configuration.ts](file:///workspace/weiji-server/src/configuration.ts) 中不再出现硬编码密钥

#### Scenario: 生产模式强制密钥
- **WHEN** `NODE_ENV=production` 且未设置 `JWT_SECRET`
- **THEN** 启动报错 "JWT_SECRET 未配置，生产环境禁止使用默认密钥" 并退出

#### Scenario: 开发模式兜底
- **WHEN** `NODE_ENV` 非 production 且未设置 `JWT_SECRET`
- **THEN** 使用开发用默认密钥并打印警告日志，保证 dev/test 可开箱即用

#### Scenario: 数据库连接来自环境变量
- **WHEN** `DB_DRIVER=mysql`
- **THEN** 连接参数（host/port/user/password/database）全部从 `process.env` 读取，支持 `.env` 文件加载

### Requirement: 环境变量样例文件
系统 SHALL 提供 `.env.example` 列出全部支持的环境变量及说明，`.env` 被 git 忽略。

#### Scenario: 新开发者按样例配置
- **WHEN** 新开发者克隆仓库
- **THEN** `cp .env.example .env` 后填入本地值即可运行，无需阅读源码

## MODIFIED Requirements

### Requirement: 数据存储层
原需求（来自 `implement-cooladmin-backend`）：内存数据存储层，预填充种子数据，CRUD 真实生效。
修改后：存储层升级为可切换的 `Repository<T>` 抽象，内存模式为默认（保持向后兼容），MySQL 模式为可选持久化实现。种子数据在两种模式下均可用。

### Requirement: MySQL 初始化脚本
原需求（来自 `implement-cooladmin-backend`）：init.sql 作为"接口预留"，不强制落地连接。
修改后：init.sql 为正式启用的持久化建表脚本，密码占位符替换为真实 bcrypt 哈希，[db/README.md](file:///workspace/weiji-server/db/README.md) 更新启用步骤。

### Requirement: JWT 认证
原需求：JWT 密钥硬编码在配置中。
修改后：JWT 密钥从环境变量读取，生产模式强制要求，开发模式兜底默认值并告警。

## Out of Scope（明确不在本 spec 范围，由后续独立 spec 处理）

以下报告提及的问题与本 spec 关注点不同，刻意排除以保持本 spec 聚焦且可独立交付：

- **前端碎片化合并**（weiji-web 11 项功能迁移到 weiji-admin-web）—— 纯前端迁移工作，建议独立 spec `frontend-consolidation`
- **Redis + WebSocket 实时同步** —— 需引入基础设施，报告明确"HTTP 轮询即可满足 MVP"，建议独立 spec
- **OSS/CDN 图片存储** —— 当前 base64 内存方案可跑通闭环，建议独立 spec
- **移动端 / 微信小程序** —— 技术选型未定，独立 spec
- **AI 贴纸真实生成、AI 准确率评估体系** —— AI 能力增强，独立 spec
- **P1 功能缺口补齐**（F3 日期筛选、F7 准确率评估、F8 滤镜 UI、F9 筛选 UI）—— 功能增强，独立 spec
- **系统监控 + 日志告警** —— 运维体系，独立 spec

## REMOVED Requirements

### Requirement: 明文 JWT 密钥
**Reason**: 安全基线缺陷，硬编码密钥可被任意伪造 token。
**Migration**: 改为环境变量读取，`.env.example` 提供填写指引，开发模式保留兜底默认值避免破坏现有 dev/test 流程。
