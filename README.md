# 味记 · AromaMemoir

> 以个人和家庭为主体的 AI 美食记录平台 —— 记录每一天吃到的美食，无论来自自家厨房、街边小摊还是米其林餐厅。
>
> 核心理念：每一餐都值得被记住，每一个家庭都有自己的味道。

> 📌 **当前架构（2026-07）**：三端已基于 cool-admin 全家桶（cool-admin-midway / cool-admin-vue / cool-uni）完成重建。`weiji-web` 作为功能参考原型，`weiji-ai` 保留为独立 AI 层。完整设计见 [架构设计与迁移方案.md](架构设计与迁移方案.md)。

---

## 架构概览

味记采用 **cool-admin 全家桶四服务分层架构**，前端 → 业务后端 → AI 服务，职责清晰、可独立部署。

```
weiji-app (:9900 H5)         →   weiji-server (:8001)   →   weiji-ai (:8002)
weiji-admin-web (:9000)  ─┘      cool-admin-midway           FastAPI AI 服务
   cool-uni 移动端                Midway.js + TypeORM          6 家 AI 厂商集成
   cool-admin-vue 后台            JWT 鉴权 + bcrypt            无 key 自动降级
   Vue3 + Vite + Element Plus     MySQL + Redis
   cl-crud 管理页                 9 个业务模块 + base 模块
```

| 服务 | 端口 | 技术栈 | 职责 |
|------|------|--------|------|
| [weiji-server](file:///workspace/weiji-server) | 8001 | cool-admin-midway（Midway.js + TypeORM + MySQL + Redis + `@cool-midway/core`） | 业务后端，base 模块 + 9 个业务模块（account/record/family/achievement/checkin/challenge/gamification/ai/analytics） |
| [weiji-admin-web](file:///workspace/weiji-admin-web) | 9000 | cool-admin-vue（Vue3 + Vite + Element Plus + cl-crud/cl-form） | PC 管理后台，9 业务页面 + cl-crud 管理页 |
| [weiji-app](file:///workspace/weiji-app) | 9900 | cool-uni（uni-app + Vue3 组合式 + Pinia） | 移动端 H5 / 微信小程序，8 页面 + Gameplay |
| [weiji-ai](file:///workspace/weiji-ai) | 8002 | FastAPI + httpx + AsyncOpenAI | AI 服务层，6 家厂商集成 + 三级降级 |

---

## 快速开始

### 环境要求

- Node.js ≥ 18（推荐 20+）
- Python ≥ 3.11（weiji-ai 用 [uv](https://docs.astral.sh/uv/) 管理依赖与环境，需先安装 uv）
- 各服务分别 `npm install` / `uv sync`（weiji-ai）
- 后端依赖 MySQL 8.0+ 与 Redis（本地开发 cool-admin 默认 sqlite 内存兼容模式）

### 1. 启动 AI 服务（:8002）

```bash
cd weiji-ai
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8002
```

> **无需配置任何 API Key 也能启动**：5 个 AI 端点会降级返回 mock 数据 + 友好提示。

### 2. 启动业务后端（:8001）

```bash
cd weiji-server
npm install
NODE_ENV=local node bootstrap-local.js
```

启动后 cool-admin 自动建表并加载各模块 `db.json` 种子数据；AI 代理转发 `/app/ai/*` → `http://localhost:8002`。

### 3. 启动 PC 后台（:9000）

```bash
cd weiji-admin-web
npm install
npm run dev
```

打开浏览器访问 `http://localhost:9000`，后台用 `admin/123456` 登录（cool-admin 内置）；C 端业务页用演示账号 `demo/123456`。

### 4. 启动移动端 H5（:9900）

```bash
cd weiji-app
npm install
npm run dev:h5
```

打开浏览器访问 `http://localhost:9900`，使用演示账号登录。

> CI / 只读环境需加 `CHOKIDAR_USEPOLLING=true` 启动前端 dev server。

### 演示账号

所有账号密码统一为 `123456`。

| 用户名 | 昵称 | 家庭组角色 |
|--------|------|------------|
| demo | 演示账号 | admin |
| mom | 妈妈 | owner |
| dad | 爸爸 | member |
| grandma | 奶奶 | member |

家庭组：王家厨房（inviteCode: `WJ1234`），含 4 道菜谱、3 条记录、7 条打卡。

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

项目建立了**分层测试体系**（单元 + 集成），三端测试全绿。

### 一键运行全量测试

```bash
bash scripts/run-all-tests.sh
```

脚本依次运行三服务测试，任一失败即 `exit 1`，末尾打印 `通过: X / 3` 汇总。

### 分服务运行

| 服务 | 命令 | 测试栈 | 用例数 |
|------|------|--------|--------|
| weiji-server | `cd weiji-server && npm test` | jest@29 + ts-jest | 117 passed / 8 skipped |
| weiji-admin-web | `cd weiji-admin-web && npm test` | vitest@2 + @vue/test-utils + jsdom | 27 passed / 4 skipped |
| weiji-ai | `cd weiji-ai && uv run pytest` | pytest + pytest-asyncio | 25 |

测试特点：
- **后端**：17 套件通过 / 3 套件 skip（in-memory/mysql/store 废弃），覆盖 9 业务模块 + 核心闭环（注册→登录→记录→家庭→成就打卡）+ AI 代理降级
- **前端**：3 套件通过 / 1 套件 skip（cool-admin 内置登录页），覆盖 app-api 契约 + token 管理 + ai-record 交互 + 401 处理
- **AI 服务**：`autouse` fixture 清理 12 个环境变量，覆盖无 key 降级路径

---

## 目录结构

```
workspace/
├── weiji-server/             # cool-admin-midway 业务后端 (:8001)
│   ├── src/
│   │   ├── configuration.ts     # cool-admin 生命周期配置
│   │   ├── config/              # config.default/local/prod（typeorm 数据源、端口、redis）
│   │   ├── comm/                # 公共工具（path/port/utils）
│   │   └── modules/             # base（cool-admin 内置）+ 9 业务模块
│   │       ├── account/         # C 端 weiji_app_user + 登录鉴权
│   │       ├── record/          # 美食记录 weiji_record + 点赞/评论
│   │       ├── family/          # 家庭组/成员/邀请/菜谱/周菜单/购物
│   │       ├── achievement/     # 成就定义 + 用户成就
│   │       ├── checkin/         # 每日打卡 + streak
│   │       ├── challenge/       # 周期挑战
│   │       ├── gamification/    # 图鉴 + 人格 + 盲猜
│   │       ├── ai/              # AI 代理转发 :8002
│   │       └── analytics/       # 埋点
│   ├── test/                    # unit/ + integration/
│   ├── docs/api-path-mapping.md # API 路径映射契约
│   ├── bootstrap-local.js       # 本地启动入口
│   └── package.json
├── weiji-admin-web/          # cool-admin-vue PC 后台 (:9000)
│   ├── src/
│   │   ├── modules/             # 业务页面（home/record/family/achievement/gamification 等）
│   │   │   ├── business/utils/app-api.ts  # C 端 /app API 实例
│   │   │   └── */views/         # AiRecord/FamilyRecipes/RecipeForm/RecipeDetail/Achievements/Gameplay
│   │   ├── cool/                # cool-admin-vue 框架层
│   │   └── __tests__/           # app-api/auth/ai-record/login spec
│   ├── vite.config.ts           # proxy /admin、/app → :8001
│   └── package.json
├── weiji-app/                # cool-uni 移动端 (:9900 H5)
│   ├── pages/                   # login/home/ai-record/family/recipe-*/achievement/gamification/profile
│   ├── utils/api.ts             # uni 请求封装（/app/* + /open/*）
│   ├── config/                  # dev/prod/proxy
│   ├── manifest.json            # 微信小程序 appid / H5
│   └── package.json
├── weiji-ai/                 # FastAPI AI 服务 (:8002，独立 AI 层，不变)
│   ├── main.py                  # 5 个 AI 端点 + 统一响应格式
│   ├── config.py                # Settings 单例 + *_ready 就绪判断
│   ├── pyproject.toml           # uv 项目元数据 + 依赖声明
│   └── uv.lock                  # uv 锁定的精确依赖版本
├── weiji-web/                # ⚠️ 功能参考原型（纯静态 HTML+JS，不参与构建/部署，不变）
├── scripts/
│   └── run-all-tests.sh         # 统一测试入口
├── 味记PRD.md                 # 产品需求文档
├── MVP开发速查手册.md          # MVP 功能与数据模型速查
└── 架构设计与迁移方案.md        # cool-admin 全家桶迁移方案与路线图
```

---

## 统一响应契约

cool-admin 全家桶遵循统一的 `{ code, data, message }` 响应格式：

```ts
// 成功
{ code: 1000, data: <payload>, message: "success" }

// 失败
{ code: <非 1000 错误码>, data: null, message: "人类可读消息" }
```

- **业务码**：`code: 1000` 表示成功，其余为业务失败码（AI 降级时仍返回 200，由 `code` 区分）
- **路径划分**：
  - `/open/*` —— 公开端点（health 等，无需鉴权）
  - `/app/*` —— C 端业务 API（App 用户，独立 JWT，绑定 `weiji_app_user.id`）
  - `/admin/*` —— B 端管理 API（cool-admin token + RBAC，cl-crud 自动生成 CRUD）
- C 端 `weiji_app_user` 与 B 端 `base_sys_user` 分离，鉴权互不混淆
- 完整端点映射见 [weiji-server/docs/api-path-mapping.md](file:///workspace/weiji-server/docs/api-path-mapping.md)

---

## 核心业务能力

| 模块 | C 端端点（/app/*） | 说明 |
|------|----------|------|
| 鉴权 | `/app/account/login` `/register` | JWT 签发 + bcrypt 校验 |
| 记录 | `/app/record/list` `POST /app/record` | 美食日记，分页查询 |
| 家庭 | `/app/family/*` `/app/family/recipe/*` | 家庭组 / 成员 / 邀请码 / 共享菜谱 / 周菜单 / 购物清单 |
| 成就 | `/app/achievement/list` | 成就徽章 |
| 打卡 | `/app/checkin` `/app/checkin/status` | 连续打卡 + streak |
| 用户 | `/app/user/profile` | 用户档案 |
| 挑战 | `/app/challenge/list` | 周期主题挑战 |
| 玩法 | `/app/gamification/pokedex` `/app/gamification/blindGuess` | 图鉴 + 盲猜 |
| AI 代理 | `/app/ai/*` | 代理转发到 weiji-ai:8002，30s 超时 + 降级 |
| 埋点 | `/app/analytics/event` | 行为埋点 |
| 健康检查 | `/open/health` | 服务 + AI 状态 |

B 端管理用 cl-crud 在 `/admin/*` 自动生成 record/family/recipe/achievement 等 CRUD。

---

## 开发约定

- **Spec-driven**：每个能力用 `spec.md` / `tasks.md` / `checklist.md` 三件套驱动，位于 [.trae/specs/](file:///workspace/.trae/specs)
- **不硬编码凭证**：AI 厂商 Key 一律从环境变量读取，缺失时降级
- **降级优先**：AI 端点任何异常都返回友好提示，不抛 500
- **测试先行**：新增能力需补单元 + 集成测试，并通过 `scripts/run-all-tests.sh`
- **生产配置**：`config.prod.ts` 强制 `synchronize:false`，启动校验

---

## 相关文档

- [味记PRD.md](file:///workspace/味记PRD.md) — 产品需求文档（功能全景、AI 规格、路线图）
- [weiji-server README](file:///workspace/weiji-server/README.md) — 业务后端说明（cool-admin-midway）
- [weiji-admin-web README](file:///workspace/weiji-admin-web/README.md) — PC 后台说明（cool-admin-vue）
- [weiji-app README](file:///workspace/weiji-app/README.md) — 移动端说明（cool-uni）
- [weiji-ai README](file:///workspace/weiji-ai/README.md) — AI 服务说明（环境变量、降级策略、目录结构）
- [weiji-server/docs/api-path-mapping.md](file:///workspace/weiji-server/docs/api-path-mapping.md) — API 路径映射契约
- [MVP开发速查手册.md](file:///workspace/MVP开发速查手册.md) — MVP 功能与数据模型速查
- [架构设计与迁移方案.md](架构设计与迁移方案.md) — cool-admin 全家桶迁移方案与路线图
