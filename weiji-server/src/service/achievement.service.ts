// 成就自动解锁服务
// 封装成就自动评估与解锁逻辑，供各业务控制器在用户完成对应行为后调用
// 采用静态方法实现（无需 DI 容器），与项目内 CheckinService / AuthService 风格保持一致
// 所有方法返回本次新解锁的 UserAchievement 列表（可能为空），并保证幂等：重复调用不会产生重复记录

import { achievements, user_achievements, records, families } from '../store/db';
import type { AchievementDef, UserAchievement, AchievementType } from '../store/types';
import { uuid } from '../store/helpers';

export class AchievementService {
  // 按成就类型过滤出相关成就定义
  private static getByType(type: AchievementType): AchievementDef[] {
    return achievements.filter((a) => a.type === type);
  }

  // 通用解锁尝试：检查幂等性后插入 user_achievements 记录
  // 已存在则返回 null，否则创建并返回新记录
  private static tryUnlock(userId: string, achievement: AchievementDef): UserAchievement | null {
    const exists = user_achievements.some(
      (ua) => ua.userId === userId && ua.achievementId === achievement.id
    );
    if (exists) return null;

    const newRecord: UserAchievement = {
      id: uuid(),
      userId,
      achievementId: achievement.id,
      earnedAt: new Date().toISOString(),
    };
    user_achievements.push(newRecord);
    return newRecord;
  }

  // 评估并解锁 record / variety 类成就
  // 基于 records 数组统计：记录总数、不同 cookingMethod（为空时用 dishName 兜底）去重数
  static checkAndUnlockRecordAchievements(userId: string): UserAchievement[] {
    const userRecords = records.filter((r) => r.userId === userId && !r.isDeleted);
    const recordCount = userRecords.length;

    // 菜系去重计数：优先用 cookingMethod，为空时用 dishName 兜底
    const varietySet = new Set<string>();
    for (const r of userRecords) {
      const key = (r.cookingMethod && r.cookingMethod.trim()) || r.dishName;
      varietySet.add(key);
    }
    const cuisineCount = varietySet.size;

    const unlocked: UserAchievement[] = [];

    for (const ach of achievements) {
      if (ach.type !== 'record' && ach.type !== 'variety') continue;

      let matched = false;
      const cond = ach.condition;
      if (typeof cond.recordCount === 'number' && recordCount >= cond.recordCount) {
        matched = true;
      }
      if (typeof cond.cuisineCount === 'number' && cuisineCount >= cond.cuisineCount) {
        matched = true;
      }

      if (matched) {
        const result = AchievementService.tryUnlock(userId, ach);
        if (result) unlocked.push(result);
      }
    }
    return unlocked;
  }

  // 评估并解锁 streak 类成就
  // 由调用方传入当前连续打卡天数 streak，满足条件即解锁
  static checkAndUnlockStreakAchievements(userId: string, streak: number): UserAchievement[] {
    const unlocked: UserAchievement[] = [];

    for (const ach of AchievementService.getByType('streak')) {
      const cond = ach.condition;
      if (typeof cond.streakDays === 'number' && streak >= cond.streakDays) {
        const result = AchievementService.tryUnlock(userId, ach);
        if (result) unlocked.push(result);
      }
    }
    return unlocked;
  }

  // 评估并解锁 family 类成就
  // 检查 families 数组中是否存在 ownerId === userId 且 !isDeleted 的家庭组
  static checkAndUnlockFamilyAchievements(userId: string): UserAchievement[] {
    const familyCreated = families.some((f) => f.ownerId === userId && !f.isDeleted);

    const unlocked: UserAchievement[] = [];

    for (const ach of AchievementService.getByType('family')) {
      const cond = ach.condition;
      if (cond.familyCreated === true && familyCreated) {
        const result = AchievementService.tryUnlock(userId, ach);
        if (result) unlocked.push(result);
      }
    }
    return unlocked;
  }

  // 评估并解锁 gameplay 类成就
  // 仅在用户赢得家庭盲猜厨神称号后调用，blindguess_chef 直接解锁
  static checkAndUnlockGameplayAchievements(userId: string): UserAchievement[] {
    const unlocked: UserAchievement[] = [];

    for (const ach of AchievementService.getByType('gameplay')) {
      const cond = ach.condition;
      if (cond.blindguessChef === true) {
        const result = AchievementService.tryUnlock(userId, ach);
        if (result) unlocked.push(result);
      }
    }
    return unlocked;
  }
}
