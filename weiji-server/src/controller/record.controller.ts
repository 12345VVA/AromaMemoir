// 美食记录控制器
// 处理 GET /api/record/list（分页查询）、POST /api/record（创建）、GET /api/record/:id（详情）
// 与前端 weiji-admin-web/src/api/client.ts 契约一致
// 所有端点受 JWT 中间件保护，ctx.state.user 由中间件挂载（{ userId, username }）

import type { Context } from 'koa';
import { Controller, Get, Post } from '../common/decorators';
import { ok, fail, type ApiResponse } from '../common/response';
import { records } from '../store/db';
import { uuid, checkAndUnlockAchievements } from '../store/helpers';
import type { Record, IngredientWithConfidence, Nutrition } from '../store/types';

// JWT 中间件挂载到 ctx.state.user 的用户信息
interface AuthUser {
  userId: string;
  username: string;
}

// 列表响应载荷：与前端 client.ts 契约一致
interface RecordListPayload {
  list: Record[];
  total: number;
  page: number;
  pageSize: number;
}

// 创建记录请求体（前端提交，部分字段可选；后端自动填充 id/userId/时间戳等）
interface CreateRecordBody {
  dishName?: string;
  cookingMethod?: string;
  rating?: number;
  note?: string;
  aiConfidence?: number;
  nutrition?: Nutrition;
  ingredients?: IngredientWithConfidence[];
  tags?: string[];
  mealType?: string;
  recordDate?: string;
  imageUrl?: string;
  beautifiedUrl?: string;
  source?: string;
}

@Controller('/api/record')
export class RecordController {
  // GET /api/record/list?page=1&pageSize=20&tag=家的味道&rating=4
  // 返回当前用户的美食记录（分页 + 按 tag/rating 筛选，按 createdAt 降序）
  @Get('/list')
  async list(ctx: Context): Promise<ApiResponse> {
    // ctx.state.user 由 JWT 中间件挂载，受保护端点必存在
    const user = ctx.state.user as AuthUser;
    const userId = user.userId;
    const query = ctx.query;

    // 分页参数（默认 page=1, pageSize=20），非法值兜底为 1
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);

    // 筛选参数（均可选）：tag 为字符串、rating 转为数字
    const tag = typeof query.tag === 'string' ? query.tag : '';
    const ratingParam = typeof query.rating === 'string' ? query.rating : '';
    const rating = ratingParam !== '' ? Number(ratingParam) : undefined;

    // 过滤：当前用户 + 未软删除 + 可选 tag/rating 筛选
    const filtered = await records.findAll((r) => {
      if (r.userId !== userId) return false;
      if (r.isDeleted) return false;
      if (tag && !r.tags.includes(tag)) return false;
      if (rating !== undefined && r.rating !== rating) return false;
      return true;
    });

    // 按 createdAt 降序排序（最新的在前，ISO 字符串可按字典序比较）
    filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

    const total = filtered.length;
    // 分页切片：取 [start, start+pageSize)
    const start = (page - 1) * pageSize;
    const pagedList = filtered.slice(start, start + pageSize);

    return ok({ list: pagedList, total, page, pageSize });
  }

  // POST /api/record
  // body: CreateRecordBody（dishName 必填非空）
  // 写入内存存储后返回带 id 的新记录；list 已按 createdAt 降序，故新记录会出现在列表顶部
  @Post('')
  async create(ctx: Context): Promise<ApiResponse> {
    const user = ctx.state.user as AuthUser;
    const userId = user.userId;
    const body = (ctx.request.body || {}) as CreateRecordBody;

    // 字段校验：dishName 必填非空
    if (!body.dishName || !body.dishName.trim()) {
      return fail('菜品名称不能为空', 400);
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0]; // YYYY-MM-DD

    // 构造新记录：自动填充 id/userId/recordDate(今天)/source(camera)/isDeleted/时间戳
    const newRecord: Record = {
      id: uuid(),
      userId,
      dishName: body.dishName.trim(),
      cookingMethod: body.cookingMethod,
      rating: typeof body.rating === 'number' ? body.rating : 0,
      note: body.note,
      aiConfidence: body.aiConfidence,
      nutrition: body.nutrition,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      mealType: body.mealType,
      recordDate: body.recordDate || today,
      imageUrl: body.imageUrl,
      beautifiedUrl: body.beautifiedUrl,
      source: body.source || 'camera',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    // 写入内存存储（insert 会保留已设置的 id，将记录置于数组末尾）
    // 由于 list 按 createdAt 降序，新记录 createdAt 为当前时间，会排在种子数据之前
    await records.insert(newRecord);

    // 自动检查并解锁成就
    const newlyUnlocked = await checkAndUnlockAchievements(userId);

    return ok({ record: newRecord, newAchievements: newlyUnlocked }, '保存成功');
  }

  // GET /api/record/:id
  // 返回单条记录；找不到或已软删除时返回 404；非本人记录返回 403（防止 IDOR 越权）
  @Get('/:id')
  async getById(ctx: Context): Promise<ApiResponse> {
    const id = ctx.params.id;
    const record = await records.findById(id);

    if (!record || record.isDeleted) {
      return fail('记录不存在', 404);
    }

    // 所有权校验：仅记录归属用户可访问，防止 IDOR 越权读取
    const user = ctx.state.user as AuthUser;
    if (record.userId !== user.userId) {
      return fail('无权访问该记录', 403);
    }

    return ok(record);
  }
}
