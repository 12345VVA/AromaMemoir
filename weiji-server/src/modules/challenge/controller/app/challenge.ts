import { Provide, Inject, Get, Post, Param } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { ChallengeService } from '../../service/challenge';

/**
 * C端挑战
 */
@Provide()
@CoolController({ api: [], prefix: '/app/challenge', description: 'C端挑战' })
export class AppChallengeController extends BaseController {
  @Inject()
  challengeService: ChallengeService;

  @Inject()
  ctx: Context;

  /**
   * 挑战列表
   */
  @Get('/list', { summary: '挑战列表' })
  async list() {
    return this.ok(await this.challengeService.list());
  }

  /**
   * 参与挑战
   */
  @Post('/:id/join', { summary: '参与挑战' })
  async join(@Param('id') id) {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.challengeService.join(userId, Number(id)));
  }

  /**
   * 当前用户挑战进度
   */
  @Get('/progress', { summary: '挑战进度' })
  async progress() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.challengeService.getProgress(userId));
  }
}
