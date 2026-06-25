"""
味记 AI 服务 (FastAPI)
纯 AI 服务层，提供图片识别、图片美化、菜谱推荐、语音识别、贴纸生成等 AI 能力。

注意：业务端点（认证、记录、家庭、成就、打卡、用户、挑战等）已迁移至 cool-admin 后端，
      由 cool-admin 代理层统一对外暴露，并在转发时补全 /api 前缀。
      本服务仅暴露 /health 与 /ai/* 路径。
"""
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="味记 AI 服务", version="0.1.0")

# ============================================================
# CORS 中间件（允许 cool-admin 后端调用）
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
# 食物识别服务
# ============================================================
@app.post("/ai/recognize")
async def recognize_food(image: UploadFile = File(...)):
    """
    食物图片识别
    调用百度AI菜品识别，置信度 < 0.8 时 GPT-4o Vision 兜底
    """
    # TODO: 集成百度AI菜品识别
    # TODO: 集成 GPT-4o Vision 兜底
    data = {
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
    return ok(data)


# ============================================================
# 图片美化服务
# ============================================================
@app.post("/ai/beautify")
async def beautify_image(image: UploadFile = File(...), style: str = "auto"):
    """
    AI 图片美化
    调用火山引擎智能美化 API
    """
    # TODO: 集成火山引擎智能美化
    data = {
        "beautifiedUrl": "assets/food-beautified.jpg",
        "originalUrl": "assets/food-camera-preview.jpg",
        "style": style,
        "message": "美化完成",
    }
    return ok(data)


# ============================================================
# 菜谱推荐服务
# ============================================================
@app.post("/ai/recommend")
async def recommend_recipe(request: dict):
    """
    菜谱推荐（LLM + RAG）
    调用通义千问 Qwen3.5，支持流式响应
    """
    # TODO: 集成通义千问 + RAG 检索
    data = {
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
    return ok(data)


# ============================================================
# 语音识别服务
# ============================================================
@app.post("/ai/voice/recognize")
async def recognize_voice(audio: UploadFile = File(...)):
    """
    语音识别代理
    调用科大讯飞 ASR
    """
    # TODO: 集成科大讯飞语音识别
    data = {
        "text": "今天中午吃了一碗红烧牛肉面，味道很不错。",
        "message": "识别成功",
    }
    return ok(data)


# ============================================================
# AI 贴纸生成
# ============================================================
@app.post("/ai/sticker")
async def generate_sticker(image: UploadFile = File(...), style: str = "default"):
    """
    AI 贴纸生成
    异步任务，调用火山引擎/通义万相
    """
    # TODO: 集成 AI 贴纸生成
    data = {
        "stickerUrl": "assets/sticker-generated.png",
        "style": style,
        "message": "贴纸生成成功",
    }
    return ok(data)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
