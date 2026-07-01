import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { UserAchievementEntity } from '../../entity/user_achievement';

/**
 * 用户成就解锁记录
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: UserAchievementEntity,
  prefix: '/admin/achievement/user',
  description: '用户成就解锁记录',
})
export class AdminUserAchievementController extends BaseController {}
