import { Provide } from '@midwayjs/core';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { AchievementEntity } from '../entity/achievement';
import { UserAchievementEntity } from '../entity/user_achievement';

/**
 * 成就服务
 * 提供徽章列表、等级经验、自动解锁能力，供 checkin/record 等业务模块调用
 */
@Provide()
export class AchievementService extends BaseService {
  @InjectEntityModel(AchievementEntity)
  achievementEntity: Repository<AchievementEntity>;

  @InjectEntityModel(UserAchievementEntity)
  userAchievementEntity: Repository<UserAchievementEntity>;

  /**
   * 徽章列表
   * 返回全部徽章定义，每项补充 unlocked（是否已解锁）与 earnedAt（解锁时间）
   * @param userId 用户ID
   */
  async list(userId: number) {
    const achievements = await this.achievementEntity.find();
    if (achievements.length === 0) return [];
    const earned = await this.userAchievementEntity.find({
      where: { userId },
    });
    const earnedMap = new Map<number, string>();
    for (const ua of earned) {
      earnedMap.set(ua.achievementId, ua.earnedAt);
    }
    return achievements.map(a => {
      const earnedAt = earnedMap.get(a.id) || null;
      return {
        ...a,
        unlocked: earnedAt !== null,
        earnedAt,
      };
    });
  }

  /**
   * 当前用户等级、经验、下一级所需经验、进度百分比
   * 公式：level = floor(exp / 100) + 1，每级固定 100 经验
   * 经验来源：用户已解锁成就的 exp 总和
   * @param userId 用户ID
   */
  async level(userId: number) {
    const exp = await this.getEarnedExp(userId);
    const level = Math.floor(exp / 100) + 1;
    const currentLevelStart = (level - 1) * 100;
    const nextLevelExp = level * 100;
    const progress =
      nextLevelExp > currentLevelStart
        ? Math.floor(
            ((exp - currentLevelStart) /
              (nextLevelExp - currentLevelStart)) *
              100
          )
        : 0;
    return { level, exp, nextLevelExp, progress };
  }

  /**
   * 聚合用户已解锁成就的 exp 总和
   * @param userId 用户ID
   */
  async getEarnedExp(userId: number): Promise<number> {
    const earned = await this.userAchievementEntity.find({
      where: { userId },
    });
    if (earned.length === 0) return 0;
    const ids = earned.map(e => e.achievementId);
    const achievements = await this.achievementEntity.find({
      where: { id: In(ids) },
    });
    return achievements.reduce((sum, a) => sum + (a.exp || 0), 0);
  }

  /**
   * 检查并解锁成就
   * 根据 condition.type 与 value 判断是否满足条件，满足且未解锁过则插入 user_achievement
   * 返回新解锁的成就列表（已解锁过的不会重复返回）
   * @param userId 用户ID
   * @param condition { type: 触发类型, value: 当前指标值 }
   */
  async checkAndUnlock(
    userId: number,
    condition: { type: string; value: any }
  ): Promise<any[]> {
    const { type, value } = condition;
    // 把对外 condition.type 映射到成就 type
    const achTypeMap: Record<string, string> = {
      checkin_streak: 'streak',
      record_count: 'record',
      cuisine_count: 'variety',
      family_created: 'family',
      recipe_count: 'recipe',
      gameplay_blindguess: 'gameplay',
    };
    const achType = achTypeMap[type];
    if (!achType) return [];

    const candidates = await this.achievementEntity.find({
      where: { type: achType, isActive: true },
    });
    if (candidates.length === 0) return [];

    // 已解锁集合，保证幂等
    const earned = await this.userAchievementEntity.find({
      where: { userId },
    });
    const earnedSet = new Set(earned.map(e => e.achievementId));

    const newAchievements: any[] = [];
    for (const ach of candidates) {
      if (earnedSet.has(ach.id)) continue;
      const cond = this.parseCondition(ach.condition);
      let matched = false;
      if (
        type === 'checkin_streak' &&
        typeof cond.streakDays === 'number' &&
        value >= cond.streakDays
      ) {
        matched = true;
      } else if (
        type === 'record_count' &&
        typeof cond.recordCount === 'number' &&
        value >= cond.recordCount
      ) {
        matched = true;
      } else if (
        type === 'cuisine_count' &&
        typeof cond.cuisineCount === 'number' &&
        value >= cond.cuisineCount
      ) {
        matched = true;
      } else if (
        type === 'recipe_count' &&
        typeof cond.recipeCount === 'number' &&
        value >= cond.recipeCount
      ) {
        matched = true;
      } else if (type === 'family_created' && cond.familyCreated === true) {
        matched = true;
      } else if (
        type === 'gameplay_blindguess' &&
        cond.blindguessChef === true
      ) {
        matched = true;
      }

      if (matched) {
        const earnedAt = new Date().toISOString();
        try {
          await this.userAchievementEntity.save({
            userId,
            achievementId: ach.id,
            earnedAt,
          });
          newAchievements.push({ ...ach, unlocked: true, earnedAt });
        } catch (err: any) {
          // 并发情况下另一请求已解锁该成就，唯一约束冲突 → 静默跳过（解锁是幂等操作）
          if (err?.code !== 'ER_DUP_ENTRY') {
            throw err;
          }
        }
      }
    }
    return newAchievements;
  }

  /**
   * 解析 condition 字段，兼容 json 列返回字符串或对象的情况
   */
  private parseCondition(condition: any): Record<string, any> {
    if (!condition) return {};
    if (typeof condition === 'string') {
      try {
        return JSON.parse(condition);
      } catch (e) {
        return {};
      }
    }
    return condition;
  }
}
