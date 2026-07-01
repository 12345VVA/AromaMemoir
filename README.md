# 味记 · AromaMemoir

> 以个人和家庭为主体的 AI 美食记录平台 —— 记录每一天吃到的美食，无论来自自家厨房、街边小摊还是米其林餐厅。
>
> 核心理念：每一餐都值得被记住，每一个家庭都有自己的味道。

> 📌 **目标架构（2026-07）**：将基于 cool-admin 全家桶（cool-admin-midway / cool-admin-vue / cool-uni）重建三端工程，[weiji-web](weiji-web/) 作为功能参考原型，[weiji-ai](weiji-ai/) 保留为独立 AI 层。完整设计见 [架构设计与迁移方案.md](架构设计与迁移方案.md)。下文「架构概览 / 目录结构」描述的是**当前**可运行的旧实现，迁移按上述方案分阶段进行。

---

## 架构概览

味记采用**三服务分层架构**，前端 → 业务后端 → AI 服务，职责清晰、可独立部署。

```
weiji-admin-web (:5173)   →   weiji-server (:8001)   →   weiji-ai (:8002)
   Vue3 前端                  Koa 业务后端               FastAPI AI 服务
   Element Plus               JWT 鉴权 + bcrypt          6 家 AI 厂商集成
   Pinia                      内存存储 + 种子数据         无 key 自动降级
                               代理 /api/ai/* → :8002
```

| 服务 | 端口 | 技术栈 | 职责 |
|------|------|--------|------|
| [weiji-admin-web](file:///workspace/weiji-admin-web) | 5173 | Vue3 + Vite + Element Plus + Pinia | 管理后台前端，路由守卫 + 401 重定向 |
| [weiji-server](file:///workspace/weiji-server) | 8001 | Koa + 装饰器路由 + JWT + bcrypt | 业务后端，鉴权 / 记录 / 家庭 / 成就 / 打卡等 |
| [weiji-ai](file:///workspace/weiji-ai) | 8002 | FastAPI + httpx + AsyncOpenAI | AI 服务层，6 家厂商集成 + 三级降级 |

---

## 快速开始

### 环境要求

- Node.js ≥ 20（推荐 24）
- Python ≥ 3.10
- 各服务分别 `npm install` / `pip install -r requirements.txt`

### 1. 启动 AI 服务（:8002）

```bash
cd weiji-ai
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8002
```

> **无需配置任何 API Key 也能启动**：5 个 AI 端点会降级返回 mock 数据 + 友好提示。

### 2. 启动业务后端（:8001）

```bash
cd weiji-server
npm install
npm run dev
```

启动后会代理 `/api/ai/*` 到 `http://localhost:8002`，并加载演示账号种子数据。

### 3. 启动前端（:5173）

```bash
cd weiji-admin-web
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`，使用演示账号登录。

### 演示账号

所有账号密码统一为 `123456`。

| 用户名 | 昵称 | 家庭组角色 |
|--------|------|------------|
| demo | 小明 | owner |
| mom | 妈妈 | admin |
| dad | 爸爸 | member |
| grandma | 奶奶 | member |

家庭组：王家厨房（inviteCode: `WJ1234`）

### 持久化与后端配置（可选）

weiji-server 默认以**内存模式**运行（`DB_DRIVER=memory`，重启后数据丢失，适合本地开发与测试）。需要数据持久化时切换为 MySQL：

```bash
cd weiji-server
cp .env.example .env              # 复制样例配置（.env 已在 .gitignore，不会提交）
# 编辑 .env：DB_DRIVER=mysql，并填写 DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
# 生产环境（NODE_ENV=production）务必同时设置 JWT_SECRET，否则启动即报错退出
mysql -u root -p < db/init.sql    # 初始化 weiji 库 + 12 张业务表 + 种子数据（幂等可重复执行）
npm run dev                       # 启动时自动校验 MySQL 连通性与 users 表存在性
```

完整环境变量清单见 [weiji-server/.env.example](file:///workspace/weiji-server/.env.example)；MySQL 模式启用步骤与表清单见 [weiji-server/db/README.md](file:///workspace/weiji-server/db/README.md)。

---

## 配置 AI 能力（可选）

AI 服务支持 6 家外部厂商，所有凭证通过**环境变量**注入，绝不硬编码、不写入 `.env` 提交到 git。

```bash
export BAIDU_API_KEY="..."
export BAIDU_SECRET_KEY="..."
export OPENAI_API_KEY="..."          # GPT-4o 兜底 + 通义千问复用
export QWEN_API_KEY="..."            # 可选，缺失则复用 OPENAI_API_KEY
export VOLCANO_ACCESS_KEY="..."
export VOLCANO_SECRET_KEY="..."
export XFYUN_APP_ID="..."
export XFYUN_API_KEY="..."
export XFYUN_API_SECRET="..."
export TENCENT_SECRET_ID="..."
export TENCENT_SECRET_KEY="..."
```

完整环境变量清单与缺失降级行为见 [weiji-ai/README.md](file:///workspace/weiji-ai/README.md)。

| 能力 | 厂商 | 端点 |
|------|------|------|
| 食物识别 | 百度AI（主）+ GPT-4o（兜底）+ 腾讯云（审核） | `POST /ai/recognize` |
| 图片美化 | 火山引擎 | `POST /ai/beautify` |
| 菜谱推荐 | 通义千问 | `POST /ai/recommend` |
| 语音识别 | 讯飞 | `POST /ai/voice/recognize` |
| 贴纸生成 | 保留 mock（开发中） | `POST /ai/sticker` |

### 降级策略

所有 AI 端点实现三级降级，绝不向代理层抛 500：

1. **Key 缺失** → 返回 mock 数据 + 提示文案（如"未配置 AI 识别 Key，返回演示数据"）
2. **厂商调用失败**（网络 / 配额 / 鉴权）→ 返回 mock 数据 + 提示文案
3. **图片违规** → 返回 `{ code: 1, message: "图片内容不合规，请更换图片后重试" }`

---

## 测试

项目建立了**分层测试体系**（单元 + 集成），共 **82 个测试用例全绿**。

### 一键运行全量测试

```bash
bash scripts/run-all-tests.sh
```

脚本依次运行三服务测试，任一失败即 `exit 1`，末尾打印 `通过: X / 3` 汇总。

### 分服务运行

| 服务 | 命令 | 测试栈 | 用例数 |
|------|------|--------|--------|
| weiji-server | `cd weiji-server && npm test` | node:test + supertest + tsx | 36 |
| weiji-ai | `cd weiji-ai && pytest` | pytest + pytest-asyncio | 21 |
| weiji-admin-web | `cd weiji-admin-web && npm test` | Vitest + @vue/test-utils + jsdom | 25 |

测试特点：
- **后端**：`supertest + app.callback()` 不占真实端口；`loginAsDemo()` 辅助获取 JWT
- **AI 服务**：`autouse` fixture 清理 12 个环境变量，覆盖无 key 降级路径
- **前端**：mock axios 捕获拦截器回调，验证 JWT 注入 + 401 重定向

---

## 目录结构

```
workspace/
├── weiji-admin-web/          # Vue3 前端 (:5173)
│   ├── src/
│   │   ├── api/client.ts        # axios 实例 + JWT 拦截器 + 401 重定向
│   │   ├── router/index.ts      # 路由守卫（requiresAuth）
│   │   ├── stores/auth.ts       # Pinia 认证状态
│   │   └── views/               # Login / Home / AiRecord / FamilyRecipes / Achievements / Profile
│   ├── vitest.config.ts
│   └── package.json
├── weiji-server/             # Koa 业务后端 (:8001)
│   ├── src/
│   │   ├── bootstrap.ts         # 应用启动入口（createApp + 路由扫描）
│   │   ├── configuration.ts     # 端口 / CORS / JWT / AI 服务地址 / 存储驱动
│   │   ├── common/decorators.ts # Midway 风格 @Controller / @Get / @Post ...
│   │   ├── common/response.ts   # ok() / fail() / unauthorized() 统一响应
│   │   ├── middleware/jwt.middleware.ts
│   │   ├── controller/          # health/auth/record/family/achievement/checkin/user/challenge/ai/gamification/analytics
│   │   ├── service/             # auth/family/checkin/achievement/ai-proxy
│   │   └── store/               # Repository 抽象（内存 / MySQL）+ 种子数据 + 查询辅助
│   ├── tests/                   # unit/ + integration/ + helpers/
│   └── package.json
├── weiji-ai/                 # FastAPI AI 服务 (:8002)
│   ├── main.py                  # 5 个 AI 端点 + 统一响应格式
│   ├── config.py                # Settings 单例 + *_ready 就绪判断
│   ├── exceptions.py            # AiProviderError / AiAuthError / AiQuotaError / AiInvalidInputError
│   ├── services/                # baidu/openai/tencent/volcano/qwen/xfyun 6 个厂商模块
│   ├── tests/                   # unit/ + integration/
│   └── requirements.txt
├── weiji-web/                # ⚠️ 功能参考原型（纯静态 HTML+JS，不参与构建/部署，详见 [weiji-web/README.md](weiji-web/README.md)）
│   ├── api.js
│   ├── app.js
│   └── index.html
├── scripts/
│   └── run-all-tests.sh         # 统一测试入口
├── 味记PRD.md                 # 产品需求文档
├── MVP开发速查手册.md          # MVP 功能与数据模型速查
└── cool-admin适配度分析.md      # cool-admin 后端适配分析
```

---

## 统一响应契约

三服务遵循统一的 `{ code, data, message }` 响应格式，前后端契约一致：

```ts
// 成功
{ code: 0, data: <payload>, message: "" }

// 失败
{ code: <非零错误码>, data: null, message: "人类可读消息" }
```

- **HTTP 状态码**：鉴权失败 401，业务参数错误 400，资源不存在 404，其余成功路径 200
- **业务错误码**：`code: 0` 表示成功，非零表示业务失败（AI 降级时 HTTP 仍为 200，由 `code` 区分）
- 前端 [client.ts](file:///workspace/weiji-admin-web/src/api/client.ts) 响应拦截器自动解包 `data`，并在 401 时清除 token 重定向到 `/login`

---

## 核心业务能力

| 模块 | 后端端点 | 说明 |
|------|----------|------|
| 鉴权 | `/api/auth/login` `/register` `/logout` | JWT 签发 + bcrypt 校验 |
| 记录 | `/api/record/list` `POST /api/record` `/api/record/:id` | 美食日记，分页查询 |
| 家庭 | `/api/family/*` | 家庭组 / 成员 / 邀请码 / 共享菜谱 / 本周菜单 / 购物清单 |
| 成就 | `/api/achievement/list` `/level` | 成就徽章 + 美食家等级 |
| 打卡 | `/api/checkin/status` `POST /api/checkin` | 连续打卡 + streak |
| 用户 | `/api/user/profile` | 用户档案 |
| 挑战 | `/api/challenge/list` | 周期主题挑战 |
| AI 代理 | `/api/ai/*` | 代理转发到 weiji-ai，统一加 `/api` 前缀 |

---

## 开发约定

- **Spec-driven**：每个能力用 `spec.md` / `tasks.md` / `checklist.md` 三件套驱动，位于 [.trae/specs/](file:///workspace/.trae/specs)
- **不硬编码凭证**：AI 厂商 Key 一律从环境变量读取，缺失时降级
- **降级优先**：AI 端点任何异常都返回友好提示，不抛 500
- **测试先行**：新增能力需补单元 + 集成测试，并通过 `scripts/run-all-tests.sh`

---

## 相关文档

- [味记PRD.md](file:///workspace/味记PRD.md) — 产品需求文档（功能全景、AI 规格、路线图）
- [weiji-admin-web README](file:///workspace/weiji-admin-web) — 前端说明（Vue3 管理后台）
- [weiji-server README](file:///workspace/weiji-server/README.md) — 业务后端说明（端点、种子数据、技术说明）
- [weiji-ai README](file:///workspace/weiji-ai/README.md) — AI 服务说明（环境变量、降级策略、目录结构）
- [MVP开发速查手册.md](file:///workspace/MVP开发速查手册.md) — MVP 功能与数据模型速查
- [架构设计与迁移方案.md](架构设计与迁移方案.md) — 目标架构（cool-admin 全家桶）与迁移路线图
