// 打卡控制器
// 处理 /api/checkin/status、POST /api/checkin
// 与前端 weiji-admin-web/src/api/client.ts 契约一致：
//   - getCheckinStatus() → GET  /api/checkin/status
//   - doCheckin()        → POST /api/checkin

import type { Context } from 'koa';
import { Controller, Get, Post } from '../common/decorators';
import { ok, fail, type ApiResponse } from '../common/response';
import { check_ins } from '../store/db';
import type { CheckIn } from '../store/types';
import { uuid, checkAndUnlockAchievements } from '../store/helpers';
import { CheckinService } from '../service/checkin.service';

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
    const todayCheckIn = await CheckinService.findCheckin(userId, today);
    const todayChecked = !!todayCheckIn;

    // 连续打卡天数（service 内部会处理今日未打卡时从昨天开始计算）
    const streak = await CheckinService.calculateStreak(userId);
    const lastCheckDate = await CheckinService.lastCheckDate(userId);

    return ok({ todayChecked, streak, lastCheckDate });
  }

  // POST /api/checkin
  // 首次打卡增加天数；重复打卡返回提示（不重复增加天数）
  // 注意：路径写成 '/'，最终拼接为 /api/checkin/，由 koa-router 非严格模式匹配 /api/checkin
  @Post('')
  async checkin(ctx: Context): Promise<ApiResponse> {
    const userId = ctx.state.user.userId;

    const today = CheckinService.todayStr();
    const existing = await CheckinService.findCheckin(userId, today);

    if (existing) {
      // 今日已打卡，不重复增加天数
      const streak = await CheckinService.calculateStreak(userId);
      return ok({
        todayChecked: true,
        streak,
        alreadyChecked: true,
        message: '今日已打卡',
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
    await check_ins.insert(newCheckIn);

    // 重新计算最新连续天数
    const streak = await CheckinService.calculateStreak(userId);

    // 自动检查并解锁成就
    const newlyUnlocked = await checkAndUnlockAchievements(userId);

    return ok({
      todayChecked: true,
      streak,
      message: '打卡成功',
      newAchievements: newlyUnlocked,
    });
  }

  // POST /api/checkin/replenish
  // 补签昨日记录（每周限1次）
  @Post('/replenish')
  async replenish(ctx: Context): Promise<ApiResponse> {
    const userId = ctx.state.user.userId;

    const today = CheckinService.todayStr();
    const yesterday = CheckinService.daysAgo(1);

    // 检查昨天是否已打卡（已打卡则无需补签）
    const yesterdayCheckin = await CheckinService.findCheckin(userId, yesterday);
    if (yesterdayCheckin) {
      return fail('昨日已有打卡记录，无需补签', 400);
    }

    // 检查今日是否已打卡
    const todayCheckin = await CheckinService.findCheckin(userId, today);
    if (!todayCheckin) {
      return fail('请先完成今日打卡，再补签昨日', 400);
    }

    // 检查本周是否已补签过
    // 获取本周一日期
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 周日=0转为7
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    const mondayStr = monday.toISOString().split('T')[0];

    // 检查本周是否有补签记录
    const weekReplenished = (await check_ins.count(
      (c) => c.userId === userId && c.isReplenish && c.checkDate >= mondayStr
    )) > 0;
    if (weekReplenished) {
      return fail('本周补签次数已用完', 400);
    }

    // 创建补签记录
    const newCheckIn: CheckIn = {
      id: uuid(),
      userId,
      checkDate: yesterday,
      recordCount: 0,
      isReplenish: true,
      createdAt: new Date().toISOString(),
    };
    await check_ins.insert(newCheckIn);

    // 重新计算连续天数
    const streak = await CheckinService.calculateStreak(userId);

    // 检查成就解锁
    const newlyUnlocked = await checkAndUnlockAchievements(userId);

    return ok({
      streak,
      message: '补签成功',
      newAchievements: newlyUnlocked,
    });
  }
}
