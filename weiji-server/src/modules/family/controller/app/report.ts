import { Get, Inject, Provide, Query } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { FamilyService } from '../../service/family';
import { currentMonthStr } from '../../../../comm/date';

/**
 * C端家庭饮食月度报告
 */
@Provide()
@CoolController({ api: [], prefix: '/app/family', description: 'C端家庭饮食报告' })
export class AppFamilyReportController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Inject()
  ctx: Context;

  /**
   * 月度饮食报告
   */
  @Get('/report', { summary: '月度饮食报告' })
  async report(@Query('month') month?: string) {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      // 未加入家庭组 → 返回空报告
      const currentMonth = currentMonthStr();
      return this.ok({
        month: month || currentMonth,
        totalRecords: 0,
        prevMonthRecords: 0,
        memberContributions: [],
        topDishes: [],
        avgRating: 0,
        tagDistribution: [],
      });
    }
    return this.ok(
      await this.familyService.getReport(userId, family.id, month)
    );
  }
}
