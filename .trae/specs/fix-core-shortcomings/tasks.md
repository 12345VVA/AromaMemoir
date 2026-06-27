# Tasks

- [x] Task 1: 创建功能分支并新增 AchievementService
  - [x] SubTask 1.1: 基于 main 创建并切换到 `feature/fix-core-shortcomings` 分支
  - [x] SubTask 1.2: 新建 `src/service/achievement.service.ts`
  - [x] SubTask 1.3: db.ts + types.ts 扩展 gameplay 类型与盲猜厨神成就

- [ ] Task 2: 集成成就自动解锁到核心写操作
  - [ ] SubTask 2.1: record.controller.ts POST 创建记录后调用 AchievementService
  - [ ] SubTask 2.2: checkin.controller.ts POST 打卡后调用 AchievementService
  - [ ] SubTask 2.3: family.controller.ts POST 创建家庭组后调用 AchievementService
  - [ ] SubTask 2.4: gamification.controller.ts 揭晓盲猜后对厨神调用 AchievementService

- [ ] Task 3: 补全记录 CRUD（Update + Delete）
  - [ ] SubTask 3.1: record.controller.ts 新增 PATCH /:id
  - [ ] SubTask 3.2: record.controller.ts 新增 DELETE /:id
  - [ ] SubTask 3.3: 确认装饰器已导出

- [ ] Task 4: 更新前端 API 客户端
  - [ ] SubTask 4.1: weiji-web/api.js 新增 updateRecord / deleteRecord
  - [ ] SubTask 4.2: weiji-admin-web client.ts 新增 updateRecord / deleteRecord

- [ ] Task 5: 后端单元测试
  - [ ] SubTask 5.1: achievement.service.test.ts
  - [ ] SubTask 5.2: npm test 通过

- [ ] Task 6: 后端集成测试
  - [ ] SubTask 6.1: record.test.ts 追加 PATCH/DELETE 用例
  - [ ] SubTask 6.2: achievement.test.ts 追加自动解锁用例
  - [ ] SubTask 6.3: npm test 全部通过

- [ ] Task 7: 前端构建验证
  - [ ] SubTask 7.1: npm run build 通过
  - [ ] SubTask 7.2: npm run test 通过

- [ ] Task 8: 合并到 main 并推送
  - [ ] SubTask 8.1: 提交代码
  - [ ] SubTask 8.2: git merge --no-ff
  - [ ] SubTask 8.3: git push origin main
