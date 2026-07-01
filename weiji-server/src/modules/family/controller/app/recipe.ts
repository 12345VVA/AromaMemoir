import {
  Body,
  Del,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Provide,
  Put,
  Query,
} from '@midwayjs/core';
import {
  CoolController,
  BaseController,
  CoolCommException,
} from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { FamilyService } from '../../service/family';

/**
 * C端家庭菜谱
 */
@Provide()
@CoolController({ api: [], prefix: '/app/family/recipe', description: 'C端家庭菜谱' })
export class AppFamilyRecipeController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Inject()
  ctx: Context;

  /**
   * 列出家庭组菜谱
   */
  @Get('/list', { summary: '菜谱列表' })
  async list(
    @Query('visibility') visibility?: string,
    @Query('authorId') authorId?: number,
    @Query('category') category?: string,
    @Query('keyword') keyword?: string
  ) {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      throw new CoolCommException('未加入家庭组');
    }
    return this.ok(
      await this.familyService.listRecipes(userId, family.id, {
        visibility,
        authorId: authorId ? Number(authorId) : undefined,
        category,
        keyword,
      })
    );
  }

  /**
   * 上传菜谱
   */
  @Post('/', { summary: '上传菜谱' })
  async create(@Body() body: any) {
    const userId = this.ctx.user?.userId;
    const family = await this.familyService.getMyFamily(userId);
    if (!family) {
      throw new CoolCommException('未加入家庭组');
    }
    const recipe = await this.familyService.createRecipe(
      userId,
      family.id,
      body
    );
    return this.ok(recipe);
  }

  /**
   * 菜谱详情
   */
  @Get('/:id', { summary: '菜谱详情' })
  async getRecipe(@Param('id') id: string) {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.familyService.getRecipe(userId, Number(id)));
  }

  /**
   * 编辑菜谱
   */
  @Put('/:id', { summary: '编辑菜谱' })
  async updateRecipe(@Param('id') id: string, @Body() body: any) {
    const userId = this.ctx.user?.userId;
    return this.ok(
      await this.familyService.updateRecipe(userId, Number(id), body)
    );
  }

  /**
   * 删除菜谱
   */
  @Del('/:id', { summary: '删除菜谱' })
  async remove(@Param('id') id: string) {
    const userId = this.ctx.user?.userId;
    await this.familyService.deleteRecipe(userId, Number(id));
    return this.ok(null);
  }

  /**
   * 切换菜谱可见性
   */
  @Patch('/:id/visibility', { summary: '切换菜谱可见性' })
  async updateVisibility(
    @Param('id') id: string,
    @Body() body: { visibility: string }
  ) {
    const userId = this.ctx.user?.userId;
    return this.ok(
      await this.familyService.updateRecipeVisibility(
        userId,
        Number(id),
        body
      )
    );
  }
}
