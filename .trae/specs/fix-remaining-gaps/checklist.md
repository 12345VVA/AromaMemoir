# Checklist

- [x] `weiji-app/utils/api.ts` AI 方法区有块注释标记"所有 AI 请求必须经由后端代理"
- [x] `weiji-server/src/modules/challenge/entity/user_challenge.ts` 已创建，包含 userId/challengeId/progress/completed 字段
- [x] `ChallengeService.join()` 实现参与逻辑，校验 isActive 和重复参与
- [x] `ChallengeService.getProgress()` 返回用户所有参与记录及进度
- [x] `ChallengeService.checkAndComplete()` 实现进度更新和完成判定
- [x] `POST /app/challenge/:id/join` 端点可访问，返回 code=1000
- [x] `GET /app/challenge/progress` 端点可访问，返回 code=1000
- [x] record service 的 save 方法调用 challengeService.checkAndComplete
- [x] checkin service 的打卡方法调用 challengeService.checkAndComplete
- [x] `weiji-app/pages/record/detail.vue` 已创建，展示记录完整信息
- [x] `pages.json` 已注册 `pages/record/detail` 路由
- [x] `home.vue` 记录卡片点击跳转到 `/pages/record/detail?id=xxx`
- [x] `gamification/index.vue` 创建轮次时自动填充 familyId
- [x] `gamification/index.vue` 记录选择改为从家庭动态列表多选
- [x] `gamification/index.vue` 移除手动输入 familyId 和 recordIdsStr 的 input 框
- [x] `achievement/index.vue` 挑战列表有参与/进行中/已完成按钮
- [x] `achievement/index.vue` 页面加载时调用 getChallengeProgress 合并进度
- [x] `api.ts` 新增 joinChallenge 和 getChallengeProgress 方法