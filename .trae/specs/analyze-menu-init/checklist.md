# Checklist

## 分析阶段（已完成）

- [x] 已确认 cool-admin-midway 菜单初始化机制：`CoolModuleMenu.init()` 扫描 `src/modules/*/menu.json`，按 `initJudge: 'db'` 查询 `base_sys_conf` 表 `init_menu_<module>` 锁标记决定是否导入
- [x] 已确认根因：除 base 模块外，record/family/achievement/checkin/challenge/gamification/ai/analytics/account 等业务模块均缺失 `menu.json`
- [x] 已确认业务页面状态：后端 `/admin/**` 控制器与前端 `weiji-admin-web/src/modules/*/views/*.vue` 均已存在，问题仅为菜单未入库
- [x] 已确认前端菜单加载链路：`service.base.comm.permmenu()` → 后端查 `base_sys_menu` 表 → admin 返回全部，非 admin 按 `base_sys_role_menu` 过滤
- [x] 已定位 weiji-app 安装失败原因：`@dcloudio/vite-plugin-uni` 不可直接 npm install，需通过 `@dcloudio/uni-cli-shared` 间接引入

## 实施阶段

### menu.json 文件创建

- [x] `weiji-server/src/modules/record/menu.json` 已创建，菜单结构完整且 perms/viewPath 正确
- [x] `weiji-server/src/modules/family/menu.json` 已创建，菜单结构完整且 perms/viewPath 正确
- [x] `weiji-server/src/modules/achievement/menu.json` 已创建，菜单结构完整且 perms/viewPath 正确
- [x] `weiji-server/src/modules/checkin/menu.json` 已创建，菜单结构完整且 perms/viewPath 正确
- [x] `weiji-server/src/modules/challenge/menu.json` 已创建，菜单结构完整且 perms/viewPath 正确
- [x] `weiji-server/src/modules/gamification/menu.json` 已创建，菜单结构完整且 perms/viewPath 正确

### menu.json 字段一致性

- [x] 每个菜单项包含字段：name / router / perms / type / icon / orderNum / viewPath / keepAlive / isShow / childMenus
- [x] 目录类型 `type=0`，菜单类型 `type=1` 且有 viewPath，按钮类型 `type=2` 且有 perms
- [x] viewPath 与 `weiji-admin-web/src/modules/*/views/*.vue` 实际文件路径一一对应（checkin/challenge/gamification 三个缺失的 list.vue 已补齐）
- [x] perms 与后端 `@CoolController` 的 `prefix` + `api: ['add','delete','update','info','page','list']` 映射一致（如 `record:info:page` 对应 `POST /admin/record/page`）
- [x] orderNum 排序合理（base 内置菜单 orderNum 0-11，业务菜单建议 20-90 避免冲突）

### 数据库重置与导入

- [x] 已清理 `base_sys_conf` 表中 `cKey LIKE 'init_menu_%'` 的锁记录
- [x] 已清理 `base_sys_menu` 表中业务菜单残留（按 router 前缀过滤或全清后重建）
- [x] 重启 weiji-server 后日志打印每个模块 `import [xxx] module menu success`
- [x] `base_sys_menu` 表存在业务菜单记录
- [x] `base_sys_conf` 表存在 `init_menu_record` / `init_menu_family` / `init_menu_achievement` / `init_menu_checkin` / `init_menu_challenge` / `init_menu_gamification` 锁记录

### 前端后台验证

- [ ] weiji-admin-web 启动后 admin 登录成功
- [ ] 调用 `/admin/base/comm/permmenu` 返回的 menus 数组包含全部业务菜单
- [ ] 左侧导航栏出现：美食记录、家庭组、成就、打卡、挑战、盲猜等业务菜单分组
- [ ] 点击每个业务菜单项，前端组件正确加载，控制台无 404 或模块加载错误
- [ ] 在业务列表页执行分页查询，接口 perms 校验通过，能正常返回数据

> **环境限制说明**：本节 5 项均未勾选。weiji-server 的 cool-admin cache-manager-fs-hash 模块在 Windows 沙箱环境下写 `.lock` 文件时触发 `EPERM` 错误（`Error: EPERM: operation not permitted`），导致验证码接口 `/admin/base/open/captcha` 无法生成验证码，前端无法完成登录流程。已确认后端 `/admin/base/comm/permmenu` 路由已注册（未携带 token 时返回 401 未授权），`/admin/base/open/eps` 接口正常返回 200，说明后端菜单加载链路本身已就绪；仅前端登录态无法建立，故本节验证无法在当前环境完成。

### weiji-app 修复

- [x] `weiji-app/README.md` 已增加「本地启动」章节
- [x] README 明确说明 `@dcloudio/vite-plugin-uni` 不可直接安装的原因
- [x] README 提供 `pnpm install && pnpm dev:h5` 启动步骤
- [x] README 提供失败时清理 `node_modules` 与 `pnpm-lock.yaml` 重试的指引
- [ ] 实际执行 `pnpm install` 成功，`pnpm dev:h5` 在 :9900 启动无报错
