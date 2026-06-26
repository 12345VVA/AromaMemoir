# 集成真实 AI 能力 Spec

## Why

上一轮 `implement-cooladmin-backend` 已让三服务架构成立、业务后端 35+ 端点真实生效，但 weiji-ai（Python AI 服务）的 5 个 AI 端点仍全部返回硬编码假数据，6 家外部 AI 厂商集成（百度AI / GPT-4o / 火山引擎 / 通义千问 / 讯飞 / 腾讯云审核）全是 `# TODO`。这是当前阻碍项目从"端到端跑通"升级到"可真实使用"的唯一硬阻塞。

本 spec 目标是用最小集成成本让 5 个 AI 端点接入真实外部能力，**前端、cool-admin 后端代理层、响应契约全部不变**——所有改动集中在 weiji-ai 内部。用户已说明会在环境变量中设置 apiKey，因此所有密钥从 `os.environ` 读取，不写入代码、不写入 .env、不纳入 git。

## What Changes

- **新增** weiji-ai 依赖：`openai`（同时用于 GPT-4o Vision 兜底识别 + 通义千问推荐，二者均兼容 OpenAI SDK 协议）、`httpx`（异步 HTTP，调用百度/火山/讯飞 REST API）、`python-dotenv`（可选，便于本地用 .env 调试，但生产从环境变量读）
- **新增** `weiji-ai/services/` 目录：每个 AI 厂商一个独立模块，单一职责
  - `baidu_vision.py` — 百度AI 菜品识别（access_token 自动刷新 + 图片 base64 调用）
  - `openai_vision.py` — GPT-4o Vision 菜品识别兜底（置信度 < 0.8 时触发，prompt 要求返回结构化 JSON）
  - `volcano_image.py` — 火山引擎图片美化（调用视觉智能 SDK 或 REST，简化为亮度/对比度增强 API）
  - `qwen_llm.py` — 通义千问菜谱推荐（OpenAI 兼容协议调用，prompt 引导基于已有菜品推荐）
  - `xfyun_asr.py` — 讯飞语音识别（音频文件转文字，REST + WebSocket 二选一，本 spec 用 REST 简化）
  - `tencent moderation` — **不单独建模块**，仅在 recognize_food 流程内做内容审核（图片违规时返回降级提示，不阻塞主流程）
- **新增** `weiji-ai/config.py`：集中读取环境变量，提供 `Settings` 配置类，缺失 key 时启动警告但不崩溃（保留 mock 兜底，便于无 key 环境仍可运行）
- **新增** `weiji-ai/exceptions.py`：统一 AI 异常类型（`AiProviderError`、`AiQuotaError`、`AiInvalidInputError`），供控制器降级处理
- **修改** `weiji-ai/main.py`：
  - 5 个端点改为调用对应 service 模块，替换硬编码 mock
  - 每个端点 try/except 包裹：失败时降级返回友好提示（沿用现有 `fail()` 响应格式），不暴露内部错误
  - `recognize_food` 流程：百度识别 → 置信度 ≥ 0.8 直接返回；< 0.8 调 GPT-4o 兜底；腾讯云审核并行调用（违规时返回降级提示，不阻塞）
  - `recommend_recipe`：接收 `{ dishName, recentRecords? }`，调用通义千问返回 3 道推荐菜谱
  - `generate_sticker`：保留 mock 实现（贴纸生成涉及异步任务，本 spec 不集成真实厂商，仅标注 TODO 并返回 mock + 提示文案"贴纸生成功能开发中"）
- **修改** `weiji-ai/requirements.txt`：追加 `openai>=1.40.0`、`httpx>=0.27.0`、`python-dotenv>=1.0.0`
- **修改** `weiji-ai/README.md`：列出所需环境变量清单（key 名 + 用途 + 申请链接），说明缺失时降级策略
- **不修改**：weiji-server 代理层（契约对齐，无需改动）、weiji-admin-web 前端（消费方契约不变）

## Impact

- Affected specs:
  - `implement-cooladmin-backend`（AI 代理层契约保持不变，本 spec 仅替换 weiji-ai 内部实现）
  - `separate-ai-cooladmin-migration`（AI 服务定位从"纯 mock 桩"升级为"真实 AI 能力"）
- Affected code:
  - 修改 [weiji-ai/main.py](file:///workspace/weiji-ai/main.py)（5 个端点接入真实调用 + 降级）
  - 修改 [weiji-ai/requirements.txt](file:///workspace/weiji-ai/requirements.txt)（追加依赖）
  - 新增 `weiji-ai/services/` 目录（5 个厂商模块）
  - 新增 `weiji-ai/config.py`、`weiji-ai/exceptions.py`
  - 新增/修改 `weiji-ai/README.md`

## ADDED Requirements

### Requirement: 环境变量驱动的密钥管理
系统 SHALL 从环境变量读取所有外部 AI 厂商的 API Key，不得硬编码、不得写入 .env 文件提交到 git。

#### Scenario: 启动时检查密钥
- **WHEN** weiji-ai 启动
- **THEN** 读取环境变量构造 `Settings` 对象，缺失的 key 打印 WARNING 日志（标注用途和申请链接），但不阻止启动

#### Scenario: 端点调用时密钥缺失
- **WHEN** 请求到达某个 AI 端点，但对应厂商的 key 未配置
- **THEN** 端点降级返回 mock 数据或友好提示（`{ code: 0, data: <mock>, message: "未配置 API Key，返回演示数据" }`），不抛 500

### Requirement: 食物识别多源融合
系统 SHALL 实现百度AI 菜品识别为主、GPT-4o Vision 为辅的食物识别流程，置信度低于 0.8 时自动降级到 GPT-4o。

#### Scenario: 百度识别高置信度
- **WHEN** 用户上传食物图片，百度AI 返回置信度 ≥ 0.8
- **THEN** 直接采用百度结果，返回 `{ dishName, ingredients, cookingMethod, confidence, nutrition, imageUrl, needManualInput: false }`

#### Scenario: 百度低置信度触发 GPT-4o
- **WHEN** 百度返回置信度 < 0.8 或百度调用失败
- **THEN** 调用 GPT-4o Vision，prompt 要求模型返回结构化 JSON（dishName/ingredients/cookingMethod/confidence/nutrition），结果置信度统一为 0.9（标识来自 GPT）

#### Scenario: 图片违规
- **WHEN** 腾讯云内容审核判定图片违规
- **THEN** 返回 `{ code: 1, message: "图片内容不合规，请更换图片后重试" }`，不进行识别

### Requirement: 菜谱推荐 LLM 接入
系统 SHALL 调用通义千问（Qwen）实现菜谱推荐，基于用户输入的菜品名和最近记录生成 3 道推荐菜谱。

#### Scenario: 推荐成功
- **WHEN** 用户 `POST /ai/recommend` 提供 `{ dishName, recentRecords? }`
- **THEN** 调用通义千问，prompt 引导模型基于 dishName 和 recentRecords 生成 3 道搭配合理的菜谱，返回 `{ recipes: [{ id, name, category, difficulty, cookTime, reason, matchScore }], message }`

#### Scenario: LLM 不可用降级
- **WHEN** 通义千问调用失败或 key 缺失
- **THEN** 返回 mock 数据 + `message: "AI 推荐暂不可用，已返回推荐示例"`，不阻塞前端

### Requirement: 图片美化
系统 SHALL 调用火山引擎视觉智能 API 实现图片美化（亮度/对比度增强）。

#### Scenario: 美化成功
- **WHEN** 用户 `POST /ai/beautify` 上传图片
- **THEN** 调用火山引擎，返回美化后的图片 URL（保存到本地 static 目录，返回相对路径）

#### Scenario: 美化失败降级
- **WHEN** 火山引擎调用失败
- **THEN** 返回原图 URL + `message: "美化服务暂不可用，已返回原图"`

### Requirement: 语音识别
系统 SHALL 调用讯飞 ASR 实现语音转文字。

#### Scenario: 识别成功
- **WHEN** 用户 `POST /ai/voice/recognize` 上传音频文件
- **THEN** 调用讯飞 ASR REST API，返回 `{ text, message: "识别成功" }`

#### Scenario: 识别失败降级
- **WHEN** 讯飞调用失败
- **THEN** 返回 `{ text: "", message: "语音识别暂不可用" }`

### Requirement: 贴纸生成（保留 mock）
系统 SHALL 保留贴纸生成端点的 mock 实现，标注 TODO 等待后续集成。

#### Scenario: 调用贴纸生成
- **WHEN** 用户 `POST /ai/sticker`
- **THEN** 返回 mock 数据 + `message: "贴纸生成功能开发中"`，不调用任何外部 API

### Requirement: 统一异常与降级
系统 SHALL 对所有 AI 端点包裹 try/except，外部 API 失败时降级返回友好提示，不向 cool-admin 代理层抛 500。

#### Scenario: 任一 AI 厂商调用异常
- **WHEN** 网络/配额/参数错误导致厂商 API 抛错
- **THEN** weiji-ai 内部捕获，返回 `{ code: 1, message: "<具体场景>服务暂不可用，请稍后重试" }`，cool-admin 代理层透传给前端

## MODIFIED Requirements

### Requirement: weiji-ai 服务定位
现 `separate-ai-cooladmin-migration` spec 定义 weiji-ai 为"纯 AI 层，仅暴露 /health 与 /ai/*"。本 spec 在保持路径契约不变的前提下，将 5 个端点从 mock 升级为真实外部 AI 能力，使 weiji-ai 真正承担 AI 服务定位。

### Requirement: 端到端核心闭环
现 `implement-cooladmin-backend` 的端到端闭环（登录 → 首页 → 拍照识别 → 保存 → 列表刷新）中"拍照识别"环节从 mock 升级为真实百度+GPT-4o 识别，使闭环具备真实使用价值。

## REMOVED Requirements

### Requirement: 硬编码 mock 数据
**Reason**: 5 个 AI 端点的硬编码假数据已被真实厂商调用替换（贴纸端点除外）。
**Migration**: mock 数据保留在 service 模块内作为"密钥缺失时的降级返回"，确保无 key 环境仍可运行。
