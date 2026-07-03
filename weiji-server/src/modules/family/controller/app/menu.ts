import { Body, Get, Inject, Param, Post, Provide } from '@midwayjs/core';
import {
  CoolController,
  BaseController,
  CoolCommException,
} from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { FamilyService } from '../../service/family';

/**
 * C端家庭协作菜单
 */
@Provide()
@CoolController({ api: [], prefix: '/app/family/menu', description: 'C端家庭协作菜单' })
export class AppFamilyMenuController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Inject()
  ctx: Context;

  /**
   * 列出本周菜单
   */
  @Get('/list', { summary: '菜单列表' })
  async list() {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      return this.ok({ list: [], total: 0 });
    }
    return this.ok(await this.familyService.listMenu(userId, family.id));
  }

  /**
   * 添加菜单项
   */
  @Post('/', { summary: '添加菜单项' })
  async addMenu(@Body() body: any) {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      throw new CoolCommException('未加入家庭组');
    }
    const item = await this.familyService.addMenu(userId, family.id, body);
    return this.ok(item);
  }

  /**
   * 菜单项投票
   */
  @Post('/:id/vote', { summary: '菜单项投票' })
  async vote(@Param('id') id: string, @Body() body: { vote: string }) {
    const userId = this.ctx.user?.userId;
    return this.ok(
      await this.familyService.voteMenu(userId, Number(id), body)
    );
  }
}
