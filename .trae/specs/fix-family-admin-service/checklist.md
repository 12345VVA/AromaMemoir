# Checklist

## 分析阶段（已完成）

- [x] 已确认 `service[dict.api.page] is not a function` 根因：family/list.vue 使用 `service.family.family`（undefined）而非 `service.family`
- [x] 已确认 cool-admin-vue service 自动生成规则：`/admin/family` → `service.family`（直接挂载方法），`/admin/family/recipe` → `service.family.recipe`（嵌套）
- [x] 已确认其他业务模块（record/achievement/checkin/challenge/gamification）service 路径均正确
- [x] 已确认 family 模块下 recipes.vue/recipe-form.vue/recipe-detail.vue 为 C 端页面（使用 appApi /app/* 端点），混入 B 端 admin 项目
- [x] 已确认框架权限/部门/用户体系无需改造：RBAC 完备、部门≠家庭、B/C 端用户分离正确

## 实施阶段

### Task 1: 修复 family/list.vue service 路径

- [x] `family/views/list.vue` 第 141 行 `service: (service as any).family.family` 已改为 `service: service.family`
- [x] 已移除 `(service as any)` 类型断言
- [x] 页面加载不再报 `is not a function` 错误（代码层验证通过；运行时验证待用户执行）

### Task 2: 重写 C 端页面为 B 端 cl-crud 管理页面

- [x] `family/views/recipes.vue` 已重写为 B 端 cl-crud 页面，使用 `service.family.recipe`
- [x] `family/views/recipe-form.vue` 已删除
- [x] `family/views/recipe-detail.vue` 已删除
- [x] `family/views/menu.vue` 已创建，使用 `service.family.menu`
- [x] `family/views/member.vue` 已创建，使用 `service.family.member`
- [x] `family/views/invitation.vue` 已创建，使用 `service.family.invitation`
- [x] `family/views/shopping.vue` 已创建，使用 `service.family.shopping`
- [x] 所有新增/重写的 vue 文件使用 cl-crud 标准模板（cl-refresh-btn/cl-add-btn/cl-multi-delete-btn/cl-search-key/cl-table/cl-pagination/cl-upsert）
- [x] 所有 vue 文件的 Upsert items 与后端 Entity 字段一一对应
- [x] 所有 vue 文件的 Table columns 与后端 Entity 字段一一对应

### Task 3: 更新 family/config.ts 路由

- [x] 已移除 `/family/recipe/form` 路由
- [x] 已移除 `/family/recipe/:id` 路由
- [x] 已新增 `/family/menu` 路由指向 `./views/menu.vue`
- [x] 已新增 `/family/member` 路由指向 `./views/member.vue`
- [x] 已新增 `/family/invitation` 路由指向 `./views/invitation.vue`
- [x] 已新增 `/family/shopping` 路由指向 `./views/shopping.vue`

### Task 4: 更新 family/menu.json 并重新导入

- [x] family/menu.json 中「周菜单管理」viewPath 已改为 `modules/family/views/menu.vue`
- [x] family/menu.json 中「家庭成员」viewPath 已改为 `modules/family/views/member.vue`
- [x] family/menu.json 中「邀请码管理」viewPath 已改为 `modules/family/views/invitation.vue`
- [x] family/menu.json 中「购物清单」viewPath 已改为 `modules/family/views/shopping.vue`
- [ ] 数据库 `base_sys_conf` 中 `init_menu_family` 锁记录已清理（用户手动执行）
- [ ] 数据库 `base_sys_menu` 中 family 模块菜单已清理（用户手动执行）
- [ ] 重启 weiji-server 后日志打印 `import [family] module menu success`（用户手动执行）
- [ ] `base_sys_menu` 表 family 模块菜单 viewPath 已更新（依赖上一项重启）

### Task 5: 前端验证（代码层已通过；运行时待用户执行）

- [x] 代码层验证：list.vue service 路径已修正
- [x] 代码层验证：5 个 cl-crud 页面 service 引用正确
- [x] 代码层验证：config.ts 路由与 menu.json viewPath 一一对应
- [x] 代码层验证：views 目录无 appApi 残留
- [x] 代码层验证：5 个 vue 文件均包含 cl-crud 标准组件
- [ ] 运行时验证：weiji-admin-web 启动后 admin 登录成功
- [ ] 运行时验证：点击「家庭组管理」菜单，页面加载无 `is not a function` 错误
- [ ] 运行时验证：点击「家庭菜谱」菜单，recipes.vue 加载 cl-crud 管理界面
- [ ] 运行时验证：点击「周菜单管理」菜单，menu.vue 加载 cl-crud 管理界面
- [ ] 运行时验证：点击「家庭成员」菜单，member.vue 加载 cl-crud 管理界面
- [ ] 运行时验证：点击「邀请码管理」菜单，invitation.vue 加载 cl-crud 管理界面
- [ ] 运行时验证：点击「购物清单」菜单，shopping.vue 加载 cl-crud 管理界面
- [ ] 运行时验证：所有页面请求路径以 `/admin/` 开头，不出现 `/app/` 请求

### 框架体系评估

- [x] 权限体系（RBAC）：cool-admin 内置 RBAC 完备，业务 menu.json perms 已接入，无需改造
- [x] 部门体系：base_sys_department 用于 B 端管理员组织架构，业务「家庭」是独立域概念，不应合并，无需改造
- [x] 用户体系：B 端 base_sys_user 与 C 端 weiji_app_user 正确分离，token 互不通用，无需改造
