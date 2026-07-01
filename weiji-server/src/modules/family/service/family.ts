import { Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like, In, MoreThan } from 'typeorm';
import { FamilyEntity } from '../entity/family';
import { FamilyMemberEntity } from '../entity/member';
import { FamilyRecipeEntity } from '../entity/recipe';
import { FamilyInvitationEntity } from '../entity/invitation';
import { WeeklyMenuEntity } from '../entity/menu';
import { ShoppingItemEntity } from '../entity/shopping';
import { AppUserEntity } from '../../account/entity/user';
import { RecordEntity } from '../../record/entity/record';

/**
 * 家庭组服务
 * 综合服务，含家庭/成员/邀请/菜谱/菜单/购物/报告 8 个子域
 */
@Provide()
export class FamilyService extends BaseService {
  @InjectEntityModel(FamilyEntity)
  familyEntity: Repository<FamilyEntity>;

  @InjectEntityModel(FamilyMemberEntity)
  familyMemberEntity: Repository<FamilyMemberEntity>;

  @InjectEntityModel(FamilyRecipeEntity)
  familyRecipeEntity: Repository<FamilyRecipeEntity>;

  @InjectEntityModel(FamilyInvitationEntity)
  familyInvitationEntity: Repository<FamilyInvitationEntity>;

  @InjectEntityModel(WeeklyMenuEntity)
  weeklyMenuEntity: Repository<WeeklyMenuEntity>;

  @InjectEntityModel(ShoppingItemEntity)
  shoppingItemEntity: Repository<ShoppingItemEntity>;

  @InjectEntityModel(AppUserEntity)
  appUserEntity: Repository<AppUserEntity>;

  @InjectEntityModel(RecordEntity)
  recordEntity: Repository<RecordEntity>;

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 获取用户在家庭组中的成员关系记录
   */
  async getUserMembership(userId: number): Promise<FamilyMemberEntity> {
    return this.familyMemberEntity.findOneBy({ userId });
  }

  /**
   * 校验当前用户在家庭组中的角色是否在允许列表内
   */
  async requireRole(userId: number, roles: string[]): Promise<boolean> {
    const membership = await this.getUserMembership(userId);
    if (!membership) return false;
    return roles.includes(membership.role);
  }

  /**
   * 返回本周一日期 YYYY-MM-DD
   */
  getCurrentMonday(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  /**
   * 生成 6 位邀请码：大写字母 + 数字组合
   */
  private generateInviteCode(length = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 计算上一个月 YYYY-MM
   */
  private computePrevMonth(month: string): string {
    const [year, monthNum] = month.split('-').map(Number);
    const prevMonthNum = monthNum - 1;
    const prevYear = prevMonthNum === 0 ? year - 1 : year;
    const prevMonth = prevMonthNum === 0 ? 12 : prevMonthNum;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }

  // ============================================================
  // 家庭组基础
  // ============================================================

  /**
   * 查询当前用户所属家庭组，未加入返回 null
   */
  async getMyFamily(userId: number): Promise<FamilyEntity | null> {
    const membership = await this.getUserMembership(userId);
    if (!membership) return null;
    const family = await this.familyEntity.findOneBy({ id: membership.familyId });
    return family || null;
  }

  /**
   * 创建家庭组，当前用户成为 owner，同步建立 family_members 关系
   */
  async createFamily(
    userId: number,
    body: { name: string; description?: string }
  ): Promise<FamilyEntity> {
    const name = body?.name?.trim();
    if (!name) {
      throw new CoolCommException('家庭组名称不能为空');
    }
    const now = new Date().toISOString();
    // 创建家庭组
    const family = await this.familyEntity.save({
      name,
      ownerId: userId,
      inviteCode: this.generateInviteCode(),
      memberCount: 1,
      description: body.description || '',
    });
    // 同步创建 owner 成员关系
    await this.familyMemberEntity.save({
      familyId: family.id,
      userId,
      role: 'owner',
      joinedAt: now,
    });
    return family;
  }

  // ============================================================
  // 成员管理
  // ============================================================

  /**
   * 列出家庭组全部成员，关联 weiji_app_user 补全 nickName/avatarUrl
   */
  async listMembers(userId: number, familyId: number): Promise<any[]> {
    const members = await this.familyMemberEntity.find({
      where: { familyId },
      order: { id: 'ASC' },
    });
    if (members.length === 0) return [];
    const userIds = members.map(m => m.userId);
    const users = await this.appUserEntity.find({
      where: { id: In(userIds) },
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    return members.map(m => {
      const user = userMap.get(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        nickName: user?.nickName ?? '',
        avatarUrl: user?.avatarUrl ?? '',
        role: m.role,
        joinedAt: m.joinedAt,
      };
    });
  }

  /**
   * 修改成员角色（仅 admin/member，不可改 owner；需校验操作者是 owner/admin）
   */
  async updateMember(
    userId: number,
    memberId: number,
    body: { role: string }
  ): Promise<FamilyMemberEntity> {
    // 权限校验：当前用户必须是 owner 或 admin
    const hasPermission = await this.requireRole(userId, ['owner', 'admin']);
    if (!hasPermission) {
      throw new CoolCommException('无权限操作');
    }
    // 校验新角色合法（仅 admin / member）
    if (body.role !== 'admin' && body.role !== 'member') {
      throw new CoolCommException('角色不合法');
    }
    const target = await this.familyMemberEntity.findOneBy({ id: memberId });
    if (!target) {
      throw new CoolCommException('成员不存在');
    }
    // 不允许把 owner 改为其他角色
    if (target.role === 'owner') {
      throw new CoolCommException('不能修改 owner 角色');
    }
    await this.familyMemberEntity.update(memberId, { role: body.role });
    return this.familyMemberEntity.findOneBy({ id: memberId });
  }

  /**
   * 移除成员（仅 owner，owner 不能移除自己，同步 memberCount-1）
   */
  async removeMember(userId: number, memberId: number): Promise<void> {
    // 权限校验：当前用户必须是 owner
    const hasPermission = await this.requireRole(userId, ['owner']);
    if (!hasPermission) {
      throw new CoolCommException('无权限操作');
    }
    const target = await this.familyMemberEntity.findOneBy({ id: memberId });
    if (!target) {
      throw new CoolCommException('成员不存在');
    }
    // 不允许 owner 移除自己
    if (target.userId === userId) {
      throw new CoolCommException('owner 不能移除自己');
    }
    await this.familyMemberEntity.delete(memberId);
    // 更新家庭组 memberCount - 1
    const family = await this.familyEntity.findOneBy({ id: target.familyId });
    if (family) {
      await this.familyEntity.update(family.id, {
        memberCount: Math.max(0, family.memberCount - 1),
      });
    }
  }

  // ============================================================
  // 邀请
  // ============================================================

  /**
   * 生成 24h 有效邀请码，返回 { code, expiresAt }（仅 owner/admin）
   */
  async createInvitation(
    userId: number,
    familyId: number
  ): Promise<{ code: string; expiresAt: string }> {
    // 权限校验：owner 或 admin
    const hasPermission = await this.requireRole(userId, ['owner', 'admin']);
    if (!hasPermission) {
      throw new CoolCommException('无权限操作');
    }
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + 24 * 60 * 60 * 1000
    ).toISOString();
    const code = this.generateInviteCode();
    await this.familyInvitationEntity.save({
      code,
      familyId,
      creatorId: userId,
      expiresAt,
      used: false,
    });
    return { code, expiresAt };
  }

  /**
   * 列出未过期、未使用的有效邀请码（仅 owner/admin）
   */
  async listInvitations(
    userId: number,
    familyId: number
  ): Promise<FamilyInvitationEntity[]> {
    const hasPermission = await this.requireRole(userId, ['owner', 'admin']);
    if (!hasPermission) {
      throw new CoolCommException('无权限操作');
    }
    const now = new Date().toISOString();
    return this.familyInvitationEntity.find({
      where: {
        familyId,
        used: false,
        expiresAt: MoreThan(now),
      },
      order: { id: 'DESC' },
    });
  }

  /**
   * 通过邀请码加入家庭组（角色 member），校验有效性/过期/已用/已加入，同步 memberCount+1
   */
  async joinFamily(
    userId: number,
    body: { code: string }
  ): Promise<FamilyEntity> {
    const code = body?.code?.trim();
    if (!code) {
      throw new CoolCommException('邀请码不能为空');
    }
    const invitation = await this.familyInvitationEntity.findOneBy({ code });
    // 找不到 / 已过期 → 统一返回"邀请码无效或已过期"
    if (!invitation || new Date(invitation.expiresAt) <= new Date()) {
      throw new CoolCommException('邀请码无效或已过期');
    }
    // 已使用
    if (invitation.used) {
      throw new CoolCommException('邀请码已使用');
    }
    // 校验当前用户是否已加入该家庭组
    const existed = await this.familyMemberEntity.findOneBy({
      familyId: invitation.familyId,
      userId,
    });
    if (existed) {
      throw new CoolCommException('已加入该家庭组');
    }
    const now = new Date().toISOString();
    // 创建成员关系：role='member'
    await this.familyMemberEntity.save({
      familyId: invitation.familyId,
      userId,
      role: 'member',
      joinedAt: now,
    });
    // 标记邀请码已使用
    await this.familyInvitationEntity.update(invitation.id, { used: true });
    // 更新家庭组 memberCount + 1
    const family = await this.familyEntity.findOneBy({
      id: invitation.familyId,
    });
    if (family) {
      await this.familyEntity.update(family.id, {
        memberCount: family.memberCount + 1,
      });
    }
    return this.familyEntity.findOneBy({ id: invitation.familyId });
  }

  // ============================================================
  // 菜谱
  // ============================================================

  /**
   * 列出家庭组菜谱，支持 visibility/authorId/category/keyword 筛选
   */
  async listRecipes(
    userId: number,
    familyId: number,
    query: {
      visibility?: string;
      authorId?: number;
      category?: string;
      keyword?: string;
    }
  ): Promise<FamilyRecipeEntity[]> {
    const where: any = { familyId };
    // 可见性过滤
    if (query.visibility === 'family') {
      where.visibility = 'family';
    } else if (query.visibility === 'private') {
      where.visibility = 'private';
      where.authorId = userId;
    }
    // 作者过滤
    if (query.authorId) {
      where.authorId = query.authorId;
    }
    // 分类过滤
    if (query.category) {
      where.category = query.category;
    }
    // 关键词过滤（按菜谱名称模糊匹配）
    if (query.keyword) {
      where.name = Like(`%${query.keyword}%`);
    }
    return this.familyRecipeEntity.find({
      where,
      order: { id: 'DESC' },
    });
  }

  /**
   * 上传菜谱（name/ingredients 必填）
   */
  async createRecipe(
    userId: number,
    familyId: number,
    body: {
      name: string;
      category?: string;
      ingredients?: any[];
      steps?: any[];
      coverUrl?: string;
      difficulty?: string;
      cookTime?: number;
      visibility?: string;
    }
  ): Promise<FamilyRecipeEntity> {
    if (!body.name || !body.name.trim()) {
      throw new CoolCommException('菜谱名称不能为空');
    }
    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      throw new CoolCommException('食材清单不能为空');
    }
    return this.familyRecipeEntity.save({
      familyId,
      authorId: userId,
      name: body.name.trim(),
      category: body.category || '家常菜',
      ingredients: body.ingredients,
      steps: Array.isArray(body.steps) ? body.steps : [],
      coverUrl: body.coverUrl || '',
      difficulty: body.difficulty || 'easy',
      cookTime: typeof body.cookTime === 'number' ? body.cookTime : 30,
      visibility: body.visibility || 'family',
    });
  }

  /**
   * 菜谱详情
   */
  async getRecipe(userId: number, id: number): Promise<FamilyRecipeEntity> {
    const recipe = await this.familyRecipeEntity.findOneBy({ id });
    if (!recipe) {
      throw new CoolCommException('菜谱不存在');
    }
    return recipe;
  }

  /**
   * 编辑菜谱（仅作者）
   */
  async updateRecipe(
    userId: number,
    id: number,
    body: {
      name?: string;
      category?: string;
      ingredients?: any[];
      steps?: any[];
      coverUrl?: string;
      difficulty?: string;
      cookTime?: number;
      visibility?: string;
    }
  ): Promise<FamilyRecipeEntity> {
    const recipe = await this.familyRecipeEntity.findOneBy({ id });
    if (!recipe) {
      throw new CoolCommException('菜谱不存在');
    }
    // 权限校验：仅作者可编辑
    if (recipe.authorId !== userId) {
      throw new CoolCommException('无权操作');
    }
    // 仅更新提供的字段
    const patch: any = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.category !== undefined) patch.category = body.category;
    if (body.ingredients !== undefined) patch.ingredients = body.ingredients;
    if (body.steps !== undefined) patch.steps = body.steps;
    if (body.coverUrl !== undefined) patch.coverUrl = body.coverUrl;
    if (body.difficulty !== undefined) patch.difficulty = body.difficulty;
    if (body.cookTime !== undefined) patch.cookTime = body.cookTime;
    if (body.visibility !== undefined) patch.visibility = body.visibility;
    if (Object.keys(patch).length > 0) {
      await this.familyRecipeEntity.update(id, patch);
    }
    return this.familyRecipeEntity.findOneBy({ id });
  }

  /**
   * 删除菜谱（仅作者）
   */
  async deleteRecipe(userId: number, id: number): Promise<void> {
    const recipe = await this.familyRecipeEntity.findOneBy({ id });
    if (!recipe) {
      throw new CoolCommException('菜谱不存在');
    }
    // 权限校验：仅作者可删除
    if (recipe.authorId !== userId) {
      throw new CoolCommException('无权操作');
    }
    await this.familyRecipeEntity.delete(id);
  }

  /**
   * 切换可见性（仅作者）
   */
  async updateRecipeVisibility(
    userId: number,
    id: number,
    body: { visibility: string }
  ): Promise<FamilyRecipeEntity> {
    const recipe = await this.familyRecipeEntity.findOneBy({ id });
    if (!recipe) {
      throw new CoolCommException('菜谱不存在');
    }
    // 权限校验：仅作者可改可见性
    if (recipe.authorId !== userId) {
      throw new CoolCommException('无权限操作');
    }
    if (body.visibility !== 'family' && body.visibility !== 'private') {
      throw new CoolCommException('visibility 参数不合法');
    }
    await this.familyRecipeEntity.update(id, { visibility: body.visibility });
    return this.familyRecipeEntity.findOneBy({ id });
  }

  // ============================================================
  // 菜单
  // ============================================================

  /**
   * 列出本周菜单，按 dayOfWeek 升序、餐次排序
   */
  async listMenu(userId: number, familyId: number): Promise<WeeklyMenuEntity[]> {
    const list = await this.weeklyMenuEntity.find({
      where: { familyId },
    });
    const mealOrder: Record<string, number> = {
      breakfast: 1,
      lunch: 2,
      dinner: 3,
    };
    return list.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return (mealOrder[a.mealType] || 0) - (mealOrder[b.mealType] || 0);
    });
  }

  /**
   * 添加菜单项（该天该餐次已有则替换并重置投票）
   */
  async addMenu(
    userId: number,
    familyId: number,
    body: {
      dayOfWeek: number;
      mealType: string;
      recipeId?: number;
      recipeName: string;
    }
  ): Promise<WeeklyMenuEntity> {
    // 校验 dayOfWeek 合法（1-7）
    if (
      typeof body.dayOfWeek !== 'number' ||
      body.dayOfWeek < 1 ||
      body.dayOfWeek > 7
    ) {
      throw new CoolCommException('dayOfWeek 不合法');
    }
    // 校验 mealType 合法
    if (
      body.mealType !== 'breakfast' &&
      body.mealType !== 'lunch' &&
      body.mealType !== 'dinner'
    ) {
      throw new CoolCommException('mealType 不合法');
    }
    if (!body.recipeName) {
      throw new CoolCommException('recipeName 不能为空');
    }
    // 若该天该餐次已有菜单项 → 替换（更新 recipeId / recipeName / 重置投票）
    const existing = await this.weeklyMenuEntity.findOneBy({
      familyId,
      dayOfWeek: body.dayOfWeek,
      mealType: body.mealType,
    });
    if (existing) {
      await this.weeklyMenuEntity.update(existing.id, {
        recipeId: body.recipeId || null,
        recipeName: body.recipeName,
        likes: [],
        dislikes: [],
      });
      return this.weeklyMenuEntity.findOneBy({ id: existing.id });
    }
    // 否则插入新项
    return this.weeklyMenuEntity.save({
      familyId,
      dayOfWeek: body.dayOfWeek,
      mealType: body.mealType,
      recipeId: body.recipeId || null,
      recipeName: body.recipeName,
      likes: [],
      dislikes: [],
    });
  }

  /**
   * 投票（like/dislike），相同撤销、不同切换、未投新增，返回 { likes, dislikes }
   */
  async voteMenu(
    userId: number,
    menuId: number,
    body: { vote: string }
  ): Promise<{ likes: number[]; dislikes: number[] }> {
    if (body.vote !== 'like' && body.vote !== 'dislike') {
      throw new CoolCommException('vote 参数不合法');
    }
    const item = await this.weeklyMenuEntity.findOneBy({ id: menuId });
    if (!item) {
      throw new CoolCommException('菜单项不存在');
    }
    let likes: number[] = Array.isArray(item.likes) ? [...item.likes] : [];
    let dislikes: number[] = Array.isArray(item.dislikes)
      ? [...item.dislikes]
      : [];
    const inLikes = likes.includes(userId);
    const inDislikes = dislikes.includes(userId);
    if (body.vote === 'like') {
      if (inLikes) {
        // 已投相同 → 撤销
        likes = likes.filter(id => id !== userId);
      } else {
        // 不同则切换：先从 dislikes 移除，再加到 likes
        dislikes = dislikes.filter(id => id !== userId);
        likes.push(userId);
      }
    } else {
      if (inDislikes) {
        // 已投相同 → 撤销
        dislikes = dislikes.filter(id => id !== userId);
      } else {
        // 不同则切换：先从 likes 移除，再加到 dislikes
        likes = likes.filter(id => id !== userId);
        dislikes.push(userId);
      }
    }
    await this.weeklyMenuEntity.update(menuId, { likes, dislikes });
    return { likes, dislikes };
  }

  // ============================================================
  // 购物
  // ============================================================

  /**
   * 列出当前家庭组购物清单
   */
  async listShopping(
    userId: number,
    familyId: number
  ): Promise<ShoppingItemEntity[]> {
    return this.shoppingItemEntity.find({
      where: { familyId },
      order: { sort: 'ASC', id: 'ASC' },
    });
  }

  /**
   * 添加购物项（name 必填，sort 自动递增）
   */
  async addShopping(
    userId: number,
    familyId: number,
    body: { name: string; category?: string; quantity?: string }
  ): Promise<ShoppingItemEntity> {
    if (!body.name || !body.name.trim()) {
      throw new CoolCommException('名称不能为空');
    }
    // 计算当前家庭组最大 sort，+1 作为新项 sort
    const familyItems = await this.shoppingItemEntity.find({
      where: { familyId },
    });
    const maxSort = familyItems.reduce(
      (max, i) => Math.max(max, i.sort || 0),
      0
    );
    return this.shoppingItemEntity.save({
      familyId,
      name: body.name.trim(),
      category: body.category || '其他',
      quantity: body.quantity || '',
      checked: false,
      sort: maxSort + 1,
    });
  }

  /**
   * 切换勾选状态
   */
  async toggleShopping(
    userId: number,
    shoppingId: number,
    body: { checked?: boolean }
  ): Promise<ShoppingItemEntity> {
    const item = await this.shoppingItemEntity.findOneBy({ id: shoppingId });
    if (!item) {
      throw new CoolCommException('购物项不存在');
    }
    // checked 缺省则取反当前值
    const nextChecked =
      typeof body.checked === 'boolean' ? body.checked : !item.checked;
    const patch: any = { checked: nextChecked };
    // 勾选时记录勾选人和时间
    if (nextChecked) {
      patch.checkedBy = userId;
      patch.checkedAt = new Date().toISOString();
    } else {
      patch.checkedBy = null;
      patch.checkedAt = null;
    }
    await this.shoppingItemEntity.update(shoppingId, patch);
    return this.shoppingItemEntity.findOneBy({ id: shoppingId });
  }

  /**
   * 删除购物项
   */
  async deleteShopping(userId: number, shoppingId: number): Promise<void> {
    const item = await this.shoppingItemEntity.findOneBy({ id: shoppingId });
    if (!item) {
      throw new CoolCommException('购物项不存在');
    }
    await this.shoppingItemEntity.delete(shoppingId);
  }

  /**
   * 根据本周菜单聚合食材去重批量生成购物清单，返回 { added, skipped }
   */
  async generateShopping(
    userId: number,
    familyId: number
  ): Promise<{ added: number; skipped: number }> {
    // 获取本周菜单
    const menuItems = await this.weeklyMenuEntity.find({
      where: { familyId },
    });
    if (menuItems.length === 0) {
      return { added: 0, skipped: 0 };
    }
    // 聚合食材：Map<name|unit, ingredient> 用于跨菜谱去重
    const ingredientMap = new Map<string, any>();
    const recipeIds = menuItems
      .map(m => m.recipeId)
      .filter(id => id != null);
    const recipes = recipeIds.length
      ? await this.familyRecipeEntity.find({ where: { id: In(recipeIds) } })
      : [];
    const recipeMap = new Map(recipes.map(r => [r.id, r]));
    for (const menu of menuItems) {
      if (!menu.recipeId) continue;
      const recipe = recipeMap.get(menu.recipeId);
      if (!recipe) continue;
      const ingredients = Array.isArray(recipe.ingredients)
        ? recipe.ingredients
        : [];
      for (const ing of ingredients) {
        const key = `${ing.name}|${ing.unit}`;
        if (!ingredientMap.has(key)) {
          ingredientMap.set(key, ing);
        }
      }
    }
    // 计算当前家庭组最大 sort，新条目依次递增
    const familyItems = await this.shoppingItemEntity.find({
      where: { familyId },
    });
    const maxSort = familyItems.reduce(
      (max, i) => Math.max(max, i.sort || 0),
      0
    );
    let added = 0;
    let skipped = 0;
    let nextSort = maxSort + 1;
    const existingNames = new Set(familyItems.map(i => i.name));
    for (const ing of ingredientMap.values()) {
      // 检查 shopping_items 中是否已存在相同 name 的条目
      if (existingNames.has(ing.name)) {
        skipped += 1;
        continue;
      }
      await this.shoppingItemEntity.save({
        familyId,
        name: ing.name,
        category: '其他',
        quantity: `${ing.amount || ''}${ing.unit || ''}`,
        checked: false,
        sort: nextSort++,
      });
      existingNames.add(ing.name);
      added += 1;
    }
    return { added, skipped };
  }

  // ============================================================
  // 报告
  // ============================================================

  /**
   * 月度饮食报告（query month 默认当月 YYYY-MM），聚合家庭成员当月记录
   */
  async getReport(
    userId: number,
    familyId: number,
    month: string
  ): Promise<any> {
    // 默认当月 YYYY-MM
    const currentMonth = new Date().toISOString().slice(0, 7);
    const targetMonth = month || currentMonth;
    const prevMonth = this.computePrevMonth(targetMonth);
    // 通过 family_members 找出该家庭的所有 userIds
    const members = await this.familyMemberEntity.find({
      where: { familyId },
    });
    const memberUserIds = members.map(m => m.userId);
    if (memberUserIds.length === 0) {
      return {
        month: targetMonth,
        totalRecords: 0,
        prevMonthRecords: 0,
        memberContributions: [],
        topDishes: [],
        avgRating: 0,
        tagDistribution: [],
      };
    }
    // 过滤当月记录：userId 在家庭组内 + recordDate 月份匹配
    const monthRecords = await this.recordEntity.find({
      where: memberUserIds.map(uid => ({
        userId: uid,
        recordDate: Like(`${targetMonth}%`),
      })),
    });
    // 过滤上月记录（用于环比）
    const prevMonthRecords = await this.recordEntity.count({
      where: memberUserIds.map(uid => ({
        userId: uid,
        recordDate: Like(`${prevMonth}%`),
      })),
    });
    // memberContributions：按 userId 分组聚合，关联 users 表取昵称头像，按记录数倒序
    const memberMap = new Map<number, number>();
    for (const r of monthRecords) {
      memberMap.set(r.userId, (memberMap.get(r.userId) || 0) + 1);
    }
    const users = await this.appUserEntity.find({
      where: { id: In(memberUserIds) },
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    const memberContributions = Array.from(memberMap.entries())
      .map(([uid, recordCount]) => {
        const user = userMap.get(uid);
        return {
          userId: uid,
          userNickname: user?.nickName ?? '',
          userAvatar: user?.avatarUrl ?? '',
          recordCount,
        };
      })
      .sort((a, b) => b.recordCount - a.recordCount);
    // topDishes：按 dishName 分组，统计 count + 平均 rating，取 Top 5
    const dishMap = new Map<
      string,
      { dishName: string; count: number; ratingSum: number }
    >();
    for (const r of monthRecords) {
      const existing = dishMap.get(r.dishName);
      if (existing) {
        existing.count += 1;
        existing.ratingSum += r.rating || 0;
      } else {
        dishMap.set(r.dishName, {
          dishName: r.dishName,
          count: 1,
          ratingSum: r.rating || 0,
        });
      }
    }
    const topDishes = Array.from(dishMap.values())
      .map(d => ({
        dishName: d.dishName,
        count: d.count,
        avgRating: d.count > 0 ? d.ratingSum / d.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    // avgRating：所有记录的平均 rating（无记录时为 0）
    const avgRating =
      monthRecords.length > 0
        ? monthRecords.reduce((sum, r) => sum + (r.rating || 0), 0) /
          monthRecords.length
        : 0;
    // tagDistribution：展开所有 tags 数组，按频次排序，最多 10 个
    const tagMap = new Map<string, number>();
    for (const r of monthRecords) {
      const tags = (r as any).tags || [];
      for (const tag of tags) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }
    const tagDistribution = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return {
      month: targetMonth,
      totalRecords: monthRecords.length,
      prevMonthRecords,
      memberContributions,
      topDishes,
      avgRating,
      tagDistribution,
    };
  }
}
