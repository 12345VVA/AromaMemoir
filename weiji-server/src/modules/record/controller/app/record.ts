import { Provide, Inject, Get, Post, Query, Param, Body } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { RecordService } from '../../service/record';

/**
 * C端美食记录
 */
@Provide()
@CoolController({ api: [], prefix: '/app/record', description: 'C端美食记录' })
export class AppRecordController extends BaseController {
  @Inject()
  recordService: RecordService;

  @Inject()
  ctx: Context;

  /**
   * 分页查询当前用户记录
   * query: page,pageSize,tag,rating,keyword（均可选）
   */
  @Get('/list', { summary: '分页查询记录' })
  async listRecords(@Query() query) {
    return this.ok(await this.recordService.list(this.ctx.user?.userId, query));
  }

  /**
   * 记录详情（做归属校验，非本人 403）
   */
  @Get('/:id', { summary: '记录详情' })
  async get(@Param('id') id) {
    return this.ok(await this.recordService.get(this.ctx.user?.userId, id));
  }

  /**
   * 创建记录
   * body: dishName(必填) / cookingMethod / rating / note / nutrition / ingredients / tags / mealType / recordDate / imageUrl / beautifiedUrl / source / familyId
   */
  @Post('/save', { summary: '创建记录' })
  async save(@Body() body) {
    return this.ok(await this.recordService.save(this.ctx.user?.userId, body));
  }

  /**
   * 删除记录
   */
  @Post('/delete/:id', { summary: '删除记录' })
  async deleteRecord(@Param('id') id) {
    await this.recordService.delete(this.ctx.user?.userId, id);
    return this.ok();
  }
}
