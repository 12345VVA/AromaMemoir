import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { RecordLikeEntity } from '../../entity/like';
import { RecordService } from '../../service/record';

/**
 * 记录点赞管理（B端）
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  prefix: '/admin/record/like',
  entity: RecordLikeEntity,
  service: RecordService,
  description: '记录点赞管理',
})
export class AdminRecordLikeController extends BaseController {}
