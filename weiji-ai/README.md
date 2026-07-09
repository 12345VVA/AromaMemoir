# 味记 AI 服务 (weiji-ai)

FastAPI 实现的纯 AI 服务层，提供图片识别、图片美化、菜谱推荐、语音识别、贴纸生成等 AI 能力。

## 架构

本服务是味记三服务架构中的 AI 层：

```
weiji-admin-web (:17900)  →  weiji-server (:17801)  →  weiji-ai (:17802)
   Vue3 前端               cool-admin 业务后端        FastAPI AI 服务
                           （代理 /ai/* 到本服务）
```

仅暴露 `/health` 与 `/ai/*` 路径，业务端点（auth/record/family 等）已迁移至 weiji-server。

## 快速启动

```bash
cd weiji-ai
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 17802
```

启动后会打印各 AI 厂商配置状态。**未配置任何 key 也能正常启动**，5 个端点会降级返回 mock 数据。

## AI 能力与外部厂商

本服务集成 6 家外部 AI 厂商。所有 key 从环境变量读取，**绝不硬编码、不写入 .env 提交到 git**。

### 首选与兜底

火山方舟（Ark）为**首选 AI 能力**：
- 食物识别：豆包多模态（ep-m-20260116220530-jzfsx）→ 失败降级 百度+GPT-4o
- 菜谱推荐：豆包多模态 → 失败降级 通义千问
- 图片美化：豆包 Seedream（ep-m-20260503112555-b4j8d）→ 失败降级返回原图
- 贴纸生成：豆包 Seedream → 失败降级返回 mock 提示

豆包多模态要求传入图片 URL，因此调用前先上传图片到火山引擎 TOS 对象存储获取 URL。

### 环境变量清单

| 环境变量 | 用途 | 申请链接 | 缺失时降级行为 |
|---|---|---|---|
| `ARK_API_KEY` | 火山方舟 API Key（首选 AI 能力） | https://console.volcengine.com/ark | 识别/推荐/美化/贴纸降级到原厂商兜底 |
| `VOLCANO_ACCESS_KEY` | 火山引擎 TOS 对象存储 AK（与图片美化共用） | https://console.volcengine.com/tos | TOS 上传失败，识别降级到百度+GPT-4o，美化降级返回原图 /static/ 路径，贴纸降级返回 mock 占位图 |
| `VOLCANO_SECRET_KEY` | 火山引擎 TOS 对象存储 SK | 同上 | 同上 |
| `TOS_BUCKET` | TOS 桶名（默认 ark-auto-2103850221-cn-beijing-default） | - | 使用默认值 |
| `TOS_REGION` | TOS 区域（默认 cn-beijing） | - | 使用默认值 |
| `BAIDU_API_KEY` | 百度AI 菜品识别 | https://console.bce.baidu.com/ai | 识别端点跳过百度，直接走 GPT 兜底 |
| `BAIDU_SECRET_KEY` | 百度AI 菜品识别 | 同上 | 同上 |
| `OPENAI_API_KEY` | GPT-4o Vision 兜底识别 + 通义千问复用 | https://platform.openai.com/ | 识别端点返回 mock；推荐端点返回 mock |
| `QWEN_API_KEY` | 通义千问菜谱推荐（可选，缺失则复用 OPENAI_API_KEY） | https://dashscope.console.aliyun.com/ | 若 OPENAI_API_KEY 也无，推荐端点返回 mock |
| `QWEN_BASE_URL` | 通义千问 base_url（可选，默认 https://dashscope.aliyuncs.com/compatible-mode/v1） | - | 使用默认值 |
| `XFYUN_APP_ID` | 讯飞语音识别 | https://www.xfyun.cn/ | 语音端点返回空文本 |
| `XFYUN_API_KEY` | 讯飞语音识别 | 同上 | 同上 |
| `XFYUN_API_SECRET` | 讯飞语音识别 | 同上 | 同上 |
| `TENCENT_SECRET_ID` | 腾讯云图片内容审核 | https://console.cloud.tencent.com/cms | 跳过审核，视为合规（不阻塞主流程） |
| `TENCENT_SECRET_KEY` | 腾讯云图片内容审核 | 同上 | 同上 |

### 配置方式

#### 方式一：.env 文件（测试环境推荐）

复制 `.env.example` 为 `.env` 并填入真实值，启动时自动加载：

```bash
cp .env.example .env
# 编辑 .env 填入密钥
uv run uvicorn main:app --port 17802
```

注意：`.env` 已在 `.gitignore` 中，不会被提交。生产环境请用下方环境变量注入方式。

#### 方式二：环境变量注入（生产环境）

启动前在 shell 中设置环境变量（示例）：

```bash
export BAIDU_API_KEY="your_baidu_api_key"
export BAIDU_SECRET_KEY="your_baidu_secret_key"
export OPENAI_API_KEY="your_openai_api_key"
# ... 其他按需配置
uv run uvicorn main:app --port 17802
```

## API 端点

| 方法 | 路径 | 说明 | 调用厂商 |
|---|---|---|---|
| GET | `/health` | 健康检查 | - |
| POST | `/ai/recognize` | 食物图片识别 | 火山方舟豆包多模态（首选）+ 百度AI + GPT-4o（兜底）+ 腾讯云（审核） |
| POST | `/ai/beautify` | 图片美化 | 火山方舟豆包 Seedream（首选）+ 火山引擎视觉智能（兜底未启用） |
| POST | `/ai/recommend` | 菜谱推荐 | 火山方舟豆包多模态（首选）+ 通义千问（兜底） |
| POST | `/ai/voice/recognize` | 语音识别 | 讯飞 |
| POST | `/ai/sticker` | 贴纸生成 | 火山方舟豆包 Seedream（首选）+ mock（兜底） |

## 降级策略

所有 AI 端点都实现了降级机制：

1. **key 缺失**：返回 mock 数据 + 提示文案（如"未配置 AI 识别 Key，返回演示数据"），不抛 500
2. **厂商调用失败**（网络/配额/鉴权）：返回 mock 数据 + 提示文案
3. **图片违规**：返回 `{ code: 1, message: "图片内容不合规，请更换图片后重试" }`

## 目录结构

```
weiji-ai/
├── main.py              # FastAPI 应用 + 5 个 AI 端点
├── config.py            # 环境变量配置（Settings 单例）
├── exceptions.py        # AI 异常类型
├── pyproject.toml       # uv 管理的项目元数据与依赖声明
├── uv.lock              # uv 锁定的精确依赖版本（可复现）
├── services/            # AI 厂商集成模块
│   ├── baidu_vision.py      # 百度AI 菜品识别
│   ├── openai_vision.py     # GPT-4o Vision 兜底
│   ├── tencent_moderation.py # 腾讯云图片审核
│   ├── volcano_tos.py      # 火山引擎 TOS 对象存储（图片中转）
│   ├── volcano_ark.py       # 火山方舟豆包多模态 + Seedream（首选 AI）
│   ├── qwen_llm.py          # 通义千问菜谱推荐
│   └── xfyun_asr.py         # 讯飞语音识别
└── static/              # 美化图片落盘目录（运行时生成）
```
