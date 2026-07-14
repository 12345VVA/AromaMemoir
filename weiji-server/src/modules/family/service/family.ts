import { Inject, Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like, In, MoreThan, Between } from 'typeorm';
import { FamilyEntity } from '../entity/family';
import { FamilyMemberEntity } from '../entity/member';
import { FamilyRecipeEntity } from '../entity/recipe';
import { FamilyInvitationEntity } from '../entity/invitation';
import { WeeklyMenuEntity } from '../entity/menu';
import { ShoppingItemEntity } from '../entity/shopping';
import { AppUserEntity } from '../../account/entity/user';
import { RecordEntity } from '../../record/entity/record';
import { RecordCommentEntity } from '../../record/entity/comment';
import { RecordLikeEntity } from '../../record/entity/like';
import { BlindGuessRoundEntity } from '../../gamification/entity/blind_guess_round';
import { AchievementService } from '../../achievement/service/achievement';
import { mondayStr, currentMonthStr, todayStr, daysAgoStr } from '../../../comm/date';

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

  @InjectEntityModel(RecordCommentEntity)
  recordCommentEntity: Repository<RecordCommentEntity>;

  @InjectEntityModel(RecordLikeEntity)
  recordLikeEntity: Repository<RecordLikeEntity>;

  @InjectEntityModel(BlindGuessRoundEntity)
  blindGuessRoundEntity: Repository<BlindGuessRoundEntity>;

  @Inject()
  achievementService: AchievementService;

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 获取用户在家庭组中的成员关系记录
   * 传入 familyId 时按指定家庭查询，否则取该用户任意一条成员记录（向后兼容）
   */
  async getUserMembership(
    userId: number,
    familyId?: number
  ): Promise<FamilyMemberEntity> {
    if (familyId != null) {
      return this.familyMemberEntity.findOneBy({ userId, familyId });
    }
    return this.familyMemberEntity.findOneBy({ userId });
  }

  /**
   * 校验当前用户在指定家庭组中的角色是否在允许列表内
   */
  async requireRole(
    userId: number,
    familyId: number,
    roles: string[]
  ): Promise<boolean> {
    const membership = await this.getUserMembership(userId, familyId);
    if (!membership) return false;
    return roles.includes(membership.role);
  }

  /**
   * 断言当前用户属于指定家庭组，否则抛 403
   * 用于跨家庭归属校验，防止越权访问其他家庭的资源
   */
  async assertFamilyMembership(
    userId: number,
    familyId: number
  ): Promise<void> {
    const membership = await this.getUserMembership(userId, familyId);
    if (!membership) {
      throw new CoolCommException('无权操作该家庭', 403);
    }
  }

  /**
   * 返回本周一日期 YYYY-MM-DD（本地时区）
   */
  getCurrentMonday(): string {
    return mondayStr();
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
   * family.save + member.save 置于同一事务，避免第二步失败留下孤儿 family 记录
   */
  async createFamily(
    userId: number,
    body: { name: string; description?: string }
  ): Promise<any> {
    const name = body?.name?.trim();
    if (!name) {
      throw new CoolCommException('家庭组名称不能为空');
    }
    const now = new Date().toISOString();
    // 创建家庭组 + 同步创建 owner 成员关系，置于同一事务
    const family = await this.getOrmManager().transaction(async tx => {
      const family = await tx.save(FamilyEntity, {
        name,
        ownerId: userId,
        inviteCode: this.generateInviteCode(),
        memberCount: 1,
        description: body.description || '',
      });
      await tx.save(FamilyMemberEntity, {
        familyId: family.id,
        userId,
        role: 'owner',
        joinedAt: now,
      });
      return family;
    });

    // 触发成就解锁（失败不阻塞创建）
    let newAchievements: any[] = [];
    try {
      newAchievements = await this.achievementService.checkAndUnlock(userId, {
        type: 'family_created',
        value: true,
      });
    } catch (e) {
      // 成就解锁失败不阻塞业务
    }
    return { ...family, newAchievements };
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
    // 取操作者所属家庭关系
    const operatorMembership = await this.getUserMembership(userId);
    if (!operatorMembership) {
      throw new CoolCommException('无权限操作', 403);
    }
    // 权限校验：当前用户在自己家庭内必须是 owner 或 admin
    const hasPermission = await this.requireRole(
      userId,
      operatorMembership.familyId,
      ['owner', 'admin']
    );
    if (!hasPermission) {
      throw new CoolCommException('无权限操作', 403);
    }
    // 校验新角色合法（仅 admin / member）
    if (body.role !== 'admin' && body.role !== 'member') {
      throw new CoolCommException('角色不合法');
    }
    const target = await this.familyMemberEntity.findOneBy({ id: memberId });
    if (!target) {
      throw new CoolCommException('成员不存在');
    }
    // 跨家庭越权校验：目标成员必须属于操作者所在家庭
    if (target.familyId !== operatorMembership.familyId) {
      throw new CoolCommException('无权操作该家庭成员', 403);
    }
    // 不允许把 owner 改为其他角色
    if (target.role === 'owner') {
      throw new CoolCommException('不能修改 owner 角色');
    }
    await this.getOrmManager().transaction(async tx => {
      await tx.update(FamilyMemberEntity, memberId, { role: body.role });
    });
    return this.familyMemberEntity.findOneBy({ id: memberId });
  }

  /**
   * 移除成员（仅 owner，owner 不能移除自己，同步 memberCount-1）
   * member.delete + family.update 置于同一事务，memberCount 改用原子 SQL 自减
   */
  async removeMember(userId: number, memberId: number): Promise<void> {
    // 取操作者所属家庭关系
    const operatorMembership = await this.getUserMembership(userId);
    if (!operatorMembership) {
      throw new CoolCommException('无权限操作', 403);
    }
    // 权限校验：当前用户在自己家庭内必须是 owner
    const hasPermission = await this.requireRole(
      userId,
      operatorMembership.familyId,
      ['owner']
    );
    if (!hasPermission) {
      throw new CoolCommException('无权限操作', 403);
    }
    const target = await this.familyMemberEntity.findOneBy({ id: memberId });
    if (!target) {
      throw new CoolCommException('成员不存在');
    }
    // 跨家庭越权校验：目标成员必须属于操作者所在家庭
    if (target.familyId !== operatorMembership.familyId) {
      throw new CoolCommException('无权操作该家庭成员', 403);
    }
    // 不允许 owner 移除自己
    if (target.userId === userId) {
      throw new CoolCommException('owner 不能移除自己');
    }
    await this.getOrmManager().transaction(async tx => {
      await tx.delete(FamilyMemberEntity, memberId);
      // 原子自减 memberCount，并用 GREATEST 兜底防止负数
      await tx
        .createQueryBuilder()
        .update(FamilyEntity)
        .set({ memberCount: () => 'GREATEST(memberCount - 1, 0)' })
        .where('id = :id', { id: target.familyId })
        .execute();
    });
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
    // 权限校验：owner 或 admin（必须是该 familyId 的成员）
    const hasPermission = await this.requireRole(userId, familyId, [
      'owner',
      'admin',
    ]);
    if (!hasPermission) {
      throw new CoolCommException('无权限操作', 403);
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
    const hasPermission = await this.requireRole(userId, familyId, [
      'owner',
      'admin',
    ]);
    if (!hasPermission) {
      throw new CoolCommException('无权限操作', 403);
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
   * member.save + invitation.update + family.update 置于同一事务，memberCount 改用原子 SQL 自增
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
    try {
      await this.getOrmManager().transaction(async tx => {
        // 创建成员关系：role='member'
        await tx.save(FamilyMemberEntity, {
          familyId: invitation.familyId,
          userId,
          role: 'member',
          joinedAt: now,
        });
        // 标记邀请码已使用
        await tx.update(FamilyInvitationEntity, invitation.id, { used: true });
        // 原子自增 memberCount
        await tx
          .createQueryBuilder()
          .update(FamilyEntity)
          .set({ memberCount: () => 'memberCount + 1' })
          .where('id = :id', { id: invitation.familyId })
          .execute();
      });
    } catch (err: any) {
      // 并发情况下另一事务先插入了成员关系，唯一约束冲突 → 友好提示
      if (err?.code === 'ER_DUP_ENTRY') {
        throw new CoolCommException('已加入该家庭组');
      }
      throw err;
    }
    return this.familyEntity.findOneBy({ id: invitation.familyId });
  }

  // ============================================================
  // 退出 / 解散 / 转让
  // ============================================================

  /**
   * 退出家庭组
   * - owner 单独一人时自动解散家庭组
   * - owner 且仍有其他成员时需先转让或解散，抛 400
   * - 非 owner：事务内删除成员关系、原子自减 memberCount、清理该用户创建的邀请码
   */
  async leaveFamily(userId: number): Promise<{ success: boolean }> {
    const membership = await this.getUserMembership(userId);
    if (!membership) {
      throw new CoolCommException('未加入家庭组');
    }
    const familyId = membership.familyId;
    if (membership.role === 'owner') {
      // 统计家庭组内其他成员数（排除当前 owner）
      const otherMembers = await this.familyMemberEntity
        .createQueryBuilder('m')
        .where('m.familyId = :familyId', { familyId })
        .andWhere('m.userId != :userId', { userId })
        .getCount();
      if (otherMembers === 0) {
        // 仅 owner 一人 → 自动解散
        await this.disbandFamily(userId);
        return { success: true };
      }
      throw new CoolCommException('owner 请先转让或解散家庭组', 400);
    }
    // 非 owner：事务内删除成员关系、原子自减 memberCount、清理该用户创建的邀请码
    await this.getOrmManager().transaction(async tx => {
      await tx.delete(FamilyMemberEntity, { userId, familyId });
      await tx
        .createQueryBuilder()
        .update(FamilyEntity)
        .set({ memberCount: () => 'GREATEST(memberCount - 1, 0)' })
        .where('id = :id', { id: familyId })
        .execute();
      await tx.delete(FamilyInvitationEntity, { creatorId: userId });
    });
    return { success: true };
  }

  /**
   * 解散家庭组
   * - 非 adminForce：校验调用者为 owner，否则抛 403
   * - adminForce：跳过 owner 校验，此时 userId 参数视为 familyId（供 Admin 后台调用）
   * - 事务内删除家庭组全部关联数据；record 表 familyId 不动以保留历史记录
   */
  async disbandFamily(
    userId: number,
    opts?: { adminForce?: boolean }
  ): Promise<{ success: boolean }> {
    let familyId: number;
    if (opts?.adminForce) {
      // 后台强制解散：userId 即为 familyId
      familyId = userId;
    } else {
      const membership = await this.getUserMembership(userId);
      if (!membership) {
        throw new CoolCommException('未加入家庭组', 403);
      }
      if (membership.role !== 'owner') {
        throw new CoolCommException('仅 owner 可解散家庭组', 403);
      }
      familyId = membership.familyId;
    }
    await this.getOrmManager().transaction(async tx => {
      await tx.delete(FamilyMemberEntity, { familyId });
      await tx.delete(FamilyRecipeEntity, { familyId });
      await tx.delete(WeeklyMenuEntity, { familyId });
      await tx.delete(ShoppingItemEntity, { familyId });
      await tx.delete(FamilyInvitationEntity, { familyId });
      await tx.delete(FamilyEntity, familyId);
    });
    return { success: true };
  }

  /**
   * 转让家庭组 owner 给指定成员（仅当前 owner 可操作）
   * 事务内：旧 owner 降为 admin、目标成员升为 owner、family.ownerId 更新
   */
  async transferOwnership(
    userId: number,
    targetMemberId: number
  ): Promise<{ success: boolean }> {
    const operator = await this.getUserMembership(userId);
    if (!operator) {
      throw new CoolCommException('未加入家庭组', 403);
    }
    if (operator.role !== 'owner') {
      throw new CoolCommException('仅 owner 可转让家庭组', 403);
    }
    const target = await this.familyMemberEntity.findOneBy({
      id: targetMemberId,
    });
    if (!target) {
      throw new CoolCommException('目标成员不存在', 400);
    }
    // 跨家庭越权校验：目标成员必须属于操作者所在家庭
    if (target.familyId !== operator.familyId) {
      throw new CoolCommException('目标成员不在本家庭', 403);
    }
    if (target.role === 'owner') {
      throw new CoolCommException('目标已是 owner', 400);
    }
    await this.getOrmManager().transaction(async tx => {
      // 旧 owner 降级为 admin
      await tx.update(
        FamilyMemberEntity,
        { userId, familyId: operator.familyId },
        { role: 'admin' }
      );
      // 目标成员升级为 owner
      await tx.update(
        FamilyMemberEntity,
        { id: targetMemberId },
        { role: 'owner' }
      );
      // 家庭组 ownerId 同步更新
      await tx.update(FamilyEntity, operator.familyId, {
        ownerId: target.userId,
      });
    });
    return { success: true };
  }

  /**
   * 用户注销时清理其在所有家庭组的成员关系
   * - owner 且无其他成员：解散家庭组（复用 disbandFamily，走 owner 校验）
   * - owner 且有其他成员：转让 owner 给最早的 admin（无 admin 则最早的 member）
   * - 非 owner：删除成员关系 + 原子 memberCount -1
   * 每个家庭独立事务，避免单家庭失败影响其他家庭清理
   * 被 UserService.logoff 调用，FamilyService 不依赖 UserService，无循环依赖
   */
  async handleUserLogoff(userId: number): Promise<void> {
    // 查询该用户在所有家庭的 member 关系
    const memberships = await this.familyMemberEntity.find({
      where: { userId },
    });
    for (const membership of memberships) {
      const familyId = membership.familyId;
      if (membership.role === 'owner') {
        // 查家庭其他成员（按 joinedAt ASC 排序）
        const otherMembers = await this.familyMemberEntity
          .createQueryBuilder('m')
          .where('m.familyId = :familyId', { familyId })
          .andWhere('m.userId != :userId', { userId })
          .orderBy('m.joinedAt', 'ASC')
          .getMany();
        if (otherMembers.length === 0) {
          // 无其他成员 → 解散家庭组（非 adminForce，走 owner 校验）
          await this.disbandFamily(userId);
        } else {
          // 选最早的 admin（无 admin 则最早的 member）作为转让目标
          const target =
            otherMembers.find(m => m.role === 'admin') || otherMembers[0];
          // 事务内转让 owner：旧 owner 降 admin、target 升 owner、family.ownerId 更新
          await this.getOrmManager().transaction(async tx => {
            await tx.update(
              FamilyMemberEntity,
              { userId, familyId },
              { role: 'admin' }
            );
            await tx.update(FamilyMemberEntity, target.id, {
              role: 'owner',
            });
            await tx.update(FamilyEntity, familyId, {
              ownerId: target.userId,
            });
          });
        }
      } else {
        // 非 owner：事务内删除成员关系 + 原子自减 memberCount
        await this.getOrmManager().transaction(async tx => {
          await tx.delete(FamilyMemberEntity, { userId, familyId });
          await tx
            .createQueryBuilder()
            .update(FamilyEntity)
            .set({ memberCount: () => 'GREATEST(memberCount - 1, 0)' })
            .where('id = :id', { id: familyId })
            .execute();
        });
      }
    }
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
    } else if (query.visibility === 'public') {
      where.visibility = 'public';
    }
    // 作者过滤（visibility=private 时强制 authorId = userId，不可被 query.authorId 覆盖，避免越权查看他人私有菜谱）
    if (query.authorId && query.visibility !== 'private') {
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
  ): Promise<any> {
    if (!body.name || !body.name.trim()) {
      throw new CoolCommException('菜谱名称不能为空');
    }
    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      throw new CoolCommException('食材清单不能为空');
    }
    const recipe = await this.familyRecipeEntity.save({
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

    // 触发成就解锁（失败不阻塞创建）
    let newAchievements: any[] = [];
    try {
      const recipeCount = await this.familyRecipeEntity.count({
        where: { authorId: userId },
      });
      newAchievements = await this.achievementService.checkAndUnlock(userId, {
        type: 'recipe_count',
        value: recipeCount,
      });
    } catch (e) {
      // 成就解锁失败不阻塞业务
    }
    return { ...recipe, newAchievements };
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
      version?: number;
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
      // 乐观锁：前端传入 version 时校验版本匹配并自增，未传则退化为普通更新
      if (typeof body.version === 'number') {
        const result = await this.familyRecipeEntity
          .createQueryBuilder()
          .update()
          .set({ ...patch, version: () => 'version + 1' })
          .where('id = :id AND version = :oldVersion', {
            id,
            oldVersion: body.version,
          })
          .execute();
        if (result.affected === 0) {
          throw new CoolCommException('数据已被修改，请刷新后重试', 409);
        }
      } else {
        await this.familyRecipeEntity.update(id, patch);
      }
    }
    return this.familyRecipeEntity.findOneBy({ id });
  }

  /**
   * 删除菜谱（仅作者）
   */
  async deleteRecipe(
    userId: number,
    id: number,
    version?: number
  ): Promise<void> {
    const recipe = await this.familyRecipeEntity.findOneBy({ id });
    if (!recipe) {
      throw new CoolCommException('菜谱不存在');
    }
    // 校验家庭归属：调用者必须是菜谱所属家庭的成员
    await this.assertFamilyMembership(userId, recipe.familyId);
    // 权限校验：仅作者可删除
    if (recipe.authorId !== userId) {
      throw new CoolCommException('无权操作');
    }
    // 乐观锁：传入 version 时校验匹配，影响行数 0 抛 409；未传则普通删除
    if (typeof version === 'number') {
      const result = await this.familyRecipeEntity
        .createQueryBuilder()
        .delete()
        .where('id = :id AND version = :version', { id, version })
        .execute();
      if (result.affected === 0) {
        throw new CoolCommException('数据已被修改，请刷新后重试', 409);
      }
    } else {
      await this.familyRecipeEntity.delete(id);
    }
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
    // 校验家庭归属：调用者必须是菜谱所属家庭的成员
    await this.assertFamilyMembership(userId, recipe.familyId);
    // 权限校验：仅作者可改可见性
    if (recipe.authorId !== userId) {
      throw new CoolCommException('无权限操作');
    }
    if (!['family', 'public', 'private'].includes(body.visibility)) {
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
   * 用事务 + 悲观锁（SELECT ... FOR UPDATE）串行化对同一菜单项的并发投票，避免 read-modify-write 丢失
   */
  async voteMenu(
    userId: number,
    menuId: number,
    body: { vote: string }
  ): Promise<{ likes: number[]; dislikes: number[] }> {
    if (body.vote !== 'like' && body.vote !== 'dislike') {
      throw new CoolCommException('vote 参数不合法');
    }
    // 先读取菜单项用于家庭归属校验
    const item = await this.weeklyMenuEntity.findOneBy({ id: menuId });
    if (!item) {
      throw new CoolCommException('菜单项不存在');
    }
    // 校验家庭归属：调用者必须是菜单项所属家庭的成员
    await this.assertFamilyMembership(userId, item.familyId);
    return await this.getOrmManager().transaction(async tx => {
      // 悲观锁锁定菜单行，防止并发读改写丢失投票
      const locked = await tx
        .getRepository(WeeklyMenuEntity)
        .createQueryBuilder('m')
        .setLock('pessimistic_write')
        .where('m.id = :id', { id: menuId })
        .getOne();
      if (!locked) {
        throw new CoolCommException('菜单项不存在');
      }
      let likes: number[] = Array.isArray(locked.likes) ? [...locked.likes] : [];
      let dislikes: number[] = Array.isArray(locked.dislikes)
        ? [...locked.dislikes]
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
      await tx.update(WeeklyMenuEntity, menuId, { likes, dislikes });
      return { likes, dislikes };
    });
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
    // 校验家庭归属：调用者必须是购物项所属家庭的成员
    await this.assertFamilyMembership(userId, item.familyId);
    // 原子更新：checked 缺省时取反（NOT checked），显式指定时设置为指定值
    const now = new Date().toISOString();
    if (typeof body.checked === 'boolean') {
      await this.shoppingItemEntity
        .createQueryBuilder()
        .update()
        .set({
          checked: body.checked,
          checkedBy: body.checked ? userId : null,
          checkedAt: body.checked ? now : null,
        })
        .where('id = :id', { id: shoppingId })
        .execute();
    } else {
      await this.shoppingItemEntity
        .createQueryBuilder()
        .update()
        .set({
          checked: () => 'NOT checked',
          checkedBy: () =>
            'CASE WHEN checked = 0 THEN ' + userId + ' ELSE NULL END',
          checkedAt: () =>
            "CASE WHEN checked = 0 THEN '" + now + "' ELSE NULL END",
        })
        .where('id = :id', { id: shoppingId })
        .execute();
    }
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
    // 校验家庭归属：调用者必须是购物项所属家庭的成员
    await this.assertFamilyMembership(userId, item.familyId);
    await this.getOrmManager().transaction(async tx => {
      await tx.delete(ShoppingItemEntity, shoppingId);
    });
  }

  /**
   * 根据本周菜单聚合食材去重批量生成购物清单，返回 { added, skipped }
   * 批量插入 + 事务，避免循环逐条 save 在中途失败留下部分数据
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
    // 已存在购物项的去重 key 集合（统一用 name|unit）
    // 注意：shopping_item 表无独立 unit 字段，已存在项 unit 视为空字符串
    const existingKeys = new Set(familyItems.map(i => `${i.name}|`));
    const toInsert: any[] = [];
    for (const ing of ingredientMap.values()) {
      const key = `${ing.name}|${ing.unit || ''}`;
      // 检查 shopping_items 中是否已存在相同 name|unit 的条目
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      toInsert.push({
        familyId,
        name: ing.name,
        category: '其他',
        quantity: `${ing.amount || ''}${ing.unit || ''}`,
        checked: false,
        sort: nextSort++,
      });
      existingKeys.add(key);
      added += 1;
    }
    // 一次性批量插入，加事务保证原子性
    if (toInsert.length > 0) {
      await this.getOrmManager().transaction(async tx => {
        await tx.save(ShoppingItemEntity, toInsert);
      });
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
    const currentMonth = currentMonthStr();
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
    // 计算当月日期范围 [start, end]（YYYY-MM-DD）
    const [targetYear, targetMonthNum] = targetMonth
      .split('-')
      .map(Number);
    const targetLastDay = new Date(targetYear, targetMonthNum, 0).getDate();
    const targetStartDate = `${targetMonth}-01`;
    const targetEndDate = `${targetMonth}-${String(targetLastDay).padStart(2, '0')}`;
    // 一次查询所有成员在日期范围内的记录（避免 N+1 循环查询）
    const monthRecords = await this.recordEntity.find({
      where: {
        userId: In(memberUserIds),
        recordDate: Between(targetStartDate, targetEndDate),
      },
    });
    // 计算上月日期范围 [start, end]
    const [prevYear, prevMonthNum] = prevMonth.split('-').map(Number);
    const prevLastDay = new Date(prevYear, prevMonthNum, 0).getDate();
    const prevStartDate = `${prevMonth}-01`;
    const prevEndDate = `${prevMonth}-${String(prevLastDay).padStart(2, '0')}`;
    // 一次查询所有成员上月的记录数（用于环比）
    const prevMonthRecords = await this.recordEntity.count({
      where: {
        userId: In(memberUserIds),
        recordDate: Between(prevStartDate, prevEndDate),
      },
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

  // ============================================================
  // 今日状态 / 贡献榜
  // ============================================================

  /**
   * 家庭今日状态
   * - 无家庭返回 { hasFamily: false }
   * - 含成员列表（带头像昵称）、今日已记录人数、家庭总人数、家庭连续记录天数
   * - 连续天数：从今日往前数，最近 30 天内连续有记录的天数
   */
  async getTodayStatus(userId: number): Promise<any> {
    const family = await this.getMyFamily(userId);
    if (!family) {
      return { hasFamily: false };
    }
    const familyId = family.id;
    // 成员列表（已含头像昵称）
    const members = await this.listMembers(userId, familyId);
    // 今日有记录的 userId 去重集合
    const today = todayStr();
    const todayRecords = await this.recordEntity.find({
      where: { familyId, recordDate: today },
      select: ['userId'],
    });
    const todayRecordedUserIds = new Set<number>();
    for (const r of todayRecords) {
      if (r.userId != null) {
        todayRecordedUserIds.add(r.userId);
      }
    }
    // 家庭连续记录天数：查最近 30 天 distinct recordDate，从今日开始连续计数
    const startDate = daysAgoStr(29); // 含今日共 30 天
    const recentRecords = await this.recordEntity
      .createQueryBuilder('r')
      .select('DISTINCT r.recordDate', 'recordDate')
      .where('r.familyId = :familyId', { familyId })
      .andWhere('r.recordDate >= :start', { start: startDate })
      .getRawMany();
    const recentDates = new Set(recentRecords.map(r => r.recordDate));
    let familyStreakDays = 0;
    for (let i = 0; i < 30; i++) {
      const dateStr = daysAgoStr(i);
      if (recentDates.has(dateStr)) {
        familyStreakDays++;
      } else {
        break;
      }
    }
    return {
      hasFamily: true,
      familyId,
      familyName: family.name,
      members: members.map(m => ({
        userId: m.userId,
        nickName: m.nickName,
        avatarUrl: m.avatarUrl,
        role: m.role,
      })),
      todayRecordedCount: todayRecordedUserIds.size,
      totalMemberCount: members.length,
      familyStreakDays,
    };
  }

  /**
   * 家庭贡献榜
   * - 无家庭返回 { hasFamily: false }
   * - 三个维度：做饭榜（按 cookId）、评价榜（按评论 userId）、新菜榜（首次尝试者）
   * - 各维度取 Top 3，无数据返回空数组
   * - 四个聚合查询置于同一事务，遵循项目硬约束（事务保证一致性）
   */
  async getContribution(userId: number): Promise<any> {
    const family = await this.getMyFamily(userId);
    if (!family) {
      return { hasFamily: false };
    }
    const familyId = family.id;
    // getMyFamily 已隐含成员校验，显式调用以遵循硬约束
    await this.assertFamilyMembership(userId, familyId);
    // 查询该家庭全部成员 userIds
    const members = await this.familyMemberEntity.find({
      where: { familyId },
    });
    const memberUserIds = members.map(m => m.userId);
    if (memberUserIds.length === 0) {
      return {
        hasFamily: true,
        cookRank: [],
        commentRank: [],
        newDishRank: [],
      };
    }
    // 四个只读聚合查询置于同一事务，保证数据快照一致（遵循项目硬约束）
    const { cookStats, commentStats, allRecords, users, dishFirstUserId } = await this.getOrmManager().transaction(
      async tx => {
        // 做饭榜：按 cookId 分组 count（cookId 非空），取 Top 3
        // cookId 字段由另一处迁移添加，查询失败时降级为空数组
        let cookStatsTx: any[] = [];
        try {
          cookStatsTx = await tx
            .createQueryBuilder(RecordEntity, 'r')
            .select('r.cookId', 'cookId')
            .addSelect('COUNT(*)', 'count')
            .where('r.familyId = :familyId', { familyId })
            .andWhere('r.cookId IS NOT NULL')
            .groupBy('r.cookId')
            .orderBy('count', 'DESC')
            .limit(3)
            .getRawMany();
        } catch (e) {
          // cookId 字段可能尚未迁移，降级为空数组
          cookStatsTx = [];
        }
        // 评价榜：查 RecordCommentEntity，按 userId 分组 count
        // 限定 userId 在家庭成员内 + 评论所属记录在本家庭内（双隔离）
        const commentStatsTx = await tx
          .createQueryBuilder(RecordCommentEntity, 'c')
          .select('c.userId', 'userId')
          .addSelect('COUNT(*)', 'count')
          .where('c.userId IN (:...memberUserIds)', { memberUserIds })
          .andWhere(
            'c.recordId IN (SELECT r.id FROM weiji_record r WHERE r.familyId = :familyId)',
            { familyId }
          )
          .groupBy('c.userId')
          .orderBy('count', 'DESC')
          .limit(3)
          .getRawMany();
        // 新菜榜：每个 dishName 取最早 createTime 的记录的 userId 作为"尝试者"
        // 只取新菜榜计算所需列，避免全量加载所有字段到内存
        const allRecordsTx = await tx.find(RecordEntity, {
          where: { familyId },
          select: ['dishName', 'userId', 'createTime'],
          order: { createTime: 'ASC' },
        });
        // 收集所有需要查询头像昵称的 userIds（成员 + 三个榜单出现的 id）
        const dishFirstUserIdTx = new Map<string, number>();
        for (const r of allRecordsTx) {
          if (!dishFirstUserIdTx.has(r.dishName) && r.userId != null) {
            dishFirstUserIdTx.set(r.dishName, r.userId);
          }
        }
        const allUserIdsTx = new Set<number>(memberUserIds);
        cookStatsTx.forEach(s => {
          const id = Number(s.cookId);
          if (!isNaN(id)) allUserIdsTx.add(id);
        });
        commentStatsTx.forEach(s => {
          const id = Number(s.userId);
          if (!isNaN(id)) allUserIdsTx.add(id);
        });
        dishFirstUserIdTx.forEach(uid => allUserIdsTx.add(uid));
        const usersTx =
          allUserIdsTx.size > 0
            ? await tx.find(AppUserEntity, {
                where: { id: In(Array.from(allUserIdsTx)) },
              })
            : [];
        return {
          cookStats: cookStatsTx,
          commentStats: commentStatsTx,
          allRecords: allRecordsTx,
          users: usersTx,
          dishFirstUserId: dishFirstUserIdTx,
        } as any;
      }
    );
    // 事务外基于快照计算榜单（纯内存计算，无 DB 访问）
    // dishFirstUserId 复用事务内已计算的结果（同时用于补全 users 查询范围），避免重复遍历
    const newDishCount = new Map<number, number>();
    for (const uid of dishFirstUserId.values()) {
      newDishCount.set(uid, (newDishCount.get(uid) || 0) + 1);
    }
    const userMap: Map<number, any> = new Map(users.map((u: any) => [u.id, u]));
    const cookRank = cookStats
      .map((s: any) => {
        const cookId = Number(s.cookId);
        const user = userMap.get(cookId);
        return {
          userId: cookId,
          nickName: user?.nickName ?? '',
          avatarUrl: user?.avatarUrl ?? '',
          count: Number(s.count),
        };
      })
      .filter((item: any) => userMap.has(item.userId));
    const commentRank = commentStats.map((s: any) => {
      const uId = Number(s.userId);
      const user = userMap.get(uId);
      return {
        userId: uId,
        nickName: user?.nickName ?? '',
        avatarUrl: user?.avatarUrl ?? '',
        count: Number(s.count),
      };
    });
    const newDishRank = Array.from(newDishCount.entries())
      .map(([uid, count]) => {
        const user = userMap.get(uid);
        return {
          userId: uid,
          nickName: user?.nickName ?? '',
          avatarUrl: user?.avatarUrl ?? '',
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    return {
      hasFamily: true,
      cookRank,
      commentRank,
      newDishRank,
    };
  }

  // ============================================================
  // 今日动态 / 家庭等级
  // ============================================================

  /**
   * 家庭今日动态 feed
   * - 无家庭返回 { hasFamily: false }
   * - 聚合今日三类事件：记录上传 / 点赞 / 盲猜完成
   * - 按 createdAt 倒序合并，最多 20 条
   * - 所有只读查询置于同一事务，遵循项目硬约束
   */
  async getTodayFeed(userId: number): Promise<any> {
    const family = await this.getMyFamily(userId);
    if (!family) {
      return { hasFamily: false };
    }
    const familyId = family.id;
    // getMyFamily 已隐含成员校验，显式调用以遵循硬约束
    await this.assertFamilyMembership(userId, familyId);
    const today = todayStr();
    const todayPrefix = `${today}%`;
    // 三类只读查询置于同一事务，保证数据快照一致（遵循项目硬约束）
    const { records, likes, challenges } = await this.getOrmManager().transaction(
      async tx => {
        // 1. 记录上传：familyId + recordDate 今日（recordDate 为 date 类型且带索引，走索引）
        const recordsTx = await tx
          .createQueryBuilder(RecordEntity, 'r')
          .where('r.familyId = :familyId', { familyId })
          .andWhere('r.recordDate = :today', { today })
          .getMany();
        // 2. 点赞：RecordLikeEntity 无 familyId，需关联 record 过滤本家庭 + 取 dishName
        const likesTx = await tx
          .createQueryBuilder(RecordLikeEntity, 'l')
          .leftJoin(RecordEntity, 'r', 'r.id = l.recordId')
          .select('l.userId', 'userId')
          .addSelect('l.createTime', 'createTime')
          .addSelect('r.dishName', 'dishName')
          .where('l.createTime LIKE :today', { today: todayPrefix })
          .andWhere('r.familyId = :familyId', { familyId })
          .getRawMany();
        // 3. 盲猜完成：BlindGuessRoundEntity familyId + createTime 今日
        const challengesTx = await tx
          .createQueryBuilder(BlindGuessRoundEntity, 'b')
          .where('b.familyId = :familyId', { familyId })
          .andWhere('b.createTime LIKE :today', { today: todayPrefix })
          .getMany();
        return { records: recordsTx, likes: likesTx, challenges: challengesTx };
      }
    );
    // 收集所有 actor userIds，关联 AppUserEntity 补全昵称/头像
    const actorUserIds = new Set<number>();
    for (const r of records) {
      if (r.userId != null) actorUserIds.add(r.userId);
    }
    for (const l of likes) {
      const uid = Number(l.userId);
      if (!isNaN(uid)) actorUserIds.add(uid);
    }
    for (const c of challenges) {
      if (c.creatorId != null) actorUserIds.add(c.creatorId);
    }
    const users =
      actorUserIds.size > 0
        ? await this.appUserEntity.find({
            where: { id: In(Array.from(actorUserIds)) },
          })
        : [];
    const userMap = new Map(users.map(u => [u.id, u]));
    // 构建事件流
    const feed: any[] = [];
    for (const r of records) {
      const user = r.userId != null ? userMap.get(r.userId) : undefined;
      feed.push({
        eventType: 'record',
        actorUserId: r.userId,
        actorNickName: user?.nickName ?? '',
        actorAvatar: user?.avatarUrl ?? '',
        targetName: r.dishName,
        createdAt: r.createTime,
        summary: `上传了 ${r.dishName}`,
      });
    }
    for (const l of likes) {
      const uid = Number(l.userId);
      const user = userMap.get(uid);
      feed.push({
        eventType: 'like',
        actorUserId: uid,
        actorNickName: user?.nickName ?? '',
        actorAvatar: user?.avatarUrl ?? '',
        targetName: l.dishName,
        createdAt: l.createTime,
        summary: `点赞了 ${l.dishName}`,
      });
    }
    for (const c of challenges) {
      const user = userMap.get(c.creatorId);
      feed.push({
        eventType: 'challenge',
        actorUserId: c.creatorId,
        actorNickName: user?.nickName ?? '',
        actorAvatar: user?.avatarUrl ?? '',
        targetName: '盲猜',
        createdAt: c.createTime,
        summary: '完成了盲猜挑战',
      });
    }
    // 按 createdAt 倒序，最多 20 条
    feed.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
    return {
      hasFamily: true,
      feed: feed.slice(0, 20),
    };
  }

  /**
   * 家庭等级与积分
   * - 无家庭返回 { hasFamily: false }
   * - exp = 记录数*10 + (点赞数+评论数+盲猜数)*5
   * - level = floor(exp/100)+1，称号按 level 区间
   * - 所有只读查询置于同一事务，遵循项目硬约束
   */
  async getFamilyLevel(userId: number): Promise<any> {
    const family = await this.getMyFamily(userId);
    if (!family) {
      return { hasFamily: false };
    }
    const familyId = family.id;
    // getMyFamily 已隐含成员校验，显式调用以遵循硬约束
    await this.assertFamilyMembership(userId, familyId);
    // 查询家庭成员 userIds（用于评论数过滤）
    const members = await this.familyMemberEntity.find({
      where: { familyId },
    });
    const memberUserIds = members.map(m => m.userId);
    // 四个只读聚合查询置于同一事务，保证数据快照一致（遵循项目硬约束）
    const { recordCount, likeCount, commentCount, challengeCount } = await this.getOrmManager().transaction(
      async tx => {
        // 记录数
        const recordCountTx = await tx.count(RecordEntity, {
          where: { familyId },
        });
        // 点赞数：RecordLikeEntity 无 familyId，按家庭记录子查询过滤
        const likeCountTx = await tx
          .createQueryBuilder(RecordLikeEntity, 'l')
          .where(
            'l.recordId IN (SELECT r.id FROM weiji_record r WHERE r.familyId = :familyId)',
            { familyId }
          )
          .getCount();
        // 评论数：限定 userId 在家庭成员内 + 评论所属记录在本家庭内（双隔离）
        // RecordCommentEntity 无 familyId，必须经 record 子查询过滤，否则会跨家庭重复计数
        const commentCountTx =
          memberUserIds.length > 0
            ? await tx
                .createQueryBuilder(RecordCommentEntity, 'c')
                .where('c.userId IN (:...memberUserIds)', { memberUserIds })
                .andWhere(
                  'c.recordId IN (SELECT r.id FROM weiji_record r WHERE r.familyId = :familyId)',
                  { familyId }
                )
                .getCount()
            : 0;
        // 盲猜参与数
        const challengeCountTx = await tx.count(BlindGuessRoundEntity, {
          where: { familyId },
        });
        return {
          recordCount: recordCountTx,
          likeCount: likeCountTx,
          commentCount: commentCountTx,
          challengeCount: challengeCountTx,
        };
      }
    );
    // 计算等级与称号
    const exp = recordCount * 10 + (likeCount + commentCount + challengeCount) * 5;
    const level = Math.floor(exp / 100) + 1;
    let currentTitle: string;
    if (level >= 20) {
      currentTitle = '传奇家庭';
    } else if (level >= 10) {
      currentTitle = '达人家庭';
    } else if (level >= 5) {
      currentTitle = '美食家庭';
    } else {
      currentTitle = '新手家庭';
    }
    const nextLevelExp = level * 100 + 100;
    const progress = (exp % 100) / 100;
    return {
      hasFamily: true,
      familyName: family.name,
      level,
      exp,
      currentTitle,
      nextLevelExp,
      progress,
      interactions: likeCount + commentCount + challengeCount,
    };
  }
}
