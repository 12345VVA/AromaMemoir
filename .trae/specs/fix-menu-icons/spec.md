# 修复业务模块菜单图标不显示 Spec

## Why

后台菜单已正确加载，但 6 个业务模块（record / achievement / checkin / challenge / family / gamification）的 menu.json 中使用了 11 个不存在的图标名（如 icon-food、icon-trophy、icon-family 等），导致对应菜单图标位置空白。

cool-admin-vue 菜单图标使用 SVG 雪碧图：合法图标名 = weiji-admin-web/src/modules/base/static/svg/icon-*.svg 文件名（去 .svg 后缀）。前端 icon.vue 通过 svgIcons.filter(e => e.indexOf('icon-') === 0) 拉取合法清单，不在清单内的图标名无法渲染。

## 分析结论

### 1. 合法图标体系

- 图标组件：cl-svg，name 属性传图标名
- 图标源：weiji-admin-web/src/modules/base/static/svg/ 目录下的 icon-*.svg 文件
- iconfont 插件：plugins/iconfont/config.ts 的 urls 数组为空，未引入任何外部 iconfont 字体
- Element Plus icons：仅在业务页面内使用（如 Trophy/Medal），不用于菜单

### 2. 合法图标清单（共 65 个，均位于 base/static/svg/）

icon-activity, icon-amount, icon-app, icon-approve, icon-auth, icon-ban, icon-call, icon-camera, icon-card, icon-cart, icon-common, icon-component, icon-count, icon-crown, icon-data, icon-db, icon-delete, icon-dept, icon-design, icon-device, icon-dict, icon-discover, icon-doc, icon-download, icon-emoji, icon-favor, icon-file, icon-folder, icon-goods, icon-home, icon-hot, icon-info, icon-iot, icon-light, icon-like, icon-list, icon-local, icon-log, icon-map, icon-match, icon-menu, icon-monitor, icon-msg, icon-news, icon-notice, icon-params, icon-phone, icon-pic, icon-question, icon-quick, icon-rank, icon-reward, icon-search, icon-set, icon-tag, icon-task, icon-time, icon-tutorial, icon-unlock, icon-user, icon-video, icon-vip, icon-warn, icon-work, icon-workbench

### 3. 业务模块 menu.json 中不合法的图标（共 11 个）

| 模块 | 菜单 | 当前图标 | 是否存在 |
|------|------|---------|---------|
| record | 美食记录管理（父） | icon-food | 不存在 |
| record | AI 分析（子） | icon-ai | 不存在 |
| record | 评论（子） | icon-comment | 不存在 |
| achievement | 成就管理（父） | icon-trophy | 不存在 |
| checkin | 签到（父） | icon-checkin | 不存在 |
| challenge | 挑战（父） | icon-challenge | 不存在 |
| family | 家庭管理（父） | icon-family | 不存在 |
| family | 家庭菜谱（子） | icon-recipe | 不存在 |
| family | 周菜单管理（子） | icon-calendar | 不存在 |
| family | 邀请码管理（子） | icon-invite | 不存在 |
| gamification | 趣味玩法（父） | icon-game | 不存在 |

已存在的合法图标（icon-menu / icon-user / icon-cart / icon-like 等）保持不变。

框架自带 base 模块 menu.json 中也有 1 个不存在的 icon-radioboxfill（base/menu.json:487），但 base 是 cool-admin 内置模块，不属于业务模块修改范围，本 spec 不动。

## What Changes

### 图标替换映射表（11 个）

| 模块 | 菜单 | 旧图标 | 新图标 | 语义理由 |
|------|------|---------|---------|---------|
| record | 美食记录管理 | icon-food | icon-app | 图形为盖饭餐盘，最贴近美食 |
| record | AI 分析 | icon-ai | icon-light | 灯泡代表智能/灵感 |
| record | 评论 | icon-comment | icon-msg | 消息气泡，最贴近评论 |
| achievement | 成就管理 | icon-trophy | icon-crown | 皇冠，最贴近奖杯 |
| checkin | 签到 | icon-checkin | icon-time | 时钟，每日签到 |
| challenge | 挑战 | icon-challenge | icon-hot | 火焰，热门挑战 |
| family | 家庭管理 | icon-family | icon-common | 多人组，最贴近家庭群组 |
| family | 家庭菜谱 | icon-recipe | icon-goods | 物品/餐品 |
| family | 周菜单管理 | icon-calendar | icon-task | 任务清单 |
| family | 邀请码管理 | icon-invite | icon-notice | 通知/邀请 |
| gamification | 趣味玩法 | icon-game | icon-emoji | 表情，最贴近游戏趣味 |

替换原则：
1. 仅修改不存在的图标，已合法的图标（如 icon-menu/icon-user/icon-cart/icon-like）不动
2. 同一模块内父子菜单图标不重复
3. 语义最贴近原意图
4. 不修改 base 模块（框架自带）

## Impact

- Affected specs:
  - analyze-menu-init（本 spec 修复其创建的 menu.json 中图标问题）
  - fix-family-admin-service（family menu.json 再次更新，需重新导入数据库）
- Affected code:
  - weiji-server/src/modules/record/menu.json（3 处图标）
  - weiji-server/src/modules/achievement/menu.json（1 处图标）
  - weiji-server/src/modules/checkin/menu.json（1 处图标）
  - weiji-server/src/modules/challenge/menu.json（1 处图标）
  - weiji-server/src/modules/family/menu.json（4 处图标）
  - weiji-server/src/modules/gamification/menu.json（1 处图标）
  - 数据库 base_sys_menu（需清理 6 个业务模块的菜单锁与菜单数据后重启 weiji-server 重新导入）

## ADDED Requirements

### Requirement: 业务模块菜单图标全部使用合法 SVG 图标名

系统 SHALL 为所有业务模块 menu.json 中的 icon 字段使用 weiji-admin-web/src/modules/base/static/svg/icon-*.svg 目录下已存在的图标名。

#### Scenario: 菜单图标渲染
- WHEN admin 在后台侧边栏查看 6 个业务模块（record/achievement/checkin/challenge/family/gamification）的菜单
- THEN 每个菜单项的图标位置均显示对应 SVG 图标，无空白

#### Scenario: 图标选择器可选
- WHEN admin 在菜单编辑页打开图标选择器（icon.vue）
- THEN 业务菜单当前使用的图标均出现在选择器列表中（因为列表 = svgIcons.filter(e => e.indexOf('icon-') === 0)）

## MODIFIED Requirements

### Requirement: 业务模块 menu.json 图标字段对齐合法清单

analyze-menu-init 创建的 6 个业务模块 menu.json 中存在 11 个不合法的图标名（icon-food/icon-trophy/icon-checkin/icon-challenge/icon-family/icon-recipe/icon-calendar/icon-invite/icon-game/icon-ai/icon-comment），现修改为合法图标名。

#### Scenario: menu.json 图标字段验证
- WHEN 在 6 个业务模块 menu.json 中 grep "icon": 字段
- THEN 所有非 null 的图标值均能在 weiji-admin-web/src/modules/base/static/svg/ 目录下找到对应 icon-xxx.svg 文件
