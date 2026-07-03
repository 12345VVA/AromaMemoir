import { Body, Inject, Post, Provide } from '@midwayjs/core';
import {
  CoolController,
  BaseController,
  CoolCommException,
} from '@cool-midway/core';
import { FamilyEntity } from '../../entity/family';
import { FamilyService } from '../../service/family';

/**
 * B端家庭组管理
 * add 禁止直接创建（须走 C 端 createFamily）；
 * delete 调 disbandFamily 级联清理；
 * update/info/page/list 沿用 cool-admin 自动 CRUD（只读/非破坏性）。
 */
@Provide()
@CoolController({
  prefix: '/admin/family',
  api: ['add', 'delete', 'update', 'info', 'page', 'list'],
  entity: FamilyEntity,
  description: '家庭组管理',
})
export class AdminFamilyController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Post('/add', { summary: '新增家庭组' })
  async add(): Promise<{ code: number; message: string }> {
    throw new CoolCommException('请通过 C 端创建家庭组接口创建', 400);
  }

  @Post('/delete', { summary: '删除家庭组' })
  async delete(@Body() body: { ids: number[] } = { ids: [] }) {
    for (const familyId of body.ids) {
      await this.familyService.disbandFamily(familyId, { adminForce: true });
    }
    return this.ok({ success: true });
  }
}
