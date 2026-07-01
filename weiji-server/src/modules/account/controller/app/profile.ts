import { Provide, Body, Inject, Get, Patch } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { AppAuthService } from '../../service/auth';
import { Context } from '@midwayjs/koa';

/**
 * C端用户资料
 */
@Provide()
@CoolController({ api: [], prefix: '/app/user', description: 'C端用户资料' })
export class AppUserProfileController extends BaseController {
  @Inject()
  appAuthService: AppAuthService;

  @Inject()
  ctx: Context;

  /**
   * 当前用户资料
   * 返回基本资料 + 统计占位（后续 record/family/achievement 模块就绪后补全）
   */
  @Get('/profile', { summary: '当前用户资料' })
  async profile() {
    const userId = this.ctx.user?.userId;
    const user = await this.appAuthService.getProfile(userId);
    return this.ok({
      ...user,
      // 统计占位，待 record/family/achievement 模块就绪后补全
      recordCount: 0,
      recipeCount: 0,
      streak: 0,
      achievementCount: 0,
    });
  }

  /**
   * 更新资料
   * @param body 昵称、头像
   */
  @Patch('/profile', { summary: '更新资料' })
  async updateProfile(@Body() body: { nickName?: string; avatarUrl?: string }) {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.appAuthService.updateProfile(userId, body));
  }
}
