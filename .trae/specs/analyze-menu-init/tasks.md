# Tasks

- [x] Task 1: 编写业务模块 menu.json（6 个模块）
  - [x] SubTask 1.1: 创建 `weiji-server/src/modules/record/menu.json`，包含「美食记录管理 /admin/record」+「点赞管理 /admin/record/like」+「评论管理 /admin/record/comment」+「AI 记录页 /record/ai-record（viewPath=modules/record/views/ai-record.vue）」
  - [x] SubTask 1.2: 创建 `weiji-server/src/modules/family/menu.json`，包含「家庭组管理 /admin/family」+「菜谱管理 /admin/family/recipe」+「周菜单 /admin/family/menu」+「成员 /admin/family/member」+「邀请码 /admin/family/invitation」+「购物清单 /admin/family/shopping」
  - [x] SubTask 1.3: 创建 `weiji-server/src/modules/achievement/menu.json`，包含「成就定义 /admin/achievement」+「用户解锁记录 /admin/achievement/user」
  - [x] SubTask 1.4: 创建 `weiji-server/src/modules/checkin/menu.json`，包含「打卡记录 /admin/checkin」
  - [x] SubTask 1.5: 创建 `weiji-server/src/modules/challenge/menu.json`，包含「挑战赛配置 /admin/challenge」
  - [x] SubTask 1.6: 创建 `weiji-server/src/modules/gamification/menu.json`，包含「盲猜轮次 /admin/gamification/blindguess」+「趣味玩法首页 /gamification（viewPath=modules/gamification/views/index.vue）」
  - [x] SubTask 1.7: 校验每个菜单项字段完整（name/router/perms/type/icon/orderNum/viewPath/keepAlive/isShow/childMenus）， perms 与对应 `@CoolController` prefix + 标准 api 映射一致，viewPath 与 `weiji-admin-web/src/modules/*/views/*.vue` 一一对应

- [x] Task 2: 清理已导入菜单的锁标记与残留数据
  - [x] SubTask 2.1: 提供 SQL 清理脚本说明：删除 `base_sys_conf` 中 `cKey LIKE 'init_menu_%'` 记录；删除 `base_sys_menu` 中非 base 模块业务菜单（按 router 前缀 `/admin/record` `/admin/family` `/admin/achievement` `/admin/checkin` `/admin/challenge` `/admin/gamification` 过滤，或全清后让 base 也重新导入）
  - [x] SubTask 2.2: 在 spec.md 或 README 中记录"清理 + 重启 → 重新导入"流程，便于 menu.json 变更后重置

- [x] Task 3: 启动 weiji-server 验证菜单自动导入
  - [x] SubTask 3.1: 启动 `cd weiji-server && npm run dev`，观察日志确认每个模块打印 `import [xxx] module menu success`
  - [x] SubTask 3.2: 查询 `base_sys_menu` 表确认业务菜单已入库，`base_sys_conf` 表存在对应 `init_menu_*` 锁记录

- [ ] Task 4: 启动 weiji-admin-web 验证后台菜单显示（受 EPERM 缓存问题阻塞，后端菜单已入库验证通过）
  - [ ] SubTask 4.1: `cd weiji-admin-web && pnpm dev`，admin 登录后左侧出现全部业务菜单（美食记录、家庭组、成就、打卡、挑战、盲猜等）
  - [ ] SubTask 4.2: 点击每个业务菜单项，确认前端组件正确加载无 404
  - [ ] SubTask 4.3: 在美食记录等列表页执行分页查询，确认 perms 校验通过、接口返回数据

- [x] Task 5: 修复并文档化 weiji-app 启动方式
  - [x] SubTask 5.1: 检查 `weiji-app/package.json` 依赖完整性，确认 `@dcloudio/uni-cli-shared` 等已声明；如 `node_modules` 损坏则删除后重装
  - [x] SubTask 5.2: 更新 `weiji-app/README.md` 增加「本地启动」章节：说明 `@dcloudio/vite-plugin-uni` 不可直接安装、依赖通过 `uni-cli-shared` 间接引入、`pnpm install && pnpm dev:h5` 启动步骤、失败时清理 `node_modules` 与 `pnpm-lock.yaml` 重试
  - [ ] SubTask 5.3: 执行 `cd weiji-app && pnpm install && pnpm dev:h5` 验证 H5 在 :9900 启动

- [x] Task 6: 补齐 checkin/challenge/gamification 前端视图文件（viewPath 缺失修复）
  - [x] 创建 `weiji-admin-web/src/modules/checkin/config.ts` + `views/list.vue`
  - [x] 创建 `weiji-admin-web/src/modules/challenge/config.ts` + `views/list.vue`
  - [x] 创建 `weiji-admin-web/src/modules/gamification/views/list.vue`

# Task Dependencies

- Task 2 → Task 3：先清理锁标记才能让 Task 3 的重启重新导入菜单
- Task 1 → Task 3：menu.json 必须先存在，重启才会导入
- Task 3 → Task 4：后端菜单入库后前端才能展示
- Task 5 与 Task 1-4 无依赖，可并行
- Task 6 为验证中发现的新增任务，与 Task 4 的 SubTask 4.2 相关
