# Checklist

## 分析阶段（已完成）

- [x] 已确认菜单图标系统：cl-svg 组件 + SVG 雪碧图，合法图标 = weiji-admin-web/src/modules/base/static/svg/icon-*.svg 文件名
- [x] 已确认 iconfont 插件 urls 数组为空，未引入外部 iconfont 字体
- [x] 已枚举合法图标清单（共 65 个 icon-*.svg 文件）
- [x] 已确认业务模块 menu.json 中 11 个图标名不在合法清单内
- [x] 已确认 base 模块的 icon-radioboxfill 也无效，但属框架自带不在本 spec 范围

## 实施阶段

### Task 1: record/menu.json（3 处）

- [x] icon-food 改为 icon-app
- [x] icon-ai 改为 icon-light
- [x] icon-comment 改为 icon-msg

### Task 2: achievement/menu.json（1 处）

- [x] icon-trophy 改为 icon-crown

### Task 3: checkin/menu.json（1 处）

- [x] icon-checkin 改为 icon-time

### Task 4: challenge/menu.json（1 处）

- [x] icon-challenge 改为 icon-hot

### Task 5: family/menu.json（4 处）

- [x] icon-family 改为 icon-common
- [x] icon-recipe 改为 icon-goods
- [x] icon-calendar 改为 icon-task
- [x] icon-invite 改为 icon-notice

### Task 6: gamification/menu.json（1 处）

- [x] icon-game 改为 icon-emoji

### Task 7: 数据库重新导入（用户手动执行）

- [ ] base_sys_conf 中 6 个业务模块 init_menu_xxx 锁记录已清理
- [ ] base_sys_menu 中 6 个业务模块菜单数据已清理
- [ ] 重启 weiji-server 后日志打印各模块 import success
- [ ] base_sys_menu 表中业务模块菜单 icon 字段已更新

### Task 8: 验证

- [x] 代码层验证：6 个 menu.json 中所有非 null icon 值均在 svg 目录有对应文件（22/22 PASS）
- [ ] 运行时验证：侧边栏「美食记录管理」父菜单图标显示
- [ ] 运行时验证：侧边栏「成就管理」父菜单图标显示
- [ ] 运行时验证：侧边栏「签到」父菜单图标显示
- [ ] 运行时验证：侧边栏「挑战」父菜单图标显示
- [ ] 运行时验证：侧边栏「家庭管理」父菜单及 4 个子菜单图标显示
- [ ] 运行时验证：侧边栏「趣味玩法」父菜单图标显示
