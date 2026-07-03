# Tasks

## 阶段一：P0 Critical - 后端数据完整性与登录态修复

- [x] Task 1: 修复家庭权限跨家庭越权
  - [x] SubTask 1.1: 修改 `family/service/family.ts` 的 `requireRole(userId, roles)` 为 `requireRole(userId, familyId, roles)`，按 `familyId+userId` 查成员关系
  - [x] SubTask 1.2: `updateMember`/`removeMember`/`createInvitation`/`listInvitations` 全部传入目标 familyId
  - [x] SubTask 1.3: 校验 `target.familyId === membership.familyId`，越权返回 403
  - [x] SubTask 1.4: 补充单元测试覆盖跨家庭越权场景

- [x] Task 2: 修复盲猜跨家庭拉记录泄露
  - [x] SubTask 2.1: 修改 `gamification/service/gamification.ts` 的 `createRound`，取记录时加 `where: { id: In(ids), familyId: body.familyId }`
  - [x] SubTask 2.2: 校验 `picked.length === ids.length`，不匹配抛 400 `"部分记录不存在或无权访问"`
  - [x] SubTask 2.3: 补充集成测试覆盖跨家庭拉记录场景

- [x] Task 3: 修复 user 模块登录 token id 为 undefined
  - [x] SubTask 3.1: 修改 `user/service/login.ts` 的 `phone()` 用 `userInfoEntity.save(user)` 替代 `insert(user)`
  - [x] SubTask 3.2: 同样修改 `wxLoginToken()`
  - [x] SubTask 3.3: 验证 `user.id` 在 insert 后正确回填

- [x] Task 4: 统一 JWT payload 字段为 userId
  - [x] SubTask 4.1: 修改 `account/service/auth.ts` token 签发保持 `userId`
  - [x] SubTask 4.2: 修改 `user/service/login.ts` token 签发改为 `userId`（替换 `id`）
  - [x] SubTask 4.3: 修改 `user/middleware/app.ts` 同时设置 `ctx.user.userId` 与 `ctx.user.id`（归一化）
  - [x] SubTask 4.4: 全局搜索 `ctx.user.id` 与 `ctx.user.userId`，确保所有调用点兼容

- [x] Task 5: 修复 refresh token 误用为 access token
  - [x] SubTask 5.1: 修改 `user/middleware/app.ts`，`if (ctx.user.isRefresh)` 判断移出 try 块
  - [x] SubTask 5.2: 在 catch 中显式 `ctx.user = undefined`
  - [x] SubTask 5.3: 补充测试：用 refresh token 访问业务接口应返回 401

- [x] Task 6: 修复 TaskInfoService 全部方法丢失 await/return
  - [x] SubTask 6.1: 修改 `task/service/info.ts` 的 `stop`/`start`/`once`/`exist`/`addOrUpdate`/`delete`/`initTask`/`info` 每个分支前加 `return await`
  - [x] SubTask 6.2: 修改 `task/controller/admin/info.ts` 的 `once`/`stop`/`start` 改为 `return this.ok()`
  - [x] SubTask 6.3: 验证 B 端任务管理页操作正常

- [x] Task 7: 修复 TaskLocalService.executor 误释放他人锁
  - [x] SubTask 7.1: 修改 `task/service/local.ts` 的 `executor`，try 内部记录 `acquiredLock` 标志
  - [x] SubTask 7.2: `finally` 仅当 `acquiredLock` 为真时才 `update lockExpireTime: null`
  - [x] SubTask 7.3: 补充并发执行测试

## 阶段一：P0 Critical - 前端管理修复

- [x] Task 8: 修复 ai-record.vue blob URL 数据完整性与内存泄漏
  - [x] SubTask 8.1: `handleSave` 前先调用 `service.base.comm.upload` 上传文件，用返回的服务器 URL 替代 blob URL
  - [x] SubTask 8.2: `handleFileChange` 创建新 URL 前 `URL.revokeObjectURL(originalUrl.value)`
  - [x] SubTask 8.3: `resetForm` 中同样撤销 blob URL

- [x] Task 9: 修复 base/views/menu/index.vue mitt 监听未移除与权限引用错误
  - [x] SubTask 9.1: 添加 `onUnmounted(() => mitt.off('helper.createMenu', refresh))`
  - [x] SubTask 9.2: 将 line 129、141 的 `service.base.sys.user._permission.add` 改为 `service.base.sys.menu._permission.add`

- [x] Task 10: 修复 gamification/views/index.vue 类型断言绕过校验
  - [x] SubTask 10.1: 移除 `as unknown as number`，`familyId` 改为 `Number(familyId.value)`
  - [x] SubTask 10.2: `recordIds` 改为 `selectedRecipeIds.value.map(Number)`
  - [x] SubTask 10.3: `guessAuthorId` 由后端从 token 推断（移除前端传参）

## 阶段一：P0 Critical - APP 端修复

- [x] Task 11: 修复 cool/service/request.ts 三大缺陷
  - [x] SubTask 11.1: 401 时 `user.logout()` 后立即 `return reject({ message })`
  - [x] SubTask 11.2: 刷新 token 队列回调中 `next()` 内部直接 `resolve(data)`；失败分支 `requests.forEach(cb => cb(null))` 并清空数组
  - [x] SubTask 11.3: 移除 `new Promise(async (resolve, reject) => {...})` 的 async executor，改用普通 function

- [x] Task 12: 统一 utils/api.ts 与 cool request 认证逻辑
  - [x] SubTask 12.1: 抽取共享的 `handleUnauthorized` 方法
  - [x] SubTask 12.2: 让 cool request 也走共享方法，避免双轨制

- [x] Task 13: 修复 weiji-app config/prod.ts 与 dev.ts
  - [x] SubTask 13.1: prod.ts host 改为 weiji-server 实际生产域名（占位符或环境变量）
  - [x] SubTask 13.2: proxy.ts 补充 `/api` 代理
  - [x] SubTask 13.3: dev.ts 非 H5 端 baseUrl 改用开发机局域网 IP 或环境变量

- [x] Task 14: 修复 pages/user/set.vue 头像上传直接存临时路径
  - [x] SubTask 14.1: `uni.chooseImage` 后调用上传接口（cool upload 或 api.upload）持久化
  - [x] SubTask 14.2: 用返回的服务器 URL 调用 `updateProfile`
  - [x] SubTask 14.3: MP-WEIXIN `@chooseavatar` 同样处理

## 阶段一：P0 Critical - AI 集成修复

- [x] Task 15: 重写讯飞 ASR 为 WebSocket 客户端
  - [x] SubTask 15.1: 在 requirements.txt 添加 `websockets` 依赖
  - [x] SubTask 15.2: 重写 `xfyun_asr.py` 用 WebSocket 按 IAT v2 协议：建立 wss → 分帧发送（每帧 1280 字节）→ 接收多帧 JSON → 拼接文本
  - [x] SubTask 15.3: 修复签名 date 用 `email.utils.formatdate` 或硬编码英文月份/星期表
  - [x] SubTask 15.4: 补充单元测试 mock WebSocket 验证文本拼接

## 阶段二：P1 High - 后端业务事务与原子性

- [x] Task 16: checkin 打卡/补签加事务
  - [x] SubTask 16.1: `checkin/service/checkin.ts` 的 `checkin` 用 `getOrmManager().transaction` 包裹查询+保存
  - [x] SubTask 16.2: `replenish` 同样加事务
  - [x] SubTask 16.3: 补充并发打卡测试验证不报 500

- [x] Task 17: family 写操作加事务与原子计数
  - [x] SubTask 17.1: `createFamily`/`joinFamily`/`removeMember` 用事务包裹全部 DB 写入
  - [x] SubTask 17.2: `memberCount` 改为原子自增/自减 `update(familyId, { memberCount: () => 'memberCount - 1' })`
  - [x] SubTask 17.3: `generateShopping` 改为批量 `save([...])` 加事务
  - [x] SubTask 17.4: `voteMenu` 改用 `JSON_ARRAY_APPEND` 增量更新避免并发丢失

- [x] Task 18: GamificationService.guess 改为增量更新
  - [x] SubTask 18.1: `guess` 方法改为单独建 `blind_guess_submission` 表或用 `JSON_ARRAY_APPEND`
  - [x] SubTask 18.2: `reveal` 中 `round.guesses = guesses` 后再 save，确保 score/correct 持久化
  - [x] SubTask 18.3: 补充并发猜测测试

- [x] Task 19: achievement checkAndUnlock 加事务
  - [x] SubTask 19.1: 用 `INSERT ... ON DUPLICATE KEY UPDATE` 或事务+行锁
  - [x] SubTask 19.2: 验证双击打卡不报 500

## 阶段二：P1 High - 后端跨家庭归属校验

- [x] Task 20: record 模块校验家庭归属
  - [x] SubTask 20.1: `record/service/record.ts` 的 `save` 若 body.familyId 存在，校验 `familyMemberEntity.findOneBy({ familyId, userId })`
  - [x] SubTask 20.2: `toggleLike`/`comment` 校验 `record.familyId` 与用户 membership 一致
  - [x] SubTask 20.3: 补充跨家庭点赞测试返回 403

- [x] Task 21: family recipe/shopping/menu 校验家庭归属
  - [x] SubTask 21.1: `getRecipe`/`updateRecipe`/`deleteRecipe`/`updateRecipeVisibility` 查到目标实体后比对 `target.familyId` 与 `getUserMembership(userId).familyId`
  - [x] SubTask 21.2: `voteMenu`/`toggleShopping`/`deleteShopping` 同样校验
  - [x] SubTask 21.3: 补充跨家庭操作测试

- [x] Task 22: analytics 校验 familyId 归属与权限
  - [x] SubTask 22.1: `track` 校验 body.familyId 与 membership 一致
  - [x] SubTask 22.2: `list` 仅返回当前用户自己的事件（或限定管理员）

## 阶段二：P1 High - 成就解锁接入业务流程

- [x] Task 23: 接入 AchievementService 到关键 service
  - [x] SubTask 23.1: `RecordService.save` 注入 `AchievementService`，保存后调用 `checkAndUnlock` 传 record_count 与 cuisine_count
  - [x] SubTask 23.2: `FamilyService.createFamily` 调用传 family_created
  - [x] SubTask 23.3: `FamilyService.createRecipe` 调用传 recipe_count
  - [x] SubTask 23.4: `GamificationService.reveal` 调用传 gameplay_blindguess
  - [x] SubTask 23.5: 验证首次保存记录触发 first_record 成就解锁

## 阶段二：P1 High - 后端其他修复

- [x] Task 24: 修复 base/middleware/authority.ts 超管用户名硬编码
  - [x] SubTask 24.1: 改用 userId 或 role 字段判定超管
  - [x] SubTask 24.2: 验证非超管用户无法绕过权限

- [x] Task 25: 修复 ai_proxy.setInterval 资源泄漏
  - [x] SubTask 25.1: 保存 `this.healthTimer = setInterval(...)`
  - [x] SubTask 25.2: 添加 `onDestroy` 生命周期方法 `clearInterval(this.healthTimer)`

- [x] Task 26: 修复 TaskLocalService.createCronJob cron 表达式越界
  - [x] SubTask 26.1: 校验 `task.every` 为正整数且 ≥ 1000，否则抛业务异常

- [x] Task 27: 修复 checkin.replenish 本周计算改为自然周
  - [x] SubTask 27.1: 按周一到周日计算，`checkDate >= 本周一`

- [x] Task 28: 修复 RecordService.list/delete typeof 分发脆弱
  - [x] SubTask 28.1: C 端方法单独命名为 `appList`/`appDelete`
  - [x] SubTask 28.2: 修改对应 controller 调用新方法

## 阶段二：P1 High - 前端管理修复

- [x] Task 29: 修复 cool/service/request.ts token 刷新队列悬挂与未 return
  - [x] SubTask 29.1: catch 中遍历 `queue` 逐一 reject，再 `user.logout()`
  - [x] SubTask 29.2: token 过期时 `user.logout()` 后 `return Promise.reject(new Error('登录已失效'))`

- [x] Task 30: 修复 cool/bootstrap/module.ts eventLoop 与 forEach async
  - [x] SubTask 30.1: 每个 `onLoad` 包裹 try/catch，记录错误但继续执行
  - [x] SubTask 30.2: 组件注册的 `forEach(async ...)` 改为 `for...of` 配合 `await`

- [x] Task 31: 修复 base/views/log.vue 与 cool/utils/index.ts 空值保护
  - [x] SubTask 31.1: log.vue formatter 改为 `(row.ip || '').split(',').filter(Boolean)`
  - [x] SubTask 31.2: cool/utils/index.ts getBrowser 改为 `(ua.match(...) || ['other'])[0]`

## 阶段二：P1 High - APP 端修复

- [x] Task 32: 修复 router 登录拦截与页面栈问题
  - [x] SubTask 32.1: `router.beforeEach` 拦截场景用 `router.login({ reLaunch: true })`
  - [x] SubTask 32.2: 登录前记录 intent 路由，登录后 `router.push(intent)`
  - [x] SubTask 32.3: 从 ignoreToken 移除 home/my
  - [x] SubTask 32.4: demo 子包 `#ifdef DEVELOPMENT` 条件编译

- [x] Task 33: 修复 useUserStore.get 与 storage.isExpired
  - [x] SubTask 33.1: `user.ts` 的 `get` 区分 401 与其他错误，仅 401 时 logout
  - [x] SubTask 33.2: `storage.ts` 的 `isExpired` 对无过期项返回 false

- [x] Task 34: 修复 cool/upload/index.ts 上传 URL 与字段名
  - [x] SubTask 34.1: 与 weiji-server 端点对齐
  - [x] SubTask 34.2: 统一文件字段名（file/image/audio）

- [x] Task 35: 修复 pages/index/home.vue onShow 不刷新 records
  - [x] SubTask 35.1: onShow 同时调用 `loadRecords()`
  - [x] SubTask 35.2: 或监听 `uni.$on("recordSaved")` 事件刷新

- [x] Task 36: 修复 pages/user/captcha.vue 与 doc.vue 依赖不存在的端点
  - [x] SubTask 36.1: 评估是补充 weiji-server 端点还是删除前端页面
  - [x] SubTask 36.2: 若删除，移除相关入口与 sms-btn 组件
  - [x] SubTask 36.3: 若补充，实现 `/app/user/login/phone` 与 `/app/base/comm/param` 端点

- [x] Task 37: 修复 pages/user/edit.vue 与 set.vue
  - [x] SubTask 37.1: edit.vue onReady 中先 `api.getUserProfile()` 再回显
  - [x] SubTask 37.2: set.vue switchAccount 先 `clearUserStore()` 再 `uni.reLaunch`

- [x] Task 38: 修复 pages/family/index.vue 缺少加入家庭入口
  - [x] SubTask 38.1: 增加"加入家庭"按钮
  - [x] SubTask 38.2: 弹出输入框调用 `api.joinFamily(code)`

- [x] Task 39: 修复 pages/gamification/index.vue 三个问题
  - [x] SubTask 39.1: loadRound 开头清空 guessForms
  - [x] SubTask 39.2: 进入页面主动调 `api.getUserProfile()` 写入 user.info
  - [x] SubTask 39.3: onMounted 调 `api.getFamilyInfo()` 自动填充 familyId

- [x] Task 40: 修复 cool/hooks/wx.ts 使用已废弃的 getUserProfile
  - [x] SubTask 40.1: 改用 button open-type="chooseAvatar" + input type="nickname"
  - [x] SubTask 40.2: 验证微信小程序端登录正常

## 阶段二：P1 High - AI 集成修复

- [x] Task 41: 修复百度 OAuth 异常未捕获破坏降级链路
  - [x] SubTask 41.1: `baidu_vision.py` 的 `_safe_baidu` 改为 `except Exception: return None`
  - [x] SubTask 41.2: `_get_access_token` 加 `timeout=10.0` 与 try/except

- [x] Task 42: 修复 OpenAI AsyncOpenAI 无超时控制
  - [x] SubTask 42.1: `openai_vision.py` 的 `AsyncOpenAI(api_key=..., timeout=20.0)`
  - [x] SubTask 42.2: `qwen_llm.py` 同样

- [x] Task 43: 修复腾讯云审核 BizType 与容错过宽
  - [x] SubTask 43.1: BizType 提取为环境变量 `TENCENT_MODERATION_BIZ_TYPE`，缺失时 WARNING
  - [x] SubTask 43.2: 区分异常类型，`AiAuthError` 不静默放行
  - [x] SubTask 43.3: 只有明确返回 `Suggestion=Pass/Review` 才返回 True

## 阶段三：P2 Medium - 一致性与边界修复（精选）

- [x] Task 44: 统一时区处理
  - [x] SubTask 44.1: record/family/gamification 的 `new Date().toISOString()` 改用本地日期生成工具
  - [x] SubTask 44.2: 抽取共享的 `todayStr()` 与 `currentMonthStr()` 工具函数

- [x] Task 45: 修复 weiji-ai 边界与契约问题
  - [x] SubTask 45.1: main.py `(baidu_result.get('confidence') or 0) >= 0.8`
  - [x] SubTask 45.2: openai_vision.py 将 `response.choices[0]` 纳入 try/except
  - [x] SubTask 45.3: ai_proxy.ts 扩展类型透传 recentRecords 与 style
  - [x] SubTask 45.4: voiceRecognize 重组响应保留 `data.message`

- [x] Task 46: 修复 family 一致性问题
  - [x] SubTask 46.1: listRecipes visibility=private 时强制 `authorId = userId`
  - [x] SubTask 46.2: generateShopping 去重 key 统一用 `name|unit`
  - [x] SubTask 46.3: getReport 改用 `userId IN (...) AND recordDate BETWEEN ... AND ...`

- [x] Task 47: 修复 user 模块 null 校验与密码哈希
  - [x] SubTask 47.1: UserInfoService.person null 校验
  - [x] SubTask 47.2: UserLoginService.refreshToken null 校验 + 抛 401
  - [x] SubTask 47.3: UserLoginService.password 改用 bcrypt
  - [x] SubTask 47.4: UserInfoService.logoff 递增 passwordV 并清除缓存
  - [x] SubTask 47.5: user 中间件 catch 加日志

- [x] Task 48: 修复 ai_proxy.forward 4xx 误标记 down
  - [x] SubTask 48.1: 区分 5xx/网络错误（标记 down）与 4xx（不标记）

- [x] Task 49: 修复前端管理与 APP 端空值保护
  - [x] SubTask 49.1: cool/utils/storage.ts isExpired `expiration === 0` 返回 false
  - [x] SubTask 49.2: cool/module/index.ts get 返回 `Module | undefined`

# Task Dependencies

- Task 4（统一 JWT payload）依赖 Task 3（user 模块登录 token id 修复），需先确保 token 正确签发
- Task 11（APP request.ts 修复）依赖 Task 4，认证逻辑统一后再修 APP 端
- Task 12（统一认证逻辑）依赖 Task 11
- Task 23（成就解锁接入）依赖 Task 19（achievement checkAndUnlock 加事务），先确保解锁逻辑本身正确
- Task 22（analytics 校验）依赖 Task 1（家庭权限模型修复），复用 membership 校验
- Task 36（captcha/doc 修复）可在 Task 12 后决定是补后端还是删前端
- 阶段二所有任务依赖阶段一完成（P0 优先）
- 阶段三任务可与阶段二并行，但建议在阶段二完成后进行以避免冲突

# 并行化建议

- 阶段一 P0 后端 Task 1-7 可并行（不同模块）
- 阶段一 P0 前端管理 Task 8-10 可并行
- 阶段一 P0 APP Task 11-14 可并行（Task 12 依赖 Task 11）
- 阶段一 P0 AI Task 15 独立
- 阶段二后端 Task 16-23 可并行（不同 service）
- 阶段二前端 Task 29-31 可并行
- 阶段二 APP Task 32-40 可并行
- 阶段二 AI Task 41-43 可并行
