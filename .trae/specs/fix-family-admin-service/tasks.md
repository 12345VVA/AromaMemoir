# Tasks

- [x] Task 1: 修复 family/list.vue service 路径错误
  - [x] SubTask 1.1: 将 [family/views/list.vue:141](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/family/views/list.vue#L141) 的 `service: (service as any).family.family` 改为 `service: service.family`
  - [x] SubTask 1.2: 移除不必要的 `(service as any)` 类型断言，直接使用 `service.family`

- [x] Task 2: 重写 family C 端页面为 B 端 cl-crud 管理页面
  - [x] SubTask 2.1: 重写 `family/views/recipes.vue` 为 B 端 cl-crud 菜谱管理页，使用 `service.family.recipe`
  - [x] SubTask 2.2: 删除 `family/views/recipe-form.vue`（cl-crud 的 upsert 弹窗已覆盖新增/编辑）
  - [x] SubTask 2.3: 删除 `family/views/recipe-detail.vue`（cl-crud 的 info 已覆盖详情查看）
  - [x] SubTask 2.4: 新增 `family/views/menu.vue` B 端 cl-crud 周菜单管理页，使用 `service.family.menu`
  - [x] SubTask 2.5: 新增 `family/views/member.vue` B 端 cl-crud 家庭成员管理页，使用 `service.family.member`
  - [x] SubTask 2.6: 新增 `family/views/invitation.vue` B 端 cl-crud 邀请码管理页，使用 `service.family.invitation`
  - [x] SubTask 2.7: 新增 `family/views/shopping.vue` B 端 cl-crud 购物清单管理页，使用 `service.family.shopping`

- [x] Task 3: 更新 family/config.ts 前端路由
  - [x] SubTask 3.1: 移除 `/family/recipe/form` 和 `/family/recipe/:id` 路由（C 端页面已删除）
  - [x] SubTask 3.2: 新增 `/family/menu`、`/family/member`、`/family/invitation`、`/family/shopping` 路由指向对应新 vue 文件

- [x] Task 4: 更新 family/menu.json viewPath（数据库重新导入由用户执行）
  - [x] SubTask 4.1: 更新 [weiji-server/src/modules/family/menu.json](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/menu.json) 中各子菜单的 viewPath：周菜单→menu.vue、成员→member.vue、邀请码→invitation.vue、购物清单→shopping.vue
  - [ ] SubTask 4.2: 清理数据库 `base_sys_conf` 中 `init_menu_family` 锁记录（用户手动执行 SQL）
  - [ ] SubTask 4.3: 清理 `base_sys_menu` 中 family 模块菜单数据（按 router 前缀 /family 过滤）（用户手动执行 SQL）
  - [ ] SubTask 4.4: 重启 weiji-server 重新导入 family 菜单（用户手动执行）

- [x] Task 5: 验证所有 family 子菜单页面可访问（代码层验证已通过；运行时验证需用户在环境中执行）
  - [x] SubTask 5.1: 代码层验证 list.vue service 路径已修复，不再触发 `is not a function`
  - [x] SubTask 5.2: 代码层验证 5 个 cl-crud 页面文件存在且 service 引用正确
  - [x] SubTask 5.3: 代码层验证 config.ts 路由与 menu.json viewPath 一一对应，无 C 端 API 残留
  - [ ] SubTask 5.4: 运行时验证（用户在本地环境启动 weiji-admin-web 与 weiji-server 后点击各菜单确认）

# Task Dependencies

- Task 1 独立，可立即执行
- Task 2 依赖 Task 1 完成（避免 recipes.vue 重写时与 list.vue 冲突）
- Task 3 依赖 Task 2（路由需对应已创建的 vue 文件）
- Task 4 依赖 Task 2（viewPath 需对应已创建的 vue 文件）
- Task 5 依赖 Task 1-4 全部完成
