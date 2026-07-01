import { Provide, Inject, Get } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { AchievementService } from '../../service/achievement';

/**
 * C端成就
 */
@Provide()
@CoolController({ api: [], prefix: '/app/achievement', description: 'C端成就' })
export class AppAchievementController extends BaseController {
  @Inject()
  achievementService: AchievementService;

  @Inject()
  ctx: Context;

  /**
   * 徽章列表
   */
  @Get('/list', { summary: '徽章列表' })
  async list() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.achievementService.list(userId));
  }

  /**
   * 当前等级
   */
  @Get('/level', { summary: '当前等级' })
  async level() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.achievementService.level(userId));
  }
}
