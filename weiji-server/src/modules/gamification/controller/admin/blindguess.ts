import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { BlindGuessRoundEntity } from '../../entity/blind_guess_round';
import { GamificationService } from '../../service/gamification';

/**
 * 盲猜轮次管理（B端）
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  prefix: '/admin/gamification/blindguess',
  entity: BlindGuessRoundEntity,
  service: GamificationService,
  description: '盲猜轮次管理',
})
export class AdminBlindGuessController extends BaseController {}
