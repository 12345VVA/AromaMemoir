import {
  Body,
  Del,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Provide,
} from '@midwayjs/core';
import {
  CoolController,
  BaseController,
  CoolCommException,
} from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { FamilyService } from '../../service/family';

/**
 * C端家庭购物清单
 */
@Provide()
@CoolController({ api: [], prefix: '/app/family/shopping', description: 'C端家庭购物清单' })
export class AppFamilyShoppingController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Inject()
  ctx: Context;

  /**
   * 列出当前家庭组购物清单
   */
  @Get('/list', { summary: '购物清单' })
  async list() {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      return this.ok({ list: [], total: 0 });
    }
    return this.ok(await this.familyService.listShopping(userId, family.id));
  }

  /**
   * 添加购物项
   */
  @Post('/', { summary: '添加购物项' })
  async addShopping(
    @Body() body: { name: string; category?: string; quantity?: string }
  ) {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      throw new CoolCommException('未加入家庭组');
    }
    const item = await this.familyService.addShopping(
      userId,
      family.id,
      body
    );
    return this.ok(item);
  }

  /**
   * 切换勾选状态
   */
  @Patch('/:id', { summary: '切换勾选状态' })
  async toggle(
    @Param('id') id: string,
    @Body() body: { checked?: boolean }
  ) {
    const userId = this.ctx.user?.userId;
    return this.ok(
      await this.familyService.toggleShopping(userId, Number(id), body)
    );
  }

  /**
   * 删除购物项
   */
  @Del('/:id', { summary: '删除购物项' })
  async remove(@Param('id') id: string) {
    const userId = this.ctx.user?.userId;
    await this.familyService.deleteShopping(userId, Number(id));
    return this.ok(null);
  }

  /**
   * 根据本周菜单自动生成购物清单
   */
  @Post('/generate', { summary: '生成购物清单' })
  async generate() {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      throw new CoolCommException('未加入家庭组');
    }
    return this.ok(
      await this.familyService.generateShopping(userId, family.id)
    );
  }
}
