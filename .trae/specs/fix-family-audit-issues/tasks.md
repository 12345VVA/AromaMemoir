# Tasks

## 阶段一：P0 立即修复

### Web 前端地基修复（P0-1 + P0-2 + P1-5 + P2-17 Web 部分 + P2-18 Web 部分）

- [x] Task 1: 修复 weiji-web/api.js 响应码判断
  - [ ] SubTask 1.1: 顶部新增常量 `const SUCCESS_CODE = 1000;`
  - [ ] SubTask 1.2: `request()` 中 `result.code !== 0` 改为 `result.code !== SUCCESS_CODE`
  - [ ] SubTask 1.3: 全局搜索确认无其他 `code !== 0` 残留

- [x] Task 2: 迁移 weiji-web/api.js 路径到 `/app/*` 与 `/admin/*`
  - [ ] SubTask 2.1: 先 Grep 后端 controller，列出所有 C 端 `/app/*` 与 B 端 `/admin/*` 端点清单
  - [ ] SubTask 2.2: 核查后端是否有 `/app/user/login/username` 端点（用户名密码登录），若无需补端点或改用现有登录方式
  - [ ] SubTask 2.3: 重写 weiji-web/api.js 中所有端点路径，对齐后端路由（auth/family/record/achievement/checkin/user 等）
  - [ ] SubTask 2.4: 同步更新 weiji-web/app.js 中调用的方法名（若 api.js 方法签名变化）
  - [ ] SubTask 2.5: 在浏览器中验证至少一个端点（如 `/app/family`）能正确返回 1000

- [x] Task 3: weiji-web/api.js 加超时控制
  - [ ] SubTask 3.1: `request()` 内创建 `const controller = new AbortController();` + `setTimeout(() => controller.abort(), 15000)`
  - [ ] SubTask 3.2: fetch options 加 `signal: controller.signal`
  - [ ] SubTask 3.3: catch 中识别 `err.name === 'AbortError'` 抛 `"请求超时，请稍后重试"`

### 家庭组生命周期 API 补齐（P0-12 + P1-13 + P1-14）

- [x] Task 4: 后端 FamilyService 新增 leaveFamily 方法
  - [ ] SubTask 4.1: 在 [family/service/family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/service/family.ts) 新增 `async leaveFamily(userId: number)`
  - [ ] SubTask 4.2: 查询用户 membership，不存在抛 400 `"未加入家庭组"`
  - [ ] SubTask 4.3: 若 role === 'owner'：查家庭其他成员数，若 0 则调 `disbandFamily(userId)` 自动解散；若 >0 抛 400 `"owner 请先转让或解散家庭组"`
  - [ ] SubTask 4.4: 非 owner：事务内 delete member 关系 + 原子 memberCount -1 + 清理该用户在该家庭的邀请码记录
  - [ ] SubTask 4.5: 返回 `{ success: true }`

- [x] Task 5: 后端 FamilyService 新增 disbandFamily 方法
  - [ ] SubTask 5.1: 新增 `async disbandFamily(userId: number, opts?: { adminForce?: boolean })`
  - [ ] SubTask 5.2: 非 adminForce 时校验调用者是 owner，否则抛 403
  - [ ] SubTask 5.3: 事务内删除 family_member、family_recipe、family_menu、family_shopping_item、family_invitation（按 familyId）
  - [ ] SubTask 5.4: 删除 family 本身
  - [ ] SubTask 5.5: record 的 familyId 不删（保留历史），但可在 record 表 familyId 留 NULL 或保留

- [x] Task 6: 后端 FamilyService 新增 transferOwnership 方法
  - [ ] SubTask 6.1: 新增 `async transferOwnership(userId: number, targetMemberId: number)`
  - [ ] SubTask 6.2: 校验调用者是 owner，否则抛 403
  - [ ] SubTask 6.3: 查询 target member，不存在抛 400 `"目标成员不存在"`
  - [ ] SubTask 6.4: 跨家庭校验：target.familyId 必须等于 operator.familyId，否则抛 403 `"目标成员不在本家庭"`
  - [ ] SubTask 6.5: target 已是 owner 抛 400
  - [ ] SubTask 6.6: 事务内：旧 owner.role 改为 'admin'，target.role 改为 'owner'，family.ownerId 更新为 target.userId

- [x] Task 7: 后端 controller 注册 3 个新路由
  - [ ] SubTask 7.1: [controller/app/family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/family.ts) 新增 `@Post('/leave')` 调 `familyService.leaveFamily(userId)`
  - [ ] SubTask 7.2: 新增 `@Post('/disband')` 调 `familyService.disbandFamily(userId)`
  - SubTask 7.3: 新增 `@Post('/transfer')` 接收 `{ targetMemberId }` 调 `familyService.transferOwnership(userId, targetMemberId)`

- [x] Task 8: APP pages/family/index.vue 增加退出/解散/转让 UI
  - [ ] SubTask 8.1: 非 owner 在家庭信息卡片下方显示"退出家庭组"按钮，二次确认后调 `api.leaveFamily()`
  - [ ] SubTask 8.2: owner 显示"转让家庭组"与"解散家庭组"按钮
  - [ ] SubTask 8.3: 解散需二次确认 + 输入家庭名称匹配后才能提交（防误操作）
  - [ ] SubTask 8.4: 成员列表项（仅 owner 可见）每项增加"转让给TA"按钮，二次确认后调 transfer
  - [ ] SubTask 8.5: 操作成功后 `uni.$emit('familyChanged')` + 重新加载页面数据（或退出后跳转首页）

### 跨端状态同步短期方案（P0-8）

- [x] Task 9: APP EventBus 同端通知
  - [ ] SubTask 9.1: pages/family/index.vue onMounted 监听 `uni.$on('familyChanged', refreshAll)`
  - [ ] SubTask 9.2: onUnmounted `uni.$off('familyChanged')`
  - [ ] SubTask 9.3: 创建/加入/退出/解散/转让成功后 `uni.$emit('familyChanged')`

- [x] Task 10: Web 端轮询 + storage 跨标签同步
  - [ ] SubTask 10.1: [weiji-web/app.js](file:///e:/project/AromaMemoir/weiji-web/app.js) loadFamilyData 成功后启动 `setInterval(loadFamilyData, 30000)`
  - [ ] SubTask 10.2: 页面 beforeunload 或 SPA 路由切换时 clearInterval
  - [ ] SubTask 10.3: 若轮询发现 familyInfo 突然变 null，自动显示创建入口
  - [ ] SubTask 10.4: 监听 `window.addEventListener('storage', ...)`，token 变化时重新加载用户状态

## 阶段二：P1 本周修复

### 后端返回行为统一（P1-3）

- [x] Task 11: family 子资源 list 接口统一返回空数据
  - [ ] SubTask 11.1: [controller/app/member.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/member.ts) list 方法：membership 为空时返回 `{ list: [], total: 0 }` 不抛异常
  - [ ] SubTask 11.2: [controller/app/recipe.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/recipe.ts) 同上
  - [ ] SubTask 11.3: [controller/app/menu.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/menu.ts) 同上
  - [ ] SubTask 11.4: [controller/app/shopping.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/app/shopping.ts) 同上
  - [ ] SubTask 11.5: service 层对应方法在 membership 为空时直接返回空数组，不抛异常
  - [ ] SubTask 11.6: getMyFamily 保持返回 null，report 保持空报告

### APP onShow 刷新（P1-9）

- [x] Task 12: pages/family/index.vue onShow 完整刷新
  - [ ] SubTask 12.1: `onShow(() => { loadFamily(); loadMembers(); loadRecipes(); })`
  - [ ] SubTask 12.2: 配合 Task 9 的 EventBus 实现即时刷新

### 剩余写操作加锁（P1-10 剩余）

- [x] Task 13: FamilyEntity 与子实体增加 version 字段
  - [ ] SubTask 13.1: [family/entity/family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/entity/family.ts) 增加 `@Column({ default: 1 }) version: number;`
  - [ ] SubTask 13.2: family/entity/recipe.ts 同步增加 version
  - [ ] SubTask 13.3: family/entity/menu.ts 同步增加 version
  - [ ] SubTask 13.4: family/entity/shopping_item.ts 同步增加 version
  - [ ] SubTask 13.5: 生成 migration SQL 或在启动时 TypeORM synchronize 自动加列（dev 模式）

- [x] Task 14: 写操作加乐观锁
  - [ ] SubTask 14.1: updateRecipe/deleteRecipe 在 update 时 `WHERE id = :id AND version = :oldVersion`，`SET version = version + 1`，影响行数 0 抛 409 `"数据已被修改，请刷新后重试"`
  - [ ] SubTask 14.2: updateMenu/deleteMenu 同上
  - [ ] SubTask 14.3: toggleShopping 改用原子 update `SET completed = NOT completed`（无需 version）
  - [ ] SubTask 14.4: deleteShopping 加事务
  - [ ] SubTask 14.5: updateMember 加事务包裹

## 阶段三：P2 后续修复

### APP 错误状态可见化（P2-6）

- [x] Task 15: pages/family/index.vue 加 error 状态
  - [ ] SubTask 15.1: 新增 `const error = ref('')` 状态
  - [ ] SubTask 15.2: 所有 catch 块设 `error.value = err.message || '加载失败'`
  - [ ] SubTask 15.3: UI 区分 loading / error / empty / hasData 四态，error 时显示错误信息 + "重试"按钮
  - [ ] SubTask 15.4: 重试按钮调用 `refreshAll()`

### Admin CRUD 业务校验（P2-7）

- [x] Task 16: AdminFamilyController 覆盖 add/delete
  - [ ] SubTask 16.1: [controller/admin/family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/controller/admin/family.ts) 覆盖 `@Post('/add')` 抛 400 `"请通过 C 端创建家庭组接口创建"`
  - [ ] SubTask 16.2: 覆盖 `@Post('/delete')` 接收 `ids: number[]`，对每个 family 查 ownerId，调 `familyService.disbandFamily(ownerId, { adminForce: true })`
  - [ ] SubTask 16.3: 注入 FamilyService

### 账号删除孤儿清理（P2-16）

- [x] Task 17: FamilyService 新增 handleUserLogoff 方法
  - [ ] SubTask 17.1: 新增 `async handleUserLogoff(userId: number)`
  - [ ] SubTask 17.2: 查询该用户在所有家庭的 member 关系
  - [ ] SubTask 17.3: 对每个家庭：若 owner 且有其他成员，转让给最早加入的 admin（或 member）；若 owner 且无其他成员，调 disbandFamily；若非 owner，删除 member 关系 + 原子 memberCount -1
  - [ ] SubTask 17.4: 事务包裹全部操作

- [x] Task 18: user/service/info.ts logoff 调用 handleUserLogoff
  - [ ] SubTask 18.1: [user/service/info.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/user/service/info.ts) 注入 FamilyService
  - [ ] SubTask 18.2: logoff 方法在递增 passwordV 后，调 `familyService.handleUserLogoff(userId)`
  - [ ] SubTask 18.3: 注意循环依赖：若 FamilyService 依赖 UserService，需用 `@Init` 延迟注入或通过 ctx 传递

### 网络降级策略统一（P2-17 剩余部分）

- [x] Task 19: weiji-app/utils/api.ts 超时与文案统一
  - [ ] SubTask 19.1: 超时从 30000 改为 15000
  - [ ] SubTask 19.2: 网络失败文案统一 `"网络异常，请稍后重试"`
  - [ ] SubTask 19.3: 401 文案统一 `"登录已失效，请重新登录"`

### 家庭组名称默认值统一（P2-18 剩余部分）

- [x] Task 20: 后端 FamilyEntity name 加默认值
  - [ ] SubTask 20.1: [family/entity/family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/entity/family.ts) `@Column({ default: '未命名家庭' }) name: string;`
  - [ ] SubTask 20.2: createFamily 若 name 为空字符串或 undefined，使用默认值（保持非空校验，但允许默认值兜底）

- [x] Task 21: APP 与 Web 显示统一用默认值
  - [ ] SubTask 21.1: weiji-app/pages/family/index.vue `familyInfo.name || '未命名家庭'`（替换"我的家庭"）
  - [ ] SubTask 21.2: weiji-web/app.js 显示家庭名称时用 `familyInfo.name || '未命名家庭'`

# Task Dependencies

- Task 2 依赖 Task 1（先改 code 判断，再改路径，避免调试时混淆错误源）
- Task 7 依赖 Task 4/5/6（service 方法先实现，controller 才能调用）
- Task 8 依赖 Task 7（APP UI 调用新 API，需后端先就绪）
- Task 9 依赖 Task 8（EventBus 在 UI 操作成功后触发）
- Task 12 依赖 Task 9（onShow 配合 EventBus）
- Task 14 依赖 Task 13（乐观锁依赖 version 字段存在）
- Task 17 可与 Task 4/5/6 并行（handleUserLogoff 复用 disbandFamily，但 disbandFamily 实现可先于 handleUserLogoff）
- Task 18 依赖 Task 17
- Task 16 依赖 Task 5（admin delete 调 disbandFamily）

# 并行化建议

- 阶段一 P0：
  - Task 1-3（Web 地基）可串行（同文件依赖）
  - Task 4-6（后端 service 三个新方法）可并行
  - Task 7 串行（依赖 4/5/6）
  - Task 8 依赖 7
  - Task 9-10 可并行（APP 与 Web 各自同步机制）
- 阶段二 P1：
  - Task 11（后端统一返回）独立
  - Task 12（APP onShow）依赖 Task 9
  - Task 13-14（乐观锁）串行
- 阶段三 P2：所有任务可并行（不同模块）
