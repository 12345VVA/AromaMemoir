import { Body, Get, Inject, Post, Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { FamilyService } from '../../service/family';

/**
 * C端家庭组基础
 */
@Provide()
@CoolController({ api: [], prefix: '/app/family', description: 'C端家庭组基础' })
export class AppFamilyController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Inject()
  ctx: Context;

  /**
   * 查询当前家庭组，未加入返回 null
   */
  @Get('/', { summary: '查询当前家庭组' })
  async getMyFamily() {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    return this.ok(family);
  }

  /**
   * 创建家庭组
   */
  @Post('/', { summary: '创建家庭组' })
  async createFamily(@Body() body: { name: string; description?: string }) {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.createFamily(userId, body);
    return this.ok(family);
  }

  @Post('/leave', { summary: '退出家庭组' })
  async leave() {
    const userId = this.ctx.user?.userId;
    const result = await this.familyService.leaveFamily(userId);
    return this.ok(result);
  }

  @Post('/disband', { summary: '解散家庭组' })
  async disband() {
    const userId = this.ctx.user?.userId;
    const result = await this.familyService.disbandFamily(userId);
    return this.ok(result);
  }

  @Post('/transfer', { summary: '转让家庭组' })
  async transfer(@Body() body: { targetMemberId: number }) {
    const userId = this.ctx.user?.userId;
    const result = await this.familyService.transferOwnership(
      userId,
      body.targetMemberId
    );
    return this.ok(result);
  }
}
