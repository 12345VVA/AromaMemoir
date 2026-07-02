# 菜单初始化分析与业务菜单缺失修复 Spec

## Why

本地环境初始化后访问 `weiji-admin-web` 后台，左侧仅显示 cool-admin 内置的默认菜单（系统管理、数据管理、用户管理、扩展管理、框架教程、首页），看不到任何味记业务菜单（美食记录、家庭组、菜谱、成就、打卡、挑战、盲猜、AI 记录等）。

需要分析 cool-admin-midway 的菜单初始化机制，确认业务功能页面是"页面不存在"还是"页面存在但未在初始化时写入数据库"，并给出修复方案。同时 `weiji-app` 安装依赖失败，需一并排查。

## 分析结论（根因）

### 1. 菜单初始化机制（cool-admin-midway v8）

后端通过 `@cool-midway/core` 的 `CoolModuleMenu`（[weiji-server/node_modules/@cool-midway/core/dist/module/menu.js](file:///e:/project/AromaMemoir/weiji-server/node_modules/@cool-midway/core/dist/module/menu.js)）在启动时扫描 `src/modules/*/menu.json`，按 `initJudge` 判断是否导入：

- `config.local.ts` 中配置 `cool.initMenu: true` + `cool.initJudge: 'db'`（[weiji-server/src/config/config.local.ts](file:///e:/project/AromaMemoir/weiji-server/src/config/config.local.ts#L33-L42)）。
- 判断依据：查询 `base_sys_conf` 表是否存在 `cKey = 'init_menu_<模块名>'` 记录。
- 存在则跳过，不存在则读取 `src/modules/<模块名>/menu.json` 写入 `base_sys_menu` 表，再写入锁标记。
- 锁标记通过 [BaseMenuEvent.onMenuImport](file:///e:/project/AromaMemoir/weiji-server/src/modules/base/event/menu.ts#L32-L44) 事件触发，递归 `BaseSysMenuService.import` 保存菜单。

### 2. 根因：业务模块缺失 menu.json

经扫描 [weiji-server/src/modules](file:///e:/project/AromaMemoir/weiji-server/src/modules)，**仅 base 模块存在 menu.json**：

```
weiji-server/src/modules/base/menu.json   ✅ 存在（系统管理、数据管理等内置菜单）
weiji-server/src/modules/record/menu.json ❌ 不存在
weiji-server/src/modules/family/menu.json ❌ 不存在
weiji-server/src/modules/achievement/menu.json ❌ 不存在
weiji-server/src/modules/checkin/menu.json ❌ 不存在
weiji-server/src/modules/challenge/menu.json ❌ 不存在
weiji-server/src/modules/gamification/menu.json ❌ 不存在
weiji-server/src/modules/ai/menu.json ❌ 不存在
weiji-server/src/modules/analytics/menu.json ❌ 不存在
weiji-server/src/modules/account/menu.json ❌ 不存在
```

由于 `CoolModuleMenu.importMenu` 仅在 `fs.existsSync(menuPath)` 为真时才导入（menu.js 第 66 行），缺失 menu.json 的模块不会触发菜单写入，导致后台只能看到 base 模块内置菜单。

### 3. 业务功能页面状态：页面已存在，仅菜单未入库

后端 B 端控制器（`/admin/**`）已全部就绪：

- `record` → [AdminRecordController](file:///e:/project/AromaMemoir/weiji-server/src/modules/record/controller/admin/record.ts) `/admin/record` + like/comment
- `family` → [family/recipe/menu/member/invitation/shopping](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/admin) `/admin/family/*`
- `achievement` → [AdminAchievementController](file:///e:/project/AromaMemoir/weiji-server/src/modules/achievement/controller/admin/achievement.ts) `/admin/achievement` + user 子表
- `checkin` → [AdminCheckinController](file:///e:/project/AromaMemoir/weiji-server/src/modules/checkin/controller/admin/checkin.ts) `/admin/checkin`
- `challenge` → [AdminChallengeController](file:///e:/project/AromaMemoir/weiji-server/src/modules/challenge/controller/admin/challenge.ts) `/admin/challenge`
- `gamification` → [AdminBlindGuessController](file:///e:/project/AromaMemoir/weiji-server/src/modules/gamification/controller/admin/blindguess.ts) `/admin/gamification/blindguess`

前端 `weiji-admin-web` 也已具备对应视图：

- [record/views/list.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/record/views/list.vue) / [ai-record.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/record/views/ai-record.vue)
- [family/views/list.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/list.vue) / recipes / recipe-form / recipe-detail
- [achievement/views/list.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/achievement/views/list.vue) / index.vue
- [gamification/views/index.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/gamification/views/index.vue)

前端 [family/config.ts](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/config.ts) / [record/config.ts](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/record/config.ts) / [achievement/config.ts](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/achievement/config.ts) / [gamification/config.ts](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/gamification/config.ts) 已配置 `views` 路由，但 `views` 只是前端路由注册，**不会写入后端 `base_sys_menu` 表**。前端菜单展示完全依赖 [service.base.comm.permmenu()](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/base/store/menu.ts#L162) 返回的后端菜单数据。

**结论**：页面与控制器都已存在，问题在于业务模块未提供 menu.json，导致菜单初始化阶段没有把业务菜单写入数据库。

### 4. 补充：菜单加载链路确认

- 前端登录后调用 `service.base.comm.permmenu()` → 后端 [BaseSysPermsService.permmenu](file:///e:/project/AromaMemoir/weiji-server/src/modules/base/service/sys/perms.ts#L67-L74) → `BaseSysMenuService.getMenus(roleIds, isAdmin)`。
- 查询 `base_sys_menu` 表，按 `orderNum` 升序返回。
- admin 用户（超管）直接返回全部菜单；非 admin 用户通过 `base_sys_role_menu` 关联表过滤。
- 因此只要菜单未入库，**任何角色都看不到**，包括 admin。

### 5. weiji-app 安装失败原因

[weiji-app/vite.config.ts](file:///e:/project/AromaMemoir/weiji-app/vite.config.ts#L1) 第 1 行明确注释 `// ！此依赖不能安装`，指的是 `@dcloudio/vite-plugin-uni`——该包按官方约定**只能由 uni-app CLI 内部引用，不能直接 npm install 到项目 node_modules**。强行安装会导致依赖冲突或安装失败。正确做法是使用 `@dcloudio/uni-cli-shared` 提供的 vite 预设（依赖已声明在 devDependencies），通过 `uni` CLI 启动而非直接安装 `@dcloudio/vite-plugin-uni`。

## What Changes

### A. 修复业务菜单缺失（核心）

- **新增** `weiji-server/src/modules/record/menu.json`：美食记录管理 + 点赞管理 + 评论管理 + AI 记录页
- **新增** `weiji-server/src/modules/family/menu.json`：家庭组管理 + 菜谱管理 + 周菜单管理 + 成员管理 + 邀请码管理 + 购物清单管理
- **新增** `weiji-server/src/modules/achievement/menu.json`：成就定义管理 + 用户成就解锁记录
- **新增** `weiji-server/src/modules/checkin/menu.json`：打卡记录管理
- **新增** `weiji-server/src/modules/challenge/menu.json`：挑战赛配置管理
- **新增** `weiji-server/src/modules/gamification/menu.json`：盲猜轮次管理
- 每个菜单项严格遵循 [base/menu.json](file:///e:/project/AromaMemoir/weiji-server/src/modules/base/menu.json) 的结构：`name / router / perms / type / icon / orderNum / viewPath / keepAlive / isShow / childMenus`
- `viewPath` 必须与前端 `weiji-admin-web/src/modules/*/views/*.vue` 实际路径一一对应
- `perms` 必须与后端 `@CoolController` 的 `prefix` + 标准 api（`add/delete/update/info/page/list`）映射一致，例如 `/admin/record` → `record:info:page,record:info:list,...`
- **重要**：由于 `initJudge: 'db'` 且 `base_sys_conf` 表可能已存在 `init_menu_<module>` 锁记录（之前若尝试导入过），需在导入新 menu.json 前清理 `base_sys_conf` 中相关锁记录并删除 `base_sys_menu` 中业务菜单残留，避免重复或冲突。

### B. 文档化 weiji-app 启动方式

- **更新** [weiji-app/README.md](file:///e:/project/AromaMemoir/weiji-app/README.md) 增加本地启动说明：明确 `@dcloudio/vite-plugin-uni` 不应直接安装，依赖已通过 `@dcloudio/uni-cli-shared` 间接引入，直接 `pnpm install` 后 `pnpm dev:h5` 即可；如遇安装失败需删除 `node_modules` 与 `pnpm-lock.yaml` 重试。
- 不修改 [vite.config.ts](file:///e:/project/AromaMemoir/weiji-app/vite.config.ts) 的 `uni()` 引用方式（与 cool-uni 官方脚手架一致）。

## Impact

- Affected specs:
  - migrate-to-cool-admin-stack（业务模块菜单在新工程中也需补齐 menu.json）
  - implement-cooladmin-backend（菜单初始化数据归入此项）
  - frontend-backend-integration（菜单 viewPath 需与前端路由对齐）
- Affected code:
  - 新增 6 个 `weiji-server/src/modules/*/menu.json`
  - [weiji-app/README.md](file:///e:/project/AromaMemoir/weiji-app/README.md) 增补启动说明
  - 数据库 `base_sys_menu` / `base_sys_conf` 表首次启动会被写入业务菜单与锁记录

## ADDED Requirements

### Requirement: 业务模块菜单数据初始化

系统 SHALL 为每个具备 B 端管理界面的业务模块提供 `menu.json`，使 cool-admin 启动时能自动将业务菜单写入 `base_sys_menu` 表。

#### Scenario: 首次启动自动导入业务菜单
- **WHEN** 开发者执行 `cd weiji-server && npm run dev` 且 `base_sys_conf` 表中不存在 `init_menu_<module>` 记录
- **THEN** 系统读取 `src/modules/<module>/menu.json`，递归写入 `base_sys_menu` 表，并写入 `init_menu_<module>` 锁标记
- **AND** 后台 admin 登录后调用 `/admin/base/comm/permmenu` 能返回完整业务菜单树

#### Scenario: 菜单 viewPath 与前端路由对齐
- **WHEN** 后台点击业务菜单项
- **THEN** 前端按 `viewPath`（如 `modules/record/views/list.vue`）加载对应组件，无 404

#### Scenario: 权限标识与后端接口对齐
- **WHEN** 非 admin 角色用户被分配业务菜单权限
- **THEN** 该用户访问业务 CRUD 接口时，`perms` 校验通过（如 `record:info:page` 对应 `POST /admin/record/page`）

### Requirement: 菜单重置能力

系统 SHALL 提供清理已导入菜单与锁标记的方式，便于 menu.json 变更后重新导入。

#### Scenario: 清理后重新导入
- **WHEN** 开发者删除 `base_sys_conf` 中 `cKey LIKE 'init_menu_%'` 记录，并删除 `base_sys_menu` 中业务菜单（保留 base 内置菜单或全清重建）
- **AND** 重启服务
- **THEN** 系统重新读取所有模块 menu.json 并导入

### Requirement: weiji-app 启动说明可获取

系统 SHALL 在 [weiji-app/README.md](file:///e:/project/AromaMemoir/weiji-app/README.md) 中明确本地启动步骤与 `@dcloudio/vite-plugin-uni` 不可直接安装的注意事项。

#### Scenario: 新开发者按 README 启动
- **WHEN** 开发者 clone 仓库后 `cd weiji-app && pnpm install && pnpm dev:h5`
- **THEN** H5 开发服务在 :9900 启动，无 "Cannot find module @dcloudio/vite-plugin-uni" 报错

## 附录：菜单重置 SQL 流程

当 menu.json 变更后需要重新导入菜单时，按以下步骤操作（连接到 `weiji` 数据库执行）：

### 方案 A：全量重置（推荐，最干净）

清空所有模块的菜单与锁标记，重启后所有模块（含 base）重新导入：

```sql
-- 1. 清空菜单表（含 base 内置菜单，重启后会重新导入）
TRUNCATE TABLE base_sys_menu;
-- 2. 清空菜单-角色关联（重置后需重新分配角色权限，admin 默认拥有全部权限无需分配）
TRUNCATE TABLE base_sys_role_menu;
-- 3. 删除所有模块的初始化锁标记
DELETE FROM base_sys_conf WHERE cKey LIKE 'init_menu_%';
-- 4. 删除所有模块的数据库初始化锁标记（如需重置 db.json 数据一并清理）
-- DELETE FROM base_sys_conf WHERE cKey LIKE 'init_db_%';
```

执行后重启 `weiji-server`，框架会扫描所有模块的 `menu.json` 与 `db.json` 重新导入。

### 方案 B：仅重置业务模块（保留 base 内置菜单）

只清理 6 个业务模块的菜单与锁标记，不影响 base 模块：

```sql
-- 1. 删除业务模块的初始化锁标记
DELETE FROM base_sys_conf
WHERE cKey IN (
  'init_menu_record',
  'init_menu_family',
  'init_menu_achievement',
  'init_menu_checkin',
  'init_menu_challenge',
  'init_menu_gamification'
);

-- 2. 删除业务菜单（按 router 前缀过滤，注意子菜单无 router 需先查父级 id 再删子级）
-- 2.1 查出业务顶层目录菜单 id
SET @record_id = (SELECT id FROM base_sys_menu WHERE name='美食记录管理' AND parentId IS NULL LIMIT 1);
SET @family_id = (SELECT id FROM base_sys_menu WHERE name='家庭管理' AND parentId IS NULL LIMIT 1);
SET @achievement_id = (SELECT id FROM base_sys_menu WHERE name='成就管理' AND parentId IS NULL LIMIT 1);
SET @checkin_id = (SELECT id FROM base_sys_menu WHERE name='打卡管理' AND parentId IS NULL LIMIT 1);
SET @challenge_id = (SELECT id FROM base_sys_menu WHERE name='挑战赛管理' AND parentId IS NULL LIMIT 1);
SET @gamification_id = (SELECT id FROM base_sys_menu WHERE name='趣味玩法' AND parentId IS NULL LIMIT 1);

-- 2.2 递归删除（MySQL 8 可用 CTE 递归；简化做法：删除顶层目录后，框架的 delChildMenu 逻辑需手动模拟）
-- 实际操作建议直接 TRUNCATE base_sys_menu 后重启让所有模块（含 base）重新导入，即方案 A
```

> **推荐使用方案 A**：操作简单且不易残留。重置后 admin 用户登录会自动看到全部菜单（admin 无需分配角色权限）。非 admin 用户需在「系统管理 → 权限管理 → 角色列表」重新分配菜单权限。

### 重启验证

```bash
cd weiji-server
npm run dev
```

观察启动日志，应看到每个业务模块打印：

```
[cool:module:base] midwayjs cool module base import [record] module menu success
[cool:module:base] midwayjs cool module base import [family] module menu success
[cool:module:base] midwayjs cool module base import [achievement] module menu success
[cool:module:base] midwayjs cool module base import [checkin] module menu success
[cool:module:base] midwayjs cool module base import [challenge] module menu success
[cool:module:base] midwayjs cool module base import [gamification] module menu success
```

查询验证：

```sql
-- 确认业务菜单已入库
SELECT id, name, router, type, orderNum FROM base_sys_menu
WHERE name IN ('美食记录管理','家庭管理','成就管理','打卡管理','挑战赛管理','趣味玩法')
ORDER BY orderNum;

-- 确认锁标记已写入
SELECT cKey, cValue FROM base_sys_conf WHERE cKey LIKE 'init_menu_%';
```
