# Tasks

- [x] Task 1: 初始化 cool-admin 后端项目（weiji-server）
  - [x] SubTask 1.1: 使用 cool-admin Midway 版脚手架初始化项目到 `/workspace/weiji-server/`，配置 TypeScript + MySQL + Redis
  - [x] SubTask 1.2: 配置统一响应拦截器，输出 `{ code, data, message }` 格式
  - [x] SubTask 1.3: 配置 CORS 中间件，允许前端开发端口跨域
  - [x] SubTask 1.4: 创建 MySQL 初始化 SQL 脚本，包含 users、families、family_members、family_recipes、invitations、records、achievements、weekly_menu、shopping_items、challenges 表结构 + 种子数据

- [x] Task 2: 迁移用户认证模块到 cool-admin
  - [x] SubTask 2.1: 实现 `POST /api/auth/register` — 用户注册（用户名+密码，密码哈希存储）
  - [x] SubTask 2.2: 实现 `POST /api/auth/login` — 登录校验，签发 JWT token，返回用户信息
  - [x] SubTask 2.3: 实现 `POST /api/auth/logout` — 登出（token 黑名单或前端清除）
  - [x] SubTask 2.4: 实现 JWT 认证中间件，校验 Authorization: Bearer token

- [x] Task 3: 迁移美食记录模块到 cool-admin
  - [x] SubTask 3.1: 实现 `GET /api/record/list` — 支持 tag/rating 筛选 + 分页
  - [x] SubTask 3.2: 实现 `POST /api/record` — 保存美食记录
  - [x] SubTask 3.3: 实现 `GET /api/record/{id}` — 查询单条记录

- [x] Task 4: 迁移家庭体系模块到 cool-admin
  - [x] SubTask 4.1: 实现 `GET /api/family`、`POST /api/family` — 家庭组查询和创建
  - [x] SubTask 4.2: 实现 `GET /api/family/members`、`PATCH /api/family/members/{id}`、`DELETE /api/family/members/{id}` — 成员管理（含角色权限校验）
  - [x] SubTask 4.3: 实现 `POST /api/family/invitations`、`GET /api/family/invitations`、`POST /api/family/join` — 邀请码生成、查询、加入家庭
  - [x] SubTask 4.4: 实现 `GET /api/family/recipes`（支持 visibility/authorId/category 筛选）、`PATCH /api/family/recipes/{id}/visibility` — 菜谱可见性
  - [x] SubTask 4.5: 实现 `GET/POST /api/family/menu`、`POST /api/family/menu/{id}/vote` — 协作菜单
  - [x] SubTask 4.6: 实现 `GET/POST /api/family/shopping`、`PATCH/DELETE /api/family/shopping/{id}` — 购物清单

- [x] Task 5: 迁移成就/打卡/用户/挑战模块到 cool-admin
  - [x] SubTask 5.1: 实现 `GET /api/achievement/list`、`GET /api/achievement/level` — 成就徽章和等级
  - [x] SubTask 5.2: 实现 `GET /api/checkin/status`、`POST /api/checkin` — 打卡状态和打卡（含重复打卡校验）
  - [x] SubTask 5.3: 实现 `GET /api/user/profile` — 用户信息和统计数据
  - [x] SubTask 5.4: 实现 `GET /api/challenge/list` — 挑战列表

- [x] Task 6: 实现 AI 代理层（cool-admin 后端）
  - [x] SubTask 6.1: 创建 AI 代理 service，封装对 Python AI 服务的 HTTP 调用（含超时和错误降级）
  - [x] SubTask 6.2: 实现 `POST /api/ai/recognize` — 代理转发图片识别请求
  - [x] SubTask 6.3: 实现 `POST /api/ai/beautify` — 代理转发图片美化请求
  - [x] SubTask 6.4: 实现 `POST /api/ai/recommend` — 代理转发菜谱推荐请求
  - [x] SubTask 6.5: 实现 `POST /api/ai/voice/recognize`、`POST /api/ai/sticker` — 代理转发语音识别和贴纸生成
  - [x] SubTask 6.6: 实现 AI 服务健康检查（启动时和定时探测 `/health`）

- [x] Task 7: 重构 Python AI 服务（weiji-ai）
  - [x] SubTask 7.1: 移除所有业务端点（auth/record/family/achievement/checkin/user/challenge）和对应内存数据
  - [x] SubTask 7.2: 移除静态文件挂载（StaticFiles）和前端文件服务
  - [x] SubTask 7.3: 将 AI 端点路径从 `/api/ai/*` 调整为 `/ai/*`（去除 `/api` 前缀，由 cool-admin 代理层补全）
  - [x] SubTask 7.4: 保留 `/health` 端点，新增 `/ai/recognize`、`/ai/beautify`、`/ai/recommend`、`/ai/voice/recognize`、`/ai/sticker` 端点
  - [x] SubTask 7.5: 更新 requirements.txt，移除不再需要的依赖（如 python-multipart 静态服务相关）

- [x] Task 8: 初始化 cool-admin 前端项目（weiji-admin-web）
  - [x] SubTask 8.1: 使用 cool-admin Vue3 脚手架初始化项目到 `/workspace/weiji-admin-web/`，配置 Vite + Element Plus + Vue Router + Pinia
  - [x] SubTask 8.2: 封装 axios 实例，配置 baseURL（cool-admin 后端地址）、JWT token 拦截器、统一错误处理
  - [x] SubTask 8.3: 实现登录页（登录/注册模式切换），未登录跳转登录页

- [x] Task 9: 迁移前端页面到 cool-admin Vue3
  - [x] SubTask 9.1: 实现首页（美食日记列表 + 打卡日历 + 推荐区域），保持与设计稿一致的视觉
  - [x] SubTask 9.2: 实现 AI 记录页（拍照 → 识别 → 美化预览 → 营养展示 → 保存）
  - [x] SubTask 9.3: 实现家庭菜谱页（菜谱网格 + 成员栏 + 角色标签 + 邀请弹窗 + 可见性切换 + 协作菜单 + 购物清单）
  - [x] SubTask 9.4: 实现成就页（等级 + 徽章 + 挑战）
  - [x] SubTask 9.5: 实现个人中心（用户信息 + 统计数据 + 退出登录）
  - [x] SubTask 9.6: 实现移动端/桌面端多端适配

- [x] Task 10: 联调验证
  - [x] SubTask 10.1: 启动三服务（Python AI 服务、cool-admin 后端、cool-admin 前端），确认各自可访问
  - [x] SubTask 10.2: 验证核心闭环：登录 → 首页加载 → 拍照识别（经后端代理到 AI 服务）→ 保存记录 → 首页列表刷新
  - [x] SubTask 10.3: 验证家庭体系：查询家庭 → 生成邀请码 → 加入家庭 → 成员角色管理 → 菜谱可见性切换
  - [x] SubTask 10.4: 验证协作菜单和购物清单 CRUD
  - [x] SubTask 10.5: 验证成就/打卡/挑战功能
  - [x] SubTask 10.6: 验证多端适配和错误降级（AI 服务不可用时前端提示）

# Task Dependencies
- Task 2/3/4/5 依赖 Task 1（业务端点需要项目骨架和数据库）
- Task 6 依赖 Task 1（AI 代理层需要项目骨架）
- Task 7 可独立先行（重构 Python AI 服务不依赖 cool-admin）
- Task 8 依赖 Task 1（前端需要后端 API 契约）
- Task 9 依赖 Task 2 + Task 3 + Task 4 + Task 5 + Task 6 + Task 8（页面需要全部后端端点和前端骨架）
- Task 10 依赖 Task 7 + Task 9（联调需要三服务就绪）
- Task 1 和 Task 7 可并行
