"""
味记 AI 服务层 (FastAPI)
提供图片识别、图片美化、菜谱推荐、语音识别等 AI 能力
以及前后端联调所需的 Mock 业务 CRUD 端点
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional, List, Dict, Any
import uuid
import hashlib
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="味记 AI 服务", version="0.1.0")

# ============================================================
# CORS 中间件（开发环境允许所有来源跨域）
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
# 内存数据存储层（模块级变量，服务重启后重置）
# ============================================================

# 美食记录
records: List[Dict[str, Any]] = [
    {
        "id": "rec-001",
        "dishName": "红烧肉",
        "imageUrl": "assets/food-hongshaorou.jpg",
        "rating": 5,
        "tags": ["家的味道", "午餐"],
        "time": "今天 12:30",
        "recordDate": "今天 12:30",
        "mealType": "午餐",
        "note": "今天做的红烧肉，肥而不腻，入口即化。",
        "aiConfidence": 0.96,
    },
    {
        "id": "rec-002",
        "dishName": "番茄鸡蛋面",
        "imageUrl": "assets/food-tomato-noodle.jpg",
        "rating": 4,
        "tags": ["下厨日记", "早餐"],
        "time": "今天 08:15",
        "recordDate": "今天 08:15",
        "mealType": "早餐",
        "note": "简单快手的早餐，酸酸甜甜很开胃。",
        "aiConfidence": 0.92,
    },
    {
        "id": "rec-003",
        "dishName": "糖醋排骨",
        "imageUrl": "assets/food-sweet-ribs.jpg",
        "rating": 4,
        "tags": ["节日美食", "晚餐"],
        "time": "昨天 18:45",
        "recordDate": "昨天 18:45",
        "mealType": "晚餐",
        "note": "节日家宴的招牌菜，外酥里嫩。",
        "aiConfidence": 0.94,
    },
]

# 家庭菜谱
family_recipes: List[Dict[str, Any]] = [
    {
        "id": "recipe-001",
        "name": "麻婆豆腐",
        "imageUrl": "assets/recipe-mapo-tofu.jpg",
        "coverUrl": "assets/recipe-mapo-tofu.jpg",
        "category": "家常菜",
        "difficulty": "简单",
        "cookTime": "25分钟",
        "uploader": "妈妈",
        "uploaderName": "妈妈",
        "uploaderInitials": "妈",
        "uploaderAvatarColor": "accent",
        "description": "麻辣鲜香，下饭神器。",
    },
    {
        "id": "recipe-002",
        "name": "桂花糕",
        "imageUrl": "assets/recipe-guihua-gao.jpg",
        "coverUrl": "assets/recipe-guihua-gao.jpg",
        "category": "甜品",
        "difficulty": "中等",
        "cookTime": "60分钟",
        "uploader": "爸爸",
        "uploaderName": "爸爸",
        "uploaderInitials": "爸",
        "uploaderAvatarColor": "success",
        "description": "清甜软糯，桂花飘香。",
    },
    {
        "id": "recipe-003",
        "name": "蒜蓉西兰花",
        "imageUrl": "assets/recipe-broccoli.jpg",
        "coverUrl": "assets/recipe-broccoli.jpg",
        "category": "家常菜",
        "difficulty": "简单",
        "cookTime": "15分钟",
        "uploader": "我",
        "uploaderName": "我",
        "uploaderInitials": "味",
        "uploaderAvatarColor": "primary",
        "description": "清爽健康，颜色翠绿。",
    },
    {
        "id": "recipe-004",
        "name": "蛋炒饭",
        "imageUrl": "assets/recipe-egg-fried-rice.jpg",
        "coverUrl": "assets/recipe-egg-fried-rice.jpg",
        "category": "家常菜",
        "difficulty": "简单",
        "cookTime": "10分钟",
        "uploader": "姐姐",
        "uploaderName": "姐姐",
        "uploaderInitials": "姐",
        "uploaderAvatarColor": "info",
        "description": "粒粒分明，金黄诱人。",
    },
]

# 家庭成员
family_members: List[Dict[str, Any]] = [
    {
        "id": "member-001",
        "name": "我",
        "nickname": "我",
        "avatarText": "味",
        "avatarInitials": "味",
        "avatarColor": "primary",
        "avatarBg": "#ffe6d9",
        "online": True,
        "role": "member",
    },
    {
        "id": "member-002",
        "name": "妈妈",
        "nickname": "妈妈",
        "avatarText": "妈",
        "avatarInitials": "妈",
        "avatarColor": "accent",
        "avatarBg": "#fffbeb",
        "online": True,
        "role": "member",
    },
    {
        "id": "member-003",
        "name": "爸爸",
        "nickname": "爸爸",
        "avatarText": "爸",
        "avatarInitials": "爸",
        "avatarColor": "success",
        "avatarBg": "#dcfce7",
        "online": False,
        "role": "admin",
    },
    {
        "id": "member-004",
        "name": "姐姐",
        "nickname": "姐姐",
        "avatarText": "姐",
        "avatarInitials": "姐",
        "avatarColor": "info",
        "avatarBg": "#dbeafe",
        "online": False,
        "role": "member",
    },
]

# 周菜单（协作菜单）
weekly_menu: List[Dict[str, Any]] = [
    {
        "id": "menu-001",
        "dayOfWeek": 1,
        "mealType": "早餐",
        "recipeId": "recipe-004",
        "recipeName": "蛋炒饭",
        "coverUrl": "assets/recipe-egg-fried-rice.jpg",
        "votes": {"up": ["user-001"], "down": []},
    },
    {
        "id": "menu-002",
        "dayOfWeek": 1,
        "mealType": "午餐",
        "recipeId": "recipe-001",
        "recipeName": "麻婆豆腐",
        "coverUrl": "assets/recipe-mapo-tofu.jpg",
        "votes": {"up": ["user-001"], "down": []},
    },
    {
        "id": "menu-003",
        "dayOfWeek": 1,
        "mealType": "晚餐",
        "recipeId": "recipe-003",
        "recipeName": "蒜蓉西兰花",
        "coverUrl": "assets/recipe-broccoli.jpg",
        "votes": {"up": [], "down": []},
    },
    {
        "id": "menu-004",
        "dayOfWeek": 2,
        "mealType": "早餐",
        "recipeId": "recipe-004",
        "recipeName": "蛋炒饭",
        "coverUrl": "assets/recipe-egg-fried-rice.jpg",
        "votes": {"up": [], "down": []},
    },
    {
        "id": "menu-005",
        "dayOfWeek": 2,
        "mealType": "午餐",
        "recipeId": "recipe-001",
        "recipeName": "麻婆豆腐",
        "coverUrl": "assets/recipe-mapo-tofu.jpg",
        "votes": {"up": ["user-001"], "down": []},
    },
    {
        "id": "menu-006",
        "dayOfWeek": 3,
        "mealType": "晚餐",
        "recipeId": "recipe-002",
        "recipeName": "桂花糕",
        "coverUrl": "assets/recipe-guihua-gao.jpg",
        "votes": {"up": [], "down": []},
    },
    {
        "id": "menu-007",
        "dayOfWeek": 4,
        "mealType": "午餐",
        "recipeId": "recipe-001",
        "recipeName": "麻婆豆腐",
        "coverUrl": "assets/recipe-mapo-tofu.jpg",
        "votes": {"up": [], "down": []},
    },
    {
        "id": "menu-008",
        "dayOfWeek": 5,
        "mealType": "晚餐",
        "recipeId": "recipe-003",
        "recipeName": "蒜蓉西兰花",
        "coverUrl": "assets/recipe-broccoli.jpg",
        "votes": {"up": ["user-001"], "down": []},
    },
    {
        "id": "menu-009",
        "dayOfWeek": 6,
        "mealType": "午餐",
        "recipeId": "recipe-004",
        "recipeName": "蛋炒饭",
        "coverUrl": "assets/recipe-egg-fried-rice.jpg",
        "votes": {"up": [], "down": []},
    },
    {
        "id": "menu-010",
        "dayOfWeek": 7,
        "mealType": "晚餐",
        "recipeId": "recipe-002",
        "recipeName": "桂花糕",
        "coverUrl": "assets/recipe-guihua-gao.jpg",
        "votes": {"up": [], "down": []},
    },
]

# 购物清单
shopping_items: List[Dict[str, Any]] = [
    {
        "id": "shop-001",
        "name": "番茄",
        "category": "蔬菜",
        "quantity": "500g",
        "checked": False,
        "checkedBy": None,
    },
    {
        "id": "shop-002",
        "name": "鸡蛋",
        "category": "蔬菜",
        "quantity": "10个",
        "checked": True,
        "checkedBy": "user-001",
    },
    {
        "id": "shop-003",
        "name": "西兰花",
        "category": "蔬菜",
        "quantity": "2个",
        "checked": False,
        "checkedBy": None,
    },
    {
        "id": "shop-004",
        "name": "五花肉",
        "category": "肉类",
        "quantity": "500g",
        "checked": False,
        "checkedBy": None,
    },
    {
        "id": "shop-005",
        "name": "牛腩",
        "category": "肉类",
        "quantity": "1kg",
        "checked": False,
        "checkedBy": None,
    },
    {
        "id": "shop-006",
        "name": "排骨",
        "category": "肉类",
        "quantity": "800g",
        "checked": True,
        "checkedBy": "user-001",
    },
    {
        "id": "shop-007",
        "name": "生抽",
        "category": "调料",
        "quantity": "1瓶",
        "checked": False,
        "checkedBy": None,
    },
    {
        "id": "shop-008",
        "name": "老抽",
        "category": "调料",
        "quantity": "1瓶",
        "checked": False,
        "checkedBy": None,
    },
    {
        "id": "shop-009",
        "name": "花椒",
        "category": "调料",
        "quantity": "100g",
        "checked": True,
        "checkedBy": "user-001",
    },
    {
        "id": "shop-010",
        "name": "鲜虾",
        "category": "水产",
        "quantity": "500g",
        "checked": False,
        "checkedBy": None,
    },
    {
        "id": "shop-011",
        "name": "鲈鱼",
        "category": "水产",
        "quantity": "1条",
        "checked": False,
        "checkedBy": None,
    },
]

# 成就徽章
achievements: List[Dict[str, Any]] = [
    {
        "id": "ach-001",
        "title": "首次记录",
        "name": "首次记录",
        "icon": "pen-line",
        "unlocked": True,
        "background": "#fff5f0",
        "bgColor": "#fff5f0",
        "color": "#ff5e1a",
        "iconColor": "#ff5e1a",
        "description": "记录你的第一道美食",
    },
    {
        "id": "ach-002",
        "title": "连续7天",
        "name": "连续7天",
        "icon": "flame",
        "unlocked": True,
        "background": "#fffbeb",
        "bgColor": "#fffbeb",
        "color": "#f5a623",
        "iconColor": "#f5a623",
        "description": "连续打卡7天",
    },
    {
        "id": "ach-003",
        "title": "百道菜品",
        "name": "百道菜品",
        "icon": "utensils",
        "unlocked": True,
        "background": "#f0fdf4",
        "bgColor": "#f0fdf4",
        "color": "#16a34a",
        "iconColor": "#16a34a",
        "description": "记录100道菜品",
    },
    {
        "id": "ach-004",
        "title": "菜系大师",
        "name": "菜系大师",
        "icon": "award",
        "unlocked": True,
        "background": "#eff6ff",
        "bgColor": "#eff6ff",
        "color": "#3b82f6",
        "iconColor": "#3b82f6",
        "description": "掌握5大菜系",
    },
    {
        "id": "ach-005",
        "title": "家庭贡献",
        "name": "家庭贡献",
        "icon": "heart",
        "unlocked": False,
        "background": "#f5f0e8",
        "bgColor": "#f5f0e8",
        "color": "#9a8b7a",
        "iconColor": "#9a8b7a",
        "description": "为家庭菜谱贡献10道菜",
    },
    {
        "id": "ach-006",
        "title": "连续30天",
        "name": "连续30天",
        "icon": "calendar-check",
        "unlocked": False,
        "background": "#f5f0e8",
        "bgColor": "#f5f0e8",
        "color": "#9a8b7a",
        "iconColor": "#9a8b7a",
        "description": "连续打卡30天",
    },
]

# 挑战赛
challenges: List[Dict[str, Any]] = [
    {
        "id": "chal-001",
        "title": "一周素食",
        "icon": "salad",
        "status": "进行中",
        "progress": 3,
        "total": 7,
        "percent": 43,
        "color": "#16a34a",
        "description": "挑战一周内每天记录一道素食",
    },
    {
        "id": "chal-002",
        "title": "环球美食月",
        "icon": "globe",
        "status": "未开始",
        "progress": 0,
        "total": 30,
        "percent": 0,
        "color": "#3b82f6",
        "description": "一个月内品尝30国美食",
    },
    {
        "id": "chal-003",
        "title": "家庭厨艺大赛",
        "icon": "trophy",
        "status": "即将开始",
        "date": "6月28日",
        "color": "#f5a623",
        "description": "家庭厨艺比拼，谁是厨神",
    },
]

# 用户信息
user_profile: Dict[str, Any] = {
    "id": "user-001",
    "nickname": "味记用户",
    "avatarText": "味",
    "avatarInitials": "味",
    "avatarColor": "primary",
    "signature": "记录美好食光",
    "bio": "记录美好食光",
    "stats": {
        "recordCount": 128,
        "recipeCount": 12,
        "streakDays": 5,
    },
}

# 等级信息
level_info: Dict[str, Any] = {
    "level": 12,
    "name": "美食家",
    "title": "美食家",
    "exp": 2450,
    "currentExp": 2450,
    "expToNext": 550,
    "maxExp": 3000,
    "percent": 81.7,
    "progress": 81.7,
    "expRemaining": 550,
}

# 打卡状态
checkin_state: Dict[str, Any] = {
    "streakDays": 5,
    "checkedToday": False,
    "checkedInToday": False,
    "calendar": [
        {"day": "一", "label": "一", "status": "done"},
        {"day": "二", "label": "二", "status": "done"},
        {"day": "三", "label": "三", "status": "done"},
        {"day": "四", "label": "四", "status": "done"},
        {"day": "五", "label": "五", "status": "done"},
        {"day": "六", "label": "六", "status": "today"},
        {"day": "日", "label": "日", "status": "future"},
    ],
}


# ============================================================
# 基础健康检查
# ============================================================
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "weiji-ai"}


# ============================================================
# 食物识别服务
# ============================================================
@app.post("/api/ai/recognize")
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
@app.post("/api/ai/beautify")
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
@app.post("/api/ai/recommend")
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
@app.post("/api/ai/voice/recognize")
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
@app.post("/api/ai/sticker")
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


# ============================================================
# 美食记录 CRUD
# ============================================================
@app.get("/api/record/list")
async def list_records(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    tag: Optional[str] = Query(None),
    rating: Optional[int] = Query(None),
):
    """查询美食记录列表，支持分页、标签、评分筛选"""
    result = list(records)
    if tag:
        result = [r for r in result if tag in r.get("tags", [])]
    if rating is not None:
        result = [r for r in result if r.get("rating") == rating]

    total = len(result)
    start = (page - 1) * pageSize
    end = start + pageSize
    page_list = result[start:end]
    return ok({
        "list": page_list,
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@app.post("/api/record")
async def create_record(record: dict):
    """创建美食记录，插入到列表头部"""
    new_record = {
        "id": str(uuid.uuid4()),
        "dishName": record.get("dishName", ""),
        "imageUrl": record.get("imageUrl", ""),
        "rating": record.get("rating", 0),
        "tags": record.get("tags", []),
        "mealType": record.get("mealType", ""),
        "note": record.get("note", ""),
        "aiConfidence": record.get("aiConfidence", 0.0),
        "time": "刚刚",
        "recordDate": "刚刚",
    }
    records.insert(0, new_record)
    return ok(new_record, "记录创建成功")


@app.get("/api/record/{record_id}")
async def get_record(record_id: str):
    """获取单条美食记录"""
    for r in records:
        if r["id"] == record_id:
            return ok(r)
    return fail("记录不存在", code=404)


# ============================================================
# 家庭
# ============================================================
@app.get("/api/family/recipes")
async def list_family_recipes(category: Optional[str] = Query(None)):
    """查询家庭菜谱列表，支持按分类筛选"""
    result = list(family_recipes)
    if category:
        result = [r for r in result if r.get("category") == category]
    return ok(result)


@app.get("/api/family/members")
async def list_family_members():
    """查询家庭成员列表"""
    return ok(family_members)


# ============================================================
# 周菜单（协作菜单）
# ============================================================
# 餐次排序权重，便于按 早餐 < 午餐 < 晚餐 排序
_MEAL_ORDER = {"早餐": 1, "午餐": 2, "晚餐": 3}


@app.get("/api/family/menu")
async def list_weekly_menu():
    """查询周菜单列表，按 dayOfWeek 和 mealType 排序，返回投票计数"""
    sorted_menu = sorted(
        weekly_menu,
        key=lambda m: (m.get("dayOfWeek", 0), _MEAL_ORDER.get(m.get("mealType", ""), 99)),
    )
    result = []
    for m in sorted_menu:
        votes = m.get("votes", {"up": [], "down": []})
        up_list = votes.get("up", [])
        down_list = votes.get("down", [])
        result.append({
            "id": m["id"],
            "dayOfWeek": m["dayOfWeek"],
            "mealType": m["mealType"],
            "recipeId": m["recipeId"],
            "recipeName": m["recipeName"],
            "coverUrl": m["coverUrl"],
            "upCount": len(up_list),
            "downCount": len(down_list),
            "votes": {
                "up": up_list,
                "down": down_list,
            },
        })
    return ok(result)


@app.post("/api/family/menu")
async def create_menu_item(item: dict):
    """创建周菜单项，根据 recipeId 从 family_recipes 查找菜谱信息"""
    day_of_week = item.get("dayOfWeek")
    meal_type = item.get("mealType")
    recipe_id = item.get("recipeId")

    if not day_of_week or not meal_type or not recipe_id:
        return fail("dayOfWeek、mealType、recipeId 不能为空", code=400)

    recipe = next((r for r in family_recipes if r["id"] == recipe_id), None)
    if not recipe:
        return fail("菜谱不存在", code=404)

    new_menu = {
        "id": f"menu-{uuid.uuid4().hex[:8]}",
        "dayOfWeek": day_of_week,
        "mealType": meal_type,
        "recipeId": recipe["id"],
        "recipeName": recipe.get("name", ""),
        "coverUrl": recipe.get("coverUrl", recipe.get("imageUrl", "")),
        "votes": {"up": [], "down": []},
    }
    weekly_menu.append(new_menu)
    return ok(new_menu, "菜单项创建成功")


@app.post("/api/family/menu/{menu_id}/vote")
async def vote_menu_item(menu_id: str, body: dict):
    """对菜单项投票，若已投过则切换投票"""
    menu = next((m for m in weekly_menu if m["id"] == menu_id), None)
    if not menu:
        return fail("菜单项不存在", code=404)

    vote = body.get("vote")
    user_id = body.get("userId")
    if vote not in ("up", "down") or not user_id:
        return fail("vote 必须为 up/down 且 userId 不能为空", code=400)

    votes = menu.setdefault("votes", {"up": [], "down": []})
    up_list = votes.setdefault("up", [])
    down_list = votes.setdefault("down", [])

    # 先从两个列表中移除该用户的已有投票
    if user_id in up_list:
        up_list.remove(user_id)
    if user_id in down_list:
        down_list.remove(user_id)

    # 若用户原本不在目标列表中，则加入（即切换/新增投票）
    if vote == "up":
        up_list.append(user_id)
    else:
        down_list.append(user_id)

    return ok({
        "id": menu["id"],
        "upCount": len(up_list),
        "downCount": len(down_list),
        "votes": {
            "up": up_list,
            "down": down_list,
        },
    }, "投票成功")


# ============================================================
# 购物清单
# ============================================================
@app.get("/api/family/shopping")
async def list_shopping_items():
    """查询购物清单，按 category 分组返回"""
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in shopping_items:
        grouped.setdefault(item["category"], []).append(item)
    return ok(grouped)


@app.post("/api/family/shopping")
async def create_shopping_item(item: dict):
    """创建购物项"""
    name = item.get("name")
    category = item.get("category")
    quantity = item.get("quantity")
    if not name or not category:
        return fail("name 和 category 不能为空", code=400)

    new_item = {
        "id": f"shop-{uuid.uuid4().hex[:8]}",
        "name": name,
        "category": category,
        "quantity": quantity or "",
        "checked": False,
        "checkedBy": None,
    }
    shopping_items.append(new_item)
    return ok(new_item, "购物项创建成功")


@app.patch("/api/family/shopping/{item_id}")
async def update_shopping_item(item_id: str, body: dict):
    """更新购物项勾选状态"""
    item = next((s for s in shopping_items if s["id"] == item_id), None)
    if not item:
        return fail("购物项不存在", code=404)

    checked = body.get("checked")
    if checked is None:
        return fail("checked 不能为空", code=400)

    item["checked"] = bool(checked)
    item["checkedBy"] = "user-001" if item["checked"] else None
    return ok(item, "更新成功")


@app.delete("/api/family/shopping/{item_id}")
async def delete_shopping_item(item_id: str):
    """删除购物项"""
    global shopping_items
    idx = next((i for i, s in enumerate(shopping_items) if s["id"] == item_id), None)
    if idx is None:
        return fail("购物项不存在", code=404)
    shopping_items.pop(idx)
    return ok(None, "删除成功")


# ============================================================
# 成就
# ============================================================
@app.get("/api/achievement/list")
async def list_achievements():
    """查询成就徽章列表（含 unlocked 状态）"""
    return ok(achievements)


@app.get("/api/achievement/level")
async def get_level():
    """查询用户等级信息"""
    return ok(level_info)


# ============================================================
# 打卡
# ============================================================
@app.get("/api/checkin/status")
async def checkin_status():
    """查询打卡状态：连续天数、今日是否已打卡、打卡日历"""
    return ok({
        "streakDays": checkin_state["streakDays"],
        "checkedToday": checkin_state["checkedToday"],
        "checkedInToday": checkin_state["checkedToday"],
        "calendar": checkin_state["calendar"],
    })


@app.post("/api/checkin")
async def do_checkin():
    """执行今日打卡"""
    if checkin_state["checkedToday"]:
        return fail("今日已打卡", code=1)
    checkin_state["checkedToday"] = True
    checkin_state["checkedInToday"] = True
    checkin_state["streakDays"] = checkin_state["streakDays"] + 1
    # 更新日历：将 today 标记为 done
    for item in checkin_state["calendar"]:
        if item["status"] == "today":
            item["status"] = "done"
    return ok({
        "streakDays": checkin_state["streakDays"],
        "checkedToday": checkin_state["checkedToday"],
        "checkedInToday": checkin_state["checkedToday"],
        "calendar": checkin_state["calendar"],
    }, "打卡成功")


# ============================================================
# 用户系统（注册/登录/Token）
# ============================================================
users: Dict[str, Dict[str, Any]] = {
    "demo": {
        "id": "user-001",
        "username": "demo",
        "password": hashlib.sha256("123456".encode()).hexdigest(),
        "nickname": "味记用户",
        "avatarText": "味",
        "avatarInitials": "味",
        "avatarColor": "primary",
        "avatarBg": "#ffe6d9",
        "signature": "记录美好食光",
        "bio": "记录美好食光",
        "stats": {
            "recordCount": 128,
            "recipeCount": 12,
            "streakDays": 5,
        },
    }
}

tokens: Dict[str, str] = {}


def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


def create_token(user_id: str) -> str:
    token = str(uuid.uuid4())
    tokens[token] = user_id
    return token


def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    user_id = tokens.get(token)
    if not user_id:
        return None
    for u in users.values():
        if u["id"] == user_id:
            return u
    return None


@app.post("/api/auth/register")
async def register(user: dict):
    """用户注册"""
    username = user.get("username", "").strip()
    password = user.get("password", "")
    nickname = user.get("nickname", "") or username

    if not username or not password:
        return fail("用户名和密码不能为空", code=400)
    if len(username) < 2:
        return fail("用户名至少2个字符", code=400)
    if len(password) < 6:
        return fail("密码至少6个字符", code=400)
    if username in users:
        return fail("用户名已存在", code=409)

    user_id = str(uuid.uuid4())
    initial = nickname[0] if nickname else username[0]
    users[username] = {
        "id": user_id,
        "username": username,
        "password": hash_password(password),
        "nickname": nickname,
        "avatarText": initial,
        "avatarInitials": initial,
        "avatarColor": "primary",
        "avatarBg": "#ffe6d9",
        "signature": "记录美好食光",
        "bio": "记录美好食光",
        "stats": {
            "recordCount": 0,
            "recipeCount": 0,
            "streakDays": 0,
        },
    }

    token = create_token(user_id)
    return ok({
        "token": token,
        "user": {
            "id": user_id,
            "username": username,
            "nickname": nickname,
            "avatarInitials": initial,
            "avatarColor": "primary",
            "bio": "记录美好食光",
            "stats": users[username]["stats"],
        }
    }, "注册成功")


@app.post("/api/auth/login")
async def login(user: dict):
    """用户登录"""
    username = user.get("username", "").strip()
    password = user.get("password", "")

    if not username or not password:
        return fail("用户名和密码不能为空", code=400)

    u = users.get(username)
    if not u:
        return fail("用户不存在", code=404)
    if u["password"] != hash_password(password):
        return fail("密码错误", code=401)

    token = create_token(u["id"])
    return ok({
        "token": token,
        "user": {
            "id": u["id"],
            "username": u["username"],
            "nickname": u["nickname"],
            "avatarInitials": u["avatarInitials"],
            "avatarColor": u["avatarColor"],
            "bio": u["bio"],
            "stats": u["stats"],
        }
    }, "登录成功")


@app.post("/api/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """用户登出"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        tokens.pop(token, None)
    return ok(None, "登出成功")


@app.get("/api/user/profile")
async def get_user_profile(authorization: Optional[str] = Header(None)):
    """查询用户信息及统计数据"""
    user = get_current_user(authorization)
    if user:
        return ok({
            "id": user["id"],
            "nickname": user["nickname"],
            "avatarInitials": user["avatarInitials"],
            "avatarColor": user["avatarColor"],
            "bio": user["bio"],
            "stats": user["stats"],
        })
    return ok(user_profile)


# ============================================================
# 挑战赛（附加端点，便于前端联调）
# ============================================================
@app.get("/api/challenge/list")
async def list_challenges():
    """查询挑战赛列表"""
    return ok(challenges)


# ============================================================
# 静态文件服务（挂载前端，同端口避免跨域）
# ============================================================
WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weiji-web")

if os.path.isdir(WEB_DIR):
    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(WEB_DIR, "index.html"))

    @app.get("/index.html")
    async def serve_index_html():
        return FileResponse(os.path.join(WEB_DIR, "index.html"))

    @app.get("/api.js")
    async def serve_api_js():
        return FileResponse(os.path.join(WEB_DIR, "api.js"))

    @app.get("/app.js")
    async def serve_app_js():
        return FileResponse(os.path.join(WEB_DIR, "app.js"))

    app.mount("/assets", StaticFiles(directory=os.path.join(WEB_DIR, "assets")), name="assets")
else:
    logger.warning(f"Web directory not found: {WEB_DIR}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
