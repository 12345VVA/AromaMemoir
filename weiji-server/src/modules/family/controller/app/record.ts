import { Body, Get, Inject, Post, Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { FamilyService } from '../../service/family';
import { RecordService } from '../../../record/service/record';

/**
 * C端家庭组动态（美食记录动态流/点赞/评论）
 */
@Provide()
@CoolController({ api: [], prefix: '/app/family/record', description: 'C端家庭组动态' })
export class AppFamilyRecordController extends BaseController {
  @Inject()
  familyService: FamilyService;

  @Inject()
  recordService: RecordService;

  @Inject()
  ctx: Context;

  /**
   * 家庭组动态列表
   */
  @Get('/list', { summary: '家庭组动态列表' })
  async list() {
    const userId = this.ctx.user?.userId;
    const membership = await this.familyService.getUserMembership(userId);
    if (!membership) {
      return this.ok({ list: [], total: 0, page: 1, pageSize: 20 });
    }
    const result = await this.recordService.listFamilyRecords(
      userId,
      membership.familyId,
      this.ctx.query,
    );
    return this.ok(result);
  }

  /**
   * 点赞/取消点赞（toggle）
   */
  @Post('/:id/like', { summary: '点赞/取消点赞' })
  async toggleLike() {
    const userId = this.ctx.user?.userId;
    const recordId = Number(this.ctx.params.id);
    const result = await this.recordService.toggleLike(userId, recordId);
    return this.ok(result);
  }

  /**
   * 评论
   */
  @Post('/:id/comment', { summary: '评论' })
  async comment(@Body() body: { content: string }) {
    const userId = this.ctx.user?.userId;
    const recordId = Number(this.ctx.params.id);
    const result = await this.recordService.comment(userId, recordId, body.content);
    return this.ok(result);
  }
}