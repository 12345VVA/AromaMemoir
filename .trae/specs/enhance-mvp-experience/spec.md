# MVP 体验增强与剩余偏差修复 Spec

## Why
PRD v1.1 偏差分析中，前一阶段修复了MVP闭环断裂和成就/打卡等6项严重问题。本次聚焦剩余的高优先级偏差：F16家庭饮食记录互可见（P0完全未实现）、F1图片压缩缺失、F3无日历视图、F9推荐未传历史偏好、F7无低置信度提示。这些是影响核心用户体验的关键缺口。

## What Changes
- 后端新增 `GET /api/family/records` 家庭维度记录查询端点 + 前端家庭动态feed
- 后端新增 `POST /api/family/records/:id/like` 点赞端点 + `POST /api/family/records/:id/comments` 评论端点
- 前端新增图片压缩（客户端 Canvas 压缩至 ≤2MB）
- 前端首页新增日历/列表视图切换
- 前端 AI 识别后置信度 <50% 时提示"这可能不是食物"
- 前端菜谱推荐调用时传入 recentRecords（近5条记录菜名）

## Impact
- Affected specs: fix-mvp-gap-closure（已完成）, mvp-feature-completion（已完成）
- Affected code:
  - [family.controller.ts](file:///workspace/weiji-server/src/controller/family.controller.ts) — 新增家庭记录/点赞/评论端点
  - [types.ts](file:///workspace/weiji-server/src/store/types.ts) — 新增 Like/Comment 类型
  - [db.ts](file:///workspace/weiji-server/src/store/db.ts) — 新增 record_likes/record_comments 数组
  - [api.js](file:///workspace/weiji-web/api.js) — 新增家庭记录/点赞/评论方法
  - [app.js](file:///workspace/weiji-web/app.js) — 图片压缩、日历视图、置信度提示、推荐历史偏好
  - [index.html](file:///workspace/weiji-web/index.html) — 家庭动态tab、日历视图容器

## ADDED Requirements

### Requirement: 家庭饮食记录互可见（F16）
系统 SHALL 提供家庭动态页面，展示家庭成员的全部饮食记录，支持点赞和评论互动。

#### Scenario: 查看家庭动态
- **WHEN** 用户进入家庭菜谱页并切换到"家庭动态"Tab
- **THEN** 展示家庭成员最近的饮食记录（按时间倒序），每条显示作者头像、菜名、图片、评分、时间

#### Scenario: 点赞记录
- **WHEN** 用户点击某条家庭动态的"点赞"按钮
- **THEN** 点赞数+1，按钮变为已点赞状态；再次点击取消点赞

#### Scenario: 评论记录
- **WHEN** 用户在某条动态下输入评论并提交
- **THEN** 评论出现在该记录下方，显示评论人和内容

### Requirement: 客户端图片压缩（F1增强）
系统 SHALL 在用户选择照片后、上传前，自动将图片压缩至 ≤2MB。

#### Scenario: 大图压缩
- **WHEN** 用户选择一张 >2MB 的照片
- **THEN** 通过 Canvas 自动压缩至 ≤2MB，压缩后预览展示
- **WHEN** 图片本身就是 ≤2MB
- **THEN** 直接使用原图，不压缩

### Requirement: 日历视图（F3增强）
系统 SHALL 在首页美食日记区域支持列表/日历视图切换。

#### Scenario: 切换到日历视图
- **WHEN** 用户点击"日历"视图按钮
- **THEN** 以月历形式展示当月有记录的日期（标记圆点），点击某日展示当日记录列表

#### Scenario: 切换回列表视图
- **WHEN** 用户点击"列表"按钮
- **THEN** 恢复原有时间轴列表展示

### Requirement: AI低置信度提示（F7增强）
系统 SHALL 在AI识别返回置信度 <50% 时，提示用户"这可能不是食物"。

#### Scenario: 低置信度识别
- **WHEN** AI识别返回 confidence < 0.5
- **THEN** 在识别结果上方显示警告提示"这可能不是食物，请确认或手动输入菜名"

### Requirement: 推荐历史偏好传递（F9增强）
系统 SHALL 在调用菜谱推荐时，传入用户最近的记录菜品名称，以实现个性化推荐。

#### Scenario: 带历史偏好推荐
- **WHEN** 用户进入首页，加载推荐数据
- **THEN** 调用推荐API时附带 recentRecords（最近5条记录的菜名数组）

## MODIFIED Requirements

### Requirement: 家庭菜谱页Tab结构
家庭菜谱页 SHALL 在原有"菜谱"/"本周菜单"Tab基础上，新增"家庭动态"Tab。

#### Scenario: 三Tab切换
- **WHEN** 用户进入家庭菜谱页
- **THEN** 顶部显示三个Tab：菜谱、本周菜单、家庭动态
