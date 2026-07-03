# Tasks

- [x] Task 1: 修复 record/menu.json 的 3 个不合法图标
  - [x] SubTask 1.1: 将「美食记录管理」父菜单的 icon 从 icon-food 改为 icon-app
  - [x] SubTask 1.2: 将「AI 分析」子菜单的 icon 从 icon-ai 改为 icon-light
  - [x] SubTask 1.3: 将「评论」子菜单的 icon 从 icon-comment 改为 icon-msg

- [x] Task 2: 修复 achievement/menu.json 的 1 个不合法图标
  - [x] SubTask 2.1: 将「成就管理」父菜单的 icon 从 icon-trophy 改为 icon-crown

- [x] Task 3: 修复 checkin/menu.json 的 1 个不合法图标
  - [x] SubTask 3.1: 将「签到」父菜单的 icon 从 icon-checkin 改为 icon-time

- [x] Task 4: 修复 challenge/menu.json 的 1 个不合法图标
  - [x] SubTask 4.1: 将「挑战」父菜单的 icon 从 icon-challenge 改为 icon-hot

- [x] Task 5: 修复 family/menu.json 的 4 个不合法图标
  - [x] SubTask 5.1: 将「家庭管理」父菜单的 icon 从 icon-family 改为 icon-common
  - [x] SubTask 5.2: 将「家庭菜谱」子菜单的 icon 从 icon-recipe 改为 icon-goods
  - [x] SubTask 5.3: 将「周菜单管理」子菜单的 icon 从 icon-calendar 改为 icon-task
  - [x] SubTask 5.4: 将「邀请码管理」子菜单的 icon 从 icon-invite 改为 icon-notice

- [x] Task 6: 修复 gamification/menu.json 的 1 个不合法图标
  - [x] SubTask 6.1: 将「趣味玩法」父菜单的 icon 从 icon-game 改为 icon-emoji

- [ ] Task 7: 数据库重新导入业务模块菜单（用户手动执行）
  - [ ] SubTask 7.1: 清理 base_sys_conf 中 init_menu_record/achievement/checkin/challenge/family/gamification 6 个锁记录
  - [ ] SubTask 7.2: 清理 base_sys_menu 中 6 个业务模块的菜单数据（按 router 前缀 /record /achievement /checkin /challenge /family /gamification 过滤）
  - [ ] SubTask 7.3: 重启 weiji-server 重新导入 6 个业务模块菜单

- [x] Task 8: 验证
  - [x] SubTask 8.1: 代码层验证：grep 6 个 menu.json 中所有非 null 的 icon 字段值均能在 weiji-admin-web/src/modules/base/static/svg/ 找到对应 svg 文件
  - [ ] SubTask 8.2: 运行时验证：admin 登录后台，侧边栏 6 个业务模块所有菜单图标均正常显示无空白（用户在环境中执行）

# Task Dependencies

- Task 1-6 互相独立，可并行执行
- Task 7 依赖 Task 1-6 全部完成
- Task 8 依赖 Task 1-6 完成（代码层验证）；运行时验证依赖 Task 7 完成
