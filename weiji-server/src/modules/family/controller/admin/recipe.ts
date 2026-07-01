import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { FamilyRecipeEntity } from '../../entity/recipe';

/**
 * B端家庭菜谱管理
 */
@Provide()
@CoolController({
  prefix: '/admin/family/recipe',
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: FamilyRecipeEntity,
  description: '家庭菜谱管理',
})
export class AdminFamilyRecipeController extends BaseController {}
