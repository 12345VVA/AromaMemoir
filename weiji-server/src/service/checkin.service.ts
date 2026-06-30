// 打卡服务
// 封装连续打卡天数计算逻辑，供 checkin 控制器和 user 控制器共享
// 采用静态方法实现（无需 DI 容器），与项目内 AuthService / AiProxyService 风格保持一致

import { check_ins } from '../store/db';
import { CheckIn } from '../store/types';

export class CheckinService {
  // 返回今天的 YYYY-MM-DD 字符串
  // 使用本地时区切片，避免 UTC 偏移导致日期错位
  static todayStr(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 返回 N 天前的 YYYY-MM-DD 字符串
  // n=0 即今天，n=1 即昨天，依此类推
  static daysAgo(n: number): string {
    const now = new Date();
    now.setDate(now.getDate() - n);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 查找指定用户在指定日期的打卡记录
  // 找到返回 CheckIn，找不到返回 undefined
  static async findCheckin(userId: string, date: string): Promise<CheckIn | undefined> {
    return (await check_ins.findAll((c) => c.userId === userId && c.checkDate === date))[0];
  }

  // 计算连续打卡天数
  // 算法：先查今日，今日已打卡则从今日往前推；今日未打卡则从昨天往前推
  // 遇到有打卡记录的就 +1，遇到断档就停（不补算）
  // 这样可以避免今日尚未打卡时连续天数被强制清零
  static async calculateStreak(userId: string): Promise<number> {
    const today = CheckinService.todayStr();
    const todayChecked = !!(await CheckinService.findCheckin(userId, today));
    // 今日已打卡 → 从今日（offset=0）开始；今日未打卡 → 从昨天（offset=1）开始
    const startOffset = todayChecked ? 0 : 1;

    let streak = 0;
    for (let i = startOffset; ; i++) {
      const date = CheckinService.daysAgo(i);
      const found = await CheckinService.findCheckin(userId, date);
      if (found) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  // 查询用户最近一次打卡日期
  // 从今日开始往前扫描，遇到第一个有打卡记录的日期即返回；从未打卡返回 null
  static async lastCheckDate(userId: string): Promise<string | null> {
    for (let i = 0; ; i++) {
      // 最多回溯 365 天，避免极端情况下死循环
      if (i > 365) break;
      const date = CheckinService.daysAgo(i);
      const found = await CheckinService.findCheckin(userId, date);
      if (found) {
        return date;
      }
    }
    return null;
  }
}
