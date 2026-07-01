import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { AchievementEntity } from '../../entity/achievement';

/**
 * 成就定义管理
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: AchievementEntity,
  prefix: '/admin/achievement',
  description: '成就定义管理',
})
export class AdminAchievementController extends BaseController {}
