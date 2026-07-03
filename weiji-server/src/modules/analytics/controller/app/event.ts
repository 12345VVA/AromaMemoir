import { Body, Get, Inject, Post, Provide, Query } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { AnalyticsEventService } from '../../service/event';

/**
 * C端埋点
 */
@Provide()
@CoolController({ api: [], prefix: '/app/analytics', description: 'C端埋点' })
export class AppAnalyticsController extends BaseController {
  @Inject()
  analyticsEventService: AnalyticsEventService;

  @Inject()
  ctx: Context;

  /**
   * 查询埋点事件
   */
  @Get('/events', { summary: '查询埋点事件' })
  async events(@Query() query: { type?: string }) {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.analyticsEventService.list(userId, query));
  }

  /**
   * 上报事件
   */
  @Post('/track', { summary: '上报事件' })
  async track(@Body() body: { type?: string; payload?: any; familyId?: number }) {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.analyticsEventService.track(userId, body));
  }
}
