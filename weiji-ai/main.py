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

from fastapi import FastAPI, File, UploadFile, Request, Form
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
from services.qwen_llm import recommend as qwen_recommend
from services.xfyun_asr import recognize as xfyun_recognize
from services.volcano_tos import upload_image as volcano_tos_upload
from services.volcano_ark import recognize_dish as ark_recognize
from services.volcano_ark import recommend as ark_recommend
from services.volcano_ark import edit_image as ark_edit_image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="味记 AI 服务", version="0.1.0")

# ============================================================
# CORS 中间件（允许 cool-admin 后端调用）
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:17900", "http://127.0.0.1:17900", "http://localhost:17801"],
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
    'http://localhost:17900',
    'http://127.0.0.1:17900',
    'http://localhost:17801',
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
# 允许的样式枚举（beautify / sticker 端点 style 参数白名单，防止 prompt 注入）
_ALLOWED_STYLES = {'auto', 'enhance', 'vivid', 'poster', 'sticker', 'cute', 'cartoon', 'art', 'default'}


def _validate_style(style: str) -> bool:
    """校验 style 参数：在白名单内且长度 ≤50。"""
    if not isinstance(style, str) or len(style) > 50:
        return False
    return style in _ALLOWED_STYLES


# ============================================================
# 图片美化提示词（按 style 分支，专业美食摄影指令）
# ============================================================
# 核心约束：保持食物主体（种类、形态、摆盘、器皿）基本不变，仅增强环境
# （背景、光影、色彩、构图、滤镜）。否则 Seedream 图生图会把菜重绘成另一道菜，
# 失去“美化”意义。auto/default 综合去杂物+换干净背景+暖光+饱和+热气，食欲感拉满。
_BEAUTIFY_PROMPTS = {
    'auto': (
        "专业美食摄影级修图，保持图中食物主体（种类、形态、摆盘、器皿）基本不变，仅做以下增强："
        "1）背景：移除杂乱、抢镜的背景杂物与无关元素，替换为干净协调的桌面"
        "（浅色木纹 / 大理石 / 纯色亚光背景），可点缀少量新鲜食材或简洁餐具营造用餐氛围；"
        "2）光影：自然柔和的侧逆光 / 顶光，突出食物立体感与油亮光泽，高光不过曝、暗部保留细节；"
        "3）色彩：适度提升饱和度与对比度、暖色调偏移，强化食材本来的新鲜诱人色泽"
        "（肉质的油润、蔬菜的翠绿、酱汁的浓郁），明显增强食欲感；"
        "4）细节：锐化食物纹理（焦脆、汤汁、蓬松），适度添加袅袅升腾的热气；"
        "5）构图：浅景深虚化背景，使主体居中、平衡突出。"
        "整体风格温暖、明亮、诱人，呈现高级餐厅菜单或美食杂志大片质感。"
    ),
    'enhance': (
        "轻度美食修图：严格保持原图场景、摆盘与背景完全不变，仅提升清晰度与锐度、"
        "提亮画面、修正偏色与暗部、适度增强色彩饱和与对比，让食物更鲜亮、通透、诱人。"
    ),
    'vivid': (
        "浓郁滤镜风格美食大片：保持食物主体不变，大幅提升色彩饱和度与对比度、整体偏暖色调，"
        "强化油亮光泽、焦糖化反应的诱人色泽与升腾热气，背景做柔焦虚化，"
        "呈现鲜艳明快、冲击力强的美食摄影质感。"
    ),
    'art': (
        "艺术美食摄影：保持食物可识别，采用电影感打光、高级色彩调色与精致摆盘，"
        "背景简洁有质感（深色高级感或纯净留白），浅景深，"
        "呈现美食杂志封面级的艺术大片氛围。"
    ),
    'poster': (
        "商业美食海报级修图，保持图中食物主体（种类、形态、摆盘）基本不变，"
        "将其处理为高视觉冲击力的广告海报大片："
        "1）背景：替换为深色高级感纯色或柔和暗调渐变（深棕 / 墨黑 / 暖灰），"
        "四周留出干净留白以适合海报排版；"
        "2）光影：戏剧化聚光灯式打光，强高光与深邃暗部对比，突出食物立体感、"
        "油亮光泽与质感，营造舞台聚焦感；"
        "3）色彩：高饱和、高对比、暖色调偏移，强化食物诱人色泽与新鲜感；"
        "4）氛围：适度添加升腾热气、飞溅酱汁或散落食材等动感元素，增强画面张力；"
        "5）构图：主体居中突出、画面平衡，留白充足的广告海报构图。"
        "整体高级、诱人、有品牌广告大片质感，像米其林餐厅或美食品牌的宣传海报。"
    ),
    'sticker': (
        "将这张食物图片转为精致的卡通贴纸风格：保持食物可识别，线条圆润、色彩明快饱满、"
        "高光柔和，去除复杂背景替换为简洁纯色或柔和渐变底，整体可爱且有食欲。"
    ),
    'cute': (
        "将这张食物图片转为可爱日系插画美食风格：保持食物可识别，色彩柔和明亮、"
        "笔触细腻、带有温暖手绘感，背景简洁温馨，突出食物的诱人与萌感。"
    ),
    'cartoon': (
        "将这张食物图片转为精致卡通插画风格：保持食物可识别，造型圆润、色彩饱和明快、"
        "光影干净，背景简化为纯色或简洁图案，呈现像动画截图般诱人的美食画面。"
    ),
}


def _build_beautify_prompt(style: str) -> str:
    """根据 style 返回专业的食物美化提示词。default 等同 auto，未知值回退 auto。"""
    if style == 'default':
        style = 'auto'
    return _BEAUTIFY_PROMPTS.get(style) or _BEAUTIFY_PROMPTS['auto']


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
    流程：腾讯云审核 → 违规拦截
         → 首选火山方舟豆包多模态（先上传 TOS 再识别）
         → 火山方舟不可用时降级到百度（confidence ≥ 0.8）+ GPT-4o 兜底
         → 任一异常降级返回 mock
    """
    try:
        image_bytes = await image.read()

        # 腾讯云审核：key 未配置时跳过，调用异常时 fail-open 放行，仅审核成功且违规时拦截
        if settings.tencent_ready:
            try:
                moderation_result = await tencent_check(image_bytes)
                if not moderation_result:
                    return fail("图片内容不合规，请更换图片后重试")
            except Exception as mod_err:
                # 审核 key 配置但调用失败：fail-open 放行，不阻塞合规图；记 error 以便发现鉴权问题
                logger.error("腾讯云审核调用异常，fail-open 放行继续识别: %s", mod_err, exc_info=True)
        # tencent_ready 为 False 时直接跳过审核走识别

        # 首选：火山方舟豆包多模态（先上传 TOS 再识别）
        try:
            image_url = await volcano_tos_upload(image_bytes)
            ark_result = await ark_recognize(image_url)
            return ok({
                **ark_result,
                'imageUrl': image_url,  # 复用 TOS 原图 URL 供前端展示
                'needManualInput': False,
            })
        except (AiAuthError, AiProviderError) as ark_err:
            # key 缺失或调用异常均属预期降级，用 info 级别记录
            logger.info("火山方舟识别不可用，降级到百度+GPT-4o: %s", ark_err)

        # 降级：原 百度+GPT-4o 链路（保留原逻辑）
        async def _safe_baidu():
            try:
                return await baidu_recognize(image_bytes)
            except Exception:
                logger.exception("baidu recognize failed, fallback to GPT-4o")
                return None

        baidu_result = await _safe_baidu()

        # 百度高置信度直接返回
        if baidu_result and (baidu_result.get('confidence') or 0) >= 0.8:
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
async def beautify_image(image: UploadFile = File(...), style: str = Form("auto")):
    """
    AI 图片美化
    首选火山方舟豆包 Seedream（先上传 TOS 再编辑），返回 /static/ 落盘路径；
    火山方舟不可用时降级返回原图 static 路径（不再走旧 SDK 落盘美化图）。
    """
    if not _validate_style(style):
        return fail("不支持的样式参数")
    try:
        image_bytes = await image.read()

        # 腾讯云审核：key 未配置时跳过，调用异常 fail-open 放行，仅审核成功且违规时拦截
        if settings.tencent_ready:
            try:
                if not await tencent_check(image_bytes):
                    return fail("图片内容不合规，请更换图片后重试")
            except Exception as mod_err:
                logger.error("腾讯云审核调用异常，fail-open 放行继续美化: %s", mod_err, exc_info=True)

        # 保存原图作为 fallback
        original_filename = f"original_{uuid.uuid4().hex}.jpg"
        original_path = f"static/{original_filename}"
        with open(original_path, 'wb') as f:
            f.write(image_bytes)

        # 首选：火山方舟豆包 Seedream（先上传 TOS 再编辑）
        try:
            image_url = await volcano_tos_upload(image_bytes)
            prompt = _build_beautify_prompt(style)
            new_image_url = await ark_edit_image(image_url, prompt)
            return ok({
                'beautifiedUrl': new_image_url,
                'originalUrl': f'/static/{original_filename}',
                'style': style,
                'message': '美化完成',
            })
        except (AiAuthError, AiProviderError) as ark_err:
            # 火山方舟不可用，降级返回原图（key 缺失属预期，info 级别记录）
            logger.info("火山方舟美化不可用，降级返回原图: %s", ark_err)
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
    菜谱推荐
    首选火山方舟豆包多模态，失败时降级到通义千问，再降级返回 mock。
    """
    dish_name = request.get('dishName', '')
    recent_records = request.get('recentRecords')

    # 首选：火山方舟豆包多模态
    try:
        recipes = await ark_recommend(dish_name, recent_records)
        return ok({
            'recipes': recipes,
            'message': f'为你推荐了 {len(recipes)} 道菜谱',
        })
    except (AiAuthError, AiProviderError) as ark_err:
        # key 缺失或调用异常均属预期降级，用 info 级别记录
        logger.info("火山方舟推荐不可用，降级到通义千问: %s", ark_err)

    # 降级：通义千问
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
async def generate_sticker(image: UploadFile = File(...), style: str = Form("default")):
    """
    AI 贴纸生成
    首选火山方舟豆包 Seedream（先上传 TOS 再生成），返回 /static/ 落盘路径；
    火山方舟不可用时降级返回占位图。
    """
    if not _validate_style(style):
        return fail("不支持的样式参数")
    try:
        image_bytes = await image.read()

        # 腾讯云审核：key 未配置时跳过，调用异常 fail-open 放行，仅审核成功且违规时拦截
        if settings.tencent_ready:
            try:
                if not await tencent_check(image_bytes):
                    return fail("图片内容不合规，请更换图片后重试")
            except Exception as mod_err:
                logger.error("腾讯云审核调用异常，fail-open 放行继续贴纸: %s", mod_err, exc_info=True)

        # 首选：火山方舟豆包 Seedream 生成贴纸
        try:
            image_url = await volcano_tos_upload(image_bytes)
            prompt = f"将这张食物图片转换为可爱贴纸风格，风格：{style}"
            sticker_url = await ark_edit_image(image_url, prompt)
            return ok({
                'stickerUrl': sticker_url,
                'style': style,
                'message': '贴纸生成完成',
            })
        except (AiAuthError, AiProviderError) as ark_err:
            # 火山方舟不可用，降级返回占位图（key 缺失属预期，info 级别记录）
            logger.info("火山方舟贴纸生成不可用，降级返回 mock: %s", ark_err)
            return ok({
                'stickerUrl': "assets/sticker-generated.png",
                'style': style,
                'message': '贴纸生成功能暂不可用，返回占位图',
            })
    except Exception:
        logger.exception("generate_sticker error")
        return ok({
            'stickerUrl': "assets/sticker-generated.png",
            'style': style,
            'message': '贴纸生成服务异常',
        })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=17802)
