# Checklist

## AchievementService 实现
- [x] AchievementService 文件已创建
- [x] 解锁逻辑幂等
- [x] 盲猜厨神成就定义已加入 db.ts
- [x] AchievementType 扩展 'gameplay'

## 成就自动解锁集成
- [x] record.controller.ts POST 后调用 AchievementService
- [x] checkin.controller.ts POST 后调用 AchievementService
- [x] family.controller.ts POST 后调用 AchievementService
- [x] gamification.controller.ts 揭晓后调用 AchievementService

## 记录 CRUD 补全
- [x] PATCH /api/record/:id 已实现
- [x] DELETE /api/record/:id 已实现
- [x] 权限校验（仅作者可改/删）
- [x] 404 处理

## 前端 API 客户端
- [x] weiji-web/api.js 新增方法
- [x] weiji-admin-web client.ts 新增方法

## 测试覆盖
- [x] 单元测试 achievement.service.test.ts
- [x] 集成测试 record.test.ts 追加
- [x] 集成测试 achievement.test.ts 追加
- [x] npm test 全部通过（76 单元 + 65 集成 = 141 测试）

## 前端构建
- [x] npm run build 通过
- [x] npm run test 通过（25 测试）

## Git 发布
- [x] feature 分支提交完整
- [x] merge --no-ff 合并到 main
- [x] push origin main 成功（5450764..b43cd7e）
