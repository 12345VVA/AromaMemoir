# 验收清单

## 阶段一：P0 立即修复验证

### Web 前端地基修复

- [x] weiji-web/api.js 顶部定义 `SUCCESS_CODE = 1000` 常量
- [x] weiji-web/api.js `request()` 用 `result.code !== SUCCESS_CODE` 判断失败
- [x] weiji-web/api.js 所有端点路径使用 `/app/*` 或 `/admin/*` 前缀
- [x] weiji-web/api.js 不再出现 `/api/auth/login`、`/api/family` 等旧路径
- [x] weiji-web/api.js fetch 请求带 `signal: AbortController.signal` + 15 秒超时
- [x] 超时时抛 `"请求超时，请稍后重试"`
- [ ] weiji-web 在浏览器中调用 `GET /app/family` 返回 1000 被正确识别为成功 <!-- 需用户实测 -->
- [x] weiji-web loadFamilyData 不再因 code 误判进 catch 块

### 家庭组生命周期 API

- [x] 后端 FamilyService 新增 `leaveFamily(userId)` 方法
- [x] 后端 FamilyService 新增 `disbandFamily(userId, opts?)` 方法
- [x] 后端 FamilyService 新增 `transferOwnership(userId, targetMemberId)` 方法
- [x] `POST /app/family/leave` 路由可访问
- [x] `POST /app/family/disband` 路由可访问
- [x] `POST /app/family/transfer` 路由可访问
- [ ] 非 owner 调用 leave 成功退出，memberCount -1 <!-- 需用户实测 -->
- [x] owner 独自调用 leave 自动解散家庭组
- [x] owner 非独自调用 leave 返回 400 `"owner 请先转让或解散家庭组"`
- [x] owner 调用 disband 事务内清理所有关联数据
- [x] 非 owner 调用 disband 返回 403
- [x] owner 调用 transfer 旧 owner 变 admin、target 变 owner、family.ownerId 更新
- [x] 跨家庭 transfer 返回 403 `"目标成员不在本家庭"`

### APP UI 配套

- [x] APP pages/family/index.vue 非 owner 显示"退出家庭组"按钮
- [x] APP pages/family/index.vue owner 显示"转让家庭组"+"解散家庭组"按钮
- [x] 解散需二次确认 + 输入家庭名称匹配
- [x] 成员列表项（仅 owner 可见）有"转让给TA"按钮
- [x] 操作成功后 `uni.$emit('familyChanged')` 通知其他页面
- [x] 操作成功后页面数据正确刷新或跳转

### 跨端状态同步短期方案

- [x] APP onMounted 监听 `uni.$on('familyChanged', refreshAll)`
- [x] APP onUnmounted `uni.$off('familyChanged')`
- [x] Web loadFamilyData 后启动 30 秒轮询 setInterval
- [x] Web 页面卸载时 clearInterval
- [x] Web 轮询发现 familyInfo 变 null 时自动显示创建入口
- [x] Web 监听 `window.storage` 事件，token 变化时刷新用户状态
- [ ] 多标签同步：标签 A 登出，标签 B 自动检测 <!-- 需用户实测 -->

## 阶段二：P1 本周修复验证

### 后端返回行为统一

- [x] `GET /app/family/member/list` 未加入家庭时返回 `{ list: [], total: 0 }` 不抛异常
- [x] `GET /app/family/recipe/list` 同上
- [x] `GET /app/family/menu/list` 同上
- [x] `GET /app/family/shopping/list` 同上
- [x] `GET /app/family` 仍返回 null（保持，作为"是否加入"判断）
- [x] `GET /app/family/report` 仍返回空报告（保持）
- [x] service 层 listMembers/listRecipes/listMenus/listShoppingItems 在 membership 为空时返回空数组

### APP onShow 刷新

- [x] pages/family/index.vue onShow 调用 `loadFamily() + loadMembers() + loadRecipes()`
- [x] 从其他页面返回时家庭信息/成员列表自动刷新

### 剩余写操作加锁

- [x] FamilyEntity 增加 `version` 字段
- [x] family/entity/recipe.ts 增加 version
- [x] family/entity/menu.ts 增加 version
- [x] family/entity/shopping_item.ts 增加 version
- [x] updateRecipe 加乐观锁 `WHERE version = :old` + `SET version = version + 1`，冲突抛 409
- [x] deleteRecipe 加乐观锁
- [ ] updateMenu/deleteMenu 加乐观锁 <!-- FAIL: family service/controller 中无 updateMenu/deleteMenu 方法，仅 addMenu(替换语义)/voteMenu/listMenu -->
- [x] toggleShopping 改用原子 `SET completed = NOT completed`（实际字段名为 checked，使用 `NOT checked`）
- [x] deleteShopping 加事务
- [x] updateMember 加事务包裹
- [ ] 并发更新同一菜谱时后提交者返回 409 <!-- 需用户实测 -->

## 阶段三：P2 后续修复验证

### APP 错误状态可见化

- [x] pages/family/index.vue 新增 `error` ref 状态
- [x] catch 块设 `error.value = err.message`
- [x] UI 区分 loading / error / empty / hasData 四态
- [x] error 时显示错误信息 + "重试"按钮
- [x] 重试按钮调用 refreshAll

### Admin CRUD 业务校验

- [x] AdminFamilyController 覆盖 add 方法抛 400
- [x] AdminFamilyController 覆盖 delete 方法调 disbandFamily 级联清理
- [x] Admin 后台无法直接 add 家庭组
- [x] Admin 后台 delete 家庭组时关联数据被清理

### 账号删除孤儿清理

- [x] FamilyService 新增 `handleUserLogoff(userId)` 方法
- [x] user/service/info.ts logoff 调用 handleUserLogoff
- [ ] 普通 member 注销后 family_member 记录被删除，memberCount -1 <!-- 需用户实测 -->
- [ ] owner 注销且有其他成员时自动转让给最早加入的 admin <!-- 需用户实测 -->
- [ ] owner 独自注销时解散家庭组 <!-- 需用户实测 -->
- [ ] 注销后该用户在所有家庭的成员关系全部清理 <!-- 需用户实测 -->

### 网络降级策略统一

- [x] weiji-app/utils/api.ts 超时改为 15000
- [x] weiji-web/api.js 超时为 15000（Task 3 已完成）
- [x] 网络失败文案统一 `"网络异常，请稍后重试"`
- [x] 401 文案统一 `"登录已失效，请重新登录"`

### 家庭组名称默认值统一

- [x] FamilyEntity.name 字段 `default: '未命名家庭'`
- [ ] createFamily 允许 name 为空时使用默认值 <!-- FAIL: service 层 createFamily 在 name 为空时抛 `家庭组名称不能为空`，未使用 entity 默认值 -->
- [x] APP 显示用 `familyInfo.name || '未命名家庭'`
- [ ] Web 显示用 `familyInfo.name || '未命名家庭'` <!-- FAIL: weiji-web 中未找到 familyInfo.name 的展示位置 -->
- [x] 不再出现"我的家庭"作为默认显示文案（注：weiji-app/pages/index/my.vue 中"我的家庭"为个人中心菜单项标签，非默认家庭名称显示）

## 整体验收

- [ ] 现有测试套件保持原通过项不回归 <!-- 需用户实测（未运行 npm test） -->
- [ ] 新增 API 端点测试：leave/disband/transfer 三类场景 <!-- FAIL: 未见对应测试用例 -->
- [x] `cd weiji-server && npx tsc --noEmit --skipLibCheck` exit 0
- [ ] weiji-web 浏览器中完成：登录 → 创建家庭 → 查看菜谱 → 退出家庭 全链路无 404/无 code 误判 <!-- 需用户实测 -->
- [ ] weiji-app H5 与小程序端完成：进入家庭页 → 退出/解散/转让 → UI 正确刷新 <!-- 需用户实测 -->
- [ ] 跨标签同步：标签 A 登出，标签 B 自动检测并刷新 <!-- 需用户实测 -->
- [ ] 并发场景：两端同时修改菜谱，后提交者返回 409 <!-- 需用户实测 -->
- [ ] 注销场景：owner 注销后家庭自动转让或解散，无孤儿记录 <!-- 需用户实测 -->
