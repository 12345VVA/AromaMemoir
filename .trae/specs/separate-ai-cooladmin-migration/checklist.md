# Checklist

## cool-admin 后端项目
- [x] `/workspace/weiji-server/` 目录已创建，包含 cool-admin Midway 版项目骨架
- [x] 配置 TypeScript + MySQL + Redis 连接
- [x] 统一响应拦截器输出 `{ code, data, message }` 格式
- [x] CORS 中间件允许前端开发端口跨域
- [x] MySQL 初始化 SQL 脚本包含全部表结构（users、families、family_members、family_recipes、invitations、records、achievements、weekly_menu、shopping_items、challenges）
- [x] 种子数据与现有内存数据一致（4 名成员、4 道菜谱、3 条记录、6 枚徽章等）

## 用户认证模块
- [x] `POST /api/auth/register` 可注册用户，密码哈希存储
- [x] `POST /api/auth/login` 校验账号密码，签发 JWT token
- [x] `POST /api/auth/logout` 登出可用
- [x] JWT 中间件校验 Authorization: Bearer token

## 美食记录模块
- [x] `GET /api/record/list` 支持 tag/rating 筛选 + 分页
- [x] `POST /api/record` 可保存记录，后续查询可查到
- [x] `GET /api/record/{id}` 返回单条记录

## 家庭体系模块
- [x] `GET /api/family` 返回家庭组信息（含成员数）
- [x] `POST /api/family` 创建家庭组，创建者成为 owner
- [x] `GET /api/family/members` 返回成员角色和加入时间
- [x] `PATCH /api/family/members/{id}` 更新角色，非 owner/admin 返回 403
- [x] `DELETE /api/family/members/{id}` 移除成员，owner 不能移除自己
- [x] `POST /api/family/invitations` 生成 6 位邀请码，24h 有效
- [x] `GET /api/family/invitations` 返回未过期邀请列表
- [x] `POST /api/family/join` 通过邀请码加入，无效/过期返回 400
- [x] `GET /api/family/recipes` 支持 visibility/authorId/category 筛选
- [x] `PATCH /api/family/recipes/{id}/visibility` 更新可见性，非作者返回 403
- [x] `GET/POST /api/family/menu` 协作菜单可用
- [x] `POST /api/family/menu/{id}/vote` 投票可用
- [x] `GET/POST /api/family/shopping` 购物清单可用
- [x] `PATCH/DELETE /api/family/shopping/{id}` 勾选和删除可用

## 成就/打卡/用户/挑战模块
- [x] `GET /api/achievement/list` 返回徽章列表
- [x] `GET /api/achievement/level` 返回等级和经验值
- [x] `GET /api/checkin/status` 返回连续打卡天数
- [x] `POST /api/checkin` 打卡成功，重复打卡返回提示
- [x] `GET /api/user/profile` 返回用户信息和统计数据
- [x] `GET /api/challenge/list` 返回挑战列表

## AI 代理层
- [x] AI 代理 service 封装对 Python AI 服务的 HTTP 调用
- [x] `POST /api/ai/recognize` 代理转发图片识别
- [x] `POST /api/ai/beautify` 代理转发图片美化
- [x] `POST /api/ai/recommend` 代理转发菜谱推荐
- [x] `POST /api/ai/voice/recognize` 代理转发语音识别
- [x] `POST /api/ai/sticker` 代理转发贴纸生成
- [x] AI 服务健康检查（启动时和定时探测）
- [x] AI 服务不可用时前端降级提示

## Python AI 服务重构
- [x] 移除所有业务端点（auth/record/family/achievement/checkin/user/challenge）
- [x] 移除静态文件挂载和前端文件服务
- [x] AI 端点路径调整为 `/ai/*`（去除 `/api` 前缀）
- [x] 保留 `/health` 端点
- [x] requirements.txt 已清理不再需要的依赖

## cool-admin 前端项目
- [x] `/workspace/weiji-admin-web/` 目录已创建，包含 cool-admin Vue3 项目骨架
- [x] 配置 Vite + Element Plus + Vue Router + Pinia
- [x] axios 实例配置 baseURL 和 JWT token 拦截器
- [x] 登录页支持登录/注册模式切换
- [x] 未登录自动跳转登录页

## 前端页面迁移
- [x] 首页：美食日记列表 + 打卡日历 + 推荐区域
- [x] AI 记录页：拍照 → 识别 → 美化预览 → 营养展示 → 保存
- [x] 家庭菜谱页：菜谱网格 + 成员栏 + 角色标签 + 邀请弹窗 + 可见性切换 + 协作菜单 + 购物清单
- [x] 成就页：等级 + 徽章 + 挑战
- [x] 个人中心：用户信息 + 统计数据 + 退出登录
- [x] 移动端/桌面端多端适配正常

## 联调验证
- [x] 三服务（Python AI、cool-admin 后端、cool-admin 前端）均可独立启动
- [x] 核心闭环：登录 → 首页 → 拍照识别（经代理）→ 保存 → 列表刷新
- [x] 家庭体系闭环：查询家庭 → 生成邀请码 → 加入 → 角色管理 → 可见性切换
- [x] 协作菜单和购物清单 CRUD 正常
- [x] 成就/打卡/挑战功能正常
- [x] AI 服务不可用时前端降级提示正常
