// 家庭组控制器
// 处理 /api/family 下全部业务端点，与前端 weiji-admin-web/src/api/client.ts 契约一致
// 涵盖：家庭组基础、成员管理、邀请、菜谱可见性、协作菜单、购物清单
// 权限模型：owner（家庭组创建者）> admin（管理员）> member（普通成员）

import type { Context } from 'koa';
import { Controller, Get, Post, Patch, Delete } from '../common/decorators';
import { ok, fail, forbidden, type ApiResponse } from '../common/response';
import {
  families,
  family_members,
  family_recipes,
  invitations,
  weekly_menu,
  shopping_items,
  users,
  records,
  record_likes,
  record_comments,
} from '../store/db';
import { uuid, generateFamilyDietReport } from '../store/helpers';
import type {
  Family,
  FamilyMember,
  FamilyRecipe,
  Invitation,
  WeeklyMenuItem,
  ShoppingItem,
  UserRole,
  RecipeVisibility,
  MealType,
  VoteType,
  MenuVotes,
  ShoppingCategory,
  RecipeIngredient,
  RecipeStep,
  RecordLike,
  RecordComment,
  FamilyRecordItem,
  FamilyDietReport,
  ShoppingGenerateResult,
} from '../store/types';
import { findUserFamily, getUserMembership, requireRole, getCurrentMonday } from '../service/family.service';

// 餐次排序权重：breakfast < lunch < dinner
const MEAL_ORDER: Record<MealType, number> = { breakfast: 1, lunch: 2, dinner: 3 };

// 生成 6 位邀请码：大写字母 + 数字组合（如 'ABC123'）
function generateInviteCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

@Controller('/api/family')
export class FamilyController {
  // ============================================================
  // SubTask 5.1：家庭组基础端点
  // ============================================================

  // GET /api/family
  // 查询当前用户所属家庭组；未加入返回 null（前端可显示"创建家庭"引导）
  // 注：使用空路径以注册 '/api/family'，匹配前端 client.ts 的 GET /family 请求
  @Get('')
  async getFamily(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);
    // 未加入任何家庭组 → 返回 ok(null)
    if (!family) return ok(null);
    return ok(family);
  }

  // POST /api/family
  // 创建家庭组，当前用户成为 owner，并同步建立 family_members 关系
  @Post('')
  async createFamily(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const { name } = (ctx.request.body || {}) as { name?: string };

    // 校验名称非空
    if (!name || !name.trim()) {
      return fail('家庭组名称不能为空', 400);
    }

    const now = new Date().toISOString();
    const familyId = uuid();

    // 创建家庭组：memberCount=1，inviteCode 为随机 6 位码
    const family = await families.insert({
      id: familyId,
      name: name.trim(),
      ownerId: userId,
      memberCount: 1,
      inviteCode: generateInviteCode(),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });

    // 同步创建 owner 成员关系
    await family_members.insert({
      id: uuid(),
      familyId,
      userId,
      role: 'owner',
      joinedAt: now,
    });

    return ok(family, '创建成功');
  }

  // ============================================================
  // SubTask 5.2：成员管理端点
  // ============================================================

  // GET /api/family/members
  // 列出当前家庭组全部成员，关联 users 表补全昵称/头像
  @Get('/members')
  async getMembers(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const membership = await getUserMembership(userId);
    // 未加入家庭组 → 返回空列表
    if (!membership) return ok([]);

    const members = await family_members.findAll((m) => m.familyId === membership.familyId);
    const list = [];
    for (const m of members) {
      const user = await users.findById(m.userId);
      list.push({
        id: m.id,
        userId: m.userId,
        nickname: user?.nickname ?? '',
        avatar: user?.avatar ?? '',
        role: m.role,
        joinedAt: m.joinedAt,
      });
    }
    return ok(list);
  }

  // PATCH /api/family/members/:id
  // 修改成员角色（仅可设为 admin 或 member，不可改 owner）
  @Patch('/members/:id')
  async updateRole(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const memberRecordId = ctx.params.id as string;
    const { role } = (ctx.request.body || {}) as { role?: UserRole };

    // 权限校验：当前用户必须是 owner 或 admin
    if (!(await requireRole(userId, ['owner', 'admin']))) {
      return forbidden('无权限操作');
    }

    // 校验新角色合法（仅 admin / member）
    if (role !== 'admin' && role !== 'member') {
      return fail('角色不合法', 400);
    }

    const target = await family_members.findById(memberRecordId);
    if (!target) {
      return fail('成员不存在', 404);
    }

    // 不允许把 owner 改为其他角色（避免家庭组无主）
    if (target.role === 'owner') {
      return fail('不能修改 owner 角色', 400);
    }

    const updated = await family_members.updateById(memberRecordId, { role });
    return ok(updated);
  }

  // DELETE /api/family/members/:id
  // 移除成员（仅 owner 可操作，且 owner 不能移除自己）
  @Delete('/members/:id')
  async removeMember(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const memberRecordId = ctx.params.id as string;

    // 权限校验：当前用户必须是 owner
    if (!(await requireRole(userId, ['owner']))) {
      return forbidden('无权限操作');
    }

    const target = await family_members.findById(memberRecordId);
    if (!target) {
      return fail('成员不存在', 404);
    }

    // 不允许 owner 移除自己
    if (target.userId === userId) {
      return fail('owner 不能移除自己', 400);
    }

    // 从 family_members 数组中删除该记录
    const membersArr = await family_members.toArray();
    const idx = membersArr.findIndex((m) => m.id === memberRecordId);
    if (idx !== -1) {
      membersArr.splice(idx, 1);
    }

    // 更新对应家庭组 memberCount - 1
    const family = await families.findById(target.familyId);
    if (family) {
      await families.updateById(family.id, { memberCount: Math.max(0, family.memberCount - 1) });
    }

    return ok(null, '移除成功');
  }

  // ============================================================
  // SubTask 5.3：邀请端点
  // ============================================================

  // POST /api/family/invitations
  // 生成 24 小时有效的邀请码（owner / admin 可操作）
  @Post('/invitations')
  async createInvitation(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);

    if (!family) {
      return fail('未加入家庭组', 400);
    }

    // 权限校验：owner 或 admin
    if (!(await requireRole(userId, ['owner', 'admin']))) {
      return forbidden('无权限操作');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const code = generateInviteCode();

    const newInvitation = await invitations.insert({
      id: uuid(),
      code,
      familyId: family.id,
      createdBy: userId,
      expiresAt,
      used: false,
      createdAt: now.toISOString(),
    });

    return ok({ code: newInvitation.code, expiresAt: newInvitation.expiresAt });
  }

  // GET /api/family/invitations
  // 列出当前家庭组未过期、未使用的有效邀请码（owner / admin 可查看）
  @Get('/invitations')
  async listInvitations(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);

    if (!family) {
      return fail('未加入家庭组', 400);
    }

    if (!(await requireRole(userId, ['owner', 'admin']))) {
      return forbidden('无权限操作');
    }

    const now = new Date();
    const list = await invitations.findAll(
      (i) => i.familyId === family.id && !i.used && new Date(i.expiresAt) > now
    );
    return ok(list);
  }

  // POST /api/family/join
  // 通过邀请码加入家庭组（角色固定为 member）
  @Post('/join')
  async joinFamily(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const { code } = (ctx.request.body || {}) as { code?: string };

    if (!code || !code.trim()) {
      return fail('邀请码不能为空', 400);
    }

    const invitation = await invitations.findByField('code', code.trim());
    // 找不到 / 已过期 → 统一返回"邀请码无效或已过期"
    if (!invitation || new Date(invitation.expiresAt) <= new Date()) {
      return fail('邀请码无效或已过期', 400);
    }
    // 已使用
    if (invitation.used) {
      return fail('邀请码已使用', 400);
    }

    // 校验当前用户是否已加入该家庭组
    const existedArr = await family_members.findAll(
      (m) => m.familyId === invitation.familyId && m.userId === userId
    );
    const existed = existedArr[0];
    if (existed) {
      return fail('已加入该家庭组', 400);
    }

    const now = new Date().toISOString();

    // 创建成员关系：role='member'
    await family_members.insert({
      id: uuid(),
      familyId: invitation.familyId,
      userId,
      role: 'member',
      joinedAt: now,
    });

    // 标记邀请码已使用
    await invitations.updateById(invitation.id, { used: true });

    // 更新家庭组 memberCount + 1
    const family = await families.findById(invitation.familyId);
    if (family) {
      await families.updateById(family.id, { memberCount: family.memberCount + 1 });
    }

    return ok(family, '加入成功');
  }

  // ============================================================
  // SubTask 5.4：菜谱端点
  // ============================================================

  // GET /api/family/recipes?visibility=&authorId=&category=
  // 列出当前家庭组菜谱，支持按可见性/作者/分类过滤
  @Get('/recipes')
  async listRecipes(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);

    if (!family) {
      return ok([]);
    }

    const visibility = ctx.query.visibility as string | undefined;
    const authorId = ctx.query.authorId as string | undefined;
    const category = ctx.query.category as string | undefined;

    // 基础过滤：同家庭组 + 未删除
    let list = await family_recipes.findAll((r) => r.familyId === family.id && !r.isDeleted);

    // 可见性过滤
    if (visibility === 'family') {
      // 仅返回家庭可见菜谱
      list = list.filter((r) => r.visibility === 'family');
    } else if (visibility === 'private') {
      // 私有菜谱仅返回当前用户自己上传的
      list = list.filter((r) => r.uploaderId === userId && r.visibility === 'private');
    }

    // 作者过滤
    if (authorId) {
      list = list.filter((r) => r.uploaderId === authorId);
    }

    // 分类过滤
    if (category) {
      list = list.filter((r) => r.category === category);
    }

    return ok(list);
  }

  // POST /api/family/recipes
  // 上传菜谱到家庭共享空间
  @Post('/recipes')
  async uploadRecipe(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const body = (ctx.request.body || {}) as {
      name?: string;
      category?: string;
      ingredients?: RecipeIngredient[];
      steps?: RecipeStep[];
      coverUrl?: string;
      difficulty?: string;
      cookTime?: number;
      visibility?: RecipeVisibility;
    };

    // 校验菜谱名称非空
    if (!body.name || !body.name.trim()) {
      return fail('菜谱名称不能为空', 400);
    }
    // 校验食材清单至少1项
    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return fail('食材清单不能为空', 400);
    }

    const family = await findUserFamily(userId);
    if (!family) {
      return fail('未加入家庭组', 400);
    }

    const now = new Date().toISOString();
    const newRecipe = await family_recipes.insert({
      id: uuid(),
      familyId: family.id,
      name: body.name.trim(),
      category: body.category || '家常菜',
      ingredients: body.ingredients,
      steps: Array.isArray(body.steps) ? body.steps : [],
      coverUrl: body.coverUrl || '',
      difficulty: body.difficulty || '简单',
      cookTime: typeof body.cookTime === 'number' ? body.cookTime : 30,
      uploaderId: userId,
      visibility: body.visibility || 'family',
      versionCount: 1,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });

    return ok(newRecipe, '上传成功');
  }

  // PATCH /api/family/recipes/:id/visibility
  // 切换菜谱可见性（仅作者可操作）
  @Patch('/recipes/:id/visibility')
  async updateVisibility(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const recipeId = ctx.params.id as string;
    const { visibility } = (ctx.request.body || {}) as { visibility?: RecipeVisibility };

    const recipe = await family_recipes.findById(recipeId);
    // 找不到或已删除 → 菜谱不存在
    if (!recipe || recipe.isDeleted) {
      return fail('菜谱不存在', 404);
    }

    // 权限校验：仅作者可改可见性
    if (recipe.uploaderId !== userId) {
      return forbidden('无权限操作');
    }

    // 校验 visibility 合法
    if (visibility !== 'family' && visibility !== 'private') {
      return fail('visibility 参数不合法', 400);
    }

    const updated = await family_recipes.updateById(recipeId, { visibility });
    return ok(updated);
  }

  // ============================================================
  // SubTask 5.5：协作菜单端点
  // ============================================================

  // GET /api/family/menu
  // 列出本周菜单，按 dayOfWeek 升序、餐次（早<午<晚）排序
  @Get('/menu')
  async getMenu(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);

    if (!family) {
      return ok([]);
    }

    const list = await weekly_menu.findAll((m) => m.familyId === family.id);
    // 排序：先按天，再按餐次
    list.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];
    });
    return ok(list);
  }

  // POST /api/family/menu
  // 添加菜单项；该天该餐次已有项则替换（避免重复）
  @Post('/menu')
  async addMenu(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const { dayOfWeek, mealType, recipeId, recipeName } = (ctx.request.body || {}) as {
      dayOfWeek?: number;
      mealType?: MealType;
      recipeId?: string;
      recipeName?: string;
    };

    // 校验 dayOfWeek 合法（1-7）
    if (typeof dayOfWeek !== 'number' || dayOfWeek < 1 || dayOfWeek > 7) {
      return fail('dayOfWeek 不合法', 400);
    }
    // 校验 mealType 合法
    if (mealType !== 'breakfast' && mealType !== 'lunch' && mealType !== 'dinner') {
      return fail('mealType 不合法', 400);
    }
    if (!recipeId || !recipeName) {
      return fail('recipeId 和 recipeName 不能为空', 400);
    }

    const family = await findUserFamily(userId);
    if (!family) {
      return fail('未加入家庭组', 400);
    }

    // 若该天该餐次已有菜单项 → 替换（更新 recipeId / recipeName / 重置投票）
    const existingArr = await weekly_menu.findAll(
      (m) => m.familyId === family.id && m.dayOfWeek === dayOfWeek && m.mealType === mealType
    );
    const existing = existingArr[0];
    if (existing) {
      const updated = await weekly_menu.updateById(existing.id, {
        recipeId,
        recipeName,
        votes: { likes: 0, dislikes: 0 },
      });
      return ok(updated, '已添加到菜单');
    }

    // 否则插入新项
    const newItem = await weekly_menu.insert({
      id: uuid(),
      familyId: family.id,
      weekStart: getCurrentMonday(),
      dayOfWeek,
      mealType,
      recipeId,
      recipeName,
      votes: { likes: 0, dislikes: 0 },
    });
    return ok(newItem, '已添加到菜单');
  }

  // POST /api/family/menu/:id/vote
  // 菜单项投票：相同则撤销，不同则切换，未投则新增
  @Post('/menu/:id/vote')
  async vote(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const menuItemId = ctx.params.id as string;
    const { vote } = (ctx.request.body || {}) as { vote?: VoteType };

    // 校验 vote 合法
    if (vote !== 'like' && vote !== 'dislike') {
      return fail('vote 参数不合法', 400);
    }

    const item = await weekly_menu.findById(menuItemId);
    if (!item) {
      return fail('菜单项不存在', 404);
    }

    // 复制当前 voters（避免直接修改原对象）
    const voters: Record<string, VoteType> = { ...(item.votes.voters || {}) };
    const currentVote = voters[userId];
    let likes = item.votes.likes;
    let dislikes = item.votes.dislikes;

    if (currentVote === vote) {
      // 已投相同 → 撤销投票
      if (vote === 'like') likes -= 1;
      else dislikes -= 1;
      delete voters[userId];
    } else if (currentVote) {
      // 已投不同 → 切换：原票 -1，新票 +1
      if (currentVote === 'like') likes -= 1;
      else dislikes -= 1;
      if (vote === 'like') likes += 1;
      else dislikes += 1;
      voters[userId] = vote;
    } else {
      // 未投 → 直接 +1
      if (vote === 'like') likes += 1;
      else dislikes += 1;
      voters[userId] = vote;
    }

    const updatedVotes: MenuVotes = { likes, dislikes, voters };
    await weekly_menu.updateById(menuItemId, { votes: updatedVotes });

    return ok({ likes, dislikes });
  }

  // ============================================================
  // SubTask 5.6：购物清单端点
  // ============================================================

  // GET /api/family/shopping
  // 列出当前家庭组购物清单（数组形式，由前端按品类分组展示）
  @Get('/shopping')
  async getShopping(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);

    if (!family) {
      return ok([]);
    }

    const list = await shopping_items.findAll((i) => i.familyId === family.id);
    return ok(list);
  }

  // POST /api/family/shopping
  // 添加购物项，sort 自动递增（当前家庭组最大 sort + 1）
  @Post('/shopping')
  async addShopping(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const { name, category, quantity } = (ctx.request.body || {}) as {
      name?: string;
      category?: ShoppingCategory;
      quantity?: string;
    };

    // 校验名称非空
    if (!name || !name.trim()) {
      return fail('名称不能为空', 400);
    }

    const family = await findUserFamily(userId);
    if (!family) {
      return fail('未加入家庭组', 400);
    }

    // 计算当前家庭组最大 sort，+1 作为新项 sort
    const familyItems = await shopping_items.findAll((i) => i.familyId === family.id);
    const maxSort = familyItems.reduce((max, i) => Math.max(max, i.sort), 0);
    const now = new Date().toISOString();

    const newItem = await shopping_items.insert({
      id: uuid(),
      familyId: family.id,
      name: name.trim(),
      category: category || '其他',
      quantity: quantity || '',
      checked: false,
      sort: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    });
    return ok(newItem, '已添加');
  }

  // PATCH /api/family/shopping/:id
  // 切换购物项勾选状态；checked 缺省时取反
  @Patch('/shopping/:id')
  async toggleShopping(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const itemId = ctx.params.id as string;
    const { checked } = (ctx.request.body || {}) as { checked?: boolean };

    const item = await shopping_items.findById(itemId);
    if (!item) {
      return fail('购物项不存在', 404);
    }

    // checked 缺省则取反当前值
    const nextChecked = typeof checked === 'boolean' ? checked : !item.checked;
    const patch: Partial<ShoppingItem> = { checked: nextChecked };
    // 勾选时记录勾选人和时间
    if (nextChecked) {
      patch.checkedBy = userId;
      patch.checkedAt = new Date().toISOString();
    }

    const updated = await shopping_items.updateById(itemId, patch);
    return ok(updated);
  }

  // DELETE /api/family/shopping/:id
  // 删除购物项
  @Delete('/shopping/:id')
  async deleteShopping(ctx: Context): Promise<ApiResponse> {
    const itemId = ctx.params.id as string;

    const shoppingArr = await shopping_items.toArray();
    const idx = shoppingArr.findIndex((i) => i.id === itemId);
    if (idx === -1) {
      return fail('购物项不存在', 404);
    }
    shoppingArr.splice(idx, 1);
    return ok(null, '已删除');
  }

  // POST /api/family/shopping/generate
  // 根据本周菜单自动生成购物清单：聚合菜单中各菜谱的食材，去重后批量插入
  @Post('/shopping/generate')
  async generateShopping(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);

    // 未加入家庭组
    if (!family) {
      return ok({ added: 0, skipped: 0, message: '未加入家庭组' } as ShoppingGenerateResult);
    }

    // 获取本周菜单
    const menuItems = await weekly_menu.findAll((m) => m.familyId === family.id);
    if (menuItems.length === 0) {
      return ok({ added: 0, skipped: 0, message: '本周菜单为空，请先添加菜单' } as ShoppingGenerateResult);
    }

    // 聚合食材：Map<name+unit, RecipeIngredient> 用于跨菜谱去重
    const ingredientMap = new Map<string, RecipeIngredient>();
    for (const menu of menuItems) {
      const recipe = await family_recipes.findById(menu.recipeId);
      if (!recipe || recipe.isDeleted) continue;
      for (const ing of recipe.ingredients) {
        const key = `${ing.name}|${ing.unit}`;
        if (!ingredientMap.has(key)) {
          ingredientMap.set(key, ing);
        }
      }
    }

    // 计算当前家庭组最大 sort，新条目依次递增
    const familyItems = await shopping_items.findAll((i) => i.familyId === family.id);
    const maxSort = familyItems.reduce((max, i) => Math.max(max, i.sort), 0);

    let added = 0;
    let skipped = 0;
    let nextSort = maxSort + 1;
    const now = new Date().toISOString();

    for (const ing of ingredientMap.values()) {
      // 检查 shopping_items 中是否已存在相同 name 的条目（shopping_items 无独立 unit 字段，按名称去重）
      const exists = (await shopping_items.count(
        (i) => i.familyId === family.id && i.name === ing.name
      )) > 0;
      if (exists) {
        skipped += 1;
        continue;
      }
      await shopping_items.insert({
        id: uuid(),
        familyId: family.id,
        name: ing.name,
        category: '其他',
        quantity: `${ing.amount}${ing.unit}`,
        checked: false,
        sort: nextSort++,
        createdAt: now,
        updatedAt: now,
      });
      added += 1;
    }

    return ok({ added, skipped } as ShoppingGenerateResult);
  }

  // ============================================================
  // 家庭动态端点（F16）
  // ============================================================

  // GET /api/family/records?page=1&pageSize=20
  // 返回家庭成员的饮食记录（按时间倒序），附带点赞数/评论数/是否已点赞
  @Get('/records')
  async listFamilyRecords(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);

    if (!family) {
      return ok({ list: [], total: 0, page: 1, pageSize: 20 });
    }

    // 获取家庭成员的 userId 列表
    const members = await family_members.findAll((m) => m.familyId === family.id);
    const memberUserIds = members.map((m) => m.userId);

    // 分页参数
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = Math.max(1, Number(ctx.query.pageSize) || 20);

    // 过滤：属于家庭成员 + 未删除
    let list = await records.findAll((r) => memberUserIds.includes(r.userId) && !r.isDeleted);

    // 按 createdAt 降序
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

    const total = list.length;
    const start = (page - 1) * pageSize;
    const pagedList = list.slice(start, start + pageSize);

    // 构造 FamilyRecordItem
    const items: FamilyRecordItem[] = [];
    for (const record of pagedList) {
      const user = await users.findById(record.userId);
      const likes = await record_likes.findAll((l) => l.recordId === record.id);
      const comments = await record_comments.findAll((c) => c.recordId === record.id);
      const likedByMe = likes.some((l) => l.userId === userId);

      items.push({
        id: record.id,
        userId: record.userId,
        userNickname: user?.nickname ?? '',
        userAvatar: user?.avatar ?? '',
        dishName: record.dishName,
        imageUrl: record.imageUrl,
        beautifiedUrl: record.beautifiedUrl,
        rating: record.rating,
        tags: record.tags,
        recordDate: record.recordDate,
        cookingMethod: record.cookingMethod,
        likeCount: likes.length,
        commentCount: comments.length,
        likedByMe,
        comments: comments.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      });
    }

    return ok({ list: items, total, page, pageSize });
  }

  // POST /api/family/records/:id/like
  // 点赞/取消点赞（toggle）
  @Post('/records/:id/like')
  async toggleLike(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const recordId = ctx.params.id as string;

    // 检查记录是否存在
    const record = await records.findById(recordId);
    if (!record || record.isDeleted) {
      return fail('记录不存在', 404);
    }

    // 检查是否已点赞
    const existingLikeArr = await record_likes.findAll(
      (l) => l.recordId === recordId && l.userId === userId
    );
    const existingLike = existingLikeArr[0];

    if (existingLike) {
      // 已点赞 → 取消点赞
      const likesArr = await record_likes.toArray();
      const idx = likesArr.indexOf(existingLike);
      likesArr.splice(idx, 1);
      return ok({ liked: false, message: '已取消点赞' });
    }

    // 未点赞 → 新增点赞
    await record_likes.insert({
      id: uuid(),
      recordId,
      userId,
      createdAt: new Date().toISOString(),
    });
    return ok({ liked: true, message: '点赞成功' });
  }

  // POST /api/family/records/:id/comments
  // 添加评论
  @Post('/records/:id/comments')
  async addComment(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const recordId = ctx.params.id as string;
    const { content } = (ctx.request.body || {}) as { content?: string };

    if (!content || !content.trim()) {
      return fail('评论内容不能为空', 400);
    }

    // 检查记录是否存在
    const record = await records.findById(recordId);
    if (!record || record.isDeleted) {
      return fail('记录不存在', 404);
    }

    // 获取用户昵称
    const user = await users.findById(userId);
    const userNickname = user?.nickname ?? '匿名';

    const newComment = await record_comments.insert({
      id: uuid(),
      recordId,
      userId,
      userNickname,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    });

    return ok(newComment, '评论成功');
  }

  // ============================================================
  // 家庭饮食月度报告（F17）
  // ============================================================

  // GET /api/family/report?month=YYYY-MM
  // 聚合家庭成员当月饮食记录生成报告
  // - 从 ctx.state.user 获取 userId
  // - 调用 findUserFamily 查家庭，不存在返回空报告
  // - 从 ctx.query.month 获取月份，默认当月（YYYY-MM 格式）
  // - 调用 generateFamilyDietReport(family.id, month) 返回
  @Get('/report')
  async getReport(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const family = await findUserFamily(userId);

    // 默认当月 YYYY-MM
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const month = (ctx.query.month as string) || currentMonth;

    // 未加入家庭组 → 返回空报告
    if (!family) {
      const emptyReport: FamilyDietReport = {
        month,
        totalRecords: 0,
        prevMonthRecords: 0,
        memberContributions: [],
        topDishes: [],
        avgRating: 0,
        tagDistribution: [],
      };
      return ok(emptyReport);
    }

    const report = await generateFamilyDietReport(family.id, month);
    return ok(report);
  }
}
