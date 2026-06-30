"""
味记 AI 服务 (FastAPI)
纯 AI 服务层，提供图片识别、图片美化、菜谱推荐、语音识别、贴纸生成等 AI 能力。

注意：业务端点（认证、记录、家庭、成就、打卡、用户、挑战等）已迁移至 cool-admin 后端，
      由 cool-admin 代理层统一对外暴露，并在转发时补全 /api 前缀。
      本服务仅暴露 /health 与 /ai/* 路径。
"""
import asyncio
import os
import uuid

from fastapi import FastAPI, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import Any
import logging

from config import settings, log_config_status
from exceptions import AiProviderError, AiAuthError, AiQuotaError, AiInvalidInputError

from services.baidu_vision import recognize_dish as baidu_recognize
from services.openai_vision import recognize_dish as openai_recognize
from services.tencent_moderation import check_image as tencent_check
from services.volcano_image import beautify as volcano_beautify
from services.qwen_llm import recommend as qwen_recommend
from services.xfyun_asr import recognize as xfyun_recognize

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="味记 AI 服务", version="0.1.0")

# ============================================================
# CORS 中间件（允许 cool-admin 后端调用）
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 启动时打印各 AI 厂商配置状态（不打印 key 值，缺失时降级返回 mock 数据）
log_config_status()

# 确保静态文件目录存在（beautify 端点降级时落盘原图使用）
os.makedirs('static', exist_ok=True)

# /static 路径访问限制：仅允许白名单 Referer 的请求，阻止匿名外部枚举
STATIC_ALLOWED_REFERERS = (
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8001',
)


@app.middleware('http')
async def restrict_static(request: Request, call_next):
    if request.url.path.startswith('/static'):
        referer = request.headers.get('referer', '')
        if not any(referer.startswith(allowed) for allowed in STATIC_ALLOWED_REFERERS):
            return JSONResponse(status_code=403, content={'code': 403, 'message': 'Forbidden'})
    return await call_next(request)


app.mount('/static', StaticFiles(directory='static'), name='static')


# ============================================================
# 统一响应辅助函数
# ============================================================
def ok(data: Any, message: str = "") -> JSONResponse:
    """统一成功响应格式：{ code: 0, data, message }"""
    return JSONResponse({"code": 0, "data": data, "message": message})


def fail(message: str, code: int = 1, data: Any = None) -> JSONResponse:
    """统一失败响应格式"""
    return JSONResponse({"code": code, "data": data, "message": message})


# ============================================================
# 基础健康检查
# ============================================================
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "weiji-ai"}


# ============================================================
# 降级用 mock 数据（key 缺失或服务异常时返回演示数据）
# ============================================================
def _mock_recognize_data():
    """食物识别降级演示数据"""
    return {
        "dishName": "红烧牛肉面",
        "ingredients": [
            {"name": "牛肉", "confidence": 0.95},
            {"name": "面条", "confidence": 0.92},
            {"name": "青菜", "confidence": 0.88},
            {"name": "辣椒", "confidence": 0.85},
        ],
        "cookingMethod": "炖",
        "confidence": 0.96,
        "nutrition": {
            "calories": 520,
            "protein": 28.5,
            "fat": 18.2,
            "carbs": 62.0,
        },
        "imageUrl": "assets/food-camera-preview.jpg",
        "needManualInput": False,
    }


def _mock_recommend_data():
    """菜谱推荐降级示例数据"""
    return {
        "recipes": [
            {
                "id": "rec-rec-001",
                "name": "番茄牛腩",
                "imageUrl": "assets/recipe-tomato-beef.jpg",
                "category": "家常菜",
                "difficulty": "中等",
                "cookTime": "45分钟",
                "reason": "根据你最近记录的菜品，推荐搭配营养均衡的番茄牛腩。",
                "matchScore": 0.92,
            },
            {
                "id": "rec-rec-002",
                "name": "清炒时蔬",
                "imageUrl": "assets/recipe-veggie.jpg",
                "category": "家常菜",
                "difficulty": "简单",
                "cookTime": "10分钟",
                "reason": "今日摄入肉类较多，推荐一道清爽蔬菜平衡膳食。",
                "matchScore": 0.85,
            },
            {
                "id": "rec-rec-003",
                "name": "银耳莲子羹",
                "imageUrl": "assets/recipe-silver-lotus.jpg",
                "category": "甜品",
                "difficulty": "简单",
                "cookTime": "30分钟",
                "reason": "适合晚餐后润燥养胃的甜品。",
                "matchScore": 0.78,
            },
        ],
        "message": "为你推荐了3道菜谱",
    }


# ============================================================
# 食物识别服务
# ============================================================
@app.post("/ai/recognize")
async def recognize_food(image: UploadFile = File(...)):
    """
    食物图片识别
    流程：腾讯云审核 + 百度识别 并行 → 违规拦截 → 百度 confidence ≥ 0.8 直接返回
         → < 0.8 或百度失败调 GPT-4o 兜底 → 任一异常降级返回 mock
    """
    try:
        image_bytes = await image.read()

        # 百度识别用 try/except 包裹单独捕获，失败时返回 None 触发 GPT 兜底
        async def _safe_baidu():
            try:
                return await baidu_recognize(image_bytes)
            except AiProviderError:
                return None

        # 并行：腾讯云审核 + 百度识别
        moderation_result, baidu_result = await asyncio.gather(
            tencent_check(image_bytes),
            _safe_baidu(),
        )

        # 违规拦截
        if not moderation_result:
            return fail("图片内容不合规，请更换图片后重试")

        # 百度高置信度直接返回
        if baidu_result and baidu_result.get('confidence', 0) >= 0.8:
            return ok({
                **baidu_result,
                'imageUrl': '',
                'needManualInput': False,
            })

        # 百度低置信度或失败 → GPT-4o 兜底
        try:
            gpt_result = await openai_recognize(image_bytes)
            return ok({
                **gpt_result,
                'imageUrl': '',
                'needManualInput': False,
            })
        except AiAuthError:
            # GPT key 也缺失，降级返回 mock
            return ok(_mock_recognize_data(), message="未配置 AI 识别 Key，返回演示数据")
        except AiProviderError:
            return ok(_mock_recognize_data(), message="AI 识别服务暂不可用，返回演示数据")
    except Exception:
        logger.exception("recognize_food error")
        return ok(_mock_recognize_data(), message="识别服务异常，返回演示数据")


# ============================================================
# 图片美化服务
# ============================================================
@app.post("/ai/beautify")
async def beautify_image(image: UploadFile = File(...), style: str = "auto"):
    """
    AI 图片美化
    调用火山引擎，失败时降级返回原图保存到 static
    """
    try:
        image_bytes = await image.read()
        # 保存原图作为 fallback
        original_filename = f"original_{uuid.uuid4().hex}.jpg"
        original_path = f"static/{original_filename}"
        with open(original_path, 'wb') as f:
            f.write(image_bytes)

        try:
            beautified_bytes = await volcano_beautify(image_bytes, style)
            filename = f"beautified_{uuid.uuid4().hex}.jpg"
            filepath = f"static/{filename}"
            with open(filepath, 'wb') as f:
                f.write(beautified_bytes)
            return ok({
                'beautifiedUrl': f'/static/{filename}',
                'originalUrl': f'/static/{original_filename}',
                'style': style,
                'message': '美化完成',
            })
        except AiAuthError:
            return ok({
                'beautifiedUrl': f'/static/{original_filename}',
                'originalUrl': f'/static/{original_filename}',
                'style': style,
                'message': '未配置火山引擎 Key，已返回原图',
            })
        except AiProviderError:
            return ok({
                'beautifiedUrl': f'/static/{original_filename}',
                'originalUrl': f'/static/{original_filename}',
                'style': style,
                'message': '美化服务暂不可用，已返回原图',
            })
    except Exception:
        logger.exception("beautify_image error")
        return fail("图片处理异常，请稍后重试")


# ============================================================
# 菜谱推荐服务
# ============================================================
@app.post("/ai/recommend")
async def recommend_recipe(request: dict):
    """
    菜谱推荐（LLM）
    调用通义千问，失败时降级返回 mock
    """
    dish_name = request.get('dishName', '')
    recent_records = request.get('recentRecords')

    try:
        recipes = await qwen_recommend(dish_name, recent_records)
        return ok({
            'recipes': recipes,
            'message': f'为你推荐了 {len(recipes)} 道菜谱',
        })
    except AiAuthError:
        return ok(_mock_recommend_data(), message="未配置通义千问 Key，返回推荐示例")
    except AiProviderError:
        return ok(_mock_recommend_data(), message="AI 推荐暂不可用，已返回推荐示例")
    except Exception:
        logger.exception("recommend_recipe error")
        return ok(_mock_recommend_data(), message="推荐服务异常，返回推荐示例")


# ============================================================
# 语音识别服务
# ============================================================
@app.post("/ai/voice/recognize")
async def recognize_voice(audio: UploadFile = File(...)):
    """
    语音识别
    调用讯飞 ASR，失败时降级返回空文本
    """
    try:
        audio_bytes = await audio.read()
        try:
            text = await xfyun_recognize(audio_bytes)
            return ok({'text': text, 'message': '识别成功'})
        except AiAuthError:
            return ok({'text': '', 'message': '未配置讯飞 Key，语音识别不可用'})
        except AiProviderError:
            return ok({'text': '', 'message': '语音识别暂不可用'})
    except Exception:
        logger.exception("recognize_voice error")
        return ok({'text': '', 'message': '语音识别服务异常'})


# ============================================================
# AI 贴纸生成
# ============================================================
@app.post("/ai/sticker")
async def generate_sticker(image: UploadFile = File(...), style: str = "default"):
    """
    AI 贴纸生成
    保留 mock 实现，标注 TODO 等待后续集成
    """
    # TODO: 集成 AI 贴纸生成（火山引擎/通义万相）
    data = {
        "stickerUrl": "assets/sticker-generated.png",
        "style": style,
        "message": "贴纸生成功能开发中",
    }
    return ok(data)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
