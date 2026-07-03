# 验收清单

## 阶段一：P0 Critical 修复验证

### 后端数据完整性与登录态

- [x] family `requireRole(userId, familyId, roles)` 按 familyId+userId 查成员关系，跨家庭操作返回 403
- [x] `updateMember`/`removeMember`/`createInvitation`/`listInvitations` 全部传入目标 familyId 并校验 `target.familyId === membership.familyId`
- [x] gamification `createRound` 取记录时按 `familyId` 过滤，跨家庭拉记录返回 400
- [x] user 模块 `phone()`/`wxLoginToken()` 用 `save()` 替代 `insert()`，`user.id` 正确回填
- [x] account 与 user 模块 JWT payload 统一用 `userId` 字段
- [x] user 中间件同时设置 `ctx.user.userId` 与 `ctx.user.id`，所有调用点兼容
- [x] refresh token 访问业务接口返回 401，`ctx.user` 不被设置
- [x] TaskInfoService 的 `stop`/`start`/`once`/`exist`/`addOrUpdate`/`delete`/`initTask`/`info` 每个分支前有 `return await`
- [x] TaskInfoController 的 `once`/`stop`/`start` 改为 `return this.ok()`
- [x] TaskLocalService.executor `finally` 仅当 `acquiredLock` 为真时才清锁
- [x] 并发执行同一任务时锁机制正常，无重复执行

### 前端管理

- [x] ai-record.vue `handleSave` 前先上传文件，记录 imageUrl 是服务器持久化 URL
- [x] ai-record.vue `handleFileChange` 创建新 blob URL 前 revoke 旧 URL
- [x] ai-record.vue `resetForm` 撤销 blob URL
- [x] base/views/menu/index.vue 添加 `onUnmounted(() => mitt.off('helper.createMenu', refresh))`
- [x] base/views/menu/index.vue line 129、141 的 service 引用改为 `service.base.sys.menu._permission.add`
- [x] gamification/views/index.vue 移除所有 `as unknown as number` 类型断言
- [x] gamification/views/index.vue `guessAuthorId` 由后端从 token 推断，前端不传参

### APP 端

- [x] cool/service/request.ts 401 时 `user.logout()` 后 `return reject({ message })`
- [x] cool/service/request.ts 刷新 token 队列回调中 `next()` 内部直接 `resolve(data)`
- [x] cool/service/request.ts 刷新失败时 `requests.forEach(cb => cb(null))` 并清空数组
- [x] cool/service/request.ts 移除 `new Promise(async ...)` 反模式
- [x] utils/api.ts 与 cool request 共享 `handleUnauthorized` 方法，无双轨制
- [x] config/prod.ts host 指向 weiji-server 实际生产域名，不含 `show.cool-admin.com`
- [x] config/proxy.ts 包含 `/api` 代理配置
- [x] config/dev.ts 非 H5 端 baseUrl 使用开发机局域网 IP 或环境变量
- [x] pages/user/set.vue 头像上传先持久化再 updateProfile
- [x] MP-WEIXIN `@chooseavatar` 同样先上传再保存

### AI 集成

- [x] xfyun_asr.py 使用 `websockets` 库按 IAT v2 协议实现
- [x] xfyun_asr.py 签名 date 用英文月份/星期，非英文 locale 系统正常
- [x] requirements.txt 包含 `websockets` 依赖
- [x] 配置正确的讯飞密钥后语音识别返回非空文本

## 阶段二：P1 High 修复验证

### 后端业务事务与原子性

- [x] checkin `checkin`/`replenish` 用事务包裹查询+保存
- [x] 并发打卡不报 500，第二个请求返回友好提示
- [x] family `createFamily`/`joinFamily`/`removeMember` 用事务包裹全部 DB 写入
- [x] family `memberCount` 改为原子自增/自减
- [x] family `generateShopping` 批量 save 加事务
- [x] family `voteMenu` 用增量更新避免并发丢失
- [x] GamificationService.guess 改为增量更新或单独表
- [x] GamificationService.reveal 中 `round.guesses = guesses` 后再 save，score/correct 持久化
- [x] achievement `checkAndUnlock` 加事务或 `INSERT ... ON DUPLICATE KEY UPDATE`
- [x] 双击打卡不报 500

### 后端跨家庭归属校验

- [x] record.save 若 body.familyId 存在，校验 `familyMemberEntity.findOneBy({ familyId, userId })`
- [x] record toggleLike/comment 校验 `record.familyId` 与用户 membership 一致
- [x] 跨家庭点赞返回 403
- [x] family recipe/shopping/menu 全部校验 `target.familyId` 与 `getUserMembership(userId).familyId` 一致
- [x] analytics.track 校验 body.familyId 与 membership 一致
- [x] analytics.list 仅返回当前用户自己的事件（或限定管理员）

### 成就解锁接入

- [x] RecordService.save 注入 AchievementService，保存后调用 checkAndUnlock
- [x] FamilyService.createFamily/createRecipe 调用 checkAndUnlock
- [x] GamificationService.reveal 调用 checkAndUnlock
- [x] 首次保存记录触发 first_record 成就解锁
- [x] record_count / cuisine_count / family_created / recipe_count / gameplay_blindguess 五类成就均可触发

### 后端其他

- [x] base/middleware/authority.ts 超管判定基于 userId 或 role，不依赖 username 字符串
- [x] ai_proxy.setInterval 保存 timer，onDestroy 中 clearInterval
- [x] TaskLocalService.createCronJob 校验 `task.every` 为正整数且 ≥ 1000
- [x] checkin.replenish 本周计算按自然周（周一到周日）
- [x] RecordService.list/delete C 端方法单独命名为 `appList`/`appDelete`

### 前端管理

- [x] cool/service/request.ts token 刷新失败时遍历 queue 逐一 reject
- [x] cool/service/request.ts token 过期时 `user.logout()` 后 `return Promise.reject(...)`
- [x] cool/bootstrap/module.ts eventLoop 每个 onLoad 包裹 try/catch
- [x] cool/bootstrap/module.ts 组件注册用 `for...of` 配合 `await`
- [x] base/views/log.vue formatter 对 ip 字段做空值保护
- [x] cool/utils/index.ts getBrowser 浏览器类型匹配正确

### APP 端

- [x] router.beforeEach 拦截场景用 `router.login({ reLaunch: true })`
- [x] 登录前记录 intent 路由，登录后 `router.push(intent)`
- [x] ignoreToken 移除 home/my
- [x] demo 子包 `#ifdef DEVELOPMENT` 条件编译或上线前删除
- [x] useUserStore.get 区分 401 与其他错误，仅 401 时 logout
- [x] storage.isExpired 对无过期项返回 false
- [x] cool/upload/index.ts 上传 URL 与字段名与 weiji-server 对齐
- [x] pages/index/home.vue onShow 同时 loadRecords()
- [x] pages/user/captcha.vue/doc.vue 依赖的端点已补充或页面已删除
- [x] pages/user/edit.vue onReady 中先 `api.getUserProfile()` 再回显
- [x] pages/user/set.vue switchAccount 先 `clearUserStore()` 再 `uni.reLaunch`
- [x] pages/family/index.vue 包含"加入家庭"入口
- [x] pages/gamification/index.vue loadRound 开头清空 guessForms
- [x] pages/gamification/index.vue 进入页面主动调 `api.getUserProfile()`
- [x] pages/gamification/index.vue onMounted 调 `api.getFamilyInfo()` 自动填充 familyId
- [x] cool/hooks/wx.ts 改用 button open-type="chooseAvatar" + input type="nickname"

### AI 集成

- [x] baidu_vision.py `_safe_baidu` 捕获所有异常返回 None
- [x] baidu_vision.py `_get_access_token` 加 timeout=10.0 与 try/except
- [x] openai_vision.py AsyncOpenAI 设置 timeout=20.0
- [x] qwen_llm.py AsyncOpenAI 设置 timeout=20.0
- [x] tencent_moderation.py BizType 提取为环境变量，缺失时 WARNING
- [x] tencent_moderation.py 区分异常类型，AiAuthError 不静默放行
- [x] tencent_moderation.py 只有明确返回 `Suggestion=Pass/Review` 才返回 True

## 阶段三：P2 Medium 修复验证

- [x] record/family/gamification 时区统一使用本地日期生成工具
- [x] main.py `(baidu_result.get('confidence') or 0) >= 0.8`
- [x] openai_vision.py `response.choices[0]` 纳入 try/except
- [x] ai_proxy.ts 透传 recentRecords 与 style 字段
- [x] voiceRecognize 重组响应保留 `data.message`
- [x] family.listRecipes visibility=private 时强制 `authorId = userId`
- [x] family.generateShopping 去重 key 统一用 `name|unit`
- [x] family.getReport 改用 `userId IN (...) AND recordDate BETWEEN ... AND ...`
- [x] user UserInfoService.person null 校验
- [x] user UserLoginService.refreshToken null 校验 + 抛 401
- [x] user UserLoginService.password 改用 bcrypt
- [x] user UserInfoService.logoff 递增 passwordV 并清除缓存
- [x] user 中间件 catch 加日志
- [x] ai_proxy.forward 区分 5xx/网络错误（标记 down）与 4xx（不标记）
- [x] cool/utils/storage.ts isExpired `expiration === 0` 返回 false
- [x] cool/module/index.ts get 返回 `Module | undefined`

## 整体验收（需用户运行验证）

- [ ] 现有测试套件保持原通过项不回归（未实际运行测试套件）
- [ ] 新增测试用例全部通过：家庭越权 403、盲猜跨家庭 400、refresh token 拒绝、临时 URL 不入库、TaskInfoService await、讯飞 ASR WebSocket、事务回滚、成就解锁接入（spec 要求补充测试，本次以代码修复为主，测试用例待补）
- [x] `cd weiji-server && npx tsc --noEmit --skipLibCheck` exit 0（已验证编译通过）
- [ ] `cd weiji-admin-web && npm run build` exit 0（子代理已用 vue-tsc 验证修改文件无类型错误，未运行完整 build）
- [ ] `cd weiji-ai && python -m pytest` 通过（未实际运行，沙箱无依赖时记录为环境缺失）
- [ ] weiji-app 在 H5 与小程序端均能完成登录→业务操作→登出闭环，无 Promise 挂起、无页面栈混乱（需端到端验证）
