# Tasks

- [x] Task 1: 初始化 weiji-server Midway.js 项目骨架
  - [x] SubTask 1.1: 创建 `/workspace/weiji-server/` 目录，初始化 `package.json`（midway + @midwayjs/http-proxy 或 koa 依赖、typescript、jsonwebtoken、bcryptjs、axios）
  - [x] SubTask 1.2: 编写 `tsconfig.json` + `src/configuration.ts` + `src/app.ts`，配置 Midway 启动、监听 `:8001`、CORS 中间件
  - [x] SubTask 1.3: 实现统一响应工具 `src/common/response.ts`（ok/fail 辅助函数 + 全局异常过滤器，输出 `{ code, data, message }`）
  - [x] SubTask 1.4: 实现 `GET /health` 端点，返回 `{ status: "ok" }`
  - 实现说明：采用 koa + 装饰器风格 controller 简化方案（spec 允许的降级路径），装饰器 API（@Controller/@Get/@Post）与 Midway 一致，后续可零成本迁移到完整 Midway Bootstrap

- [x] Task 2: 实现内存数据存储层与种子数据
  - [x] SubTask 2.1: 创建 `src/store/db.ts` 内存存储模块，定义 `users / families / family_members / family_recipes / invitations / records / weekly_menu / shopping_items / achievements / user_achievements / check_ins / challenges` 列表
  - [x] SubTask 2.2: 预填充种子数据：1 个家庭组（王家厨房）、4 名成员（含 owner/admin/member 角色分布）、4 道菜谱（含 visibility family/private）、1 条有效邀请码、3 条美食记录、7 天周菜单、6+ 购物项、6 枚成就徽章、3 个挑战
  - [x] SubTask 2.3: 提供简单的查询/插入/更新/删除辅助方法（按 id 查找、按条件过滤、软删除 isDeleted 标记）

- [x] Task 3: 实现用户认证模块
  - [x] SubTask 3.1: 创建 `src/service/auth.service.ts`，实现 register（密码 bcrypt 哈希、用户名唯一校验）、login（校验密码、签发 7 天 JWT）、logout（前端清 token 即可，后端空实现）
  - [x] SubTask 3.2: 创建 `src/middleware/jwt.middleware.ts`，校验 `Authorization: Bearer`，失败返回 401
  - [x] SubTask 3.3: 创建 `src/controller/auth.controller.ts`，暴露 `POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`
  - [x] SubTask 3.4: 提供演示账号 `demo / 123456`（种子数据预置，Task 2 已落库，验证全部通过：登录/注册/重复校验/401 拦截/带 token 通过）

- [x] Task 4: 实现美食记录模块
  - [x] SubTask 4.1: 创建 `src/controller/record.controller.ts`，实现 `GET /api/record/list`（支持 tag/rating/page/pageSize 筛选分页）、`POST /api/record`（保存记录，返回带 id 的记录）、`GET /api/record/{id}`
  - [x] SubTask 4.2: 保存记录后自动置于列表顶部，支持后续列表查询可见
  - 实现说明：路径装饰器由 `@Post('/')` 修正为 `@Post('')`（避免 @koa/router 注册为 `/api/record/` 与前端 `/api/record` 不匹配）

- [x] Task 5: 实现家庭组体系模块
  - [x] SubTask 5.1: 实现 `GET /api/family`（返回当前用户所属家庭组）、`POST /api/family`（创建家庭组，创建者成为 owner）
  - [x] SubTask 5.2: 实现 `GET /api/family/members`（返回成员角色和加入时间）、`PATCH /api/family/members/{id}`（更新角色，仅 owner/admin）、`DELETE /api/family/members/{id}`（移除成员，仅 owner，不能移除自己）
  - [x] SubTask 5.3: 实现 `POST /api/family/invitations`（生成 6 位邀请码、24h 有效）、`GET /api/family/invitations`（返回未过期邀请）、`POST /api/family/join`（校验邀请码加入）
  - [x] SubTask 5.4: 实现 `GET /api/family/recipes`（支持 visibility/authorId/category 筛选）、`PATCH /api/family/recipes/{id}/visibility`（仅作者可改）
  - [x] SubTask 5.5: 实现 `GET /api/family/menu`（按天/餐次分组）、`POST /api/family/menu`（添加到指定日期餐次）、`POST /api/family/menu/{id}/vote`（赞/踩投票）
  - [x] SubTask 5.6: 实现 `GET /api/family/shopping`（按品类分组）、`POST /api/family/shopping`（添加项）、`PATCH /api/family/shopping/{id}`（勾选/取消）、`DELETE /api/family/shopping/{id}`（删除）

- [x] Task 6: 实现成就/打卡/用户/挑战模块
  - [x] SubTask 6.1: 实现 `GET /api/achievement/list`（返回徽章列表含已解锁状态）、`GET /api/achievement/level`（返回等级、经验值、进度条数据）
  - [x] SubTask 6.2: 实现 `GET /api/checkin/status`（返回连续打卡天数和今日是否打卡）、`POST /api/checkin`（首次打卡增加天数，重复打卡返回提示）
  - [x] SubTask 6.3: 实现 `GET /api/user/profile`（返回用户信息 + 统计数据：记录数、菜谱数、连续打卡天数）
  - [x] SubTask 6.4: 实现 `GET /api/challenge/list`（返回挑战列表）
  - 实现说明：Task 6 sub-agent 漏写 `@Controller(prefix)` 类装饰器（仅 import 未应用），导致 4 个控制器路由前缀丢失，已修复（在 AchievementController/CheckinController/UserController/ChallengeController 类上加 `@Controller('/api/...')`）；checkin POST 路径由 `@Post('/')` 修正为 `@Post('')`

- [x] Task 7: 实现 AI 代理层
  - [x] SubTask 7.1: 创建 `src/service/ai-proxy.service.ts`，封装 axios 调用 weiji-ai（`http://localhost:8002`），超时 30s
  - [x] SubTask 7.2: 创建 `src/controller/ai.controller.ts`，实现 `POST /api/ai/recognize`、`POST /api/ai/beautify`（multipart 转发）、`POST /api/ai/recommend`、`POST /api/ai/voice/recognize`、`POST /api/ai/sticker`
  - [x] SubTask 7.3: AI 服务不可达或返回错误时降级返回 `{ code: 503, message: "AI 服务暂时不可用，请稍后重试" }`
  - [x] SubTask 7.4: 启动时和定时（每 60s）调用 weiji-ai `/health`，更新内部连通性状态供 `/health` 端点暴露

- [x] Task 8: 编写 MySQL 初始化 SQL 脚本（接口预留）
  - [x] SubTask 8.1: 创建 `weiji-server/db/init.sql`，包含 users、families、family_members、family_recipes、invitations、records、weekly_menu、shopping_items、achievements、user_achievements、check_ins、challenges 表结构（与内存种子数据字段对齐）
  - [x] SubTask 8.2: 在 `init.sql` 末尾填充与内存种子数据一致的 INSERT 语句
  - [x] SubTask 8.3: 在 `weiji-server/README.md`（或 db/README.md）简要说明：当前实现用内存存储，启用 MySQL 时执行 init.sql 并切换 store 实现（本 spec 不强制落地）

- [x] Task 9: 端到端联调验证
  - [x] SubTask 9.1: 启动三服务（weiji-ai:8002、weiji-server:8001、weiji-admin-web:5173），各自可访问
  - [x] SubTask 9.2: 验证核心闭环：登录（demo/123456）→ 首页加载美食日记 → AI 记录页拍照识别（前端→后端代理→AI 服务返回）→ 编辑保存 → 首页列表刷新显示新记录（30/30 curl 测试通过）
  - [x] SubTask 9.3: 验证家庭体系：查询家庭 → 生成邀请码 → 加入家庭 → 成员角色更新 → 菜谱可见性切换 → 协作菜单查看/投票 → 购物清单勾选/添加/删除
  - [x] SubTask 9.4: 验证成就/打卡/用户/挑战功能正常
  - [x] SubTask 9.5: 验证 AI 服务不可用时（停 weiji-ai）前端降级提示正常（/api/ai/recommend 返回 code:503）
  - [x] SubTask 9.6: 验证未登录访问受保护端点返回 401
  - 额外验证：前端 vite proxy 转发 /api/* → :8001 工作正常；weiji-ai 重启后 weiji-server /health 的 ai 状态由 down 自动恢复为 up

# Task Dependencies
- Task 2 依赖 Task 1（存储层需要项目骨架）
- Task 3 依赖 Task 2（认证需要 users 存储）
- Task 4/5/6 依赖 Task 3（业务端点需要 JWT 中间件）
- Task 7 依赖 Task 1（AI 代理层需要项目骨架），可与 Task 2-6 并行
- Task 8 可独立先行（纯文档产出）
- Task 9 依赖 Task 1-7（联调需要全部端点就绪）
