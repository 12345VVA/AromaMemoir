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
} from '../store/db';
import { findById, findByField, filterBy, insert, updateById, uuid } from '../store/helpers';
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
} from '../store/types';
import { findUserFamily, getUserMembership, requireRole, getCurrentMonday } from '../service/family.service';
import { AchievementService } from '../service/achievement.service';

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
    const family = findUserFamily(userId);
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
    const family = insert<Family>(families, {
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
    insert<FamilyMember>(family_members, {
      id: uuid(),
      familyId,
      userId,
      role: 'owner',
      joinedAt: now,
    });

    // 创建家庭组后触发 family 类成就自动解锁
    const newAchievements = AchievementService.checkAndUnlockFamilyAchievements(userId);

    return ok({ family, newAchievements }, '创建成功');
  }

  // ============================================================
  // SubTask 5.2：成员管理端点
  // ============================================================

  // GET /api/family/members
  // 列出当前家庭组全部成员，关联 users 表补全昵称/头像
  @Get('/members')
  async getMembers(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const membership = getUserMembership(userId);
    // 未加入家庭组 → 返回空列表
    if (!membership) return ok([]);

    const list = filterBy(family_members, (m) => m.familyId === membership.familyId).map((m) => {
      const user = findByField(users, 'id', m.userId);
      return {
        id: m.id,
        userId: m.userId,
        nickname: user?.nickname ?? '',
        avatar: user?.avatar ?? '',
        role: m.role,
        joinedAt: m.joinedAt,
      };
    });
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
    if (!requireRole(userId, ['owner', 'admin'])) {
      return forbidden('无权限操作');
    }

    // 校验新角色合法（仅 admin / member）
    if (role !== 'admin' && role !== 'member') {
      return fail('角色不合法', 400);
    }

    const target = findById(family_members, memberRecordId);
    if (!target) {
      return fail('成员不存在', 404);
    }

    // 不允许把 owner 改为其他角色（避免家庭组无主）
    if (target.role === 'owner') {
      return fail('不能修改 owner 角色', 400);
    }

    const updated = updateById(family_members, memberRecordId, { role });
    return ok(updated);
  }

  // DELETE /api/family/members/:id
  // 移除成员（仅 owner 可操作，且 owner 不能移除自己）
  @Delete('/members/:id')
  async removeMember(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const memberRecordId = ctx.params.id as string;

    // 权限校验：当前用户必须是 owner
    if (!requireRole(userId, ['owner'])) {
      return forbidden('无权限操作');
    }

    const target = findById(family_members, memberRecordId);
    if (!target) {
      return fail('成员不存在', 404);
    }

    // 不允许 owner 移除自己
    if (target.userId === userId) {
      return fail('owner 不能移除自己', 400);
    }

    // 从 family_members 数组中删除该记录
    const idx = family_members.findIndex((m) => m.id === memberRecordId);
    if (idx !== -1) {
      family_members.splice(idx, 1);
    }

    // 更新对应家庭组 memberCount - 1
    const family = findByField(families, 'id', target.familyId);
    if (family) {
      updateById(families, family.id, { memberCount: Math.max(0, family.memberCount - 1) });
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
    const family = findUserFamily(userId);

    if (!family) {
      return fail('未加入家庭组', 400);
    }

    // 权限校验：owner 或 admin
    if (!requireRole(userId, ['owner', 'admin'])) {
      return forbidden('无权限操作');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const code = generateInviteCode();

    const newInvitation = insert<Invitation>(invitations, {
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
    const family = findUserFamily(userId);

    if (!family) {
      return fail('未加入家庭组', 400);
    }

    if (!requireRole(userId, ['owner', 'admin'])) {
      return forbidden('无权限操作');
    }

    const now = new Date();
    const list = filterBy(
      invitations,
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

    const invitation = findByField(invitations, 'code', code.trim());
    // 找不到 / 已过期 → 统一返回"邀请码无效或已过期"
    if (!invitation || new Date(invitation.expiresAt) <= new Date()) {
      return fail('邀请码无效或已过期', 400);
    }
    // 已使用
    if (invitation.used) {
      return fail('邀请码已使用', 400);
    }

    // 校验当前用户是否已加入该家庭组
    const existed = family_members.find(
      (m) => m.familyId === invitation.familyId && m.userId === userId
    );
    if (existed) {
      return fail('已加入该家庭组', 400);
    }

    const now = new Date().toISOString();

    // 创建成员关系：role='member'
    insert<FamilyMember>(family_members, {
      id: uuid(),
      familyId: invitation.familyId,
      userId,
      role: 'member',
      joinedAt: now,
    });

    // 标记邀请码已使用
    updateById(invitations, invitation.id, { used: true });

    // 更新家庭组 memberCount + 1
    const family = findByField(families, 'id', invitation.familyId);
    if (family) {
      updateById(families, family.id, { memberCount: family.memberCount + 1 });
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
    const family = findUserFamily(userId);

    if (!family) {
      return ok([]);
    }

    const visibility = ctx.query.visibility as string | undefined;
    const authorId = ctx.query.authorId as string | undefined;
    const category = ctx.query.category as string | undefined;

    // 基础过滤：同家庭组 + 未删除
    let list = filterBy(family_recipes, (r) => r.familyId === family.id && !r.isDeleted);

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

  // PATCH /api/family/recipes/:id/visibility
  // 切换菜谱可见性（仅作者可操作）
  @Patch('/recipes/:id/visibility')
  async updateVisibility(ctx: Context): Promise<ApiResponse> {
    const { userId } = ctx.state.user as { userId: string; username: string };
    const recipeId = ctx.params.id as string;
    const { visibility } = (ctx.request.body || {}) as { visibility?: RecipeVisibility };

    const recipe = findById(family_recipes, recipeId);
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

    const updated = updateById<FamilyRecipe>(family_recipes, recipeId, { visibility });
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
    const family = findUserFamily(userId);

    if (!family) {
      return ok([]);
    }

    const list = filterBy(weekly_menu, (m) => m.familyId === family.id);
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

    const family = findUserFamily(userId);
    if (!family) {
      return fail('未加入家庭组', 400);
    }

    // 若该天该餐次已有菜单项 → 替换（更新 recipeId / recipeName / 重置投票）
    const existing = weekly_menu.find(
      (m) => m.familyId === family.id && m.dayOfWeek === dayOfWeek && m.mealType === mealType
    );
    if (existing) {
      const updated = updateById<WeeklyMenuItem>(weekly_menu, existing.id, {
        recipeId,
        recipeName,
        votes: { likes: 0, dislikes: 0 },
      });
      return ok(updated, '已添加到菜单');
    }

    // 否则插入新项
    const newItem = insert<WeeklyMenuItem>(weekly_menu, {
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

    const item = findById(weekly_menu, menuItemId);
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
    updateById<WeeklyMenuItem>(weekly_menu, menuItemId, { votes: updatedVotes });

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
    const family = findUserFamily(userId);

    if (!family) {
      return ok([]);
    }

    const list = filterBy(shopping_items, (i) => i.familyId === family.id);
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

    const family = findUserFamily(userId);
    if (!family) {
      return fail('未加入家庭组', 400);
    }

    // 计算当前家庭组最大 sort，+1 作为新项 sort
    const familyItems = filterBy(shopping_items, (i) => i.familyId === family.id);
    const maxSort = familyItems.reduce((max, i) => Math.max(max, i.sort), 0);
    const now = new Date().toISOString();

    const newItem = insert<ShoppingItem>(shopping_items, {
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

    const item = findById(shopping_items, itemId);
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

    const updated = updateById<ShoppingItem>(shopping_items, itemId, patch);
    return ok(updated);
  }

  // DELETE /api/family/shopping/:id
  // 删除购物项
  @Delete('/shopping/:id')
  async deleteShopping(ctx: Context): Promise<ApiResponse> {
    const itemId = ctx.params.id as string;

    const idx = shopping_items.findIndex((i) => i.id === itemId);
    if (idx === -1) {
      return fail('购物项不存在', 404);
    }
    shopping_items.splice(idx, 1);
    return ok(null, '已删除');
  }
}
