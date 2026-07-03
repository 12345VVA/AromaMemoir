# 家庭组审计问题修复 Spec

## Why

`deliverables/software-company/aromamemoir-audit-2026-07-03.md` 对四端家庭组逻辑做专项审计，共发现 18 个问题（4 P0 + 8 P1 + 6 P2）。经核查：3 项已由 `fix-logic-vulnerabilities` 修复（P1-4 APP 创建/加入入口、P1-15 APP 路由守卫、P2-11 memberCount 原子化），1 项部分修复（P1-10 核心并发路径已加锁，但 updateMember/菜谱/菜单/购物等写操作仍无锁），**剩余 14 项仍未修复**。

最严重的两块地基问题：
- **P0-1 + P0-2**：weiji-web 端 `code !== 0` 误判 + `/api/*` 路径与后端 `/app/*` 完全不匹配，导致 weiji-web 所有 API 调用必失败，连带阻断 P1-5、P2-17、P2-18 的 Web 端部分
- **P0-12**：家庭组生命周期不完整，缺退出/解散/转让三大核心 API，成员一旦加入无法自行离开，owner 无法清理僵尸家庭

本 spec 聚焦家庭组生命周期的"完整闭环"与"跨端一致性"，不重复处理上一轮已修复项。

## What Changes

### P0 立即修复

#### Web 前端地基修复（P0-1 + P0-2 + P1-5 + P2-17 Web 部分 + P2-18 Web 部分）
- **[BREAKING] 统一响应成功码为 1000**：[weiji-web/api.js](file:///e:/project/AromaMemoir/weiji-web/api.js) `request()` 的 `result.code !== 0` 改为 `result.code !== 1000`，并抽取为常量 `SUCCESS_CODE = 1000`
- **[BREAKING] API 路径迁移到 `/app/*` 与 `/admin/*`**：weiji-web/api.js 全部端点从 `/api/auth/login`、`/api/family`、`/api/family/members` 等改为对齐后端的 `/app/user/login/username`、`/app/family`、`/app/family/member/list` 等；`/api/record` 类似迁移
- **统一超时控制**：fetch 加 `AbortController` + 15 秒超时（修复 P2-17 Web 无超时）
- **登录端点对齐**：核查后端 `/app/user/login/username` 是否存在，若不存在则用现有的 `/app/user/login/wx` 或补 `/app/user/login/username` 端点
- **抽取家庭组默认名称常量**：[weiji-app/pages/family/index.vue](file:///e:/project/AromaMemoir/weiji-app/pages/family/index.vue) `familyInfo.name || "我的家庭"` 抽到 weiji-app 与 weiji-web 共享的常量；weiji-web 显示家庭名称也用同默认值（修复 P2-18）
- P1-5 自动随 P0-1/P0-2 修复而恢复

#### 家庭组生命周期 API 补齐（P0-12 + P1-13 + P1-14）
- **新增 `POST /app/family/leave` 退出家庭组**：[family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/service/family.ts) 新增 `leaveFamily(userId)` 方法
  - owner 调用时：若家庭只剩 owner 一人，自动解散（删除 family + member 关系 + 关联菜谱/菜单/购物项的清理由数据库外键级联或显式 delete 实现）；若还有其他成员，抛 400 `"owner 请先转让或解散家庭组"`
  - 非 owner 调用时：删除自己的 member 关系，memberCount 原子 -1，事务包裹
  - 清理该用户在该家庭的邀请码、未读消息（如有）
- **新增 `POST /app/family/disband` 解散家庭组**：`disbandFamily(userId)` 方法
  - 仅 owner 可调用
  - 事务内：删除所有 family_member、family_recipe、family_menu、family_shopping_item、family_invitation 记录，最后删除 family 本身
  - 不删除 record（record 属于用户而非家庭，但 familyId 置 NULL 或保留以追溯）
- **新增 `POST /app/family/transfer` 转让 owner**：`transferOwnership(userId, targetMemberId)` 方法
  - 仅 owner 可调用
  - target 必须是同家庭成员且 role !== 'owner'
  - 事务内：旧 owner.role 改为 'admin'，target.role 改为 'owner'，family.ownerId 更新为 target.userId
- **controller 路由**：[controller/app/family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/family.ts) 新增 3 个 `@Post` 端点
- **APP UI 配套**：[pages/family/index.vue](file:///e:/project/AromaMemoir/weiji-app/pages/family/index.vue) 增加按钮
  - 非 owner：显示"退出家庭组"按钮，二次确认后调 leave
  - owner：显示"转让家庭组"与"解散家庭组"两个按钮，解散需二次确认 + 输入家庭名称确认
  - 成员列表项（仅 owner 可见）：增加"转让给TA"按钮（P1-14 修复）

#### 跨端状态同步短期方案（P0-8）
> 完整 WebSocket/SSE 实时推送属于 Out of Scope（需独立 spec），本 spec 仅实现"短期可行方案"。

- **APP 端 EventBus 同端通知**：[pages/family/index.vue](file:///e:/project/AromaMemoir/weiji-app/pages/family/index.vue) onShow 同时调 `loadFamily() + loadMembers() + loadRecipes()`（修复 P1-9），并监听 `uni.$on('familyChanged', refreshAll)` 事件，在创建/加入/退出/解散/转让成功后 `uni.$emit('familyChanged')` 通知同端其他页面
- **Web 端轮询**：[weiji-web/app.js](file:///e:/project/AromaMemoir/weiji-web/app.js) `loadFamilyData()` 后启动 `setInterval(loadFamilyData, 30000)` 轮询，`beforeunload` 或页面切换时 `clearInterval`；若 familyInfo 突然变 null（被移除/解散），自动显示创建入口
- **Web 端 localStorage 跨标签同步**：监听 `window.addEventListener('storage', ...)`，token 或 user 变更时同步刷新

### P1 本周修复

#### 后端返回行为统一（P1-3）
- **统一方案 A（静默返回空数据）**：[controller/app/member.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/member.ts)、[recipe.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/recipe.ts)、[menu.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/menu.ts)、[shopping.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/shopping.ts) 的 list 方法在用户未加入家庭时返回 `{ list: [], total: 0 }` 而非抛异常；[report.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/report.ts) 已是空报告，保持不变
- **getMyFamily 保持 null**：让前端通过 `GET /app/family` 是否 null 判断"是否已加入家庭"，子资源接口一律返回空数据
- **service 层调整**：listMembers/listRecipes/listMenus/listShoppingItems 在 membership 为空时直接返回 `[]` 或 `{ list: [], total: 0 }`，不抛异常

#### APP onShow 刷新（P1-9）
- [pages/family/index.vue](file:///e:/project/AromaMemoir/weiji-app/pages/family/index.vue) `onShow` 改为 `loadFamily() + loadMembers() + loadRecipes()`，避免从其他页面返回时显示过期数据
- 配合 EventBus `familyChanged` 事件做即时刷新

#### 剩余写操作加锁（P1-10 剩余部分）
- **updateMember**：加事务包裹（update 本身原子，但若有副作用需事务）
- **createRecipe/updateRecipe/deleteRecipe**：加事务，updateRecipe/deleteRecipe 用乐观锁 version 字段或悲观锁 `setLock('pessimistic_write')`
- **addMenu/toggleShopping/deleteShopping**：toggleShopping 用原子 update `SET completed = NOT completed`，避免读改写
- **FamilyEntity 增加 version 字段**（乐观锁）：recipe/menu/shopping 实体同步加 version，update 时 `WHERE version = :oldVersion` 并 `SET version = version + 1`，影响行数 0 抛 409 冲突

### P2 后续修复

#### APP 错误状态可见化（P2-6）
- [pages/family/index.vue](file:///e:/project/AromaMemoir/weiji-app/pages/family/index.vue) 新增 `error` ref 状态，catch 块设 `error.value = err.message`，UI 区分"加载中 / 加载失败 / 空数据"三态，失败显示重试按钮
- 仅 family 页面做此改造，其他页面保持现状（避免范围蔓延）

#### Admin CRUD 业务校验（P2-7）
- [controller/admin/family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/admin/family.ts) 覆盖 `add` 与 `delete` 方法：
  - add：禁止直接创建（admin 不应绕过 owner 流程），抛 400 `"请通过 C 端创建家庭组接口创建"`
  - delete：调 `familyService.disbandFamily(ownerId, { adminForce: true })` 级联清理，不直接删 family 表
- 不覆盖 update/info/page/list（这些只读或非破坏性）

#### 账号删除孤儿清理（P2-16）
- [user/service/info.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/user/service/info.ts) `logoff()` 在递增 passwordV 后，事务内：
  - 查询该用户在所有家庭组的 member 关系
  - 对每个家庭：若该用户是 owner，自动转让给该家庭中最早加入的 admin，若无 admin 则给最早的 member，若再无成员则解散
  - 删除该用户的所有 family_member 记录
  - 同步 memberCount（原子 -1）
- 注入 FamilyService 或在 FamilyService 暴露 `handleUserLogoff(userId)` 方法供 logoff 调用

#### 网络降级策略统一（P2-17 剩余部分）
- weiji-web/api.js 已在 P0-1 修复时加 15 秒超时
- weiji-app/utils/api.ts 超时从 30 秒改为 15 秒（与 web 一致）
- 统一文案：网络失败统一 `"网络异常，请稍后重试"`，401 统一 `"登录已失效，请重新登录"`

#### 家庭组名称默认值统一（P2-18 剩余部分）
- 后端 [FamilyEntity](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/entity/family.ts) `name` 字段加 `default: '未命名家庭'`
- createFamily 若 name 为空字符串，使用默认值（保持"不能为空"校验，但允许默认值）
- APP 与 Web 显示统一用 `familyInfo.name || '未命名家庭'`

## Impact

- Affected specs:
  - `fix-logic-vulnerabilities`（其已修复 P1-4/P1-15/P2-11/P1-10 核心，本 spec 补齐 P1-10 剩余 + P1-9 + 家庭组生命周期）
  - `family-system-backend`（本 spec 扩展 family service 的 leave/disband/transfer 三个核心方法）
  - `harden-security-and-quality`（P2-16 账号删除孤儿清理与其安全基线协同）
  - `frontend-backend-integration`（本 spec 修复 weiji-web 的 code/路径地基问题，是 weiji-web 联调的前提）
- Affected code:
  - **weiji-web**：api.js（地基重写）、app.js（轮询 + storage 监听）、相关页面适配新路径
  - **weiji-server**：family/service/family.ts（新增 leave/disband/transfer + handleUserLogoff）、family/controller/app/family.ts（3 个新路由）、family/controller/admin/family.ts（覆盖 add/delete）、family/controller/app/{member,recipe,menu,shopping}.ts（统一返回空数据）、family/entity/{family,recipe,menu,shopping_item}.ts（version 字段）、user/service/info.ts（logoff 级联清理）
  - **weiji-app**：pages/family/index.vue（onShow 刷新 + 退出/解散/转让 UI + error 状态 + EventBus）、utils/api.ts（超时 15s + 文案统一）、新增共享常量文件
  - **新增**：weiji-web 与 weiji-app 共享的常量（默认家庭名、成功码、超时时间）

## ADDED Requirements

### Requirement: Web 前端 API 响应码与路径对齐
weiji-web 的 `api.js` SHALL 使用 `code === 1000` 判断成功，路径 SHALL 使用 `/app/*` 与 `/admin/*` 前缀对齐后端路由。

#### Scenario: Web 端调用任意 API
- **WHEN** weiji-web 调用 `/app/family` 获取家庭组
- **THEN** 后端返回 `{ code: 1000, data: ... }`，前端正确解析为成功并返回 data

#### Scenario: 路径不匹配
- **WHEN** weiji-web 调用旧路径 `/api/family`
- **THEN** 不应出现（已全部迁移到 `/app/*`）

### Requirement: Web 前端超时控制
weiji-web 的 `api.js` SHALL 为每个请求设置 15 秒超时（通过 `AbortController`）。

#### Scenario: 请求超时
- **WHEN** 后端响应超过 15 秒
- **THEN** 抛出 `"网络异常，请稍后重试"`，不无限等待

### Requirement: 家庭组退出 API
系统 SHALL 提供 `POST /app/family/leave` 让成员主动退出家庭组。

#### Scenario: 非 owner 退出
- **WHEN** 非 owner 成员调用 leave
- **THEN** 删除其 member 关系，memberCount 原子 -1，返回 200

#### Scenario: owner 独自退出
- **WHEN** owner 且家庭只剩自己一人调用 leave
- **THEN** 自动解散家庭组（删除 family + 所有关联数据），返回 200

#### Scenario: owner 非独自退出
- **WHEN** owner 且家庭还有其他成员调用 leave
- **THEN** 返回 400 + `"owner 请先转让或解散家庭组"`

### Requirement: 家庭组解散 API
系统 SHALL 提供 `POST /app/family/disband` 让 owner 主动解散家庭组。

#### Scenario: owner 解散
- **WHEN** owner 调用 disband
- **THEN** 事务内删除 family_member、family_recipe、family_menu、family_shopping_item、family_invitation、family 记录，返回 200

#### Scenario: 非 owner 解散
- **WHEN** 非 owner 调用 disband
- **THEN** 返回 403 + `"仅 owner 可解散家庭组"`

### Requirement: 家庭组转让 API
系统 SHALL 提供 `POST /app/family/transfer` 让 owner 转让所有权。

#### Scenario: owner 转让给 admin
- **WHEN** owner 调用 transfer 传入 targetMemberId（同家庭 admin）
- **THEN** 旧 owner.role 改为 admin，target.role 改为 owner，family.ownerId 更新，返回 200

#### Scenario: 跨家庭转让
- **WHEN** owner 传入其他家庭的 memberId
- **THEN** 返回 403 + `"目标成员不在本家庭"`

### Requirement: APP 端家庭组页面三态显示
weiji-app 的 `pages/family/index.vue` SHALL 区分"加载中 / 加载失败 / 空数据 / 有数据"四种状态。

#### Scenario: 加载失败
- **WHEN** loadFamily 失败
- **THEN** 显示错误提示 + "重试"按钮，点击重试重新调用 loadFamily

#### Scenario: 网络正常但无数据
- **WHEN** loadFamily 成功但 familyInfo 为 null
- **THEN** 显示创建/加入家庭组引导入口

### Requirement: 家庭组写操作乐观锁
family_recipe / family_menu / family_shopping_item 实体 SHALL 增加 `version` 字段，update 时校验版本号。

#### Scenario: 并发更新菜谱
- **WHEN** 两端同时修改同一菜谱
- **THEN** 先提交者成功，后提交者返回 409 + `"数据已被修改，请刷新后重试"`

### Requirement: 后端子资源查询对"无家庭组"统一返回空数据
family 模块的 member/recipe/menu/shopping 子资源 list 接口 SHALL 在用户未加入家庭时返回 `{ list: [], total: 0 }`，不抛异常。

#### Scenario: 未加入家庭查询菜谱
- **WHEN** 未加入家庭的用户调用 `GET /app/family/recipe/list`
- **THEN** 返回 200 + `{ list: [], total: 0 }`

### Requirement: 账号注销级联清理家庭关系
user 模块的 `logoff()` SHALL 在用户注销时清理其所有家庭组成员关系，并处理 owner 转让或解散。

#### Scenario: 普通成员注销
- **WHEN** 非 owner 用户注销
- **THEN** 删除其所有 family_member 记录，相关家庭 memberCount 原子 -1

#### Scenario: owner 注销
- **WHEN** owner 注销且有其他成员
- **THEN** 自动转让给最早加入的 admin（或 member），family.ownerId 更新

#### Scenario: owner 独自注销
- **WHEN** owner 注销且家庭只剩自己
- **THEN** 解散家庭组

### Requirement: Web 端跨标签状态同步
weiji-web SHALL 监听 `storage` 事件实现跨标签状态同步，并启动 30 秒轮询刷新家庭组信息。

#### Scenario: 多标签登录态同步
- **WHEN** 标签 A 登出，标签 B 检测到 token 变化
- **THEN** 标签 B 自动刷新页面状态，显示登录页

#### Scenario: 家庭组被解散
- **WHEN** 30 秒轮询发现 familyInfo 变为 null
- **THEN** 自动显示创建家庭组入口

## MODIFIED Requirements

### Requirement: APP 家庭组页面 onShow 刷新
原实现：onShow 仅调用 `loadRecipes()`。
修改后：onShow 调用 `loadFamily() + loadMembers() + loadRecipes()`，并监听 `uni.$on('familyChanged', refreshAll)` 事件，onUnmounted 时 `uni.$off`。

### Requirement: 家庭组名称默认值
原实现：APP 用 `"我的家庭"`，Web 无默认值，后端必填无默认。
修改后：后端 FamilyEntity.name 设 `default: '未命名家庭'`，APP 与 Web 显示统一用 `familyInfo.name || '未命名家庭'`。

### Requirement: Admin 家庭组 CRUD
原实现：AdminFamilyController 完全依赖 cool-admin 自动 CRUD，add/delete 绕过业务校验。
修改后：覆盖 add 抛 400 禁止直接创建，覆盖 delete 调用 `familyService.disbandFamily` 级联清理。

### Requirement: 网络异常降级策略
原实现：Web 无超时、APP 30 秒超时，文案与 401 处理不一致。
修改后：统一 15 秒超时，网络失败统一文案 `"网络异常，请稍后重试"`，401 统一 `"登录已失效，请重新登录"`。

## REMOVED Requirements

### Requirement: weiji-web 使用 `/api/*` 路径前缀
**Reason**: 与后端 `/app/*` 路由完全不匹配，导致所有请求 404。
**Migration**: 全部迁移到 `/app/*`（C 端）与 `/admin/*`（B 端）。

### Requirement: weiji-web 用 `code !== 0` 判断成功
**Reason**: 后端统一成功码为 1000，`code !== 0` 会将所有成功响应误判为失败。
**Migration**: 改为 `code !== 1000`，抽取常量。

### Requirement: family 子资源接口对"无家庭组"抛异常
**Reason**: 与 getMyFamily 返回 null、report 返回空报告不一致，前端需写三种兜底。
**Migration**: 统一返回空数据 `{ list: [], total: 0 }`。

## Out of Scope

以下问题不在本 spec 范围：

- **完整 WebSocket/SSE 实时推送**（P0-8 长期方案）—— 需引入 ws 基础设施、心跳、重连、消息队列，独立 spec
- **weiji-web 完全重写为 Vue/React 工程** —— 产品形态决策，本 spec 仅修复地基让现有静态 demo 可用
- **FamilyEntity 外键级联约束**（数据库 DDL 变更）—— 涉及存量数据迁移，由独立 spec 处理；本 spec 通过应用层级联清理
- **测试用例补齐**（每个修复点的单元/集成测试）—— 由实现阶段同步补齐，不单列 spec
- **P1-10 长期方案：分布式锁**（Redis）—— 独立 spec
- **weiji-admin-web 家庭组管理页改造**（B 端 UI 适配 disband 调用）—— cool-admin 自动 CRUD 已足够，本 spec 仅覆盖 add/delete 后端校验

## 验收基线

- 现有测试套件保持原通过项不回归
- 新增 API 端点测试：leave/disband/transfer 三类场景（成功 + 权限拒绝 + 边界）
- weiji-web 在浏览器中可完成：登录 → 创建家庭组 → 查看菜谱 → 退出家庭组 全链路，无 404/无 code 误判
- weiji-app 在 H5 与小程序端可完成：进入家庭页 → 看到"退出/解散/转让"按钮 → 调用对应 API → UI 正确刷新
- `cd weiji-server && npx tsc --noEmit --skipLibCheck` exit 0
- `cd weiji-admin-web && npm run build` exit 0（如适用）
- 跨标签同步：标签 A 登出，标签 B 自动检测并刷新
