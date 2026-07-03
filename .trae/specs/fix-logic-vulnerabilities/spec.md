# 跨端逻辑漏洞修复 Spec

## Why

对项目前后端（weiji-server / weiji-admin-web）与 APP 端（weiji-app）及 AI 集成（weiji-ai）进行系统逻辑审查，发现 200+ 个逻辑漏洞/错误，其中：

- **Critical 24 项**：跨家庭越权、登录态字段不一致、刷新 token 误用为 access token、refresh token 队列悬挂导致 Promise 永久挂起、临时图片 URL 直接入库导致数据永久丢失、生产环境 host 指向 cool-admin 演示服务器、TaskInfoService 几乎所有方法丢失 await、讯飞 ASR 用 REST 调用 WebSocket-only 接口（功能完全不可用）
- **High 56 项**：业务流程普遍无事务、read-modify-write 模式无锁导致并发丢更新、权限校验只查 userId 不查 familyId 归属、AI 厂商异常未捕获破坏降级链路、移动端登录拦截导致页面栈混乱、cool-uni 与 weiji-server 接口契约大面积不匹配

本 spec 聚焦**可在本阶段直接落地**的逻辑修复，不引入新基础设施、不做大规模重构。安全类问题（IDOR / CORS / 密码强度 / CSP / helmet / XSS）已由 `harden-security-and-quality` spec 处理，本 spec 不重复。

## What Changes

### P0 Critical - 数据完整性与登录态修复

#### 后端（weiji-server）

- **修复家庭权限跨家庭越权**：[family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/service/family.ts) `requireRole(userId, roles)` 改为 `requireRole(userId, familyId, roles)`，按 `familyId+userId` 查成员关系；`updateMember`/`removeMember`/`createInvitation`/`listInvitations` 全部传入目标 familyId 并校验 `target.familyId === membership.familyId`
- **修复盲猜跨家庭拉记录泄露**：[gamification.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/gamification/service/gamification.ts) `createRound` 取记录时加 `where: { id: In(ids), familyId: body.familyId }`，校验 `picked.length === ids.length`
- **修复 user 模块登录 token id 为 undefined**：[login.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/user/service/login.ts) `phone()`/`wxLoginToken()` 用 `userInfoEntity.save(user)` 替代 `insert(user)` 以回填 id
- **统一 JWT payload 字段**：account 与 user 模块统一用 `userId`；[user/middleware/app.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/user/middleware/app.ts) 归一化 `ctx.user.userId` 与 `ctx.user.id`
- **修复 refresh token 误用为 access token**：[user/middleware/app.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/user/middleware/app.ts) `if (ctx.user.isRefresh)` 判断移出 try，或在 catch 中显式 `ctx.user = undefined`
- **修复 TaskInfoService 全部方法丢失 await/return**：[task/service/info.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/task/service/info.ts) `stop`/`start`/`once`/`exist`/`addOrUpdate`/`delete`/`initTask`/`info` 每个分支加 `return await`
- **修复 TaskInfoController once/stop/start 缺 return**：[task/controller/admin/info.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/task/controller/admin/info.ts) 改为 `return this.ok()`
- **修复 TaskLocalService.executor 误释放他人锁**：[task/service/local.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/task/service/local.ts) `executor` 内部 `acquiredLock` 标志，`finally` 仅当 acquired 为真时清锁

#### 前端管理（weiji-admin-web）

- **修复 ai-record.vue 保存 blob URL 为图片地址**：[ai-record.vue](file:///e:/project/AromaMemoir/weiji-admin-web/src/modules/record/views/ai-record.vue) `handleSave` 前先调用 `service.base.comm.upload` 上传文件，用返回的服务器 URL 替代 blob URL
- **修复 ai-record.vue blob URL 内存泄漏**：`handleFileChange` 创建新 URL 前 `URL.revokeObjectURL(originalUrl.value)`；`resetForm` 同样撤销
- **修复 base/views/menu/index.vue mitt 监听未移除**：添加 `onUnmounted(() => mitt.off('helper.createMenu', refresh))`
- **修复 gamification/views/index.vue 类型断言绕过校验**：移除 `as unknown as number`，`familyId` 改为 `Number(familyId.value)`，`recordIds` 改为 `selectedRecipeIds.value.map(Number)`，`guessAuthorId` 由后端从 token 推断
- **修复 base/views/menu/index.vue 权限引用错误 service**：line 129、141 的 `service.base.sys.user._permission.add` 改为 `service.base.sys.menu._permission.add`

#### APP（weiji-app）

- **修复 cool/service/request.ts 401 未 reject 导致 Promise 永久挂起**：[request.ts](file:///e:/project/AromaMemoir/weiji-app/cool/service/request.ts) `user.logout()` 后立即 `return reject({ message })`
- **修复 cool/service/request.ts 刷新 token 队列回调丢失 data**：回调中 `next()` 内部直接 `resolve(data)`；失败分支 `requests.forEach(cb => cb(null))` 并清空数组
- **修复 cool/service/request.ts async executor Promise 反模式**：移除 async，使用普通 function executor
- **统一 utils/api.ts 与 cool request 认证逻辑**：让 cool request 也走 api.ts 的 `handleUnauthorized`，或封装共享方法
- **修复 weiji-app config/prod.ts host 指向 cool-admin 演示服务器**：[prod.ts](file:///e:/project/AromaMemoir/weiji-app/config/prod.ts) host 改为 weiji-server 实际生产域名；[proxy.ts](file:///e:/project/AromaMemoir/weiji-app/config/proxy.ts) 补充 `/api` 代理
- **修复 weiji-app config/dev.ts 非 H5 端使用 localhost**：dev 非 H5 baseUrl 改用开发机局域网 IP 或环境变量
- **修复 pages/user/set.vue 头像上传直接存临时路径**：[set.vue](file:///e:/project/AromaMemoir/weiji-app/pages/user/set.vue) `uni.chooseImage` 后先调用上传接口持久化，再 `updateProfile`

#### AI 集成（weiji-ai）

- **重写讯飞 ASR 为 WebSocket 客户端**：[xfyun_asr.py](file:///e:/project/AromaMemoir/weiji-ai/services/xfyun_asr.py) 改用 `websockets` 库按讯飞 IAT v2 协议实现：建立 wss → 分帧发送（每帧 1280 字节）→ 接收多帧 JSON → 拼接文本
- **修复讯飞签名 date 在非英文 locale 失效**：用 `email.utils.formatdate` 或硬编码英文月份/星期表生成 RFC1123 GMT 英文日期

### P1 High - 业务逻辑正确性修复

#### 后端 - 业务事务与原子性

- **checkin 打卡/补签加事务**：[checkin.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/checkin/service/checkin.ts) `checkin`/`replenish` 用 `getOrmManager().transaction` 包裹查询+保存
- **family createFamily/joinFamily/removeMember 加事务**：[family.ts](file:///e:/project/AromaMemoir/weiji-server/src/modules/family/service/family.ts) 每个业务的全部 DB 写入用事务包裹
- **family memberCount 改为原子自增/自减**：`update(familyId, { memberCount: () => 'memberCount - 1' })`
- **family voteMenu / GamificationService.guess 改为增量更新**：用 `JSON_ARRAY_APPEND` 或单独建表避免并发丢失
- **family generateShopping 批量 save 加事务**：循环改为 `save([...])` 一次性插入
- **achievement checkAndUnlock 加事务**：用 `INSERT ... ON DUPLICATE KEY UPDATE` 或事务+行锁

#### 后端 - 跨家庭归属校验

- **record.save 校验 familyId 归属**：若 body.familyId 存在，校验 `familyMemberEntity.findOneBy({ familyId, userId })`
- **record toggleLike/comment 校验记录归属家庭**：校验 `record.familyId` 与用户 membership 一致
- **family recipe/shopping/menu 全部校验家庭归属**：每个方法查到目标实体后，比对 `target.familyId` 与 `getUserMembership(userId).familyId`
- **analytics.track/list 校验 familyId 归属**：track 校验成员关系；list 仅返回当前用户自己的事件

#### 后端 - 成就解锁接入

- **接入 AchievementService 到关键 service**：`RecordService.save`、`FamilyService.createFamily`/`createRecipe`、`GamificationService.reveal` 注入 `AchievementService` 并调用 `checkAndUnlock`，传入相应 type 与 value

#### 后端 - 其他 High

- **修复 base/middleware/authority.ts 超管用户名硬编码 'admin'**：用 userId 或 role 标识超管，不依赖 username 字符串
- **修复 ai_proxy.setInterval 资源泄漏**：保存 `this.healthTimer`，在 `onDestroy` 中 `clearInterval`
- **修复 TaskLocalService.createCronJob cron 表达式越界**：校验 `task.every` 为正整数且 ≥ 1000
- **修复 checkin.replenish 本周计算改为自然周**：按周一到周日计算，非滚动 7 天
- **修复 RecordService.list/delete typeof 分发脆弱**：C 端方法单独命名（如 `appList`/`appDelete`），不复用 BaseService 同名方法

#### 前端管理 - High

- **修复 cool/service/request.ts token 刷新失败队列悬挂**：catch 中遍历 `queue` 逐一 reject，再 `user.logout()`
- **修复 cool/service/request.ts token 过期未 return**：`user.logout()` 后 `return Promise.reject(new Error('登录已失效'))`
- **修复 cool/bootstrap/module.ts eventLoop 无错误处理**：每个 `onLoad` 包裹 try/catch
- **修复 base/views/log.vue formatter 对 ip 字段无空值保护**：`(row.ip || '').split(',').filter(Boolean)`
- **修复 cool/utils/index.ts getBrowser 浏览器类型匹配错误**：`(ua.match(...) || ['other'])[0]`

#### APP - High

- **修复 router.beforeEach 未登录用 navigateTo 导致页面栈混乱**：拦截场景用 `router.login({ reLaunch: true })`
- **修复 router.nextLogin 回跳逻辑**：登录前记录 intent 路由，登录后 `router.push(intent)`
- **移除 router ignoreToken 中的 home/my**：未登录进入需触发拦截
- **移除 demo 子包对未登录开放**：`#ifdef DEVELOPMENT` 条件编译或上线前删除
- **修复 useUserStore.get 失败即 logout**：区分 401 与其他错误，仅 401 时 logout
- **修复 storage.isExpired 对无过期项误判过期**：key 不存在时返回 false
- **修复 cool/upload/index.ts 上传 URL 与字段名不匹配**：与 weiji-server 端点对齐
- **修复 pages/index/home.vue onShow 不刷新 records**：onShow 同时 loadRecords()，或监听 `uni.$on("recordSaved")`
- **修复 pages/user/captcha.vue/doc.vue 依赖不存在的端点**：要么补后端要么删前端
- **修复 pages/user/edit.vue 直接从 cool store 读 nickName**：onReady 中先 `api.getUserProfile()` 再回显
- **修复 pages/user/set.vue switchAccount 累积页面栈**：先 `clearUserStore()` 再 `uni.reLaunch`
- **修复 pages/family/index.vue 缺少"加入家庭"入口**：增加按钮调用 `api.joinFamily(code)`
- **修复 pages/gamification/index.vue guessForms 跨轮次数据污染**：loadRound 开头清空 guessForms
- **修复 pages/gamification/index.vue isRoundCreator 依赖未加载的 user.info**：进入页面主动调 `api.getUserProfile()`
- **修复 pages/gamification/index.vue handleCreate 要求手动输入 familyId**：onMounted 调 `api.getFamilyInfo()` 自动填充
- **修复 cool/hooks/wx.ts 使用已废弃的 getUserProfile**：改用 button open-type="chooseAvatar" + input type="nickname"

#### AI 集成 - High

- **修复百度 OAuth 异常未捕获破坏降级链路**：[baidu_vision.py](file:///e:/project/AromaMemoir/weiji-ai/services/baidu_vision.py) `_safe_baidu` 改为 `except Exception: return None`；`_get_access_token` 加 `timeout=10.0` 与 try/except
- **修复 OpenAI AsyncOpenAI 无超时控制**：[openai_vision.py](file:///e:/project/AromaMemoir/weiji-ai/services/openai_vision.py) `AsyncOpenAI(api_key=..., timeout=20.0)`，[qwen_llm.py](file:///e:/project/AromaMemoir/weiji-ai/services/qwen_llm.py) 同样
- **修复腾讯云审核 BizType 硬编码 'default'**：[tencent_moderation.py](file:///e:/project/AromaMemoir/weiji-ai/services/tencent_moderation.py) BizType 提取为环境变量 `TENCENT_MODERATION_BIZ_TYPE`，缺失时 WARNING
- **修复腾讯云审核容错过宽**：区分异常类型，`AiAuthError` 不静默放行；只有明确返回 `Suggestion=Pass/Review` 才返回 True

### P2 Medium - 一致性与边界修复（精选）

- **统一时区处理**：record/family/gamification 的 `new Date().toISOString()` 改用本地日期生成工具（如 checkin 的 `todayStr`），避免凌晨 0-8 点跨天错位
- **修复 main.py confidence 为 None 时 TypeError**：`(baidu_result.get('confidence') or 0) >= 0.8`
- **修复 openai_vision choices 为空 IndexError**：将 `response.choices[0]` 纳入 try/except
- **修复 weiji-server 未传 recentRecords 与 style 字段**：扩展 ai_proxy 类型，透传 body/params
- **修复 voiceRecognize 重组响应丢失 message 字段**：保留 `data.message`
- **修复 family.listRecipes visibility=private 时 authorId 被覆盖**：私有菜谱强制 `authorId = userId`，忽略 query.authorId
- **修复 family.generateShopping 去重 key 不一致**：统一用 `name|unit`
- **修复 family.getReport 全表扫描 + N+1**：改用 `userId IN (...) AND recordDate BETWEEN ... AND ...`
- **修复 user UserInfoService.person null 校验**：`if (!info) throw new CoolCommException('用户不存在')`
- **修复 user UserLoginService.refreshToken 未校验用户存在**：null 校验 + 抛 401
- **修复 user UserLoginService.password 用 md5**：统一用 bcrypt
- **修复 user UserInfoService.logoff 不失效 token**：递增 passwordV 并清除缓存
- **修复 user 中间件 catch 静默吞错**：`catch (error) { this.logger?.warn(...) }`
- **修复 ai_proxy.forward 一遇 4xx 即标记 down**：区分 5xx/网络错误（标记 down）与 4xx（不标记）
- **修复 cool/bootstrap/module.ts forEach async 无序**：改用 `for...of` 配合 `await`
- **修复 cool/utils/storage.ts isExpired 对无过期项误判**：`expiration === 0` 返回 false
- **修复 cool/module/index.ts get 非空断言不安全**：返回 `Module | undefined`，调用方做空值判断

## Impact

- Affected specs:
  - `harden-security-and-quality`（安全类问题已由该 spec 处理，本 spec 聚焦业务逻辑）
  - `fix-core-shortcomings`（其引入的 AchievementService 此前无外部调用方，本 spec 让其真正生效并接入 record/family/gamification）
  - `enhance-mvp-experience`（家庭动态流 N+1 已修复，本 spec 补齐跨家庭归属校验与事务）
  - `family-system-backend`（本 spec 修复其 family 权限模型与 memberCount 原子性缺陷）
- Affected code:
  - **后端**：family / record / checkin / gamification / achievement / task / user / analytics / ai 模块的 service 与 controller
  - **前端管理**：record / gamification / base / cool 模块的 views 与 service
  - **APP**：cool/service/request / router / store / upload，pages 下 user / family / gamification / record / index 业务页
  - **AI 集成**：weiji-ai/services 全部 + main.py，weiji-server ai_proxy.ts

## ADDED Requirements

### Requirement: 家庭权限按 familyId+userId 校验
系统 SHALL 对 family 模块的所有写操作（updateMember/removeMember/createInvitation/listInvitations/recipe/shopping/menu）校验操作者是目标 familyId 的成员且具备所需角色。

#### Scenario: 跨家庭越权操作
- **WHEN** 家庭 F1 的 admin 调用 `PATCH /app/family/member/:id` 修改 F2 的成员
- **THEN** 返回 403 + `"无权操作该家庭成员"`

#### Scenario: 同家庭合法操作
- **WHEN** 家庭 F1 的 admin 调用 `PATCH /app/family/member/:id` 修改 F1 的成员
- **THEN** 返回 200 + 更新后的成员信息

### Requirement: 盲猜轮次仅能拉取本家庭记录
系统 SHALL 在 `createRound` 取记录时按 `familyId` 过滤，校验所有 recordIds 都属于调用者所在家庭。

#### Scenario: 跨家庭拉记录
- **WHEN** 用户构造 recordIds 包含其他家庭的记录 id
- **THEN** 返回 400 + `"部分记录不存在或无权访问"`

### Requirement: 登录 token payload 字段统一
系统 SHALL 在所有登录入口（account 用户名密码、user 微信、user 手机号）签发统一字段 `userId` 的 JWT；user 中间件 SHALL 同时设置 `ctx.user.userId` 与 `ctx.user.id`。

#### Scenario: 用户名密码登录后访问 family 接口
- **WHEN** 用户通过 `/admin/base/open/login` 登录后访问 `/app/family/list`
- **THEN** `ctx.user.userId` 正确解析，返回家庭列表

#### Scenario: 微信登录后访问 user 接口
- **WHEN** 用户通过 `/app/user/login/wx` 登录后访问 `/app/user/person`
- **THEN** `ctx.user.id` 正确解析，返回用户信息

### Requirement: refresh token 不可作为 access token
系统 SHALL 在 user 中间件中拒绝 `isRefresh: true` 的 token 访问业务接口。

#### Scenario: 用 refresh token 访问业务接口
- **WHEN** 客户端用 refresh token 请求 `/app/record/list`
- **THEN** 返回 401 + `"登录失效~"`，且 `ctx.user` 不被设置

### Requirement: 临时图片 URL 不可入库
系统 SHALL 在保存记录/用户资料前，将客户端临时图片路径（blob URL、wxfile://、tempFilePaths）上传至服务器持久化，仅存储持久化后的 URL。

#### Scenario: APP 端保存头像
- **WHEN** 用户在 set.vue 选择头像后点击保存
- **THEN** 头像先上传至服务器，数据库存储的 avatarUrl 是服务器返回的持久化 URL

#### Scenario: 前端管理保存 AI 记录
- **WHEN** 管理员在 ai-record.vue 选择图片后点击保存
- **THEN** 图片先上传至服务器，记录的 imageUrl 是服务器返回的持久化 URL

### Requirement: APP 端 401 必须 reject Promise
weiji-app 的 cool/service/request.ts SHALL 在 401 时既调用 `user.logout()` 也 `return reject({ message })`，避免 Promise 永久挂起。

#### Scenario: token 过期访问业务接口
- **WHEN** 用户 token 过期后访问 `/app/family/list`
- **THEN** Promise 被 reject，调用方 catch 接收到错误，UI 显示登录页

### Requirement: TaskInfoService 方法必须 await 并 return
TaskInfoService 的 `stop`/`start`/`once`/`exist`/`addOrUpdate`/`delete`/`initTask`/`info` SHALL 在所有分支前加 `return await`，确保 Promise 链正确传递。

#### Scenario: 手动执行任务
- **WHEN** B 端调用 `POST /admin/task/info/once`
- **THEN** 等待任务实际执行完成后再返回 200

### Requirement: 讯飞 ASR 必须用 WebSocket 客户端
weiji-ai 的讯飞 ASR 服务 SHALL 使用 WebSocket 客户端按 IAT v2 协议实现，不能用 REST 调用 wss-only 接口。

#### Scenario: 配置正确的讯飞密钥后调用语音识别
- **WHEN** weiji-ai 收到含音频的 `/ai/voice/recognize` 请求且讯飞密钥已配置
- **THEN** 通过 WebSocket 与讯飞服务通信，返回识别文本（非空字符串）

### Requirement: 业务写操作必须事务化
family createFamily/joinFamily/removeMember/generateShopping、checkin checkin/replenish、achievement checkAndUnlock SHALL 用数据库事务包裹全部 DB 写入，避免部分失败导致数据不一致。

#### Scenario: 并发加入家庭
- **WHEN** 两个用户同时用同一邀请码加入家庭
- **THEN** memberCount 正确 +2，邀请码状态正确，无脏数据

### Requirement: 跨家庭资源访问必须校验归属
record / family recipe/shopping/menu / analytics 的所有读写操作 SHALL 校验目标实体的 familyId 与调用者 membership.familyId 一致。

#### Scenario: 跨家庭点赞他人记录
- **WHEN** 用户 A 对家庭 F2 的记录调用 toggleLike
- **THEN** 返回 403 + `"无权操作该记录"`

### Requirement: 成就解锁必须接入业务流程
RecordService.save / FamilyService.createFamily/createRecipe / GamificationService.reveal SHALL 注入 AchievementService 并调用 checkAndUnlock，覆盖 record_count / cuisine_count / family_created / recipe_count / gameplay_blindguess 五类成就。

#### Scenario: 用户首次保存记录
- **WHEN** 用户保存第 1 条记录
- **THEN** `first_record` 成就自动解锁，返回 newAchievements 包含该成就

### Requirement: APP 端生产环境 host 必须指向真实后端
weiji-app config/prod.ts 的 host SHALL 指向 weiji-server 实际生产域名，不可指向 cool-admin 演示服务器。

#### Scenario: 生产环境构建
- **WHEN** 执行 `vite build --mode production`
- **THEN** 生成的产物中 baseUrl 指向 weiji-server 生产域名，不含 `show.cool-admin.com`

### Requirement: AI 厂商异常不可破坏降级链路
weiji-ai 的 `_safe_baidu` SHALL 捕获所有异常（含 httpx 原生异常）返回 None；AsyncOpenAI 客户端 SHALL 设置 timeout=20.0；腾讯云审核 SHALL 区分异常类型，AiAuthError 不静默放行。

#### Scenario: 百度 OAuth 网络抖动
- **WHEN** 百度 OAuth 端点超时
- **THEN** _safe_baidu 返回 None，主流程回退到 GPT-4o Vision 兜底

#### Scenario: 腾讯云密钥错误
- **WHEN** 腾讯云密钥配置错误
- **THEN** AiAuthError 被记录，审核结果不静默放行（返回拒绝或抛出，不返回 True）

## MODIFIED Requirements

### Requirement: TaskLocalService.executor 锁机制
原实现：`finally` 中无条件 `update lockExpireTime: null`，即使本实例未获取锁也会清除他人锁。
修改后：`try` 内部记录 `acquiredLock` 标志，`finally` 仅当 `acquiredLock` 为真时才清锁。

### Requirement: family memberCount 更新
原实现：read-modify-write 模式，先 `findOneBy` 读出 family，再 `update memberCount: family.memberCount - 1`。
修改后：原子自增/自减 `update(familyId, { memberCount: () => 'memberCount - 1' })`。

### Requirement: base/middleware/authority.ts 超管判定
原实现：`if (ctx.admin.username == 'admin' && !ctx.admin.isRefresh)`。
修改后：基于 userId 或 role 字段判定超管，不依赖 username 字符串。

### Requirement: checkin.replenish 本周计算
原实现：`checkDate >= sevenDaysAgo`（滚动 7 天）。
修改后：按自然周（周一到周日）计算，`checkDate >= 本周一`。

### Requirement: weiji-app 路由登录拦截
原实现：未登录时 `router.login()` 默认 navigateTo，保留原页面栈。
修改后：拦截场景用 `router.login({ reLaunch: true })`，登录前记录 intent 路由，登录后 `router.push(intent)`。

## REMOVED Requirements

### Requirement: base/views/menu/index.vue 权限引用 user service
**Reason**: 右键菜单"新增"和"权限"操作的是菜单数据，引用 `service.base.sys.user._permission.add` 是错误的，应引用 `service.base.sys.menu._permission.add`。
**Migration**: 直接替换为正确的 service 引用。

### Requirement: weiji-app ignoreToken 包含 home/my
**Reason**: home/my 页面会调用需登录接口（loadRecords/loadProfile），未登录进入会触发 401 闪现跳转，体验差。
**Migration**: 从 ignoreToken 移除 home/my，未登录进入需触发登录拦截。

### Requirement: weiji-app demo 子包对未登录开放
**Reason**: demo 包含开发演示页，生产环境信息泄漏，包体积增大。
**Migration**: `#ifdef DEVELOPMENT` 条件编译或上线前删除 demo 子包。

## Out of Scope

以下问题不在本 spec 范围，由后续独立 spec 处理：

- **安全类问题**（IDOR / CORS / 密码强度 / CSP / helmet / XSS / 速率限制）—— 已由 `harden-security-and-quality` spec 处理
- **N+1 查询性能优化**（family getMembers / listFamilyRecords 批量预加载）—— 已由 `harden-security-and-quality` spec 处理
- **cool-admin 接口契约大面积不匹配**（weiji-app 依赖 service.user.login.refreshToken / service.base.comm.param 等不存在的端点）—— 涉及 cool-uni 框架改造或 weiji-server 端点补齐，独立 spec
- **微信小程序 MVP**（getUserProfile 废弃迁移）—— 新形态开发，独立 spec
- **API 版本化 `/api/v1/` 前缀** —— 破坏性变更，独立 spec
- **snake_case → camelCase 命名统一** —— 大规模机械重构，独立 spec
- **any 类型替换为明确接口** —— 大规模类型补全，独立 spec
- **Swagger/OpenAPI 文档** —— 独立工程项
- **Refresh token + 缩短 access token**（需 Redis）—— 独立 spec
- **logout 黑名单**（需 Redis TTL）—— 独立 spec
- **API 响应大小限制 / 文件类型校验**（nginx/网关层）—— 独立 spec
- **AI 评估体系**（≥500 张标注图片）—— 数据/算法工作，独立 spec
- **测试用例补齐**（每个修复点对应的单元/集成测试）—— 由实现阶段同步补齐，不单列 spec
- **Low 级代码质量问题**（死代码清理、废弃 API 替换、样式残留）—— 独立 spec

## 验收基线

- 现有测试套件保持原通过项不回归
- 新增测试用例覆盖关键修复点：家庭越权 403、盲猜跨家庭 400、refresh token 拒绝、临时 URL 不入库、TaskInfoService await、讯飞 ASR WebSocket、事务回滚、成就解锁接入
- `cd weiji-server && npm run build` exit 0
- `cd weiji-admin-web && npm run build` exit 0
- `cd weiji-ai && python -m pytest` 通过（沙箱无依赖时记录为环境缺失，不阻塞）
- weiji-app 在 H5 与小程序端均能完成登录→业务操作→登出闭环，无 Promise 挂起、无页面栈混乱
