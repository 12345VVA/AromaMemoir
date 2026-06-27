# Checklist

## AchievementService 实现
- [x] AchievementService 文件已创建
- [x] 解锁逻辑幂等
- [x] 盲猜厨神成就定义已加入 db.ts
- [x] AchievementType 扩展 'gameplay'

## 成就自动解锁集成
- [ ] record.controller.ts POST 后调用 AchievementService
- [ ] checkin.controller.ts POST 后调用 AchievementService
- [ ] family.controller.ts POST 后调用 AchievementService
- [ ] gamification.controller.ts 揭晓后调用 AchievementService

## 记录 CRUD 补全
- [ ] PATCH /api/record/:id 已实现
- [ ] DELETE /api/record/:id 已实现
- [ ] 权限校验（仅作者可改/删）
- [ ] 404 处理

## 前端 API 客户端
- [ ] weiji-web/api.js 新增方法
- [ ] weiji-admin-web client.ts 新增方法

## 测试覆盖
- [ ] 单元测试 achievement.service.test.ts
- [ ] 集成测试 record.test.ts 追加
- [ ] 集成测试 achievement.test.ts 追加
- [ ] npm test 全部通过

## 前端构建
- [ ] npm run build 通过
- [ ] npm run test 通过

## Git 发布
- [ ] feature 分支提交完整
- [ ] merge --no-ff 合并到 main
- [ ] push origin main 成功
