import { Provide, Body, Inject, Get, Patch } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { AppAuthService } from '../../service/auth';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { RecordEntity } from '../../../record/entity/record';
import { FamilyRecipeEntity } from '../../../family/entity/recipe';
import { CheckinEntity } from '../../../checkin/entity/checkin';
import { UserAchievementEntity } from '../../../achievement/entity/user_achievement';

/**
 * C端用户资料
 */
@Provide()
@CoolController({ api: [], prefix: '/app/user', description: 'C端用户资料' })
export class AppUserProfileController extends BaseController {
  @Inject()
  appAuthService: AppAuthService;

  @Inject()
  ctx: Context;

  @InjectEntityModel(RecordEntity)
  recordEntity: Repository<RecordEntity>;

  @InjectEntityModel(FamilyRecipeEntity)
  familyRecipeEntity: Repository<FamilyRecipeEntity>;

  @InjectEntityModel(CheckinEntity)
  checkinEntity: Repository<CheckinEntity>;

  @InjectEntityModel(UserAchievementEntity)
  userAchievementEntity: Repository<UserAchievementEntity>;

  /**
   * 当前用户资料
   * 返回基本资料 + 真实统计数据
   */
  @Get('/profile', { summary: '当前用户资料' })
  async profile() {
    const userId = this.ctx.user?.userId;
    const user = await this.appAuthService.getProfile(userId);

    const [recordCount, recipeCount, streak, achievementCount] =
      await Promise.all([
        this.countRecord(userId),
        this.countRecipe(userId),
        this.getStreak(userId),
        this.countAchievement(userId),
      ]);

    return this.ok({
      ...user,
      recordCount,
      recipeCount,
      streak,
      achievementCount,
    });
  }

  /**
   * 查询用户美食记录数
   */
  private async countRecord(userId: number): Promise<number> {
    try {
      return await this.recordEntity.count({ where: { userId } });
    } catch {
      return 0;
    }
  }

  /**
   * 查询用户菜谱数（authorId 对应 userId）
   */
  private async countRecipe(userId: number): Promise<number> {
    try {
      return await this.familyRecipeEntity.count({ where: { authorId: userId } });
    } catch {
      return 0;
    }
  }

  /**
   * 查询用户连续打卡天数（最新打卡记录的 streak 字段）
   */
  private async getStreak(userId: number): Promise<number> {
    try {
      const latest = await this.checkinEntity.findOne({
        where: { userId },
        order: { checkDate: 'DESC' } as any,
      });
      return latest?.streak ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * 查询用户成就数
   */
  private async countAchievement(userId: number): Promise<number> {
    try {
      return await this.userAchievementEntity.count({ where: { userId } });
    } catch {
      return 0;
    }
  }

  /**
   * 更新资料
   * @param body 昵称、头像
   */
  @Patch('/profile', { summary: '更新资料' })
  async updateProfile(@Body() body: { nickName?: string; avatarUrl?: string }) {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.appAuthService.updateProfile(userId, body));
  }
}
