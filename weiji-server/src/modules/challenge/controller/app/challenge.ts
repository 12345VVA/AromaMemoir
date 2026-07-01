import { Provide, Inject, Get } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { ChallengeService } from '../../service/challenge';

/**
 * C端挑战
 */
@Provide()
@CoolController({ api: [], prefix: '/app/challenge', description: 'C端挑战' })
export class AppChallengeController extends BaseController {
  @Inject()
  challengeService: ChallengeService;

  /**
   * 挑战列表
   */
  @Get('/list', { summary: '挑战列表' })
  async list() {
    return this.ok(await this.challengeService.list());
  }
}
