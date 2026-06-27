# Checklist

## F30 多人协同打通（P0）
- [x] 新增 GET /api/gamification/blindguess/rounds?familyId=xxx 列表端点
- [x] 列表端点 active 状态脱敏（不含 realAuthorId/realAuthorName）
- [x] 列表端点跨家庭隔离（仅返回当前用户所属 family 的轮次）
- [x] 前端 weiji-web 盲猜改为逐题猜测（每 item 提交 guessAuthorId + guessDishName）
- [x] 前端 weiji-admin-web 盲猜同步逐题猜测
- [x] guessAuthorId 不再传空字符串
- [x] 集成测试覆盖列表端点（active 脱敏、跨家庭隔离、空列表）
- [x] 集成测试补齐：非 creator 揭晓 403、揭晓后再猜测 400、家庭组不存在

## F28 分享卡片（P0）
- [x] buildPersonalityReport 填充 coverImage（非空，前端可渲染）
- [x] 前端 weiji-web renderPersonality 渲染分享卡片
- [x] 前端 weiji-admin-web Gameplay.vue 人格 Tab 渲染卡片
- [x] 系统分享面板（Web Share API + 文本兜底）
- [x] 单元测试覆盖 coverImage 生成

## 全玩法埋点体系（P0）
- [x] 新增 analytics.ts（trackEvent + 内存表 + 聚合查询）
- [x] 新增 AnalyticsEvent 类型
- [x] 新增 GET /api/analytics/events?type=xxx 查询端点
- [x] gamification.controller 6 端点埋点上报 + POST /api/analytics/track 供前端上报
- [x] 前端 weiji-web 关键交互点调用 trackEvent
- [x] 前端 weiji-admin-web 关键交互点调用 trackEvent
- [x] 集成测试覆盖埋点上报与查询

## F27 点亮动效与留存 CTA（P1）
- [x] 新点亮格子 CSS keyframes 动效
- [x] 记录成功联动点亮提示（Toast/弹窗）
- [x] 图鉴页"去记录解锁更多"CTA
- [x] 空状态引导文案可达（修复 app.js:1510 死代码）

## F29 节日家宴推送与分享（P1）
- [x] queryTimemachine 节日判定（春节/中秋/冬至等）
- [x] 节日家宴聚合分支
- [x] 回忆卡分享按钮（weiji-web + admin-web）
- [x] 单元测试覆盖节日分支

## 玩法间关联（P1）
- [x] 跨玩法跳转 CTA（图鉴→人格、人格→时光机、盲猜揭晓→图鉴）
- [x] F30 盲猜揭晓回写厨神徽章到 user_achievements
- [x] 新增盲猜相关徽章种子

## 激励持久化（P1）
- [x] 新增 user_personalities 表与类型
- [x] GET /personality 写入历史人格
- [x] F30 厨神称号写入成就系统
- [x] 单元测试覆盖人格持久化

## 测试与验证
- [x] 后端全量测试通过（原有 123 + 新增 19 = 142 全绿）
- [x] 前端构建通过（admin-web vite build 成功）
- [x] 前端测试通过（admin-web 25 测试绿；weiji-web 语法检查通过）
- [x] 端到端验证四玩法闭环（38/38 核查点通过）

## Git 流程
- [x] 功能分支 fix/gamification-playability 提交所有修复（commit 2ca257b，39 文件 +1639/-139）
- [x] git merge --no-ff 合并到 main（merge commit a62b1c8，42 文件 +1774/-139，无冲突）
- [x] git push origin main 推送成功（35d6ff1..a62b1c8）
- [x] 推送后远程 main 与本地一致（origin/main = a62b1c8）
