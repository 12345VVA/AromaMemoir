import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { CheckinEntity } from '../../entity/checkin';

/**
 * 打卡记录管理
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: CheckinEntity,
  prefix: '/admin/checkin',
  description: '打卡记录管理',
})
export class AdminCheckinController extends BaseController {}
