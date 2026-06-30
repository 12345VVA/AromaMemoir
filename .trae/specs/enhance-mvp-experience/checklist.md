# Checklist

- [x] 后端 `GET /api/family/records` 返回家庭成员饮食记录，含作者昵称/头像
- [x] 每条家庭记录包含 likeCount、commentCount、likedByMe 字段
- [x] 后端 `POST /api/family/records/:id/like` 支持点赞/取消点赞（toggle）
- [x] 后端 `POST /api/family/records/:id/comments` 支持添加评论
- [x] 前端 api.js 包含 getFamilyRecords、toggleRecordLike、addRecordComment 方法
- [x] 家庭菜谱页有"家庭动态"Tab，点击切换展示
- [x] 家庭动态卡片显示头像/菜名/图片/评分/时间/点赞数/评论数
- [x] 点赞按钮可切换状态，点赞数实时更新
- [x] 评论输入框可提交评论，评论列表展示
- [x] 前端 compressImage 函数能将 >2MB 图片压缩至 ≤2MB
- [x] 上传识别流程使用压缩后的图片
- [x] 首页美食日记区域有"列表/日历"切换按钮
- [x] 日历视图以月历展示，有记录的日期有标记
- [x] 点击日历某日展示当日记录列表
- [x] 日历支持月份前后切换
- [x] AI识别 confidence < 0.5 时显示"这可能不是食物"警告
- [x] 首页推荐API调用时附带 recentRecords 参数
- [x] 全部修改在移动端和桌面端布局正常
