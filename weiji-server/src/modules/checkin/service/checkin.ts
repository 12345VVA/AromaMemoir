import { Inject, Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { CheckinEntity } from '../entity/checkin';
import { AchievementService } from '../../achievement/service/achievement';

/**
 * 打卡服务
 * 提供今日状态、打卡、补签能力，打卡/补签成功后触发成就解锁
 */
@Provide()
export class CheckinService extends BaseService {
  @InjectEntityModel(CheckinEntity)
  checkinEntity: Repository<CheckinEntity>;

  @Inject()
  achievementService: AchievementService;

  /**
   * 今日打卡状态
   * @param userId 用户ID
   */
  async status(userId: number) {
    const today = this.todayStr();
    const yesterday = this.daysAgo(1);
    const todayRec = await this.checkinEntity.findOneBy({
      userId,
      checkDate: today,
    });
    const todayChecked = !!todayRec;
    // 今日已打卡取今日记录的 streak，否则取昨日记录的 streak（维持但今日未打）
    let streak = 0;
    if (todayRec) {
      streak = todayRec.streak;
    } else {
      const yesterdayRec = await this.checkinEntity.findOneBy({
        userId,
        checkDate: yesterday,
      });
      if (yesterdayRec) streak = yesterdayRec.streak;
    }
    // 最近一次打卡日期
    const latest = await this.checkinEntity.find({
      where: { userId },
      order: { checkDate: 'DESC' },
      take: 1,
    });
    const lastCheckDate = latest.length > 0 ? latest[0].checkDate : null;
    return { todayChecked, streak, lastCheckDate };
  }

  /**
   * 打卡
   * 首次打卡增加天数并触发成就解锁；重复打卡返回提示不重复增加
   * @param userId 用户ID
   */
  async checkin(userId: number) {
    const today = this.todayStr();
    const yesterday = this.daysAgo(1);

    const existing = await this.checkinEntity.findOneBy({
      userId,
      checkDate: today,
    });
    if (existing) {
      // 今日已打卡，不重复增加天数
      return {
        todayChecked: true,
        streak: existing.streak,
        newAchievements: [],
        alreadyChecked: true,
        message: '今日已打卡',
      };
    }

    // 查昨日记录推算连续天数
    const yesterdayRec = await this.checkinEntity.findOneBy({
      userId,
      checkDate: yesterday,
    });
    const streak = yesterdayRec ? yesterdayRec.streak + 1 : 1;

    await this.checkinEntity.save({
      userId,
      checkDate: today,
      streak,
      isReplenished: false,
    });

    // 触发 streak 类成就解锁
    const newAchievements = await this.achievementService.checkAndUnlock(
      userId,
      { type: 'checkin_streak', value: streak }
    );

    return {
      todayChecked: true,
      streak,
      newAchievements,
      message: '打卡成功',
    };
  }

  /**
   * 补签昨日（每周限 1 次）
   * 需先完成今日打卡；streak 按前日记录递推
   * @param userId 用户ID
   */
  async replenish(userId: number) {
    const today = this.todayStr();
    const yesterday = this.daysAgo(1);
    const dayBeforeYesterday = this.daysAgo(2);

    // 必须先完成今日打卡
    const todayRec = await this.checkinEntity.findOneBy({
      userId,
      checkDate: today,
    });
    if (!todayRec) {
      throw new CoolCommException('请先完成今日打卡');
    }

    // 昨日已有记录则无需补签
    const yesterdayRec = await this.checkinEntity.findOneBy({
      userId,
      checkDate: yesterday,
    });
    if (yesterdayRec) {
      throw new CoolCommException('昨日已有打卡记录，无需补签');
    }

    // 本周（最近 7 天）补签次数校验，每周限 1 次
    const sevenDaysAgo = this.daysAgo(7);
    const weekReplenishedCount = await this.checkinEntity
      .createQueryBuilder('c')
      .where('c.userId = :userId', { userId })
      .andWhere('c.isReplenished = :isReplenished', { isReplenished: true })
      .andWhere('c.checkDate >= :sevenDaysAgo', { sevenDaysAgo })
      .getCount();
    if (weekReplenishedCount >= 1) {
      throw new CoolCommException('每周仅可补签 1 次');
    }

    // streak 按前日记录递推
    const dayBeforeRec = await this.checkinEntity.findOneBy({
      userId,
      checkDate: dayBeforeYesterday,
    });
    const streak = dayBeforeRec ? dayBeforeRec.streak + 1 : 1;

    await this.checkinEntity.save({
      userId,
      checkDate: yesterday,
      streak,
      isReplenished: true,
    });

    // 触发 streak 类成就解锁
    const newAchievements = await this.achievementService.checkAndUnlock(
      userId,
      { type: 'checkin_streak', value: streak }
    );

    return { streak, newAchievements, message: '补签成功' };
  }

  /**
   * 今天的 YYYY-MM-DD 字符串（本地时区切片，避免 UTC 偏移导致日期错位）
   */
  private todayStr(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * N 天前的 YYYY-MM-DD 字符串（n=0 即今天，n=1 即昨天）
   */
  private daysAgo(n: number): string {
    const now = new Date();
    now.setDate(now.getDate() - n);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
