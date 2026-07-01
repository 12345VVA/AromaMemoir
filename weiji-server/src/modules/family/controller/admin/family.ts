import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { FamilyEntity } from '../../entity/family';

/**
 * B端家庭组管理
 */
@Provide()
@CoolController({
  prefix: '/admin/family',
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: FamilyEntity,
  description: '家庭组管理',
})
export class AdminFamilyController extends BaseController {}
