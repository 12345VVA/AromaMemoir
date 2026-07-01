import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { WeeklyMenuEntity } from '../../entity/menu';

/**
 * B端周菜单管理
 */
@Provide()
@CoolController({
  prefix: '/admin/family/menu',
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: WeeklyMenuEntity,
  description: '周菜单管理',
})
export class AdminFamilyMenuController extends BaseController {}
