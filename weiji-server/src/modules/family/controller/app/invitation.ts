import { Body, Get, Inject, Post, Provide } from '@midwayjs/core';
import {
  CoolController,
  BaseController,
  CoolCommException,
} from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { FamilyService } from '../../service/family';

/**
 * C端家庭邀请
 */
@Provide()
@CoolController({ api: [], prefix: '/app/family', description: 'C端家庭邀请' })
export class AppFamilyInvitationController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Inject()
  ctx: Context;

  /**
   * 生成 24h 有效邀请码
   */
  @Post('/invitation', { summary: '生成邀请码' })
  async createInvitation() {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      throw new CoolCommException('未加入家庭组');
    }
    return this.ok(await this.familyService.createInvitation(userId, family.id));
  }

  /**
   * 列出当前家庭组有效邀请码
   */
  @Get('/invitation/list', { summary: '邀请码列表' })
  async listInvitations() {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      throw new CoolCommException('未加入家庭组');
    }
    return this.ok(
      await this.familyService.listInvitations(userId, family.id)
    );
  }

  /**
   * 通过邀请码加入家庭组
   */
  @Post('/join', { summary: '加入家庭组' })
  async joinFamily(@Body() body: { code: string }) {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.joinFamily(userId, body);
    return this.ok(family);
  }
}
