import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { FamilyInvitationEntity } from '../../entity/invitation';

/**
 * B端邀请码管理
 */
@Provide()
@CoolController({
  prefix: '/admin/family/invitation',
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: FamilyInvitationEntity,
  description: '邀请码管理',
})
export class AdminFamilyInvitationController extends BaseController {}
