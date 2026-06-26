# Tasks

- [x] Task 1: 搭建 weiji-ai 配置与异常基础设施
  - [ ] SubTask 1.1: 创建 `weiji-ai/config.py`，定义 `Settings` 类（dataclass 或 pydantic BaseSettings），从 `os.environ` 读取所有厂商 key：`BAIDU_API_KEY`、`BAIDU_SECRET_KEY`、`OPENAI_API_KEY`、`VOLCANO_ACCESS_KEY`、`VOLCANO_SECRET_KEY`、`QWEN_API_KEY`（或复用 OPENAI_API_KEY + `QWEN_BASE_URL`）、`XFYUN_APP_ID`、`XFYUN_API_KEY`、`XFYUN_API_SECRET`、`TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`；缺失 key 时打印 WARNING 日志（含申请链接），不抛错
  - [ ] SubTask 1.2: 创建 `weiji-ai/exceptions.py`，定义 `AiProviderError`（基类）、`AiQuotaError`（配额超限）、`AiInvalidInputError`（参数错误）、`AiAuthError`（鉴权失败），每个异常携带 `provider` 和 `message` 字段
  - [ ] SubTask 1.3: 修改 `weiji-ai/requirements.txt`，追加 `openai>=1.40.0`、`httpx>=0.27.0`、`python-dotenv>=1.0.0`
  - [ ] SubTask 1.4: 修改 `weiji-ai/main.py`，import config 和 exceptions；启动时调用 `Settings()` 单例化并打印已配置的厂商清单（不打印 key 值）

- [x] Task 2: 实现百度AI 菜品识别
  - [ ] SubTask 2.1: 创建 `weiji-ai/services/baidu_vision.py`，实现 `async recognize_dish(image_bytes: bytes) -> dict`：
    - access_token 获取：用 API Key + Secret Key 调 `https://aip.baidubce.com/oauth/2.0/token`，缓存 token + 过期时间（提前 5 分钟刷新）
    - 调用菜品识别接口 `https://aip.baidubce.com/rest/2.0/image-classify/v2/dish`，body 为 `{ image: base64(image_bytes), top_num: 1, BaiKeNum: 1 }`
    - 解析响应：取 `result[0].name` 作为 dishName，`result[0].probability`（0-1）作为 confidence；若无 result 抛 `AiProviderError('baidu', '未识别到菜品')`
    - 食材和营养信息百度不直接返回，留空或调用后续 GPT-4o 兜底时补充
  - [ ] SubTask 2.2: 单元测试占位（不强制真集成测试，至少 import 不报错）

- [x] Task 3: 实现 GPT-4o Vision 兜底识别
  - [ ] SubTask 3.1: 创建 `weiji-ai/services/openai_vision.py`，实现 `async recognize_dish(image_bytes: bytes) -> dict`：
    - 用 `openai` SDK（>=1.40 支持 `AsyncOpenAI` 客户端）
    - 调用 `client.chat.completions.create(model='gpt-4o', messages=[{role:'user', content:[{type:'text', text:<prompt>}, {type:'image_url', image_url:{url: data:image/jpeg;base64,<base64>}}]}], response_format:{type:'json_object'})`
    - prompt 要求模型返回严格 JSON：`{"dishName": str, "ingredients": [{"name": str, "confidence": 0.9}], "cookingMethod": str, "confidence": 0.9, "nutrition": {"calories": int, "protein": float, "fat": float, "carbs": float}}`
    - 解析 JSON，confidence 统一设为 0.9（标识来自 GPT）
    - key 缺失时抛 `AiAuthError('openai', 'OPENAI_API_KEY 未配置')`

- [x] Task 4: 实现腾讯云图片审核（轻量集成）
  - [ ] SubTask 4.1: 在 `weiji-ai/services/tencent_moderation.py` 实现 `async check_image(image_bytes: bytes) -> bool`（True=合规，False=违规）：
    - 简化方案：调用腾讯云内容安全 `ImageModeration` 接口，传 base64 图片
    - key 缺失时直接返回 True（不阻塞，视为合规）
    - 接口异常时返回 True（容错优先，避免误伤）
  - [ ] SubTask 4.2: 在 recognize_food 流程中并行调用（`asyncio.gather` 与百度识别并行），违规时返回降级提示

- [x] Task 5: 实现火山引擎图片美化
  - [ ] SubTask 5.1: 创建 `weiji-ai/services/volcano_image.py`，实现 `async beautify(image_bytes: bytes, style: str) -> bytes`：
    - 简化方案：调用火山引擎视觉智能 `ImageEnhancement` 或类似 API（亮度/对比度增强）
    - 返回美化后的图片字节流
  - [ ] SubTask 5.2: 创建 `weiji-ai/static/` 目录，beautify 端点将美化后图片保存为 `static/beautified_<uuid>.jpg`，返回 URL 路径 `/static/beautified_<uuid>.jpg`
  - [ ] SubTask 5.3: 在 main.py 挂载 StaticFiles：`app.mount('/static', StaticFiles(directory='static'))`

- [x] Task 6: 实现通义千问菜谱推荐
  - [ ] SubTask 6.1: 创建 `weiji-ai/services/qwen_llm.py`，实现 `async recommend(dish_name: str, recent_records: list = None) -> list`：
    - 用 `openai` SDK + `QWEN_BASE_URL='https://dashscope.aliyuncs.com/compatible-mode/v1'`，复用 `OPENAI_API_KEY` 或独立 `QWEN_API_KEY`
    - model 用 `qwen-turbo`（性价比高，响应快）
    - prompt 引导：基于 dish_name 和 recent_records 生成 3 道搭配合理的菜谱，返回 JSON 数组，每项含 `id/name/category/difficulty/cookTime/reason/matchScore(0-1)`
    - 解析 JSON，构造 3 道菜谱返回

- [x] Task 7: 实现讯飞语音识别
  - [ ] SubTask 7.1: 创建 `weiji-ai/services/xfyun_asr.py`，实现 `async recognize(audio_bytes: bytes) -> str`：
    - 简化方案：用讯飞 REST API（非 WebSocket），上传音频文件，等待识别结果
    - 鉴权签名：按讯飞文档生成 hmac-sha1 签名
    - 返回识别文本

- [x] Task 8: 改造 main.py 5 个端点接入真实能力 + 降级
  - [ ] SubTask 8.1: 改造 `recognize_food`：
    - 流程：腾讯云审核 + 百度识别 并行 → 若违规返回降级提示 → 百度 confidence ≥ 0.8 直接返回 → < 0.8 或百度失败调 GPT-4o → 任一异常 try/except 降级返回 mock + message
    - 响应字段保持与原 mock 一致：`{ dishName, ingredients, cookingMethod, confidence, nutrition, imageUrl, needManualInput }`
  - [ ] SubTask 8.2: 改造 `beautify_image`：调 volcano_image.beautify → 保存到 static → 返回 `{ beautifiedUrl: '/static/xxx.jpg', originalUrl, style, message }`；失败降级返回原图 + 提示
  - [ ] SubTask 8.3: 改造 `recommend_recipe`：接收 `{ dishName, recentRecords? }`，调 qwen_llm.recommend → 返回 `{ recipes, message }`；失败降级返回 mock + `message: "AI 推荐暂不可用，已返回推荐示例"`
  - [ ] SubTask 8.4: 改造 `recognize_voice`：调 xfyun_asr.recognize → 返回 `{ text, message }`；失败降级返回 `{ text: "", message: "语音识别暂不可用" }`
  - [ ] SubTask 8.5: 改造 `generate_sticker`：保留 mock，返回 `message: "贴纸生成功能开发中"`，不调任何外部 API
  - [ ] SubTask 8.6: 所有端点 try/except 包裹 `AiProviderError` 及子类，降级时调用原 mock 数据生成函数（保留在 services 模块内）

- [x] Task 9: 更新 README 与启动验证
  - [ ] SubTask 9.1: 创建/更新 `weiji-ai/README.md`，列出环境变量清单（key 名 / 用途 / 申请链接 / 缺失降级行为）
  - [ ] SubTask 9.2: 启动 weiji-ai（`uvicorn main:app --port 8002`）验证：
    - `/health` 仍返回 200
    - 配置全部 key 缺失时，5 个端点均返回 mock + 降级提示，不崩溃
    - 配置 OPENAI_API_KEY 后，`/ai/recommend` 返回真实通义千问推荐（或 GPT-4o 兜底识别生效，需上传真实图片）

# Task Dependencies
- Task 2/3/4/5/6/7 依赖 Task 1（需要 config 和 exceptions 基础设施）
- Task 2/3/4/5/6/7 之间无依赖，可并行实现
- Task 8 依赖 Task 2-7（需要 5 个 service 模块就绪）
- Task 9 依赖 Task 1-8
