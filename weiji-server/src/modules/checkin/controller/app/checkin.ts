import { Provide, Inject, Get, Post } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { CheckinService } from '../../service/checkin';

/**
 * C端打卡
 */
@Provide()
@CoolController({ api: [], prefix: '/app/checkin', description: 'C端打卡' })
export class AppCheckinController extends BaseController {
  @Inject()
  checkinService: CheckinService;

  @Inject()
  ctx: Context;

  /**
   * 今日打卡状态
   */
  @Get('/status', { summary: '今日打卡状态' })
  async status() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.checkinService.status(userId));
  }

  /**
   * 打卡
   */
  @Post('/', { summary: '打卡' })
  async checkin() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.checkinService.checkin(userId));
  }

  /**
   * 补签昨日
   */
  @Post('/replenish', { summary: '补签昨日' })
  async replenish() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.checkinService.replenish(userId));
  }
}
