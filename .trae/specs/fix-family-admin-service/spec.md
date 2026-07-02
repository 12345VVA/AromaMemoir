# 修复家庭管理页面 service 路径错误与 B/C 端页面混入 Spec

## Why

后台「家庭管理」菜单点击后报错 `TypeError: service[dict.api.page] is not a function`，页面不可用。同时 family 模块下混入了 3 个 C 端页面（使用 `/app/*` 端点的 `appApi`），与 B 端 admin 项目（使用 `/admin/*` 端点的 cl-crud）架构不一致。需分析根因并修复，同时评估是否需要改造框架的权限/部门/用户体系。

## 分析结论（根因）

### 1. 家庭管理页面不可用的直接原因

[family/views/list.vue:141](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/list.vue#L141) 使用了错误的 service 路径：

```typescript
// 错误 ❌
service: (service as any).family.family

// 正确 ✓
service: service.family
```

**cool-admin-vue service 自动生成规则**（见 [node_modules/@cool-vue/vite-plugin/dist/index.js:1231-1286](file:///e:/project/AromaMemoir/weiji-admin-web/node_modules/@cool-vue/vite-plugin/dist/index.js#L1231-L1286)）：

- vite-plugin 调用 `/admin/base/open/eps` 获取所有控制器信息
- 对每个控制器的 `prefix`（如 `/admin/family`），去除 `admin` 前缀后按 `/` 分割转驼峰
- `/admin/family` → `["family"]` → `service.family`（直接挂载 page/list/add/update/delete/info 方法）
- `/admin/family/recipe` → `["family", "recipe"]` → `service.family.recipe`（嵌套对象）
- `/admin/family/menu` → `service.family.menu`
- `/admin/family/member` → `service.family.member`
- `/admin/family/invitation` → `service.family.invitation`
- `/admin/family/shopping` → `service.family.shopping`

因此 `service.family` 本身就拥有 `page/list/add/update/delete/info` 方法，`service.family.family` 是 `undefined`，调用 `undefined.page()` 报 `is not a function`。

**其他模块均正确**（经 grep 确认）：

| 模块 | service 引用 | 控制器 prefix | 状态 |
|------|-------------|--------------|------|
| record | `service.record` | `/admin/record` | ✓ |
| achievement | `service.achievement` | `/admin/achievement` | ✓ |
| checkin | `service.checkin` | `/admin/checkin` | ✓ |
| challenge | `service.challenge` | `/admin/challenge` | ✓ |
| gamification | `service.gamification.blindguess` | `/admin/gamification/blindguess` | ✓ |
| family | `service.family.family` | `/admin/family` | ❌ 应为 `service.family` |

### 2. C 端页面混入 B 端 admin 项目

family 模块下有 4 个视图文件：

| 文件 | 类型 | 数据源 | 问题 |
|------|------|--------|------|
| [list.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/list.vue) | B 端 cl-crud | `service.family`（/admin/*） | service 路径写错 |
| [recipes.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/recipes.vue) | **C 端** | `appApi`（/app/family/recipe/*） | 混入 B 端项目 |
| [recipe-form.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/recipe-form.vue) | **C 端** | `appApi`（/app/family/recipe/*） | 混入 B 端项目 |
| [recipe-detail.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/recipe-detail.vue) | **C 端** | `appApi`（/app/family/recipe/*） | 混入 B 端项目 |

[app-api.ts](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/business/utils/app-api.ts) 明确注释：「B 端管理员（base_sys_user）与 C 端 App 用户（weiji_app_user）是两套独立用户体系，token 互不通用」。C 端页面使用 `appToken`（localStorage `appToken` key），B 端使用 `admin token`（localStorage `token` key）。在 admin 后台打开 C 端页面会导致：

- 页面调用 `/app/*` 端点，但请求头携带的是 B 端 admin token
- C 端中间件校验 app token 失败，返回 401
- 页面数据加载失败，功能不可用

**这些 C 端页面应属于 weiji-app（uni-app C 端项目），不属于 weiji-admin-web（B 端管理后台）。**

### 3. menu.json viewPath 指向 C 端页面

此前 [analyze-menu-init](file:///e:/project/AromaMemoir/.trae/specs/analyze-menu-init/spec.md) 创建的 [family/menu.json](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/menu.json) 中，「家庭菜谱」菜单的 `viewPath=modules/family/views/recipes.vue` 指向了 C 端页面。admin 点击该菜单后加载的是 C 端 UI（调用 /app/* 端点），而非 B 端管理 UI（调用 /admin/* 端点）。需将 viewPath 改为 B 端 cl-crud 管理页面。

### 4. 权限/部门/用户体系评估结论：无需改造

cool-admin-midway 内置的三套体系均完备，无需改造：

#### 权限体系（RBAC）
- 表：`base_sys_menu`（菜单+按钮权限）、`base_sys_role`、`base_sys_role_menu`、`base_sys_user_role`
- 业务模块的 menu.json 已通过 `perms` 字段（如 `family:info:page`）接入 RBAC
- admin 超管自动拥有全部权限，非 admin 通过角色分配
- **无需改造**

#### 部门体系
- 表：`base_sys_department`（树形结构，`parentId` 支持层级）
- 用途：B 端管理员归属部门，用于数据权限隔离
- 业务「家庭组」（`weiji_family`）是独立域概念，有自己的成员模型（`weiji_family_member`）、邀请码、角色（admin/member）
- **家庭 ≠ 部门**：部门是组织架构（行政管理），家庭是业务域（社交协作）。强行合并会导致语义混乱（家庭成员邀请流程 ≠ 部门分配流程）
- **无需改造**

#### 用户体系
- B 端用户：`base_sys_user`（admin 管理员，username/password 登录）
- C 端用户：`weiji_app_user`（App 用户，独立 username/password）
- 两套 token 互不通用（B 端 `/admin/*` 校验 admin token，C 端 `/app/*` 校验 app token）
- 这是 [migrate-to-cool-admin-stack](file:///e:/project/AromaMemoir/.trae/specs/migrate-to-cool-admin-stack/spec.md) 决策 D5「C 端/B 端用户分离」的正确设计
- **无需改造**

## What Changes

### A. 修复 family/list.vue service 路径（核心）

- **修改** [family/views/list.vue:141](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/list.vue#L141)
  - `service: (service as any).family.family` → `service: service.family`
  - 移除不必要的 `(service as any)` 类型断言

### B. 将 family 模块 C 端页面替换为 B 端 cl-crud 管理页面

family 模块下 6 个子菜单（家庭组/菜谱/周菜单/成员/邀请码/购物清单）都需要 B 端 cl-crud 管理页面。当前只有 `list.vue`（家庭组管理），缺其余 5 个。

- **重写** `family/views/recipes.vue`：从 C 端 appApi 页面 → B 端 cl-crud 菜谱管理页（`service.family.recipe`）
- **重写** `family/views/recipe-form.vue`：从 C 端表单 → 删除（cl-crud 的 upsert 弹窗已覆盖新增/编辑）
- **重写** `family/views/recipe-detail.vue`：从 C 端详情 → 删除（cl-crud 的 info 已覆盖详情查看）
- **新增** `family/views/menu.vue`：周菜单管理 cl-crud 页（`service.family.menu`）
- **新增** `family/views/member.vue`：家庭成员管理 cl-crud 页（`service.family.member`）
- **新增** `family/views/invitation.vue`：邀请码管理 cl-crud 页（`service.family.invitation`）
- **新增** `family/views/shopping.vue`：购物清单管理 cl-crud 页（`service.family.shopping`）
- **更新** [family/config.ts](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/config.ts)：移除 recipe-form/recipe-detail 路由，新增 menu/member/invitation/shopping 路由

### C. 更新 family/menu.json viewPath

- 「家庭菜谱」viewPath 从 `modules/family/views/recipes.vue`（重写后仍用此文件名，但内容变为 cl-crud 页）保持不变
- 「周菜单管理」viewPath 保持 `modules/family/views/list.vue` → 改为 `modules/family/views/menu.vue`
- 「家庭成员」viewPath 从 `modules/family/views/list.vue` → `modules/family/views/member.vue`
- 「邀请码管理」viewPath 从 `modules/family/views/list.vue` → `modules/family/views/invitation.vue`
- 「购物清单」viewPath 从 `modules/family/views/list.vue` → `modules/family/views/shopping.vue`

### D. 不改造框架权限/部门/用户体系

- 保持 cool-admin 内置 RBAC / 部门 / B 端用户体系不变
- 保持 C 端 `weiji_app_user` 独立分离不变
- 保持业务「家庭」与框架「部门」分离不变

## Impact

- Affected specs:
  - analyze-menu-init（family menu.json 的 viewPath 需随本 spec 更新）
  - migrate-to-cool-admin-stack（B/C 端分离原则在本 spec 中强化）
- Affected code:
  - [weiji-admin-web/src/modules/family/views/list.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/list.vue)（修 service 路径）
  - `weiji-admin-web/src/modules/family/views/recipes.vue`（重写为 B 端 cl-crud）
  - `weiji-admin-web/src/modules/family/views/recipe-form.vue`（删除）
  - `weiji-admin-web/src/modules/family/views/recipe-detail.vue`（删除）
  - `weiji-admin-web/src/modules/family/views/{menu,member,invitation,shopping}.vue`（新增）
  - [weiji-admin-web/src/modules/family/config.ts](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/config.ts)（更新路由）
  - [weiji-server/src/modules/family/menu.json](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/menu.json)（更新 viewPath）
  - 数据库 `base_sys_menu` 表（需清理 family 锁标记后重新导入菜单）

## ADDED Requirements

### Requirement: family 模块 B 端管理页面 service 路径正确

系统 SHALL 为 family 模块的所有 B 端 cl-crud 管理页面使用正确的 service 引用，与后端 `@CoolController` prefix 一一对应。

#### Scenario: 家庭组管理页面加载
- **WHEN** admin 在后台点击「家庭组管理」菜单
- **THEN** 页面调用 `service.family.page()` 加载分页数据，无 `is not a function` 错误

#### Scenario: 菜谱管理页面加载
- **WHEN** admin 点击「家庭菜谱」菜单
- **THEN** 页面调用 `service.family.recipe.page()` 加载菜谱分页数据

### Requirement: family 模块所有子菜单均有 B 端 cl-crud 管理页面

系统 SHALL 为 family 模块的 6 个子菜单（家庭组/菜谱/周菜单/成员/邀请码/购物清单）各提供一个 B 端 cl-crud 管理页面，使用对应的后端 service。

#### Scenario: 各子菜单可访问
- **WHEN** admin 点击 family 下任意子菜单
- **THEN** 加载对应的 cl-crud 管理页面，表格展示分页数据，支持新增/编辑/删除操作

### Requirement: B 端 admin 项目不含 C 端页面

系统 SHALL 确保 `weiji-admin-web` 中所有页面仅调用 `/admin/*` B 端端点，不混入调用 `/app/*` C 端端点的页面。

#### Scenario: B 端页面数据源
- **WHEN** 任意 admin-web 页面发起请求
- **THEN** 请求路径以 `/admin/` 开头，使用 B 端 admin token，不使用 `appApi` 或 `appToken`

## MODIFIED Requirements

### Requirement: family menu.json viewPath 对齐

[analyze-menu-init](file:///e:/project/AromaMemoir/.trae/specs/analyze-menu-init/spec.md) 创建的 family menu.json 中部分 viewPath 指向了 C 端页面或复用了 list.vue。现修改为各子菜单独立 B 端 cl-crud 页面。

#### Scenario: menu.json viewPath 与前端文件一一对应
- **WHEN** family menu.json 导入数据库
- **THEN** 每个子菜单的 viewPath 指向独立的 B 端 cl-crud vue 文件（menu.vue/member.vue/invitation.vue/shopping.vue），不复用 list.vue
