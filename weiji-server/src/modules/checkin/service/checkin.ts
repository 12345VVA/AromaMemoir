import { Inject, Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { CheckinEntity } from '../entity/checkin';
import { AchievementService } from '../../achievement/service/achievement';
import { ChallengeService } from '../../challenge/service/challenge';
import { todayStr, daysAgoStr, mondayStr } from '../../../comm/date';

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

  @Inject()
  challengeService: ChallengeService;

  /**
   * 今日打卡状态
   * @param userId 用户ID
   */
  async status(userId: number) {
    const today = todayStr();
    const yesterday = daysAgoStr(1);
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
   * 查询+保存置于同一事务内，并发下唯一约束冲突转为友好提示
   * @param userId 用户ID
   */
  async checkin(userId: number) {
    const today = todayStr();
    const yesterday = daysAgoStr(1);

    let outcome: { alreadyChecked: boolean; streak: number };

    try {
      outcome = await this.getOrmManager().transaction(async tx => {
        const existing = await tx.findOneBy(CheckinEntity, {
          userId,
          checkDate: today,
        });
        if (existing) {
          // 今日已打卡，不重复增加天数
          return { alreadyChecked: true, streak: existing.streak };
        }

        // 查昨日记录推算连续天数
        const yesterdayRec = await tx.findOneBy(CheckinEntity, {
          userId,
          checkDate: yesterday,
        });
        const streak = yesterdayRec ? yesterdayRec.streak + 1 : 1;

        await tx.save(CheckinEntity, {
          userId,
          checkDate: today,
          streak,
          isReplenished: false,
        });

        return { alreadyChecked: false, streak };
      });
    } catch (err: any) {
      // 并发情况下另一事务先提交了今日记录，唯一约束冲突 → 友好提示
      if (err?.code === 'ER_DUP_ENTRY') {
        throw new CoolCommException('今日已打卡');
      }
      throw err;
    }

    if (outcome.alreadyChecked) {
      return {
        todayChecked: true,
        streak: outcome.streak,
        newAchievements: [],
        alreadyChecked: true,
        message: '今日已打卡',
      };
    }

    const streak = outcome.streak;

    // 触发 streak 类成就解锁
    const newAchievements = await this.achievementService.checkAndUnlock(
      userId,
      { type: 'checkin_streak', value: streak }
    );

    // 触发挑战进度更新（失败不阻塞打卡）
    try {
      await this.challengeService.checkAndComplete(
        userId,
        'checkin_streak',
        streak
      );
    } catch (e) {
      // 挑战更新失败不阻塞打卡
    }

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
   * 查询+保存置于同一事务内，并发下唯一约束冲突转为友好提示
   * @param userId 用户ID
   */
  async replenish(userId: number) {
    const today = todayStr();
    const yesterday = daysAgoStr(1);
    const dayBeforeYesterday = daysAgoStr(2);
    const monday = mondayStr();

    let streak: number;

    try {
      streak = await this.getOrmManager().transaction(async tx => {
        // 必须先完成今日打卡
        const todayRec = await tx.findOneBy(CheckinEntity, {
          userId,
          checkDate: today,
        });
        if (!todayRec) {
          throw new CoolCommException('请先完成今日打卡');
        }

        // 昨日已有记录则无需补签
        const yesterdayRec = await tx.findOneBy(CheckinEntity, {
          userId,
          checkDate: yesterday,
        });
        if (yesterdayRec) {
          throw new CoolCommException('昨日已有打卡记录，无需补签');
        }

        // 本自然周（本周一 00:00 起）补签次数校验，每周限 1 次
        const weekReplenishedCount = await tx
          .getRepository(CheckinEntity)
          .createQueryBuilder('c')
          .where('c.userId = :userId', { userId })
          .andWhere('c.isReplenished = :isReplenished', { isReplenished: true })
          .andWhere('c.checkDate >= :monday', { monday })
          .getCount();
        if (weekReplenishedCount >= 1) {
          throw new CoolCommException('每周仅可补签 1 次');
        }

        // streak 按前日记录递推
        const dayBeforeRec = await tx.findOneBy(CheckinEntity, {
          userId,
          checkDate: dayBeforeYesterday,
        });
        const newStreak = dayBeforeRec ? dayBeforeRec.streak + 1 : 1;

        await tx.save(CheckinEntity, {
          userId,
          checkDate: yesterday,
          streak: newStreak,
          isReplenished: true,
        });

        return newStreak;
      });
    } catch (err: any) {
      // 并发情况下另一事务先插入了昨日记录，唯一约束冲突 → 友好提示
      if (err?.code === 'ER_DUP_ENTRY') {
        throw new CoolCommException('昨日已有打卡记录，无需补签');
      }
      throw err;
    }

    // 触发 streak 类成就解锁
    const newAchievements = await this.achievementService.checkAndUnlock(
      userId,
      { type: 'checkin_streak', value: streak }
    );

    return { streak, newAchievements, message: '补签成功' };
  }
}
