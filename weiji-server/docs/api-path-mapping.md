# 味记 · API 路径映射表

> **契约文档 · Phase 0 交付物**
> 适用范围：weiji-server（cool-admin-midway）→ weiji-admin-web（Phase 2）/ weiji-app（Phase 3）
> 日期：2026-07-01
> 依据：[架构设计与迁移方案.md](../../架构设计与迁移方案.md) §3.3（API 分层）、§5.2（模块划分）、§8.5（API 路径契约变更）、§9.2（端点迁移映射）

---

## 1. 概述

本文档是味记（AromaMemoir）从自研 `weiji-server`（Koa + 装饰器）迁移到 cool-admin-midway 脚手架过程中的 **API 路径契约**。现有 11 个控制器、共 **55 个端点**全部统一挂在 `/api/*` 前缀下（仅 `/health` 例外），未做 B/C 端分层。迁移到 cool-admin 后，按官方约定天然拆分为三层路由前缀：`/admin/*`（B 端后台管理，cl-crud 自动生成）、`/app/*`（C 端 App 用户业务）、`/open/*`（公开接口）。这是一次**破坏性变更**：所有前端（admin-web、app）的请求路径都需按本表同步修改。本文档即 Phase 2（admin-web）与 Phase 3（app）落地时唯一遵循的路径契约，对应架构文档 §8.5。

> 端点统计：health 1 + auth 3 + record 3 + family 26 + achievement 2 + checkin 3 + user 2 + challenge 1 + gamification 7 + ai 5 + analytics 2 = **55 个 weiji-server 端点**。架构文档 §9.2 预估的「70+」含 weiji-ai（FastAPI）侧 6 个端点及规划中的扩展端点；本表以 weiji-server 实际控制器装饰器为准精确枚举。
>
> ⚠️ **代码勘误**：`analytics.controller.ts` 已定义 2 个端点，但 `bootstrap.ts` 的 `controllers` 挂载数组中**未注册 `AnalyticsController`**（仅挂载了 10 个控制器）。即旧 server 当前实际未对外提供 `/api/analytics/*` 服务。迁移时需在新 server `analytics` 模块补齐挂载，本表按「已定义、应迁移」将其纳入映射。

---

## 2. 路由分层规则

cool-admin 按路由前缀天然分层，味记沿用（架构文档 §3.3）：

| 前缀 | 用途 | 鉴权 | 消费方 |
|------|------|------|--------|
| `/admin/*` | **B 端后台管理**：base 模块（用户/角色/菜单/字典/日志/文件）+ 业务管理页 CRUD（record/family/recipe/achievement 等） | cool-admin token + RBAC 权限 | weiji-admin-web（cool-admin-vue） |
| `/app/*` | **C 端业务 API**：味记 App 用户用的业务接口（账户/记录/家庭/成就/打卡/挑战/玩法/AI/埋点） | App 端独立 JWT（绑定 `weiji_app_user.id`） | weiji-app（cool-uni）、admin-web 业务页 |
| `/open/*` | **开放接口**：无需登录的公开数据（健康检查、公开菜谱等） | 无 | 任意 |

> ⚠️ C 端用户（`weiji_app_user`）与 B 端管理员（`base_sys_user`）是两套独立用户体系（架构文档 §5.7），鉴权 token 互不通用。

---

## 3. 完整端点映射表

> 鉴权列：「App JWT」= 需 App 端 token；「无」= JWT 白名单放行；带角色标注的表示在 App JWT 基础上额外要求家庭组角色（owner/admin/member）。

### 3.1 account 模块（C 端账户，原 auth）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `POST /api/auth/login` | `POST /app/account/login` | account | 无（白名单） | 登录。body `{ username, password }`，返回 `{ token, user }`。限流 5 次/分钟/IP |
| `POST /api/auth/register` | `POST /app/account/register` | account | 无（白名单） | 注册。body `{ username, password, nickname }`，注册成功自动签发 token，返回 `{ token, user }`。限流 5 次/分钟/IP |
| `POST /api/auth/logout` | `POST /app/account/logout` | account | App JWT | 退出登录。无 body，后端空实现，前端清除 token 即可，返回 `ok(null, '退出成功')` |

### 3.2 record 模块（美食记录）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/record/list` | `GET /app/record/list` | record | App JWT | 分页查询当前用户记录。query `page,pageSize,tag,rating,keyword`（均可选，默认 page=1/pageSize=20），按 createdAt 降序，返回 `{ list, total, page, pageSize }` |
| `POST /api/record` | `POST /app/record/save` | record | App JWT | 创建记录。body `CreateRecordBody`（`dishName` 必填，含 cookingMethod/rating/note/nutrition/ingredients/tags/mealType/recordDate/imageUrl/beautifiedUrl/source），自动填充 id/userId/recordDate，返回 `{ record, newAchievements }` |
| `GET /api/record/:id` | `GET /app/record/:id` | record | App JWT | 记录详情。path `id`，做归属校验（非本人返回 403 防 IDOR），找不到/已软删返回 404 |

### 3.3 family 模块（家庭组域：家庭/成员/邀请/菜谱/菜单/购物/动态/报告）

> family 域子资源统一**单数化**：recipes→recipe、members→member、invitations→invitation、records→record；menu/shopping/report/join 保持原形。

#### 3.3.1 家庭组基础

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/family` | `GET /app/family` | family | App JWT | 查询当前用户所属家庭组，未加入返回 `null` |
| `POST /api/family` | `POST /app/family` | family | App JWT | 创建家庭组。body `{ name }`（必填），当前用户成为 owner，同步建立 family_members 关系，返回 family |

#### 3.3.2 成员管理（members → member）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/family/members` | `GET /app/family/member/list` | family | App JWT | 列出当前家庭组全部成员，关联 users 表补全昵称/头像 |
| `PATCH /api/family/members/:id` | `PATCH /app/family/member/:id` | family | App JWT（owner/admin） | 修改成员角色。path `id`（成员关系记录 id），body `{ role }`（仅 admin/member，不可改 owner） |
| `DELETE /api/family/members/:id` | `DELETE /app/family/member/:id` | family | App JWT（owner） | 移除成员。path `id`，owner 不能移除自己，同步 memberCount-1 |

#### 3.3.3 邀请（invitations → invitation）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `POST /api/family/invitations` | `POST /app/family/invitation` | family | App JWT（owner/admin） | 生成 24h 有效邀请码，返回 `{ code, expiresAt }` |
| `GET /api/family/invitations` | `GET /app/family/invitation/list` | family | App JWT（owner/admin） | 列出当前家庭组未过期、未使用的有效邀请码 |
| `POST /api/family/join` | `POST /app/family/join` | family | App JWT | 通过邀请码加入家庭组（角色固定 member）。body `{ code }`，限流 5 次/分钟/IP，校验有效性/过期/已用/已加入，同步 memberCount+1 |

#### 3.3.4 菜谱（recipes → recipe）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/family/recipes` | `GET /app/family/recipe/list` | family | App JWT | 列出家庭组菜谱。query `visibility(family/private),authorId,category,keyword`（均可选），按可见性/作者/分类/关键词过滤 |
| `POST /api/family/recipes` | `POST /app/family/recipe` | family | App JWT | 上传菜谱。body `{ name,category,ingredients[],steps[],coverUrl,difficulty,cookTime,visibility }`（name/ingredients 必填） |
| `GET /api/family/recipes/:id` | `GET /app/family/recipe/:id` | family | App JWT | 菜谱详情。path `id`，找不到/已软删返回 404 |
| `PUT /api/family/recipes/:id` | `PUT /app/family/recipe/:id` | family | App JWT（作者） | 编辑菜谱。仅作者可操作，仅更新 body 中提供的字段 |
| `DELETE /api/family/recipes/:id` | `DELETE /app/family/recipe/:id` | family | App JWT（作者） | 软删除菜谱。仅作者可操作 |
| `PATCH /api/family/recipes/:id/visibility` | `PATCH /app/family/recipe/:id/visibility` | family | App JWT（作者） | 切换菜谱可见性。body `{ visibility }`（family/private） |

#### 3.3.5 协作菜单（menu）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/family/menu` | `GET /app/family/menu/list` | family | App JWT | 列出本周菜单，按 dayOfWeek 升序、餐次（早<午<晚）排序 |
| `POST /api/family/menu` | `POST /app/family/menu` | family | App JWT | 添加菜单项。body `{ dayOfWeek(1-7),mealType(breakfast/lunch/dinner),recipeId,recipeName }`，该天该餐次已有则替换并重置投票 |
| `POST /api/family/menu/:id/vote` | `POST /app/family/menu/:id/vote` | family | App JWT | 菜单项投票。body `{ vote }`（like/dislike），相同撤销、不同切换、未投新增，返回 `{ likes, dislikes }` |

#### 3.3.6 购物清单（shopping）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/family/shopping` | `GET /app/family/shopping/list` | family | App JWT | 列出当前家庭组购物清单（数组，前端按品类分组展示） |
| `POST /api/family/shopping` | `POST /app/family/shopping` | family | App JWT | 添加购物项。body `{ name,category,quantity }`（name 必填），sort 自动递增 |
| `PATCH /api/family/shopping/:id` | `PATCH /app/family/shopping/:id` | family | App JWT | 切换勾选状态。body `{ checked? }`，缺省取反；勾选时记录 checkedBy/checkedAt |
| `DELETE /api/family/shopping/:id` | `DELETE /app/family/shopping/:id` | family | App JWT | 删除购物项 |
| `POST /api/family/shopping/generate` | `POST /app/family/shopping/generate` | family | App JWT | 根据本周菜单聚合食材去重批量生成购物清单，返回 `{ added, skipped }` |

#### 3.3.7 家庭动态（records → record，F16）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/family/records` | `GET /app/family/record/list` | family | App JWT | 家庭成员饮食记录动态。query `page,pageSize`（默认 1/20），按 createdAt 降序，附点赞数/评论数/是否已点赞，返回 `{ list, total, page, pageSize }` |
| `POST /api/family/records/:id/like` | `POST /app/family/record/:id/like` | family | App JWT | 点赞/取消点赞（toggle）。path `id`（记录 id） |
| `POST /api/family/records/:id/comments` | `POST /app/family/record/:id/comment` | family | App JWT | 添加评论。path `id`，body `{ content }`（必填，后端 escapeHtml） |

#### 3.3.8 家庭饮食月度报告（report，F17）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/family/report` | `GET /app/family/report` | family | App JWT | 月度饮食报告。query `month`（YYYY-MM，默认当月），聚合家庭成员当月记录，未加入家庭组返回空报告 |

### 3.4 achievement 模块（成就与等级）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/achievement/list` | `GET /app/achievement/list` | achievement | App JWT | 全部徽章列表，每项含是否已解锁 + 解锁时间 earnedAt |
| `GET /api/achievement/level` | `GET /app/achievement/level` | achievement | App JWT | 当前用户等级/经验/下一级所需经验/进度百分比。公式 level=floor(exp/100)+1 |

### 3.5 checkin 模块（打卡）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/checkin/status` | `GET /app/checkin/status` | checkin | App JWT | 今日是否打卡、连续打卡天数 streak、最近一次打卡日期 |
| `POST /api/checkin` | `POST /app/checkin` | checkin | App JWT | 打卡。无 body，首次打卡增加天数并检查成就解锁；重复打卡返回提示不重复增加，返回 `{ todayChecked, streak, newAchievements }` |
| `POST /api/checkin/replenish` | `POST /app/checkin/replenish` | checkin | App JWT | 补签昨日（每周限 1 次）。需先完成今日打卡，返回 `{ streak, newAchievements }` |

### 3.6 user 模块（用户资料）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/user/profile` | `GET /app/user/profile` | user | App JWT | 当前登录用户基本资料 + 统计（recordCount/recipeCount/streak/achievementCount），不返回 password |
| `PATCH /api/user/profile` | `PATCH /app/user/profile` | user | App JWT | 更新资料。body `{ nickname?, avatar? }`，仅更新提供字段，返回安全用户对象 |

### 3.7 challenge 模块（挑战赛）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/challenge/list` | `GET /app/challenge/list` | challenge | App JWT | 返回所有 isActive=true 的挑战列表 |

### 3.8 gamification 模块（趣味玩法：图鉴/人格/时光机/盲猜）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/gamification/pokedex` | `GET /app/gamification/pokedex` | gamification | App JWT | 美食图鉴：聚合 pokedexCatalog 与当前用户实际记录 |
| `GET /api/gamification/personality` | `GET /app/gamification/personality` | gamification | App JWT | 食物人格测试：基于近 30 天记录生成人格报告 |
| `GET /api/gamification/timemachine` | `GET /app/gamification/timemachine` | gamification | App JWT | 美食时光机：查询往年今日记录 |
| `POST /api/gamification/blindguess/round` | `POST /app/gamification/blindguess/round` | gamification | App JWT（家庭成员） | 发起盲猜轮次。body `{ familyId, roundName, recordIds[3-10] }`，active 状态脱敏真实作者 |
| `GET /api/gamification/blindguess/round/:id` | `GET /app/gamification/blindguess/round/:id` | gamification | App JWT（家庭成员） | 查看轮次详情，active 状态脱敏 items 中真实作者 |
| `POST /api/gamification/blindguess/round/:id/guess` | `POST /app/gamification/blindguess/round/:id/guess` | gamification | App JWT（家庭成员） | 提交猜测。body `{ itemId, guessAuthorId, guessAuthorName?, guessDishName }`，每题每用户仅一次 |
| `POST /api/gamification/blindguess/round/:id/reveal` | `POST /app/gamification/blindguess/round/:id/reveal` | gamification | App JWT（轮次 creator） | 揭晓结果：计算排名并更新轮次状态为 revealed |

### 3.9 ai 模块（AI 代理，转发 weiji-ai:8002）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `POST /api/ai/recognize` | `POST /app/ai/recognize` | ai | App JWT | 食物识别。multipart `image`，转发 weiji-ai `/ai/recognize`，失败降级 code:503 |
| `POST /api/ai/beautify` | `POST /app/ai/beautify` | ai | App JWT | 图片美化。multipart `image`，转发 `/ai/beautify` |
| `POST /api/ai/recommend` | `POST /app/ai/recommend` | ai | App JWT | 菜谱推荐。JSON `{ dishName }`，转发 `/ai/recommend` |
| `POST /api/ai/voice/recognize` | `POST /app/ai/voice/recognize` | ai | App JWT | 语音识别。multipart `audio`，转发 `/ai/voice/recognize`，server 注入 `intent` 字段（what_to_cook/cooking_step/search_recipe/unknown） |
| `POST /api/ai/sticker` | `POST /app/ai/sticker` | ai | App JWT | 贴纸生成。multipart `image`，转发 `/ai/sticker` |

> 详细转发映射见 [§5 AI 代理路径](#5-ai-代理路径)。

### 3.10 analytics 模块（数据埋点）

> ⚠️ 旧 server `bootstrap.ts` 未挂载 `AnalyticsController`，下列 2 个端点虽已定义但当前未实际对外服务；新 server `analytics` 模块需补齐挂载到 `/app/analytics/*`。

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /api/analytics/events` | `GET /app/analytics/events` | analytics | App JWT | 查询埋点事件。query `type`（可选，无则返回全部） |
| `POST /api/analytics/track` | `POST /app/analytics/track` | analytics | App JWT | 前端上报事件。body `{ type, payload?, familyId? }`（type 必填），写入 analytics_events |

### 3.11 open 模块（公开接口，原 health）

| 旧路径（method + path） | 新路径 | 模块 | 鉴权 | 说明 |
|---|---|---|---|---|
| `GET /health` | `GET /open/health` | open | 无 | 健康检查。返回 `{ status: 'ok', ai: 'up' \| 'down' }`，ai 字段动态读取 AiProxyService.aiStatus（启动时 + 每 60s 定时健康检查维护）。也可保留 `/health` 兼容外部探活 |

---

## 4. B 端管理 CRUD 清单

cool-admin 通过 `@CoolController({ api: ['add','delete','update','info','page','list'], entity, service })` 一行自动生成 6 个 CRUD 端点（POST `/admin/{module}/{add|delete|update|page|list}`、GET `/admin/{module}/info`）。下表列出各业务实体对应的 B 端管理 CRUD。架构文档 §6.2 / Phase 2 明确优先用 cl-crud 生成 **record/family/recipe/achievement** 管理页。

| 实体（新 entity） | 所属模块 | `/admin/{module}/...` 前缀 | cl-crud 端点 | 优先级 | 说明 |
|---|---|---|---|---|---|
| `weiji_app_user` | account | `/admin/app/user` | add/delete/update/info/page/list | 中 | C 端 App 用户管理（昵称/头像/家庭组关联） |
| `weiji_record` | record | `/admin/record` | add/delete/update/info/page/list | **高** | 美食记录管理（Phase 2 优先） |
| `weiji_record_like` | record | `/admin/record/like` | add/delete/update/info/page/list | 低 | 点赞记录 |
| `weiji_record_comment` | record | `/admin/record/comment` | add/delete/update/info/page/list | 低 | 评论记录 |
| `weiji_family` | family | `/admin/family` | add/delete/update/info/page/list | **高** | 家庭组管理（Phase 2 优先） |
| `weiji_family_member` | family | `/admin/family/member` | add/delete/update/info/page/list | 中 | 家庭成员关系 |
| `weiji_family_recipe` | family | `/admin/family/recipe` | add/delete/update/info/page/list | **高** | 家庭菜谱管理（Phase 2 优先） |
| `weiji_weekly_menu` | family | `/admin/family/menu` | add/delete/update/info/page/list | 中 | 本周菜单 |
| `weiji_shopping_item` | family | `/admin/family/shopping` | add/delete/update/info/page/list | 低 | 购物清单 |
| `weiji_family_invitation` | family | `/admin/family/invitation` | add/delete/update/info/page/list | 低 | 邀请码 |
| `weiji_achievement` | achievement | `/admin/achievement` | add/delete/update/info/page/list | **高** | 成就定义管理（Phase 2 优先） |
| `weiji_user_achievement` | achievement | `/admin/achievement/user` | add/delete/update/info/page/list | 中 | 用户成就解锁记录 |
| `weiji_checkin` | checkin | `/admin/checkin` | add/delete/update/info/page/list | 中 | 打卡记录 |
| `weiji_challenge` | challenge | `/admin/challenge` | add/delete/update/info/page/list | 中 | 挑战赛配置（含 rules JSON） |
| `weiji_blind_guess_round` | gamification | `/admin/gamification/blindguess` | add/delete/update/info/page/list | 低 | 盲猜轮次（含 items/guesses JSON） |

> 说明：
> - 上述 `/admin/*` 端点由 cool-admin RBAC 保护，需 B 端 token + 对应菜单权限。
> - cl-crud 自动生成的 `page`/`list`/`info` 与 C 端 `/app/*` 同名端点互不影响（前缀不同、鉴权不同）。
> - `gamification` 的静态数据（pokedex_catalog/personality_types）走 `db.json` 初始化，无需 B 端 CRUD。
> - `analytics` 模块默认只查询/上报，不强制建 B 端 CRUD；如需后台审计可补 `/admin/analytics/event`。

---

## 5. AI 代理路径

weiji-server 的 `ai` 模块（迁移自 `AiProxyService`）将 `/app/ai/*` 请求转发到 weiji-ai（FastAPI，:8002）的 `/ai/*`，处理 multipart 与 JSON、30s 超时与降级。配置项 `AI_SERVICE_URL`（默认 `http://localhost:8002`）。架构文档 §8.3。

| 新路径（C 端入口） | 转发目标 weiji-ai 路径 | 方法 | 请求类型 | 说明 |
|---|---|---|---|---|
| `POST /app/ai/recognize` | `POST /ai/recognize` | POST | multipart/form-data（`image`） | 食物识别，透传 weiji-ai 响应体 |
| `POST /app/ai/beautify` | `POST /ai/beautify` | POST | multipart/form-data（`image`） | 图片美化 |
| `POST /app/ai/recommend` | `POST /ai/recommend` | POST | application/json（`{ dishName }`） | 菜谱推荐 |
| `POST /app/ai/voice/recognize` | `POST /ai/voice/recognize` | POST | multipart/form-data（`audio`） | 语音识别；server 在 weiji-ai 返回 `{ text }` 基础上注入 `intent` 字段后回传 `{ text, intent }` |
| `POST /app/ai/sticker` | `POST /ai/sticker` | POST | multipart/form-data（`image`） | 贴纸生成 |
| —（内部健康检查，不对外暴露端点） | `GET /health` | GET | — | weiji-server 启动时立即检查一次，之后每 60s 轮询 weiji-ai `/health`（5s 超时）；结果维护 `AiProxyService.aiStatus`，供 `GET /open/health` 的 `ai` 字段动态暴露。weiji-ai 不可用时 `/app/ai/*` 返回 `code:503` |

> 降级策略：转发失败（网络错误/超时/4xx/5xx）→ 标记 aiStatus=down，返回 `{ code:503, data:null, message:'AI 服务暂时不可用，请稍后重试' }`。AI 厂商 Key 仍由 weiji-ai 通过环境变量管理，不硬编码。

---

## 6. 破坏性变更摘要

下列路径前缀/形态变更要求前端（weiji-admin-web、weiji-app）在对接新 server 时**全量同步修改请求路径**：

- **全局前缀分层**：所有 `/api/*` 统一前缀废弃。C 端业务接口改走 `/app/*`，B 端管理改走 `/admin/*`（cl-crud 自动生成），公开接口改走 `/open/*`。
- **账户接口重命名**：`/api/auth/{login,register,logout}` → `/app/account/{login,register,logout}`（auth 模块在 cool-admin 下归入 `account`，C 端用户实体为 `weiji_app_user`，鉴权用 App 端独立 JWT，不复用 base sys user）。
- **记录创建动作化**：`POST /api/record`（RESTful 根路径）→ `POST /app/record/save`（cool-admin 动作命名）；`GET /api/record/list` 保留为 `/app/record/list`（也可改用 cl-crud 的 `page`）。`GET /api/record/:id` → `GET /app/record/:id`。
- **family 子资源单数化**：
  - `recipes` → `recipe`（`/api/family/recipes` → `/app/family/recipe/list`，`/api/family/recipes/:id` → `/app/family/recipe/:id`，含 `visibility` 子动作）
  - `members` → `member`（`/api/family/members` → `/app/family/member/list`）
  - `invitations` → `invitation`（`/api/family/invitations` → `/app/family/invitation/list`）
  - `records`（家庭动态）→ `record`（`/api/family/records` → `/app/family/record/list`，`/api/family/records/:id/comments` → `/app/family/record/:id/comment`）
  - `menu`/`shopping`/`report`/`join` 保持原形（已是单数/不可数），仅前缀改为 `/app/family/...`，集合查询补 `/list` 后缀。
- **AI 代理前缀变更**：`/api/ai/*` → `/app/ai/*`（转发目标 weiji-ai `/ai/*` 不变）。
- **健康检查前缀变更**：`GET /health` → `GET /open/health`（亦可保留 `/health` 兼容外部探活，由实施期决定；前端探活地址建议同步更新）。
- **B 端新增管理端点**：原 weiji-server 无 B 端管理接口，cool-admin 新增 `/admin/{module}/{add|delete|update|info|page|list}` 一批（见 §4），admin-web 需对接 cl-crud。
- **限流路径需同步**：原限流路径 `/api/auth/login`、`/api/auth/register`、`/api/family/join`（5 次/分钟/IP）迁移后需按新路径 `/app/account/login`、`/app/account/register`、`/app/family/join` 重新配置（cool-admin 中间件或 `@cool-midway/rate-limit`）。
- **鉴权体系分离**：原单一 JWT 改为 B 端 cool-admin token（`/admin/base/open/login` 签发，含 RBAC）与 C 端 App token（`/app/account/login` 签发）两套，前端拦截器需按端区分注入与 401 重定向。

> 建议三端按本表逐条改造 API 调用点，并以本文件作为 Phase 2/Phase 3 联调的验收依据。
