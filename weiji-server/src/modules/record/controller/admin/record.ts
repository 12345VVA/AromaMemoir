import { Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { RecordEntity } from '../../entity/record';
import { RecordService } from '../../service/record';

/**
 * 美食记录管理（B端）
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  prefix: '/admin/record',
  entity: RecordEntity,
  service: RecordService,
  description: '美食记录管理',
})
export class AdminRecordController extends BaseController {}
