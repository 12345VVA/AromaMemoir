import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { FamilyMemberEntity } from '../../entity/member';

/**
 * B端家庭成员关系管理
 */
@Provide()
@CoolController({
  prefix: '/admin/family/member',
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: FamilyMemberEntity,
  description: '家庭成员关系',
})
export class AdminFamilyMemberController extends BaseController {}
