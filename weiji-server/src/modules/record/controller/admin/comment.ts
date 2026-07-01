import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { RecordCommentEntity } from '../../entity/comment';
import { RecordService } from '../../service/record';

/**
 * 记录评论管理（B端）
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  prefix: '/admin/record/comment',
  entity: RecordCommentEntity,
  service: RecordService,
  description: '记录评论管理',
})
export class AdminRecordCommentController extends BaseController {}
