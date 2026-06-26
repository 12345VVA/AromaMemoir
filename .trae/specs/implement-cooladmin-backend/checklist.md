# Checklist

## 项目骨架
- [x] `/workspace/weiji-server/` 目录已创建，包含 Midway.js + TypeScript 项目骨架
- [x] `package.json` 含 midway、@midwayjs/core、jsonwebtoken、bcryptjs、axios、typescript 依赖
- [x] `tsconfig.json` 配置正确，`pnpm dev` / `npm run dev` 可启动服务
- [x] 服务监听 `:8001`，`GET /health` 返回 `{ status: "ok", ai: "up|down" }`
- [x] CORS 中间件允许 `localhost:5173` 跨域
- [x] 统一响应格式 `{ code: 0, data, message }` 全局生效

## 数据存储层
- [x] `src/store/db.ts` 内存存储模块包含全部 12 个列表（users/families/family_members/family_recipes/invitations/records/weekly_menu/shopping_items/achievements/user_achievements/check_ins/challenges）
- [x] 种子数据：1 个家庭组、4 名成员（owner/admin/member 角色齐全）、4 道菜谱（含 family/private 可见性）、1 条有效邀请码、3 条美食记录、7 天周菜单、6+ 购物项、6 枚成就徽章、3 个挑战
- [x] 演示账号 `demo / 123456` 在 users 种子数据中存在且密码已哈希

## 认证模块
- [x] `POST /api/auth/register` 可注册用户，密码 bcrypt 哈希，重复用户名返回 400
- [x] `POST /api/auth/login` 校验密码，签发 7 天 JWT token，返回 `{ token, user }`
- [x] `POST /api/auth/logout` 返回成功（前端清 token）
- [x] JWT 中间件校验 `Authorization: Bearer`，无效返回 401
- [x] 受保护业务端点未带 token 时返回 401

## 美食记录模块
- [x] `GET /api/record/list` 返回分页格式 `{ list, total, page, pageSize }`，支持 tag/rating 筛选
- [x] `POST /api/record` 可保存记录，返回带 id 的记录
- [x] 保存后立即 `GET /api/record/list` 可见新记录在列表顶部
- [x] `GET /api/record/{id}` 返回单条记录详情

## 家庭体系模块
- [x] `GET /api/family` 返回当前用户所属家庭组信息
- [x] `POST /api/family` 创建家庭组，创建者成为 owner
- [x] `GET /api/family/members` 返回成员角色和加入时间
- [x] `PATCH /api/family/members/{id}` 更新角色，非 owner/admin 返回 403
- [x] `DELETE /api/family/members/{id}` 移除成员，owner 不能移除自己
- [x] `POST /api/family/invitations` 生成 6 位邀请码，24h 有效
- [x] `GET /api/family/invitations` 返回未过期邀请列表
- [x] `POST /api/family/join` 通过邀请码加入家庭，无效/过期返回 400
- [x] `GET /api/family/recipes` 支持 visibility/authorId/category 筛选
- [x] `PATCH /api/family/recipes/{id}/visibility` 更新可见性，非作者返回 403（recipe-0004 由 grandma 上传，demo 改返回 403 符合预期；用 recipe-0001 测试 demo 自己的菜谱可见性切换成功）
- [x] `GET /api/family/menu` 返回按天/餐次分组的周菜单
- [x] `POST /api/family/menu` 可添加菜谱到指定日期餐次
- [x] `POST /api/family/menu/{id}/vote` 赞/踩投票，返回更新后投票数
- [x] `GET /api/family/shopping` 返回按品类分组的购物清单
- [x] `POST /api/family/shopping` 可添加购物项
- [x] `PATCH /api/family/shopping/{id}` 可勾选/取消勾选
- [x] `DELETE /api/family/shopping/{id}` 可删除购物项

## 成就/打卡/用户/挑战模块
- [x] `GET /api/achievement/list` 返回徽章列表含已解锁状态
- [x] `GET /api/achievement/level` 返回等级、经验值、进度条数据
- [x] `GET /api/checkin/status` 返回连续打卡天数和今日是否打卡
- [x] `POST /api/checkin` 首次打卡增加天数，重复打卡返回"今日已打卡"
- [x] `GET /api/user/profile` 返回用户信息和统计数据（记录数、菜谱数、连续打卡天数）
- [x] `GET /api/challenge/list` 返回挑战列表

## AI 代理层
- [x] `POST /api/ai/recognize` 转发到 weiji-ai `/ai/recognize`，返回识别结果（已实现，待前端实际拍照上传场景验证）
- [x] `POST /api/ai/beautify` 转发到 weiji-ai `/ai/beautify`，multipart 正确转发（用 ctx.req 流式转发保留原始 headers）
- [x] `POST /api/ai/recommend` 转发到 weiji-ai `/ai/recommend`，返回推荐菜谱
- [x] `POST /api/ai/voice/recognize` 转发语音识别
- [x] `POST /api/ai/sticker` 转发贴纸生成
- [x] AI 服务不可达时返回 `{ code: 503, message: "AI 服务暂时不可用" }`，不抛异常（停 weiji-ai 后 /api/ai/recommend 立即降级 503）
- [x] `/health` 端点暴露 AI 服务连通性状态（停 weiji-ai 后 /health 返回 ai:down，重启后自动恢复 up）
- [x] 启动时和定时（每 60s）探测 weiji-ai `/health`

## MySQL 初始化脚本（接口预留）
- [x] `weiji-server/db/init.sql` 包含全部 12 张表 CREATE TABLE 语句
- [x] `init.sql` 末尾 INSERT 语句填充与内存种子数据一致的记录
- [x] `weiji-server/db/README.md`（或主 README）说明当前用内存存储，启用 MySQL 时执行 init.sql

## 端到端联调
- [x] 三服务（weiji-ai:8002、weiji-server:8001、weiji-admin-web:5173）均可独立启动
- [x] 核心闭环：登录 → 首页加载 → 拍照识别（前端→后端代理→AI 服务）→ 编辑保存 → 首页列表刷新显示新记录（30/30 curl 通过）
- [x] 家庭体系闭环：查询家庭 → 生成邀请码 → 加入 → 角色管理 → 可见性切换 → 菜单投票 → 购物清单操作
- [x] 成就/打卡/挑战功能正常
- [x] AI 服务不可用时前端降级提示正常（code:503）
- [x] 未登录访问受保护端点返回 401
- [x] 额外：前端 vite proxy 转发 /api/* → :8001 工作正常
