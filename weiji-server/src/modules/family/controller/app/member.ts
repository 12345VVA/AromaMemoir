import { Body, Del, Get, Inject, Param, Patch, Provide } from '@midwayjs/core';
import {
  CoolController,
  BaseController,
  CoolCommException,
} from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { FamilyService } from '../../service/family';

/**
 * C端家庭成员管理
 */
@Provide()
@CoolController({ api: [], prefix: '/app/family/member', description: 'C端家庭成员管理' })
export class AppFamilyMemberController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Inject()
  ctx: Context;

  /**
   * 列出当前家庭组全部成员
   */
  @Get('/list', { summary: '成员列表' })
  async list() {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      return this.ok({ list: [], total: 0 });
    }
    return this.ok(await this.familyService.listMembers(userId, family.id));
  }

  /**
   * 修改成员角色
   */
  @Patch('/:id', { summary: '修改成员角色' })
  async updateMember(@Param('id') id: string, @Body() body: { role: string }) {
    const userId = this.ctx.user?.userId;
    const updated = await this.familyService.updateMember(
      userId,
      Number(id),
      body
    );
    return this.ok(updated);
  }

  /**
   * 移除成员
   */
  @Del('/:id', { summary: '移除成员' })
  async remove(@Param('id') id: string) {
    const userId = this.ctx.user?.userId;
    await this.familyService.removeMember(userId, Number(id));
    return this.ok(null);
  }
}
