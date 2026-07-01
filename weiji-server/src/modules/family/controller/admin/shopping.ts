import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { ShoppingItemEntity } from '../../entity/shopping';

/**
 * B端购物清单管理
 */
@Provide()
@CoolController({
  prefix: '/admin/family/shopping',
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: ShoppingItemEntity,
  description: '购物清单管理',
})
export class AdminFamilyShoppingController extends BaseController {}
