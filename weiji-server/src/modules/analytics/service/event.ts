import { Inject, Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { AnalyticsEventEntity } from '../entity/event';

/**
 * 埋点事件服务
 */
@Provide()
export class AnalyticsEventService extends BaseService {
  @InjectEntityModel(AnalyticsEventEntity)
  analyticsEventEntity: Repository<AnalyticsEventEntity>;

  @Inject()
  ctx: Context;

  /**
   * 上报事件
   * @param userId 用户ID（由 controller 从 ctx.user.userId 传入）
   * @param body 事件体 { type, payload?, familyId? }
   */
  async track(
    userId: number,
    body: { type?: string; payload?: any; familyId?: number }
  ) {
    if (!body?.type || !body.type.trim()) {
      throw new CoolCommException('type 必填');
    }
    const type = body.type.trim();
    await this.analyticsEventEntity.save({
      type,
      userId,
      payload: body.payload,
      familyId: body.familyId,
      ip: this.ctx.ip,
      ua: this.ctx.headers['user-agent'] as string,
    });
    return { type };
  }

  /**
   * 查询埋点事件
   * @param query 查询条件 { type? }
   */
  async list(query: { type?: string }) {
    const qb = this.analyticsEventEntity.createQueryBuilder('a');
    if (query?.type) {
      qb.andWhere('a.type = :type', { type: query.type });
    }
    qb.orderBy('a.createTime', 'DESC').limit(100);
    return qb.getMany();
  }
}
