# Checklist

## 配置与异常基础设施
- [x] `weiji-ai/config.py` 存在，定义 `Settings` 类，从环境变量读取所有 10 个厂商 key
- [x] 缺失 key 时打印 WARNING 日志（含申请链接），不阻止启动
- [x] `weiji-ai/exceptions.py` 定义 `AiProviderError` / `AiQuotaError` / `AiInvalidInputError` / `AiAuthError` 四个异常类型
- [x] `weiji-ai/requirements.txt` 追加 `openai>=1.40.0` / `httpx>=0.27.0` / `python-dotenv>=1.0.0`
- [x] main.py 启动时实例化 Settings 并打印已配置厂商清单（不打印 key 值）

## 百度AI 菜品识别
- [x] `weiji-ai/services/baidu_vision.py` 实现 `recognize_dish(image_bytes) -> dict`
- [x] access_token 缓存 + 提前 5 分钟刷新
- [x] 返回 `{ dishName, confidence }`（ingredients/nutrition 留空，由 GPT 兜底补充）
- [x] 无识别结果时抛 `AiProviderError('baidu', '未识别到菜品')`

## GPT-4o Vision 兜底
- [x] `weiji-ai/services/openai_vision.py` 实现 `recognize_dish(image_bytes) -> dict`
- [x] 使用 AsyncOpenAI 客户端，model=gpt-4o，response_format=json_object
- [x] prompt 要求返回结构化 JSON（dishName/ingredients/cookingMethod/confidence/nutrition）
- [x] confidence 统一 0.9
- [x] key 缺失抛 `AiAuthError('openai', 'OPENAI_API_KEY 未配置')`

## 腾讯云图片审核
- [x] `weiji-ai/services/tencent_moderation.py` 实现 `check_image(image_bytes) -> bool`
- [x] key 缺失或接口异常时返回 True（容错优先）
- [x] 在 recognize_food 流程中与百度识别并行调用（asyncio.gather）
- [x] 违规时返回 `{ code: 1, message: "图片内容不合规，请更换图片后重试" }`

## 火山引擎图片美化
- [x] `weiji-ai/services/volcano_image.py` 实现 `beautify(image_bytes, style) -> bytes`
- [x] `weiji-ai/static/` 目录存在，beautify 端点保存美化图片到 static
- [x] main.py 挂载 `app.mount('/static', StaticFiles(directory='static'))`
- [x] 返回 `{ beautifiedUrl: '/static/xxx.jpg', originalUrl, style, message }`
- [x] 失败降级返回原图 + `message: "美化服务暂不可用，已返回原图"`

## 通义千问菜谱推荐
- [x] `weiji-ai/services/qwen_llm.py` 实现 `recommend(dish_name, recent_records) -> list`
- [x] 使用 openai SDK + QWEN_BASE_URL，model=qwen-turbo
- [x] 返回 3 道菜谱，每项含 `id/name/category/difficulty/cookTime/reason/matchScore`
- [x] 失败降级返回 mock + `message: "AI 推荐暂不可用，已返回推荐示例"`

## 讯飞语音识别
- [x] `weiji-ai/services/xfyun_asr.py` 实现 `recognize(audio_bytes) -> str`
- [x] 鉴权签名按讯飞文档生成 hmac-sha1
- [x] 返回识别文本
- [x] 失败降级返回 `{ text: "", message: "语音识别暂不可用" }`

## main.py 端点改造
- [x] `recognize_food`：百度+GPT-4o 兜底 + 腾讯云审核并行，响应字段与原 mock 一致
- [x] `beautify_image`：调 volcano + 保存 static + 返回 URL，失败降级
- [x] `recommend_recipe`：接收 `{ dishName, recentRecords? }`，调 qwen，失败降级
- [x] `recognize_voice`：调讯飞，失败降级
- [x] `generate_sticker`：保留 mock + `message: "贴纸生成功能开发中"`，不调外部 API
- [x] 所有端点 try/except 包裹，外部 API 失败时降级返回友好提示，不向代理层抛 500

## README 与启动验证
- [x] `weiji-ai/README.md` 列出 10 个环境变量（key 名 / 用途 / 申请链接 / 缺失降级行为）
- [x] `uvicorn main:app --port 8002` 可正常启动
- [x] `/health` 返回 200
- [x] 配置全部 key 缺失时，5 个端点均返回 mock + 降级提示，不崩溃
- [ ] 配置 OPENAI_API_KEY 后，`/ai/recommend` 返回真实通义千问推荐
- [ ] 配置 OPENAI_API_KEY + 上传真实图片，`/ai/recognize` GPT-4o 兜底生效
