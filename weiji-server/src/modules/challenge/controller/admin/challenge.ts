import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { ChallengeEntity } from '../../entity/challenge';

/**
 * 挑战赛配置管理
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: ChallengeEntity,
  prefix: '/admin/challenge',
  description: '挑战赛配置管理',
})
export class AdminChallengeController extends BaseController {}
