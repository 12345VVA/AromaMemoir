// 打卡控制器
// 处理 /api/checkin/status、POST /api/checkin
// 与前端 weiji-admin-web/src/api/client.ts 契约一致：
//   - getCheckinStatus() → GET  /api/checkin/status
//   - doCheckin()        → POST /api/checkin

import type { Context } from 'koa';
import { Controller, Get, Post } from '../common/decorators';
import { ok, type ApiResponse } from '../common/response';
import { check_ins } from '../store/db';
import type { CheckIn } from '../store/types';
import { insert, uuid } from '../store/helpers';
import { CheckinService } from '../service/checkin.service';
import { AchievementService } from '../service/achievement.service';

// 打卡状态返回结构
interface CheckinStatus {
  todayChecked: boolean;
  streak: number;
  lastCheckDate: string | null;
}

// 已打卡时的响应结构
interface AlreadyCheckedResult {
  todayChecked: boolean;
  streak: number;
  alreadyChecked: boolean;
  message: string;
}

// 打卡成功的响应结构
interface CheckinSuccessResult {
  todayChecked: boolean;
  streak: number;
  message: string;
}

@Controller('/api/checkin')
export class CheckinController {
  // GET /api/checkin/status
  // 返回今日是否打卡、连续打卡天数、最近一次打卡日期
  @Get('/status')
  async status(ctx: Context): Promise<ApiResponse<CheckinStatus>> {
    const userId = ctx.state.user.userId;

    const today = CheckinService.todayStr();
    const todayCheckIn = CheckinService.findCheckin(userId, today);
    const todayChecked = !!todayCheckIn;

    // 连续打卡天数（service 内部会处理今日未打卡时从昨天开始计算）
    const streak = CheckinService.calculateStreak(userId);
    const lastCheckDate = CheckinService.lastCheckDate(userId);

    return ok({ todayChecked, streak, lastCheckDate });
  }

  // POST /api/checkin
  // 首次打卡增加天数；重复打卡返回提示（不重复增加天数）
  // 注意：路径写成 '/'，最终拼接为 /api/checkin/，由 koa-router 非严格模式匹配 /api/checkin
  @Post('')
  async checkin(ctx: Context): Promise<ApiResponse> {
    const userId = ctx.state.user.userId;

    const today = CheckinService.todayStr();
    const existing = CheckinService.findCheckin(userId, today);

    if (existing) {
      // 今日已打卡，不重复增加天数
      const streak = CheckinService.calculateStreak(userId);
      // 重复打卡分支也触发 streak 类成就检查，保持一致性
      const newAchievements = AchievementService.checkAndUnlockStreakAchievements(userId, streak);
      return ok({
        todayChecked: true,
        streak,
        alreadyChecked: true,
        message: '今日已打卡',
        newAchievements,
      });
    }

    // 创建新打卡记录
    const newCheckIn: CheckIn = {
      id: uuid(),
      userId,
      checkDate: today,
      recordCount: 0,
      isReplenish: false,
      createdAt: new Date().toISOString(),
    };
    insert(check_ins, newCheckIn);

    // 重新计算最新连续天数
    const streak = CheckinService.calculateStreak(userId);

    // 打卡成功后触发 streak 类成就自动解锁
    const newAchievements = AchievementService.checkAndUnlockStreakAchievements(userId, streak);

    return ok({
      todayChecked: true,
      streak,
      message: '打卡成功',
      newAchievements,
    });
  }
}
