// 成就控制器
// 处理 /api/achievement/list、/api/achievement/level
// 与前端 weiji-admin-web/src/api/client.ts 契约一致：
//   - getAchievements()  → GET /api/achievement/list
//   - getLevel()         → GET /api/achievement/level

import type { Context } from 'koa';
import { Controller, Get } from '../common/decorators';
import { ok, type ApiResponse } from '../common/response';
import { achievements, user_achievements } from '../store/db';
import type { AchievementDef } from '../store/types';

// 徽章列表项：成就定义 + 是否已解锁 + 解锁时间
interface AchievementListItem extends AchievementDef {
  unlocked: boolean;
  earnedAt: string | null;
}

// 等级数据返回结构
interface LevelData {
  level: number;
  exp: number;
  nextLevelExp: number;
  progress: number; // 0-100
}

@Controller('/api/achievement')
export class AchievementController {
  // GET /api/achievement/list
  // 返回所有徽章列表，每项包含是否已解锁和解锁时间
  @Get('/list')
  async list(ctx: Context): Promise<ApiResponse<AchievementListItem[]>> {
    const userId = ctx.state.user.userId;

    // 查询当前用户已解锁的成就记录，构造 achievementId -> earnedAt 映射
    const unlockedMap = new Map<string, string>();
    for (const ua of await user_achievements.toArray()) {
      if (ua.userId === userId) {
        unlockedMap.set(ua.achievementId, ua.earnedAt);
      }
    }

    // 遍历成就定义，补充 unlocked / earnedAt 字段
    const allAchievements = await achievements.toArray();
    const list: AchievementListItem[] = allAchievements.map((ach) => {
      const earnedAt = unlockedMap.get(ach.id) || null;
      return {
        ...ach,
        unlocked: earnedAt !== null,
        earnedAt,
      };
    });

    return ok(list);
  }

  // GET /api/achievement/level
  // 返回当前用户的等级、经验值、下一级所需经验和进度百分比
  // 等级公式（简单线性）：level = Math.floor(exp / 100) + 1
  //   - 每级固定 100 经验
  //   - 当前等级起始经验 = (level - 1) * 100
  //   - 下一等级所需经验（累计）= level * 100
  //   - 进度百分比 = (exp - currentLevelStart) / 100 * 100
  @Get('/level')
  async level(ctx: Context): Promise<ApiResponse<LevelData>> {
    const userId = ctx.state.user.userId;

    // 计算用户已解锁成就的总经验值
    const unlockedIds = new Set<string>();
    for (const ua of await user_achievements.toArray()) {
      if (ua.userId === userId) {
        unlockedIds.add(ua.achievementId);
      }
    }
    let exp = 0;
    for (const ach of await achievements.toArray()) {
      if (unlockedIds.has(ach.id)) {
        exp += ach.expReward;
      }
    }

    // 等级与进度条计算
    const level = Math.floor(exp / 100) + 1;
    const currentLevelStart = (level - 1) * 100;
    const nextLevelExp = level * 100;
    // 当前等级区间内的经验占比，转为 0-100 百分比
    const progress =
      nextLevelExp > currentLevelStart
        ? Math.floor(((exp - currentLevelStart) / (nextLevelExp - currentLevelStart)) * 100)
        : 0;

    return ok({ level, exp, nextLevelExp, progress });
  }
}
